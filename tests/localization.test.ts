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
  getTextDirection,
  pluralCategory,
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
    incomplete.supportedLocales = ['en', 'fr'];
    const localizer = createLocalizer(incomplete, 'fr');

    expect(localizer.locale).toBe('fr');
    expect(localizer.text('app.title')).toBe('KORD Breach Optimizer');
    expect(localizer.text('missing.id')).toBe('⟦missing:missing.id⟧');
    expect(localizer.price('tarCoinBundles.500.localPrice')).toBeUndefined();
    expect(getCompleteLocales(incomplete)).toEqual(['en']);
    expect(resolveStoredLocale('fr', ['en'], 'en')).toBe('en');
    expect(resolveStoredLocale('en', ['en'], 'en')).toBe('en');
  });

  it('formats quantities, dates, prices, compact requirements, and direction metadata', () => {
    const localizer = createLocalizer(catalogs().localization);
    const requirements = [{ documentId: 'documents.financial.name', quantity: 2 }];
    const names = { 'documents.financial.name': 'Financial documents' };
    const abbreviations = { 'documents.financial.name': 'FIN' };

    expect(formatCompactRequirements(requirements, abbreviations, localizer.locale)).toBe('FIN 2');
    expect(formatAccessibleRequirements(requirements, names, localizer.locale)).toBe('Financial documents: 2');
    expect(formatCountdownUnit(2, 'en', 'day')).toBe('2 days');
    expect(formatDateTime(1796637600, 'en-US')).toContain('Dec 7, 2026');
    expect(formatLocalPrice(localizer.price('tarCoinBundles.500.localPrice')!, 'en-US')).toBe('$4.99');
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
    expect(getTextDirection('ar')).toBe('rtl');
    expect(getTextDirection('en')).toBe('ltr');
  });
});
