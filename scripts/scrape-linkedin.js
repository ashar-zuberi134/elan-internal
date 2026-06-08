const fs    = require('fs');
const path  = require('path');
const https = require('https');

const RAPIDAPI_KEY = '258df5cc98mshcdc31725b41d656p184f11jsna354edbf6ed6';
const KPI_FILE     = path.join(__dirname, '..', 'kpi.json');

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', err => reject(err));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

async function run() {
  console.log('Fetching LinkedIn company data...');

  const { status, body } = await get(
    'https://fresh-linkedin-profile-data.p.rapidapi.com/get-company-by-linkedinurl' +
    '?linkedin_url=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Felan-advisors%2F',
    {
      'Content-Type':   'application/json',
      'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
      'x-rapidapi-key':  RAPIDAPI_KEY,
    }
  );

  console.log(`RapidAPI response status: ${status}`);
  if (status !== 200) throw new Error(`RapidAPI error ${status}: ${body}`);

  const { data } = JSON.parse(body);
  const followers = data?.follower_count;
  if (followers == null) throw new Error('follower_count missing from API response');

  const today = new Date().toISOString().slice(0, 10);
  const kpi   = { linkedin: { value: followers, date: today } };

  fs.writeFileSync(KPI_FILE, JSON.stringify(kpi, null, 2) + '\n');
  console.log(`Done — ${followers} followers written for ${today}`);
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
