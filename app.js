import { BLOCK_ORDER, SURROUND_KEYS, SURROUND_DISPLAY, CORE_LABEL, DEFAULTS } from './data.js';
import { initCrm, renderList as crmRenderList } from './crm.js';
import { initTasks } from './tasks.js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://crktlztfsyqbwnguqqjl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNya3RsenRmc3lxYnduZ3VxcWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDI4NjYsImV4cCI6MjA5MzQ3ODg2Nn0.IGpfgsGw0NNadnfm8kA-yY6b3wW-9q5o0PRA8CI1LS4';
const TABLE  = 'mandala';
const ROW_ID = 1;

const SB_HEADERS = {
  apikey:        SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ── State ─────────────────────────────────────────────────────────────────────

let state = {};
let activeKey     = null;
let activeDiv     = null;
let activeIsTheme = false;
let activeDefault = null;

// ── Supabase ──────────────────────────────────────────────────────────────────

async function loadState() {
  setStatus('Loading…');
  try {
    const res  = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`,
      { headers: SB_HEADERS }
    );
    const rows = await res.json();
    state = rows?.[0]?.data ?? {};
    setStatus('');
  } catch {
    state = {};
  }
  renderKpis();
  renderGrid();
}

async function saveState() {
  setStatus('Saving…');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method:  'POST',
      headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates' },
      body:    JSON.stringify({ id: ROW_ID, data: state }),
    });
    if (res.ok || res.status === 201 || res.status === 204) {
      setStatus('Saved for the whole team');
    } else {
      throw new Error(await res.text());
    }
  } catch (err) {
    setStatus(`Save failed — ${err.message}`, true);
  }
}

// ── KPI Bar ───────────────────────────────────────────────────────────────────

const RAPIDAPI_KEY = '258df5cc98mshcdc31725b41d656p184f11jsna354edbf6ed6';
const LI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function liCachedFetch(cacheKey, url) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.fetchedAt < LI_CACHE_TTL) return cached;
  } catch { /* ignore bad cache */ }

  const res  = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
      'x-rapidapi-key':  RAPIDAPI_KEY,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadLinkedinKpi() {
  try {
    const cacheKey = 'elan_li_company';
    let result;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.fetchedAt < LI_CACHE_TTL) {
        result = cached;
      } else {
        const json  = await liCachedFetch(cacheKey,
          'https://fresh-linkedin-profile-data.p.rapidapi.com/get-company-by-linkedinurl' +
          '?linkedin_url=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Felan-advisors%2F'
        );
        const value = json?.data?.follower_count;
        const date  = new Date().toISOString().slice(0, 10);
        result      = { value, date, fetchedAt: Date.now() };
        localStorage.setItem(cacheKey, JSON.stringify(result));
      }
    } catch { result = {}; }

    document.getElementById('kpi-linkedin').textContent =
      result.value != null ? Number(result.value).toLocaleString() : '—';
    document.getElementById('kpi-linkedin-date').textContent =
      result.date ? `Updated ${result.date}` : 'Auto-updated daily';
  } catch { /* silent */ }
}

async function loadPersonalLinkedinKpis() {
  const people = [
    {
      id:    'kpi-li-yash',
      key:   'elan_li_yash',
      url:   'https%3A%2F%2Fwww.linkedin.com%2Fin%2Fyash-agrawal-6495a3149%2F',
    },
    {
      id:    'kpi-li-rohit',
      key:   'elan_li_rohit',
      url:   'https%3A%2F%2Fwww.linkedin.com%2Fin%2Frohit-maini-a96b4b69%2F',
    },
    {
      id:    'kpi-li-ashar',
      key:   'elan_li_ashar',
      url:   'https%3A%2F%2Fwww.linkedin.com%2Fin%2Fashar-zuberi-a0845a19b%2F',
    },
  ];

  await Promise.all(people.map(async ({ id, key, url }) => {
    try {
      let result;
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.fetchedAt < LI_CACHE_TTL) {
        result = cached;
      } else {
        const json  = await fetch(
          'https://fresh-linkedin-profile-data.p.rapidapi.com/enrich-lead' +
          `?linkedin_url=${url}&include_skills=false&include_certifications=false` +
          '&include_profile_status=false&include_company_public_url=false',
          {
            headers: {
              'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
              'x-rapidapi-key':  RAPIDAPI_KEY,
            },
          }
        ).then(r => r.json());
        const value = json?.data?.follower_count ?? json?.follower_count ?? null;
        const date  = new Date().toISOString().slice(0, 10);
        result      = { value, date, fetchedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(result));
      }

      const card = document.getElementById(id);
      if (!card) return;
      card.querySelector('.metric-value').textContent =
        result.value != null ? Number(result.value).toLocaleString() : '—';
      card.querySelector('.metric-meta').textContent =
        result.date ? `Updated ${result.date}` : '';
      card.classList.remove('metric-card--placeholder');
    } catch { /* leave as placeholder */ }
  }));
}

function renderKpis() {
  // Days since founding — calculated client-side, never stored
  const founded = new Date('2025-05-24');
  const days    = Math.floor((Date.now() - founded) / 86_400_000);
  document.getElementById('kpi-days').textContent = days.toLocaleString();

}

// ── Grid ──────────────────────────────────────────────────────────────────────

function cellKey(blockIndex, row, col) {
  return `em_b${blockIndex}_r${row}_c${col}`;
}

function buildCell({ text = '', variant = '', owner = '', tip = '', key = null, isTheme = false, def = null }) {
  const div = document.createElement('div');
  div.className = `cell cell--${variant}`;
  if (tip) div.classList.add('cell--has-tip');

  // Tooltip
  if (tip) {
    const tt = document.createElement('div');
    tt.className = 'tooltip';
    tt.textContent = tip;
    div.appendChild(tt);
  }

  // Label span
  const span = document.createElement('span');
  span.textContent = text;
  div.appendChild(span);

  // Tip indicator dot
  const dot = document.createElement('div');
  dot.className = 'tip-dot';
  div.appendChild(dot);

  // Owner tag (only on editable data cells)
  if (owner) {
    const tag = document.createElement('div');
    tag.className = 'owner-tag';
    tag.textContent = owner;
    div.appendChild(tag);
  }

  // Click handler
  if (key) {
    div.addEventListener('click', () => {
      const saved = state[key] ?? {};
      openEditor(div, key, span.textContent, saved.owner ?? def?.o ?? 'CEO', saved.term ?? def?.t ?? 'L', tip, isTheme, def);
    });
  }

  return div;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  BLOCK_ORDER.forEach((theme, blockIndex) => {
    const block = document.createElement('div');
    block.className = 'block';
    const isCore = theme === 'CORE';
    const def    = DEFAULTS[theme];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const isCenter = row === 1 && col === 1;
        let cell;

        if (isCore) {
          if (isCenter) {
            cell = buildCell({ text: CORE_LABEL, variant: 'core' });
          } else {
            const surroundKey = SURROUND_KEYS[row * 3 + col];
            if (surroundKey) {
              const stateKey   = `surround_${surroundKey.replace(/\W+/g, '_')}`;
              const savedLabel = state[stateKey]?.label;
              const display    = SURROUND_DISPLAY[surroundKey] ?? surroundKey;
              cell = buildCell({
                text:    savedLabel ?? display,
                variant: 'surround',
                key:     stateKey,
                isTheme: true,
                def:     { label: display },
              });
            } else {
              cell = buildCell({ variant: 'empty' });
            }
          }
        } else if (def) {
          if (isCenter) {
            const stateKey   = `center_${theme.replace(/\W+/g, '_')}`;
            const savedLabel = state[stateKey]?.label;
            cell = buildCell({
              text:    savedLabel ?? def.center,
              variant: 'theme',
              key:     stateKey,
              isTheme: true,
              def:     { label: def.center },
            });
          } else {
            const linearIndex = row * 3 + col;
            const cellIndex   = linearIndex < 5 ? linearIndex : linearIndex - 1; // skip centre
            const defaults    = def.cells[cellIndex] ?? null;
            const stateKey    = cellKey(blockIndex, row, col);
            const saved       = state[stateKey];

            const label = saved?.label ?? defaults?.l ?? '';
            const owner = saved?.owner ?? defaults?.o ?? 'CEO';
            const term  = saved?.term  ?? defaults?.t ?? 'L';
            const tip   = saved?.tip   ?? defaults?.tip ?? '';

            cell = buildCell({
              text:    label,
              variant: label ? (term === 'N' ? 'near' : 'long') : 'empty',
              owner,
              tip,
              key:     stateKey,
              def:     defaults,
            });
          }
        }

        if (cell) block.appendChild(cell);
      }
    }

    grid.appendChild(block);
  });
}

// ── Editor ────────────────────────────────────────────────────────────────────

function openEditor(div, key, label, owner, term, tip, isTheme, def) {
  if (activeDiv) activeDiv.classList.remove('cell--active');

  activeKey     = key;
  activeDiv     = div;
  activeIsTheme = isTheme;
  activeDefault = def;

  div.classList.add('cell--active');

  const editor = document.getElementById('editor');
  editor.classList.add('open');
  document.getElementById('e-label').value = label.replace(/\n/g, ' ');
  document.getElementById('e-owner').value = owner || 'CEO';
  document.getElementById('e-term').value  = term  || 'L';
  document.getElementById('e-tip').value   = tip   || '';

  // Hide owner/term/tip for theme/surround cells — they only have a label
  document.getElementById('e-meta-row').style.display = isTheme ? 'none' : 'grid';
  document.getElementById('e-tip-wrap').style.display  = isTheme ? 'none' : 'block';

  document.getElementById('e-label').focus();
  editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEditor() {
  document.getElementById('editor').classList.remove('open');
  if (activeDiv) activeDiv.classList.remove('cell--active');
  activeKey = activeDiv = activeDefault = null;
  activeIsTheme = false;
}

// ── Editor button handlers ────────────────────────────────────────────────────

document.getElementById('e-save').addEventListener('click', async () => {
  if (!activeKey) return;
  const label = document.getElementById('e-label').value.trim();

  if (activeIsTheme) {
    state[activeKey] = { label };
  } else {
    state[activeKey] = {
      label,
      owner: document.getElementById('e-owner').value,
      term:  document.getElementById('e-term').value,
      tip:   document.getElementById('e-tip').value.trim(),
    };
  }
  closeEditor();
  await saveState();
  renderGrid();
});

document.getElementById('e-clear').addEventListener('click', async () => {
  if (!activeKey) return;
  delete state[activeKey];
  closeEditor();
  await saveState();
  renderGrid();
});

document.getElementById('e-cancel').addEventListener('click', closeEditor);

// ── Google Analytics ──────────────────────────────────────────────────────────

const GA_CACHE_KEY = 'elan_ga_data';

async function loadAnalytics() {
  const badge = document.getElementById('ga-status');

  // Try cache first (1 hour TTL — GA data doesn't change minute-to-minute)
  try {
    const cached = JSON.parse(localStorage.getItem(GA_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
      renderAnalytics(cached);
      badge.textContent = `Updated ${new Date(cached.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      return;
    }
  } catch { /* ignore */ }

  try {
    const res  = await fetch('/.netlify/functions/analytics');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const payload = { ...data, fetchedAt: Date.now() };
    localStorage.setItem(GA_CACHE_KEY, JSON.stringify(payload));
    renderAnalytics(payload);
    badge.textContent = 'Live';
    badge.classList.add('section-badge--live');
  } catch (err) {
    badge.textContent = 'Unavailable';
    badge.classList.add('section-badge--error');
  }
}

function renderAnalytics({ summary, daily, sources, pages }) {
  const pct  = v => `${(v * 100).toFixed(1)}%`;
  const num  = v => Number(v).toLocaleString();

  document.getElementById('ga-sessions').textContent    = num(summary.sessions);
  document.getElementById('ga-users').textContent       = num(summary.users);
  document.getElementById('ga-new-users').textContent   = num(summary.newUsers);
  document.getElementById('ga-engagement').textContent  = pct(summary.engagementRate);
  document.getElementById('ga-bounce').textContent      = pct(summary.bounceRate);

  renderSparkline(daily);
  renderSources(sources);
  renderPages(pages);
}

function renderSparkline(daily) {
  const canvas = document.getElementById('ga-spark');
  if (!canvas || !daily.length) return;
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const W      = canvas.parentElement.clientWidth;
  const H      = 80;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const vals   = daily.map(d => d.sessions);
  const maxVal = Math.max(...vals, 1);
  const barW   = (W - (vals.length - 1) * 2) / vals.length;

  vals.forEach((v, i) => {
    const barH = Math.max(2, (v / maxVal) * (H - 16));
    const x    = i * (barW + 2);
    const y    = H - barH;
    ctx.fillStyle = '#2A9D8F';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 2);
    ctx.fill();
  });
}

function renderSources(sources) {
  const el    = document.getElementById('ga-sources');
  if (!el || !sources.length) return;
  const total = sources.reduce((s, r) => s + r.sessions, 0) || 1;
  const colors = ['#2A9D8F', '#002060', '#E9A23B', '#5a7a78', '#c8e8e3', '#9bbfba'];

  el.innerHTML = sources.map((s, i) => {
    const pct = ((s.sessions / total) * 100).toFixed(1);
    return `
      <div class="source-row">
        <div class="source-bar-wrap">
          <div class="source-bar" style="width:${pct}%;background:${colors[i % colors.length]};"></div>
        </div>
        <div class="source-label">${s.channel}</div>
        <div class="source-pct">${pct}%</div>
      </div>`;
  }).join('');
}

function renderPages(pages) {
  const el = document.getElementById('ga-pages');
  if (!el || !pages.length) return;
  const maxViews = Math.max(...pages.map(p => p.views), 1);

  el.innerHTML = pages.map(p => {
    const pct = ((p.views / maxViews) * 100).toFixed(1);
    return `
      <div class="page-row">
        <div class="page-path">${p.path}</div>
        <div class="page-bar-wrap">
          <div class="page-bar" style="width:${pct}%;"></div>
        </div>
        <div class="page-views">${Number(p.views).toLocaleString()}</div>
      </div>`;
  }).join('');
}

// ── Status bar ────────────────────────────────────────────────────────────────

function setStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className   = isError ? 'status status--error' : 'status';
  if (message && !isError) {
    setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 3000);
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
    tab.classList.add('tab--active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('tab-panel--active');
  });
});

initCrm();
initTasks();

// ── Boot ──────────────────────────────────────────────────────────────────────

loadState();
loadLinkedinKpi();
loadPersonalLinkedinKpis();
loadAnalytics();
