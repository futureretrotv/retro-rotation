'use strict';

let mockFetch;
let searchGames;
let getGameById;

beforeEach(() => {
  jest.resetModules();
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  ({ searchGames, getGameById } = require('../igdb'));
});

const TOKEN = { access_token: 'test-token', expires_in: 3600 };

const makeOk = (data) => ({
  ok: true,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

const makeErr = (status, body = 'error') => ({
  ok: false,
  status,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(body),
});

// Prime token + games results for a single call (fresh module state)
function setupMocks(games) {
  mockFetch
    .mockResolvedValueOnce(makeOk(TOKEN))
    .mockResolvedValueOnce(makeOk(games));
}

const GAME_NES = {
  id: 1,
  name: 'Super Mario Bros',
  platforms: [{ id: 18, name: 'Nintendo Entertainment System' }],
  cover: { image_id: 'abc123' },
};

// --- shapeGame (exercised via searchGames) ---

describe('shapeGame', () => {
  test('maps known PLATFORM_MAP id to consoleName', async () => {
    setupMocks([GAME_NES]);
    const [game] = await searchGames('mario');
    expect(game.consoleName).toBe('nes');
    expect(game.platform).toBe('Nintendo Entertainment System');
  });

  test('picks first PLATFORM_MAP match when it is not the first platform listed', async () => {
    setupMocks([{
      ...GAME_NES,
      platforms: [
        { id: 99999, name: 'Unknown Platform' },
        { id: 18, name: 'Nintendo Entertainment System' },
      ],
    }]);
    const [game] = await searchGames('mario');
    expect(game.consoleName).toBe('nes');
    expect(game.platform).toBe('Nintendo Entertainment System');
  });

  test('falls back to first platform name when no PLATFORM_MAP match, consoleName is null', async () => {
    setupMocks([{
      id: 2,
      name: 'Obscure Game',
      platforms: [{ id: 99999, name: 'Virtual Boy' }],
      cover: { image_id: 'xyz' },
    }]);
    const [game] = await searchGames('obscure');
    expect(game.consoleName).toBeNull();
    expect(game.platform).toBe('Virtual Boy');
  });

  test('sets platform and consoleName to null when game has no platforms', async () => {
    setupMocks([{ id: 3, name: 'No Platform', cover: { image_id: 'xyz' } }]);
    const [game] = await searchGames('no platform');
    expect(game.consoleName).toBeNull();
    expect(game.platform).toBeNull();
  });

  test('builds coverUrl and coverThumb from image_id', async () => {
    setupMocks([GAME_NES]);
    const [game] = await searchGames('mario');
    expect(game.coverUrl).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/abc123.jpg',
    );
    expect(game.coverThumb).toBe(
      'https://images.igdb.com/igdb/image/upload/t_thumb/abc123.jpg',
    );
  });

  test('sets coverUrl and coverThumb to null when game has no cover', async () => {
    setupMocks([{ id: 4, name: 'No Cover', platforms: [{ id: 18, name: 'NES' }] }]);
    const [game] = await searchGames('no cover');
    expect(game.coverUrl).toBeNull();
    expect(game.coverThumb).toBeNull();
  });
});

// --- searchGames ---

describe('searchGames', () => {
  test('includes the search term and required fields in the body', async () => {
    setupMocks([]);
    await searchGames('zelda');
    const body = mockFetch.mock.calls[1][1].body;
    expect(body).toContain('search "zelda"');
    expect(body).toContain('fields name,cover.image_id,platforms.name,platforms.id');
  });

  test('strips double-quotes from query to avoid breaking syntax', async () => {
    setupMocks([]);
    await searchGames('mario "odyssey"');
    const body = mockFetch.mock.calls[1][1].body;
    expect(body).toContain('search "mario odyssey"');
  });

  test('defaults offset to 0', async () => {
    setupMocks([]);
    await searchGames('zelda');
    const body = mockFetch.mock.calls[1][1].body;
    expect(body).toContain('offset 0');
  });

  test('passes non-zero offset into query', async () => {
    setupMocks([]);
    await searchGames('zelda', 10);
    const body = mockFetch.mock.calls[1][1].body;
    expect(body).toContain('offset 10');
  });

  test('returns all shaped games from the API response', async () => {
    setupMocks([GAME_NES, { ...GAME_NES, id: 5, name: 'Castlevania' }]);
    const results = await searchGames('nes');
    expect(results).toHaveLength(2);
    expect(results[1].name).toBe('Castlevania');
  });
});

// --- getGameById ---

describe('getGameById', () => {
  test('returns null when IGDB returns no results', async () => {
    setupMocks([]);
    expect(await getGameById(999)).toBeNull();
  });

  test('returns a shaped game when found', async () => {
    setupMocks([GAME_NES]);
    const game = await getGameById(1);
    expect(game).not.toBeNull();
    expect(game.id).toBe(1);
    expect(game.name).toBe('Super Mario Bros');
  });

  test('puts the numeric id in where clause', async () => {
    setupMocks([GAME_NES]);
    await getGameById(42);
    const body = mockFetch.mock.calls[1][1].body;
    expect(body).toContain('where id = 42');
  });
});

// --- token management ---

describe('token management', () => {
  test('fetches a token from the Twitch OAuth endpoint on the first API call', async () => {
    setupMocks([]);
    await searchGames('test');
    const [tokenUrl, tokenOpts] = mockFetch.mock.calls[0];
    expect(tokenUrl).toContain('id.twitch.tv/oauth2/token');
    expect(tokenOpts.method).toBe('POST');
  });

  test('reuses the cached token for subsequent calls (no second token fetch)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOk(TOKEN))
      .mockResolvedValueOnce(makeOk([]))
      .mockResolvedValueOnce(makeOk([]));
    await searchGames('first');
    await searchGames('second');
    // 1 token fetch + 2 games fetches = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('refreshes the token when it is within 60 s of expiry', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOk(TOKEN))
      .mockResolvedValueOnce(makeOk([]))
      .mockResolvedValueOnce(makeOk(TOKEN))
      .mockResolvedValueOnce(makeOk([]));

    await searchGames('first'); // caches token with expiry = now + 3600 s

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 3600 * 1000; // jump past expiry
      await searchGames('second');
    } finally {
      Date.now = realNow;
    }

    // 2 token fetches + 2 games fetches = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  test('deduplicates concurrent token fetches (pendingTokenFetch)', async () => {
    let resolveToken;
    const tokenPromise = new Promise((resolve) => {
      resolveToken = resolve;
    });

    mockFetch
      .mockReturnValueOnce(tokenPromise.then(() => makeOk(TOKEN)))
      .mockResolvedValue(makeOk([]));

    const p1 = searchGames('first');
    const p2 = searchGames('second');

    resolveToken();
    await Promise.all([p1, p2]);

    const tokenCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('twitch.tv'),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  test('throws with status when the token fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(401, 'Unauthorized'));
    await expect(searchGames('test')).rejects.toThrow('Twitch token error 401');
  });

  test('throws with status when an IGDB API call fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOk(TOKEN))
      .mockResolvedValueOnce(makeErr(400, 'Syntax error'));
    await expect(searchGames('test')).rejects.toThrow('IGDB error 400');
  });
});
