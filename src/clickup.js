const fs = require('fs');
const path = require('path');

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const DATA_DIR = path.join(__dirname, '..', 'data');
const TASK_CACHE_FILE = path.join(DATA_DIR, 'clickup-tasks.json');

function loadTaskCache() {
  try {
    return JSON.parse(fs.readFileSync(TASK_CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveTaskCache(cache) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TASK_CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function clickupFetch(endpoint, options = {}) {
  const res = await fetch(`${CLICKUP_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: process.env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp ${res.status}: ${text}`);
  }
  return res.json();
}

async function findOrCreateTask(gameId, gameName) {
  const cache = loadTaskCache();
  if (cache[gameId]) return cache[gameId];

  const data = await clickupFetch(`/list/${process.env.CLICKUP_LIST_ID}/task`, {
    method: 'POST',
    body: JSON.stringify({ name: gameName }),
  });

  cache[gameId] = data.id;
  saveTaskCache(cache);
  return data.id;
}

async function logTime(taskId, startMs, durationMs) {
  await clickupFetch(`/task/${taskId}/time`, {
    method: 'POST',
    body: JSON.stringify({ start: startMs, end: startMs + durationMs }),
  });
}

function isConfigured() {
  return !!(process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID);
}

module.exports = { findOrCreateTask, logTime, isConfigured };
