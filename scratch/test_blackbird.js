const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

async function test() {
  console.log("Checking Blackbird Greenhouse...");
  try {
    const gh = await httpGet('https://boards-api.greenhouse.io/v1/boards/blackbirdinteractive/jobs?content=true');
    console.log(`GH Jobs: ${gh.jobs?.length}`);
    if (gh.jobs) {
      gh.jobs.slice(0, 5).forEach(j => console.log(` - ${j.title} | ${j.location?.name}`));
    }
  } catch (e) { console.error(e.message); }

  console.log("\nChecking Blackbird Lever...");
  try {
    const lv = await httpGet('https://api.lever.co/v0/postings/blackbirdinteractive?mode=json');
    console.log(`LV Jobs: ${lv.length}`);
    lv.slice(0, 5).forEach(j => console.log(` - ${j.text} | ${j.categories?.location}`));
  } catch (e) { console.error(e.message); }
}

test();
