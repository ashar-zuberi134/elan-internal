// Netlify scheduled function — runs every 30 minutes.
// Reads new Outlook emails, analyses with Claude, updates Supabase CRM.
//
// Required env vars (set in Netlify dashboard):
//   MS_TENANT_ID       — Azure Directory (tenant) ID
//   MS_CLIENT_ID       — Azure Application (client) ID
//   MS_CLIENT_SECRET   — Azure client secret value
//   MS_REFRESH_TOKEN   — stored refresh token (updated in-place after each run)
//   ANTHROPIC_API_KEY  — Claude API key
//   SUPABASE_URL       — https://sofzlqjszuskvwlkxvhr.supabase.co
//   SUPABASE_KEY       — Supabase anon key

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sofzlqjszuskvwlkxvhr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// ── Microsoft Graph auth ───────────────────────────────────────────────────────

async function refreshAccessToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        refresh_token: process.env.MS_REFRESH_TOKEN,
        scope:         'https://graph.microsoft.com/Mail.Read offline_access',
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Auth error: ${data.error_description}`);

  // Persist the rotated refresh token back to Supabase so it stays valid
  if (data.refresh_token && data.refresh_token !== process.env.MS_REFRESH_TOKEN) {
    await fetch(`${SUPABASE_URL}/rest/v1/email_sync_config`, {
      method: 'POST',
      headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: 1, refresh_token: data.refresh_token }),
    });
  }

  return data.access_token;
}

// ── Fetch emails since last sync ───────────────────────────────────────────────

async function fetchNewEmails(token, since) {
  const filter  = since ? `&$filter=receivedDateTime gt ${since}` : '';
  const url = `https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body${filter}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.error) throw new Error(`Graph error: ${data.error.message}`);
  return data.value ?? [];
}

// ── Claude analysis ────────────────────────────────────────────────────────────

async function analyseEmail(email, contacts) {
  const contactSummary = contacts.map(c =>
    `- ${c.name} | ${c.email || 'no email'} | ${c.company || ''}`
  ).join('\n');

  const prompt = `You are an assistant managing a CRM for Elan Advisors, an M&A advisory firm.

Existing CRM contacts:
${contactSummary || '(none yet)'}

Analyse this email and respond with JSON only — no markdown, no explanation.

Email details:
From: ${email.from?.emailAddress?.name} <${email.from?.emailAddress?.address}>
To: ${email.toRecipients?.map(r => r.emailAddress?.address).join(', ')}
Subject: ${email.subject}
Date: ${email.receivedDateTime}
Preview: ${email.bodyPreview?.slice(0, 400)}

Respond with exactly this JSON structure:
{
  "action": "log_touchpoint" | "add_pending" | "ignore",
  "reason": "brief reason",
  "matched_contact_email": "email if action is log_touchpoint, else null",
  "touchpoint": {
    "type": "Email",
    "date": "YYYY-MM-DD",
    "note": "1-2 sentence summary of what was discussed"
  },
  "pending_contact": {
    "name": "full name",
    "email": "email address",
    "company": "company name if identifiable",
    "position": "job title if identifiable",
    "context": "brief note on how you know them"
  }
}

Rules:
- "log_touchpoint" if the sender/recipient exactly matches an existing CRM contact email
- "add_pending" if this looks like a real professional contact worth tracking (not spam, not automated, not internal @elanadvisors.io emails)
- "ignore" for newsletters, automated emails, spam, notifications, or anything not a real person
- For pending_contact, only fill fields you can confidently extract — leave others as null`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '{}';
  try { return JSON.parse(text); } catch { return { action: 'ignore', reason: 'parse error' }; }
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

async function loadCrm() {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/crm?id=eq.1&select=data`, { headers: SB });
  const rows = await res.json();
  return rows?.[0]?.data ?? { contacts: [] };
}

async function saveCrm(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/crm`, {
    method:  'POST',
    headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ id: 1, data }),
  });
}

async function loadPending() {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/crm_pending?id=eq.1&select=data`, { headers: SB });
  const rows = await res.json();
  return rows?.[0]?.data ?? { items: [] };
}

async function savePending(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/crm_pending`, {
    method:  'POST',
    headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ id: 1, data }),
  });
}

async function getLastSync() {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/email_sync_config?id=eq.1&select=last_sync`, { headers: SB });
  const rows = await res.json();
  return rows?.[0]?.last_sync ?? null;
}

async function setLastSync(ts) {
  await fetch(`${SUPABASE_URL}/rest/v1/email_sync_config`, {
    method:  'POST',
    headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ id: 1, last_sync: ts }),
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Email sync started:', new Date().toISOString());

  const token    = await refreshAccessToken();
  const lastSync = await getLastSync();
  const emails   = await fetchNewEmails(token, lastSync);
  console.log(`Fetched ${emails.length} emails since ${lastSync ?? 'beginning'}`);

  if (!emails.length) return { statusCode: 200, body: 'No new emails' };

  const crmData     = await loadCrm();
  const pendingData = await loadPending();
  const contacts    = crmData.contacts ?? [];
  const pending     = pendingData.items ?? [];

  let touchpointsAdded = 0;
  let pendingAdded     = 0;

  for (const email of emails) {
    try {
      const result = await analyseEmail(email, contacts);
      console.log(`${email.from?.emailAddress?.address}: ${result.action} — ${result.reason}`);

      if (result.action === 'log_touchpoint' && result.matched_contact_email) {
        const contact = contacts.find(c =>
          c.email?.toLowerCase() === result.matched_contact_email.toLowerCase()
        );
        if (contact) {
          contact.touchpoints = contact.touchpoints ?? [];
          contact.touchpoints.push({
            id:     Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            type:   result.touchpoint?.type ?? 'Email',
            date:   result.touchpoint?.date ?? new Date().toISOString().slice(0, 10),
            note:   result.touchpoint?.note ?? email.subject,
            source: 'auto',
          });
          touchpointsAdded++;
        }

      } else if (result.action === 'add_pending' && result.pending_contact?.email) {
        const alreadyInCrm     = contacts.some(c => c.email?.toLowerCase() === result.pending_contact.email.toLowerCase());
        const alreadyInPending = pending.some(p => p.email?.toLowerCase() === result.pending_contact.email.toLowerCase());
        if (!alreadyInCrm && !alreadyInPending) {
          pending.push({
            id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name:      result.pending_contact.name,
            email:     result.pending_contact.email,
            company:   result.pending_contact.company ?? '',
            position:  result.pending_contact.position ?? '',
            context:   result.pending_contact.context ?? '',
            emailSubject: email.subject,
            detectedAt: new Date().toISOString(),
          });
          pendingAdded++;
        }
      }
    } catch (err) {
      console.error(`Error processing email ${email.id}:`, err.message);
    }
  }

  if (touchpointsAdded) await saveCrm(crmData);
  if (pendingAdded)     await savePending({ items: pending });
  await setLastSync(new Date().toISOString());

  const summary = `Done: ${touchpointsAdded} touchpoints logged, ${pendingAdded} new contacts pending`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};
