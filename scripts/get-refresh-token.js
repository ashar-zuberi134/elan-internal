// Run this ONCE locally to get your Microsoft refresh token.
// Usage: node scripts/get-refresh-token.js
//
// Set these three values before running:
const TENANT_ID     = 'PASTE_YOUR_TENANT_ID_HERE';
const CLIENT_ID     = 'PASTE_YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = 'PASTE_YOUR_CLIENT_SECRET_HERE';

const http     = require('http');
const { exec } = require('child_process');

const REDIRECT = 'http://localhost:3000/callback';
const SCOPE    = 'https://graph.microsoft.com/Mail.Read offline_access';

const authUrl =
  `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&prompt=consent`;

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) return;

  const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
  if (!code) { res.end('No code'); return; }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT,
        scope:         SCOPE,
      }),
    }
  );

  const data = await tokenRes.json();

  if (data.error) {
    res.end(`Error: ${data.error_description}`);
    console.error(data);
    server.close();
    return;
  }

  res.end('<h2>Done! Check your terminal for the refresh token.</h2><p>You can close this window.</p>');
  server.close();

  console.log('\n✅ Success! Add these to your Netlify environment variables:\n');
  console.log(`MS_TENANT_ID=${TENANT_ID}`);
  console.log(`MS_CLIENT_ID=${CLIENT_ID}`);
  console.log(`MS_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`MS_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('\nAlso add: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY\n');
});

server.listen(3000, () => {
  console.log('Opening browser for Microsoft login...');
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${open} "${authUrl}"`);
  console.log('If browser does not open, visit:\n', authUrl);
});
