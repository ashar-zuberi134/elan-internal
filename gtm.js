const SUPABASE_URL = 'https://sofzlqjszuskvwlkxvhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZnpscWpzenVza3Z3bGt4dmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjYsImV4cCI6MjA5NjQ3MzIyNn0.SGkwZg1k89w5qxixLqfckCuVoPY5UPX4Af7QIc8bVFQ';
const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
};

let campaigns = [];
let activeCampaignId = null;

// ── Supabase ──────────────────────────────────────────────────────────────────

async function loadFromSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gtm?id=eq.1&select=data`, { headers: SB });
  const rows = await res.json();
  campaigns = rows[0]?.data?.campaigns ?? [];
}

async function saveToSupabase() {
  await fetch(`${SUPABASE_URL}/rest/v1/gtm`, {
    method: 'POST',
    headers: SB,
    body: JSON.stringify({ id: 1, data: { campaigns } }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeCampaign() {
  return campaigns.find(c => c.id === activeCampaignId);
}

function stepBadge(status, step) {
  const labels = { sent: 'Sent', connected: 'Connected', called: 'Called', pending: 'Pending', skipped: 'Skipped' };
  const colours = {
    sent:      'gtm-badge--sent',
    connected: 'gtm-badge--sent',
    called:    'gtm-badge--sent',
    pending:   'gtm-badge--pending',
    skipped:   'gtm-badge--skipped',
  };
  const label = labels[status] ?? status;
  const cls   = colours[status] ?? 'gtm-badge--pending';
  return `<span class="gtm-badge ${cls}" data-step="${step}">${label}</span>`;
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function renderStats(leads) {
  const total   = leads.length;
  const emailed = leads.filter(l => l.steps.email.status === 'sent').length;
  const linked  = leads.filter(l => l.steps.linkedin.status === 'connected').length;
  const called  = leads.filter(l => l.steps.phone.status === 'called').length;

  document.getElementById('gtm-stats').innerHTML = `
    <div class="gtm-stat"><span class="gtm-stat-n">${total}</span><span class="gtm-stat-l">Total</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${emailed}</span><span class="gtm-stat-l">Emailed</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${linked}</span><span class="gtm-stat-l">LinkedIn</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${called}</span><span class="gtm-stat-l">Called</span></div>
  `;
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable() {
  const campaign = activeCampaign();
  if (!campaign) return;
  const leads = campaign.leads;
  renderStats(leads);

  document.getElementById('gtm-tbody').innerHTML = leads.map(l => `
    <tr class="gtm-row" data-id="${l.id}">
      <td class="gtm-num">${l.num}</td>
      <td class="gtm-company">
        <div class="gtm-company-name">${l.company}</div>
        ${l.website ? `<a class="gtm-link" href="${l.website}" target="_blank">${l.website.replace(/^https?:\/\//, '')}</a>` : ''}
      </td>
      <td class="gtm-sector">${l.sector}</td>
      <td class="gtm-contact">
        <div>${l.contactName}</div>
        <div class="gtm-contact-title">${l.title}</div>
      </td>
      <td class="gtm-revenue">${l.revenue}</td>
      <td class="gtm-growth">${l.growth}</td>
      <td class="gtm-step-cell">${stepBadge(l.steps.email.status, 'email')}</td>
      <td class="gtm-step-cell">${stepBadge(l.steps.linkedin.status, 'linkedin')}</td>
      <td class="gtm-step-cell">${stepBadge(l.steps.phone.status, 'phone')}</td>
    </tr>`).join('');
}

// ── Campaign selector ─────────────────────────────────────────────────────────

function renderCampaignSelector() {
  const sel = document.getElementById('gtm-campaign-select');
  sel.innerHTML = campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = activeCampaignId;
  sel.addEventListener('change', () => {
    activeCampaignId = sel.value;
    renderTable();
  });
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function openDrawer(leadId) {
  const campaign = activeCampaign();
  const lead = campaign?.leads.find(l => l.id === leadId);
  if (!lead) return;

  const overlay = document.getElementById('gtm-overlay');
  const drawer  = document.getElementById('gtm-drawer');

  const stepAction = (step, currentStatus) => {
    const next = { email: 'sent', linkedin: 'connected', phone: 'called' }[step];
    const label = { email: 'Mark Sent', linkedin: 'Mark Connected', phone: 'Mark Called' }[step];
    const undo  = { sent: 'pending', connected: 'pending', called: 'pending' };
    if (currentStatus === next) {
      return `<button class="gtm-action-btn gtm-action-btn--undo" data-action="step" data-lead="${leadId}" data-step="${step}" data-status="pending">↩ Undo</button>`;
    }
    return `<button class="gtm-action-btn gtm-action-btn--primary" data-action="step" data-lead="${leadId}" data-step="${step}" data-status="${next}">${label}</button>`;
  };

  drawer.innerHTML = `
    <div class="gtm-drawer-header">
      <div>
        <div class="gtm-drawer-company">${lead.company}</div>
        <div class="gtm-drawer-sub">${lead.sector} · ${lead.revenue} · ${lead.growth} growth</div>
      </div>
      <button class="gtm-drawer-close" id="gtm-drawer-close">✕</button>
    </div>

    <div class="gtm-drawer-body">
      <div class="gtm-drawer-section">
        <div class="gtm-drawer-label">Contact</div>
        <div class="gtm-drawer-contact-name">${lead.contactName}</div>
        <div class="gtm-drawer-contact-meta">${lead.title}</div>
        ${lead.email ? `<a class="gtm-link" href="mailto:${lead.email}">${lead.email}</a>` : ''}
        ${lead.phone ? `<div><a class="gtm-link" href="tel:${lead.phone}">${lead.phone}</a></div>` : ''}
        ${lead.linkedin ? `<div><a class="gtm-link" href="${lead.linkedin}" target="_blank">LinkedIn ↗</a></div>` : ''}
      </div>

      ${lead.description ? `<div class="gtm-drawer-section"><div class="gtm-drawer-label">About</div><div class="gtm-drawer-desc">${lead.description}</div></div>` : ''}

      <!-- Step 1: Email -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 1 · Email</span>
          ${stepBadge(lead.steps.email.status, 'email')}
          ${stepAction('email', lead.steps.email.status)}
        </div>
        ${lead.steps.email.channelAngle ? `<div class="gtm-drawer-angle">${lead.steps.email.channelAngle}</div>` : ''}
        ${lead.steps.email.subject ? `<div class="gtm-drawer-subject">Subject: ${lead.steps.email.subject}</div>` : ''}
        ${lead.steps.email.copy ? `<pre class="gtm-drawer-copy">${lead.steps.email.copy}</pre>` : ''}
      </div>

      <!-- Step 2: LinkedIn -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 2 · LinkedIn</span>
          ${stepBadge(lead.steps.linkedin.status, 'linkedin')}
          ${stepAction('linkedin', lead.steps.linkedin.status)}
        </div>
        ${lead.steps.linkedin.message ? `<pre class="gtm-drawer-copy">${lead.steps.linkedin.message}</pre>` : ''}
      </div>

      <!-- Step 3: Phone -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 3 · Phone</span>
          ${stepBadge(lead.steps.phone.status, 'phone')}
          ${stepAction('phone', lead.steps.phone.status)}
        </div>
        ${lead.steps.phone.number ? `<div><a class="gtm-link" href="tel:${lead.steps.phone.number}">${lead.steps.phone.number}</a></div>` : ''}
        ${lead.steps.phone.opener ? `<pre class="gtm-drawer-copy">${lead.steps.phone.opener}</pre>` : ''}
      </div>
    </div>`;

  overlay.classList.add('gtm-overlay--open');
  drawer.classList.add('gtm-drawer--open');

  document.getElementById('gtm-drawer-close').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer, { once: true });
}

function closeDrawer() {
  document.getElementById('gtm-overlay').classList.remove('gtm-overlay--open');
  document.getElementById('gtm-drawer').classList.remove('gtm-drawer--open');
}

// ── Step status update ────────────────────────────────────────────────────────

async function updateStep(leadId, step, status) {
  const campaign = activeCampaign();
  const lead = campaign?.leads.find(l => l.id === leadId);
  if (!lead) return;

  lead.steps[step].status = status;
  const now = new Date().toISOString();
  if (status !== 'pending') {
    if (step === 'email')    lead.steps.email.sentAt     = now;
    if (step === 'linkedin') lead.steps.linkedin.sentAt  = now;
    if (step === 'phone')    lead.steps.phone.calledAt   = now;
  } else {
    if (step === 'email')    lead.steps.email.sentAt     = null;
    if (step === 'linkedin') lead.steps.linkedin.sentAt  = null;
    if (step === 'phone')    lead.steps.phone.calledAt   = null;
  }

  await saveToSupabase();
  renderTable();
  openDrawer(leadId);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initGtm() {
  await loadFromSupabase();
  if (!campaigns.length) return;

  activeCampaignId = campaigns[0].id;
  renderCampaignSelector();
  renderTable();

  document.getElementById('gtm-tbody').addEventListener('click', e => {
    const row = e.target.closest('.gtm-row');
    if (row && !e.target.closest('[data-action]')) openDrawer(row.dataset.id);
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="step"]');
    if (!btn) return;
    const { lead, step, status } = btn.dataset;
    await updateStep(lead, step, status);
  });
}
