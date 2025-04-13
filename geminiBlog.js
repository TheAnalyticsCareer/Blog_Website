const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require('./db');
require("dotenv").config();

const cron = require("node-cron");




// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// Function to generate blog content using Gemini
async function generateBlog () {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Generate a professional blog post about a trending AI topic in technology. 
        Include an engaging title, introduction, several informative paragraphs with subheadings, 
        and a conclusion. The blog should be at least 800 words.`;

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
  "0 0 */2 * *",
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

  

module.exports=new Gemini