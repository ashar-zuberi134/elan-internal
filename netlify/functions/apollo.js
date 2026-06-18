// Netlify function — proxies Apollo.io People Match API
// Env var: APOLLO_API_KEY

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { first_name, last_name, organization_name } = JSON.parse(event.body || '{}');
    if (!first_name || !last_name || !organization_name) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'first_name, last_name and organization_name are required' }) };
    }

    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'APOLLO_API_KEY env var not set' }) };
    }

    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        first_name,
        last_name,
        organization_name,
        reveal_personal_emails: true,
      }),
    });

    const data = await res.json();
    const p = data.person;

    if (!p) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ found: false }) };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        found:        true,
        name:         `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        email:        p.email ?? null,
        email_status: p.email_status ?? null,          // verified / likely / guessed
        title:        p.title ?? null,
        linkedin:     p.linkedin_url ?? null,
        location:     p.formatted_address ?? null,
        org_phone:    p.organization?.primary_phone?.number ?? null,  // switchboard, not direct dial
        company:      p.organization?.name ?? organization_name,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
