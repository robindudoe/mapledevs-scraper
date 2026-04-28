const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT_DIR = process.cwd();
const PAYLOAD_PATH = path.join(ROOT_DIR, 'indexnow-urls.json');
const DRY_RUN = process.argv.includes('--dry-run');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function postJSON(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  if (!fs.existsSync(PAYLOAD_PATH)) {
    console.log('indexnow-urls.json not found. Run node build-seo.js first.');
    return;
  }

  const payload = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
  payload.urlList = (payload.urlList || []).slice(0, 10000);

  if (!payload.host || !payload.key || !payload.keyLocation || !payload.urlList.length) {
    console.log('IndexNow payload is incomplete. Skipping.');
    return;
  }

  if (DRY_RUN) {
    console.log(`IndexNow dry run: ${payload.urlList.length} URLs ready for ${payload.host}.`);
    console.log(`Key location: ${payload.keyLocation}`);
    return;
  }

  const response = await postJSON(ENDPOINT, payload);
  console.log(`IndexNow response: HTTP ${response.statusCode}`);
  if (response.body) console.log(response.body);
}

run().catch((err) => {
  console.error('IndexNow submit failed:', err.message);
  process.exit(1);
});
