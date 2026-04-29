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

let debounceTimer = null;
let activeGameId = null;
let currentGame = null;
let currentQuery = '';
let currentPage = 0;

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
    const [currentRes, consolesRes] = await Promise.all([
      fetch('/api/current'),
      fetch('/api/consoles'),
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
  } catch {
    // Non-fatal
  }
})();
