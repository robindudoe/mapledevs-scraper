const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';
const SNAPSHOT_PATH = path.join(__dirname, 'tracked_jobs.json');

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_PERSON_URN;

/**
 * Validates and repairs the LinkedIn author URN.
 * Must be exactly: urn:li:person:XXXXX or urn:li:organization:XXXXX
 */
function resolveAuthorUrn(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();

    // Already valid
    if (/^urn:li:(person|organization):\S+$/.test(trimmed)) return trimmed;

    // Has urn:li: but wrong format
    if (trimmed.startsWith('urn:li:')) return trimmed; // pass through, let API give specific error

    // Just an ID number — assume person
    if (/^\d+$/.test(trimmed)) return `urn:li:person:${trimmed}`;

    // Starts with person: or organization: but missing urn:li:
    if (trimmed.startsWith('person:') || trimmed.startsWith('organization:')) {
        return `urn:li:${trimmed}`;
    }

    // Alphanumeric slug — assume person
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return `urn:li:person:${trimmed}`;

    return trimmed;
}

async function postToLinkedIn(message) {
    if (!LINKEDIN_ACCESS_TOKEN) {
        console.log('⚠️ LINKEDIN_ACCESS_TOKEN not set — skipping LinkedIn.');
        return;
    }

    const authorUrn = resolveAuthorUrn(LINKEDIN_AUTHOR_URN);

    // Diagnostic logging
    console.log('📣 Posting to LinkedIn...');
    console.log(`   Raw LINKEDIN_AUTHOR_URN env: "${LINKEDIN_AUTHOR_URN || '(empty)'}"`);
    console.log(`   Resolved author URN: "${authorUrn || '(null)'}"`);

    if (!authorUrn) {
        console.error('❌ Cannot post: LINKEDIN_AUTHOR_URN is not set.');
        console.error('   Set it in GitHub Secrets to: urn:li:person:YOUR_LINKEDIN_MEMBER_ID');
        console.error('   You can find your ID by running: node verify-linkedin.js');
        return;
    }

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const payload = {
        "author": authorUrn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": { "text": message },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    };

    try {
        await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('✅ LinkedIn post successful!');
    } catch (error) {
        const status = error.response?.status || 'unknown';
        const data = error.response?.data;
        console.log(`⚠️ LinkedIn post failed: HTTP ${status}`);
        if (data) {
            console.log('   Response:', JSON.stringify(data, null, 2));
        }
        if (status === 403) {
            console.log('   💡 Check that your LinkedIn app has the "w_member_social" scope.');
            console.log('   💡 Make sure your access token is not expired (they last ~60 days).');
        }
        if (status === 422 || (data?.message || '').includes('author')) {
            console.log('   💡 The author URN is invalid. Run "node verify-linkedin.js" to get your correct URN.');
        }
    }
}

async function run() {
    try {
        const csvData = await axios.get(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`).then(r => r.data);
        const ls = csvData.trim().split("\n");
        const currentJobs = ls.slice(1).map(l => {
            const c = l.split(',');
            return { title: (c[0]||'').replace(/^"|"$/g,''), studio: (c[1]||'').replace(/^"|"$/g,''), location: (c[2]||'').replace(/^"|"$/g,'') };
        });

        let prevJobs = [];
        if (fs.existsSync(SNAPSHOT_PATH)) prevJobs = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

        const prevKeys = new Set(prevJobs.map(j => `${j.title}|${j.studio}`.toLowerCase()));
        const newJobs = currentJobs.filter(j => !prevKeys.has(`${j.title}|${j.studio}`.toLowerCase()));

        if (newJobs.length === 0) {
            console.log('📋 No new jobs to post.');
            return;
        }

        console.log(`📋 Found ${newJobs.length} new jobs to announce.`);

        let postContent = `Happy Day! 🍁\n\nWe found ${newJobs.length} new opportunities on MapleDevs:\n\n`;
        newJobs.slice(0, 5).forEach(j => { postContent += `✨ ${j.title} at ${j.studio} (${j.location})\n`; });
        if (newJobs.length > 5) postContent += `...and ${newJobs.length - 5} more!\n`;
        postContent += `\nCheck them out: https://mapledevs.ca\n\n#GameDev #Canada #MapleDevs`;

        await postToLinkedIn(postContent);
        fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentJobs, null, 2));
    } catch (e) {
        console.log('⚠️ LinkedIn process error:', e.message);
    }
}

run();
