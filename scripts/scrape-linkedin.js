const fs = require('fs');
const path = require('path');

const RAPIDAPI_KEY = '258df5cc98mshcdc31725b41d656p184f11jsna354edbf6ed6';
const KPI_FILE = path.join(__dirname, '..', 'kpi.json');

async function run() {
  const res = await fetch(
    'https://fresh-linkedin-profile-data.p.rapidapi.com/get-company-by-linkedinurl' +
    '?linkedin_url=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Felan-advisors%2F',
    {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    }
  );

  if (!res.ok) throw new Error(`RapidAPI error ${res.status}: ${await res.text()}`);

  const { data } = await res.json();
  const followers = data?.follower_count;
  if (followers == null) throw new Error('follower_count missing from API response');

  const today = new Date().toISOString().slice(0, 10);
  const kpi = { linkedin: { value: followers, date: today } };

  fs.writeFileSync(KPI_FILE, JSON.stringify(kpi, null, 2) + '\n');
  console.log(`Written ${followers} followers (${today}) to kpi.json`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
