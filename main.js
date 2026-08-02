import { getApiKey, setApiKey, hasApiKey, fetchApod } from './neoApi.js';

let neoAutoFetched = false;
let apodLoaded = false;

function wireTabs() {
  const buttons = document.querySelectorAll('.tabnav__btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.view').forEach((section) => {
        const active = section.id === `view-${view}`;
        section.hidden = !active;
        section.classList.toggle('is-active', active);
      });

      if (view === 'solar') {
        requestAnimationFrame(() => window.__orrery?.resize?.());
      }
      if (view === 'neo' && !neoAutoFetched) {
        neoAutoFetched = true;
        window.__neoDashboard?.runFetch?.();
      }
      if (view === 'apod' && !apodLoaded) {
        apodLoaded = true;
        loadApod();
      }
    });
  });
}

function wireClock() {
  const el = document.getElementById('utcClock');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toISOString().slice(11, 19) + 'Z';
  };
  tick();
  setInterval(tick, 1000);
}

function wireSettings() {
  const toggle = document.getElementById('settingsToggle');
  const drawer = document.getElementById('settingsDrawer');
  const input = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveKeyBtn');
  if (!toggle || !drawer || !input) return;

  const stored = getApiKey();
  input.value = stored || '';

  toggle.addEventListener('click', () => {
    const isHidden = drawer.hidden;
    drawer.hidden = !isHidden;
    toggle.setAttribute('aria-expanded', String(isHidden));
  });

  saveBtn?.addEventListener('click', () => {
    setApiKey(input.value);
    saveBtn.textContent = 'Saved ✓';
    setTimeout(() => { saveBtn.textContent = 'Save'; }, 1400);
  });
}

/** Verifies a candidate key against a lightweight NASA endpoint before it's trusted. */
async function validateKey(key) {
  const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}`);
  if (res.ok) return true;
  let msg = `That key was rejected (HTTP ${res.status}).`;
  try {
    const body = await res.json();
    msg = body?.error_message || body?.error?.message || msg;
  } catch (_) { /* ignore parse failure */ }
  const err = new Error(msg);
  err.status = res.status;
  throw err;
}

function wireGate() {
  const gate = document.getElementById('apiGate');
  const input = document.getElementById('gateKeyInput');
  const status = document.getElementById('gateStatus');
  const unlockBtn = document.getElementById('gateUnlockBtn');
  if (!gate || !input || !status || !unlockBtn) return;

  if (hasApiKey()) {
    gate.classList.add('is-hidden');
    gate.hidden = true;
    return;
  }

  const attemptUnlock = async () => {
    const value = input.value.trim();
    if (!value) {
      status.textContent = 'Enter a key first.';
      status.classList.remove('is-ok');
      return;
    }
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Verifying…';
    status.textContent = '';

    try {
      await validateKey(value);
      setApiKey(value);
      const settingsInput = document.getElementById('apiKeyInput');
      if (settingsInput) settingsInput.value = value;

      status.textContent = 'Key accepted.';
      status.classList.add('is-ok');
      gate.classList.add('is-hidden');
      setTimeout(() => { gate.hidden = true; }, 400);
    } catch (err) {
      status.textContent = err.status === 429
        ? 'That key is being rate-limited right now — wait a moment and retry.'
        : (err.message || 'Could not verify that key. Double-check it and try again.');
      status.classList.remove('is-ok');
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock console';
    }
  };

  unlockBtn.addEventListener('click', attemptUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
  input.focus();
}

async function loadApod() {
  const wrap = document.getElementById('apodWrap');
  if (!wrap) return;
  try {
    const data = await fetchApod();
    const isVideo = data.media_type === 'video';
    wrap.innerHTML = `
      <div class="apod-card">
        <div class="apod-media bracket">
          ${isVideo
            ? `<iframe src="${data.url}" title="${data.title}" allowfullscreen></iframe>`
            : `<img src="${data.hdurl || data.url}" alt="${data.title}" loading="lazy">`}
        </div>
        <div>
          <span class="apod-date">${data.date}</span>
          <h2 class="apod-title">${data.title}</h2>
        </div>
        <p class="apod-explain">${data.explanation}</p>
      </div>
    `;
  } catch (err) {
    const rateLimited = err.status === 429;
    wrap.innerHTML = `<p class="loading-text">${rateLimited
      ? 'Your key is rate-limited right now — try again shortly.'
      : `Could not load today\u2019s snapshot: ${err.message}`}</p>`;
    apodLoaded = false;
  }
}

function init() {
  wireGate();
  wireTabs();
  wireClock();
  wireSettings();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
