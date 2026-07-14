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
let openLeadId = null;

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

function activeCampaign() {
  return campaigns.find(c => c.id === activeCampaignId);
}

// ── Badges ────────────────────────────────────────────────────────────────────

function stepBadge(status) {
  const labels  = { sent: 'Sent', connected: 'Connected', called: 'Called', pending: '—', skipped: 'Skipped' };
  const colours = { sent: 'gtm-badge--sent', connected: 'gtm-badge--sent', called: 'gtm-badge--sent', pending: 'gtm-badge--pending', skipped: 'gtm-badge--skipped' };
  return `<span class="gtm-badge ${colours[status] ?? 'gtm-badge--pending'}">${labels[status] ?? status}</span>`;
}

function channelBadge(channelAngle) {
  if (!channelAngle) return '';
  const isDirect = channelAngle.toLowerCase().includes('direct mail');
  return `<span class="gtm-channel-badge ${isDirect ? 'gtm-channel-badge--direct' : 'gtm-channel-badge--email'}">${isDirect ? 'Direct Mail' : 'Email'}</span>`;
}

function assigneeBadge(assignee) {
  const colours = { Ashar: 'gtm-assignee--ashar', Rohit: 'gtm-assignee--rohit' };
  return `<span class="gtm-assignee-badge ${colours[assignee] ?? ''}">${assignee}</span>`;
}

function fmtWeek(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const end = new Date(d); end.setDate(d.getDate() + 4);
  const opts = { day: 'numeric', month: 'short' };
  return `${d.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(leads) {
  const emailed   = leads.filter(l => l.steps.email.status === 'sent').length;
  const linked    = leads.filter(l => l.steps.linkedin.status === 'connected').length;
  const called    = leads.filter(l => l.steps.phone.status === 'called').length;
  const withNotes = leads.filter(l => l.notes?.length).length;

  document.getElementById('gtm-stats').innerHTML = `
    <div class="gtm-stat"><span class="gtm-stat-n">${leads.length}</span><span class="gtm-stat-l">Total</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${emailed}</span><span class="gtm-stat-l">Emailed</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${linked}</span><span class="gtm-stat-l">LinkedIn</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n gtm-stat-n--sent">${called}</span><span class="gtm-stat-l">Called</span></div>
    <div class="gtm-stat"><span class="gtm-stat-n">${withNotes}</span><span class="gtm-stat-l">Notes</span></div>
  `;
}

// ── Table (grouped by call week) ──────────────────────────────────────────────

function renderTable() {
  const campaign = activeCampaign();
  if (!campaign) return;
  const leads = campaign.leads;
  renderStats(leads);

  // Group by callWeek
  const weeks = {};
  for (const l of leads) {
    const wk = l.callWeek ?? 'Unscheduled';
    (weeks[wk] = weeks[wk] ?? []).push(l);
  }

  const tbody = document.getElementById('gtm-tbody');
  tbody.innerHTML = Object.entries(weeks).map(([wk, wkLeads]) => {
    const called = wkLeads.filter(l => l.steps.phone.status === 'called').length;
    const asharDone = wkLeads.filter(l => l.callAssignee === 'Ashar' && l.steps.phone.status === 'called').length;
    const rohitDone = wkLeads.filter(l => l.callAssignee === 'Rohit' && l.steps.phone.status === 'called').length;
    const asharTotal = wkLeads.filter(l => l.callAssignee === 'Ashar').length;
    const rohitTotal = wkLeads.filter(l => l.callAssignee === 'Rohit').length;

    return `
      <tr class="gtm-week-header">
        <td colspan="9">
          <div class="gtm-week-label">
            <span class="gtm-week-range">w/o ${fmtWeek(wk)}</span>
            <span class="gtm-week-progress">
              ${assigneeBadge('Ashar')} ${asharDone}/${asharTotal} calls &nbsp;
              ${assigneeBadge('Rohit')} ${rohitDone}/${rohitTotal} calls &nbsp;
              <span class="gtm-week-total">${called}/${wkLeads.length} total</span>
            </span>
          </div>
        </td>
      </tr>
      ${wkLeads.map(l => `
        <tr class="gtm-row ${l.notes?.length ? 'gtm-row--has-notes' : ''}" data-id="${l.id}">
          <td class="gtm-td gtm-td--num">${l.num}</td>
          <td class="gtm-td gtm-td--company">
            <div class="gtm-company-name">${l.company}</div>
            ${l.website ? `<a class="gtm-link" href="${l.website}" target="_blank" onclick="event.stopPropagation()">${l.website.replace(/^https?:\/\//, '')}</a>` : ''}
          </td>
          <td class="gtm-td gtm-td--sector">${l.sector}</td>
          <td class="gtm-td gtm-td--contact">
            <div class="gtm-contact-name">${l.contactName}</div>
            <div class="gtm-contact-title">${l.title}</div>
            ${l.email ? `<a class="gtm-link" href="mailto:${l.email}" onclick="event.stopPropagation()">${l.email}</a>` : ''}
          </td>
          <td class="gtm-td gtm-td--right gtm-td--revenue">${l.revenue || '—'}</td>
          <td class="gtm-td gtm-td--right gtm-td--growth">${l.growth || '—'}</td>
          <td class="gtm-td gtm-td--center">
            ${channelBadge(l.steps.email.channelAngle)}
            ${stepBadge(l.steps.email.status)}
          </td>
          <td class="gtm-td gtm-td--center">${stepBadge(l.steps.linkedin.status)}</td>
          <td class="gtm-td gtm-td--center">
            <div>${assigneeBadge(l.callAssignee)}</div>
            ${stepBadge(l.steps.phone.status)}
          </td>
          <td class="gtm-td gtm-td--center">
            ${l.notes?.length ? `<span class="gtm-notes-chip">${l.notes.length}</span>` : '<span class="gtm-notes-chip gtm-notes-chip--empty">+</span>'}
          </td>
        </tr>`).join('')}`;
  }).join('');
}

// ── Campaign selector ─────────────────────────────────────────────────────────

function renderCampaignSelector() {
  const sel = document.getElementById('gtm-campaign-select');
  sel.innerHTML = campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = activeCampaignId;
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function openDrawer(leadId) {
  const campaign = activeCampaign();
  const lead = campaign?.leads.find(l => l.id === leadId);
  if (!lead) return;
  openLeadId = leadId;

  const overlay = document.getElementById('gtm-overlay');
  const drawer  = document.getElementById('gtm-drawer');

  const stepAction = (step, currentStatus) => {
    const next  = { email: 'sent', linkedin: 'connected', phone: 'called' }[step];
    const label = { email: 'Mark Sent', linkedin: 'Mark Connected', phone: 'Mark Called' }[step];
    if (currentStatus === next) {
      return `<button class="gtm-action-btn gtm-action-btn--undo" data-action="step" data-lead="${leadId}" data-step="${step}" data-status="pending">↩ Undo</button>`;
    }
    return `<button class="gtm-action-btn gtm-action-btn--primary" data-action="step" data-lead="${leadId}" data-step="${step}" data-status="${next}">${label}</button>`;
  };

  const notesHtml = (lead.notes ?? []).map((n, i) => `
    <div class="gtm-note" data-note-i="${i}">
      <div class="gtm-note-meta">
        <span class="gtm-note-author">${n.author}</span>
        <span class="gtm-note-date">${new Date(n.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
        <button class="gtm-note-delete" data-action="delete-note" data-lead="${leadId}" data-note="${i}">✕</button>
      </div>
      <div class="gtm-note-text">${n.text}</div>
    </div>`).join('') || '<div class="gtm-note-empty">No notes yet</div>';

  drawer.innerHTML = `
    <div class="gtm-drawer-header">
      <div>
        <div class="gtm-drawer-company">${lead.company}</div>
        <div class="gtm-drawer-sub">${lead.sector} · ${lead.years ? lead.years + ' yrs' : ''} · ${lead.period ?? ''}</div>
      </div>
      <button class="gtm-drawer-close" id="gtm-drawer-close">✕</button>
    </div>

    <div class="gtm-drawer-body">

      <div class="gtm-drawer-profile">
        <div class="gtm-profile-stat"><span class="gtm-profile-val">${lead.revenue || '—'}</span><span class="gtm-profile-lbl">Revenue</span></div>
        <div class="gtm-profile-stat"><span class="gtm-profile-val">${lead.growth || '—'}</span><span class="gtm-profile-lbl">Growth</span></div>
        <div class="gtm-profile-stat"><span class="gtm-profile-val">${lead.employees || '—'}</span><span class="gtm-profile-lbl">Employees</span></div>
        <div class="gtm-profile-stat"><span class="gtm-profile-val">${lead.years ? lead.years + ' yrs' : '—'}</span><span class="gtm-profile-lbl">Est.</span></div>
      </div>
      ${lead.address ? `<div class="gtm-drawer-address">📍 ${lead.address}</div>` : ''}
      ${lead.website ? `<div><a class="gtm-link" href="${lead.website}" target="_blank">${lead.website}</a></div>` : ''}

      <div class="gtm-drawer-section">
        <div class="gtm-drawer-label">Contact</div>
        <div class="gtm-drawer-contact-name">${lead.contactName}</div>
        <div class="gtm-drawer-contact-meta">${lead.title}</div>
        ${lead.email ? `<a class="gtm-link" href="mailto:${lead.email}">${lead.email}</a>` : ''}
        ${lead.phone ? `<div><a class="gtm-link" href="tel:${lead.phone}">${lead.phone}</a></div>` : ''}
        ${lead.linkedin ? `<div><a class="gtm-link" href="${lead.linkedin}" target="_blank">LinkedIn ↗</a></div>` : ''}
      </div>

      ${lead.description ? `<div class="gtm-drawer-section"><div class="gtm-drawer-label">About</div><div class="gtm-drawer-desc">${lead.description}</div></div>` : ''}

      <!-- Notes -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Notes</span>
        </div>
        <div id="gtm-notes-list">${notesHtml}</div>
        <div class="gtm-note-add">
          <select class="gtm-note-author-select" id="gtm-note-author">
            <option value="Ashar">Ashar</option>
            <option value="Rohit">Rohit</option>
            <option value="Yash">Yash</option>
          </select>
          <textarea class="gtm-note-input" id="gtm-note-input" rows="2" placeholder="Add a note…"></textarea>
          <button class="gtm-action-btn gtm-action-btn--primary" data-action="add-note" data-lead="${leadId}">Add Note</button>
        </div>
      </div>

      <!-- Step 1 -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 1</span>
          ${channelBadge(lead.steps.email.channelAngle)}
          ${stepBadge(lead.steps.email.status)}
          ${stepAction('email', lead.steps.email.status)}
        </div>
        ${lead.steps.email.channelAngle ? `<div class="gtm-drawer-angle">${lead.steps.email.channelAngle}</div>` : ''}
        ${lead.steps.email.subject ? `<div class="gtm-drawer-subject">Subject: ${lead.steps.email.subject}</div>` : ''}
        ${lead.steps.email.copy ? `<pre class="gtm-drawer-copy">${lead.steps.email.copy}</pre>` : ''}
      </div>

      <!-- Step 2 -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 2 · LinkedIn</span>
          ${stepBadge(lead.steps.linkedin.status)}
          ${stepAction('linkedin', lead.steps.linkedin.status)}
        </div>
        ${lead.steps.linkedin.message ? `<pre class="gtm-drawer-copy">${lead.steps.linkedin.message}</pre>` : ''}
      </div>

      <!-- Step 3 -->
      <div class="gtm-drawer-step">
        <div class="gtm-drawer-step-header">
          <span class="gtm-drawer-step-title">Step 3 · Phone</span>
          ${assigneeBadge(lead.callAssignee)}
          <span class="gtm-week-chip">w/o ${fmtWeek(lead.callWeek)}</span>
          ${stepBadge(lead.steps.phone.status)}
          ${stepAction('phone', lead.steps.phone.status)}
        </div>
        ${lead.steps.phone.number ? `<div><a class="gtm-link" href="tel:${lead.steps.phone.number}">${lead.steps.phone.number}</a></div>` : ''}
        ${lead.steps.phone.opener ? `<pre class="gtm-drawer-copy">${lead.steps.phone.opener}</pre>` : ''}
      </div>

    </div>`;

  overlay.classList.add('gtm-overlay--open');
  drawer.classList.add('gtm-drawer--open');

  document.getElementById('gtm-drawer-close').onclick = closeDrawer;
  overlay.onclick = closeDrawer;
}

function closeDrawer() {
  document.getElementById('gtm-overlay').classList.remove('gtm-overlay--open');
  document.getElementById('gtm-drawer').classList.remove('gtm-drawer--open');
  document.getElementById('gtm-overlay').onclick = null;
  openLeadId = null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function updateStep(leadId, step, status) {
  const lead = activeCampaign()?.leads.find(l => l.id === leadId);
  if (!lead) return;
  lead.steps[step].status = status;
  const now = new Date().toISOString();
  if (status !== 'pending') {
    if (step === 'email')    lead.steps.email.sentAt    = now;
    if (step === 'linkedin') lead.steps.linkedin.sentAt = now;
    if (step === 'phone')    lead.steps.phone.calledAt  = now;
  } else {
    if (step === 'email')    lead.steps.email.sentAt    = null;
    if (step === 'linkedin') lead.steps.linkedin.sentAt = null;
    if (step === 'phone')    lead.steps.phone.calledAt  = null;
  }
  await saveToSupabase();
  renderTable();
  openDrawer(leadId);
}

async function addNote(leadId, author, text) {
  if (!text.trim()) return;
  const lead = activeCampaign()?.leads.find(l => l.id === leadId);
  if (!lead) return;
  lead.notes = lead.notes ?? [];
  lead.notes.push({ author, text: text.trim(), createdAt: new Date().toISOString() });
  await saveToSupabase();
  renderTable();
  openDrawer(leadId);
}

async function deleteNote(leadId, noteIndex) {
  const lead = activeCampaign()?.leads.find(l => l.id === leadId);
  if (!lead) return;
  lead.notes.splice(noteIndex, 1);
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

  document.getElementById('gtm-campaign-select').addEventListener('change', e => {
    activeCampaignId = e.target.value;
    renderTable();
  });

  document.getElementById('gtm-tbody').addEventListener('click', e => {
    const row = e.target.closest('.gtm-row');
    if (row && !e.target.closest('[data-action]') && !e.target.closest('a')) {
      openDrawer(row.dataset.id);
    }
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const leadId = btn.dataset.lead;

    if (action === 'step') {
      await updateStep(leadId, btn.dataset.step, btn.dataset.status);
    } else if (action === 'add-note') {
      const author = document.getElementById('gtm-note-author')?.value;
      const text   = document.getElementById('gtm-note-input')?.value;
      await addNote(leadId, author, text);
    } else if (action === 'delete-note') {
      await deleteNote(leadId, parseInt(btn.dataset.note));
    }
  });
}
