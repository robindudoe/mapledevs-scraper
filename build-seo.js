const fs = require('fs');
const path = require('path');
const https = require('https');
const slugify = require('slugify');

const ROOT_DIR = process.cwd();
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const SHEET_DOC_ID = '1L2KcTO32jK5MVY1m3qdqdja7LTZ38f8lYXsK5mNMMDo';
const LIVE_SHEET_NAME = 'jobs_live';
const LIVE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_DOC_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(LIVE_SHEET_NAME)}`;

const SEO_TARGETS = [
    { folder: 'vancouver', hash: '#city=Vancouver', title: 'Vancouver Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Vancouver, BC. No US roles. Salaries, entry-level, and remote roles included.' },
    { folder: 'toronto', hash: '#city=Toronto', title: 'Toronto Game Dev Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Toronto, ON. No US roles.' },
    { folder: 'montreal', hash: '#city=Montreal', title: 'Montreal Game Studio Jobs | Verified & Canadian - MapleDevs', desc: 'Find verified game dev jobs at studios located in Montreal, QC. Best opportunities in Canada.', title_fr: 'Emplois Studios de Jeux Montréal | MapleDevs', desc_fr: 'Trouvez des emplois vérifiés dans les studios de jeux à Montréal, QC. Meilleures opportunités au Canada.' },
    { folder: 'ottawa', hash: '#city=Ottawa', title: 'Ottawa Game Dev Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Ottawa, ON.' },
    { folder: 'quebec-city', hash: '#city=Quebec+City', title: 'Quebec City Game Studio Jobs | Canada - MapleDevs', desc: 'Find verified game dev jobs at studios located in Quebec City, QC.', title_fr: 'Emplois Studios de Jeux Québec | MapleDevs', desc_fr: 'Trouvez des emplois vérifiés dans les studios de jeux à Québec, QC.' },
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
    const rows=[],jobs=[];let r=[],c="",q=false;
    for(let i=0;i<t.length;i++){
        const ch=t[i],nx=t[i+1];
        if(ch==='"'){if(q&&nx==='"'){c+='"';i++;}else{q=!q;}}
        else if(ch===','&&!q){r.push(c);c="";}
        else if(ch==='\n'&&!q){r.push(c);rows.push(r);r=[];c="";}
        else if(ch!=='\r'||q){c+=ch;}
    }
    if(r.length||c){r.push(c);rows.push(r);}

    const cl = (s) => s ? s.trim() : "";
    const hkey = (s) => cl(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const header = (rows[0] || []).map(hkey);
    const cell = (row, names, fallback) => {
        for (const name of names) {
            const index = header.indexOf(hkey(name));
            if (index !== -1) return cl(row[index]);
        }
        return fallback !== undefined ? cl(row[fallback]) : "";
    };

    const seen = new Set();
    for(let i=1;i<rows.length;i++){
        const rw=rows[i];
        const status = cell(rw, ['status']);
        const linkStatus = cell(rw, ['link_status']);
        const featured = cell(rw, ['feature', 'Featured', '(Featured)'], 8).toLowerCase() === "yes";
        if(status && !['approved', 'live', 'active'].includes(hkey(status))) continue;
        if(['expired', 'dead', 'missing_from_source', 'inactive'].includes(hkey(linkStatus)) && !featured) continue;
        const title = cell(rw, ['Job Title', 'title'], 0);
        const studio = cell(rw, ['Studio Name', 'studio'], 1);
        const id = cell(rw, ['job_id']);
        const apply = cell(rw, ['How to Apply', 'Apply URL', 'apply', 'source_url'], 6);
        const location = cell(rw, ['Location'], 2);
        if(!rw||!title||!studio)continue;
        const key = hkey(`${title}|${studio}|${location}`);
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({
            id,
            title,
            studio,
            location,
            type: cell(rw, ['Job Type', 'type'], 3),
            mode: cell(rw, ['Work Mode', 'mode'], 4),
            desc: cell(rw, ['Description', 'desc'], 5),
            apply,
            posted: cell(rw, ['Date Posted', 'posted'], 7),
            student: cell(rw, ['Student Friendly', '(Student Friendly)'], 9).toLowerCase() === "yes",
            salary: cell(rw, ['Salary'], 10),
            engine: cell(rw, ['Engine'], 11),
            visa: cell(rw, ['Visa Sponsorship', 'visa'], 12),
            featured
        });
    }
    return jobs;
}

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripHTML(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value, max = 165) {
    const text = stripHTML(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trim()}...`;
}

function pageURL(folder) {
    return `https://mapledevs.ca/${folder ? `${folder.replace(/^\/|\/$/g, '')}/` : ''}`;
}

function hasVisa(job) {
    return /yes|sponsor|relocation|relocate|lmia/i.test(job.visa || '');
}

function isRemote(job) {
    return /(remote|telecommute)/i.test(`${job.mode || ''} ${job.location || ''}`);
}

function employmentType(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('part')) return 'PART_TIME';
    if (t.includes('contract')) return 'CONTRACTOR';
    if (t.includes('intern')) return 'INTERN';
    if (t.includes('temporary')) return 'TEMPORARY';
    return 'FULL_TIME';
}

function parseLocation(location) {
    const parts = String(location || 'Canada').split(',').map(p => p.trim()).filter(Boolean);
    return {
        locality: parts[0] || 'Canada',
        region: parts[1] || '',
        country: 'CA'
    };
}

function parseSalary(salary) {
    const raw = String(salary || '');
    const matches = raw.match(/\$?\s*\d[\d,]*(?:\.\d+)?\s*[kK]?/g) || [];
    const values = matches.map(match => {
        const hasK = /k/i.test(match);
        const n = Number(match.replace(/[$,\sKk]/g, ''));
        return Number.isFinite(n) ? (hasK ? n * 1000 : n) : null;
    }).filter(v => v && v > 0);
    if (!values.length) return null;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const unitText = /hour|hr/i.test(raw) ? 'HOUR' : 'YEAR';
    const value = values.length > 1
        ? { '@type': 'QuantitativeValue', minValue, maxValue, unitText }
        : { '@type': 'QuantitativeValue', value: minValue, unitText };
    return { '@type': 'MonetaryAmount', currency: 'CAD', value };
}

function breadcrumbSchema(target) {
    const parts = target.folder.split('/').filter(Boolean);
    const items = [{
        '@type': 'ListItem',
        position: 1,
        name: 'MapleDevs',
        item: 'https://mapledevs.ca/'
    }];
    let pathSoFar = '';
    parts.forEach((part, index) => {
        pathSoFar += `${part}/`;
        items.push({
            '@type': 'ListItem',
            position: index + 2,
            name: index === parts.length - 1 ? target.title.replace(/\s+\|.*$/, '') : part.replace(/-/g, ' '),
            item: pageURL(pathSoFar)
        });
    });
    return { '@type': 'BreadcrumbList', itemListElement: items };
}

function organizationSchema() {
    return {
        '@type': 'Organization',
        '@id': 'https://mapledevs.ca/#organization',
        name: 'MapleDevs',
        url: 'https://mapledevs.ca/',
        logo: 'https://mapledevs.ca/og-image.png',
        sameAs: ['https://mapledevs.ca/']
    };
}

function websiteSchema() {
    return {
        '@type': 'WebSite',
        '@id': 'https://mapledevs.ca/#website',
        name: 'MapleDevs',
        url: 'https://mapledevs.ca/',
        publisher: { '@id': 'https://mapledevs.ca/#organization' },
        inLanguage: 'en-CA'
    };
}

function jobPostingSchema(job, url) {
    const loc = parseLocation(job.location);
    const salary = parseSalary(job.salary);
    const schema = {
        '@type': 'JobPosting',
        '@id': `${url}#jobposting`,
        title: job.title,
        description: stripHTML(job.desc || `Opportunity at ${job.studio}`),
        datePosted: validISODate(job.posted) || new Date().toISOString(),
        validThrough: validThroughDate(job.posted),
        employmentType: employmentType(job.type),
        industry: 'Video game development',
        url,
        directApply: false,
        identifier: {
            '@type': 'PropertyValue',
            name: job.studio,
            value: job.id || slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true })
        },
        hiringOrganization: {
            '@type': 'Organization',
            name: job.studio,
            logo: 'https://mapledevs.ca/og-image.png'
        },
        jobLocation: {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressLocality: loc.locality,
                addressRegion: loc.region,
                addressCountry: loc.country
            }
        }
    };
    if (salary) schema.baseSalary = salary;
    if (isRemote(job)) {
        schema.jobLocationType = 'TELECOMMUTE';
        schema.applicantLocationRequirements = { '@type': 'Country', name: 'Canada' };
    }
    if (job.engine) schema.skills = job.engine;
    if (hasVisa(job)) schema.jobBenefits = 'Visa sponsorship or relocation support may be available.';
    return schema;
}

function validISODate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validThroughDate(posted) {
    const date = posted && !Number.isNaN(new Date(posted).getTime()) ? new Date(posted) : new Date();
    date.setDate(date.getDate() + 45);
    return date.toISOString();
}

function collectionSchema(target, jobs) {
    const url = pageURL(target.folder);
    return {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        name: target.title.replace(/\s+\|.*$/, ''),
        description: target.desc,
        url,
        inLanguage: 'en-CA',
        mainEntity: jobs.length ? {
            '@type': 'ItemList',
            itemListElement: jobs.map((job, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: `${job.title} at ${job.studio}`,
                url: pageURL(`jobs/${slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true })}`)
            }))
        } : undefined
    };
}

function buildStructuredData(target, targetJobs) {
    const url = pageURL(target.folder);
    const graph = [organizationSchema(), websiteSchema(), breadcrumbSchema(target)];
    if (target.folder.startsWith('jobs/') && targetJobs.length) {
        graph.push(jobPostingSchema(targetJobs[0], url));
    } else {
        graph.push(collectionSchema(target, targetJobs));
    }
    return `<!-- Structured Data -->\n<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

function staticJobCardHTML(job) {
    const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
    const meta = (label, value, cls = '') => `<div class="meta-item ${cls}"><span class="meta-k">${escapeHTML(label)}</span><span class="meta-v">${escapeHTML(value || 'Not listed')}</span></div>`;
    const pills = [
        job.type ? `<span class="pill p-type">${escapeHTML(job.type)}</span>` : '',
        job.engine ? `<span class="pill p-engine">${escapeHTML(job.engine)}</span>` : '',
        hasVisa(job) ? '<span class="pill p-visa">Visa support</span>' : '',
        job.student ? '<span class="pill p-stu">Student-friendly</span>' : ''
    ].filter(Boolean).join('');
    const featuredBadge = job.featured ? '<div class="jc-badges"><span class="b-feat">Featured</span></div>' : '';
    const descHtml = job.desc ? `<p class="jc-desc">${escapeHTML(truncate(job.desc, 220))}</p>` : '';
    return `<article class="jc ${job.featured ? 'feat' : ''}" style="margin-bottom:1rem;">
        <div class="jc-main">
            <div class="jc-top">
                <div class="jc-title-grp">${featuredBadge}<h2 class="jc-title" style="margin:0;"><a href="/jobs/${slug}/" style="color:inherit;text-decoration:none;">${escapeHTML(job.title)}</a></h2></div>
            </div>
            <div class="jc-studio">${escapeHTML(job.studio)}</div>
            <div class="jc-meta">${meta('Location', job.location || 'Canada')}${meta('Work mode', job.mode || 'Not listed')}${meta('Salary', job.salary || 'Not listed', 'salary')}</div>
            <div class="jc-pills">${pills}</div>${descHtml}
        </div>
        <aside class="jc-side">
            <div class="jc-side-top"><span class="jc-salary">${escapeHTML(job.salary || 'Salary not listed')}</span></div>
            <div class="jc-foot-main"><span class="jc-verified">Verified listing</span>${job.posted ? `<span class="jc-date">Posted ${escapeHTML(job.posted)}</span>` : ''}</div>
            <div class="jc-cta-row"><a class="btn-s" href="/jobs/${slug}/">Details</a></div>
        </aside>
    </article>`;
}

function safeReplaceMeta(html, propertyOrName, newValue, isProperty = true) {
    const attr = isProperty ? 'property' : 'name';
    const regex = new RegExp(`<meta [^>]*${attr}="${propertyOrName}"[^>]*content="[^"]*"[^>]*>`, 'i');
    const tag = `<meta ${attr}="${propertyOrName}" content="${escapeHTML(newValue)}">`;
    return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `    ${tag}\n</head>`);
}

function injectSEO(html, target, targetJobs = []) {
    let output = html;
    const canonicalUrl = pageURL(target.folder);

    // 1. Clean up potential artifacts
    output = output.replace(/^[^{]*\{[^{}]*"@context":[^{}]*\}/s, '');

    // 2. Head Tags
    output = output.replace(/<title>.*?<\/title>/i, `<title>${target.title}</title>`);
    output = safeReplaceMeta(output, 'description', target.desc, false);
    output = safeReplaceMeta(output, 'og:title', target.title, true);
    output = safeReplaceMeta(output, 'og:description', target.desc, true);
    output = safeReplaceMeta(output, 'og:url', canonicalUrl, true);
    output = safeReplaceMeta(output, 'twitter:title', target.title, false);
    output = safeReplaceMeta(output, 'twitter:description', target.desc, false);
    output = output.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);
    output = output.replace(/<link rel="alternate" hreflang="en-CA" href="[^"]*"/i, `<link rel="alternate" hreflang="en-CA" href="${canonicalUrl}"`);
    output = output.replace(/<link rel="alternate" hreflang="x-default" href="[^"]*"/i, `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}"`);

    const structuredRegex = /<!-- Structured Data -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
    const structuredData = buildStructuredData(target, targetJobs);
    output = structuredRegex.test(output)
        ? output.replace(structuredRegex, structuredData)
        : output.replace('</head>', `${structuredData}\n</head>`);

    // 3. Redirect / Deep Link Hash (for SPA fallback)
    const redirectScript = `\n    <script>if(!window.location.hash) window.location.hash = ${JSON.stringify(target.hash)};</script>\n`;
    output = output.replace('<head>', '<head>' + redirectScript);

    // 4. STATIC INJECTION (The "Fortress" of SEO)
    // We replace the skeleton list with actual HTML for search engines
    if (targetJobs.length > 0) {
        const jobsHtml = targetJobs.map(staticJobCardHTML).join('');
        const jobListRegex = /<div id="job-list">[\s\S]*?<\/div>\s*<\/main>/;
        output = output.replace(jobListRegex, `<div id="job-list" class="job-list">${jobsHtml}</div>\n  </main>`);
    }

    // Hub Context Injection
    const HUB_CONTEXTS = {
        'montreal': { t: 'Montreal Gamedev Insights', p: 'Montreal studios benefit from the MDEC tax credit (up to 37.5%). Discover AAA and indie roles here.' },
        'quebec-city': { t: 'Quebec City Gamedev', p: 'A thriving hub with MDEC incentives. Home to giants like Ubisoft and Beenox.' },
        'vancouver': { t: 'Vancouver Studio Guide', p: 'Canada\'s original hub featuring the IDMTC tax credit. Ideal for AAA and Indie talent.' },
        'toronto': { t: 'Toronto & GTA Scenes', p: 'Massive indie ecosystem and growing AAA presence supported by OIDMTC incentives.' }
    };

    if (HUB_CONTEXTS[target.folder]) {
        const ctx = HUB_CONTEXTS[target.folder];
        const ctxHtml = `<div class="hub-highlights" style="display:block; margin-bottom:1rem; border-left:4px solid #C8372D; padding:1rem; background:#f9f9f9;">
            <h3 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:#C8372D;">${ctx.t}</h3>
            <p style="margin:0; font-size:0.9rem; line-height:1.4;">${ctx.p}</p>
        </div>`;
        const hubDivRegex = /<div id="hub-highlights" class="hub-highlights"><\/div>/;
        output = output.replace(hubDivRegex, ctxHtml);
    }

    if (target.title_fr) {
        output = output.replace('</h1>', `</h1><h2 style="font-size:1.2rem; color:#666; margin-top:-0.5rem;">${target.title_fr}</h2>`);
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

    let csvData;
    try {
        csvData = await fetchURL(LIVE_CSV_URL);
    } catch (err) {
        console.warn('Could not fetch jobs_live from Google Sheets. Falling back to local live.csv.');
        csvData = fs.readFileSync(path.join(ROOT_DIR, 'live.csv'), 'utf8');
    }
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
            const r = ro==="programming"?/program|engineer|develop|tech|backend|frontend|c\+\+/i:ro==="art"?/art|animat|vfx|3d|2d|model/i:ro==="design"?/design|level|ux|ui|narrative/i:ro==="qa"?/qa|test|quality/i:ro==="production"?/produc|manage|coordinat/i:ro==="audio"?/audio|sound|music/i:/.*/;
            targetJobs = jobs.filter(j => r.test(`${j.title} ${j.desc}`));
        }
        else if (p.has('exp')) {
            const ex = p.get('exp');
            const e = ex==="junior"?/junior|jr|entry|associate|student|intern/i:ex==="mid"?/mid|intermediate|(?!senior)(?!lead)(?!junior)(?!entry)/i:ex==="senior"?/senior|sr|principal/i:ex==="lead"?/lead|director|head|vp/i:/.*/;
            targetJobs = jobs.filter(j => e.test(j.title) || (ex === "junior" && j.student));
        }
        else if (p.has('mode')) targetJobs = jobs.filter(j => isRemote(j) || (j.mode || '').toLowerCase().includes(p.get('mode').toLowerCase()));
        else if (p.has('type')) targetJobs = jobs.filter(j => (j.type || '').toLowerCase().includes(p.get('type').toLowerCase()) || j.title.toLowerCase().includes(p.get('type').toLowerCase()));

        const pageTarget = { ...target };
        if (targetJobs.length && !['about', 'studios', 'saved'].includes(target.folder)) {
            pageTarget.desc = truncate(`${targetJobs.length} current Canadian game industry role${targetJobs.length === 1 ? '' : 's'} matching this hub. ${target.desc}`, 160);
        }
        const html = injectSEO(baseHTML, pageTarget, targetJobs.slice(0, 10)); // Top 10 for SEO
        fs.writeFileSync(path.join(targetDir, 'index.html'), html);
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/${target.folder}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }

    const jobsDir = path.join(ROOT_DIR, 'jobs');
    fs.rmSync(jobsDir, { recursive: true, force: true });
    if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

    for (const job of jobs) {
        const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
        const jobPath = path.join(jobsDir, slug);
        if (!fs.existsSync(jobPath)) fs.mkdirSync(jobPath);
        const jobFacts = [job.location, job.mode, job.salary, job.engine].filter(Boolean).join(' | ');
        const target = {
            folder: `jobs/${slug}`,
            hash: `#id=${slug}`,
            title: `${job.title} at ${job.studio} | Canadian Game Jobs - MapleDevs`,
            desc: truncate(`Apply for ${job.title} at ${job.studio}${jobFacts ? ` (${jobFacts})` : ''}. Verified Canadian game industry opportunity.`, 160)
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
