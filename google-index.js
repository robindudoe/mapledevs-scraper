const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

let key;
const rawKey = process.env.GOOGLE_INDEXING_KEY;

if (rawKey) {
    try {
        key = JSON.parse(rawKey.trim());
    } catch (e1) {
        try {
            const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf8');
            key = JSON.parse(decoded);
        } catch (e2) {
            console.error('❌ Failed to parse GOOGLE_INDEXING_KEY.');
            process.exit(1);
        }
    }
}

if (!key || !key.private_key) {
    console.error(`❌ No valid credentials found`);
    process.exit(1);
}

// THE FINAL GOOGLE KEY REPAIR
let privateKey = key.private_key.replace(/\\n/g, '\n').trim();

// Ensure it has the correct PEM headers
if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
}

const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/indexing'],
    null
);

async function indexUrls() {
    console.log('🔗 Starting Google Indexing Ping...');
    try {
        await jwtClient.authorize();
        console.log('✅ Google Authentication Successful!');
        const indexing = google.indexing('v3');

        if (!fs.existsSync(SITEMAP_PATH)) {
            console.error('❌ sitemap.xml not found!');
            return;
        }

        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match;
        const urls = [];

        while ((match = urlRegex.exec(sitemap)) !== null) {
            urls.push(match[1]);
        }

        console.log(`🔍 Found ${urls.length} URLs for indexing.`);

        for (const url of urls) {
            try {
                await new Promise(resolve => setTimeout(resolve, 300)); 
                await indexing.urlNotifications.publish({
                    auth: jwtClient,
                    requestBody: { url: url, type: 'URL_UPDATED' }
                });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) {
                console.error(`❌ Failed to index ${url}:`, err.message);
            }
        }
    } catch (err) {
        console.error('❌ Authentication failed:', err.message);
    }
}

indexUrls();
