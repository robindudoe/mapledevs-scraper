const fs = require('fs-extra');
const path = require('path');
const https = require('https');
require('dotenv').config();

const DRAFTS_DIR = path.join(__dirname, 'blog-drafts');

/**
 * AI Draft Generator (Direct API version)
 */
async function generateDraft(topic) {
    console.log(`[AI Draft] Researching topic: ${topic}...`);
    
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('MISSING_API_KEY');

    const prompt = `
        You are an expert SEO Content Engineer for MapleDevs, Canada's #1 game industry job board.
        Your task is to generate a high-quality blog post draft about the following topic: "${topic}"

        CRITICAL RULES:
        1. TONALITY: Professional, insightful, and focused on the Canadian gaming community. Use "MapleDevs Editorial" or "The Maple Feed" branding.
        2. NO BANNED TERMS: Never use "Swarm", "AI-Powered", or "Intelligence".
        3. SOURCES: Include at least 2 real sources/links relevant to Canadian game dev.
        4. OUTPUT: You must output a valid JSON object only. No markdown around it.
        
        JSON STRUCTURE:
        {
          "status": "draft",
          "slug": "url-friendly-slug",
          "title": "Compelling Headline",
          "seo_title": "SEO Optimized Title",
          "meta_description": "Meta description (max 160 chars)",
          "summary": "Internal summary",
          "html_body": "Clean HTML only (h2 and p tags). No markdown.",
          "sources": [
            { "title": "Source Name", "url": "https://...", "used_for": "Reason" }
          ]
        }
    `;

    const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', async () => {
            try {
                const response = JSON.parse(body);
                if (response.error) throw new Error(response.error.message);
                
                const text = response.candidates[0].content.parts[0].text;
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('AI_FAILED_TO_GENERATE_JSON');
                
                const draft = JSON.parse(jsonMatch[0]);
                draft.created_at = new Date().toISOString();
                
                const filename = `${draft.slug}.json`;
                await fs.writeJson(path.join(DRAFTS_DIR, filename), draft, { spaces: 2 });
                
                console.log(`[AI Draft] SUCCESS: Draft saved to blog-drafts/${filename}`);
            } catch (err) {
                console.error('[AI Draft Error]', err.message);
                process.exit(1);
            }
        });
    });

    req.on('error', (error) => {
        console.error('[Network Error]', error);
        process.exit(1);
    });

    req.write(data);
    req.end();
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node generate-blog-draft.js "Topic Name"');
    process.exit(1);
}

generateDraft(args.join(' '));
