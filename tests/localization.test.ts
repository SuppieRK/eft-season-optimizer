import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey } from '../src/catalogs';
import {
  createLocalizer,
  formatAccessibleRequirements,
  formatCompactRequirements,
  formatCountdownUnit,
  formatDateTime,
  formatLocalPrice,
  getCompleteLocales,
  getLocaleRegion,
  getTextDirection,
  pluralCategory,
  resolvePreferredLocale,
  resolveStoredLocale,
} from '../src/localization';

const paths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function catalogs() {
  return parseCatalogs(Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>);
}

describe('localization', () => {
  it('resolves text with default fallback and never falls back real-money prices', () => {
    const catalog = catalogs().localization;
    const incomplete = structuredClone(catalog) as typeof catalog & { supportedLocales: string[] };
    incomplete.supportedLocales = ['en-GB', 'fr-FR'];
    const localizer = createLocalizer(incomplete, 'fr-FR');

    expect(localizer.locale).toBe('fr-FR');
    expect(localizer.text('app.title')).toBe('KORD Breach Optimizer');
    expect(localizer.text('missing.id')).toBe('⟦missing:missing.id⟧');
    expect(localizer.price('tarCoinBundles.500.localPrice')).toBeUndefined();
    expect(getCompleteLocales(incomplete)).toEqual(['en-GB']);
    expect(resolveStoredLocale('fr-FR', ['en-GB'], 'en-GB')).toBe('en-GB');
    expect(resolveStoredLocale('en-GB', ['en-GB'], 'en-GB')).toBe('en-GB');
  });

  it('formats quantities, dates, prices, compact requirements, and direction metadata', () => {
    const localizer = createLocalizer(catalogs().localization);
    const requirements = [{ documentId: 'documents.financial.name', quantity: 2 }];
    const names = { 'documents.financial.name': 'Financial documents' };
    const abbreviations = { 'documents.financial.name': 'FIN' };

    expect(formatCompactRequirements(requirements, abbreviations, localizer.locale)).toBe('FIN 2');
    expect(formatAccessibleRequirements(requirements, names, localizer.locale)).toBe('Financial documents: 2');
    expect(formatCountdownUnit(2, localizer.locale, 'day')).toBe('2 days');
    expect(formatDateTime(1796637600, 'en-US')).toContain('Dec 7, 2026');
    expect(formatLocalPrice(localizer.price('tarCoinBundles.500.localPrice')!, 'en-US')).toBe('$4.99');
    expect(formatLocalPrice(localizer.price('tarCoinBundles.500.localPrice')!, 'en-GB')).toBe('$4.99');
    expect(pluralCategory(1, localizer.locale)).toBe('one');
    expect(pluralCategory(2, localizer.locale)).toBe('other');
    expect(getTextDirection('ar')).toBe('rtl');
    expect(getTextDirection(localizer.locale)).toBe('ltr');
  });

  it('selects a browser locale and derives its flag region without a locale-specific mapping', () => {
    const completeLocales = ['en-GB', 'fr-FR', 'fr-CA'];

    expect(resolvePreferredLocale(['fr-CA', 'en-US'], completeLocales, 'en-GB')).toBe('fr-CA');
    expect(resolvePreferredLocale(['en-US'], completeLocales, 'en-GB')).toBe('en-GB');
    expect(resolvePreferredLocale(['fr'], completeLocales, 'en-GB')).toBe('en-GB');
    expect(resolvePreferredLocale(['de-DE'], completeLocales, 'en-GB')).toBe('en-GB');
    expect(getLocaleRegion('en-GB')).toBe('gb');
    expect(getLocaleRegion('fr-CA')).toBe('ca');
  });
});
