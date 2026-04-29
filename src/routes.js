const { Router } = require('express');
const path = require('path');
const { searchGames, getGameById } = require('./igdb');
const { PLATFORM_CONSOLE_IMAGE_MAP } = require('./platforms');
const {
  addClient,
  removeClient,
  setCurrentGame,
  getCurrentGame,
} = require('./sse');

const router = Router();
const PUBLIC = path.join(__dirname, '..', 'public');
const PAGE_SIZE = 10;

function requireIGDBCredentials(req, res, next) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return res.status(503).json({
      error:
        'IGDB credentials not configured. Copy .env.example to .env and fill in your Twitch credentials.',
    });
  }
  next();
}

// Pages
router.get('/display', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'display.html'));
});

// API — search
router.get('/api/search', requireIGDBCredentials, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q param' });

  const page = Math.max(0, parseInt(req.query.page, 10) || 0);

  try {
    const results = await searchGames(q, page * PAGE_SIZE);
    res.json({ results, hasMore: results.length === PAGE_SIZE });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API — game by IGDB ID
router.get('/api/game/:id', requireIGDBCredentials, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ error: 'Invalid ID' });

  try {
    const game = await getGameById(id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    console.error('Game lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API — console list for the display override dropdown
router.get('/api/consoles', (_req, res) => {
  res.json(PLATFORM_CONSOLE_IMAGE_MAP);
});

// API — current game state
router.get('/api/current', (_req, res) => {
  res.json(getCurrentGame());
});

router.post('/api/current', (req, res) => {
  setCurrentGame(req.body ?? null);
  res.json({ ok: true });
});

// SSE — real-time push to display page
router.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  addClient(res);

  // Sync display page immediately on connect
  const current = getCurrentGame();
  if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

module.exports = router;
