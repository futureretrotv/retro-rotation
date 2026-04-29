const { PLATFORM_MAP } = require('./platforms');

const IGDB_GAMES_URL = 'https://api.igdb.com/v4/games';

let cachedToken = null;
let tokenExpiry = 0;
let pendingTokenFetch = null;

async function fetchNewToken() {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  console.log(
    'IGDB token refreshed, expires in',
    Math.round(data.expires_in / 3600),
    'hours',
  );

  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;
  if (!pendingTokenFetch)
    pendingTokenFetch = fetchNewToken().finally(() => {
      pendingTokenFetch = null;
    });

  return pendingTokenFetch;
}

function shapeGame(game) {
  let consoleName = null;
  let platformName = null;

  if (game.platforms?.length) {
    for (const p of game.platforms) {
      if (PLATFORM_MAP[p.id]) {
        consoleName = PLATFORM_MAP[p.id];
        platformName = p.name;
        break;
      }
    }
    if (!platformName) platformName = game.platforms[0].name;
  }

  const imageId = game.cover?.image_id;

  return {
    id: game.id,
    name: game.name,
    platform: platformName,
    consoleName,
    coverUrl: imageId
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
      : null,
    coverThumb: imageId
      ? `https://images.igdb.com/igdb/image/upload/t_thumb/${imageId}.jpg`
      : null,
  };
}

async function igdbPost(body) {
  const accessToken = await getToken();
  const res = await fetch(IGDB_GAMES_URL, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB error ${res.status}: ${text}`);
  }

  return res.json();
}

async function searchGames(q, offset = 0) {
  // Strip quotes from user input to avoid breaking the IGDB query string
  const games = await igdbPost(
    `fields name,cover.image_id,platforms.name,platforms.id; search "${q.replace(/"/g, '')}"; where cover != null & platforms != null; limit 10; offset ${offset};`,
  );

  return games.map(shapeGame);
}

async function getGameById(id) {
  const games = await igdbPost(
    `fields name,cover.image_id,platforms.name,platforms.id; where id = ${id};`,
  );

  return games.length ? shapeGame(games[0]) : null;
}

module.exports = { searchGames, getGameById };
