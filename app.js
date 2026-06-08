import { BLOCK_ORDER, SURROUND_KEYS, SURROUND_DISPLAY, CORE_LABEL, DEFAULTS } from './data.js';

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

const RAPIDAPI_KEY   = '258df5cc98mshcdc31725b41d656p184f11jsna354edbf6ed6';
const LI_CACHE_KEY   = 'elan_li_kpi';
const LI_CACHE_TTL   = 24 * 60 * 60 * 1000; // 24 hours

async function loadLinkedinKpi() {
  // Use cached value if less than 24 hours old
  try {
    const cached = JSON.parse(localStorage.getItem(LI_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.fetchedAt < LI_CACHE_TTL) {
      renderLinkedinKpi(cached.value, cached.date);
      return;
    }
  } catch { /* ignore bad cache */ }

  // Fetch fresh from RapidAPI
  try {
    const res = await fetch(
      'https://fresh-linkedin-profile-data.p.rapidapi.com/get-company-by-linkedinurl' +
      '?linkedin_url=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Felan-advisors%2F',
      {
        headers: {
          'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
          'x-rapidapi-key':  RAPIDAPI_KEY,
        },
      }
    );
    const { data } = await res.json();
    const value = data?.follower_count;
    if (value == null) throw new Error('no follower_count');

    const date = new Date().toISOString().slice(0, 10);
    localStorage.setItem(LI_CACHE_KEY, JSON.stringify({ value, date, fetchedAt: Date.now() }));
    renderLinkedinKpi(value, date);
  } catch {
    renderLinkedinKpi(null, null);
  }
}

function renderLinkedinKpi(value, date) {
  document.getElementById('kpi-linkedin').textContent =
    value != null ? Number(value).toLocaleString() : '—';
  document.getElementById('kpi-linkedin-date').textContent =
    date ? `Updated ${date}` : 'Auto-updated daily';
}

function renderKpis() {
  // Days since founding — calculated client-side, never stored
  const founded = new Date('2025-05-24');
  const days    = Math.floor((Date.now() - founded) / 86_400_000);
  document.getElementById('kpi-days').textContent = days.toLocaleString();

  // Website visits — manually updated via the modal
  const visits = state.__kpi_visits;
  document.getElementById('kpi-visits').textContent =
    visits ? Number(visits.value).toLocaleString() : '—';
  document.getElementById('kpi-visits-date').textContent =
    visits ? `Updated ${visits.date}` : '';
}

function openVisitsModal() {
  const cur = state.__kpi_visits;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">Update Website Visits</div>
      <label>Monthly visitors</label>
      <input id="modal-input" type="number" min="0" placeholder="e.g. 1 250"
             value="${cur?.value ?? ''}"/>
      <div class="modal-btns">
        <button class="btn" id="modal-cancel">Cancel</button>
        <button class="btn btn--primary" id="modal-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  backdrop.querySelector('#modal-input').focus();

  backdrop.querySelector('#modal-cancel').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#modal-save').onclick = async () => {
    const val = parseInt(backdrop.querySelector('#modal-input').value);
    if (isNaN(val)) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    state.__kpi_visits = { value: val, date };
    backdrop.remove();
    renderKpis();
    await saveState();
  };
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

// ── Visits modal ──────────────────────────────────────────────────────────────

document.getElementById('kpi-visits-btn').addEventListener('click', openVisitsModal);

// ── Status bar ────────────────────────────────────────────────────────────────

function setStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className   = isError ? 'status status--error' : 'status';
  if (message && !isError) {
    setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 3000);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

loadState();
loadLinkedinKpi();
