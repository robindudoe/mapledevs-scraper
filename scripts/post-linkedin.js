/**
 * MapleDevs — LinkedIn Automation Engine
 * 
 * Automatically posts a 'New Jobs Roundup' to the founder's LinkedIn profile
 * whenever fresh Canadian game studio roles are detected.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';
const SNAPSHOT_PATH = path.join(__dirname, 'tracked_jobs.json');

// --- CONFIG ---
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
// Check for either Author URN (generic) or Person URN (legacy)
const LINKEDIN_AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_PERSON_URN; 

async function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchCSV(res.headers.location));
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

function parseCSV(t) {
    const ls = t.trim().split("\n");
    const jobs = [];
    const csvLine = (l) => {
        const r=[]; let c="", q=false;
        for(let i=0; i<l.length; i++){
            const ch=l[i]; if(ch==='"') q=!q; else if(ch===',' && !q) { r.push(c); c=""; } else c+=ch;
        }
        r.push(c); return r;
    };
    const cl = (s) => s.replace(/^"|"$/g,"").trim();
    for(let i=1; i<ls.length; i++){
        const c = csvLine(ls[i]);
        if(!c[0] || !c[1]) continue;
        jobs.push({ 
            title: cl(c[0]), 
            studio: cl(c[1]), 
            location: cl(c[2]||""), 
            featured: cl(c[8]||"").toLowerCase() === "yes"
        });
    }
    return jobs;
}

async function postToLinkedIn(message) {
    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_AUTHOR_URN) {
        console.error('❌ Missing LinkedIn credentials (LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN)');
        return;
    }

    console.log('📣 Posting to LinkedIn...');

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const payload = {
        "author": LINKEDIN_AUTHOR_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": message
                },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    };

    if (!LINKEDIN_AUTHOR_URN.startsWith('urn:li:')) {
        console.warn('⚠️ WARNING: LINKEDIN_AUTHOR_URN should start with "urn:li:person:" or "urn:li:organization:". Current value:', LINKEDIN_AUTHOR_URN);
    }

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('✅ LinkedIn post successful:', response.data.id);
    } catch (error) {
        if (error.response) {
            console.error('❌ LinkedIn API Error (Status ' + error.response.status + '):');
            console.error(JSON.stringify(error.response.data, null, 2));
            if (error.response.status === 403) {
                console.error('\n💡 HINT: This usually means your LINKEDIN_AUTHOR_URN is incorrect or doesn\'t match your token owner.');
                console.error('👉 Run "node scripts/verify-linkedin.js" to find your correct URN.');
            }
        } else {
            console.error('❌ Error posting to LinkedIn:', error.message);
        }
    }
}

async function run() {
    console.log('🔍 Checking for new jobs to announce on LinkedIn...');
    
    // 1. Fetch current live jobs
    const csvData = await fetchCSV(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`);
    const currentJobs = parseCSV(csvData);
    
    // 2. Load previous snapshot
    let prevJobs = [];
    if (fs.existsSync(SNAPSHOT_PATH)) {
        prevJobs = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    }
    
    // 3. Find New Jobs
    const prevKeys = new Set(prevJobs.map(j => `${j.title}|${j.studio}`.toLowerCase()));
    let newJobs = currentJobs.filter(j => !prevKeys.has(`${j.title}|${j.studio}`.toLowerCase()));
    
    // Safety Fallback: If snapshot was missing (first run or lost), 
    // only post jobs from the last 24h to avoid spamming the entire board.
    if (prevJobs.length === 0 && newJobs.length > 0) {
        console.log('⚠️ No previous snapshot found. Using 24h fallback logic.');
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        newJobs = newJobs.filter(j => {
            const d = new Date(j.posted || Date.now());
            return d.getTime() > oneDayAgo;
        });
    }

    if (newJobs.length === 0) {
        console.log('✨ No new jobs since last check. Skipping.');
        return;
    }
    
    console.log(`🔥 Found ${newJobs.length} fresh roles! Preparing announcement...`);
    
    // 4. Format the LinkedIn Post (Community Focused)
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today = days[new Date().getDay()];

    let postContent = `Happy ${today}, everyone! 🍁\n\nWe just spotted ${newJobs.length} fresh opportunities for our Canadian game dev community. If you're looking for your next home, these studios are hiring right now:\n\n`;
    
    newJobs.slice(0, 5).forEach(j => {
        postContent += `✨ ${j.title} at ${j.studio} (${j.location})\n`;
    });
    
    if (newJobs.length > 5) {
        postContent += `...and ${newJobs.length - 5} other roles were just added to the board!\n`;
    }
    
    postContent += `\nCheck them all out here: https://mapledevs.ca\n\nLet's help each other grow. If you know someone looking for one of these roles, tag them below! 👇\n\n#GameDev #Canada #Community #Hiring #MapleDevs`;

    
    // 5. Post to LinkedIn
    await postToLinkedIn(postContent);
    
    // 6. Update snapshot so we don't post the same jobs again
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(currentJobs, null, 2));
    console.log('✅ Snapshot updated.');
}

run().catch(console.error);
