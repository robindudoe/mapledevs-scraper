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

const https = require('https');

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
  {
    name: "Blackbird Interactive",
    platform: "greenhouse",
    token: "blackbirdinteractive",
    city: "Vancouver, BC",
    locationFilter: "Canada"
  }
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

  const sLowerRaw = raw.toLowerCase().replace(/[\W_]+/g, ' ').trim(); // Clean for matching
  
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
        const cleanLoc = normalizeLocation(job.location?.name || '', studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: job.title || '',
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
        const cleanLoc = normalizeLocation(job.categories?.location || '', studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: job.text || '',
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
async function scrapeSmartRecruiters(studio) {
  const url = `https://api.smartrecruiters.com/v1/companies/${studio.token}/postings`;
  console.log(`  📡 Fetching: ${url}`);

  try {
    const data = await httpGet(url);
    const jobs = data.content || [];
    console.log(`  ✅ Found ${jobs.length} jobs at ${studio.name}`);

    return jobs
      .map(job => {
        const rawLoc = `${job.location?.city || ''}, ${job.location?.region || ''}`.trim().replace(/^,|,$/g, '');
        const cleanLoc = normalizeLocation(rawLoc, studio.city, studio.locationFilter);
        if (!cleanLoc) return null;

        return {
          title: job.name || '',
          studio: studio.name,
          location: cleanLoc,
          type: guessJobType(job.name, ''),
          mode: guessWorkMode(job.name, cleanLoc, ''),
          description: `Department: ${job.department?.label || 'General'}. Experience Level: ${job.experienceLevel?.label || 'N/A'}.`,
          applyUrl: `https://jobs.smartrecruiters.com/${studio.token}/${job.id}`,
          posted: job.releasedDate ? new Date(job.releasedDate).toISOString().split('T')[0] : '',
          featured: "No",
          student: guessStudentFriendly(job.name, '') ? 'Yes' : 'No',
          salary: guessSalary(job.name), // SmartRecruiters often lacks desc in list
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
          title: job.title || '',
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
                title: job.title || '',
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
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('intern') || text.includes('co-op') || text.includes('coop')) return 'Internship';
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
  const text = (title + ' ' + content).toLowerCase();
  return text.includes('intern') || text.includes('co-op') || text.includes('coop')
    || text.includes('junior') || text.includes('entry level') || text.includes('entry-level')
    || text.includes('new grad') || text.includes('graduate');
}

function guessEngine(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('unreal') || text.includes('ue4') || text.includes('ue5')) return 'Unreal';
  if (text.includes('unity')) return 'Unity';
  if (text.includes('godot')) return 'Godot';
  if (text.includes('c++') || text.includes('engine programmer')) return 'C++ / Proprietary';
  return '';
}

function guessVisaSponsorship(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  const keywords = ['relocation', 'sponsorship', 'visa', 'lmia', 'pnp', 'work permit', 'temporary foreign worker', 'tfwp'];
  for (const kw of keywords) {
    if (text.includes(kw)) return 'Yes';
  }
  return 'No';
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

  return allJobs;
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

async function updateGoogleSheet(scrapedJobs) {
  // Check if we have the required env vars
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !clientEmail || !privateKeyB64) {
    console.log('\n⚠️  Google Sheets env vars not set. Outputting to console instead.\n');
    console.log('To enable Google Sheets sync, set these environment variables:');
    console.log('  GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY\n');
    console.log('Scraped jobs (CSV format):\n');
    console.log('Title,Studio,Location,Type,Mode,Description,Apply URL,Posted,Featured,Student,Salary,Engine,Visa');
    scrapedJobs.forEach(j => {
      console.log(`"${j.title}","${j.studio}","${j.location}","${j.type}","${j.mode}","${j.description.replace(/"/g, '""')}","${j.applyUrl}","${j.posted}","${j.featured}","${j.student}","${j.salary}","${j.engine}","${j.visa}"`);
    });
    return;
  }

  try {
    const { google } = require('googleapis');
    
    // Parse private key from whatever format was stored in the secret
    function parsePrivateKey(raw) {
      if (!raw) return null;
      let str = raw.trim();

      // Case 1: Full JSON (user pasted the whole service account file)
      try {
        const obj = JSON.parse(str);
        if (obj.private_key) return obj.private_key.replace(/\\n/g, '\n');
      } catch (e) { /* not JSON */ }

      // Case 2: Base64-encoded JSON
      try {
        const decoded = Buffer.from(str, 'base64').toString('utf-8');
        const obj = JSON.parse(decoded);
        if (obj.private_key) return obj.private_key.replace(/\\n/g, '\n');
      } catch (e) { /* not base64 JSON */ }

      // Case 3: Raw PEM string (possibly with escaped newlines)
      let key = str.replace(/\\n/g, '\n');
      if (!key.includes('-----BEGIN')) {
        try {
          const decoded = Buffer.from(key.replace(/\s+/g, ''), 'base64').toString('utf-8');
          if (decoded.includes('-----BEGIN')) key = decoded;
        } catch (e) { /* not base64 PEM */ }
      }

      return key;
    }

    const privateKey = parsePrivateKey(privateKeyB64);
    if (!privateKey) throw new Error('Could not parse private key from GOOGLE_PRIVATE_KEY.');

    const auth = new google.auth.JWT(clientEmail, null, privateKey, [
      'https://www.googleapis.com/auth/spreadsheets',
    ]);

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Sheet1!A:M'; // Expanded to A:M

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

    // Find jobs to remove (in sheet but not in scraped data)
    const scrapedKeys = new Set(scrapedJobs.map(j => (j.title + '|' + j.studio).toLowerCase()));
    const studioNames = new Set(STUDIOS.map(s => s.name.toLowerCase()));
    const rowsToRemove = [];

    for (let i = rows.length - 1; i >= 1; i--) {
      const studio = (rows[i][1] || '').toLowerCase();
      const key = (rows[i][0] + '|' + rows[i][1]).toLowerCase();
      // Only remove jobs from studios we actively scrape
      if (studioNames.has(studio) && !scrapedKeys.has(key)) {
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
