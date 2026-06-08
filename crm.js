// ── CRM Module ────────────────────────────────────────────────────────────────
// Stored in Supabase, crm table, row id=2, same pattern as the grid.

const SUPABASE_URL = 'https://sofzlqjszuskvwlkxvhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZnpscWpzenVza3Z3bGt4dmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjYsImV4cCI6MjA5NjQ3MzIyNn0.SGkwZg1k89w5qxixLqfckCuVoPY5UPX4Af7QIc8bVFQ';
const CRM_ROW_ID  = 1;

const SB = {
  apikey:          SUPABASE_KEY,
  Authorization:   `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

const TAGS = [
  'SME / Client',
  'Third Party Service',
  'High Net Worth',
  'Family Office',
];

const TOUCHPOINT_TYPES = ['Email', 'Call', 'Meeting', 'LinkedIn', 'WhatsApp', 'Other'];

const TAG_COLORS = {
  'SME / Client':          { bg: '#e8f4fd', text: '#1a6fa8' },
  'Third Party Service':   { bg: '#fef3e2', text: '#a0600a' },
  'High Net Worth':        { bg: '#eaf7f0', text: '#1a7a4a' },
  'Family Office':         { bg: '#f0eafd', text: '#6a3aad' },
};

// ── State ─────────────────────────────────────────────────────────────────────

let contacts     = [];
let activeFilter = null;   // tag filter
let searchQuery  = '';
let drawerContact = null;  // currently open contact

// ── Persistence ───────────────────────────────────────────────────────────────

async function crmLoad() {
  // Fall back to localStorage while Supabase is unavailable
  try {
    const res  = await fetch(
      `${SUPABASE_URL}/rest/v1/crm?id=eq.${CRM_ROW_ID}&select=data`,
      { headers: SB }
    );
    const rows = await res.json();
    contacts   = rows?.[0]?.data?.contacts ?? [];
  } catch {
    const local = localStorage.getItem('elan_crm');
    contacts    = local ? JSON.parse(local).contacts ?? [] : [];
  }
  renderList();
}

async function crmSave() {
  localStorage.setItem('elan_crm', JSON.stringify({ contacts }));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/crm`, {
      method:  'POST',
      headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
      body:    JSON.stringify({ id: CRM_ROW_ID, data: { contacts } }),
    });
  } catch { /* silent — localStorage already saved */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmt(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tagChip(tag) {
  const c = TAG_COLORS[tag] ?? { bg: '#f0f7f6', text: '#5a7a78' };
  return `<span class="crm-tag" style="background:${c.bg};color:${c.text};">${tag}</span>`;
}

function latestTouchpoint(contact) {
  if (!contact.touchpoints?.length) return null;
  return contact.touchpoints.reduce((a, b) => a.date > b.date ? a : b);
}

// ── List Rendering ────────────────────────────────────────────────────────────

function filteredContacts() {
  return contacts.filter(c => {
    const matchTag    = !activeFilter || c.tags?.includes(activeFilter);
    const q           = searchQuery.toLowerCase();
    const matchSearch = !q ||
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.position?.toLowerCase().includes(q);
    return matchTag && matchSearch;
  });
}

export function renderList() {
  renderFilterBar();
  const list   = document.getElementById('crm-list');
  const filtered = filteredContacts();

  if (!filtered.length) {
    list.innerHTML = `<div class="crm-empty">${contacts.length ? 'No contacts match your filter.' : 'No contacts yet. Add your first one.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const latest = latestTouchpoint(c);
    return `
      <div class="crm-row" data-id="${c.id}">
        <div class="crm-row-main">
          <div class="crm-row-name">${c.name}</div>
          <div class="crm-row-sub">${[c.position, c.company].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="crm-row-tags">${(c.tags ?? []).map(tagChip).join('')}</div>
        <div class="crm-row-latest">
          ${latest
            ? `<span class="crm-latest-type">${latest.type}</span><span class="crm-latest-date">${fmt(latest.date)}</span>`
            : `<span class="crm-no-touch">No touchpoints</span>`}
        </div>
        <button class="crm-row-btn" data-id="${c.id}">View →</button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => openDrawer(el.dataset.id));
  });
}

function renderFilterBar() {
  const bar = document.getElementById('crm-filter-bar');
  bar.innerHTML = ['All', ...TAGS].map(tag => {
    const active = (tag === 'All' && !activeFilter) || tag === activeFilter;
    return `<button class="crm-filter-btn ${active ? 'crm-filter-btn--active' : ''}" data-tag="${tag}">${tag}</button>`;
  }).join('');
  bar.querySelectorAll('[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.tag === 'All' ? null : btn.dataset.tag;
      renderList();
    });
  });
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function openDrawer(id) {
  drawerContact = contacts.find(c => c.id === id);
  if (!drawerContact) return;
  renderDrawer();
  document.getElementById('crm-drawer').classList.add('open');
  document.getElementById('crm-overlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('crm-drawer').classList.remove('open');
  document.getElementById('crm-overlay').classList.remove('open');
  drawerContact = null;
}

function renderDrawer() {
  const c = drawerContact;
  const drawer = document.getElementById('crm-drawer');

  const infoRows = [
    c.company  && `<div class="drawer-info-row"><span>Company</span><span>${c.company}</span></div>`,
    c.position && `<div class="drawer-info-row"><span>Position</span><span>${c.position}</span></div>`,
    c.email    && `<div class="drawer-info-row"><span>Email</span><a href="mailto:${c.email}">${c.email}</a></div>`,
    c.phone    && `<div class="drawer-info-row"><span>Phone</span><span>${c.phone}</span></div>`,
    c.linkedin && `<div class="drawer-info-row"><span>LinkedIn</span><a href="${c.linkedin}" target="_blank">View profile</a></div>`,
  ].filter(Boolean).join('');

  const sorted = [...(c.touchpoints ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <div class="drawer-name">${c.name}</div>
        <div class="drawer-sub">${[c.position, c.company].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="drawer-header-actions">
        <button class="btn btn--sm" id="drawer-edit">Edit</button>
        <button class="btn btn--sm btn--danger" id="drawer-delete">Delete</button>
        <button class="drawer-close" id="drawer-close">✕</button>
      </div>
    </div>

    <div class="drawer-body">

      <div class="drawer-section">
        <div class="drawer-section-title">Tags</div>
        <div class="drawer-tags">${(c.tags ?? []).map(tagChip).join('') || '<span style="color:#9bbfba;font-size:11px;">None</span>'}</div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Contact Details</div>
        ${infoRows || '<div style="color:#9bbfba;font-size:11px;">No details added.</div>'}
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          Touchpoints
          <button class="btn btn--sm btn--primary" id="drawer-add-touch">+ Add</button>
        </div>
        <div id="drawer-touchpoints">
          ${sorted.length ? sorted.map(tp => `
            <div class="touch-row" data-tp-id="${tp.id}">
              <div class="touch-meta">
                <span class="touch-type">${tp.type}</span>
                <span class="touch-date">${fmt(tp.date)}</span>
                <button class="touch-delete" data-tp-id="${tp.id}">✕</button>
              </div>
              <div class="touch-note">${tp.note || '<em>No notes</em>'}</div>
            </div>`).join('') : '<div class="crm-empty" style="padding:12px 0;">No touchpoints yet.</div>'}
        </div>
      </div>

    </div>
  `;

  drawer.querySelector('#drawer-close').addEventListener('click', closeDrawer);
  drawer.querySelector('#drawer-edit').addEventListener('click', () => openContactModal(c));
  drawer.querySelector('#drawer-delete').addEventListener('click', () => deleteContact(c.id));
  drawer.querySelector('#drawer-add-touch').addEventListener('click', () => openTouchpointModal(c.id));
  drawer.querySelectorAll('.touch-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTouchpoint(c.id, btn.dataset.tpId);
    });
  });
}

// ── Contact Modal ─────────────────────────────────────────────────────────────

function openContactModal(existing = null) {
  const isEdit = !!existing;
  const c = existing ?? {};

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-title">${isEdit ? 'Edit Contact' : 'Add Contact'}</div>

      <div class="modal-grid">
        <div>
          <label>Name *</label>
          <input id="cf-name" type="text" placeholder="Full name" value="${c.name ?? ''}" />
        </div>
        <div>
          <label>Company</label>
          <input id="cf-company" type="text" placeholder="Company name" value="${c.company ?? ''}" />
        </div>
        <div>
          <label>Position</label>
          <input id="cf-position" type="text" placeholder="Job title" value="${c.position ?? ''}" />
        </div>
        <div>
          <label>Email</label>
          <input id="cf-email" type="email" placeholder="email@example.com" value="${c.email ?? ''}" />
        </div>
        <div>
          <label>Phone</label>
          <input id="cf-phone" type="tel" placeholder="+44 7700 000000" value="${c.phone ?? ''}" />
        </div>
        <div>
          <label>LinkedIn URL</label>
          <input id="cf-linkedin" type="url" placeholder="https://linkedin.com/in/..." value="${c.linkedin ?? ''}" />
        </div>
      </div>

      <label style="margin-top:4px;">Tags</label>
      <div class="tag-picker">
        ${TAGS.map(tag => {
          const sel = (c.tags ?? []).includes(tag);
          return `<button class="tag-pick-btn ${sel ? 'selected' : ''}" data-tag="${tag}">${tag}</button>`;
        }).join('')}
      </div>

      <div class="modal-btns" style="margin-top:16px;">
        <button class="btn" id="cf-cancel">Cancel</button>
        <button class="btn btn--primary" id="cf-save">${isEdit ? 'Save Changes' : 'Add Contact'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#cf-name').focus();

  backdrop.querySelectorAll('.tag-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  backdrop.querySelector('#cf-cancel').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#cf-save').onclick = async () => {
    const name = backdrop.querySelector('#cf-name').value.trim();
    if (!name) { backdrop.querySelector('#cf-name').focus(); return; }

    const tags = [...backdrop.querySelectorAll('.tag-pick-btn.selected')].map(b => b.dataset.tag);

    if (isEdit) {
      Object.assign(existing, {
        name,
        company:  backdrop.querySelector('#cf-company').value.trim(),
        position: backdrop.querySelector('#cf-position').value.trim(),
        email:    backdrop.querySelector('#cf-email').value.trim(),
        phone:    backdrop.querySelector('#cf-phone').value.trim(),
        linkedin: backdrop.querySelector('#cf-linkedin').value.trim(),
        tags,
      });
    } else {
      contacts.unshift({
        id:          uid(),
        name,
        company:     backdrop.querySelector('#cf-company').value.trim(),
        position:    backdrop.querySelector('#cf-position').value.trim(),
        email:       backdrop.querySelector('#cf-email').value.trim(),
        phone:       backdrop.querySelector('#cf-phone').value.trim(),
        linkedin:    backdrop.querySelector('#cf-linkedin').value.trim(),
        tags,
        touchpoints: [],
        createdAt:   new Date().toISOString(),
      });

      // If accepted from pending queue, remove it there
      if (c._pendingId && c._pendingItems) {
        const updated = c._pendingItems.filter(p => p.id !== c._pendingId);
        await savePendingQueue(updated);
        renderPendingQueue(updated);
      }
    }

    backdrop.remove();
    await crmSave();
    renderList();
    if (isEdit && drawerContact) renderDrawer();
  };
}

// ── Touchpoint Modal ──────────────────────────────────────────────────────────

function openTouchpointModal(contactId) {
  const today    = new Date().toISOString().slice(0, 10);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">Add Touchpoint</div>
      <label>Type</label>
      <select id="tp-type">
        ${TOUCHPOINT_TYPES.map(t => `<option>${t}</option>`).join('')}
      </select>
      <label>Date</label>
      <input id="tp-date" type="date" value="${today}" />
      <label>Notes</label>
      <textarea id="tp-note" placeholder="What was discussed or agreed?" style="height:80px;resize:vertical;"></textarea>
      <div class="modal-btns">
        <button class="btn" id="tp-cancel">Cancel</button>
        <button class="btn btn--primary" id="tp-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#tp-cancel').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#tp-save').onclick = async () => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    contact.touchpoints = contact.touchpoints ?? [];
    contact.touchpoints.push({
      id:   uid(),
      type: backdrop.querySelector('#tp-type').value,
      date: backdrop.querySelector('#tp-date').value,
      note: backdrop.querySelector('#tp-note').value.trim(),
    });

    backdrop.remove();
    await crmSave();
    renderList();
    if (drawerContact?.id === contactId) {
      drawerContact = contact;
      renderDrawer();
    }
  };
}

// ── Delete helpers ────────────────────────────────────────────────────────────

async function deleteContact(id) {
  if (!confirm('Delete this contact and all their touchpoints?')) return;
  contacts = contacts.filter(c => c.id !== id);
  closeDrawer();
  await crmSave();
  renderList();
}

async function deleteTouchpoint(contactId, tpId) {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;
  contact.touchpoints = contact.touchpoints.filter(tp => tp.id !== tpId);
  await crmSave();
  renderList();
  if (drawerContact?.id === contactId) {
    drawerContact = contact;
    renderDrawer();
  }
}

// ── Pending Queue ─────────────────────────────────────────────────────────────

async function loadPendingQueue() {
  try {
    const res   = await fetch(`${SUPABASE_URL}/rest/v1/crm_pending?id=eq.1&select=data`, { headers: SB });
    const rows  = await res.json();
    const items = rows?.[0]?.data?.items ?? [];
    renderPendingQueue(items);
  } catch { /* silent — pending is non-critical */ }
}

async function savePendingQueue(items) {
  await fetch(`${SUPABASE_URL}/rest/v1/crm_pending`, {
    method:  'POST',
    headers: { ...SB, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ id: 1, data: { items } }),
  });
}

function renderPendingQueue(items) {
  const section = document.getElementById('crm-pending-section');
  const list    = document.getElementById('crm-pending-list');
  const badge   = document.getElementById('crm-pending-count');

  if (!items.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  badge.textContent     = items.length;

  list.innerHTML = items.map(p => `
    <div class="pending-row" data-id="${p.id}">
      <div class="pending-main">
        <div class="pending-name">${p.name || 'Unknown'}</div>
        <div class="pending-sub">${[p.position, p.company].filter(Boolean).join(' · ') || p.email}</div>
        ${p.context ? `<div class="pending-context">${p.context}</div>` : ''}
      </div>
      <div class="pending-email">${p.email}</div>
      <div class="pending-subject" title="${p.emailSubject || ''}">
        ${p.emailSubject ? `📧 ${p.emailSubject.slice(0, 40)}${p.emailSubject.length > 40 ? '…' : ''}` : ''}
      </div>
      <div class="pending-actions">
        <button class="btn btn--sm btn--primary pending-accept" data-id="${p.id}">Add to CRM</button>
        <button class="btn btn--sm pending-dismiss" data-id="${p.id}">Dismiss</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.pending-accept').forEach(btn => {
    btn.addEventListener('click', () => acceptPending(btn.dataset.id, items));
  });
  list.querySelectorAll('.pending-dismiss').forEach(btn => {
    btn.addEventListener('click', () => dismissPending(btn.dataset.id, items));
  });
}

async function acceptPending(id, items) {
  const item = items.find(p => p.id === id);
  if (!item) return;

  // Pre-fill the add contact modal with detected data
  openContactModal({
    name:     item.name,
    company:  item.company,
    position: item.position,
    email:    item.email,
    _pendingId: id,
    _pendingItems: items,
  });
}

async function dismissPending(id, items) {
  const updated = items.filter(p => p.id !== id);
  await savePendingQueue(updated);
  renderPendingQueue(updated);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

export function initCrm() {
  // Use delegation on document so elements don't need to exist at init time
  document.addEventListener('input', e => {
    if (e.target.id === 'crm-search') { searchQuery = e.target.value; renderList(); }
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'crm-add-btn') openContactModal();
  });

  document.getElementById('crm-overlay').addEventListener('click', closeDrawer);

  crmLoad();
  loadPendingQueue();
}
