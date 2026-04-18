const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';
const SNAPSHOT_PATH = path.join(__dirname, 'tracked_jobs.json');

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PRESET_AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_PERSON_URN; 

async function getAuthenticatedUserUrn() {
    try {
        const res = await axios.get('https://api.linkedin.com/v2/me', {
            headers: { 'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}` }
        });
        return `urn:li:person:${res.data.id}`;
    } catch (e) {
        return null;
    }
}

async function postToLinkedIn(message) {
    if (!LINKEDIN_ACCESS_TOKEN) return;

    let authorUrn = PRESET_AUTHOR_URN;
    const personalUrn = await getAuthenticatedUserUrn();
    
    // If no author URN provided or if we want to be safe, use the personal one
    if (!authorUrn || !authorUrn.includes(':')) {
        authorUrn = personalUrn;
    }

    console.log(`📣 Posting to LinkedIn as: ${authorUrn}...`);

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
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('✅ LinkedIn post successful!');
    } catch (error) {
        // FINAL FALLBACK: If posting as Org failed (403), try posting as the Person
        if (error.response && error.response.status === 403 && authorUrn !== personalUrn) {
            console.log('⚠️ Org post failed, falling back to Personal Profile...');
            payload.author = personalUrn;
            try {
                await axios.post(url, payload, {
                    headers: {
                        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                });
                console.log('✅ LinkedIn fallback post successful!');
                return;
            } catch (e2) {}
        }
        console.error('❌ LinkedIn API Error:', error.response ? error.response.status : error.message);
    }
}

async function run() {
    const csvData = await axios.get(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`).then(r => r.data);
    const ls = csvData.trim().split("\n");
    const currentJobs = ls.slice(1).map(l => {
        const c = l.split(','); // Simplified for brevity
        return { title: (c[0]||'').replace(/^"|"$/g,''), studio: (c[1]||'').replace(/^"|"$/g,''), location: (c[2]||'').replace(/^"|"$/g,'') };
    });
    
    let prevJobs = [];
    if (fs.existsSync(SNAPSHOT_PATH)) prevJobs = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    
    const prevKeys = new Set(prevJobs.map(j => `${j.title}|${j.studio}`.toLowerCase()));
    const newJobs = currentJobs.filter(j => !prevKeys.has(`${j.title}|${j.studio}`.toLowerCase()));
    
    if (newJobs.length === 0) return;
    
    let postContent = `Happy Day! 🍁\n\nWe found ${newJobs.length} new Canadian game dev jobs:\n\n`;
    newJobs.slice(0, 5).forEach(j => { postContent += `✨ ${j.title} at ${j.studio} (${j.location})\n`; });
    postContent += `\nCheck them out: https://mapledevs.ca\n\n#GameDev #Canada #MapleDevs`;

    await postToLinkedIn(postContent);
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentJobs, null, 2));
}

run().catch(console.error);
