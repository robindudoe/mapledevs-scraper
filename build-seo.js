const fs = require('fs');
const path = require('path');
const https = require('https');
const slugify = require('slugify');

const ROOT_DIR = process.cwd();
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const SHEET_ID = '2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY';

const SEO_TARGETS = [
    { folder: 'vancouver', hash: '#city=Vancouver', title: 'Vancouver Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Vancouver, BC. No US roles. Salaries, entry-level, and remote roles included.' },
    { folder: 'toronto', hash: '#city=Toronto', title: 'Toronto Game Dev Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Toronto, ON. No US roles.' },
    { folder: 'montreal', hash: '#city=Montreal', title: 'Montreal Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Montreal, QC. Best opportunities in Canada.' },
    { folder: 'ottawa', hash: '#city=Ottawa', title: 'Ottawa Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Ottawa, ON.' },
    { folder: 'quebec-city', hash: '#city=Quebec+City', title: 'Quebec City Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Quebec City, QC.' },
    { folder: 'edmonton', hash: '#city=Edmonton', title: 'Edmonton Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Edmonton, AB.' },
    { folder: 'calgary', hash: '#city=Calgary', title: 'Calgary Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Calgary, AB.' },
    { folder: 'victoria', hash: '#city=Victoria', title: 'Victoria Game Dev Jobs | BC Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Victoria, BC.' },
    { folder: 'london', hash: '#city=London', title: 'London Ontario Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in London, ON.' },
    { folder: 'halifax', hash: '#city=Halifax', title: 'Halifax Game Dev Jobs | Nova Scotia - MapleDevs', desc: 'Find verified game dev jobs at studios located in Halifax, NS.' },
    { folder: 'kitchener', hash: '#city=Kitchener', title: 'Kitchener Waterloo Game Jobs | Ontario - MapleDevs', desc: 'Find verified game dev jobs at studios located in Kitchener-Waterloo, ON.' },
    { folder: 'burnaby', hash: '#city=Burnaby', title: 'Burnaby BC Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Burnaby, BC.' },
    { folder: 'programming', hash: '#role=programming', title: 'Game Programming & Engineering Jobs Canada - MapleDevs', desc: 'Find C++, Unity, Unreal, and general programming jobs at Canadian game studios.' },
    { folder: 'art', hash: '#role=art', title: 'Game Art & Animation Jobs Canada - MapleDevs', desc: 'Discover 2D, 3D, UI, and VFX artist jobs at verified game studios operating across Canada.' },
    { folder: 'design', hash: '#role=design', title: 'Game Design & Level Design Jobs Canada - MapleDevs', desc: 'Find game design, level design, and narrative design jobs at Canadian studios.' },
    { folder: 'producer', hash: '#role=production', title: 'Game Producer & Production Jobs Canada - MapleDevs', desc: 'Find game producer, project manager, and production jobs at Canadian studios.' },
    { folder: 'qa', hash: '#role=qa', title: 'Game QA & Testing Jobs Canada - MapleDevs', desc: 'Find quality assurance, game testing, and QA lead jobs at Canadian studios.' },
    { folder: 'audio', hash: '#role=audio', title: 'Game Audio & Sound Design Jobs Canada - MapleDevs', desc: 'Find sound design, music, and audio engineering jobs at Canadian game studios.' },
    { folder: 'ui-ux', hash: '#role=design', title: 'Game UI & UX Design Jobs Canada - MapleDevs', desc: 'Find UI/UX design and user research jobs at Canadian game studios.' },
    { folder: 'junior', hash: '#exp=junior', title: 'Junior & Entry-Level Game Dev Jobs Canada - MapleDevs', desc: 'Break into the Canadian games industry. Browse verified entry-level and junior roles.' },
    { folder: 'remote', hash: '#mode=Remote', title: 'Remote Game Dev Jobs Canada | Work From Home - MapleDevs', desc: 'Find 100% remote game developer jobs at studios operating in Canada.' },
    { folder: 'internship', hash: '#type=Internship', title: 'Game Development Internships Canada | Student Jobs - MapleDevs', desc: 'Find game dev internships, co-ops, and student roles at Canadian game studios.' },
    { folder: 'about', hash: '#about', title: 'About MapleDevs | Canada\'s Game Industry Job Board', desc: 'Why we built MapleDevs and how we are helping Canadian game developers find local opportunities.' },
    { folder: 'studios', hash: '#studios', title: 'Top Canadian Game Studios Hiring Now | MapleDevs', desc: 'Browse the directory of Canadian game studios currently hiring. Vancouver, Montreal, Toronto and more.' },
    { folder: 'saved', hash: '#saved', title: 'Your Saved Jobs | MapleDevs', desc: 'Manage your bookmarked game industry opportunities in Canada.' }
];

async function fetchURL(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchURL(res.headers.location));
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
            desc: cl(c[5]||""),
            featured: cl(c[8]||"").toLowerCase() === "yes"
        });
    }
    return jobs;
}

function safeReplaceMeta(html, propertyOrName, newValue, isProperty = true) {
    const attr = isProperty ? 'property' : 'name';
    const regex = new RegExp(`<meta [^>]*${attr}="${propertyOrName}"[^>]*content="[^"]*"[^>]*>`, 'i');
    return html.replace(regex, `<meta ${attr}="${propertyOrName}" content="${newValue}">`);
}

function injectSEO(html, target, targetJobs = []) {
    let output = html;
    
    // 1. Clean up potential artifacts
    output = output.replace(/^[^{]*\{[^{}]*"@context":[^{}]*\}/s, '');
    
    // 2. Head Tags
    output = output.replace(/<title>.*?<\/title>/i, `<title>${target.title}</title>`);
    output = safeReplaceMeta(output, 'description', target.desc, false);
    output = safeReplaceMeta(output, 'og:title', target.title, true);
    output = safeReplaceMeta(output, 'og:description', target.desc, true);
    output = safeReplaceMeta(output, 'og:url', `https://mapledevs.ca/${target.folder}/`, true);
    output = output.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="https://mapledevs.ca/${target.folder}/"`);
    
    // 3. Redirect / Deep Link Hash (for SPA fallback)
    const redirectScript = `\n    <script>if(!window.location.hash) window.location.hash = '${target.hash}';</script>\n`;
    output = output.replace('<head>', '<head>' + redirectScript);
    
    // 4. STATIC INJECTION (The "Fortress" of SEO)
    // We replace the skeleton list with actual HTML for search engines
    if (targetJobs.length > 0) {
        const jobsHtml = targetJobs.map(j => `
            <div class="jc ${j.featured ? 'feat' : ''}" style="margin-bottom:1rem; border:1px solid #eee; padding:1rem; border-radius:8px;">
                <div style="font-weight:700; font-size:1.1rem;">${j.title}</div>
                <div style="color:#666; margin-bottom:0.5rem;">${j.studio}</div>
                <div style="font-size:0.9rem;">${j.location}</div>
                <div style="font-size:0.85rem; margin-top:0.5rem; color:#444;">${j.desc}</div>
            </div>
        `).join('');
        
        const jobListRegex = /<div id="job-list">[\s\S]*?<\/div>/;
        output = output.replace(jobListRegex, `<div id="job-list">${jobsHtml}</div>`);
    }

    return output;
}

async function loadIndexHTML() {
    if (fs.existsSync(INDEX_PATH)) {
        console.log('✅ Found local index.html. Using local design.');
        return fs.readFileSync(INDEX_PATH, 'utf8');
    } else {
        console.log('🌐 Local index.html not found. Fetching latest design from mapledevs.ca...');
        const remoteHTML = await fetchURL('https://mapledevs.ca/index.html');
        if (remoteHTML.toLowerCase().includes('<!doctype')) {
            console.log('✅ Successfully fetched remote design.');
            return remoteHTML;
        } else {
            throw new Error('❌ Failed to fetch valid index.html from website!');
        }
    }
}

async function build() {
    console.log('🚀 Starting Massive SEO Build...');
    const baseHTML_raw = await loadIndexHTML();
    let baseHTML = baseHTML_raw.trim();
    if (baseHTML.startsWith('{')) {
        const docTypeIdx = baseHTML.toLowerCase().indexOf('<!doctype');
        if (docTypeIdx !== -1) baseHTML = baseHTML.substring(docTypeIdx);
    }

    const csvData = await fetchURL(`https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`);
    const jobs = parseCSV(csvData);

    let sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://mapledevs.ca/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;

    for (const target of SEO_TARGETS) {
        const targetDir = path.join(ROOT_DIR, target.folder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);

        // Filter jobs for this hub
        let targetJobs = [];
        const h = target.hash.replace('#','');
        const p = new URLSearchParams(h);
        
        if (p.has('city')) targetJobs = jobs.filter(j => j.location.toLowerCase().includes(p.get('city').toLowerCase()));
        else if (p.has('role')) {
            const ro = p.get('role');
            const r = ro==="programming"?/program|engineer|develop|tech|backend|frontend/i:ro==="art"?/art|animat|vfx|3d|2d|model/i:ro==="design"?/design|level/i:ro==="qa"?/qa|test|quality/i:ro==="production"?/produc|manage/i:ro==="audio"?/audio|sound|music/i:/.*/;
            targetJobs = jobs.filter(j => r.test(j.title));
        }
        else if (p.has('exp')) {
            const ex = p.get('exp');
            const e = ex==="junior"?/junior|jr|entry|associate|student|intern/i:ex==="mid"?/mid|intermediate|(?!senior)(?!lead)(?!junior)(?!entry)/i:ex==="senior"?/senior|sr|principal/i:ex==="lead"?/lead|director|head|vp/i:/.*/;
            targetJobs = jobs.filter(j => e.test(j.title));
        }
        else if (p.has('mode')) targetJobs = jobs.filter(j => j.location.toLowerCase().includes('remote') || j.title.toLowerCase().includes('remote')); // simplified
        else if (p.has('type')) targetJobs = jobs.filter(j => j.title.toLowerCase().includes(p.get('type').toLowerCase()));
        
        const html = injectSEO(baseHTML, target, targetJobs.slice(0, 10)); // Top 10 for SEO
        fs.writeFileSync(path.join(targetDir, 'index.html'), html);
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/${target.folder}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }

    const jobsDir = path.join(ROOT_DIR, 'jobs');
    if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

    for (const job of jobs) {
        const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
        const jobPath = path.join(jobsDir, slug);
        if (!fs.existsSync(jobPath)) fs.mkdirSync(jobPath);
        const target = {
            folder: `jobs/${slug}`,
            hash: `#id=${slug}`,
            title: `${job.title} at ${job.studio} | Canadian Game Jobs - MapleDevs`,
            desc: `Apply for ${job.title} at ${job.studio} in ${job.location}. Verified Canadian game industry opportunity.`
        };
        const html = injectSEO(baseHTML, target, [job]); // Inject the specific job
        fs.writeFileSync(path.join(jobPath, 'index.html'), html);
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/jobs/${slug}/</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
    }

    sitemapXML += `\n</urlset>`;
    fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemapXML);
    console.log('✅ SEO Hubs, Job Pages, and Sitemap complete.');
}

build().catch(err => { console.error('❌ Build failed:', err); process.exit(1); });
