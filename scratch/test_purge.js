const STUDIOS = [
  { name: "Digital Extremes" },
  { name: "Behaviour Interactive" },
  { name: "Blackbird Interactive" }
];

const studioNames = new Set(STUDIOS.map(s => s.name.toLowerCase()));

// Mock existing rows in Google Sheet
const rows = [
  ["Title", "Studio", "Location"], // Header
  ["Senior Gameplay Engineer", "Blackbird Interactive", "Vancouver, BC"], // Valid
  ["Location: Vancouver", "BC", "Canada (Remote within Canada OK)"], // CORRUPTED GHOST ROW
  ["Art Director", "Digital Extremes", "London, ON"], // Valid
  ["Some Old Job", "Unknown Studio", "Toronto, ON"] // INVALID STUDIO
];

const scrapedJobs = [
  { title: "Senior Gameplay Engineer", studio: "Blackbird Interactive" },
  { title: "Art Director", studio: "Digital Extremes" }
];

const scrapedKeys = new Set(scrapedJobs.map(j => (j.title + '|' + j.studio).toLowerCase()));

const rowsToRemove = [];

console.log("Starting Whitelisted Purge Test...");

for (let i = rows.length - 1; i >= 1; i--) {
  const rowStudio = (rows[i][1] || '').trim();
  const rowTitle = (rows[i][0] || '').trim();
  const rowStudioLower = rowStudio.toLowerCase();
  const key = (rowTitle + '|' + rowStudio).toLowerCase();

  const isWhitelistedStudio = studioNames.has(rowStudioLower);
  const isStillActive = scrapedKeys.has(key);

  console.log(`Checking Row ${i+1}: "${rowTitle}" at "${rowStudio}"`);
  console.log(` - Whitelisted: ${isWhitelistedStudio}, Still Active: ${isStillActive}`);

  if (!isWhitelistedStudio || !isStillActive) {
    console.log(` ❌ REMOVING Row ${i+1}`);
    rowsToRemove.push(i + 1);
  } else {
    console.log(` ✅ KEEPING Row ${i+1}`);
  }
}

console.log("\nSummary:");
console.log(`Rows to remove: ${rowsToRemove.join(', ')}`);
if (rowsToRemove.includes(3)) {
    console.log("✅ SUCCESS: The corrupted 'BC' row was identified for removal.");
} else {
    console.log("❌ FAILURE: The corrupted 'BC' row was missed.");
}
