// Netlify serverless function — proxies GA4 Data API using a service account.
// Requires env var: GA_SERVICE_ACCOUNT (the full JSON key file contents as a string)

const crypto = require('crypto');

const GA4_PROPERTY_ID = '540549544';

async function getAccessToken(sa) {
  const now    = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  const { access_token, error } = await res.json();
  if (error) throw new Error(`Token error: ${error}`);
  return access_token;
}

async function runReport(token, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  return res.json();
}

exports.handler = async () => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const sa    = JSON.parse(process.env.GA_SERVICE_ACCOUNT);
    const token = await getAccessToken(sa);

    // Run all four reports in parallel
    const [summary, daily, sources, pages, countries, weekly] = await Promise.all([

      // 1. Summary — sessions, users, engagement rate (last 30 days)
      runReport(token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'engagementRate' },
          { name: 'bounceRate' },
          { name: 'newUsers' },
        ],
      }),

      // 2. Daily users for chart (last 30 days)
      runReport(token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics:    [{ name: 'activeUsers' }],
        orderBys:   [{ dimension: { dimensionName: 'date' } }],
      }),

      // 3. Traffic sources
      runReport(token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics:    [{ name: 'sessions' }],
        orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6,
      }),

      // 4. Top pages
      runReport(token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics:    [{ name: 'screenPageViews' }],
        orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
      }),

      // 5. Users by country
      runReport(token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics:    [{ name: 'activeUsers' }],
        orderBys:   [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      }),

      // 6. Weekly users for 3-month chart
      runReport(token, {
        dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'isoWeek' }, { name: 'isoYear' }],
        metrics:    [{ name: 'activeUsers' }],
        orderBys:   [{ dimension: { dimensionName: 'isoYear' } }, { dimension: { dimensionName: 'isoWeek' } }],
      }),
    ]);

    // Parse summary row
    const s = summary.rows?.[0]?.metricValues ?? [];
    const summaryData = {
      sessions:       parseInt(s[0]?.value ?? 0),
      users:          parseInt(s[1]?.value ?? 0),
      engagementRate: parseFloat(s[2]?.value ?? 0),
      bounceRate:     parseFloat(s[3]?.value ?? 0),
      newUsers:       parseInt(s[4]?.value ?? 0),
    };

    // Parse daily users
    const dailyData = (daily.rows ?? []).map(row => ({
      date:  row.dimensionValues[0].value, // YYYYMMDD
      users: parseInt(row.metricValues[0].value),
    }));

    // Parse sources
    const sourcesData = (sources.rows ?? []).map(row => ({
      channel:  row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value),
    }));

    // Parse top pages
    const pagesData = (pages.rows ?? []).map(row => ({
      path:  row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value),
    }));

    // Parse countries
    const countriesData = (countries.rows ?? []).map(row => ({
      country: row.dimensionValues[0].value,
      users:   parseInt(row.metricValues[0].value),
    }));

    // Parse weekly (isoWeek + isoYear → label like "W23 '25")
    const weeklyData = (weekly.rows ?? []).map(row => ({
      week:  row.dimensionValues[0].value,
      year:  row.dimensionValues[1].value,
      users: parseInt(row.metricValues[0].value),
    }));

    return {
      statusCode: 200,
      headers:    cors,
      body: JSON.stringify({ summary: summaryData, daily: dailyData, sources: sourcesData, pages: pagesData, countries: countriesData, weekly: weeklyData }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    cors,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
