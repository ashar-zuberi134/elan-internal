// Netlify function — LinkedIn follower counts.
//
// Two reasons this exists rather than the browser calling RapidAPI directly:
//   1. the previous build shipped RAPIDAPI_KEY in app.js, in a public repo
//   2. it cached per-browser in localStorage, so every teammate's first visit
//      each day burned a separate set of RapidAPI credits
//
// Now the key stays server-side and the result is cached for the whole team
// in metrics_snapshots, one row per target per day.
//
// Env vars: RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const RAPID_HOST = 'fresh-linkedin-profile-data.p.rapidapi.com';

const TARGETS = {
  company: { source: 'linkedin_company', key: 'elan-advisors',
             url: 'https://www.linkedin.com/company/elan-advisors/', kind: 'company' },
  yash:    { source: 'linkedin_person',  key: 'yash',
             url: 'https://www.linkedin.com/in/yash-agrawal-6495a3149/', kind: 'person' },
  rohit:   { source: 'linkedin_person',  key: 'rohit',
             url: 'https://www.linkedin.com/in/rohit-maini-a96b4b69/', kind: 'person' },
  ashar:   { source: 'linkedin_person',  key: 'ashar',
             url: 'https://www.linkedin.com/in/ashar-zuberi-a0845a19b/', kind: 'person' },
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const today = () => new Date().toISOString().slice(0, 10);

async function readCache() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/metrics_snapshots` +
    `?source=in.(linkedin_company,linkedin_person)&captured_on=eq.${today()}` +
    `&select=source,metric_key,value,captured_on`,
    { headers: SB });
  return res.ok ? res.json() : [];
}

async function writeCache(rows) {
  if (!rows.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/metrics_snapshots?on_conflict=source,metric_key,captured_on`, {
    method: 'POST',
    headers: { ...SB, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function fetchFollowers(target, apiKey) {
  const headers = { 'x-rapidapi-host': RAPID_HOST, 'x-rapidapi-key': apiKey };
  const url = target.kind === 'company'
    ? `https://${RAPID_HOST}/get-company-by-linkedinurl?linkedin_url=${encodeURIComponent(target.url)}`
    : `https://${RAPID_HOST}/enrich-lead?linkedin_url=${encodeURIComponent(target.url)}` +
      '&include_skills=false&include_certifications=false' +
      '&include_profile_status=false&include_company_public_url=false';

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  const json = await res.json();
  const value = json?.data?.follower_count ?? json?.follower_count ?? null;
  if (value === null || value === undefined) throw new Error('no follower_count in response');
  return Number(value);
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers,
             body: JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set' }) };
  }

  const cached = await readCache();
  const have   = new Map(cached.map(r => [`${r.source}:${r.metric_key}`, r]));

  const missing = Object.entries(TARGETS)
    .filter(([, t]) => !have.has(`${t.source}:${t.key}`));

  if (missing.length) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'RAPIDAPI_KEY not set' }) };
    }

    const fresh = [];
    await Promise.all(missing.map(async ([, t]) => {
      try {
        const value = await fetchFollowers(t, apiKey);
        const row = { source: t.source, metric_key: t.key, value,
                      captured_on: today(), payload: { url: t.url } };
        fresh.push(row);
        have.set(`${t.source}:${t.key}`, row);
      } catch (err) {
        // One dead profile shouldn't blank the whole tab.
        console.error(`LinkedIn fetch failed for ${t.key}:`, err.message);
      }
    }));
    await writeCache(fresh);
  }

  const result = Object.fromEntries(
    Object.entries(TARGETS).map(([name, t]) => {
      const row = have.get(`${t.source}:${t.key}`);
      return [name, row ? { value: Number(row.value), date: row.captured_on } : { value: null, date: null }];
    })
  );

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
