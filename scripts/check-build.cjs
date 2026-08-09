const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { JSDOM } = require('jsdom');
const sharp = require('sharp');

const site = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const localization = JSON.parse(fs.readFileSync('public/data/localization.json', 'utf8'));
const documents = JSON.parse(fs.readFileSync('public/data/documents.json', 'utf8'));
const dist = path.resolve('dist');
const analyticsSource = 'https://static.cloudflareinsights.com/beacon.min.js';
const analyticsToken = process.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();
const verificationToken = process.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
const localizationEntries = new Map(localization.entries.map((entry) => [entry.id, entry.localizations]));

async function main() {
  assert.ok(!fs.existsSync(path.join(dist, 'wireframe.html')), 'dist contains a duplicate wireframe page');
  assert.ok(!fs.existsSync(path.join(dist, 'robots.txt')), 'dist must not contain a project-level robots.txt');

  for (const route of site.locales) validateLocalePage(route);
  validateSitemap();
  await validateImages();

  console.log('Localized GitHub Pages output, SEO metadata, sitemap, images, and optional integrations are valid.');
}

function validateLocalePage(route) {
  const htmlPath = path.join(dist, route.path, 'index.html');
  assert.ok(fs.existsSync(htmlPath), `dist/${route.path}index.html is missing`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const document = new JSDOM(html).window.document;
  const canonicalUrl = new URL(route.path, site.canonicalUrl).href;
  const text = (id) => localizationEntries.get(id)?.[route.locale];
  const description = text('seo.description');

  assert.equal(document.documentElement.lang, route.locale, `${route.locale} has the wrong html lang`);
  assert.equal(document.title, text('seo.title'), `${route.locale} has the wrong title`);
  assert.ok([...description].length >= 25 && [...description].length <= 160, `${route.locale} description must contain 25 to 160 characters`);
  assert.equal(meta(document, 'name', 'description'), description, `${route.locale} has the wrong description`);
  assert.equal(meta(document, 'name', 'robots'), 'max-image-preview:large', `${route.locale} has the wrong robots metadata`);
  assert.doesNotMatch(meta(document, 'name', 'robots'), /noindex|nofollow/iu);
  assert.equal(document.querySelector('link[rel="canonical"]')?.href, canonicalUrl, `${route.locale} has the wrong canonical`);
  assert.equal(document.querySelectorAll('h1').length, 1, `${route.locale} must contain one h1`);
  assert.ok(document.querySelector('h1')?.textContent?.trim(), `${route.locale} h1 is empty`);

  const alternates = new Map([...document.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map((link) => [link.getAttribute('hreflang'), link.href]));
  assert.equal(alternates.size, site.locales.length + 1, `${route.locale} has an incomplete hreflang set`);
  for (const alternate of site.locales) {
    assert.equal(alternates.get(alternate.hreflang), new URL(alternate.path, site.canonicalUrl).href);
  }
  assert.equal(alternates.get('x-default'), site.canonicalUrl);

  assert.equal(meta(document, 'property', 'og:title'), text('seo.title'));
  assert.equal(meta(document, 'property', 'og:description'), text('seo.description'));
  assert.equal(meta(document, 'property', 'og:type'), 'website');
  assert.equal(meta(document, 'property', 'og:url'), canonicalUrl);
  assert.equal(meta(document, 'property', 'og:locale'), route.ogLocale);
  assert.equal(meta(document, 'property', 'og:image:type'), 'image/png');
  assert.equal(meta(document, 'property', 'og:image:width'), '1200');
  assert.equal(meta(document, 'property', 'og:image:height'), '630');
  assert.equal(meta(document, 'property', 'og:image:alt'), text('seo.socialImageAlt'));
  assert.equal(meta(document, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta(document, 'name', 'twitter:title'), text('seo.title'));
  assert.equal(meta(document, 'name', 'twitter:description'), text('seo.description'));
  assert.equal(meta(document, 'name', 'twitter:image:alt'), text('seo.socialImageAlt'));

  const structuredData = JSON.parse(document.querySelector('script[data-structured-data]')?.textContent ?? 'null');
  assert.equal(structuredData['@type'], 'WebApplication');
  assert.equal(structuredData.url, canonicalUrl);
  assert.equal(structuredData.description, text('seo.description'));
  assert.equal(structuredData.inLanguage, route.locale);
  assert.equal(structuredData.isAccessibleForFree, true);
  assert.deepEqual(structuredData.offers, { '@type': 'Offer', price: 0, priceCurrency: 'USD' });
  assert.equal(structuredData.sameAs, site.repositoryUrl);
  assert.deepEqual(structuredData.about, { '@type': 'VideoGame', name: 'Escape from Tarkov' });

  const shell = document.querySelector('.wireframe-shell');
  assert.ok(shell?.hasAttribute('data-app-pending'), `${route.locale} shell has no pending state`);
  assert.equal(shell?.getAttribute('aria-busy'), 'true');
  assert.ok(!shell?.hasAttribute('inert'), `${route.locale} pending content must remain visible to crawlers`);
  assert.ok(document.querySelectorAll('[data-pending-control][inert]').length > 0, `${route.locale} pending controls must be inert`);
  assert.ok(document.querySelector('[data-app-error]')?.textContent?.trim(), `${route.locale} has no static load error`);
  assert.ok(document.querySelector('[data-focus-content][data-static-next-raid]'), `${route.locale} has no static route recommendation`);
  assert.equal(document.querySelector('[data-focus-content] img')?.getAttribute('fetchpriority'), 'high');
  assert.ok(document.querySelector('[data-about-summary]')?.textContent?.trim(), `${route.locale} About summary is empty`);
  assert.equal(document.querySelectorAll('[data-about-table-body] tr').length, 8, `${route.locale} About table is incomplete`);
  assert.doesNotMatch(html, /%VITE_[A-Z0-9_]+%|⟦missing:/u, `${route.locale} contains an unresolved placeholder`);

  const verificationTags = document.querySelectorAll('meta[name="google-site-verification"]');
  if (verificationToken) {
    assert.equal(verificationTags.length, 1, `${route.locale} must contain one Google verification tag`);
    assert.equal(verificationTags[0].getAttribute('content'), verificationToken);
  } else assert.equal(verificationTags.length, 0, `${route.locale} must omit unconfigured Google verification`);

  const analyticsScripts = document.querySelectorAll(`script[src="${analyticsSource}"]`);
  if (analyticsToken) {
    assert.equal(analyticsScripts.length, 1, `${route.locale} must contain one Cloudflare beacon`);
    assert.equal(analyticsScripts[0].getAttribute('type'), 'module');
    assert.ok(analyticsScripts[0].getAttribute('data-cf-beacon')?.includes(analyticsToken));
  } else assert.equal(analyticsScripts.length, 0, `${route.locale} must omit unconfigured Cloudflare analytics`);

  for (const element of document.querySelectorAll('[src], [href]')) {
    const url = element.getAttribute('src') ?? element.getAttribute('href');
    if (!url || url === analyticsSource) continue;
    validateBuiltUrl(url);
  }

  for (const image of document.querySelectorAll('[data-document-id] img')) {
    assert.match(image.getAttribute('srcset') ?? '', /-192\.webp 192w/u);
    assert.match(image.getAttribute('srcset') ?? '', /-384\.webp 384w/u);
    assert.equal(image.getAttribute('loading'), 'lazy');
    assert.equal(image.getAttribute('decoding'), 'async');
  }
}

function validateBuiltUrl(value) {
  if (value.startsWith(site.canonicalUrl)) {
    const pathname = new URL(value).pathname;
    validateProjectPath(pathname);
    return;
  }
  if (value.startsWith(site.basePath)) {
    validateProjectPath(value);
    return;
  }
  if (value.startsWith('./')) {
    const relativePath = value.slice(2);
    assert.ok(fs.existsSync(path.join(dist, relativePath)), `${value} is missing from dist`);
    return;
  }
  assert.fail(`${value} is outside the configured Pages site or the approved Cloudflare source`);
}

function validateProjectPath(pathname) {
  assert.ok(pathname.startsWith(site.basePath), `${pathname} is outside the configured Pages base path`);
  const relativePath = pathname.slice(site.basePath.length);
  const target = relativePath === '' || relativePath.endsWith('/')
    ? path.join(dist, relativePath, 'index.html')
    : path.join(dist, relativePath);
  assert.ok(fs.existsSync(target), `${pathname} is missing from dist`);
}

function validateSitemap() {
  const sitemapPath = path.join(dist, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'dist/sitemap.xml is missing');
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  assert.deepEqual(urls, site.locales.map((route) => new URL(route.path, site.canonicalUrl).href));
  assert.doesNotMatch(sitemap, /index\.html|<priority>|<changefreq>|<lastmod>/u);
  for (const url of urls) assert.equal(new URL(url).search + new URL(url).hash, '');
}

async function validateImages() {
  const socialImage = path.join(dist, 'assets/social/eft-season-optimizer.png');
  const socialMetadata = await sharp(socialImage).metadata();
  assert.equal(socialMetadata.width, 1200);
  assert.equal(socialMetadata.height, 630);
  assert.equal(socialMetadata.format, 'png');

  for (const document of documents.documents) {
    const original = document.imagePath.replace(/^\//u, '');
    assert.ok(fs.existsSync(path.join(dist, original)), `dist/${original} is missing`);
    for (const size of [192, 384]) {
      const variant = original.replace(/\.webp$/u, `-${size}.webp`);
      const metadata = await sharp(path.join(dist, variant)).metadata();
      assert.equal(metadata.width, size, `${variant} has the wrong width`);
      assert.equal(metadata.height, size, `${variant} has the wrong height`);
      assert.equal(metadata.format, 'webp', `${variant} has the wrong format`);
    }
  }

  for (const relativePath of [
    'data/documents.json',
    'data/locations.json',
    'data/battle-pass.json',
    'data/optimizer-rules.json',
    'data/localization.json',
  ]) assert.ok(fs.existsSync(path.join(dist, relativePath)), `dist/${relativePath} is missing`);
}

function meta(document, attribute, key) {
  return document.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
