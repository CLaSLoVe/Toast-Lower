'use strict';
// Only the game's runtime files are published to Pages.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
const files = [
  'index.html', 'game.js', 'config.js', 'settings.js', 'settings.css', 'music.js',
  'assets/home/favicon.svg', 'assets/home/banquet-v46.png', 'assets/home/logo-v46.png',
  'assets/audio/banquet-shuffle.mp3',
];
// Check every source before replacing the generated directory.
for (const file of files) {
  if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing file: ${file}`);
}
fs.rmSync(out, { recursive: true, force: true });
for (const file of files) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, file), dest);
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Built ${files.length} runtime files into dist/`);
