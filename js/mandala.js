// Mandala — 9 blocks x 9 slots, read straight from public.mandala_cells.
//
// Previously the grid was rendered by merging a sparse localStorage-shaped
// override map over hardcoded defaults in data.js, against a Supabase project
// that no longer exists. Now every position is a real row, and "Reset to
// default" just copies the seeded default_* columns back.

import { sb } from './supabase.js';
import { userId } from './auth.js';
import { esc, toast } from './ui.js';

const OWNER_LABEL = { CEO: 'Yash (CEO)', Pres: 'Rohit (Pres)', CTO: 'Ashar (CTO)', All: 'All' };
const OWNER_CLASS = { CEO: 'cell--yash', Pres: 'cell--rohit', CTO: 'cell--ashar' };

let cells   = [];          // all 81 rows
let active  = null;        // the cell currently open in the editor
let channel = null;

const at = (block, slot) => cells.find(c => c.block_index === block && c.slot === slot);

// ── Data ────────────────────────────────────────────────────────────────────

async function fetchCells() {
  const { data, error } = await sb.from('mandala_cells')
    .select('*')
    .order('block_index')
    .order('slot');
  if (error) throw error;
  cells = data;
}

async function persist(cell, patch, failureMessage) {
  const idx      = cells.findIndex(c => c.block_index === cell.block_index && c.slot === cell.slot);
  const snapshot = { ...cells[idx] };

  cells[idx] = { ...cells[idx], ...patch };
  renderGrid();

  const { data, error } = await sb.from('mandala_cells')
    .update({ ...patch, updated_by: userId() })
    .eq('block_index', cell.block_index)
    .eq('slot', cell.slot)
    .select()
    .single();

  if (error) {
    cells[idx] = snapshot;
    renderGrid();
    toast(`${failureMessage} — ${error.message}`, 'error');
    return false;
  }
  cells[idx] = data;
  renderGrid();
  return true;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function buildCell(cell) {
  const div = document.createElement('div');

  const variant = cell.kind === 'core'     ? 'core'
                : cell.kind === 'surround' ? 'surround'
                : cell.kind === 'center'   ? 'theme'
                : !cell.label              ? 'empty'
                : cell.term === 'N'        ? 'near' : 'long';

  div.className = `cell cell--${variant}`;

  if (cell.tip) {
    div.classList.add('cell--has-tip');
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.textContent = cell.tip;
    div.appendChild(tip);
  }

  const span = document.createElement('span');
  span.textContent = cell.label;          // textContent, so labels can't inject markup
  div.appendChild(span);

  const dot = document.createElement('div');
  dot.className = 'tip-dot';
  div.appendChild(dot);

  if (cell.kind === 'cell' && cell.owner_code) {
    const tag = document.createElement('div');
    tag.className = 'owner-tag';
    tag.textContent = cell.owner_code;
    div.appendChild(tag);
    if (OWNER_CLASS[cell.owner_code]) div.classList.add(OWNER_CLASS[cell.owner_code]);
  }

  // The fixed centre goal is the one position that isn't editable.
  if (cell.kind !== 'core') {
    div.tabIndex = 0;
    div.setAttribute('role', 'button');
    const open = () => openEditor(cell);
    div.addEventListener('click', open);
    div.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  return div;
}

export function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let block = 0; block < 9; block++) {
    const el = document.createElement('div');
    el.className = 'block';
    for (let slot = 0; slot < 9; slot++) {
      const cell = at(block, slot);
      if (cell) {
        el.appendChild(buildCell(cell));
      } else {
        // CORE has four unused corners in the surround ring
        const blank = document.createElement('div');
        blank.className = 'cell cell--empty';
        el.appendChild(blank);
      }
    }
    grid.appendChild(el);
  }

  if (active) {
    const el = grid.querySelector(
      `.block:nth-child(${active.block_index + 1}) .cell:nth-child(${active.slot + 1})`);
    el?.classList.add('cell--active');
  }
}

// ── Editor ──────────────────────────────────────────────────────────────────

function openEditor(cell) {
  active = cell;
  const isLabelOnly = cell.kind !== 'cell';

  const editor = document.getElementById('editor');
  editor.classList.add('open');

  document.getElementById('e-label').value = (cell.label ?? '').replace(/\n/g, ' ');
  document.getElementById('e-owner').value = cell.owner_code ?? 'CEO';
  document.getElementById('e-term').value  = cell.term ?? 'L';
  document.getElementById('e-tip').value   = cell.tip ?? '';

  document.getElementById('e-meta-row').hidden = isLabelOnly;
  document.getElementById('e-tip-wrap').hidden = isLabelOnly;
  document.getElementById('e-context').textContent =
    isLabelOnly ? `${cell.block_name} — theme label` : cell.block_name;

  renderGrid();
  document.getElementById('e-label').focus();
  editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEditor() {
  document.getElementById('editor').classList.remove('open');
  active = null;
  renderGrid();
}

// ── Init ────────────────────────────────────────────────────────────────────

function wireEditor() {
  document.getElementById('e-save').addEventListener('click', async () => {
    if (!active) return;
    const label = document.getElementById('e-label').value.trim();

    const patch = active.kind === 'cell'
      ? { label,
          owner_code: document.getElementById('e-owner').value,
          term:       document.getElementById('e-term').value,
          tip:        document.getElementById('e-tip').value.trim() }
      : { label };

    const cell = active;
    closeEditor();
    if (await persist(cell, patch, 'Could not save cell')) toast('Saved for the whole team');
  });

  document.getElementById('e-clear').addEventListener('click', async () => {
    if (!active) return;
    const cell  = active;
    const patch = {
      label:      cell.default_label,
      owner_code: cell.default_owner,
      term:       cell.default_term,
      tip:        cell.default_tip,
    };
    closeEditor();
    if (await persist(cell, patch, 'Could not reset cell')) toast('Reset to default');
  });

  document.getElementById('e-cancel').addEventListener('click', closeEditor);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active) closeEditor();
  });
}

function subscribe() {
  channel = sb.channel('mandala-live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mandala_cells' }, ({ new: row }) => {
      const i = cells.findIndex(c => c.block_index === row.block_index && c.slot === row.slot);
      if (i !== -1) { cells[i] = row; renderGrid(); }
    })
    .subscribe();
}

export function buildLegend(people) {
  const el = document.getElementById('mandala-legend');
  if (!el) return;
  el.innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="background:#1a3a6e"></span>Near-term (&lt;12 months)</div>
    <div class="legend-item"><span class="legend-dot" style="background:#2A9D8F"></span>Long-term (12+ months)</div>
    <span class="legend-sep"></span>
    ${people.map(p => `
      <div class="legend-item">
        <span class="legend-stripe" style="background:${esc(p.accent)}"></span>${esc(p.label)} (${esc(p.role)})
      </div>`).join('')}`;
}

export async function initMandala() {
  const grid = document.getElementById('grid');
  try {
    await fetchCells();
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="tasks-error">Could not load the mandala — ${esc(err.message)}</div>`;
    return;
  }
  renderGrid();
  wireEditor();
  subscribe();
}

export function teardownMandala() {
  if (channel) { sb.removeChannel(channel); channel = null; }
}
