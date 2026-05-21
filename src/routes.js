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
const { getSavedGames, saveGame, removeSavedGame } = require('./savedGames');
const { findOrCreateTask, logTime, isConfigured } = require('./clickup');

const router = Router();
const PUBLIC = path.join(__dirname, '..', 'public');
const PAGE_SIZE = 10;

let trackingSession = null; // { gameId, gameName, startedAt }

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

// API — saved games (persisted to disk)
router.get('/api/saved', (_req, res) => {
  res.json(getSavedGames());
});

router.post('/api/saved', (req, res) => {
  if (!req.body || !req.body.id)
    return res.status(400).json({ error: 'Missing game data' });
  const entry = saveGame(req.body);
  res.json(entry);
});

router.delete('/api/saved/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ error: 'Invalid ID' });
  removeSavedGame(id);
  res.json({ ok: true });
});

// API — ClickUp time tracking
router.get('/api/clickup/status', (_req, res) => {
  res.json({
    enabled: isConfigured(),
    tracking: !!trackingSession,
    gameName: trackingSession?.gameName ?? null,
    startedAt: trackingSession?.startedAt ?? null,
  });
});

router.post('/api/clickup/start', (req, res) => {
  const game = req.body;
  if (!game?.id || !game?.name)
    return res.status(400).json({ error: 'Missing game data' });
  if (!isConfigured())
    return res.status(503).json({ error: 'ClickUp not configured' });

  trackingSession = { gameId: game.id, gameName: game.name, startedAt: Date.now() };
  res.json({ ok: true });
});

router.post('/api/clickup/stop', async (_req, res) => {
  if (!trackingSession)
    return res.status(400).json({ error: 'No active session' });

  const { gameId, gameName, startedAt } = trackingSession;
  trackingSession = null;

  const durationMs = Date.now() - startedAt;
  if (durationMs < 1000) return res.json({ ok: true, logged: false });

  try {
    const taskId = await findOrCreateTask(gameId, gameName);
    await logTime(taskId, startedAt, durationMs);
    res.json({ ok: true, logged: true, durationMs });
  } catch (err) {
    console.error('ClickUp log error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
