// ── Contact Finder / Enrichment ───────────────────────────────────────────────

async function lookupContact(firstName, lastName, company) {
  const res = await fetch('/.netlify/functions/apollo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, organization_name: company }),
  });
  return res.json();
}

// ── Single lookup ─────────────────────────────────────────────────────────────

function renderSingleResult(data, container) {
  if (!data.found) {
    container.innerHTML = `<div class="enrich-empty">No match found in Apollo for this contact.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="enrich-result-card">
      <div class="enrich-result-name">${data.name}</div>
      ${data.title   ? `<div class="enrich-result-title">${data.title} · ${data.company}</div>` : ''}
      <div class="enrich-result-rows">
        ${resultRow('Email',    data.email,    data.email    ? `mailto:${data.email}` : null, 'email')}
        ${resultRow('Phone',    data.phone,    data.phone    ? `tel:${data.phone}`    : null, 'phone')}
        ${resultRow('LinkedIn', data.linkedin ? 'View profile' : null, data.linkedin, 'linkedin')}
      </div>
    </div>`;
}

function resultRow(label, display, href, type) {
  if (!display) return `
    <div class="enrich-row enrich-row--missing">
      <span class="enrich-row-label">${label}</span>
      <span class="enrich-row-value enrich-row-value--none">Not found</span>
    </div>`;
  return `
    <div class="enrich-row">
      <span class="enrich-row-label">${label}</span>
      <span class="enrich-row-value">
        <a href="${href}" target="_blank" class="enrich-link">${display}</a>
        <button class="enrich-copy" data-copy="${display === 'View profile' ? href : display}" title="Copy">⎘</button>
      </span>
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

    result.innerHTML  = '';
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
  const rows   = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  // normalise column names
  return rows.map(r => ({
    first_name:        r.first_name || r.firstname || r.first || '',
    last_name:         r.last_name  || r.lastname  || r.last  || '',
    organization_name: r.company    || r.organization || r.org || '',
  }));
}

function buildXLSX(rows) {
  // rows: array of objects with header keys
  const headers = ['First Name', 'Last Name', 'Company', 'Title', 'Email', 'Phone', 'LinkedIn'];
  const data = [headers, ...rows.map(r => [
    r.first_name, r.last_name, r.company, r.title ?? '', r.email ?? '', r.phone ?? '', r.linkedin ?? '',
  ])];

  // Build CSV string as fallback (SheetJS loaded separately)
  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [12,12,18,20,28,16,36].map(w => ({ wch: w }));
    window.XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    window.XLSX.writeFile(wb, 'elan-contacts.xlsx');
  } else {
    // fallback: download as CSV
    const csv = data.map(r => r.map(v => `"${(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'elan-contacts.csv';
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

    // Table header
    tableEl.innerHTML = `
      <div class="enrich-table-head">
        <div>Name</div><div>Company</div><div>Title</div>
        <div>Email</div><div>Phone</div><div>LinkedIn</div>
      </div>`;

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      progressEl.textContent = `Looking up ${i + 1} of ${contacts.length}…`;

      let result = { found: false, first_name: c.first_name, last_name: c.last_name, company: c.organization_name };
      try {
        const data = await lookupContact(c.first_name, c.last_name, c.organization_name);
        if (data.found) result = { ...data, first_name: c.first_name, last_name: c.last_name };
      } catch {}

      bulkResults.push({
        first_name: c.first_name,
        last_name:  c.last_name,
        company:    result.company || c.organization_name,
        title:      result.title   || '',
        email:      result.email   || '',
        phone:      result.phone   || '',
        linkedin:   result.linkedin || '',
      });

      const row = document.createElement('div');
      row.className = 'enrich-table-row' + (result.found ? '' : ' enrich-table-row--miss');
      row.innerHTML = `
        <div>${c.first_name} ${c.last_name}</div>
        <div>${c.organization_name}</div>
        <div>${result.title || '—'}</div>
        <div>${result.email    ? `<a href="mailto:${result.email}" class="enrich-link">${result.email}</a>`       : '—'}</div>
        <div>${result.phone    ? `<a href="tel:${result.phone}" class="enrich-link">${result.phone}</a>`          : '—'}</div>
        <div>${result.linkedin ? `<a href="${result.linkedin}" target="_blank" class="enrich-link">LinkedIn</a>`  : '—'}</div>`;
      tableEl.appendChild(row);

      // small delay to avoid rate-limiting
      if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    progressEl.textContent = `Done — ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} processed.`;
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
