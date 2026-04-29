const coverEl = document.getElementById('cover-art');
const consoleEl = document.getElementById('console-img');
const noGameEl = document.getElementById('no-game');

function fadeOut(el) {
  el.classList.remove('visible');
}

function fadeIn(el) {
  // Force reflow so the transition fires even when src just changed
  void el.offsetWidth;
  el.classList.add('visible');
}

function renderGame(game) {
  if (!game || (!game.coverUrl && !game.consoleName)) {
    fadeOut(coverEl);
    fadeOut(consoleEl);
    noGameEl.style.display = '';

    return;
  }

  noGameEl.style.display = 'none';

  if (game.coverUrl) {
    if (coverEl.getAttribute('src') === game.coverUrl) {
      fadeIn(coverEl);
    } else {
      fadeOut(coverEl);
      coverEl.onload = () => fadeIn(coverEl);
      coverEl.onerror = () => fadeOut(coverEl);
      coverEl.src = game.coverUrl;
      coverEl.alt = game.name || '';
    }
  } else {
    fadeOut(coverEl);
  }

  if (game.consoleName) {
    const src = `consoles/${game.consoleName}.png`;
    if (consoleEl.getAttribute('src') === src) {
      fadeIn(consoleEl);
    } else {
      fadeOut(consoleEl);
      consoleEl.onload = () => fadeIn(consoleEl);
      consoleEl.onerror = () => fadeOut(consoleEl);
      consoleEl.src = src;
      consoleEl.alt = game.platform || '';
    }
  } else {
    fadeOut(consoleEl);
  }
}

// ── SSE connection ─────────────────────────────────────────

function connect() {
  const es = new EventSource('/api/events');

  es.onmessage = (e) => {
    try {
      renderGame(JSON.parse(e.data));
    } catch {
      // Ignore malformed messages
    }
  };

  es.onerror = () => {
    es.close();
    setTimeout(connect, 3000);
  };
}

// ── Init — render current game, then subscribe to updates ──
(async () => {
  try {
    const res = await fetch('/api/current');
    const game = await res.json();
    if (game) renderGame(game);
  } catch {
    // SSE will deliver state once connected
  }

  connect();
})();
