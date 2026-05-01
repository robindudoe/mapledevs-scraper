const fs = require('fs');
const path = require('path');
const https = require('https');
const slugify = require('slugify');

const ROOT_DIR = process.cwd();
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const SHEET_DOC_ID = '1L2KcTO32jK5MVY1m3qdqdja7LTZ38f8lYXsK5mNMMDo';
const LIVE_SHEET_NAME = 'jobs_live';
const LIVE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_DOC_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(LIVE_SHEET_NAME)}`;
const KNOWN_DEAD_APPLY_URLS = new Set([
    'https://job-boards.greenhouse.io/2k/jobs/7678028003',
    'https://epicgames.com/careers/jobs/5764691004?gh_jid=5764691004'
]);
const LEGACY_JOB_REDIRECTS = [
    {
        slug: 'senior-software-engineer-developer-relations-easy-anti-cheat-epic-games-montreal-qc',
        title: 'Senior Software Engineer, Developer Relations - Easy Anti-Cheat',
        destination: '/#q=Epic%20Games&city=Montreal%2C%20QC'
    }
];

const SEO_TARGETS = [
    { folder: 'about', hash: '#about', title: 'About MapleDevs | Canada\'s Game Industry Job Board', desc: 'Why we built MapleDevs and how we are helping Canadian game developers find local opportunities.' },
    { folder: 'studios', hash: '#studios', title: 'Top Canadian Game Studios Hiring Now | MapleDevs', desc: 'Browse the directory of Canadian game studios currently hiring. Vancouver, Montreal, Toronto and more.' },
    { folder: 'saved', hash: '#saved', title: 'Your Saved Jobs | MapleDevs', desc: 'Manage your bookmarked game industry opportunities in Canada.' },
    { folder: 'resources', hash: '#resources', title: 'Best Tools & Resources for Game Developers in Canada | MapleDevs', desc: 'Curated tools, courses, and resources to help you improve your skills and get hired in the Canadian game industry.' }
];
const JOBS_INDEX_TARGET = {
    folder: 'jobs',
    hash: '#main-content',
    title: 'Canadian Game Industry Jobs | MapleDevs',
    desc: 'Browse current Canadian game industry jobs from verified studios. Filter by city, role, engine, work mode, salary, visa support, and student-friendly paths.'
};

const NOINDEX_FOLDERS = new Set(['saved']);
const PUBLIC_STATIC_PAGES = [
    { path: 'hire/', changefreq: 'monthly', priority: '0.7' },
    { path: 'talent/', changefreq: 'weekly', priority: '0.7' },
    { path: 'blog/', changefreq: 'weekly', priority: '0.7' },
    { path: 'blog/mapledevs-editorial-launch.html', changefreq: 'monthly', priority: '0.6' },
    { path: 'blog/montreal-silicon-valley-north-game-dev-2026.html', changefreq: 'monthly', priority: '0.6' }
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
    const featuredValue = (s) => /^(yes|true|1|featured|hiring_boost|boost|paid)$/i.test(cl(s).replace(/\s+/g, '_'));
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
        const featured = featuredValue(cell(rw, ['feature', 'Featured', '(Featured)', 'Tier'], 8));
        if(status && !['approved', 'live', 'active'].includes(hkey(status))) continue;
        const linkKey = hkey(linkStatus);
        if (['stale_by_date', 'outdated', 'date_expired'].includes(linkKey)) continue;
        if(['expired', 'dead', 'missing_from_source', 'inactive', 'closed', 'not_found'].includes(linkKey)) continue;
        const title = cell(rw, ['Job Title', 'title'], 0);
        const studio = cell(rw, ['Studio Name', 'studio'], 1);
        const id = cell(rw, ['job_id']);
        const apply = cell(rw, ['How to Apply', 'Apply URL', 'apply', 'source_url'], 6);
        if (KNOWN_DEAD_APPLY_URLS.has(apply)) continue;
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

function boardFilterURL(param, value) {
    return `/#${param}=${encodeURIComponent(value || '')}`;
}

function jobBranchNavHTML(job) {
    const city = job.location || '';
    const studio = job.studio || '';
    return `<nav class="seo-branch-nav" aria-label="Job page links" style="display:flex;flex-wrap:wrap;gap:10px;margin:0 auto 1rem;max-width:1120px;padding:1rem 1.5rem;font-size:14px;">
        <a href="/" style="color:var(--maple);font-weight:700;text-decoration:none;">MapleDevs home</a>
        <span style="color:var(--text-3);">/</span>
        <a href="/jobs/" style="color:var(--maple);font-weight:700;text-decoration:none;">All jobs</a>
        ${city ? `<span style="color:var(--text-3);">/</span><a href="${escapeHTML(boardFilterURL('city', city))}" style="color:var(--maple);font-weight:700;text-decoration:none;">${escapeHTML(city)} jobs</a>` : ''}
        ${studio ? `<span style="color:var(--text-3);">/</span><a href="${escapeHTML(boardFilterURL('q', studio))}" style="color:var(--maple);font-weight:700;text-decoration:none;">${escapeHTML(studio)} jobs</a>` : ''}
    </nav>`;
}

function legacyRedirectHTML(redirect) {
    const destination = redirect.destination || '/';
    const canonicalUrl = destination.startsWith('http')
        ? destination
        : `https://mapledevs.ca${destination}`;
    const title = `${redirect.title} is no longer active | MapleDevs`;
    return `<!doctype html>
<html lang="en-CA">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHTML(title)}</title>
    <meta name="robots" content="noindex, follow">
    <meta name="description" content="This MapleDevs job listing is no longer active. Browse current Canadian game industry roles.">
    <link rel="canonical" href="${escapeHTML(canonicalUrl)}">
    <meta http-equiv="refresh" content="0; url=${escapeHTML(destination)}">
    <script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body>
    <main>
        <h1>This job listing is no longer active</h1>
        <p>Redirecting to current MapleDevs jobs.</p>
        <p><a href="${escapeHTML(destination)}">Browse current jobs</a></p>
    </main>
</body>
</html>`;
}

function listExistingJobSlugs(jobsDir) {
    if (!fs.existsSync(jobsDir)) return new Set();
    return new Set(fs.readdirSync(jobsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && fs.existsSync(path.join(jobsDir, entry.name, 'index.html')))
        .map(entry => entry.name));
}

function writeLegacyJobRedirects(jobsDir, activeSlugs, legacySlugs = new Set()) {
    const redirects = new Map();
    for (const redirect of LEGACY_JOB_REDIRECTS) {
        if (redirect.slug) redirects.set(redirect.slug, redirect);
    }
    for (const slug of legacySlugs) {
        if (!slug || activeSlugs.has(slug) || redirects.has(slug)) continue;
        redirects.set(slug, {
            slug,
            title: 'This job listing',
            destination: '/jobs/'
        });
    }

    for (const redirect of redirects.values()) {
        if (!redirect.slug || activeSlugs.has(redirect.slug)) continue;
        const legacyPath = path.join(jobsDir, redirect.slug);
        if (!fs.existsSync(legacyPath)) fs.mkdirSync(legacyPath, { recursive: true });
        fs.writeFileSync(path.join(legacyPath, 'index.html'), legacyRedirectHTML(redirect));
    }
}

function hasVisa(job) {
    return /yes|sponsor|relocation|relocate|lmia/i.test(job.visa || '');
}

function engineFromText(job) {
    const text = `${job.title || ''} ${job.desc || ''}`.toLowerCase();
    if (/unreal|ue5|ue 5/.test(text)) return 'Unreal';
    if (/unity/.test(text)) return 'Unity';
    if (/godot/.test(text)) return 'Godot';
    if (/c\+\+|proprietary|engine programmer/.test(text)) return 'C++ / Proprietary';
    return '';
}

function signalScore(job) {
    let score = 48;
    if (job.salary) score += 14;
    if (job.engine || engineFromText(job)) score += 10;
    if (job.mode) score += 8;
    if (job.apply) score += 7;
    if (job.desc && job.desc.length > 140) score += 6;
    if (job.student) score += 4;
    if (hasVisa(job)) score += 4;
    if (job.featured) score += 3;
    return Math.min(98, score);
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

function staticSpotlightHTML(job) {
    const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
    return `<div class="sc" onclick="window.location.href='/jobs/${slug}/'">
        <span class="sc-badge">★ Featured</span>
        <div class="sc-title">${escapeHTML(job.title)}</div>
        <div class="sc-studio">${escapeHTML(job.studio)}</div>
        <div class="sc-tags">
            <span class="sc-loc">${escapeHTML(job.location)}</span>
            ${job.mode ? `<span class="sc-loc">${escapeHTML(job.mode)}</span>` : ''}
        </div>
    </div>`;
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
            <div class="jc-side-top"><span class="signal-score"><strong>${signalScore(job)}</strong><span>Signal</span></span><span class="jc-salary">${escapeHTML(job.salary || 'Salary not listed')}</span></div>
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
    output = safeReplaceMeta(output, 'robots', NOINDEX_FOLDERS.has(target.folder) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', false);
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

    if (target.folder.startsWith('jobs/') && targetJobs.length > 0) {
        output = output.replace(
            /<main id="main-content" role="main">/,
            `<main id="main-content" role="main">\n    ${jobBranchNavHTML(targetJobs[0])}`
        );
    }

    // 4. STATIC INJECTION (The "Fortress" of SEO)
    // We replace the skeleton list with actual HTML for search engines
    if (targetJobs.length > 0) {
        const featured = targetJobs.filter(j => j.featured);
        const standard = targetJobs.filter(j => !j.featured);

        if (featured.length > 0) {
            const featuredHtml = featured.map(staticSpotlightHTML).join('');
            output = output.replace(/id="spotlight-s"\s+style="display:none"/i, 'id="spotlight-s" style="display:block"');
            output = output.replace(/id="spotlight-grid">/i, `id="spotlight-grid">${featuredHtml}`);
        }

        const jobsHtml = standard.map(staticJobCardHTML).join('');
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
    for (const page of PUBLIC_STATIC_PAGES) {
        sitemapXML += `\n  <url><loc>https://mapledevs.ca/${page.path}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`;
    }

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
        if (targetJobs.length && !['about', 'studios', 'saved', 'resources'].includes(target.folder)) {
            pageTarget.desc = truncate(`${targetJobs.length} current Canadian game industry role${targetJobs.length === 1 ? '' : 's'} matching this hub. ${target.desc}`, 160);
        }
        const html = injectSEO(baseHTML, pageTarget, targetJobs.slice(0, 10)); // Top 10 for SEO
        fs.writeFileSync(path.join(targetDir, 'index.html'), html);
        if (!NOINDEX_FOLDERS.has(target.folder)) {
            sitemapXML += `\n  <url><loc>https://mapledevs.ca/${target.folder}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
        }
    }

    const jobsDir = path.join(ROOT_DIR, 'jobs');
    const legacyJobSlugs = listExistingJobSlugs(jobsDir);
    fs.rmSync(jobsDir, { recursive: true, force: true });
    if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

    const jobsIndexTarget = {
        ...JOBS_INDEX_TARGET,
        desc: truncate(`${jobs.length} current Canadian game industry role${jobs.length === 1 ? '' : 's'} from verified studios. ${JOBS_INDEX_TARGET.desc}`, 160)
    };
    fs.writeFileSync(path.join(jobsDir, 'index.html'), injectSEO(baseHTML, jobsIndexTarget, jobs));
    sitemapXML += `\n  <url><loc>https://mapledevs.ca/jobs/</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`;

    const activeJobSlugs = new Set();
    for (const job of jobs) {
        const slug = slugify(`${job.title}-${job.studio}-${job.location}`, { lower: true, strict: true });
        activeJobSlugs.add(slug);
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

    writeLegacyJobRedirects(jobsDir, activeJobSlugs, legacyJobSlugs);

    sitemapXML += `\n</urlset>`;
    fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemapXML);
    console.log('✅ SEO Hubs, Job Pages, and Sitemap complete.');
}

build().catch(err => { console.error('❌ Build failed:', err); process.exit(1); });
