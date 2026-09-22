// Bootstrap: auth gate, tab routing, module lifecycle.

import { sb } from './supabase.js';
import { showGate, hideGate, renderUserChip, setCurrentUser } from './auth.js';
import { initTasks, teardownTasks } from './tasks.js';
import { initMandala, teardownMandala, buildLegend } from './mandala.js';
import { initMetrics, redrawCharts } from './metrics.js';
import { toast } from './ui.js';

const TABS = ['mandala', 'metrics', 'tasks'];
let booted = false;

// ── Tabs ────────────────────────────────────────────────────────────────────

function activateTab(name) {
  if (!TABS.includes(name)) name = 'metrics';

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('tab--active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('tab-panel--active', p.id === `tab-${name}`));

  // Canvases have no width while hidden, so charts are drawn on activation.
  if (name === 'metrics') requestAnimationFrame(() => redrawCharts());

  if (location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach(tab =>
    tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1)));
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

async function boot(user) {
  if (booted) return;
  booted = true;

  setCurrentUser(user);
  hideGate();
  renderUserChip(user);
  wireTabs();

  const { data: people } = await sb.from('people').select('*').order('sort_order');
  if (people) buildLegend(people);

  await Promise.all([
    initMandala(),
    initTasks(),
    initMetrics(),
  ]);

  activateTab(location.hash.slice(1) || 'metrics');
}

function shutdown() {
  if (!booted) { showGate(); return; }
  booted = false;
  teardownTasks();
  teardownMandala();
  setCurrentUser(null);
  showGate();
}

// ── Auth state ──────────────────────────────────────────────────────────────

sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    boot(session.user);
  } else if (event === 'SIGNED_OUT') {
    // Full reload clears every module's in-memory state — simplest way to be
    // certain nothing from the previous session lingers in the DOM.
    location.reload();
  }
});

(async function start() {
  const { data: { session }, error } = await sb.auth.getSession();
  if (error) toast(`Auth check failed — ${error.message}`, 'error');
  if (session?.user) boot(session.user);
  else shutdown();
})();
