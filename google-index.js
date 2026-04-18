const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

async function run() {
    console.log('🔗 Starting Google Indexing (Bulletproof Mode)...');
    
    const rawKey = process.env.GOOGLE_INDEXING_KEY;
    if (!rawKey) {
        console.error('❌ GOOGLE_INDEXING_KEY is missing from environment!');
        return;
    }

    console.log(`📊 Secret Length: ${rawKey.length} characters.`);
    console.log(`📊 Secret Start: ${rawKey.substring(0, 15)}...`);

    let keyData;
    try {
        // Step 1: Handle Base64 if you pasted it that way
        if (!rawKey.trim().startsWith('{')) {
            console.log('📦 Attempting Base64 decode...');
            const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf8');
            keyData = JSON.parse(decoded);
        } else {
            // Step 2: Handle raw JSON with potential mangled newlines
            console.log('📦 Parsing raw JSON...');
            let sanitized = rawKey.trim();
            // Remove wrapping quotes if GitHub added them
            if (sanitized.startsWith('"') && sanitized.endsWith('"')) sanitized = sanitized.slice(1, -1);
            
            // Fix double-escaped newlines
            keyData = JSON.parse(sanitized.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n'));
        }
    } catch (e) {
        console.error('⚠️ Direct parse failed. Reconstructing from raw string patterns...');
        const emailMatch = /"client_email":\s*"([^"]+)"/.exec(rawKey);
        const keyMatch = /"private_key":\s*"([^"]+)"/.exec(rawKey);
        
        if (emailMatch && keyMatch) {
            keyData = {
                client_email: emailMatch[1],
                private_key: keyMatch[1].replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
            };
            console.log('✅ Reconstructed key from raw patterns.');
        }
    }

    if (!keyData || !keyData.private_key) {
        console.error('❌ FATAL: Could not extract private_key. Please re-check your GitHub Secret!');
        return;
    }

    // Step 3: Ensure PEM headers are clean
    let pk = keyData.private_key.trim();
    if (!pk.includes('-----BEGIN')) {
        pk = `-----BEGIN PRIVATE KEY-----\n${pk}\n-----END PRIVATE KEY-----`;
    }
    
    // Ensure internal newlines are real newlines, not strings
    pk = pk.split('\\n').join('\n');

    console.log(`🔑 Key Format: ${pk.startsWith('-----BEGIN') ? 'PEM Valid' : 'Raw Content'}`);
    console.log(`📧 Service Email: ${keyData.client_email}`);

    try {
        const auth = google.auth.fromJSON({
            client_email: keyData.client_email,
            private_key: pk
        });
        auth.scopes = ['https://www.googleapis.com/auth/indexing'];
        const indexing = google.indexing({ version: 'v3', auth });

        if (!fs.existsSync(SITEMAP_PATH)) {
            console.error('❌ sitemap.xml missing!');
            return;
        }

        const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
        const urls = [];
        const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
        let match;
        while ((match = urlRegex.exec(sitemap)) !== null) urls.push(match[1]);

        console.log(`🔍 Found ${urls.length} URLs. Pinging Google...`);

        for (const url of urls) {
            try {
                await indexing.urlNotifications.publish({
                    requestBody: { url: url, type: 'URL_UPDATED' }
                });
                console.log(`✅ Indexed: ${url}`);
            } catch (err) {
                console.log(`❌ Fail ${url}: ${err.message}`);
                if (err.message.includes('supported') || err.message.includes('decoder')) {
                    console.error('🛑 CRITICAL: The private key format is still being rejected by OpenSSL.');
                    process.exit(1); 
                }
            }
        }
    } catch (err) {
        console.error('❌ Auth Error:', err.message);
    }
}

run().catch(console.error);
