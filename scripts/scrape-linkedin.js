const RAPIDAPI_KEY = '258df5cc98mshcdc31725b41d656p184f11jsna354edbf6ed6';
const SUPABASE_URL = 'https://crktlztfsyqbwnguqqjl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNya3RsenRmc3lxYnduZ3VxcWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDI4NjYsImV4cCI6MjA5MzQ3ODg2Nn0.IGpfgsGw0NNadnfm8kA-yY6b3wW-9q5o0PRA8CI1LS4';

async function run() {
  // 1. Fetch follower count from RapidAPI
  const liRes = await fetch(
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
  if (!liRes.ok) throw new Error(`RapidAPI error ${liRes.status}: ${await liRes.text()}`);

  const { data } = await liRes.json();
  const followers = data?.follower_count;
  if (followers == null) throw new Error('follower_count missing from API response');
  console.log(`Followers: ${followers}`);

  // 2. Fetch current Supabase row so we only overwrite the linkedin KPI
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/mandala?id=eq.1&select=data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows  = await getRes.json();
  const state = rows?.[0]?.data ?? {};

  // 3. Update only __kpi_linkedin
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  state.__kpi_linkedin = { value: followers, date: today };

  // 4. Upsert back
  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/mandala`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: 1, data: state }),
  });

  if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
    throw new Error(`Supabase write failed: ${await putRes.text()}`);
  }

  console.log(`Done — ${followers} followers written for ${today}`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
