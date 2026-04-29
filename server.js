require('dotenv').config();
const express = require('express');
const path = require('path');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);

app.listen(PORT, () => {
  console.log(`\n🎮 Retro Rotation`);
  console.log(`   Control panel : http://localhost:${PORT}`);
  console.log(`   OBS source    : http://localhost:${PORT}/display\n`);
});
