import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { parseCatalogs, type CatalogKey } from '../src/catalogs';
import {
  getDefaultLocaleRoute,
  getLocalePath,
  getLocaleRouteForPath,
  getLocaleUrl,
  siteConfig,
} from '../src/site';
import { createSitemap, renderLocalizedPage, validateSiteConfig } from '../scripts/seo-pages';

function catalogs() {
  const paths: Record<CatalogKey, string> = {
    documents: 'public/data/documents.json',
    locations: 'public/data/locations.json',
    battlePass: 'public/data/battle-pass.json',
    optimizerRules: 'public/data/optimizer-rules.json',
    localization: 'public/data/localization.json',
  };
  return parseCatalogs(Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>);
}

describe('site locale routes', () => {
  it('keeps English at the current root and gives Russian a stable subdirectory', () => {
    expect(getDefaultLocaleRoute().locale).toBe('en-GB');
    expect(getLocalePath('en-GB')).toBe('/eft-season-optimizer/');
    expect(getLocalePath('ru-RU')).toBe('/eft-season-optimizer/ru/');
    expect(getLocaleUrl('en-GB')).toBe('https://suppierk.github.io/eft-season-optimizer/');
    expect(getLocaleUrl('ru-RU')).toBe('https://suppierk.github.io/eft-season-optimizer/ru/');
    expect(getLocaleRouteForPath('/eft-season-optimizer/')?.locale).toBe('en-GB');
    expect(getLocaleRouteForPath('/eft-season-optimizer/ru/')?.locale).toBe('ru-RU');
    expect(getLocaleRouteForPath('/eft-season-optimizer/unknown/')).toBeUndefined();
  });

  it('validates complete route coverage and emits only canonical locale URLs', () => {
    expect(() => validateSiteConfig(siteConfig, catalogs())).not.toThrow();
    expect(createSitemap(siteConfig)).toContain('<loc>https://suppierk.github.io/eft-season-optimizer/</loc>');
    expect(createSitemap(siteConfig)).toContain('<loc>https://suppierk.github.io/eft-season-optimizer/ru/</loc>');
    expect(createSitemap(siteConfig)).not.toMatch(/index\.html|priority|changefreq|lastmod/u);
  });

  it('renders locale-specific metadata and optional Search Console verification', () => {
    const catalog = catalogs();
    const source = readFileSync(resolve('index.html'), 'utf8');
    const russianRoute = siteConfig.locales.find((route) => route.locale === 'ru-RU')!;
    const document = new JSDOM(renderLocalizedPage(source, russianRoute, siteConfig, catalog, ' test-verification ')).window.document;

    expect(document.documentElement.lang).toBe('ru-RU');
    expect(document.title).toContain('Оптимизатор');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://suppierk.github.io/eft-season-optimizer/ru/');
    expect(document.querySelector('meta[name="google-site-verification"]')?.getAttribute('content')).toBe('test-verification');
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(3);

    const withoutVerification = new JSDOM(renderLocalizedPage(source, russianRoute, siteConfig, catalog)).window.document;
    expect(withoutVerification.querySelector('meta[name="google-site-verification"]')).toBeNull();
  });
});
