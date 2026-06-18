// ── Contact Finder / Enrichment ───────────────────────────────────────────────

async function lookupContact(firstName, lastName, company) {
  const res = await fetch('/.netlify/functions/apollo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, organization_name: company }),
  });
  return res.json();
}

// ── Email status badge ────────────────────────────────────────────────────────

function emailStatusBadge(status) {
  if (!status) return '';
  const map = {
    verified: { label: 'Verified',  bg: '#eaf7f0', color: '#1a7a4a' },
    likely:   { label: 'Likely',    bg: '#fef9e7', color: '#a0600a' },
    guessed:  { label: 'Guessed',   bg: '#fdf0f0', color: '#c0392b' },
  };
  const s = map[status] ?? { label: status, bg: '#f4faf9', color: '#5a7a78' };
  return `<span class="enrich-status-badge" style="background:${s.bg};color:${s.color};">${s.label}</span>`;
}

// ── Single lookup ─────────────────────────────────────────────────────────────

function resultRow(label, display, href, copyValue, extra) {
  if (!display) return `
    <div class="enrich-row enrich-row--missing">
      <span class="enrich-row-label">${label}</span>
      <span class="enrich-row-value enrich-row-value--none">Not found</span>
    </div>`;
  const link = href
    ? `<a href="${href}" target="_blank" class="enrich-link">${display}</a>`
    : `<span>${display}</span>`;
  return `
    <div class="enrich-row">
      <span class="enrich-row-label">${label}</span>
      <span class="enrich-row-value">
        ${link}
        ${extra ?? ''}
        ${copyValue ? `<button class="enrich-copy" data-copy="${copyValue}" title="Copy">⎘</button>` : ''}
      </span>
    </div>`;
}

const PHONE_TYPE_LABEL = {
  mobile:      { label: 'Mobile',   color: '#1a7a4a', bg: '#eaf7f0' },
  work_direct: { label: 'Direct',   color: '#1a7a4a', bg: '#eaf7f0' },
  work_hq:     { label: 'HQ',       color: '#5a7a78', bg: '#e8f5f3' },
  home:        { label: 'Home',     color: '#5a7a78', bg: '#e8f5f3' },
  other:       { label: 'Other',    color: '#9bbfba', bg: '#f4faf9' },
  unknown:     { label: 'Phone',    color: '#9bbfba', bg: '#f4faf9' },
};

function phoneTypeBadge(type) {
  const s = PHONE_TYPE_LABEL[type] ?? PHONE_TYPE_LABEL.unknown;
  return `<span class="enrich-status-badge" style="background:${s.bg};color:${s.color};">${s.label}</span>`;
}

function renderPhoneRows(phones, switchboard) {
  const rows = [];

  if (phones?.length) {
    phones.forEach(p => {
      rows.push(resultRow(
        'Phone', p.number, `tel:${p.number}`, p.number,
        phoneTypeBadge(p.type)
      ));
    });
  }

  // Show switchboard only if no direct numbers or as additional info
  if (switchboard && (!phones?.length || !phones.some(p => p.type === 'work_hq'))) {
    rows.push(resultRow('Switchboard', switchboard, `tel:${switchboard}`, switchboard));
  }

  if (!rows.length) {
    rows.push(resultRow('Phone', null, null, null));
  }

  return rows.join('');
}

function renderSingleResult(data, container) {
  if (!data.found) {
    container.innerHTML = `<div class="enrich-empty">No match found — this person may not be in our database (common for small UK SME owners).</div>`;
    return;
  }

  container.innerHTML = `
    <div class="enrich-result-card">
      <div class="enrich-result-name">${data.name}</div>
      ${data.title ? `<div class="enrich-result-title">${data.title}${data.company ? ` · ${data.company}` : ''}</div>` : ''}
      <div class="enrich-result-rows">
        ${resultRow('Email',
            data.email, `mailto:${data.email}`, data.email,
            emailStatusBadge(data.email_status))}
        ${renderPhoneRows(data.phones, data.switchboard)}
        ${resultRow('LinkedIn',
            data.linkedin ? 'View profile' : null, data.linkedin, data.linkedin)}
        ${resultRow('Location',
            data.location, null, data.location)}
      </div>
    </div>`;
}

function initSingleLookup() {
  const form    = document.getElementById('enrich-form');
  const result  = document.getElementById('enrich-single-result');
  const spinner = document.getElementById('enrich-spinner');

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const first   = document.getElementById('enrich-first').value.trim();
    const last    = document.getElementById('enrich-last').value.trim();
    const company = document.getElementById('enrich-company').value.trim();
    if (!first || !last || !company) return;

    result.innerHTML = '';
    spinner.style.display = 'block';
    try {
      const data = await lookupContact(first, last, company);
      renderSingleResult(data, result);
    } catch (err) {
      result.innerHTML = `<div class="enrich-empty enrich-empty--error">Error: ${err.message}</div>`;
    } finally {
      spinner.style.display = 'none';
    }
  });
}

// ── CSV bulk lookup ───────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return rows.map(r => ({
    first_name:        r.first_name || r.firstname || r.first || '',
    last_name:         r.last_name  || r.lastname  || r.last  || '',
    organization_name: r.company    || r.organization || r.org || '',
  }));
}

function buildXLSX(rows) {
  const headers = ['First Name', 'Last Name', 'Company', 'Title', 'Email', 'Email Status', 'Mobile / Direct', 'HQ Phone', 'LinkedIn', 'Location'];
  const data = [headers, ...rows.map(r => [
    r.first_name, r.last_name, r.company,
    r.title ?? '', r.email ?? '', r.email_status ?? '',
    r.direct_phone ?? '', r.hq_phone ?? '',
    r.linkedin ?? '', r.location ?? '',
  ])];

  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [12, 12, 18, 22, 30, 13, 36, 24, 18].map(w => ({ wch: w }));
    window.XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    window.XLSX.writeFile(wb, 'elan-enriched-contacts.xlsx');
  } else {
    const csv = data.map(r => r.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'elan-enriched-contacts.csv';
    a.click();
  }
}

function initBulkLookup() {
  const fileInput  = document.getElementById('enrich-csv-file');
  const runBtn     = document.getElementById('enrich-bulk-run');
  const progressEl = document.getElementById('enrich-bulk-progress');
  const tableEl    = document.getElementById('enrich-bulk-table');
  const exportBtn  = document.getElementById('enrich-bulk-export');

  let bulkResults = [];

  fileInput?.addEventListener('change', () => {
    const name = fileInput.files[0]?.name ?? '';
    document.getElementById('enrich-file-label').textContent = name || 'Choose CSV file';
    runBtn.disabled = !name;
  });

  runBtn?.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const text = await file.text();
    let contacts;
    try { contacts = parseCSV(text); }
    catch (err) { progressEl.textContent = `CSV error: ${err.message}`; return; }

    bulkResults = [];
    tableEl.innerHTML = '';
    exportBtn.style.display = 'none';
    runBtn.disabled = true;

    tableEl.innerHTML = `
      <div class="enrich-table-head">
        <div>Name</div><div>Company</div><div>Title</div>
        <div>Email</div><div>Status</div><div>Phone(s)</div><div>LinkedIn</div>
      </div>`;

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      progressEl.textContent = `Looking up ${i + 1} of ${contacts.length} — ${c.first_name} ${c.last_name}…`;

      let result = { found: false };
      try {
        result = await lookupContact(c.first_name, c.last_name, c.organization_name);
      } catch {}

      // Best direct number: prefer mobile/direct over hq
      const phones = result.phones ?? [];
      const directPhone = phones.find(p => p.type === 'mobile' || p.type === 'work_direct')?.number
                       ?? phones.find(p => p.type !== 'work_hq')?.number
                       ?? null;
      const hqPhone = phones.find(p => p.type === 'work_hq')?.number ?? result.switchboard ?? null;

      const row = {
        first_name:   c.first_name,
        last_name:    c.last_name,
        company:      result.company || c.organization_name,
        title:        result.title        ?? '',
        email:        result.email        ?? '',
        email_status: result.email_status ?? '',
        direct_phone: directPhone         ?? '',
        hq_phone:     hqPhone             ?? '',
        linkedin:     result.linkedin     ?? '',
        location:     result.location     ?? '',
      };
      bulkResults.push(row);

      const allPhones = phones.map(p => `${p.number} (${PHONE_TYPE_LABEL[p.type]?.label ?? p.type})`).join('<br>') || (hqPhone ? `${hqPhone} (HQ)` : '—');

      const el = document.createElement('div');
      el.className = 'enrich-table-row' + (result.found ? '' : ' enrich-table-row--miss');
      el.innerHTML = `
        <div>${c.first_name} ${c.last_name}</div>
        <div>${row.company}</div>
        <div>${row.title || '—'}</div>
        <div>${row.email ? `<a href="mailto:${row.email}" class="enrich-link">${row.email}</a>` : '—'}</div>
        <div>${row.email_status ? emailStatusBadge(row.email_status) : '—'}</div>
        <div>${allPhones}</div>
        <div>${row.linkedin ? `<a href="${row.linkedin}" target="_blank" class="enrich-link">↗</a>` : '—'}</div>`;
      tableEl.appendChild(el);

      if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 350));
    }

    const found = bulkResults.filter(r => r.email).length;
    progressEl.textContent = `Done — ${contacts.length} contacts processed, ${found} emails found.`;
    runBtn.disabled = false;
    if (bulkResults.length) exportBtn.style.display = 'inline-flex';
  });

  exportBtn?.addEventListener('click', () => buildXLSX(bulkResults));
}

// ── Copy to clipboard ─────────────────────────────────────────────────────────

function initCopyButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.enrich-copy');
    if (!btn) return;
    navigator.clipboard.writeText(btn.dataset.copy || '').then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initEnrichment() {
  initSingleLookup();
  initBulkLookup();
  initCopyButtons();
}
