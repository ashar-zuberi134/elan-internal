const SUPABASE_URL = 'https://sofzlqjszuskvwlkxvhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZnpscWpzenVza3Z3bGt4dmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjYsImV4cCI6MjA5NjQ3MzIyNn0.SGkwZg1k89w5qxixLqfckCuVoPY5UPX4Af7QIc8bVFQ';

let data = null;
let activeTab = 'with-multiples';

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadData() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/multiples?id=eq.1&select=data`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const rows = await res.json();
  data = rows[0]?.data ?? {};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function multipleCell(v) {
  if (v == null) return '<td class="mul-td mul-td--right mul-td--muted">—</td>';
  const num = parseFloat(v);
  let cls = 'mul-multiple';
  if (num >= 15)      cls += ' mul-multiple--high';
  else if (num >= 8)  cls += ' mul-multiple--mid';
  else                cls += ' mul-multiple--low';
  return `<td class="mul-td mul-td--right"><span class="${cls}">${num.toFixed(1)}x</span></td>`;
}

function filingLink(url, label) {
  if (!url) return '—';
  return `<a class="mul-filing-link" href="${url}" target="_blank" rel="noopener">${label} ↗</a>`;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function renderSummary() {
  const ev = data.dealsWithEV ?? [];
  const ebitdaVals = ev.map(r => r.evEbitda).filter(v => v != null);
  const revVals    = ev.map(r => r.evRevenue).filter(v => v != null);

  document.getElementById('mul-summary').innerHTML = `
    <div class="mul-stat">
      <span class="mul-stat-n">${(data.dealsWithEV?.length ?? 0) + (data.dealsWithoutEV?.length ?? 0) + (data.pressReported?.length ?? 0)}</span>
      <span class="mul-stat-l">Total Deals</span>
    </div>
    <div class="mul-stat">
      <span class="mul-stat-n">${ebitdaVals.length}</span>
      <span class="mul-stat-l">EV/EBITDA Comps</span>
    </div>
    <div class="mul-stat mul-stat--highlight">
      <span class="mul-stat-n">${median(ebitdaVals).toFixed(1)}x</span>
      <span class="mul-stat-l">Median EV/EBITDA</span>
    </div>
    <div class="mul-stat mul-stat--highlight">
      <span class="mul-stat-n">${median(revVals).toFixed(1)}x</span>
      <span class="mul-stat-l">Median EV/Revenue</span>
    </div>
  `;
}

// ── Tab: With Multiples ───────────────────────────────────────────────────────

function renderWithMultiples() {
  const rows = (data.dealsWithEV ?? []).filter(r => r.evEbitda != null || r.evRevenue != null);
  return `
    <div class="mul-table-wrap">
      <table class="mul-table">
        <thead>
          <tr>
            <th class="mul-th">#</th>
            <th class="mul-th">Target</th>
            <th class="mul-th">Buyer</th>
            <th class="mul-th">Date</th>
            <th class="mul-th mul-th--right">Consideration</th>
            <th class="mul-th mul-th--right">Revenue</th>
            <th class="mul-th mul-th--right">EBITDA</th>
            <th class="mul-th mul-th--right">EV/EBITDA</th>
            <th class="mul-th mul-th--right">EV/Revenue</th>
            <th class="mul-th">EBITDA Basis</th>
            <th class="mul-th">Filings</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="mul-row" data-key="${r.num}">
              <td class="mul-td mul-td--num">${r.num}</td>
              <td class="mul-td mul-td--company">${r.target ?? '—'}</td>
              <td class="mul-td mul-td--buyer">${r.buyer ?? '—'}</td>
              <td class="mul-td mul-td--date">${fmtDate(r.dealDate)}</td>
              <td class="mul-td mul-td--right">${r.consideration ?? '—'}</td>
              <td class="mul-td mul-td--right">${r.revenue ?? '—'}</td>
              <td class="mul-td mul-td--right">${r.ebitda ?? '—'}</td>
              ${multipleCell(r.evEbitda)}
              ${multipleCell(r.evRevenue)}
              <td class="mul-td mul-td--basis">${r.ebitdaCalc ?? '—'}</td>
              <td class="mul-td mul-td--filings">
                ${filingLink(r.targetFilingUrl, 'Target')}
                ${r.targetFilingUrl && r.buyerFilingUrl ? '<span class="mul-filing-sep">·</span>' : ''}
                ${filingLink(r.buyerFilingUrl, 'Buyer')}
              </td>
            </tr>
            ${r.keySentence ? `
            <tr class="mul-row-detail" data-detail="${r.num}">
              <td colspan="11" class="mul-td-detail">${r.keySentence}</td>
            </tr>` : ''}
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Tab: EV but no multiples ──────────────────────────────────────────────────

function renderEvNoMultiples() {
  const rows = (data.dealsWithEV ?? []).filter(r => r.evEbitda == null && r.evRevenue == null);
  return `
    <div class="mul-table-wrap">
      <table class="mul-table">
        <thead>
          <tr>
            <th class="mul-th">#</th>
            <th class="mul-th">Target</th>
            <th class="mul-th">Buyer</th>
            <th class="mul-th">Date</th>
            <th class="mul-th mul-th--right">Consideration</th>
            <th class="mul-th">Filings</th>
            <th class="mul-th">Note</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="mul-row">
              <td class="mul-td mul-td--num">${r.num}</td>
              <td class="mul-td mul-td--company">${r.target ?? '—'}</td>
              <td class="mul-td mul-td--buyer">${r.buyer ?? '—'}</td>
              <td class="mul-td mul-td--date">${fmtDate(r.dealDate)}</td>
              <td class="mul-td mul-td--right">${r.consideration ?? '—'}</td>
              <td class="mul-td mul-td--filings">
                ${filingLink(r.targetFilingUrl, 'Target')}
                ${r.targetFilingUrl && r.buyerFilingUrl ? '<span class="mul-filing-sep">·</span>' : ''}
                ${filingLink(r.buyerFilingUrl, 'Buyer')}
              </td>
              <td class="mul-td mul-td--basis mul-td--muted">${r.keySentence ? r.keySentence.slice(0, 120) + (r.keySentence.length > 120 ? '…' : '') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Tab: No EV ────────────────────────────────────────────────────────────────

function renderNoEv() {
  const rows = data.dealsWithoutEV ?? [];
  return `
    <div class="mul-table-wrap">
      <table class="mul-table">
        <thead>
          <tr>
            <th class="mul-th">#</th>
            <th class="mul-th">Target</th>
            <th class="mul-th">Buyer</th>
            <th class="mul-th">Date</th>
            <th class="mul-th">Source Note</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="mul-row">
              <td class="mul-td mul-td--num">${r.num}</td>
              <td class="mul-td mul-td--company">${r.target ?? '—'}</td>
              <td class="mul-td mul-td--buyer">${r.buyer ?? '—'}</td>
              <td class="mul-td mul-td--date">${fmtDate(r.dealDate)}</td>
              <td class="mul-td mul-td--note">${r.keySentence ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Tab: Press Reported ───────────────────────────────────────────────────────

function renderPress() {
  const rows = data.pressReported ?? [];
  return `
    <p class="mul-disclaimer">Deal values sourced from press coverage. Not verified against Companies House filings.</p>
    <div class="mul-table-wrap">
      <table class="mul-table">
        <thead>
          <tr>
            <th class="mul-th">#</th>
            <th class="mul-th">Target</th>
            <th class="mul-th">Buyer</th>
            <th class="mul-th mul-th--right">Year</th>
            <th class="mul-th mul-th--right">Deal Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="mul-row">
              <td class="mul-td mul-td--num">${r.num}</td>
              <td class="mul-td mul-td--company">${r.target ?? '—'}</td>
              <td class="mul-td mul-td--buyer">${r.buyer ?? '—'}</td>
              <td class="mul-td mul-td--right">${r.year ?? '—'}</td>
              <td class="mul-td mul-td--right mul-td--strong">${r.dealValue ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Render panel ──────────────────────────────────────────────────────────────

function renderPanel() {
  const panel = document.getElementById('mul-panel');
  if (!panel) return;
  if      (activeTab === 'with-multiples') panel.innerHTML = renderWithMultiples();
  else if (activeTab === 'ev-no-multiples') panel.innerHTML = renderEvNoMultiples();
  else if (activeTab === 'no-ev')          panel.innerHTML = renderNoEv();
  else if (activeTab === 'press')          panel.innerHTML = renderPress();

  // Toggle key sentence rows on click
  panel.querySelectorAll('.mul-row[data-key]').forEach(row => {
    row.addEventListener('click', () => {
      const detail = panel.querySelector(`.mul-row-detail[data-detail="${row.dataset.key}"]`);
      if (detail) detail.classList.toggle('mul-row-detail--open');
    });
  });
}

function renderCounts() {
  const ev = data.dealsWithEV ?? [];
  document.getElementById('mc-with').textContent  = ev.filter(r => r.evEbitda != null || r.evRevenue != null).length;
  document.getElementById('mc-evno').textContent  = ev.filter(r => r.evEbitda == null && r.evRevenue == null).length;
  document.getElementById('mc-noev').textContent  = (data.dealsWithoutEV ?? []).length;
  document.getElementById('mc-press').textContent = (data.pressReported ?? []).length;
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initMultiples() {
  const panel = document.getElementById('mul-panel');
  if (panel) panel.innerHTML = '<div style="padding:40px;text-align:center;color:#9bbfba;">Loading…</div>';

  await loadData();
  renderSummary();
  renderCounts();
  renderPanel();

  document.querySelectorAll('.mul-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mul-tab').forEach(b => b.classList.remove('mul-tab--active'));
      btn.classList.add('mul-tab--active');
      activeTab = btn.dataset.mulTab;
      renderPanel();
    });
  });
}
