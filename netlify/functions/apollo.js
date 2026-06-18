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
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({
        api_key: apiKey,
        first_name,
        last_name,
        organization_name,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      }),
    });

    const data = await res.json();
    const p = data.person;

    if (!p) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ found: false }) };
    }

    const phone = p.phone_numbers?.find(n => n.sanitized_number)?.sanitized_number
                ?? p.sanitized_phone
                ?? null;

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        found: true,
        name:     `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        email:    p.email ?? null,
        phone:    phone,
        linkedin: p.linkedin_url ?? null,
        title:    p.title ?? null,
        company:  p.organization?.name ?? organization_name,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
