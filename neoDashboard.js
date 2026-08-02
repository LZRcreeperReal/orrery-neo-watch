import { fetchNeoFeed } from './neoApi.js';

let currentList = [];
let sortKey = 'miss';
let sortAsc = true;
let searchTerm = '';
let charts = { perDay: null, scatter: null, hazard: null };

const CYAN = '#4fb0c6';
const BRASS = '#e8a33d';
const HAZARD = '#e2555a';
const GRID = 'rgba(139,147,167,0.15)';
const TICK = '#8b93a7';

function toIsoDate(d) { return d.toISOString().slice(0, 10); }

function setDefaultDates() {
  const start = document.getElementById('neoStart');
  const end = document.getElementById('neoEnd');
  if (!start || !end) return;
  const today = new Date();
  const weekOut = new Date(today.getTime() + 6 * 86400000);
  start.value = toIsoDate(today);
  end.value = toIsoDate(weekOut);
}

function fmtDiameter(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m.toFixed(0)} m`;
}
function fmtDistance(km) {
  return `${Math.round(km).toLocaleString()} km`;
}

function renderStats(list) {
  const total = list.length;
  const hazardCount = list.filter(n => n.hazardous).length;
  const closest = list.reduce((min, n) => (n.missDistanceKm < min.missDistanceKm ? n : min), list[0]);
  const fastest = list.reduce((max, n) => (n.velocityKmS > max.velocityKmS ? n : max), list[0]);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statHazard').textContent = hazardCount;
  document.getElementById('statClosest').textContent = closest ? fmtDistance(closest.missDistanceKm) : '—';
  document.getElementById('statFastest').textContent = fastest ? `${fastest.velocityKmS.toFixed(1)} km/s` : '—';
}

function destroyCharts() {
  Object.values(charts).forEach(c => c?.destroy());
  charts = { perDay: null, scatter: null, hazard: null };
}

function renderCharts(list) {
  destroyCharts();
  Chart.defaults.color = TICK;
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 11;

  // --- objects per day ---
  const byDate = {};
  list.forEach(n => { byDate[n.date] = (byDate[n.date] || 0) + 1; });
  const dates = Object.keys(byDate).sort();
  charts.perDay = new Chart(document.getElementById('chartPerDay'), {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{ label: 'Objects', data: dates.map(d => byDate[d]), backgroundColor: BRASS, borderRadius: 2, maxBarThickness: 36 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID } },
      },
    },
  });

  // --- diameter vs miss distance ---
  const safePts = list.filter(n => !n.hazardous).map(n => ({ x: n.missDistanceLunar, y: n.diameterM }));
  const hazPts = list.filter(n => n.hazardous).map(n => ({ x: n.missDistanceLunar, y: n.diameterM }));
  charts.scatter = new Chart(document.getElementById('chartScatter'), {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Safe', data: safePts, backgroundColor: CYAN },
        { label: 'Hazardous', data: hazPts, backgroundColor: HAZARD },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 10 } } },
      scales: {
        x: { title: { display: true, text: 'Miss distance (lunar distances)' }, grid: { color: GRID } },
        y: { title: { display: true, text: 'Est. diameter (m)' }, grid: { color: GRID } },
      },
    },
  });

  // --- hazard split ---
  const hazardCount = list.filter(n => n.hazardous).length;
  charts.hazard = new Chart(document.getElementById('chartHazard'), {
    type: 'doughnut',
    data: {
      labels: ['Safe', 'Hazardous'],
      datasets: [{ data: [list.length - hazardCount, hazardCount], backgroundColor: [CYAN, HAZARD], borderColor: '#10151f', borderWidth: 2 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
    },
  });
}

function sortList(list) {
  const dir = sortAsc ? 1 : -1;
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case 'name': return a.name.localeCompare(b.name) * dir;
      case 'date': return a.date.localeCompare(b.date) * dir;
      case 'diameter': return (a.diameterM - b.diameterM) * dir;
      case 'velocity': return (a.velocityKmS - b.velocityKmS) * dir;
      case 'hazard': return ((a.hazardous === b.hazardous) ? 0 : a.hazardous ? -1 : 1) * dir;
      case 'miss':
      default: return (a.missDistanceKm - b.missDistanceKm) * dir;
    }
  });
  return sorted;
}

function renderTable() {
  const body = document.getElementById('neoTableBody');
  if (!body) return;
  let rows = sortList(currentList);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    rows = rows.filter(n => n.name.toLowerCase().includes(q));
  }
  if (!rows.length) {
    body.innerHTML = `<tr class="neo-table__empty-row"><td colspan="6">No objects match “${searchTerm}”.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(n => `
    <tr data-jpl="${n.nasaJplUrl || ''}" tabindex="0">
      <td>${n.name}</td>
      <td>${n.date}</td>
      <td>${fmtDiameter(n.diameterM)}</td>
      <td>${n.velocityKmS.toFixed(1)} km/s</td>
      <td>${fmtDistance(n.missDistanceKm)}</td>
      <td><span class="hazard-pill ${n.hazardous ? 'hazard-pill--yes' : 'hazard-pill--no'}">${n.hazardous ? 'Yes' : 'No'}</span></td>
    </tr>
  `).join('');
}

function openRowLink(target) {
  const row = target.closest('tr[data-jpl]');
  const url = row?.dataset.jpl;
  if (url) window.open(url, '_blank', 'noopener');
}

function wireTableInteractions() {
  document.querySelectorAll('.neo-table thead th').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      renderTable();
    });
  });

  const body = document.getElementById('neoTableBody');
  body?.addEventListener('click', (e) => openRowLink(e.target));
  body?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRowLink(e.target); }
  });

  document.getElementById('neoSearch')?.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderTable();
  });
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('neoStatus');
  if (!el) return;
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle('is-error', isError);
}

function revealSections(show) {
  ['neoStats', 'neoCharts', 'neoTableToolbar', 'neoTableWrap'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !show;
  });
}

async function runFetch() {
  const startInput = document.getElementById('neoStart');
  const endInput = document.getElementById('neoEnd');
  const btn = document.getElementById('neoFetchBtn');
  const start = startInput.value, end = endInput.value;

  if (!start || !end) { setStatus('Pick a start and end date first.', true); return; }
  const span = (new Date(end) - new Date(start)) / 86400000;
  if (span < 0) { setStatus('End date must be after the start date.', true); return; }
  if (span > 7) { setStatus('Keep the window to 7 days or less — that is NASA\u2019s feed limit.', true); return; }

  btn.disabled = true;
  revealSections(false);
  setStatus('Scanning NASA NeoWs feed…');

  try {
    const { list } = await fetchNeoFeed(start, end);
    currentList = list;
    searchTerm = '';
    const searchInput = document.getElementById('neoSearch');
    if (searchInput) searchInput.value = '';
    if (!list.length) {
      setStatus('No tracked objects in that window.');
      return;
    }
    setStatus('');
    renderStats(list);
    renderCharts(list);
    renderTable();
    revealSections(true);
    window.__orrery?.plotNeoMarkers?.(list);
  } catch (err) {
    const rateLimited = err.status === 429;
    setStatus(rateLimited
      ? 'Your key is being rate-limited right now — wait a moment and try again.'
      : `Could not load NEO feed: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

function init() {
  setDefaultDates();
  wireTableInteractions();
  document.getElementById('neoFetchBtn')?.addEventListener('click', runFetch);
  window.__neoDashboard = { runFetch };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
