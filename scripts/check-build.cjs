const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = '/kord-breach-optimizer/';
const dist = path.resolve('dist');
const htmlPath = path.join(dist, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const documents = JSON.parse(fs.readFileSync('public/data/documents.json', 'utf8'));

for (const assetPath of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = assetPath[1];
  assert.ok(url.startsWith(base), `${url} is outside the configured Pages base path`);
  assert.ok(fs.existsSync(path.join(dist, url.slice(base.length))), `${url} is missing from dist`);
}

for (const relativePath of [
  'data/documents.json',
  'data/locations.json',
  'data/battle-pass.json',
  'data/optimizer-rules.json',
  'data/localization.json',
]) {
  assert.ok(fs.existsSync(path.join(dist, relativePath)), `dist/${relativePath} is missing`);
}

for (const document of documents.documents) {
  const relativePath = document.imagePath.replace(/^\//, '');
  assert.ok(fs.existsSync(path.join(dist, relativePath)), `dist/${relativePath} is missing`);
}

console.log('GitHub Pages asset paths resolve under the configured base path.');
