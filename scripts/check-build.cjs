const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = '/eft-season-optimizer/';
const dist = path.resolve('dist');
const htmlPath = path.join(dist, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const documents = JSON.parse(fs.readFileSync('public/data/documents.json', 'utf8'));
const analyticsSource = 'https://static.cloudflareinsights.com/beacon.min.js';
const analyticsToken = process.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();

assert.match(html, /wireframe-shell/, 'dist/index.html does not contain the reviewed optimizer interface');
assert.ok(!fs.existsSync(path.join(dist, 'wireframe.html')), 'dist contains a duplicate wireframe page');
assert.doesNotMatch(html, /%VITE_[A-Z0-9_]+%/, 'dist/index.html contains an unresolved Vite environment placeholder');

for (const assetPath of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = assetPath[1];
  if (url === analyticsSource) continue;
  const relativePath = url.startsWith(base)
    ? url.slice(base.length)
    : url.startsWith('./')
      ? url.slice(2)
      : undefined;
  assert.ok(relativePath, `${url} is outside the configured Pages base path`);
  assert.ok(fs.existsSync(path.join(dist, relativePath)), `${url} is missing from dist`);
}

const analyticsScripts = [...html.matchAll(/<script\b[^>]*\bsrc="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"[^>]*><\/script>/g)];
if (analyticsToken) {
  assert.equal(analyticsScripts.length, 1, 'dist/index.html must contain exactly one Cloudflare Web Analytics beacon');
  const analyticsScript = analyticsScripts[0][0];
  assert.match(analyticsScript, /\btype="module"/, 'Cloudflare Web Analytics must use a module script');
  assert.match(analyticsScript, /\bdata-cf-beacon=/, 'Cloudflare Web Analytics is missing its beacon data');
  assert.ok(analyticsScript.includes(analyticsToken), 'Cloudflare Web Analytics does not contain the configured token');
} else {
  assert.equal(analyticsScripts.length, 0, 'Cloudflare Web Analytics must be omitted when no token is configured');
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

console.log('GitHub Pages asset paths and optional analytics configuration are valid.');
