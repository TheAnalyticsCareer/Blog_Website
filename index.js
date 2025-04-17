const express = require("express");
const blogGenerator = require("./blogGenerator");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");


const pool = require("./db");

require("dotenv").config();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const cron = require("node-cron");

const app = express();
// const PORT =  3000;
const PORT = process.env.PORT || 3000;

// Cache for 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300 });

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});


// -----------------------------------------------------

// app.use(cors({
//   origin: 'blog-website-ui.vercel.app',
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true
// }));


app.use(cors())


// ----------------------------------------------------------------

app.use(express.json());
app.use(limiter);



// ---------------gemini blog generation--------------------------

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to generate blog content using Gemini
async function generateBlog() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Generate a professional blog post about trending topics like, list of topics:
    "AI",
    "LLM",
    "NVIDIA",
    "OpenAI",
    "MetaAI",
    "Microsoft Copilot",
    "IBM",
    "DeepSeek AI",
    
    and all the topics revolving around technology.

    Choose one of the topic from the list of topics randomly.
        Include an engaging unique title, introduction, several informative paragraphs with subheadings, with points, 
        and a conclusion. The blog should be in proper format maintaing professional standards should be at least 1500 words.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract title (first line) and content (rest)
    const title = text.split("\n")[0].replace("Title: ", "").trim();
    const content = text.split("\n").slice(1).join("\n").trim();

    return { title, content };
  } catch (error) {
    console.error("Error generating blog:", error);
    throw error;
  }
}

//--------------------- Function to save blog to database------------------
async function saveBlogToDB(title, content) {
  try {
    const [result] = await pool.execute(
      "INSERT INTO blogs (title, content) VALUES (?, ?)",
      [title, content]
    );
    console.log(`Blog saved with ID: ${result.insertId}`);
    return result;
  } catch (error) {
    console.error("Error saving blog to database:", error);
    throw error;
  }
}

//--------------- Scheduled job to generate and save blog every 2 days-------------------
cron.schedule(
  "*/30 * * * * ",

  async () => {
    console.log("Running scheduled blog generation...");
    try {
      const { title, content } = await generateBlog();
      await saveBlogToDB(title, content);
      console.log("Blog generated and saved successfully!");
    } catch (error) {
      console.error("Error in scheduled job:", error);
    }
  },
  {
    scheduled: true,
    timezone: "America/New_York", // Set your timezone
  }
);

//------------------- API endpoint to manually trigger blog generation-----------
app.get("/generate-blog", async (req, res) => {
  try {
    const { title, content } = await generateBlog();
    await saveBlogToDB(title, content);
    res.json({
      success: true,
      message: "Blog generated and saved successfully!",
    });
  } catch (error) {
    console.error("Error in manual generation:", error);
    res.status(500).json({ success: false, message: "Error generating blog" });
  }
});

//---------------------------- API endpoint to get all blogs--------------------------
app.get("/blogs", async (req, res) => {
  console.log("request from live---")
  try {
    const [rows] = await pool.query(
      "SELECT * FROM blogs ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ success: false, message: "Error fetching blogs" });
  }
});

// ------------------get unique blog by id-----------------------

app.get("/getUniqueBlog/:blogId", async (req, res) => {
  const { blogId } = req.params;
  console.log("blogId---", blogId);
  try {
    const query = "SELECT * FROM blogs WHERE id=?";
    const [row] = await pool.query(query, [blogId]);
    console.log("row of unique blog by id---", row);
    res.json(row);
  } catch (err) {
    console.log("error fetching blog by id--", err);
    res.status(500).json({ message: "error fetching blog by id", error: err });
  }
});

// ------------------------------------------------------------

// Route to fetch news by topic
app.get("/api/news/:topic", async (req, res) => {
  try {
    const { topic } = req.params;

    // Input validation
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({
        error: "Invalid topic parameter",
      });
    }

    // Sanitize topic (basic example)
    const sanitizedTopic = topic.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    if (!sanitizedTopic) {
      return res.status(400).json({
        error: "Topic contains no valid characters",
      });
    }

    // Check cache first
    const cacheKey = `news-${sanitizedTopic}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const API_KEY = process.env.NEWS_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        error: "Server configuration error",
      });
    }

    const response = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(
        sanitizedTopic
      )}&apiKey=${API_KEY}`
    );

    // Handle NewsAPI errors
    if (response.data.status !== "ok") {
      return res.status(500).json({
        error: response.data.message || "NewsAPI error",
      });
    }

    // Filter and format response

    
    const EXCLUDED_KEYWORDS = ['sex', 'adult']; 

    // Filter and format response
    const articles = response.data.articles
      .filter(article => {
        // Skip if no title
        if (!article.title) return false;
        
        // Check if title contains any excluded keywords
        const lowerTitle = article.title.toLowerCase();
        return !EXCLUDED_KEYWORDS.some(keyword => 
          lowerTitle.includes(keyword.toLowerCase())
        );
      })
      .map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        imageUrl: article.urlToImage,
        publishedAt: article.publishedAt,
        source: article.source?.name,
      }));



    // Cache the results
    cache.set(cacheKey, articles);
  
    res.json(articles);

  } catch (error) {
    console.error("News fetch error:", error);

    // Handle axios errors
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data.message || "NewsAPI request failed",
      });
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});






app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
 
  blogGenerator.initializeScheduler();
});
