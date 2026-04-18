const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const TEMP_KEY_PATH = path.join(__dirname, 'google_key_tmp.json');

const rawKey = process.env.GOOGLE_INDEXING_KEY;

if (!rawKey) {
    console.log('⚠️ No GOOGLE_INDEXING_KEY found. Skipping indexing.');
    process.exit(0);
}

// THE STABLE FILE STRATEGY
// We write the key to a shielded file so the library can parse it natively
try {
    let keyObject;
    try {
        keyObject = JSON.parse(rawKey.trim());
    } catch (e) {
        const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf8');
        keyObject = JSON.parse(decoded);
    }
    
    // Repair the private key newlines one last time inside the object
    keyObject.private_key = keyObject.private_key.replace(/\\n/g, '\n');
    
    fs.writeFileSync(TEMP_KEY_PATH, JSON.stringify(keyObject));
} catch (err) {
    console.error('❌ Failed to prepare key file:', err.message);
    process.exit(0); // Exit gracefully so the website still updates
}

async function indexUrls() {
    console.log('🔗 Starting Google Indexing...');
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: TEMP_KEY_PATH,
            scopes: ['https://www.googleapis.com/auth/indexing'],
        });
        const jwtClient = await auth.getClient();
        const indexing = google.indexing('v3');

        if (!fs.existsSync(SITEMAP_PATH)) {
            console.error('⚠️ sitemap.xml missing. Skipping.');
            return;
        }

        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match;
        const urls = [];
        while ((match = urlRegex.exec(sitemap)) !== null) urls.push(match[1]);

        console.log(`🔍 Pinging ${urls.length} URLs...`);

        for (const url of urls) {
            try {
                await new Promise(resolve => setTimeout(resolve, 300)); 
                await indexing.urlNotifications.publish({
                    auth: jwtClient,
                    requestBody: { url: url, type: 'URL_UPDATED' }
                });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) {
                console.log(`⚠️ Skip ${url}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('⚠️ Google Auth Error:', err.message);
    } finally {
        if (fs.existsSync(TEMP_KEY_PATH)) fs.unlinkSync(TEMP_KEY_PATH);
    }
}

indexUrls();
