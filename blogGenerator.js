const db = require("./db");
const cron = require("node-cron");

class BlogGenerator {
  constructor() {
    this.initializeScheduler();
  }

  async generateAndStoreBlog() {
    try {
      console.log("Starting blog generation process...");

      // Generate blog content using DeepSeek
      const blogData = await deepseekService.generateTrendAnalysisBlog();

      // Store in MySQL
      await this.storeBlogInDatabase(blogData);

      console.log("Blog generated and stored successfully!");
      return blogData;
    } catch (error) {
      console.error("Blog generation failed:", error);
      throw error;
    }
  }

  async storeBlogInDatabase(blogData) {
    const [result] = await db.execute(
      "INSERT INTO generated_blogs (title, content, sources_analyzed) VALUES (?, ?, ?)",
      [blogData.title, blogData.content, blogData.sources]
    );
    return result;
  }

  initializeScheduler() {
    // Schedule to run every two days (from .env)
    cron.schedule(process.env.SCHEDULE_CRON, async () => {
      console.log("Running scheduled blog generation...");
      try {
        await this.generateAndStoreBlog();
      } catch (error) {
        console.error("Scheduled blog generation failed:", error);
      }
    });

    console.log("Blog generator scheduler initialized");
  }
}

module.exports = new BlogGenerator();
