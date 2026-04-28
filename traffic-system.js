const fs = require('fs');
const path = require('path');
const https = require('https');
const slugify = require('slugify');

const ROOT_DIR = process.cwd();
const SITE_URL = 'https://mapledevs.ca';
const SITE_HOST = 'mapledevs.ca';
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const LIVE_CSV_PATH = path.join(ROOT_DIR, 'live.csv');
const TRAFFIC_DIR = path.join(ROOT_DIR, 'traffic');
const SHEET_DOC_ID = '1L2KcTO32jK5MVY1m3qdqdja7LTZ38f8lYXsK5mNMMDo';
const LIVE_SHEET_NAME = 'jobs_live';
const LIVE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_DOC_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(LIVE_SHEET_NAME)}`;
const INDEXNOW_KEY = 'mapledevs-indexnow-20260428';
const INDEXNOW_KEY_FILE = `${INDEXNOW_KEY}.txt`;
const FORCE_LOCAL = process.argv.includes('--local-only');

const KNOWN_DEAD_APPLY_URLS = new Set([
  'https://job-boards.greenhouse.io/2k/jobs/7678028003'
]);

const STATIC_PUBLIC_PAGES = [
  { path: 'blog/', changefreq: 'weekly', priority: '0.7' },
  { path: 'blog/mapledevs-editorial-launch.html', changefreq: 'monthly', priority: '0.6' },
  { path: 'blog/montreal-silicon-valley-north-game-dev-2026.html', changefreq: 'monthly', priority: '0.6' },
  { path: 'blog/canadian-gaming-industry-news-opportunities.html', changefreq: 'monthly', priority: '0.6' },
  { path: 'blog/canadian-gaming-thrives-industry-jobs-roundup.html', changefreq: 'monthly', priority: '0.6' },
  { path: 'contact/', changefreq: 'monthly', priority: '0.5' },
  { path: 'hire/', changefreq: 'monthly', priority: '0.6' },
  { path: 'talent/', changefreq: 'weekly', priority: '0.7' }
];

const NOINDEX_FOLDERS = new Set(['saved', 'admin', 'account']);

const CORE_LINKS = [
  { href: '/canadian-game-dev-jobs/', label: 'All Canadian game jobs' },
  { href: '/remote-game-dev-jobs-canada/', label: 'Remote jobs' },
  { href: '/entry-level-game-dev-jobs-canada/', label: 'Entry-level jobs' },
  { href: '/game-programming-jobs-canada/', label: 'Programming jobs' },
  { href: '/game-artist-jobs-canada/', label: 'Artist jobs' },
  { href: '/video-game-studios-hiring-canada/', label: 'Studios hiring' },
  { href: '/rss.xml', label: 'RSS feed' }
];

const SEO_TARGETS = [
  {
    folder: 'canadian-game-dev-jobs',
    hash: '',
    title: 'Canadian Game Dev Jobs | MapleDevs',
    desc: 'Browse current game developer jobs from studios hiring in Canada. Filter by role, city, engine, work mode, salary, and experience level.',
    h1: 'Canadian game dev jobs',
    intro: 'Browse approved roles from game studios hiring in Canada. MapleDevs keeps the focus on practical candidate signals: studio name, location, work mode, salary when available, engine, and student-friendly status.',
    filter: () => true,
    priority: '0.95'
  },
  {
    folder: 'remote-game-dev-jobs-canada',
    hash: '#mode=Remote',
    title: 'Remote Game Dev Jobs Canada | MapleDevs',
    desc: 'Find remote game development jobs from studios hiring in Canada. Browse programming, art, design, production, QA, and technical roles.',
    h1: 'Remote game dev jobs in Canada',
    intro: 'This page collects roles marked remote from the existing MapleDevs job data. Some studios may still require Canadian work eligibility, provincial availability, or time-zone overlap, so always confirm details on the application page.',
    filter: isRemote,
    priority: '0.9'
  },
  {
    folder: 'entry-level-game-dev-jobs-canada',
    hash: '#exp=junior',
    title: 'Entry Level Game Dev Jobs Canada | MapleDevs',
    desc: 'Browse entry-level, junior, student-friendly, internship, and co-op game development jobs from studios hiring in Canada.',
    h1: 'Entry-level game dev jobs in Canada',
    intro: 'Use this page to find junior, associate, internship, co-op, and student-friendly game industry roles in Canada. Listings come from the same approved data source as the main MapleDevs board.',
    filter: isEntryLevel,
    priority: '0.9'
  },
  {
    folder: 'game-design-jobs-canada',
    hash: '#role=design',
    title: 'Game Design Jobs Canada | MapleDevs',
    desc: 'Find game design, level design, systems design, narrative design, UI, and UX roles from Canadian game studios.',
    h1: 'Game design jobs in Canada',
    intro: 'Browse Canadian game design roles across level design, systems design, narrative, technical design, UI, and UX. Each listing links back to the full job page and application source.',
    filter: (job) => roleBucket(job) === 'design',
    priority: '0.85'
  },
  {
    folder: 'unity-developer-jobs-canada',
    hash: '#engine=Unity',
    title: 'Unity Developer Jobs Canada | MapleDevs',
    desc: 'Browse Unity developer and Unity-focused game jobs from studios hiring in Canada.',
    h1: 'Unity developer jobs in Canada',
    intro: 'This page highlights roles where Unity appears in the listing title, engine field, or description. It is generated from existing MapleDevs job data, so no jobs are invented for SEO coverage.',
    filter: (job) => engineBucket(job) === 'unity',
    priority: '0.82'
  },
  {
    folder: 'unreal-engine-jobs-canada',
    hash: '#engine=Unreal',
    title: 'Unreal Engine Jobs Canada | MapleDevs',
    desc: 'Browse Unreal Engine, UE5, C++, gameplay, tools, and technical roles from Canadian game studios.',
    h1: 'Unreal Engine jobs in Canada',
    intro: 'Find Canadian game jobs where Unreal Engine, UE5, or closely related engine work appears in the listing. Use the links below to compare adjacent programming, design, and studio pages.',
    filter: (job) => engineBucket(job) === 'unreal',
    priority: '0.82'
  },
  {
    folder: 'game-artist-jobs-canada',
    hash: '#role=art',
    title: 'Game Artist Jobs Canada | MapleDevs',
    desc: 'Find 2D, 3D, environment, character, animation, VFX, lighting, and technical art jobs from Canadian game studios.',
    h1: 'Game artist jobs in Canada',
    intro: 'Browse Canadian game art roles across 2D, 3D, VFX, animation, technical art, lighting, props, characters, and environments. Every job shown here comes from the live MapleDevs listings data.',
    filter: (job) => roleBucket(job) === 'art',
    priority: '0.85'
  },
  {
    folder: 'game-programming-jobs-canada',
    hash: '#role=programming',
    title: 'Game Programming Jobs Canada | MapleDevs',
    desc: 'Find gameplay, engine, tools, backend, online, AI, UI, and technical programming jobs from Canadian game studios.',
    h1: 'Game programming jobs in Canada',
    intro: 'Browse programming and engineering roles at game studios hiring in Canada. This page includes gameplay, engine, tools, AI, online services, backend, UI, and technical roles when they appear in the approved job data.',
    filter: (job) => roleBucket(job) === 'programming',
    priority: '0.88'
  },
  {
    folder: 'video-game-studios-hiring-canada',
    hash: '#studios',
    title: 'Video Game Studios Hiring in Canada | MapleDevs',
    desc: 'Browse Canadian video game studios with open jobs on MapleDevs and jump into their current listings.',
    h1: 'Video game studios hiring in Canada',
    intro: 'This page groups current MapleDevs listings by studio so candidates can see who is actively hiring in Canada. Studio counts are generated from approved open roles only.',
    filter: () => true,
    pageKind: 'studios',
    priority: '0.9'
  }
];

const WEEKLY_TARGETS = [
  {
    folder: 'new-canadian-game-dev-jobs-this-week',
    hash: '',
    title: 'New Canadian Game Dev Jobs This Week | MapleDevs',
    desc: 'A weekly generated page for newly posted Canadian game development jobs on MapleDevs.',
    h1: 'New Canadian game dev jobs this week',
    intro: 'This page updates from the MapleDevs jobs data and shows roles posted in the last seven days when available. If the week is quiet, use the links below to browse all current Canadian game jobs.',
    filter: (job) => isFresh(job, 7),
    priority: '0.78',
    weekly: true
  },
  {
    folder: 'remote-canadian-game-jobs-this-week',
    hash: '#mode=Remote',
    title: 'Remote Canadian Game Jobs This Week | MapleDevs',
    desc: 'Weekly generated remote game jobs from studios hiring in Canada.',
    h1: 'Remote Canadian game jobs this week',
    intro: 'Fresh remote roles appear here when the approved MapleDevs data includes remote jobs posted within the last seven days. Confirm remote eligibility details on the studio application page before applying.',
    filter: (job) => isFresh(job, 7) && isRemote(job),
    priority: '0.75',
    weekly: true
  },
  {
    folder: 'entry-level-canadian-game-jobs-this-week',
    hash: '#exp=junior',
    title: 'Entry-Level Canadian Game Jobs This Week | MapleDevs',
    desc: 'Weekly generated entry-level, junior, internship, and student-friendly Canadian game jobs.',
    h1: 'Entry-level Canadian game jobs this week',
    intro: 'This weekly page highlights fresh entry-level, junior, internship, co-op, and student-friendly roles from the current MapleDevs job data.',
    filter: (job) => isFresh(job, 7) && isEntryLevel(job),
    priority: '0.75',
    weekly: true
  }
];

const CONTINUITY_TARGETS = [
  { folder: 'programming', hash: '#role=programming', title: 'Game Programming Jobs Canada | MapleDevs', desc: 'Browse programming and engineering roles at Canadian game studios.', h1: 'Game programming jobs in Canada', intro: 'Programming, engineering, tools, AI, online services, engine, and technical roles from the MapleDevs job data.', filter: (job) => roleBucket(job) === 'programming', priority: '0.75' },
  { folder: 'art', hash: '#role=art', title: 'Game Art and Animation Jobs Canada | MapleDevs', desc: 'Browse art, animation, VFX, lighting, and technical art jobs at Canadian game studios.', h1: 'Game art and animation jobs in Canada', intro: 'Art, animation, VFX, technical art, lighting, prop, character, and environment roles from MapleDevs.', filter: (job) => roleBucket(job) === 'art', priority: '0.75' },
  { folder: 'design', hash: '#role=design', title: 'Game Design and Level Design Jobs Canada | MapleDevs', desc: 'Browse design, level design, systems design, narrative, UI, and UX jobs at Canadian game studios.', h1: 'Game design jobs in Canada', intro: 'Design, level design, systems, narrative, UI, UX, and technical design roles from MapleDevs.', filter: (job) => roleBucket(job) === 'design', priority: '0.75' },
  { folder: 'junior', hash: '#exp=junior', title: 'Junior Game Dev Jobs Canada | MapleDevs', desc: 'Browse junior, entry-level, internship, and student-friendly Canadian game jobs.', h1: 'Junior game dev jobs in Canada', intro: 'A compatibility page for junior and entry-level Canadian game jobs, generated from current MapleDevs listings.', filter: isEntryLevel, priority: '0.72' },
  { folder: 'remote', hash: '#mode=Remote', title: 'Remote Game Developer Jobs Canada | MapleDevs', desc: 'Browse remote game developer jobs from studios hiring in Canada.', h1: 'Remote game developer jobs in Canada', intro: 'A compatibility page for remote Canadian game jobs, generated from current MapleDevs listings.', filter: isRemote, priority: '0.72' },
  { folder: 'internship', hash: '#type=Internship', title: 'Game Development Internships Canada | MapleDevs', desc: 'Browse internships, co-ops, and student-friendly game development roles in Canada.', h1: 'Game development internships in Canada', intro: 'Internship, co-op, and student-friendly jobs from the approved MapleDevs data.', filter: (job) => /intern|co-op|coop|student/i.test(`${job.title} ${job.type} ${job.desc}`) || job.student, priority: '0.7' },
  { folder: 'studios', hash: '#studios', title: 'Canadian Game Studios Hiring Now | MapleDevs', desc: 'Browse Canadian game studios currently represented in open MapleDevs listings.', h1: 'Canadian game studios hiring now', intro: 'Studios shown here have at least one current role in the MapleDevs listings data.', filter: () => true, pageKind: 'studios', priority: '0.78' },
  { folder: 'about', hash: '#about', title: 'About MapleDevs | Canadian Game Industry Jobs', desc: 'Learn how MapleDevs helps candidates find verified jobs at studios hiring in Canada.', h1: 'About MapleDevs', intro: 'MapleDevs is built to make Canadian game industry job hunting clearer, faster, and less noisy.', filter: () => true, priority: '0.55' },
  { folder: 'resources', hash: '#resources', title: 'Game Developer Resources Canada | MapleDevs', desc: 'Curated resources for game developers looking for work in Canada.', h1: 'Game developer resources in Canada', intro: 'A curated resource page for candidates improving portfolios, resumes, interviews, and technical skills.', filter: () => true, priority: '0.55' }
];

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchURL(res.headers.location));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function cl(value) {
  return value ? String(value).trim() : '';
}

function hkey(value) {
  return cl(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseCSV(text) {
  const rows = [];
  const jobs = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r' || quoted) {
      cell += ch;
    }
  }
  if (row.length || cell) {
    row.push(cell);
    rows.push(row);
  }

  const header = (rows[0] || []).map(hkey);
  const get = (rw, names, fallback) => {
    for (const name of names) {
      const index = header.indexOf(hkey(name));
      if (index !== -1) return cl(rw[index]);
    }
    return fallback !== undefined ? cl(rw[fallback]) : '';
  };

  const seen = new Set();
  for (let i = 1; i < rows.length; i += 1) {
    const rw = rows[i];
    const status = get(rw, ['status']);
    const linkStatus = hkey(get(rw, ['link_status']));
    const title = get(rw, ['Job Title', 'title'], 0);
    const studio = get(rw, ['Studio Name', 'studio'], 1);
    const location = get(rw, ['Location'], 2);
    const apply = get(rw, ['How to Apply', 'Apply URL', 'apply', 'source_url'], 6);

    if (status && !['approved', 'live', 'active'].includes(hkey(status))) continue;
    if (['stale_by_date', 'outdated', 'date_expired', 'expired', 'dead', 'missing_from_source', 'inactive', 'closed', 'not_found'].includes(linkStatus)) continue;
    if (KNOWN_DEAD_APPLY_URLS.has(apply)) continue;
    if (!title || !studio) continue;

    const key = hkey(`${title}|${studio}|${location}`);
    if (seen.has(key)) continue;
    seen.add(key);

    jobs.push({
      id: get(rw, ['job_id']),
      title,
      studio,
      location,
      type: get(rw, ['Job Type', 'type'], 3),
      mode: get(rw, ['Work Mode', 'mode'], 4),
      desc: get(rw, ['Description', 'desc'], 5),
      apply,
      posted: get(rw, ['Date Posted', 'posted'], 7),
      featured: get(rw, ['feature', 'Featured', '(Featured)'], 8).toLowerCase() === 'yes',
      student: get(rw, ['Student Friendly', '(Student Friendly)'], 9).toLowerCase() === 'yes',
      salary: get(rw, ['Salary'], 10),
      engine: get(rw, ['Engine'], 11),
      visa: get(rw, ['Visa Sponsorship', 'visa'], 12),
      validThrough: get(rw, ['Valid Through', 'validThrough', 'expires', 'closing date'])
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

function escapeXML(value) {
  return escapeHTML(value).replace(/'/g, '&apos;');
}

function stripHTML(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value, max = 160) {
  const text = stripHTML(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function pageURL(folder = '') {
  const clean = folder.replace(/^\/|\/$/g, '');
  return clean ? `${SITE_URL}/${clean}/` : `${SITE_URL}/`;
}

function localHref(folder = '') {
  const clean = folder.replace(/^\/|\/$/g, '');
  return clean ? `/${clean}/` : '/';
}

function jobSlug(job) {
  return slugify(`${job.title}-${job.studio}-${job.location || 'Canada'}`, { lower: true, strict: true }) || 'job';
}

function jobFolder(job) {
  return `jobs/${jobSlug(job)}`;
}

function jobURL(job) {
  return pageURL(jobFolder(job));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function isFresh(job, days = 7) {
  const date = parseDate(job.posted);
  if (!date) return false;
  return (Date.now() - date.getTime()) / 864e5 <= days;
}

function isRemote(job) {
  const text = `${job.mode || ''} ${job.location || ''}`.toLowerCase();
  return /\bremote\b|telecommute|work from home/.test(text);
}

function isFullyRemote(job) {
  const mode = (job.mode || '').toLowerCase();
  return /\bremote\b|telecommute|work from home/.test(mode) && !/hybrid|optional|occasional/.test(mode);
}

function isEntryLevel(job) {
  return job.student || /junior|jr\.?|entry|associate|intern|internship|co-op|coop|student|graduate|new grad/i.test(`${job.title} ${job.type} ${job.desc}`);
}

function hasVisa(job) {
  return /yes|sponsor|relocation|relocate|lmia/i.test(job.visa || '');
}

function engineBucket(job) {
  const text = `${job.engine || ''} ${job.title || ''} ${job.desc || ''}`.toLowerCase();
  if (/unreal|ue5|ue 5/.test(text)) return 'unreal';
  if (/unity/.test(text)) return 'unity';
  if (/godot/.test(text)) return 'godot';
  if (/c\+\+|proprietary|engine programmer/.test(text)) return 'c++ / proprietary';
  return '';
}

function roleBucket(job) {
  const text = `${job.title || ''} ${job.type || ''} ${job.desc || ''}`.toLowerCase();
  if (/audio|sound|music/.test(text)) return 'audio';
  if (/qa|quality assurance|tester|test/.test(text)) return 'qa';
  if (/producer|production|project manager|coordinator|scrum|program manager/.test(text)) return 'production';
  if (/design|designer|level|narrative|quest|ux|ui/.test(text)) return 'design';
  if (/artist|art|animat|vfx|3d|2d|model|rigger|lighting|lighter|prop|environment|character/.test(text)) return 'art';
  if (/program|engineer|developer|backend|frontend|tools|engine|online|ai|machine learning|technical/.test(text)) return 'programming';
  return 'other';
}

function cityName(location) {
  return (location || 'Canada').split(',')[0].trim() || 'Canada';
}

function locationSlug(location) {
  return slugify(location || 'canada', { lower: true, strict: true }) || 'canada';
}

function signalScore(job) {
  let score = 48;
  if (job.salary) score += 14;
  if (job.engine || engineBucket(job)) score += 10;
  if (job.mode) score += 8;
  if (job.apply) score += 7;
  if (job.desc && job.desc.length > 140) score += 6;
  if (job.student) score += 4;
  if (hasVisa(job)) score += 4;
  if (isFresh(job, 4)) score += 5;
  if (job.featured) score += 3;
  return Math.min(98, score);
}

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const featured = Number(b.featured) - Number(a.featured);
    if (featured) return featured;
    const date = (parseDate(b.posted)?.getTime() || 0) - (parseDate(a.posted)?.getTime() || 0);
    if (date) return date;
    return signalScore(b) - signalScore(a);
  });
}

function sortByPosted(jobs) {
  return [...jobs].sort((a, b) => {
    const date = (parseDate(b.posted)?.getTime() || 0) - (parseDate(a.posted)?.getTime() || 0);
    if (date) return date;
    return `${a.title} ${a.studio}`.localeCompare(`${b.title} ${b.studio}`);
  });
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
  const parts = String(location || 'Canada').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    locality: parts[0] || 'Canada',
    region: parts[1] || '',
    country: 'CA'
  };
}

function parseSalary(salary) {
  const raw = String(salary || '');
  const matches = raw.match(/\$?\s*\d[\d,]*(?:\.\d+)?\s*[kK]?/g) || [];
  const values = matches.map((match) => {
    const hasK = /k/i.test(match);
    const n = Number(match.replace(/[$,\sKk]/g, ''));
    return Number.isFinite(n) ? (hasK ? n * 1000 : n) : null;
  }).filter((value) => value && value > 0);
  if (!values.length) return null;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const unitText = /hour|hr/i.test(raw) ? 'HOUR' : 'YEAR';
  const value = values.length > 1
    ? { '@type': 'QuantitativeValue', minValue, maxValue, unitText }
    : { '@type': 'QuantitativeValue', value: minValue, unitText };
  return { '@type': 'MonetaryAmount', currency: 'CAD', value };
}

function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'MapleDevs',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/og-image.png`,
    sameAs: [`${SITE_URL}/`]
  };
}

function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'MapleDevs',
    url: `${SITE_URL}/`,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-CA'
  };
}

function breadcrumbSchema(target) {
  const parts = target.folder.split('/').filter(Boolean);
  const items = [{
    '@type': 'ListItem',
    position: 1,
    name: 'MapleDevs',
    item: `${SITE_URL}/`
  }];
  let pathSoFar = '';
  parts.forEach((part, index) => {
    pathSoFar += `${part}/`;
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: index === parts.length - 1 ? (target.h1 || target.title).replace(/\s+\|.*$/, '') : part.replace(/-/g, ' '),
      item: pageURL(pathSoFar)
    });
  });
  return { '@type': 'BreadcrumbList', itemListElement: items };
}

function collectionSchema(target, jobs) {
  const itemListElement = jobs.slice(0, 20).map((job, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `${job.title} at ${job.studio}`,
    url: jobURL(job)
  }));
  return {
    '@type': 'CollectionPage',
    '@id': `${pageURL(target.folder)}#webpage`,
    name: target.h1 || target.title.replace(/\s+\|.*$/, ''),
    description: target.desc,
    url: pageURL(target.folder),
    inLanguage: 'en-CA',
    mainEntity: itemListElement.length ? { '@type': 'ItemList', itemListElement } : undefined
  };
}

function canBuildJobPosting(job) {
  return Boolean(job.title && job.studio && job.desc && isoDate(job.posted));
}

function jobPostingSchema(job, url) {
  const loc = parseLocation(job.location);
  const salary = parseSalary(job.salary);
  const schema = {
    '@type': 'JobPosting',
    '@id': `${url}#jobposting`,
    title: job.title,
    description: stripHTML(job.desc),
    datePosted: isoDate(job.posted),
    employmentType: employmentType(job.type),
    industry: 'Video game development',
    url,
    directApply: false,
    identifier: {
      '@type': 'PropertyValue',
      name: job.studio,
      value: job.id || jobSlug(job)
    },
    hiringOrganization: {
      '@type': 'Organization',
      name: job.studio,
      logo: `${SITE_URL}/og-image.png`
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
  const validThrough = isoDate(job.validThrough);
  if (validThrough) schema.validThrough = validThrough;
  if (salary) schema.baseSalary = salary;
  if (isFullyRemote(job)) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = { '@type': 'Country', name: 'Canada' };
  }
  const engine = job.engine || engineBucket(job);
  if (engine) schema.skills = engine;
  if (hasVisa(job)) schema.jobBenefits = 'Visa sponsorship or relocation support may be available according to the listing.';
  return schema;
}

function buildStructuredData(target, jobs) {
  const graph = [organizationSchema(), websiteSchema(), breadcrumbSchema(target)];
  if (target.pageKind === 'job' && jobs.length && canBuildJobPosting(jobs[0])) {
    graph.push(jobPostingSchema(jobs[0], pageURL(target.folder)));
  } else {
    graph.push(collectionSchema(target, jobs));
  }
  return `<!-- Structured Data -->\n<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

function safeReplaceMeta(html, propertyOrName, newValue, isProperty = true) {
  const attr = isProperty ? 'property' : 'name';
  const regex = new RegExp(`<meta [^>]*${attr}="${propertyOrName}"[^>]*content="[^"]*"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${propertyOrName}" content="${escapeHTML(newValue)}">`;
  return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `    ${tag}\n</head>`);
}

function ensureRSSLink(html) {
  if (/type="application\/rss\+xml"/i.test(html)) return html;
  return html.replace('</head>', `    <link rel="alternate" type="application/rss+xml" title="MapleDevs Latest Jobs" href="${SITE_URL}/rss.xml">\n</head>`);
}

function redirectScript(target) {
  if (!target.hash) return '';
  return `\n    <script>if(!window.location.hash) window.location.hash = ${JSON.stringify(target.hash)};</script>\n`;
}

function staticMeta(job) {
  const items = [
    ['Studio', job.studio],
    ['Location', job.location || 'Canada'],
    ['Work mode', job.mode || 'Not listed'],
    ['Type', job.type || 'Not listed'],
    ['Posted', isoDate(job.posted) || job.posted || 'Not listed'],
    ['Salary', job.salary || 'Not listed']
  ];
  return `<div class="jc-meta">${items.map(([label, value]) => `<div class="meta-item"><span class="meta-k">${escapeHTML(label)}</span><span class="meta-v">${escapeHTML(value)}</span></div>`).join('')}</div>`;
}

function categoryForJob(job) {
  const role = roleBucket(job);
  if (engineBucket(job) === 'unity') return { label: 'Unity jobs', href: '/unity-developer-jobs-canada/' };
  if (engineBucket(job) === 'unreal') return { label: 'Unreal Engine jobs', href: '/unreal-engine-jobs-canada/' };
  if (role === 'design') return { label: 'Game design jobs', href: '/game-design-jobs-canada/' };
  if (role === 'art') return { label: 'Game artist jobs', href: '/game-artist-jobs-canada/' };
  if (role === 'programming') return { label: 'Game programming jobs', href: '/game-programming-jobs-canada/' };
  return { label: 'Canadian game jobs', href: '/canadian-game-dev-jobs/' };
}

function staticInternalLinks(job) {
  const category = categoryForJob(job);
  const links = [
    { href: `/locations/${locationSlug(job.location)}/`, label: `${cityName(job.location)} jobs` },
    category,
    { href: '/remote-game-dev-jobs-canada/', label: 'Remote jobs Canada' },
    { href: '/entry-level-game-dev-jobs-canada/', label: 'Entry-level jobs' },
    { href: '/video-game-studios-hiring-canada/', label: 'Studios hiring' }
  ];
  return `<div class="seo-link-grid">${links.map((link) => `<a href="${escapeHTML(link.href)}">${escapeHTML(link.label)}</a>`).join('')}</div>`;
}

function staticJobCardHTML(job) {
  const badges = [
    job.featured ? '<span class="b-feat">Featured</span>' : '',
    job.student ? '<span class="b-stu">Student-friendly</span>' : '',
    isFresh(job, 4) ? '<span class="b-new">New</span>' : ''
  ].filter(Boolean).join('');
  const desc = job.desc ? `<p class="jc-desc">${escapeHTML(truncate(job.desc, 220))}</p>` : '';
  return `<article class="jc ${job.featured ? 'feat' : ''}">
    <div class="jc-main">
      <div class="jc-top">
        <div class="jc-title-grp">
          <h2 class="jc-title" style="margin:0"><a href="${escapeHTML(localHref(jobFolder(job)))}" style="color:inherit;text-decoration:none">${escapeHTML(job.title)}</a></h2>
          <div class="jc-studio">${escapeHTML(job.studio)}</div>
          ${badges ? `<div class="jc-badges">${badges}</div>` : ''}
        </div>
        <div class="jc-score-mini" title="Signal score">${signalScore(job)}</div>
      </div>
      <div class="jc-meta-mini">
        <span>${escapeHTML(cityName(job.location))}</span>
        <span class="dot"> - </span>
        <span>${escapeHTML(job.mode || 'On-site')}</span>
        <span class="dot"> - </span>
        <span>${escapeHTML(job.type || 'Role')}</span>
      </div>
      ${desc}
      ${staticInternalLinks(job)}
      <div class="jc-card-foot">
        <span class="jc-posted">${job.posted ? `Posted ${escapeHTML(isoDate(job.posted) || job.posted)}` : 'Recently added'}</span>
        <a class="jc-cta-mini" href="${escapeHTML(localHref(jobFolder(job)))}">View details</a>
      </div>
    </div>
  </article>`;
}

function staticLandingSection(target, jobs) {
  const studios = new Set(jobs.map((job) => job.studio).filter(Boolean)).size;
  const remote = jobs.filter(isRemote).length;
  const entry = jobs.filter(isEntryLevel).length;
  const intents = [
    { href: '/remote-game-dev-jobs-canada/', label: 'Remote roles', body: 'Canada-focused remote listings with work-mode details.' },
    { href: '/entry-level-game-dev-jobs-canada/', label: 'Entry-level path', body: 'Junior, internship, co-op, and student-friendly roles.' },
    { href: '/game-programming-jobs-canada/', label: 'Programming', body: 'Gameplay, engine, online, tools, AI, and backend roles.' },
    { href: '/game-artist-jobs-canada/', label: 'Artists', body: '2D, 3D, VFX, animation, lighting, and technical art.' },
    { href: '/video-game-studios-hiring-canada/', label: 'Studios hiring', body: 'See which Canadian studios currently have open roles.' },
    { href: '/rss.xml', label: 'RSS feed', body: 'Follow new jobs automatically in feed readers and tools.' }
  ].filter((link) => link.href !== localHref(target.folder));
  const countLine = target.weekly
    ? `${jobs.length} role${jobs.length === 1 ? '' : 's'} posted in the last seven days match this page right now.`
    : `${jobs.length} current role${jobs.length === 1 ? '' : 's'} match this page right now.`;
  return `<section class="seo-landing">
    <div class="seo-hero-grid">
      <div>
        <span class="seo-eyebrow">Generated from approved listings</span>
        <h1>${escapeHTML(target.h1 || target.title)}</h1>
        <p>${escapeHTML(target.intro || target.desc)}</p>
        <p><strong>${escapeHTML(countLine)}</strong> No fake jobs are added for search traffic.</p>
      </div>
      <div class="seo-stat-grid" aria-label="Page stats">
        <div class="seo-stat"><strong>${jobs.length}</strong><span>matching roles</span></div>
        <div class="seo-stat"><strong>${studios}</strong><span>studios</span></div>
        <div class="seo-stat"><strong>${remote}</strong><span>remote or hybrid</span></div>
        <div class="seo-stat"><strong>${entry}</strong><span>student-friendly</span></div>
      </div>
    </div>
    <div class="seo-intent-grid">${intents.map((link) => `<a class="seo-intent" href="${escapeHTML(link.href)}"><strong>${escapeHTML(link.label)}</strong><span>${escapeHTML(link.body)}</span></a>`).join('')}</div>
  </section>`;
}

function staticStudioDirectory(jobs) {
  const grouped = new Map();
  jobs.forEach((job) => {
    if (!grouped.has(job.studio)) grouped.set(job.studio, []);
    grouped.get(job.studio).push(job);
  });
  const cards = [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 80)
    .map(([studio, studioJobs]) => {
      const latest = sortJobs(studioJobs)[0];
      const buckets = [...new Set(studioJobs.map(roleBucket).filter((bucket) => bucket !== 'other'))].slice(0, 3);
      return `<article class="seo-studio-card">
          <h2>${escapeHTML(studio)}</h2>
          <p>${escapeHTML(studioJobs.length)} open role${studioJobs.length === 1 ? '' : 's'} near ${escapeHTML(latest.location || 'Canada')}.</p>
          ${buckets.length ? `<div class="jc-badges">${buckets.map((bucket) => `<span class="pill p-type">${escapeHTML(bucket)}</span>`).join('')}</div>` : ''}
          <div class="seo-link-grid">
            <a href="${escapeHTML(localHref(jobFolder(latest)))}">Latest role</a>
            <a href="/#q=${encodeURIComponent(studio)}">View studio jobs</a>
            <a href="/locations/${locationSlug(latest.location)}/">${escapeHTML(cityName(latest.location))} jobs</a>
          </div>
      </article>`;
    }).join('');
  return cards ? `<div class="seo-studio-grid">${cards}</div>` : '<div class="seo-empty">No studios are currently represented in the live jobs data.</div>';
}

function staticJobDetail(job, related) {
  const apply = job.apply
    ? `<a class="apply-btn" href="${escapeHTML(job.apply)}" target="_blank" rel="noopener">Apply on studio site</a>`
    : '<span class="seo-empty">No application link is listed yet.</span>';
  const category = categoryForJob(job);
  const badges = [
    job.featured ? '<span class="b-feat">Featured</span>' : '',
    job.student ? '<span class="b-stu">Student-friendly</span>' : '',
    isFresh(job, 4) ? '<span class="b-new">New</span>' : ''
  ].filter(Boolean).join('');
  const relatedHTML = related.length
    ? `<section><h2 class="seo-section-title">Related jobs</h2><div class="job-list">${related.map(staticJobCardHTML).join('')}</div></section>`
    : '';
  return `<article class="seo-job-detail">
    <span class="seo-eyebrow">Verified listing</span>
    <h1>${escapeHTML(job.title)} at ${escapeHTML(job.studio)}</h1>
    ${badges ? `<div class="jc-badges">${badges}</div>` : ''}
    <p>${escapeHTML(truncate(job.desc || `${job.title} role at ${job.studio}.`, 260))}</p>
    ${staticMeta(job)}
    <div class="seo-detail-actions">${apply}<a class="d-act-btn" href="${escapeHTML(category.href)}">${escapeHTML(category.label)}</a><a class="d-act-btn" href="/locations/${locationSlug(job.location)}/">${escapeHTML(cityName(job.location))} jobs</a></div>
    <section><h2 class="seo-section-title">About the role</h2><p>${escapeHTML(job.desc || 'The listing did not include a detailed description.')}</p></section>
    <section><h2 class="seo-section-title">Browse related searches</h2>${staticInternalLinks(job)}</section>
    ${relatedHTML}
  </article>`;
}

function renderStaticMain(target, jobs, related = []) {
  if (target.pageKind === 'job') {
    return `<main id="main-content" class="seo-page-main" role="main">
      <div class="seo-shell">${staticJobDetail(jobs[0], related)}</div>
    </main>`;
  }
  const resultTitle = target.pageKind === 'studios' ? 'Studios with open roles' : 'Matching jobs';
  const resultCopy = target.weekly
    ? 'Updated automatically from the current MapleDevs job data. Quiet weeks stay honest and show no fake listings.'
    : 'Generated from approved open roles. Use the cards to jump into full job pages and related searches.';
  const results = target.pageKind === 'studios'
    ? staticStudioDirectory(jobs)
    : (jobs.length ? `<div class="job-list">${jobs.slice(0, 25).map(staticJobCardHTML).join('')}</div>` : '<div class="seo-empty">No matching jobs are live right now. Use the browse cards above to explore current Canadian game jobs.</div>');
  const browseAll = target.folder === 'canadian-game-dev-jobs'
    ? '<a class="btn-s" href="/rss.xml">RSS feed</a>'
    : '<a class="btn-s" href="/canadian-game-dev-jobs/">All Canadian jobs</a>';
  return `<main id="main-content" class="seo-page-main" role="main">
    <div class="seo-shell">
      ${staticLandingSection(target, jobs)}
      <section class="seo-results">
        <div class="seo-board-head">
          <div><h2>${escapeHTML(resultTitle)}</h2><p>${escapeHTML(resultCopy)}</p></div>
          ${browseAll}
        </div>
        ${results}
      </section>
    </div>
  </main>`;
}

function injectSEO(html, target, jobs, related = []) {
  let output = html.trim();
  const canonicalUrl = pageURL(target.folder);

  output = output.replace(/<title>.*?<\/title>/i, `<title>${escapeHTML(target.title)}</title>`);
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
  output = ensureRSSLink(output);

  const structuredData = buildStructuredData(target, jobs);
  const structuredRegex = /<!-- Structured Data -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
  output = structuredRegex.test(output)
    ? output.replace(structuredRegex, structuredData)
    : output.replace('</head>', `${structuredData}\n</head>`);

  output = output.replace(/(<h1 id="hero-heading">)[\s\S]*?(<\/h1>)/i, `$1${escapeHTML(target.h1 || target.title)}$2`);
  output = output.replace(/<main id="main-content" role="main">[\s\S]*?<\/main>/i, renderStaticMain(target, jobs, related));
  output = output.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class=/i.test(attrs)) {
      return match.replace(/class=(["'])(.*?)\1/i, (classMatch, quote, classes) => `class=${quote}${classes} seo-static-page${quote}`);
    }
    return `<body${attrs} class="seo-static-page">`;
  });
  return output;
}

function staticPageURL(pagePath) {
  const clean = pagePath.replace(/^\/+/, '');
  return clean.endsWith('/') ? `${SITE_URL}/${clean}` : `${SITE_URL}/${clean}`;
}

function staticPageFile(pagePath) {
  const clean = pagePath.replace(/^\/|\/$/g, '');
  if (clean.endsWith('.html')) return path.join(ROOT_DIR, clean);
  return path.join(ROOT_DIR, clean, 'index.html');
}

function staticPageTitle(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return stripHTML(match ? match[1] : fallback || 'MapleDevs');
}

function staticPageSchema(pagePath, title) {
  return `<!-- Structured Data -->\n<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      organizationSchema(),
      websiteSchema(),
      {
        '@type': 'WebPage',
        '@id': `${staticPageURL(pagePath)}#webpage`,
        name: title,
        url: staticPageURL(pagePath),
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'en-CA'
      }
    ]
  }, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

function ensurePublicStaticPageBasics() {
  for (const page of STATIC_PUBLIC_PAGES) {
    const file = staticPageFile(page.path);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    const title = staticPageTitle(html, page.path);
    const desc = `${title.replace(/\s+\|.*$/, '')} on MapleDevs, a Canadian game industry jobs board.`;
    if (!/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n<meta name="description" content="${escapeHTML(desc)}">`);
    }
    if (!/<script\s+type=["']application\/ld\+json["']/i.test(html)) {
      html = html.replace('</head>', `${staticPageSchema(page.path, title)}\n</head>`);
    }
    fs.writeFileSync(file, html);
  }
}

async function loadBaseHTML() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error('index.html not found');
  return fs.readFileSync(INDEX_PATH, 'utf8');
}

async function loadJobs() {
  if (!FORCE_LOCAL) {
    try {
      const csv = await fetchURL(LIVE_CSV_URL);
      const jobs = parseCSV(csv);
      if (jobs.length) return jobs;
    } catch (err) {
      console.warn(`Could not fetch Google Sheet. Falling back to live.csv: ${err.message}`);
    }
  }
  return parseCSV(fs.readFileSync(LIVE_CSV_PATH, 'utf8'));
}

function writePage(folder, html) {
  const dir = path.join(ROOT_DIR, folder);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function buildLocationTargets(jobs) {
  const byLocation = new Map();
  jobs.forEach((job) => {
    const loc = job.location || 'Canada';
    if (!byLocation.has(loc)) byLocation.set(loc, []);
    byLocation.get(loc).push(job);
  });
  return [...byLocation.entries()].map(([location, locJobs]) => ({
    folder: `locations/${locationSlug(location)}`,
    hash: `#city=${encodeURIComponent(cityName(location))}`,
    title: `${cityName(location)} Game Dev Jobs | MapleDevs`,
    desc: `Browse current game development jobs in ${location} from studios hiring in Canada.`,
    h1: `Game dev jobs in ${location}`,
    intro: `Current MapleDevs roles connected to ${location}. Use this page to jump between local listings, remote roles, and related Canadian game job categories.`,
    filter: (job) => (job.location || '').toLowerCase() === location.toLowerCase(),
    priority: locJobs.length >= 3 ? '0.72' : '0.62'
  }));
}

function relatedJobsFor(job, jobs, limit = 4) {
  const role = roleBucket(job);
  return sortJobs(jobs.filter((candidate) => candidate !== job && (
    candidate.studio === job.studio ||
    candidate.location === job.location ||
    roleBucket(candidate) === role ||
    (engineBucket(candidate) && engineBucket(candidate) === engineBucket(job))
  ))).slice(0, limit);
}

function writeSitemap(entries) {
  const seen = new Set();
  const body = entries.filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  }).map((entry) => `  <url><loc>${escapeXML(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join('\n');
  fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

function writeRobots() {
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /account/',
    'Disallow: /saved/',
    'Disallow: /traffic/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(ROOT_DIR, 'robots.txt'), content);
}

function writeRSS(jobs) {
  const latest = sortByPosted(jobs).slice(0, 30);
  const items = latest.map((job) => {
    const date = parseDate(job.posted);
    const pubDate = date ? `<pubDate>${date.toUTCString()}</pubDate>` : '';
    const description = truncate(`${job.studio} - ${job.location || 'Canada'} - ${job.mode || 'Work mode not listed'}. ${job.desc || ''}`, 280);
    return `<item>
      <title>${escapeXML(`${job.title} at ${job.studio}`)}</title>
      <link>${escapeXML(jobURL(job))}</link>
      <guid isPermaLink="true">${escapeXML(jobURL(job))}</guid>
      ${pubDate}
      <description>${escapeXML(description)}</description>
    </item>`;
  }).join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>
    <title>MapleDevs Latest Jobs</title>
    <link>${SITE_URL}/</link>
    <description>Latest Canadian game industry jobs from MapleDevs.</description>
    <language>en-ca</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel></rss>\n`;
  fs.writeFileSync(path.join(ROOT_DIR, 'rss.xml'), rss);
  fs.writeFileSync(path.join(ROOT_DIR, 'feed.xml'), rss);
}

function xPost(text) {
  return text.length <= 270 ? text : `${text.slice(0, 267).trim()}...`;
}

function jobSnippet(job) {
  const url = jobURL(job);
  const facts = [job.location, job.mode, job.salary].filter(Boolean).join(' | ');
  return {
    linkedin: `New on MapleDevs: ${job.title} at ${job.studio}${facts ? ` (${facts})` : ''}.\n\nView the listing: ${url}\n\n#GameDevJobs #GameDev #Canada`,
    reddit: `Title: ${job.title} at ${job.studio} - ${job.location || 'Canada'}\n\n${facts ? `${facts}\n\n` : ''}I found this Canadian game industry role on MapleDevs. Check the community rules before posting and avoid reposting if the studio has already shared it.\n\n${url}`,
    discord: `${job.title} at ${job.studio} - ${job.location || 'Canada'}${job.mode ? ` - ${job.mode}` : ''}\n${url}`,
    x: xPost(`New Canadian game dev job: ${job.title} at ${job.studio} (${job.location || 'Canada'}). ${url} #GameDevJobs #GameDev`)
  };
}

function writeSocialDrafts(jobs) {
  ensureDir(TRAFFIC_DIR);
  const latest = sortByPosted(jobs).slice(0, 12);
  let md = '# MapleDevs Social Snippets\n\nReview before posting. Do not auto-post to communities. Check each community rule set and avoid reposting the same job repeatedly.\n\n';
  latest.forEach((job, index) => {
    const snippets = jobSnippet(job);
    md += `## ${index + 1}. ${job.title} at ${job.studio}\n\n`;
    md += `### LinkedIn\n${snippets.linkedin}\n\n`;
    md += `### Reddit-friendly\n${snippets.reddit}\n\n`;
    md += `### Discord-friendly\n${snippets.discord}\n\n`;
    md += `### X/Twitter\n${snippets.x}\n\n---\n\n`;
  });
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'social-snippets.md'), md);
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'social-snippets.html'), simpleHTML('MapleDevs Social Snippets', markdownToHTML(md)));
}

function listJobsMD(title, jobs) {
  if (!jobs.length) return `## ${title}\n\nNo matching roles are live in this bucket right now.\n\n`;
  return `## ${title}\n\n${jobs.slice(0, 8).map((job) => `- [${job.title} at ${job.studio}](${jobURL(job)}) - ${job.location || 'Canada'}${job.mode ? ` - ${job.mode}` : ''}`).join('\n')}\n\n`;
}

function writeNewsletterDraft(jobs) {
  ensureDir(TRAFFIC_DIR);
  const fresh = sortJobs(jobs.filter((job) => isFresh(job, 7)));
  const latest = sortJobs(jobs).slice(0, 8);
  const featured = sortJobs(jobs.filter((job) => job.featured)).slice(0, 6);
  const remote = sortJobs(jobs.filter(isRemote)).slice(0, 8);
  const entry = sortJobs(jobs.filter(isEntryLevel)).slice(0, 8);
  const intro = fresh.length
    ? `Here are the top new Canadian game industry roles from MapleDevs this week.`
    : `No roles in the current data were posted in the last seven days, so this draft uses the latest active listings instead.`;
  const md = `# MapleDevs Weekly Jobs Draft\n\n${intro}\n\n${listJobsMD('Top new jobs this week', fresh.length ? fresh : latest)}${listJobsMD('Featured jobs', featured)}${listJobsMD('Remote jobs', remote)}${listJobsMD('Entry-level and student-friendly jobs', entry)}## Link back\n\nBrowse all current roles: ${SITE_URL}/canadian-game-dev-jobs/\n\nRSS feed: ${SITE_URL}/rss.xml\n`;
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'newsletter-draft.md'), md);
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'newsletter-draft.html'), simpleHTML('MapleDevs Weekly Jobs Draft', markdownToHTML(md)));
}

function markdownToHTML(md) {
  return md.split(/\n{2,}/).map((block) => {
    if (block.startsWith('# ')) return `<h1>${escapeHTML(block.slice(2))}</h1>`;
    if (block.startsWith('## ')) return `<h2>${escapeHTML(block.slice(3))}</h2>`;
    if (block.startsWith('### ')) return `<h3>${escapeHTML(block.slice(4))}</h3>`;
    if (block.startsWith('- ')) {
      return `<ul>${block.split('\n').map((line) => `<li>${linkify(escapeHTML(line.slice(2)))}</li>`).join('')}</ul>`;
    }
    return `<p>${linkify(escapeHTML(block)).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function linkify(html) {
  return html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function simpleHTML(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:860px;margin:0 auto;padding:32px;line-height:1.6;color:#151513;background:#f8f7f4}h1,h2,h3{line-height:1.2}a{color:#C8372D}pre,p,li{font-size:15px}section,.card{background:#fff;border:1px solid rgba(17,17,16,.1);border-radius:8px;padding:16px;margin:12px 0}</style></head><body>${body}</body></html>`;
}

function scanPages() {
  const pages = [];
  const skip = /\\(node_modules|\.git|\.codex-backups|dist|traffic)\\/i;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (skip.test(full)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) pages.push(full);
    }
  };
  walk(ROOT_DIR);
  return pages.map((file) => {
    const html = fs.readFileSync(file, 'utf8');
    return {
      file: path.relative(ROOT_DIR, file).replace(/\\/g, '/'),
      missingTitle: !/<title>[^<]+<\/title>/i.test(html),
      missingDescription: !/<meta\s+name=["']description["'][^>]*content=["'][^"']+["']/i.test(html),
      missingSchema: !/<script\s+type=["']application\/ld\+json["']/i.test(html)
    };
  });
}

function findBrokenInternalLinks() {
  const htmlPages = scanPages().map((page) => path.join(ROOT_DIR, page.file));
  const broken = [];
  for (const file of htmlPages) {
    const html = fs.readFileSync(file, 'utf8');
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean || clean === '/') continue;
      let target = path.join(ROOT_DIR, clean.replace(/^\/+/, ''));
      if (clean.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) broken.push({ from: path.relative(ROOT_DIR, file).replace(/\\/g, '/'), href });
    }
  }
  return broken;
}

function writeDashboard(jobs, pageTargets, sitemapEntries) {
  ensureDir(TRAFFIC_DIR);
  const pageScan = scanPages();
  const missingTitle = pageScan.filter((page) => page.missingTitle);
  const missingDescription = pageScan.filter((page) => page.missingDescription);
  const missingSchema = pageScan.filter((page) => page.missingSchema);
  const brokenLinks = findBrokenInternalLinks();
  const freshCount = jobs.filter((job) => isFresh(job, 7)).length;
  const dashboard = {
    generatedAt: new Date().toISOString(),
    totalJobs: jobs.length,
    newJobsThisWeek: freshCount,
    seoPagesCreated: pageTargets.length,
    sitemap: { exists: fs.existsSync(path.join(ROOT_DIR, 'sitemap.xml')), urlCount: sitemapEntries.length },
    rss: { exists: fs.existsSync(path.join(ROOT_DIR, 'rss.xml')), latestJobs: Math.min(jobs.length, 30) },
    missingTitle: missingTitle.map((page) => page.file),
    missingDescription: missingDescription.map((page) => page.file),
    missingSchema: missingSchema.map((page) => page.file),
    brokenInternalLinks: brokenLinks
  };
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'dashboard.json'), JSON.stringify(dashboard, null, 2));
  const html = `<h1>MapleDevs Traffic Dashboard</h1>
    <section class="card"><h2>Status</h2><ul>
      <li>Total jobs: ${dashboard.totalJobs}</li>
      <li>New jobs this week: ${dashboard.newJobsThisWeek}</li>
      <li>SEO pages created: ${dashboard.seoPagesCreated}</li>
      <li>Sitemap status: ${dashboard.sitemap.exists ? 'OK' : 'Missing'} (${dashboard.sitemap.urlCount} URLs)</li>
      <li>RSS status: ${dashboard.rss.exists ? 'OK' : 'Missing'} (${dashboard.rss.latestJobs} latest jobs)</li>
      <li>Broken internal links found: ${dashboard.brokenInternalLinks.length}</li>
    </ul></section>
    ${dashboardSection('Pages missing titles', dashboard.missingTitle)}
    ${dashboardSection('Pages missing descriptions', dashboard.missingDescription)}
    ${dashboardSection('Pages missing schema', dashboard.missingSchema)}
    ${dashboardSection('Broken internal links', dashboard.brokenInternalLinks.map((item) => `${item.from} -> ${item.href}`))}
    <section class="card"><h2>Review files</h2><ul><li>traffic/social-snippets.md</li><li>traffic/newsletter-draft.md</li><li>traffic/dashboard.json</li></ul></section>`;
  fs.writeFileSync(path.join(TRAFFIC_DIR, 'dashboard.html'), simpleHTML('MapleDevs Traffic Dashboard', html));
}

function dashboardSection(title, items) {
  if (!items.length) return `<section class="card"><h2>${escapeHTML(title)}</h2><p>None found.</p></section>`;
  return `<section class="card"><h2>${escapeHTML(title)}</h2><ul>${items.slice(0, 80).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section>`;
}

function writeIndexNowFiles(sitemapEntries) {
  fs.writeFileSync(path.join(ROOT_DIR, INDEXNOW_KEY_FILE), `${INDEXNOW_KEY}\n`);
  const urlList = sitemapEntries.map((entry) => entry.loc).slice(0, 10000);
  fs.writeFileSync(path.join(ROOT_DIR, 'indexnow-urls.json'), JSON.stringify({
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY_FILE}`,
    urlList
  }, null, 2));
}

function staticPageExists(pagePath) {
  const clean = pagePath.replace(/^\/|\/$/g, '');
  if (!clean) return true;
  const full = path.join(ROOT_DIR, clean);
  if (clean.endsWith('.html') || clean.endsWith('.xml') || clean.endsWith('.txt')) return fs.existsSync(full);
  return fs.existsSync(path.join(full, 'index.html'));
}

async function build() {
  console.log('Starting MapleDevs traffic build...');
  const baseHTML = await loadBaseHTML();
  const jobs = sortJobs(await loadJobs());
  console.log(`Loaded ${jobs.length} live jobs from ${FORCE_LOCAL ? 'live.csv' : 'Google Sheet or fallback'}.`);

  const locationTargets = buildLocationTargets(jobs);
  const pageTargets = [...SEO_TARGETS, ...WEEKLY_TARGETS, ...CONTINUITY_TARGETS, ...locationTargets];
  const sitemapEntries = [{
    loc: `${SITE_URL}/`,
    changefreq: 'daily',
    priority: '1.0',
    lastmod: new Date().toISOString().slice(0, 10)
  }];

  for (const page of STATIC_PUBLIC_PAGES) {
    if (staticPageExists(page.path)) {
      sitemapEntries.push({ loc: `${SITE_URL}/${page.path}`, changefreq: page.changefreq, priority: page.priority });
    }
  }

  for (const target of pageTargets) {
    const targetJobs = sortJobs(jobs.filter((job) => target.filter(job)));
    const pageTarget = { ...target };
    if (targetJobs.length && !target.weekly && target.pageKind !== 'studios') {
      pageTarget.desc = truncate(`${targetJobs.length} current Canadian game industry role${targetJobs.length === 1 ? '' : 's'} match this page. ${target.desc}`, 160);
    }
    writePage(target.folder, injectSEO(baseHTML, pageTarget, targetJobs));
    if (!NOINDEX_FOLDERS.has(target.folder)) {
      sitemapEntries.push({ loc: pageURL(target.folder), changefreq: target.weekly ? 'weekly' : 'daily', priority: target.priority || '0.7', lastmod: new Date().toISOString().slice(0, 10) });
    }
  }

  const jobsDir = path.join(ROOT_DIR, 'jobs');
  ensureDir(jobsDir);
  for (const job of jobs) {
    const target = {
      folder: jobFolder(job),
      hash: `#id=${jobSlug(job)}`,
      title: `${job.title} at ${job.studio} | MapleDevs`,
      desc: truncate(`Apply for ${job.title} at ${job.studio}${job.location ? ` in ${job.location}` : ''}. ${job.mode ? `${job.mode}. ` : ''}${job.desc || ''}`, 160),
      h1: `${job.title} at ${job.studio}`,
      intro: job.desc || `Current role at ${job.studio}.`,
      pageKind: 'job'
    };
    writePage(target.folder, injectSEO(baseHTML, target, [job], relatedJobsFor(job, jobs)));
    sitemapEntries.push({ loc: jobURL(job), changefreq: 'weekly', priority: job.featured ? '0.72' : '0.62', lastmod: isoDate(job.posted) || new Date().toISOString().slice(0, 10) });
  }

  writeRSS(jobs);
  sitemapEntries.push({ loc: `${SITE_URL}/rss.xml`, changefreq: 'daily', priority: '0.3', lastmod: new Date().toISOString().slice(0, 10) });
  writeSitemap(sitemapEntries);
  writeRobots();
  writeIndexNowFiles(sitemapEntries);
  ensurePublicStaticPageBasics();
  writeSocialDrafts(jobs);
  writeNewsletterDraft(jobs);
  writeDashboard(jobs, pageTargets, sitemapEntries);

  console.log(`Generated ${pageTargets.length} SEO/weekly/location pages, ${jobs.length} job pages, sitemap.xml, rss.xml, IndexNow files, and traffic review drafts.`);
}

module.exports = {
  build,
  parseCSV,
  isEntryLevel,
  isRemote,
  roleBucket,
  engineBucket
};

if (require.main === module) {
  build().catch((err) => {
    console.error('Traffic build failed:', err);
    process.exit(1);
  });
}
