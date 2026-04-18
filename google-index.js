const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

/**
 * Parse the private key from whatever format was pasted into GitHub Secrets.
 * Handles: full JSON, just the private_key field value, or base64-encoded versions of either.
 */
function parseServiceAccount(raw) {
    if (!raw) return null;
    let str = raw.trim();

    // Try JSON parse first (user pasted the whole JSON file)
    try {
        const obj = JSON.parse(str);
        if (obj.private_key && obj.client_email) {
            return {
                privateKey: obj.private_key.replace(/\\n/g, '\n'),
                clientEmail: obj.client_email
            };
        }
    } catch (e) { /* not JSON, continue */ }

    // Try base64 decode then JSON parse
    try {
        const decoded = Buffer.from(str, 'base64').toString('utf-8');
        const obj = JSON.parse(decoded);
        if (obj.private_key && obj.client_email) {
            return {
                privateKey: obj.private_key.replace(/\\n/g, '\n'),
                clientEmail: obj.client_email
            };
        }
    } catch (e) { /* not base64 JSON, continue */ }

    // It's just the raw private key string — fix escaped newlines
    let key = str.replace(/\\n/g, '\n');
    if (!key.includes('-----BEGIN')) {
        // Maybe it's base64-encoded PEM
        try {
            const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString('utf-8');
            if (decoded.includes('-----BEGIN')) key = decoded;
        } catch (e) { /* give up on base64 */ }
    }

    return {
        privateKey: key,
        clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null
    };
}

async function run() {
    console.log('🔗 Starting Google Indexing...');

    const rawKey = process.env.GOOGLE_INDEXING_KEY;
    if (!rawKey) {
        console.log('⚠️ GOOGLE_INDEXING_KEY not set — skipping indexing.');
        return;
    }

    const creds = parseServiceAccount(rawKey);
    if (!creds || !creds.privateKey) {
        console.error('❌ Could not parse private key from GOOGLE_INDEXING_KEY.');
        return;
    }
    if (!creds.clientEmail) {
        console.error('❌ No client_email found. Set GOOGLE_INDEXING_KEY to the full JSON, or also set GOOGLE_SERVICE_ACCOUNT_EMAIL.');
        return;
    }

    console.log(`   Service account: ${creds.clientEmail}`);

    // Step 1: Create a signed JWT
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: creds.clientEmail,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    })).toString('base64url');

    const signInput = `${header}.${payload}`;
    let signature;
    try {
        signature = crypto.createSign('RSA-SHA256')
            .update(signInput)
            .sign(creds.privateKey, 'base64url');
    } catch (err) {
        console.error('❌ Failed to sign JWT — private key is likely malformed.');
        console.error('   Detail:', err.message);
        return;
    }

    const jwt = `${signInput}.${signature}`;

    // Step 2: Exchange JWT for an OAuth2 access token
    let accessToken;
    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        });
        accessToken = tokenRes.data.access_token;
        console.log('✅ OAuth2 access token obtained.');
    } catch (err) {
        console.error('❌ Token exchange failed:', err.response?.data?.error_description || err.message);
        return;
    }

    // Step 3: Read sitemap and submit URLs
    if (!fs.existsSync(SITEMAP_PATH)) {
        console.log('⚠️ sitemap.xml not found — skipping.');
        return;
    }

    const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const urls = [];
    const urlRegex = /<loc>(https:\/\/mapledevs\.ca\/.*?)<\/loc>/g;
    let match;
    while ((match = urlRegex.exec(sitemap)) !== null) urls.push(match[1]);

    console.log(`🔍 Found ${urls.length} URLs to index.`);

    let success = 0, fail = 0;
    for (const url of urls) {
        try {
            await axios.post('https://indexing.googleapis.com/v3/urlNotifications:publish', {
                url: url,
                type: 'URL_UPDATED'
            }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            success++;
            console.log(`   ✅ ${url}`);
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            fail++;
            const msg = err.response?.data?.error?.message || err.message;
            console.log(`   ❌ ${url}: ${msg}`);
        }
    }
    console.log(`\n✨ Indexing complete: ${success} succeeded, ${fail} failed.`);
}

run().catch(err => {
    console.error('❌ Indexing script error:', err.message);
});
