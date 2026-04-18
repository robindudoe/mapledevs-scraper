/**
 * SCRATCH SCRIPT: Verify normalizeLocation fix
 * Run with: node scratch/test-location.js
 */

const CANADA_KEYWORDS = [
  'canada', 'canadian', 'toronto', 'montreal', 'vancouver', 'ottawa', 'calgary', 'edmonton', 
  'winnipeg', 'quebec', 'ontario', 'bc', 'ab', 'on', 'qc', 'ns', 'nb', 'sk', 'mb',
  'halifax', 'victoria', 'london', 'hamilton', 'kitchener', 'waterloo', 'saskatoon', 'regina',
  'burnaby', 'richmond', 'surrey', 'oakville', 'brampton', 'mississauga', 'kelowna'
];

function normalizeLocation(raw, studioCity = '', filter = null) {
  if (!raw || raw.toLowerCase().includes('blank')) return studioCity || 'Canada';

  const sLowerRaw = raw.toLowerCase().replace(/[\W_]+/g, ' ').trim(); // Clean for matching
  
  const CANADA_KW_REGEX = new RegExp(`\\b(${CANADA_KEYWORDS.join('|')})\\b`, 'i');
  const PROV_CODE_REGEX = /\b(on|qc|bc|ab|sk|mb|ns|nb|pe|nl|yt|nt|nu)\b/i;
  
  const hasCanadaKeyword = CANADA_KW_REGEX.test(sLowerRaw);
  const hasProvCode = PROV_CODE_REGEX.test(sLowerRaw);

  const globalNoise = /\b(france|paris|germany|berlin|india|bangalore|japan|tokyo|spain|madrid|barcelona|brazil|mexico|australia|uk|england|usa|united states|america|washington|bellevue|redmond|austin|texas|california|san francisco|london england)\b/i;
  
  if (globalNoise.test(sLowerRaw)) {
    if (sLowerRaw.includes('london') && (sLowerRaw.includes('ontario') || sLowerRaw.includes(' on '))) {
      // Keep going
    } else {
      return null;
    }
  }

  const isStrictlyCanada = hasCanadaKeyword || hasProvCode;
  const isExplicitlyRemote = /\b(remote|anywhere|work from home|wfh)\b/i.test(sLowerRaw);

  if (filter && filter.toLowerCase().includes('canada')) {
    if (!isStrictlyCanada && !isExplicitlyRemote) return null; 
    if (isExplicitlyRemote && !isStrictlyCanada) {
      const studioIsCanada = CANADA_KW_REGEX.test(studioCity) || PROV_CODE_REGEX.test(studioCity) || studioCity.toLowerCase().includes('canada');
      if (!studioIsCanada) return null;
    }
  }

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

  return bestLoc ? bestLoc : (isStrictlyCanada ? raw : null);
}

// TEST CASES
const tests = [
  { raw: "Lyon, Auvergne-Rhône", studioCity: "Montreal, QC", filter: "Canada", expected: null },
  { raw: "Bellevue, Washington", studioCity: "Vancouver, BC", filter: "Canada", expected: null },
  { raw: "Montpellier, Occitanie", studioCity: "Montreal, QC", filter: "Canada", expected: null },
  { raw: "Montreal, QC", studioCity: "Montreal, QC", filter: "Canada", expected: "Montreal, QC" },
  { raw: "Toronto, Ontario, Canada", studioCity: "Toronto, ON", filter: "Canada", expected: "Toronto, Ontario, Canada" },
  { raw: "London, ON", studioCity: "London, ON", filter: "Canada", expected: "London, ON" },
  { raw: "London, England", studioCity: "London, ON", filter: "Canada", expected: null },
  { raw: "Remote", studioCity: "Vancouver, BC", filter: "Canada", expected: "Remote" },
  { raw: "Remote", studioCity: "Los Angeles, CA", filter: "Canada", expected: null }, // Remote but US studio
];

console.log("🧪 Running Location Normalization Tests...\n");
let passed = 0;
tests.forEach((t, i) => {
  const result = normalizeLocation(t.raw, t.studioCity, t.filter);
  const status = (result === t.expected || (result && t.expected && result.toLowerCase() === t.expected.toLowerCase())) ? "✅ PASS" : "❌ FAIL";
  console.log(`Test ${i + 1}: Input: "${t.raw}" | Expected: ${t.expected} | Result: ${result} | ${status}`);
  if (status.includes("PASS")) passed++;
});

console.log(`\n📊 Results: ${passed}/${tests.length} passed.`);
if (passed !== tests.length) process.exit(1);
