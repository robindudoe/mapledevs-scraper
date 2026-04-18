const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';
const SNAPSHOT_PATH = path.join(__dirname, 'tracked_jobs.json');

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PRESET_AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_PERSON_URN; 

async function postToLinkedIn(message) {
    if (!LINKEDIN_ACCESS_TOKEN) return;

    console.log('📣 Posting to LinkedIn...');

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const payload = {
        "author": PRESET_AUTHOR_URN,
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
        console.log('⚠️ LinkedIn post failed (skipping):', error.response ? error.response.status : error.message);
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
        
        if (newJobs.length === 0) return;
        
        let postContent = `Happy Day! 🍁\n\nWe found ${newJobs.length} new opportunities on MapleDevs:\n\n`;
        newJobs.slice(0, 5).forEach(j => { postContent += `✨ ${j.title} at ${j.studio} (${j.location})\n`; });
        postContent += `\nCheck them out: https://mapledevs.ca\n\n#GameDev #Canada #MapleDevs`;

        await postToLinkedIn(postContent);
        fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentJobs, null, 2));
    } catch (e) {
        console.log('⚠️ LinkedIn process skipped.');
    }
}

run();
