const input = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const idInput = document.getElementById('id-input');
const idBtn = document.getElementById('id-btn');
const resultsList = document.getElementById('results');
const statusEl = document.getElementById('status');
const nowPlaying = document.getElementById('now-playing');
const npThumb = document.getElementById('np-thumb');
const npName = document.getElementById('np-name');
const npPlatform = document.getElementById('np-platform');
const consoleOverride = document.getElementById('console-override');
const saveBtn = document.getElementById('save-btn');
const savedSection = document.getElementById('saved-section');
const savedList = document.getElementById('saved-list');
const trackRow = document.getElementById('track-row');
const trackBtn = document.getElementById('track-btn');
const trackTimer = document.getElementById('track-timer');

let debounceTimer = null;
let activeGameId = null;
let currentGame = null;
let currentQuery = '';
let currentPage = 0;
let isTracking = false;
let trackInterval = null;

// ── Helpers ────────────────────────────────────────────────

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function postCurrentGame(game) {
  const res = await fetch('/api/current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(game),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

function renderNowPlaying(game) {
  if (!game) {
    nowPlaying.classList.remove('visible');
    return;
  }
  currentGame = game;
  activeGameId = game.id;
  npThumb.src = game.coverThumb || '';
  npThumb.style.display = game.coverThumb ? '' : 'none';
  npName.textContent = game.name;
  npPlatform.textContent = game.platform || '';
  consoleOverride.value = game.consoleName || '';
  nowPlaying.classList.add('visible');
  savedList
    .querySelectorAll('li')
    .forEach((el) =>
      el.classList.toggle('active', Number(el.dataset.id) === game.id),
    );
}

function buildCard(game) {
  const li = document.createElement('li');
  li.setAttribute('role', 'option');
  li.dataset.id = game.id;
  if (game.id === activeGameId) li.classList.add('active');

  li.innerHTML =
    '<img alt=""><div class="result-info"><div class="result-name text-truncate"></div><div class="result-platform"></div></div>';

  const img = li.querySelector('img');
  if (game.coverThumb) {
    img.src = game.coverThumb;
    img.alt = game.name;
  } else {
    img.style.display = 'none';
  }
  li.querySelector('.result-name').textContent = game.name;
  li.querySelector('.result-platform').textContent =
    game.platform || 'Unknown platform';

  li.addEventListener('click', () => selectGame(game, li));
  return li;
}

async function selectGame(game, liEl) {
  try {
    await postCurrentGame(game);
    resultsList
      .querySelectorAll('li')
      .forEach((el) => el.classList.remove('active'));
    liEl.classList.add('active');
    renderNowPlaying(game);
    setStatus('');
  } catch (err) {
    setStatus(`Failed to set game: ${err.message}`);
  }
}

consoleOverride.addEventListener('change', async () => {
  if (!currentGame) return;
  const updated = {
    ...currentGame,
    consoleName: consoleOverride.value || null,
  };
  try {
    await postCurrentGame(updated);
    currentGame = updated;
  } catch (err) {
    setStatus(`Failed to update console: ${err.message}`);
  }
});

// ── Saved games ────────────────────────────────────────────

let savedGames = [];

function renderSavedList() {
  savedList.innerHTML = '';
  if (!savedGames.length) {
    savedSection.classList.add('hidden');
    return;
  }
  savedSection.classList.remove('hidden');
  savedGames.forEach((game) => savedList.appendChild(buildSavedCard(game)));
}

function buildSavedCard(game) {
  const li = document.createElement('li');
  li.dataset.id = game.id;
  if (game.id === activeGameId) li.classList.add('active');

  li.innerHTML =
    '<img alt=""><div class="result-info"><div class="result-name text-truncate"></div><div class="result-platform"></div></div><button class="delete-btn" aria-label="Remove">×</button>';

  const img = li.querySelector('img');
  if (game.coverThumb) {
    img.src = game.coverThumb;
    img.alt = game.name;
  } else {
    img.style.display = 'none';
  }
  li.querySelector('.result-name').textContent = game.name;
  li.querySelector('.result-platform').textContent =
    game.consoleName || game.platform || 'Unknown platform';

  li.addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn')) return;
    selectGame(game, li);
  });

  li.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved/${game.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      savedGames = savedGames.filter((g) => g.id !== game.id);
      renderSavedList();
    } catch (err) {
      setStatus(`Failed to remove: ${err.message}`);
    }
  });

  return li;
}

saveBtn.addEventListener('click', async () => {
  if (!currentGame) return;
  try {
    saveBtn.disabled = true;
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentGame),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const saved = await res.json();
    const idx = savedGames.findIndex((g) => g.id === saved.id);
    if (idx >= 0) {
      savedGames[idx] = saved;
    } else {
      savedGames.unshift(saved);
    }
    renderSavedList();
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = 'Save';
    }, 1500);
  } catch (err) {
    setStatus(`Failed to save: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

// ── ClickUp tracking ────────────────────────────────────────

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function setTracking(tracking, startedAt = null) {
  isTracking = tracking;
  trackBtn.textContent = tracking ? 'Stop' : 'Track';
  trackBtn.classList.toggle('tracking', tracking);
  clearInterval(trackInterval);
  if (tracking && startedAt) {
    trackInterval = setInterval(() => {
      trackTimer.textContent = formatElapsed(Date.now() - startedAt);
    }, 1000);
    trackTimer.textContent = formatElapsed(Date.now() - startedAt);
  } else {
    trackTimer.textContent = '0:00:00';
  }
}

trackBtn.addEventListener('click', async () => {
  trackBtn.disabled = true;
  try {
    if (!isTracking) {
      const res = await fetch('/api/clickup/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentGame),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(`ClickUp: ${data.error || res.status}`);
        return;
      }
      setTracking(true, Date.now());
    } else {
      const res = await fetch('/api/clickup/stop', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(`ClickUp: ${data.error || res.status}`);
        return;
      }
      const data = await res.json();
      setTracking(false);
      if (data.logged) {
        setStatus(`Logged ${formatElapsed(data.durationMs)} to ClickUp.`);
        setTimeout(() => setStatus(''), 4000);
      }
    }
  } catch (err) {
    setStatus(`ClickUp: ${err.message}`);
  } finally {
    trackBtn.disabled = false;
  }
});

// ── Search ─────────────────────────────────────────────────

function removeLoadMoreBtn() {
  const btn = document.getElementById('load-more-btn');
  if (btn) btn.remove();
}

async function fetchPage(q, page) {
  removeLoadMoreBtn();

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&page=${page}`,
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || `Error ${res.status}`);
      return;
    }
    const data = await res.json();

    if (page === 0 && !data.results.length) {
      setStatus('No results found.');
      return;
    }

    setStatus('');
    data.results.forEach((game) => resultsList.appendChild(buildCard(game)));

    if (data.hasMore) {
      const btn = document.createElement('button');
      btn.id = 'load-more-btn';
      btn.textContent = 'Load more';
      btn.addEventListener('click', () => {
        currentPage++;
        fetchPage(currentQuery, currentPage);
      });
      resultsList.insertAdjacentElement('afterend', btn);
    }
  } catch (err) {
    setStatus(`Request failed: ${err.message}`);
  }
}

async function doSearch() {
  const q = input.value.trim();
  if (!q) return;

  currentQuery = q;
  currentPage = 0;
  resultsList.innerHTML = '';
  removeLoadMoreBtn();
  setStatus('Searching…');
  await fetchPage(q, 0);
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    doSearch();
  }
});

// Debounce typing so we don't hammer the API on every keystroke
input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  if (input.value.trim().length >= 2) {
    debounceTimer = setTimeout(doSearch, 500);
  }
});

searchBtn.addEventListener('click', doSearch);

// ── ID lookup ──────────────────────────────────────────────

async function doLoadById() {
  const id = idInput.value.trim();
  if (!id) return;

  resultsList.innerHTML = '';
  removeLoadMoreBtn();
  setStatus('Loading…');

  try {
    const res = await fetch(`/api/game/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || `Error ${res.status}`);
      return;
    }
    const data = await res.json();
    setStatus('');
    resultsList.appendChild(buildCard(data));
  } catch (err) {
    setStatus(`Request failed: ${err.message}`);
  }
}

idInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLoadById();
});
idBtn.addEventListener('click', doLoadById);

// ── Init — restore current game + populate console override ──

(async () => {
  try {
    const [currentRes, consolesRes, savedRes, clickupRes] = await Promise.all([
      fetch('/api/current'),
      fetch('/api/consoles'),
      fetch('/api/saved'),
      fetch('/api/clickup/status'),
    ]);

    const game = await currentRes.json();
    if (game) renderNowPlaying(game);

    const consoles = await consolesRes.json();
    for (const { label, consoleName } of consoles) {
      const opt = document.createElement('option');
      opt.value = consoleName;
      opt.textContent = label;
      consoleOverride.appendChild(opt);
    }

    savedGames = await savedRes.json();
    renderSavedList();

    const cuStatus = await clickupRes.json();
    if (cuStatus.enabled) {
      trackRow.classList.remove('hidden');
      if (cuStatus.tracking) setTracking(true, cuStatus.startedAt);
    }
  } catch {
    // Non-fatal
  }
})();
