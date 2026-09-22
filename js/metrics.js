// Metrics — company, LinkedIn and Google Analytics.
//
// LinkedIn now comes from /.netlify/functions/linkedin, which holds the
// RapidAPI key server-side and caches one value per target per day for the
// whole team, rather than every browser burning its own credits.

import { FOUNDED_ON } from './config.js';
import { esc } from './ui.js';

const num = v => Number(v).toLocaleString();
const pct = v => `${(Number(v) * 100).toFixed(1)}%`;

let lastAnalytics = null;

// ── Company ─────────────────────────────────────────────────────────────────

function renderFoundingCounter() {
  const el = document.getElementById('kpi-days');
  if (!el) return;
  const days = Math.floor((Date.now() - new Date(FOUNDED_ON)) / 86_400_000);
  el.textContent = num(days);
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

async function loadLinkedin() {
  const slots = {
    company: 'kpi-linkedin',
    yash:    'kpi-li-yash',
    rohit:   'kpi-li-rohit',
    ashar:   'kpi-li-ashar',
  };

  try {
    const res  = await fetch('/.netlify/functions/linkedin');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    for (const [name, id] of Object.entries(slots)) {
      const card = document.getElementById(id);
      if (!card) continue;
      const entry = data[name] ?? {};
      const value = card.querySelector('.metric-value');
      const meta  = card.querySelector('.metric-meta');
      if (value) value.textContent = entry.value != null ? num(entry.value) : '—';
      if (meta)  meta.textContent  = entry.date ? `Updated ${entry.date}` : 'Unavailable';
      card.classList.toggle('metric-card--placeholder', entry.value == null);
    }
  } catch {
    for (const id of Object.values(slots)) {
      const meta = document.getElementById(id)?.querySelector('.metric-meta');
      if (meta) meta.textContent = 'Unavailable';
    }
  }
}

// ── Google Analytics ────────────────────────────────────────────────────────

async function loadAnalytics() {
  const badge = document.getElementById('ga-status');
  if (badge) badge.textContent = 'Loading…';

  try {
    const res  = await fetch('/.netlify/functions/analytics');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    lastAnalytics = data;
    renderAnalytics(data);
    if (badge) { badge.textContent = 'Live'; badge.className = 'section-badge section-badge--live'; }
  } catch {
    if (badge) { badge.textContent = 'Unavailable'; badge.className = 'section-badge section-badge--error'; }
  }
}

function renderAnalytics({ summary, daily, weekly, sources, pages, countries }) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('ga-sessions',   num(summary.sessions));
  set('ga-users',      num(summary.users));
  set('ga-new-users',  num(summary.newUsers));
  set('ga-engagement', pct(summary.engagementRate));
  set('ga-bounce',     pct(summary.bounceRate));

  renderDailyChart(daily);
  renderWeeklyChart(weekly);
  renderSources(sources);
  renderPages(pages);
  renderCountries(countries);
}

function drawBarChart(canvas, tipEl, entries, { color = '#2A9D8F', labelKey = 'label', valueKey = 'users' } = {}) {
  if (!canvas || !entries?.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth;
  if (!W) return;                       // tab not visible yet — redrawn on activation
  const H   = 240;
  const PAD = { top: 28, right: 12, bottom: 36, left: 36 };

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);

  const vals   = entries.map(d => d[valueKey]);
  const maxVal = Math.max(...vals, 1);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n      = vals.length;
  const gap    = 3;
  const barW   = Math.max(4, (chartW - gap * (n - 1)) / n);

  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = PAD.top + chartH * (1 - frac);
    ctx.fillStyle = '#9bbfba';
    ctx.font = '10px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * frac), PAD.left - 6, y + 3.5);
    ctx.strokeStyle = '#e8f5f3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();
  });

  vals.forEach((v, i) => {
    const barH = Math.max(v > 0 ? 3 : 0, (v / maxVal) * chartH);
    const x    = PAD.left + i * (barW + gap);
    const y    = PAD.top + chartH - barH;
    ctx.fillStyle = v === 0 ? '#e8f5f3' : color;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, Math.max(barH, 1), 3);
    ctx.fill();
  });

  const step = Math.ceil(n / 9);
  ctx.fillStyle = '#9bbfba';
  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'center';
  entries.forEach((d, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    ctx.fillText(d[labelKey], PAD.left + i * (barW + gap) + barW / 2, H - 8);
  });

  const barIndexAt = clientX => {
    const rect = canvas.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left - PAD.left) / (barW + gap));
    return i >= 0 && i < n ? i : -1;
  };

  const showTip = (clientX, clientY, i) => {
    if (!tipEl || i < 0) { if (tipEl) tipEl.style.display = 'none'; return; }
    const e = entries[i];
    tipEl.textContent = `${e[labelKey]}: ${e[valueKey]} visitor${e[valueKey] !== 1 ? 's' : ''}`;
    const wrapRect = canvas.parentElement.getBoundingClientRect();
    tipEl.style.display = 'block';
    tipEl.style.left = `${Math.min(clientX - wrapRect.left + 12, wrapRect.width - 160)}px`;
    tipEl.style.top  = `${clientY - wrapRect.top - 36}px`;
  };

  canvas.onmousemove  = e => showTip(e.clientX, e.clientY, barIndexAt(e.clientX));
  canvas.onmouseleave = () => { if (tipEl) tipEl.style.display = 'none'; };
  canvas.ontouchmove  = e => { e.preventDefault(); const t = e.touches[0]; showTip(t.clientX, t.clientY, barIndexAt(t.clientX)); };
  canvas.ontouchend   = () => { if (tipEl) tipEl.style.display = 'none'; };
}

function renderDailyChart(daily) {
  const map = Object.fromEntries((daily ?? []).map(d => [d.date, d.users]));
  const filled = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    filled.push({ label: `${m}/${day}`, users: map[`${y}${m}${day}`] ?? 0 });
  }
  drawBarChart(document.getElementById('ga-spark'), document.getElementById('ga-spark-tip'), filled, { color: '#2A9D8F' });
}

function renderWeeklyChart(weekly) {
  if (!weekly?.length) return;
  drawBarChart(
    document.getElementById('ga-weekly'),
    document.getElementById('ga-weekly-tip'),
    weekly.map(w => ({ label: `W${w.week}`, users: w.users })),
    { color: '#002060' },
  );
}

function renderSources(sources) {
  const el = document.getElementById('ga-sources');
  if (!el || !sources?.length) return;
  const total  = sources.reduce((s, r) => s + r.sessions, 0) || 1;
  const colors = ['#2A9D8F', '#002060', '#E9A23B', '#5a7a78', '#c8e8e3', '#9bbfba'];

  el.innerHTML = sources.map((s, i) => {
    const share = ((s.sessions / total) * 100).toFixed(1);
    return `
      <div class="source-row">
        <div class="source-bar-wrap">
          <div class="source-bar" style="width:${share}%;background:${colors[i % colors.length]}"></div>
        </div>
        <div class="source-label">${esc(s.channel)}</div>
        <div class="source-pct">${share}%</div>
      </div>`;
  }).join('');
}

function renderPages(pages) {
  const el = document.getElementById('ga-pages');
  if (!el || !pages?.length) return;
  const max = Math.max(...pages.map(p => p.views), 1);

  el.innerHTML = pages.map(p => `
    <div class="page-row">
      <div class="page-path">${esc(p.path)}</div>
      <div class="page-bar-wrap">
        <div class="page-bar" style="width:${((p.views / max) * 100).toFixed(1)}%"></div>
      </div>
      <div class="page-views">${num(p.views)}</div>
    </div>`).join('');
}

const FLAGS = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'Canada': '🇨🇦', 'Australia': '🇦🇺', 'India': '🇮🇳', 'Netherlands': '🇳🇱',
  'Ireland': '🇮🇪', 'Singapore': '🇸🇬', 'Taiwan': '🇹🇼', 'Japan': '🇯🇵',
  'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
  'Brazil': '🇧🇷', 'China': '🇨🇳', 'South Korea': '🇰🇷',
  'United Arab Emirates': '🇦🇪', 'Pakistan': '🇵🇰', 'Nigeria': '🇳🇬',
};

function renderCountries(countries) {
  const el = document.getElementById('ga-countries');
  if (!el || !countries?.length) return;
  const max = Math.max(...countries.map(c => c.users), 1);

  el.innerHTML = countries.map(c => `
    <div class="page-row">
      <div class="page-path">${FLAGS[c.country] ?? '🌐'} ${esc(c.country)}</div>
      <div class="page-bar-wrap">
        <div class="page-bar" style="width:${((c.users / max) * 100).toFixed(1)}%;background:#002060"></div>
      </div>
      <div class="page-views">${num(c.users)}</div>
    </div>`).join('');
}

// Canvases measure 0px wide while their tab is hidden, so redraw on activation.
export function redrawCharts() {
  if (!lastAnalytics) return;
  renderDailyChart(lastAnalytics.daily);
  renderWeeklyChart(lastAnalytics.weekly);
}

function wireTooltips() {
  const tip = document.getElementById('ga-tooltip');
  if (!tip) return;
  document.querySelectorAll('.ga-tip').forEach(card => {
    card.addEventListener('mouseenter', () => {
      tip.textContent = card.dataset.tip ?? '';
      tip.classList.add('ga-tooltip--visible');
    });
    card.addEventListener('mousemove', e => {
      tip.style.left = `${e.clientX + 12}px`;
      tip.style.top  = `${e.clientY + 12}px`;
    });
    card.addEventListener('mouseleave', () => tip.classList.remove('ga-tooltip--visible'));
  });
}

export async function initMetrics() {
  renderFoundingCounter();
  wireTooltips();
  window.addEventListener('resize', () => redrawCharts());
  await Promise.all([loadLinkedin(), loadAnalytics()]);
}
