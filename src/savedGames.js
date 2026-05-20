const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SAVED_FILE = path.join(DATA_DIR, 'saved-games.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function persist(games) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SAVED_FILE, JSON.stringify(games, null, 2));
}

function getSavedGames() {
  return load();
}

function saveGame(game) {
  const games = load();
  const idx = games.findIndex((g) => g.id === game.id);
  const entry = { ...game, savedAt: new Date().toISOString() };
  if (idx >= 0) {
    games[idx] = entry;
  } else {
    games.unshift(entry);
  }
  persist(games);
  return entry;
}

function removeSavedGame(id) {
  const games = load().filter((g) => g.id !== id);
  persist(games);
}

module.exports = { getSavedGames, saveGame, removeSavedGame };
