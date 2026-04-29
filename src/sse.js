const clients = new Set();
let currentGame = null;

function broadcast(game) {
  const payload = `data: ${JSON.stringify(game)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function setCurrentGame(game) {
  currentGame = game;
  broadcast(currentGame);
}

function getCurrentGame() {
  return currentGame;
}

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

module.exports = {
  addClient,
  removeClient,
  broadcast,
  setCurrentGame,
  getCurrentGame,
};
