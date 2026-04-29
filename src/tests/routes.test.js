'use strict';

const http = require('http');
const express = require('express');
const request = require('supertest');

jest.mock('../igdb', () => ({
  searchGames: jest.fn(),
  getGameById: jest.fn(),
}));

jest.mock('../sse', () => ({
  addClient: jest.fn(),
  removeClient: jest.fn(),
  setCurrentGame: jest.fn(),
  getCurrentGame: jest.fn(),
}));

jest.mock('../platforms', () => ({
  PLATFORM_CONSOLE_IMAGE_MAP: [
    { label: 'NES', consoleName: 'nes' },
    { label: 'SNES', consoleName: 'snes' },
  ],
}));

const { searchGames, getGameById } = require('../igdb');
const { addClient, removeClient, setCurrentGame, getCurrentGame } = require('../sse');

const router = require('../routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const MOCK_GAME = {
  id: 1,
  name: 'Super Mario Bros',
  platform: 'NES',
  consoleName: 'nes',
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg',
  coverThumb: 'https://images.igdb.com/igdb/image/upload/t_thumb/abc.jpg',
};

const PAGE_SIZE = 10;

describe('GET /display', () => {
  it('serves display.html', async () => {
    const res = await request(createApp()).get('/display');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('requireIGDBCredentials', () => {
  beforeEach(() => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  it('returns 503 on GET /api/search when credentials are missing', async () => {
    const res = await request(createApp()).get('/api/search?q=mario');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/IGDB credentials/);
  });

  it('returns 503 on GET /api/game/:id when credentials are missing', async () => {
    const res = await request(createApp()).get('/api/game/1');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/IGDB credentials/);
  });
});

describe('GET /api/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITCH_CLIENT_ID = 'test-id';
    process.env.TWITCH_CLIENT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  it('returns 400 when q is absent', async () => {
    const res = await request(createApp()).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing q param');
  });

  it('returns 400 when q is whitespace only', async () => {
    const res = await request(createApp()).get('/api/search?q=   ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing q param');
  });

  it('returns results with hasMore true when a full page is returned', async () => {
    const results = Array(PAGE_SIZE).fill(MOCK_GAME);
    searchGames.mockResolvedValue(results);

    const res = await request(createApp()).get('/api/search?q=mario');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(PAGE_SIZE);
    expect(res.body.hasMore).toBe(true);
    expect(searchGames).toHaveBeenCalledWith('mario', 0);
  });

  it('returns hasMore false when a partial page is returned', async () => {
    searchGames.mockResolvedValue([MOCK_GAME]);

    const res = await request(createApp()).get('/api/search?q=mario');
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(false);
  });

  it('applies page param as offset', async () => {
    searchGames.mockResolvedValue([]);

    await request(createApp()).get('/api/search?q=mario&page=3');
    expect(searchGames).toHaveBeenCalledWith('mario', 30);
  });

  it('clamps negative page to 0', async () => {
    searchGames.mockResolvedValue([]);

    await request(createApp()).get('/api/search?q=mario&page=-5');
    expect(searchGames).toHaveBeenCalledWith('mario', 0);
  });

  it('returns 500 on IGDB error', async () => {
    searchGames.mockRejectedValue(new Error('IGDB unavailable'));

    const res = await request(createApp()).get('/api/search?q=mario');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('IGDB unavailable');
  });
});

describe('GET /api/game/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITCH_CLIENT_ID = 'test-id';
    process.env.TWITCH_CLIENT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  it('returns 400 for a non-numeric ID', async () => {
    const res = await request(createApp()).get('/api/game/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID');
  });

  it('returns 400 for zero', async () => {
    const res = await request(createApp()).get('/api/game/0');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID');
  });

  it('returns 400 for a negative ID', async () => {
    const res = await request(createApp()).get('/api/game/-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID');
  });

  it('returns 404 when the game is not found', async () => {
    getGameById.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/game/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Game not found');
  });

  it('returns the game on success', async () => {
    getGameById.mockResolvedValue(MOCK_GAME);

    const res = await request(createApp()).get('/api/game/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(MOCK_GAME);
    expect(getGameById).toHaveBeenCalledWith(1);
  });

  it('returns 500 on IGDB error', async () => {
    getGameById.mockRejectedValue(new Error('IGDB timeout'));

    const res = await request(createApp()).get('/api/game/1');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('IGDB timeout');
  });
});

describe('GET /api/consoles', () => {
  it('returns the platform console image map', async () => {
    const res = await request(createApp()).get('/api/consoles');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { label: 'NES', consoleName: 'nes' },
      { label: 'SNES', consoleName: 'snes' },
    ]);
  });
});

describe('GET /api/current', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no game is set', async () => {
    getCurrentGame.mockReturnValue(null);

    const res = await request(createApp()).get('/api/current');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the current game object', async () => {
    getCurrentGame.mockReturnValue(MOCK_GAME);

    const res = await request(createApp()).get('/api/current');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(MOCK_GAME);
  });
});

describe('POST /api/current', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls setCurrentGame with the body and returns ok', async () => {
    const res = await request(createApp()).post('/api/current').send(MOCK_GAME);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(setCurrentGame).toHaveBeenCalledWith(MOCK_GAME);
  });

  it('calls setCurrentGame with an empty object when no body is sent', async () => {
    const res = await request(createApp()).post('/api/current');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(setCurrentGame).toHaveBeenCalledWith({});
  });
});

describe('GET /api/events', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets SSE headers, adds the client, and sends the current game', (done) => {
    getCurrentGame.mockReturnValue(MOCK_GAME);

    const server = createApp().listen(0, () => {
      const { port } = server.address();
      const req = http.get(`http://localhost:${port}/api/events`, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('\n\n')) {
            expect(buffer).toContain(`data: ${JSON.stringify(MOCK_GAME)}`);
            expect(addClient).toHaveBeenCalled();
            req.destroy();
          }
        });

        res.on('close', () => server.close(done));
      });

      req.on('error', (err) => {
        if (err.code !== 'ECONNRESET') done(err);
      });
    });
  });

  it('removes the client when the connection closes', (done) => {
    getCurrentGame.mockReturnValue(null);

    const server = createApp().listen(0, () => {
      const { port } = server.address();
      const req = http.get(`http://localhost:${port}/api/events`, () => {
        req.destroy();
      });

      req.on('error', (err) => {
        if (err.code !== 'ECONNRESET') done(err);
      });

      setTimeout(() => {
        expect(removeClient).toHaveBeenCalled();
        server.close(done);
      }, 100);
    });
  });
});
