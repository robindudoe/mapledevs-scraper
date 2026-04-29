/**
 * MapleDevs — Automated Job Scraper
 *
 * This script scrapes Canadian game studio career pages using free, public APIs
 * (Greenhouse Job Board API, Lever Postings API) and updates your Google Sheet.
 *
 * Supported ATS platforms:
 * - Greenhouse (boards-api.greenhouse.io) — No auth needed
 * - Lever (api.lever.co) — No auth needed
 *
 * HOW TO ADD A NEW STUDIO:
 * 1. Find their careers page URL
 * 2. Check if it's powered by Greenhouse or Lever:
 *    - Greenhouse: URL contains "boards.greenhouse.io/{token}" or "job-boards.greenhouse.io/{token}"
 *    - Lever: URL contains "jobs.lever.co/{token}"
 * 3. Add an entry to the STUDIOS array below with the token and platform
 *
 * SETUP REQUIRED:
 * 1. Create a Google Cloud service account (see README.md)
 * 2. Share your Google Sheet with the service account email
 * 3. Set environment variables (see below)
 *
 * ENV VARS:
 * - GOOGLE_SHEET_ID: Your Google Sheet ID (from the URL)
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service account email
 * - GOOGLE_PRIVATE_KEY: Service account private key (base64 encoded)
 */

const http = require('http');
const https = require('https');

const VALIDATE_APPLY_LINKS = process.env.VALIDATE_APPLY_LINKS !== 'false';
const LINK_CHECK_CONCURRENCY = Math.max(1, Number(process.env.LINK_CHECK_CONCURRENCY || 6));
const LINK_CHECK_TIMEOUT_MS = Math.max(1000, Number(process.env.LINK_CHECK_TIMEOUT_MS || 8000));
const LINK_CHECK_MAX_REDIRECTS = 5;
const KNOWN_DEAD_APPLY_URLS = new Set([
  'https://epicgames.com/careers/jobs/5764691004?gh_jid=5764691004'
]);

// ═══════════════════════════════════════════════
// STUDIO CONFIGURATION
// Add your Canadian game studios here!
// ═══════════════════════════════════════════════
const STUDIOS = [
  // ─── Greenhouse Studios ───
  // To find tokens: visit the studio's careers page and look for
  // "boards.greenhouse.io/{TOKEN}" or "job-boards.greenhouse.io/{TOKEN}" in the URL
  {
    name: "Digital Extremes",
    platform: "greenhouse",
    token: "digitalextremes",
    city: "London, Ontario",
    // Filter to only Canadian jobs (some studios post worldwide)
    locationFilter: null, // null = include all (they're Canada-only)
  },
  {
    name: "Behaviour Interactive",
    platform: "greenhouse",
    token: "behaviourinteractive",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Klei Entertainment",
    platform: "greenhouse",
    token: "klei",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Thunder Lotus Games",
    platform: "greenhouse",
    token: "thunderlotus",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Torn Banner Studios",
    platform: "greenhouse",
    token: "tornbanner",
    city: "Toronto, Ontario",
    locationFilter: "Canada"
  },
  {
    name: "Big Blue Bubble",
    platform: "greenhouse",
    token: "bigbluebubble",
    city: "London, Ontario",
    locationFilter: "Canada"
  },
  {
    name: "Relic Entertainment",
    platform: "greenhouse",
    token: "relicentertainment",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Phoenix Labs",
    platform: "greenhouse",
    token: "phoenixlabs",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Inflexion Games",
    platform: "greenhouse",
    token: "inflexiongames",
    city: "Edmonton, Alberta",
    locationFilter: "Canada"
  },
  {
    name: "Offworld Industries",
    platform: "greenhouse",
    token: "offworldindustries",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Kabam",
    platform: "greenhouse",
    token: "kabam",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Cloud Chamber",
    platform: "greenhouse",
    token: "cloudchamber",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "The Coalition",
    platform: "greenhouse",
    token: "thecoalition",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Next Level Games",
    platform: "greenhouse",
    token: "nextlevelgames",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Skybox Labs",
    platform: "greenhouse",
    token: "skyboxlabs",
    city: "Burnaby, BC",
    locationFilter: "Canada"
  },
  {
    name: "Hothead Games",
    platform: "greenhouse",
    token: "hotheadgames",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  // ─── EXAMPLE: How to add more Greenhouse studios ───
  // {
  //   name: "Studio Name",
  //   platform: "greenhouse",
  //   token: "studiotoken",        // from their careers URL
  //   city: "Vancouver, BC",       // default city if job doesn't specify
  //   locationFilter: "canada",    // only include jobs with "canada" in location
  // },

  // ─── Lever Studios ───
  // To find tokens: visit the studio's careers page and look for
  // "jobs.lever.co/{TOKEN}" in the URL
  // ─── EXAMPLE: How to add Lever studios ───
  // {
  //   name: "Studio Name",
  //   platform: "lever",
  //   token: "studioname",
  //   city: "Montreal, QC",
  //   locationFilter: "canada",
  // },
  {
    name: "East Side Games",
    platform: "lever",
    token: "eastsidegames",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "A Thinking Ape",
    platform: "lever",
    token: "athinkingape",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "Ludia",
    platform: "lever",
    token: "ludia",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Blackbird Interactive",
    platform: "lever",
    token: "blackbirdinteractive",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  // ─── SmartRecruiters Studios ───
  {
    name: "Ubisoft",
    platform: "smartrecruiters",
    token: "ubisoft2",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Gameloft",
    platform: "smartrecruiters",
    token: "gameloft",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "CD PROJEKT RED",
    platform: "smartrecruiters",
    token: "CDPROJEKTRED",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  // ─── Ashby Studios ───
  {
    name: "Hidden Path Entertainment",
    platform: "ashby",
    token: "hiddenpath",
    city: "Remote, Canada",
    locationFilter: "Canada"
  },
  // ─── Workday Studios ───
  {
    name: "Electronic Arts (EA)",
    platform: "workday",
    subdomain: "ea",
    tenant: "ea",
    site: "External",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  },
  {
    name: "BioWare",
    platform: "workday",
    subdomain: "ea", // BioWare is under EA
    tenant: "ea",
    site: "External",
    city: "Edmonton, Alberta",
    locationFilter: "BioWare"
  },
  {
    name: "Sledgehammer Games",
    platform: "workday",
    subdomain: "activision",
    tenant: "activision",
    site: "External",
    city: "Toronto, Ontario",
    locationFilter: "Canada"
  },
  {
    name: "WB Games Montreal",
    platform: "workday",
    subdomain: "warnerbros",
    tenant: "warnerbros",
    site: "External",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Unity",
    platform: "greenhouse",
    token: "unitytechnologies",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Epic Games",
    platform: "greenhouse",
    token: "epicgames",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
  {
    name: "Eidos Montreal",
    platform: "smartrecruiters",
    token: "eidosmontreal",
    city: "Montreal, Quebec",
    locationFilter: "Canada"
  },
];

const PROVINCE_MAP = {
  'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
  'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS',
  'new brunswick': 'NB', 'newfoundland': 'NL', 'prince edward island': 'PE',
  'yukon': 'YT', 'northwest territories': 'NT', 'nunavut': 'NU'
};

const CANADA_KEYWORDS = [
  'canada', 'canadian', 'toronto', 'montreal', 'vancouver', 'ottawa', 'calgary', 'edmonton',
  'winnipeg', 'quebec', 'ontario', 'bc', 'ab', 'on', 'qc', 'ns', 'nb', 'sk', 'mb',
  'halifax', 'victoria', 'london', 'hamilton', 'kitchener', 'waterloo', 'saskatoon', 'regina',
  'burnaby', 'richmond', 'surrey', 'oakville', 'brampton', 'mississauga', 'kelowna'
];

/**
 * Normalizes messy locations into "City, Prov" format.
 * Examples:
 *   "Montreal, Quebec, Canada" -> "Montreal, QC"
 *   "Toronto; Vancouver" -> "Toronto, ON" (picks first)
 *   "Bellevue, WA" -> null (filtered out)
 */
/**
 * Normalizes messy locations into "City, Prov" format.
 * THE FORTRESS: Whitelist-Only Mode.
 */
function normalizeLocation(raw, studioCity = '', filter = null) {
  if (!raw || raw.toLowerCase().includes('blank')) return studioCity || 'Canada';

  // Strip prefixes like "Location: " or "Team: " which some ATS include in field values
  let cleanRaw = raw.replace(/^(Location|Team|Department|Category):\s*/i, '').trim();

  const sLowerRaw = cleanRaw.toLowerCase().replace(/[\W_]+/g, ' ').trim(); // Clean for matching

  // 1. Whitelist: Must have one of these specifically or it's GONE.
  // We use word boundaries \b to ensure "on" doesn't match "Lyon" or "Washington"
  const CANADA_KW_REGEX = new RegExp(`\\b(${CANADA_KEYWORDS.join('|')})\\b`, 'i');
  const PROV_CODE_REGEX = /\b(on|qc|bc|ab|sk|mb|ns|nb|pe|nl|yt|nt|nu)\b/i;

  const hasCanadaKeyword = CANADA_KW_REGEX.test(sLowerRaw);
  const hasProvCode = PROV_CODE_REGEX.test(sLowerRaw);

  // 2. Global Noise: If it mentions these, it's an immediate fail (even if it says Remote)
  const globalNoise = /\b(france|paris|germany|berlin|india|bangalore|japan|tokyo|spain|madrid|barcelona|brazil|mexico|australia|uk|england|usa|united states|america|washington|bellevue|redmond|austin|texas|california|san francisco|london england)\b/i;
  if (globalNoise.test(sLowerRaw)) {
    // Edge case: "London, Ontario" should NOT be blocked by "London England" or "London"
    // But since "Ontario" is a Canada keyword, we can add a bypass if both are present
    if (sLowerRaw.includes('london') && (sLowerRaw.includes('ontario') || sLowerRaw.includes(' on '))) {
      // Keep going
    } else {
      return null;
    }
  }

  // 3. Strict Requirement Check
  const isStrictlyCanada = hasCanadaKeyword || hasProvCode;
  const isExplicitlyRemote = /\b(remote|anywhere|work from home|wfh)\b/i.test(sLowerRaw);

  if (filter && filter.toLowerCase().includes('canada')) {
    if (!isStrictlyCanada && !isExplicitlyRemote) return null; // Not Canada, not Remote? Reject.

    // If it's Remote, we only keep it if there is SOME Canadian context (either in the job loc or the studio's home city)
    if (isExplicitlyRemote && !isStrictlyCanada) {
      const studioIsCanada = CANADA_KW_REGEX.test(studioCity) || PROV_CODE_REGEX.test(studioCity) || studioCity.toLowerCase().includes('canada');
      if (!studioIsCanada) return null; // Remote but US/International studio? Drop.
    }
  }

  // 4. Parse segments
  const segments = raw.split(/[;/]/).map(s => s.trim());
  let bestLoc = null;

  for (const seg of segments) {
    const sLower = seg.toLowerCase().replace(/[\W_]+/g, ' ');
    if (globalNoise.test(sLower)) {
       if (sLower.includes('london') && (sLower.includes('ontario') || sLower.includes(' on '))) { /* allow */ }
       else continue;
    }

    if (CANADA_KW_REGEX.test(sLower) || PROV_CODE_REGEX.test(sLower)) { bestLoc = seg; break; }
    if (sLower.includes('remote') || sLower.includes('anywhere')) { bestLoc = seg; }
  }

  if (!bestLoc) return null;

  let loc = bestLoc;
  const lower = loc.toLowerCase();

  if (lower.includes('remote') || lower.includes('anywhere')) return 'Remote';

  loc = loc.replace(/, Canada/i, '').replace(/Canada/i, '').trim();
  if (!loc || loc === ',') return studioCity || 'Canada';

  for (const [fullName, code] of Object.entries(PROVINCE_MAP)) {
    const regex = new RegExp(`,\\s*${fullName}$`, 'i');
    if (regex.test(loc)) return loc.replace(regex, `, ${code}`);
    if (lower === fullName) return code;
  }

  loc = loc.replace(/, Quebec/i, ', QC').replace(/, Ontario/i, ', ON')
           .replace(/, British Columbia/i, ', BC').replace(/, Alberta/i, ', AB');

  if (loc.includes(',')) {
    const parts = loc.split(',');
    const city = parts[0].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const prov = parts[1].trim().toUpperCase();
    if (prov.length === 2) return `${city}, ${prov}`;
  }

  return loc;
}

/**
 * Normalizes ugly job titles.
 * Removes [Project Tags] and bilingual "French - English" formatting.
 */
function normalizeTitle(raw) {
  if (!raw) return '';
  let title = raw.trim();

  // Remove leading bracket tags: "[Disney Dreamlight Valley] "
  title = title.replace(/^\[.*?\]\s*/g, '');
  
  // Split by " - " or " / "
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length === 2) {
       const fr = /\(trice\)|\(e\)(?!\w)|\(euse\)|responsable|développeur|programmeur|directeur|artiste|concepteur|analyste|spécialiste|ingénieur/i;
       const p1fr = fr.test(parts[0]);
       const p2fr = fr.test(parts[1]);
       
       if (p1fr && !p2fr) title = parts[1];
       else if (p2fr && !p1fr) title = parts[0];
    }
  }
  
  // Clean up gender/diversity tags like (m/f/x), (h/f)
  title = title.replace(/\s*\([hmf]\/[hmf](?:\/[x])?\)/ig, '');
  
  // Clean up remaining brackets anywhere in the string
  title = title.replace(/\[.*?\]/g, '').trim();

  return title;
}

// ═══════════════════════════════════════════════
// HTTP HELPERS
// ═══════════════════════════════════════════════
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MapleDevs-JobScraper/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON from ${url}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

function probeApplyURL(url, redirects = 0) {
  return new Promise((resolve) => {
    const raw = String(url || '').trim();
    if (!raw || /^mailto:/i.test(raw)) {
      return resolve({ status: 'ok', statusCode: 200, finalUrl: raw, body: '' });
    }

    let parsed;
    try {
      parsed = new URL(raw);
    } catch (err) {
      return resolve({ status: 'dead', reason: 'Invalid application URL', finalUrl: raw, body: '' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return resolve({ status: 'unknown', reason: `Unsupported protocol: ${parsed.protocol}`, finalUrl: raw, body: '' });
    }

    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(parsed, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MapleDevs-LinkCheck/1.0; +https://mapledevs.ca/)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      const statusCode = res.statusCode || 0;
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirects < LINK_CHECK_MAX_REDIRECTS) {
        res.resume();
        try {
          const nextUrl = new URL(location, parsed).toString();
          return resolve(probeApplyURL(nextUrl, redirects + 1));
        } catch (err) {
          return resolve({ status: 'dead', reason: 'Invalid redirect URL', statusCode, finalUrl: raw, body: '' });
        }
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (body.length < 50000) body += chunk.slice(0, 50000 - body.length);
      });
      res.on('end', () => resolve({ status: 'ok', statusCode, finalUrl: parsed.toString(), body }));
    });

    req.setTimeout(LINK_CHECK_TIMEOUT_MS, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', err => {
      resolve({ status: 'unknown', reason: err.message, finalUrl: raw, body: '' });
    });
    req.end();
  });
}

function isDeadApplyProbe(probe) {
  if (!probe || probe.status === 'unknown') return false;
  if (probe.status === 'dead') return true;

  const status = Number(probe.statusCode || 0);
  if ([404, 410].includes(status)) return true;
  if (status >= 400 && status < 500 && ![400, 401, 403, 405, 429].includes(status)) return true;

  const text = `${probe.finalUrl || ''}\n${probe.body || ''}`;
  return /[?&]error=true\b/i.test(text)
    || /\b(job|posting|position).{0,60}\b(no longer available|closed|expired|filled)\b/i.test(text)
    || /\bno longer accepting applications\b/i.test(text)
    || /\b(page not found|job not found|posting not found)\b/i.test(text);
}

async function filterDeadApplyLinks(jobs) {
  if (!VALIDATE_APPLY_LINKS || !jobs.length) return jobs;

  console.log(`\nChecking application links (${jobs.length} jobs, concurrency ${LINK_CHECK_CONCURRENCY})...`);
  const keep = new Array(jobs.length).fill(true);
  let cursor = 0;
  let checked = 0;
  let dead = 0;
  let unknown = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++;
      const job = jobs[index];
      const applyUrl = String(job.applyUrl || '').trim();
      if (!applyUrl || /^mailto:/i.test(applyUrl)) continue;
      if (KNOWN_DEAD_APPLY_URLS.has(applyUrl)) {
        keep[index] = false;
        dead++;
        console.log(`  Known dead apply link: ${job.title} at ${job.studio} -> ${applyUrl}`);
        continue;
      }

      const probe = await probeApplyURL(applyUrl);
      checked++;
      if (probe.status === 'unknown') {
        unknown++;
        continue;
      }
      if (isDeadApplyProbe(probe)) {
        keep[index] = false;
        dead++;
        console.log(`  Dead apply link: ${job.title} at ${job.studio} -> ${applyUrl}${probe.finalUrl && probe.finalUrl !== applyUrl ? ` (final: ${probe.finalUrl})` : ''}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(LINK_CHECK_CONCURRENCY, jobs.length) }, () => worker());
  await Promise.all(workers);
  console.log(`Application links checked: ${checked}; removed dead links: ${dead}; kept after inconclusive checks: ${unknown}`);

  return jobs.filter((_, index) => keep[index]);
}

// ═══════════════════════════════════════════════
// GREENHOUSE SCRAPER
// ═══════════════════════════════════════════════
async function scrapeGreenhouse(studio) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${studio.token}/jobs?content=true`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const data = await httpGet(url);
    const jobs = data.jobs || [];
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .map(job => {
        const cleanTitle = (job.title || '').trim();
        if (cleanTitle.length < 3) return null;

        const cleanLoc = normalizeLocation(job.location?.name || '', studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: normalizeTitle(cleanTitle),
          studio: studio.name,
          location: cleanLoc,
          type: guessJobType(job.title, job.content || ''),
          mode: guessWorkMode(job.title, cleanLoc, job.content || ''),
          description: summarizeText(stripHTML(job.content || '')),
          applyUrl: job.absolute_url || '',
          posted: job.first_published ? new Date(job.first_published).toISOString().split('T')[0] : '',
          featured: 'No',
          student: guessStudentFriendly(job.title, job.content || '') ? 'Yes' : 'No',
          salary: guessSalary(job.content || ''),
          engine: guessEngine(job.title, job.content || ''),
          visa: guessVisaSponsorship(job.title, job.content || ''),
          sourceId: `gh_${studio.token}_${job.id}`,
        };
      })
      .filter(j => j !== null);
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// LEVER SCRAPER
// ═══════════════════════════════════════════════
async function scrapeLever(studio) {
  const url = `https://api.lever.co/v0/postings/${studio.token}?mode=json`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const jobs = await httpGet(url);
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .map(job => {
        const cleanTitle = (job.text || '').trim();
        if (cleanTitle.length < 3) return null;

        const cleanLoc = normalizeLocation(job.categories?.location || '', studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: normalizeTitle(cleanTitle),
          studio: studio.name,
          location: cleanLoc,
          type: job.categories?.commitment || guessJobType(job.text, job.descriptionPlain || ''),
          mode: guessWorkMode(job.text, cleanLoc, job.descriptionPlain || ''),
          description: summarizeText(job.descriptionPlain || ''),
          applyUrl: job.hostedUrl || job.applyUrl || '',
          posted: job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : '',
          featured: "No",
          student: guessStudentFriendly(job.text, job.descriptionPlain || '') ? 'Yes' : 'No',
          salary: guessSalary(job.descriptionPlain || ''),
          engine: guessEngine(job.text, job.descriptionPlain || ''),
          visa: guessVisaSponsorship(job.text, job.descriptionPlain || ''),
          sourceId: `lv_${studio.token}_${job.id}`,
        };
      })
      .filter(j => j !== null);
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// SMARTRECRUITERS SCRAPER
// ═══════════════════════════════════════════════
function smartRecruitersLocationText(job) {
  const location = job.location || {};
  const parts = [];
  if (location.remote) parts.push('Remote');
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) {
    const country = String(location.country).toLowerCase() === 'ca'
      ? 'Canada'
      : String(location.country).toLowerCase() === 'us'
        ? 'United States'
        : location.country;
    parts.push(country);
  }
  return parts.filter(Boolean).join(', ');
}

async function scrapeSmartRecruiters(studio) {
  const url = `https://api.smartrecruiters.com/v1/companies/${studio.token}/postings?limit=100`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const data = await httpGet(url);
    const jobs = data.content || [];
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .map(job => {
        const rawLoc = smartRecruitersLocationText(job);
        const cleanLoc = normalizeLocation(rawLoc, studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: normalizeTitle(job.name || ''),
          studio: studio.name,
          location: cleanLoc,
          type: guessJobType(job.name, ''),
          mode: guessWorkMode(job.name, cleanLoc, ''),
          description: `Department: ${job.department?.label || 'General'}. Experience Level: ${job.experienceLevel?.label || 'N/A'}.`,
          applyUrl: `https://jobs.smartrecruiters.com/${studio.token}/${job.id}`,
          posted: job.releasedDate ? new Date(job.releasedDate).toISOString().split('T')[0] : '',
          featured: "No",
          student: guessStudentFriendly(job.name, '') ? 'Yes' : 'No',
          salary: guessSalary(job.name),
          engine: guessEngine(job.name, ''),
          visa: guessVisaSponsorship(job.name, ''),
          sourceId: `sr_${studio.token}_${job.id}`,
        };
      })
      .filter(j => j !== null);
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// ASHBY SCRAPER
// ═══════════════════════════════════════════════
async function scrapeAshby(studio) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${studio.token}`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const data = await httpGet(url);
    const jobs = data.jobs || [];
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .map(job => {
        const cleanLoc = normalizeLocation(job.location || '', studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: normalizeTitle(job.title || ''),
          studio: studio.name,
          location: cleanLoc,
          type: job.employmentType || guessJobType(job.title, job.description || ''),
          mode: guessWorkMode(job.title, cleanLoc, job.description || ''),
          description: summarizeText(stripHTML(job.description || '')),
          applyUrl: job.jobUrl || '',
          posted: job.publishedAt ? new Date(job.publishedAt).toISOString().split('T')[0] : '',
          featured: "No",
          student: guessStudentFriendly(job.title, job.description || '') ? 'Yes' : 'No',
          salary: guessSalary(job.description || ''),
          engine: guessEngine(job.title, job.description || ''),
          visa: guessVisaSponsorship(job.title, job.description || ''),
          sourceId: `as_${studio.token}_${job.id}`,
        };
      })
      .filter(j => j !== null);
  } catch (err) {
    console.error(`  ❌ Error scraping ${studio.name}: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════
// WORKDAY SCRAPER (Internal CXS API)
// ═══════════════════════════════════════════════
async function scrapeWorkday(studio) {
  const url = `https://${studio.subdomain}.myworkdayjobs.com/wday/cxs/${studio.tenant}/${studio.site}/jobs`;
  console.log(`  📡 Fetching (POST): ${url}`);

  const payload = JSON.stringify({
    appliedFacets: {},
    limit: 100,
    offset: 0,
    searchText: ""
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`  ❌ Workday HTTP ${res.statusCode} for ${studio.name}`);
          return resolve([]);
        }
        try {
          const json = JSON.parse(data);
          const jobs = json.jobPostings || [];
          console.log(`  ✅ Found ${jobs.length} total postings at ${studio.name}`);

          const processed = jobs
            .map(job => {
              const cleanLoc = normalizeLocation(job.locationsText || '', studio.city, studio.locationFilter);
              if (!cleanLoc) return null;

              return {
                title: normalizeTitle(job.title || ''),
                studio: studio.name,
                location: cleanLoc,
                type: guessJobType(job.title, ''),
                mode: guessWorkMode(job.title, cleanLoc, ''),
                description: `View full details on ${studio.name} careers site.`,
                applyUrl: `https://${studio.subdomain}.myworkdayjobs.com/en-US/${studio.tenant}/${studio.site}/job/${job.externalPath}`,
                posted: job.postedOn || '',
                featured: "No",
                student: guessStudentFriendly(job.title, '') ? 'Yes' : 'No',
                salary: guessSalary(job.title), // Workday list is and limited desc
                engine: guessEngine(job.title, ''),
                visa: guessVisaSponsorship(job.title, ''),
                sourceId: `wd_${studio.subdomain}_${job.bulletFields?.[0] || job.externalPath}`,
              };
            })
            .filter(j => j !== null);
          resolve(processed);
        } catch (e) {
          console.error(`  ❌ Error parsing Workday JSON for ${studio.name}`);
          resolve([]);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`  ❌ Network error for Workday ${studio.name}: ${err.message}`);
      resolve([]);
    });

    req.write(payload);
    req.end();
  });
}

// ═══════════════════════════════════════════════
// SMART GUESSERS
// ═══════════════════════════════════════════════
function guessJobType(title, content) {
  const titleLower = title.toLowerCase();
  const isSenior = /\b(senior|lead|director|manager|principal|vp|head|staff)\b/.test(titleLower);

  const text = (title + ' ' + content).toLowerCase();
  if (!isSenior && (titleLower.includes('intern') || titleLower.includes('co-op') || text.includes('internship') || text.includes('co-op program') || (text.includes('intern') && !text.includes('internal')) || text.includes('coop'))) return 'Internship';
  if (text.includes('contract') || text.includes('temporary') || text.includes('temp ')) return 'Contract';
  if (text.includes('part-time') || text.includes('part time')) return 'Part-time';
  return 'Full-time';
}

function guessWorkMode(title, location, content) {
  const text = (title + ' ' + location + ' ' + content).toLowerCase();

  // Highest priority: Explicit Remote
  if (text.includes('fully remote') || text.includes('100% remote') || text.includes('remote only') || location.toLowerCase() === 'remote') {
    return 'Remote';
  }

  // Second priority: Hybrid
  if (text.includes('hybrid') || text.includes('flexible') || text.includes('flexible work')) {
    return 'Hybrid';
  }

  // Third: On-site indicators
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office') || text.includes('in office')) {
    return 'On-site';
  }

  // Default for game studios is usually On-site or Remote based on the studio's general policy
  if (text.includes('remote friendly') || text.includes('work from home')) return 'Hybrid';

  return 'On-site';
}

function guessStudentFriendly(title, content) {
  const titleLower = title.toLowerCase();
  if (/\b(senior|lead|director|manager|principal|vp|head|staff)\b/.test(titleLower)) return false;

  const text = (title + ' ' + content).toLowerCase();
  return text.includes('intern') || text.includes('co-op') || text.includes('coop')
    || text.includes('junior') || text.includes('entry level') || text.includes('entry-level')
    || text.includes('new grad') || text.includes('graduate');
}

function guessEngine(title, content) {
  const text = (title + ' ' + content).toLowerCase();

  if (/\bunreal\b|ue4|ue5/i.test(text)) return 'Unreal';
  if (/\bunity\b/i.test(text)) return 'Unity';
  if (/\bfrostbite\b/i.test(text)) return 'Frostbite';
  if (/\bsnowdrop\b/i.test(text)) return 'Snowdrop';
  if (/\bgodot\b/i.test(text)) return 'Godot';
  if (/\blumberyard\b/i.test(text)) return 'Lumberyard';
  if (/\bdecima\b/i.test(text)) return 'Decima';
  if (/\bcryengine\b/i.test(text)) return 'CryEngine';
  if (/\bredengine\b/i.test(text)) return 'RedEngine';
  if (/\bre engine\b/i.test(text)) return 'RE Engine';
  if (/\bnorthlight\b/i.test(text)) return 'Northlight';

  if (text.includes('c++') || text.includes('engine programmer')) return 'C++ / Proprietary';

  return '';
}

function guessVisaSponsorship(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  const positiveKeywords = [
    'relocation assistance', 'relocation support', 'sponsorship', 'visa sponsorship',
    'work permit', 'lmia', 'provincial nominee', 'pnp', 'international candidates',
    'global talent stream', 'can help with relocation', 'tfwp', 'temporary foreign worker'
  ];

  for (const kw of positiveKeywords) {
    if (text.includes(kw)) return 'Yes';
  }

  return '';
}

function stripHTML(html) {
  if (typeof html !== 'string') return '';
  return html
    // 1. Unescape generic HTML entities first so we can catch double-escaped ones
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 2. Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // 3. Remove non-breaking spaces (case insensitive) and other annoying entities
    .replace(/&nbsp;/ig, ' ')
    .replace(/&rsquo;/ig, "'")
    .replace(/&lsquo;/ig, "'")
    .replace(/&ldquo;/ig, '"')
    .replace(/&rdquo;/ig, '"')
    .replace(/&ndash;/ig, '-')
    .replace(/&mdash;/ig, '-')
    // 4. Cleanup excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(text) {
  if (!text) return '';

  // 1. Nuclear Boilerplate Removal: Strip common corporate and recruitment intros
  let cleanText = text
    .replace(/(we are looking for|we are an equal opportunity|at [^,]+, we|our team is|our mission is|join our|about us|who we are|culture at)[\s\S]{0,150}(\.|\n)/ig, '')
    .replace(/^\s*(about this position|about the role|the role|position overview|job description|summary|overview)[\s:*_-]+/ig, '')
    .trim();

  // 2. Standard Sentence Extraction
  const sentences = cleanText.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length >= 2) {
    let summary = sentences[0].trim() + ' ' + sentences[1].trim();
    if (summary.length > 280) summary = sentences[0].trim();
    if (summary.length > 280) return summary.substring(0, 277) + '...';
    return summary;
  } else if (sentences && sentences.length === 1) {
    let summary = sentences[0].trim();
    if (summary.length > 280) return summary.substring(0, 277) + '...';
    return summary;
  }

  if (cleanText.length > 280) return cleanText.substring(0, 277) + '...';
  return cleanText.trim();
}

function guessSalary(content) {
  if (!content) return '';
  const text = content.replace(/&nbsp;/g, ' ').replace(/,/g, '');

  // Patterns: $100k - $120k, $100,000, 100,000 CAD, etc.
  const patterns = [
    /\$\d+k?\s?-\s?\$\d+k?/i,               // $80k - $100k
    /\$\d{4,6}/,                            // $80000
    /\d{4,6}\s?(CAD|USD|salary)/i,          // 80000 CAD
    /salary (range|is):?\s?\$\d+k?(\s?-\s?\$\d+k?)?/i // salary range: $80k
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[0].trim();
  }
  return '';
}

// ═══════════════════════════════════════════════
// MAIN SCRAPER
// ═══════════════════════════════════════════════
async function scrapeAll() {
  console.log('🍁 MapleDevs Job Scraper');
  console.log('========================\n');

  let allJobs = [];

  for (const studio of STUDIOS) {
    console.log(`📋 Scraping: ${studio.name} (${studio.platform})`);

    let jobs = [];
    switch (studio.platform) {
      case 'greenhouse':
        jobs = await scrapeGreenhouse(studio);
        break;
      case 'lever':
        jobs = await scrapeLever(studio);
        break;
      case 'smartrecruiters':
        jobs = await scrapeSmartRecruiters(studio);
        break;
      case 'ashby':
        jobs = await scrapeAshby(studio);
        break;
      case 'workday':
        jobs = await scrapeWorkday(studio);
        break;
      default:
        console.log(`  ⚠️ Unknown platform: ${studio.platform}`);
    }

    allJobs = allJobs.concat(jobs);
    console.log();

    // Rate limiting: be nice to their servers
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Total jobs scraped: ${allJobs.length}`);
  console.log(`   Studios processed: ${STUDIOS.length}`);
  console.log(`   Unique studios with jobs: ${new Set(allJobs.map(j => j.studio)).size}`);

  return filterDeadApplyLinks(allJobs);
}

// ═══════════════════════════════════════════════
// GOOGLE SHEETS INTEGRATION
// ═══════════════════════════════════════════════
// This section uses the Google Sheets API to:
// 1. Read existing jobs from the sheet
// 2. Add new jobs that don't exist yet
// 3. Remove jobs that are no longer on studio career pages
//
// REQUIRES: google-auth-library and googleapis npm packages
// Install with: npm install googleapis google-auth-library

const PIPELINE_SHEETS = {
  raw: 'jobs_raw',
  review: 'jobs_review',
  live: 'jobs_live',
};

const PIPELINE_RANGE = 'A:AZ';
const AUTO_APPROVE_SAFE_JOBS = process.env.AUTO_APPROVE_SAFE_JOBS !== 'false';
const AUTO_APPROVE_SCORE = Number(process.env.AUTO_APPROVE_SCORE || 80);
const JOB_MAX_AGE_DAYS = Number(process.env.JOB_MAX_AGE_DAYS || 90);
const STALE_BY_DATE_STATUS = 'stale_by_date';

const PIPELINE_HEADERS = [
  'job_id',
  'Job Title',
  'Studio Name',
  'Location',
  'Job Type',
  'Work Mode',
  'Description',
  'How to Apply',
  'Date Posted',
  '(Featured)',
  '(Student Friendly)',
  'Salary',
  'Engine',
  'Visa Sponsorship',
  'status',
  'link_status',
  'first_seen_at',
  'last_seen_at',
  'last_verified_at',
  'source_url',
  'source_id',
  'scraped_at',
  'notes',
  'date_reviewed',
  'tags',
  'review_score',
  'review_recommendation',
  'review_reason',
  'auto_reviewed_at',
];

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function simpleHash(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function makeJobId(job) {
  if (job.sourceId) return normalizeKey(job.sourceId);
  return `manual_${simpleHash(`${job.studio}|${job.title}|${job.location}|${job.applyUrl}`)}`;
}

function readCell(row, headers, names) {
  for (const name of names) {
    const index = headers.findIndex(h => normalizeKey(h) === normalizeKey(name));
    if (index !== -1) return row[index] || '';
  }
  return '';
}

function jobToRecord(job, now) {
  return {
    job_id: makeJobId(job),
    job_title: job.title || '',
    studio_name: job.studio || '',
    location: job.location || '',
    job_type: job.type || '',
    work_mode: job.mode || '',
    description: job.description || '',
    how_to_apply: job.applyUrl || '',
    date_posted: job.posted || '',
    featured: job.featured || 'No',
    student_friendly: job.student || 'No',
    salary: job.salary || '',
    engine: job.engine || '',
    visa_sponsorship: job.visa || '',
    status: 'new',
    link_status: 'active',
    first_seen_at: now,
    last_seen_at: now,
    last_verified_at: now,
    source_url: job.applyUrl || '',
    source_id: job.sourceId || '',
    scraped_at: now,
    notes: '',
    date_reviewed: '',
    tags: '',
  };
}

function rowToObject(row, headers) {
  const out = {};
  headers.forEach((header, index) => {
    out[normalizeKey(header)] = row[index] || '';
  });
  return out;
}

function objectToRow(record, headers) {
  const aliases = {
    title: 'job_title',
    studio: 'studio_name',
    apply_url: 'how_to_apply',
    source_url: 'how_to_apply',
    posted: 'date_posted',
    feature: 'featured',
    student: 'student_friendly',
    visa: 'visa_sponsorship',
  };
  return headers.map(header => {
    const key = normalizeKey(header);
    return record[key] || record[aliases[key]] || '';
  });
}

function isYes(value) {
  return ['yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());
}

function parseJobDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (match) {
    const iso = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T00:00:00Z`);
    if (!Number.isNaN(iso.getTime())) return iso;
  }

  return null;
}

function jobAgeDays(record, now) {
  const posted = parseJobDate(record.date_posted);
  if (!posted) return null;
  const reference = parseJobDate(now) || new Date();
  return Math.floor((reference.getTime() - posted.getTime()) / 86400000);
}

function isOutdatedRecord(record, now) {
  const age = jobAgeDays(record, now);
  return age !== null && age > JOB_MAX_AGE_DAYS;
}

function outdatedReason(record, now) {
  const age = jobAgeDays(record, now);
  if (age === null) return '';
  return `Outdated by date: posted ${age} days ago. Current limit is ${JOB_MAX_AGE_DAYS} days.`;
}

function markOutdated(record, now) {
  const reason = outdatedReason(record, now);
  return {
    ...record,
    status: 'expired',
    link_status: STALE_BY_DATE_STATUS,
    last_verified_at: now,
    notes: record.notes ? `${record.notes} | ${reason}` : reason,
    tags: mergeTags(record.tags, [STALE_BY_DATE_STATUS]),
  };
}

function mergeTags(existing, additions) {
  const tags = new Set(String(existing || '').split(',').map(t => t.trim()).filter(Boolean));
  additions.forEach(tag => tags.add(tag));
  return Array.from(tags).join(', ');
}

function hasOfficialSource(record) {
  const source = `${record.source_id || ''} ${record.job_id || ''}`;
  return /\b(gh|lv|sr|as|wd)_/i.test(source);
}

function hasRealApplyTarget(record) {
  const apply = String(record.how_to_apply || record.source_url || '').trim();
  return /^https?:\/\//i.test(apply) || /^mailto:/i.test(apply);
}

function isGeneralApplication(record) {
  const text = `${record.job_title || ''} ${record.description || ''}`.toLowerCase();
  return /general application|spontaneous application|candidature spontan|future opportunit|talent community|expression of interest/.test(text);
}

function isProbablyCanadian(record) {
  const location = String(record.location || '').toLowerCase();
  if (!location) return false;
  if (location === 'remote') return true;
  const canadaRegex = new RegExp(`\\b(${CANADA_KEYWORDS.join('|')})\\b`, 'i');
  return canadaRegex.test(location) || /\b(on|qc|bc|ab|sk|mb|ns|nb|pe|nl|yt|nt|nu)\b/i.test(location);
}

function triageReviewRecord(record, now) {
  const reasons = [];
  const blockers = [];
  const tags = [];
  let score = 0;

  if (hasOfficialSource(record)) { score += 25; tags.push('official_ats'); }
  else reasons.push('No official ATS source id');

  if (record.studio_name) score += 10;
  else blockers.push('Missing studio');

  if (record.job_title) score += 10;
  else blockers.push('Missing title');

  if (hasRealApplyTarget(record)) { score += 20; tags.push('apply_link'); }
  else blockers.push('Missing application link');

  if (isProbablyCanadian(record)) { score += 15; tags.push('canadian_location'); }
  else blockers.push('Location is not clearly Canadian');

  if (String(record.description || '').length >= 80) score += 10;
  else reasons.push('Short or missing description');

  if (record.salary) { score += 3; tags.push('salary_listed'); }
  if (record.engine) { score += 3; tags.push('engine_tagged'); }
  if (isYes(record.student_friendly)) { score += 2; tags.push('student_friendly'); }
  if (record.visa_sponsorship) { score += 2; tags.push('visa_signal'); }

  if (isGeneralApplication(record)) blockers.push('General application / talent pool');
  if (isOutdatedRecord(record, now)) blockers.push(outdatedReason(record, now));

  const linkStatus = normalizeKey(record.link_status);
  if (['expired', 'dead', 'missing_from_source', 'inactive', STALE_BY_DATE_STATUS].includes(linkStatus)) {
    blockers.push(`Link status is ${record.link_status}`);
  }

  const safeToAutoApprove = AUTO_APPROVE_SAFE_JOBS && blockers.length === 0 && score >= AUTO_APPROVE_SCORE;
  const reviewReason = blockers.length
    ? `Needs review: ${blockers.join('; ')}${reasons.length ? `. Notes: ${reasons.join('; ')}` : ''}`
    : reasons.length
      ? `Auto-check passed with notes: ${reasons.join('; ')}`
      : 'Auto-check passed: official source, Canadian location, and application link present';

  return {
    status: safeToAutoApprove ? 'approved' : 'needs_review',
    review_score: String(Math.min(100, score)),
    review_recommendation: safeToAutoApprove ? 'auto_approve' : 'manual_review',
    review_reason: reviewReason,
    auto_reviewed_at: safeToAutoApprove ? now : '',
    date_reviewed: safeToAutoApprove ? now : '',
    tags,
  };
}

function applyTriage(record, triage) {
  const next = {
    ...record,
    status: triage.status,
    review_score: triage.review_score,
    review_recommendation: triage.review_recommendation,
    review_reason: triage.review_reason,
    tags: mergeTags(record.tags, triage.tags.concat(triage.review_recommendation)),
  };

  if (!record.notes || /^Auto-(approved|triage)|^Needs review:/i.test(record.notes)) {
    next.notes = triage.review_reason;
  }
  if (triage.date_reviewed) next.date_reviewed = triage.date_reviewed;
  if (triage.auto_reviewed_at) next.auto_reviewed_at = triage.auto_reviewed_at;
  return next;
}

function mergeOwnerControlledFields(baseRecord, ownerRecord) {
  if (!ownerRecord) return baseRecord;
  const next = { ...baseRecord };
  for (const key of ['featured']) {
    if (ownerRecord[key]) next[key] = ownerRecord[key];
  }
  return next;
}

async function ensureSheet(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find(s => s.properties.title === title);
  if (existing) return existing.properties.sheetId;

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return created.data.replies[0].addSheet.properties.sheetId;
}

async function readPipelineSheet(sheets, spreadsheetId, title) {
  await ensureSheet(sheets, spreadsheetId, title);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!${PIPELINE_RANGE}`,
  });

  let rows = response.data.values || [];
  let headers = rows[0] || [];

  if (!headers.length) {
    headers = PIPELINE_HEADERS.slice();
    rows = [headers];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });
  }

  const missing = PIPELINE_HEADERS.filter(h => !headers.some(existing => normalizeKey(existing) === normalizeKey(h)));
  if (missing.length) {
    headers = headers.concat(missing);
    rows[0] = headers;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });
  }

  return { headers, rows: rows.slice(1) };
}

function buildRowIndex(rows, headers) {
  const index = new Map();
  rows.forEach((row, i) => {
    const jobId = readCell(row, headers, ['job_id']);
    if (jobId) index.set(jobId, { row, rowNumber: i + 2, object: rowToObject(row, headers) });
  });
  return index;
}

async function updatePipelineRow(sheets, spreadsheetId, sheetName, rowNumber, row) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] },
  });
  await new Promise(r => setTimeout(r, 1200)); // Delay to prevent 429 Too Many Requests (max 60 req/min)
}

async function appendPipelineRows(sheets, spreadsheetId, sheetName, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!${PIPELINE_RANGE}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: rows },
  });
  await new Promise(r => setTimeout(r, 1200)); // Delay to prevent 429 Too Many Requests (max 60 req/min)
}

async function updatePipelineSheets(sheets, sheetId, scrapedJobs) {
  const now = new Date().toISOString();
  const rawSheet = await readPipelineSheet(sheets, sheetId, PIPELINE_SHEETS.raw);
  const reviewSheet = await readPipelineSheet(sheets, sheetId, PIPELINE_SHEETS.review);
  const liveSheet = await readPipelineSheet(sheets, sheetId, PIPELINE_SHEETS.live);

  const rawIndex = buildRowIndex(rawSheet.rows, rawSheet.headers);
  const reviewIndex = buildRowIndex(reviewSheet.rows, reviewSheet.headers);
  const liveIndex = buildRowIndex(liveSheet.rows, liveSheet.headers);

  const records = [];
  const seenIds = new Set();
  for (const job of scrapedJobs) {
    const record = jobToRecord(job, now);
    if (seenIds.has(record.job_id)) continue;
    seenIds.add(record.job_id);
    records.push(record);
  }

  const scrapedIds = new Set(records.map(r => r.job_id));
  const rawRowsToAppend = [];
  const reviewRowsToAppend = [];
  const liveRowsToAppend = [];
  let rawUpdated = 0;
  let rawExpired = 0;
  let promoted = 0;
  let liveExpired = 0;
  let dateExpired = 0;
  let newAutoApproved = 0;
  let existingAutoApproved = 0;
  let reviewTriaged = 0;
  let liveDisabledByReview = 0;
  const disabledLiveIds = new Set();

  for (const record of records) {
    const recordForPipeline = isOutdatedRecord(record, now) ? markOutdated(record, now) : record;
    const existingRaw = rawIndex.get(record.job_id);
    if (existingRaw) {
      const rawRecord = recordForPipeline.link_status === STALE_BY_DATE_STATUS ? {
        ...existingRaw.object,
        ...recordForPipeline,
        first_seen_at: existingRaw.object.first_seen_at || recordForPipeline.first_seen_at,
      } : {
        ...existingRaw.object,
        ...recordForPipeline,
        status: existingRaw.object.status === 'expired' ? 'active' : (existingRaw.object.status || 'active'),
        first_seen_at: existingRaw.object.first_seen_at || recordForPipeline.first_seen_at,
      };
      await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.raw, existingRaw.rowNumber, objectToRow(rawRecord, rawSheet.headers));
      rawUpdated++;
    } else {
      rawRowsToAppend.push(objectToRow(recordForPipeline, rawSheet.headers));
    }

    if (!reviewIndex.has(record.job_id) && !liveIndex.has(record.job_id)) {
      const triage = triageReviewRecord(recordForPipeline, now);
      const reviewRecord = recordForPipeline.link_status === STALE_BY_DATE_STATUS
        ? recordForPipeline
        : applyTriage(recordForPipeline, triage);
      reviewRowsToAppend.push(objectToRow(reviewRecord, reviewSheet.headers));

      if (triage.status === 'approved') {
        liveRowsToAppend.push(objectToRow({
          ...reviewRecord,
          status: 'approved',
          link_status: 'active',
          first_seen_at: reviewRecord.first_seen_at || now,
          last_seen_at: now,
          last_verified_at: now,
        }, liveSheet.headers));
        newAutoApproved++;
        promoted++;
      }
      if (recordForPipeline.link_status === STALE_BY_DATE_STATUS) dateExpired++;
    }
  }

  await appendPipelineRows(sheets, sheetId, PIPELINE_SHEETS.raw, rawRowsToAppend);
  await appendPipelineRows(sheets, sheetId, PIPELINE_SHEETS.review, reviewRowsToAppend);
  await appendPipelineRows(sheets, sheetId, PIPELINE_SHEETS.live, liveRowsToAppend);

  for (const [jobId, existingRaw] of rawIndex.entries()) {
    if (scrapedIds.has(jobId)) continue;
    await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.raw, existingRaw.rowNumber, objectToRow({
      ...existingRaw.object,
      status: 'expired',
      link_status: 'missing_from_source',
      last_verified_at: now,
    }, rawSheet.headers));
    rawExpired++;
  }

  for (const [jobId, reviewEntry] of reviewIndex.entries()) {
    const status = normalizeKey(reviewEntry.object.status);
    if (!['', 'new', 'needs_review'].includes(status)) continue;

    const sourceRecord = records.find(r => r.job_id === jobId) || rawIndex.get(jobId)?.object || reviewEntry.object;
    const candidateRecord = {
      ...sourceRecord,
      ...reviewEntry.object,
      job_id: jobId,
    };
    const triage = triageReviewRecord(candidateRecord, now);
    const triagedRecord = isOutdatedRecord(candidateRecord, now)
      ? markOutdated(candidateRecord, now)
      : applyTriage(candidateRecord, triage);

    await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.review, reviewEntry.rowNumber, objectToRow(triagedRecord, reviewSheet.headers));
    reviewEntry.object = triagedRecord;
    reviewTriaged++;
    if (triage.status === 'approved') existingAutoApproved++;
    if (triagedRecord.link_status === STALE_BY_DATE_STATUS) dateExpired++;
  }

  for (const [jobId, reviewEntry] of reviewIndex.entries()) {
    const status = normalizeKey(reviewEntry.object.status);
    if (!['rejected', 'inactive', 'expired'].includes(status)) continue;
    const existingLive = liveIndex.get(jobId);
    if (!existingLive) continue;

    await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, existingLive.rowNumber, objectToRow({
      ...existingLive.object,
      status,
      link_status: reviewEntry.object.link_status || (status === 'rejected' ? 'inactive' : status),
      last_verified_at: now,
      notes: reviewEntry.object.notes || existingLive.object.notes || `Disabled from review: ${status}`,
    }, liveSheet.headers));
    disabledLiveIds.add(jobId);
    liveDisabledByReview++;
  }

  for (const [, reviewEntry] of reviewIndex.entries()) {
    if (normalizeKey(reviewEntry.object.status) !== 'approved') continue;
    const jobId = reviewEntry.object.job_id;
    const existingLive = liveIndex.get(jobId);
    if (!scrapedIds.has(jobId) && hasOfficialSource(reviewEntry.object)) {
      if (existingLive) {
        await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, existingLive.rowNumber, objectToRow({
          ...existingLive.object,
          status: 'expired',
          link_status: 'missing_from_source',
          last_verified_at: now,
          notes: existingLive.object.notes || 'Expired because the official source no longer returned this role.',
        }, liveSheet.headers));
        disabledLiveIds.add(jobId);
        liveExpired++;
      }
      continue;
    }

    const sourceRecord = records.find(r => r.job_id === jobId) || reviewEntry.object;
    const existingLiveRecord = liveIndex.get(jobId)?.object;
    const liveRecord = {
      ...mergeOwnerControlledFields(sourceRecord, existingLiveRecord),
      ...reviewEntry.object,
      status: 'approved',
      link_status: 'active',
      last_seen_at: scrapedIds.has(jobId) ? now : (reviewEntry.object.last_seen_at || now),
      last_verified_at: now,
    };
    if (isOutdatedRecord(liveRecord, now)) {
      if (existingLive) {
        await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, existingLive.rowNumber, objectToRow(markOutdated({
          ...existingLive.object,
          ...liveRecord,
          first_seen_at: existingLive.object.first_seen_at || liveRecord.first_seen_at,
        }, now), liveSheet.headers));
        disabledLiveIds.add(jobId);
        liveExpired++;
        dateExpired++;
      }
      continue;
    }
    if (existingLive) {
      await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, existingLive.rowNumber, objectToRow({
        ...existingLive.object,
        ...liveRecord,
        first_seen_at: existingLive.object.first_seen_at || liveRecord.first_seen_at,
      }, liveSheet.headers));
    } else {
      await appendPipelineRows(sheets, sheetId, PIPELINE_SHEETS.live, [objectToRow(liveRecord, liveSheet.headers)]);
    }
    promoted++;
  }

  for (const [jobId, liveEntry] of liveIndex.entries()) {
    if (scrapedIds.has(jobId)) continue;
    if (isYes(liveEntry.object.featured) && !hasOfficialSource(liveEntry.object)) continue;
    await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, liveEntry.rowNumber, objectToRow({
      ...liveEntry.object,
      status: 'expired',
      link_status: 'missing_from_source',
      last_verified_at: now,
    }, liveSheet.headers));
    disabledLiveIds.add(jobId);
    liveExpired++;
  }

  for (const [jobId, liveEntry] of liveIndex.entries()) {
    if (disabledLiveIds.has(jobId)) continue;
    if (!isOutdatedRecord(liveEntry.object, now)) continue;
    await updatePipelineRow(sheets, sheetId, PIPELINE_SHEETS.live, liveEntry.rowNumber, objectToRow(markOutdated(liveEntry.object, now), liveSheet.headers));
    liveExpired++;
    dateExpired++;
  }

  console.log(`   Scraped unique jobs: ${records.length}`);
  console.log(`   jobs_raw appended: ${rawRowsToAppend.length}`);
  console.log(`   jobs_raw updated: ${rawUpdated}`);
  console.log(`   jobs_raw expired: ${rawExpired}`);
  console.log(`   jobs_review new rows: ${reviewRowsToAppend.length}`);
  console.log(`   jobs_review auto-approved new rows: ${newAutoApproved}`);
  console.log(`   jobs_review existing rows triaged: ${reviewTriaged}`);
  console.log(`   jobs_review existing rows auto-approved: ${existingAutoApproved}`);
  console.log(`   jobs_live disabled by review decisions: ${liveDisabledByReview}`);
  console.log(`   jobs_live promoted/updated: ${promoted}`);
  console.log(`   jobs_live expired: ${liveExpired}`);
  console.log(`   jobs expired by date limit (${JOB_MAX_AGE_DAYS} days): ${dateExpired}`);
  console.log('\nGoogle Sheet pipeline updated successfully.');
}

async function updateGoogleSheet(scrapedJobs) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  // Use the same JSON credentials that work for Google Indexing
  const rawCreds = process.env.GOOGLE_INDEXING_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!sheetId) {
    console.log('\n⚠️  GOOGLE_SHEET_ID not set. Outputting to console instead.\n');
    console.log('Title,Studio,Location,Type,Mode,Description,Apply URL,Posted,Featured,Student,Salary,Engine,Visa');
    scrapedJobs.forEach(j => {
      console.log(`"${j.title}","${j.studio}","${j.location}","${j.type}","${j.mode}","${j.description.replace(/"/g, '""')}","${j.applyUrl}","${j.posted}","${j.featured}","${j.student}","${j.salary}","${j.engine}","${j.visa}"`);
    });
    return;
  }

  if (!rawCreds) {
    console.log('\n⚠️  No credentials found. Set GOOGLE_INDEXING_KEY to the full service account JSON.');
    return;
  }

  try {
    const { google } = require('googleapis');

    // Parse credentials from the secret (supports full JSON or base64-encoded JSON)
    let credentials;
    try {
      credentials = JSON.parse(rawCreds.trim());
    } catch (e) {
      try {
        credentials = JSON.parse(Buffer.from(rawCreds.trim(), 'base64').toString('utf-8'));
      } catch (e2) {
        const privateKey = rawCreds.includes('BEGIN PRIVATE KEY')
          ? rawCreds.replace(/\\n/g, '\n')
          : Buffer.from(rawCreds.trim(), 'base64').toString('utf-8');
        credentials = {
          client_email: clientEmail,
          private_key: privateKey,
        };
      }
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('JSON is missing client_email or private_key fields.');
    }

    console.log(`\n🔑 Using service account: ${credentials.client_email}`);

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    await updatePipelineSheets(sheets, sheetId, scrapedJobs);
    return;
    const range = 'Sheet1!A:M';


    // Read existing data
    console.log('\n📖 Reading existing sheet data...');
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const rows = existing.data.values || [];
    const existingJobs = new Set();

    // Build a set of existing job identifiers (title + studio)
    for (let i = 1; i < rows.length; i++) {
      const key = (rows[i][0] + '|' + rows[i][1]).toLowerCase();
      existingJobs.add(key);
    }

    // Find new jobs to add
    const newJobs = scrapedJobs.filter(j => {
      const key = (j.title + '|' + j.studio).toLowerCase();
      return !existingJobs.has(key);
    });

    // Find jobs to remove (in sheet but not in scraped data OR from unknown studios)
    const scrapedKeys = new Set(scrapedJobs.map(j => (j.title + '|' + j.studio).toLowerCase()));
    const studioNames = new Set(STUDIOS.map(s => s.name.toLowerCase()));

    // Whitelist check: we ONLY keep jobs from studios in our STUDIOS array.
    // This purges "ghost" or corrupted rows with invalid studio names (like "BC").
    const rowsToRemove = [];

    for (let i = rows.length - 1; i >= 1; i--) {
      const rowStudio = (rows[i][1] || '').trim();
      const rowTitle = (rows[i][0] || '').trim();
      const rowStudioLower = rowStudio.toLowerCase();
      const key = (rowTitle + '|' + rowStudio).toLowerCase();

      const isWhitelistedStudio = studioNames.has(rowStudioLower);
      const isStillActive = scrapedKeys.has(key);

      // Remove if:
      // 1. It's not a studio we know about (Whitelisted Studio Check)
      // 2. OR it's a known studio but the job is gone from their site
      if (!isWhitelistedStudio || !isStillActive) {
        rowsToRemove.push(i + 1); // 1-indexed for Sheets API
      }
    }

    console.log(`   Existing jobs: ${rows.length - 1}`);
    console.log(`   New jobs to add: ${newJobs.length}`);
    console.log(`   Expired jobs to remove: ${rowsToRemove.length}`);

    // Remove expired jobs (delete rows from bottom to top)
    if (rowsToRemove.length > 0) {
      console.log('\n🗑️  Removing expired jobs...');
      for (const rowIdx of rowsToRemove) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: rowIdx - 1,
                  endIndex: rowIdx,
                },
              },
            }],
          },
        });
      }
      console.log(`   ✅ Removed ${rowsToRemove.length} expired jobs`);
    }

    // Add new jobs
    if (newJobs.length > 0) {
      console.log('\n➕ Adding new jobs...');
      const newRows = newJobs.map(j => [
        j.title, j.studio, j.location, j.type, j.mode,
        j.description, j.applyUrl, j.posted, j.featured, j.student, j.salary,
        j.engine, j.visa
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A:M',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows },
      });
      console.log(`   ✅ Added ${newJobs.length} new jobs`);
    }

    console.log('\n🎉 Google Sheet updated successfully!');

  } catch (err) {
    console.error('\n❌ Error updating Google Sheet:', err.message);
    console.log('\nMake sure you have installed: npm install googleapis google-auth-library');
  }
}

// ═══════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════
(async () => {
  try {
    const jobs = await scrapeAll();
    await updateGoogleSheet(jobs);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
