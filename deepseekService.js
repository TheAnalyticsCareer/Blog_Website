const axios = require('axios');
require('dotenv').config();

class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.baseUrl = 'https://api.deepseek.com/v1'; 
    }

    async generateTrendAnalysisBlog() {
        try {
            const prompt = `
            Analyze the latest trends from major news channels, big tech CEOs, 
            and famous thinkers from the past 48 hours. Create a comprehensive 
            blog post that:
            
            1. Identifies 3-5 key emerging trends
            2. Provides analysis of each trend with supporting evidence
            3. Includes quotes from relevant experts
            4. Offers predictions for how these trends might evolve
            5. Concludes with actionable insights
            
            Structure the blog with:
            - Engaging title
            - Introduction
            - Trend sections with headers
            - Conclusion
            - List of key sources analyzed
            
            Make the content informative yet accessible to a general audience.
            `;

            const response = await axios.post(`${this.baseUrl}/chat/completions`, {
                model: "deepseek-chat", 
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                title: this.extractTitle(response.data.choices[0].message.content),
                content: response.data.choices[0].message.content,
                sources: this.extractSources(response.data.choices[0].message.content)
            };
        } catch (error) {
            console.error('DeepSeek API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    extractTitle(content) {
        // Extract the first line as title or implement more sophisticated extraction
        return content.split('\n')[0].replace(/^#+\s*/, '');
    }

    extractSources(content) {
        // Extract sources section or implement more sophisticated extraction
        const sourcesMatch = content.match(/Sources:\n([\s\S]*)$/i);
        return sourcesMatch ? sourcesMatch[1].trim() : 'Various news sources and expert opinions';
    }
}

module.exports = new DeepSeekService();