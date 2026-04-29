# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node server.js        # production
npx nodemon server.js # dev (auto-restart on changes)
```

No build step, no test suite, no linter configured.

## Environment

Copy `.env.example` to `.env` and fill in Twitch credentials (used to authenticate against the IGDB API — the two services share an OAuth layer). Get credentials at https://dev.twitch.tv/console.

## Architecture

**Two-page app** served by a single Express server (`server.js`):

- `/` — **Control panel** (`public/index.html` + `public/control.js`): operator-facing UI to search for games and set "now playing"
- `/display` — **OBS overlay** (`public/display.html` + `public/display.js`): browser source that renders cover art and a console image, designed to be transparent and composited in OBS

**State flow**: Control panel → `POST /api/current` → `src/sse.js` (in-memory, broadcast via SSE) → display page re-renders. State is not persisted; it resets on server restart. On page load, display fetches `GET /api/current` then opens `GET /api/events` (SSE) for live updates.

**IGDB integration** (`src/igdb.js`): Token is fetched from Twitch OAuth and cached in memory with expiry. All IGDB queries use Apicalypse syntax in the POST body as `text/plain`. Two functions: `searchGames(q, offset)` and `getGameById(id)`.

**Platform/console mapping** (`src/platforms.js`): `PLATFORM_MAP` maps IGDB platform IDs → PNG filenames in `public/consoles/`. `PLATFORM_CONSOLE_IMAGE_MAP` is a flat list used to populate the console override dropdown in the control panel. Adding a new console requires a PNG in `public/consoles/` and entries in both structures.

**Console override**: When a game is selected, the operator can change the displayed console independently — the control panel re-POSTs the full game object with a modified `consoleName` field. The display page only uses `consoleName` to pick which console PNG to show; it doesn't care about the IGDB platform data.

**Key API routes** (all in `src/routes.js`):

- `GET /api/search?q=&page=` — paginated IGDB search, returns `{ results, hasMore }`
- `GET /api/game/:id` — IGDB lookup by numeric ID
- `GET /api/consoles` — static list for the console override dropdown
- `GET/POST /api/current` — get or set the active game object
- `GET /api/events` — SSE stream for the display page
