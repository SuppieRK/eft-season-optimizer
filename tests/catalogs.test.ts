import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CatalogValidationError,
  loadCatalogs,
  parseCatalogs,
  type CatalogKey,
} from '../src/catalogs';

const catalogPaths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function readCatalogs(): Record<CatalogKey, unknown> {
  return Object.fromEntries(
    Object.entries(catalogPaths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>;
}

describe('catalogs', () => {
  it('loads the screenshot-backed catalogs and preserves canonical metadata', () => {
    const catalogs = parseCatalogs(readCatalogs());

    expect(catalogs.battlePass.gameDataVersion).toBeTruthy();
    expect(catalogs.battlePass.id).toBeTruthy();
    expect(catalogs.battlePass.endsAt).toBeGreaterThan(0);
    expect(catalogs.battlePass.pages.length).toBeGreaterThan(0);

    expect(Object.fromEntries(catalogs.locations.locations.map((location) => [location.id, [location.difficultyId, location.difficultyRating, location.maxRaidTimeMin]]))).toEqual({
      'locations.lab.name': ['difficulty.insane', 4, 30],
      'locations.labyrinth.name': ['difficulty.insane', 4, 30],
      'locations.icebreaker.name': ['difficulty.insane', 4, 50],
      'locations.groundZero.name': ['difficulty.hard', 3, 35],
      'locations.woods.name': ['difficulty.normal', 2, 25],
      'locations.streets.name': ['difficulty.insane', 4, 50],
      'locations.factory.name': ['difficulty.easy', 1, 15],
      'locations.customs.name': ['difficulty.hard', 3, 25],
      'locations.interchange.name': ['difficulty.hard', 3, 35],
      'locations.reserve.name': ['difficulty.insane', 4, 27],
      'locations.lighthouse.name': ['difficulty.insane', 4, 30],
      'locations.shoreline.name': ['difficulty.hard', 3, 35],
      'locations.terminal.name': ['difficulty.insane', 4, 45],
    });

    expect(catalogs.documents.documents.find((document) => document.id === 'documents.medical.name')?.sourceLocationIds).toContain('locations.labyrinth.name');
    expect(catalogs.documents.documents.find((document) => document.id === 'documents.blueprints.name')?.sourceLocationIds).toContain('locations.labyrinth.name');

    expect(catalogs.optimizerRules.dailyDocumentLimits).toEqual({ pve: 10, pvp: 15, 'pvp-seasonal': 25 });
    expect(catalogs.optimizerRules.exchange).toEqual({
      regularDocumentsPerBlackDivisionGearCrate: 10,
      regularDocumentsPerOtherDocuments: 5,
    });
    expect(catalogs.optimizerRules.tarCoinBundles.map((bundle) => [bundle.tarCoins, bundle.localPriceId])).toEqual([
      [500, 'tarCoinBundles.500.localPrice'],
      [1200, 'tarCoinBundles.1200.localPrice'],
      [2600, 'tarCoinBundles.2600.localPrice'],
      [7000, 'tarCoinBundles.7000.localPrice'],
      [15000, 'tarCoinBundles.15000.localPrice'],
      [25500, 'tarCoinBundles.25500.localPrice'],
    ]);
    expect(JSON.stringify(readCatalogs().optimizerRules)).not.toContain('bonusTarCoins');
    expect(catalogs.optimizerRules.tarCoinBundles.every((bundle) => !('bonusTarCoins' in bundle))).toBe(true);
    expect(catalogs.optimizerRules.classifiedDocuments.bundles.every((bundle) => !('bonusTarCoins' in bundle))).toBe(true);
    expect(catalogs.localization.schemaVersion).toBe(2);
    expect(catalogs.localization.defaultLocale).toBe('en-GB');
    expect(catalogs.localization.supportedLocales).toEqual(['en-GB', 'ru-RU']);
    expect(catalogs.localization.priceEntries.map((entry) => entry.localizations['en-GB'])).toEqual([
      { price: 4.99, currency: 'USD' },
      { price: 9.99, currency: 'USD' },
      { price: 19.99, currency: 'USD' },
      { price: 49.99, currency: 'USD' },
      { price: 99.99, currency: 'USD' },
      { price: 149.99, currency: 'USD' },
    ]);

  });

  it('loads catalogs through the configured Pages base path', async () => {
    const raw = readCatalogs();
    const requested: string[] = [];
    const catalogs = await loadCatalogs('/eft-season-optimizer/', async (url) => {
      requested.push(String(url));
      const key = Object.entries(catalogPaths).find(([, filePath]) => String(url).endsWith(filePath.replace('public/', '')))?.[0] as CatalogKey;
      return { ok: true, status: 200, json: async () => raw[key] } as Response;
    });

    expect(catalogs.documents.documents).toHaveLength(9);
    expect(requested).toEqual([
      '/eft-season-optimizer/data/documents.json',
      '/eft-season-optimizer/data/locations.json',
      '/eft-season-optimizer/data/battle-pass.json',
      '/eft-season-optimizer/data/optimizer-rules.json',
      '/eft-season-optimizer/data/localization.json',
    ]);
  });

  it('accepts corrected season metadata without runtime constants', () => {
    const raw = readCatalogs();
    const battlePass = structuredClone(raw.battlePass) as { endsAt: number; gameDataVersion: string };
    battlePass.endsAt = 1_800_000_000;
    battlePass.gameDataVersion = 'next-reviewed-version';

    expect(parseCatalogs({ ...raw, battlePass }).battlePass).toMatchObject({
      endsAt: 1_800_000_000,
      gameDataVersion: 'next-reviewed-version',
    });
  });

  it('rejects redundant behavior fields and broken references', () => {
    const raw = readCatalogs();
    const documents = structuredClone(raw.documents) as { documents: Array<Record<string, unknown>> };
    documents.documents[0].farmable = true;
    expect(() => parseCatalogs({ ...raw, documents })).toThrow(CatalogValidationError);

    const battlePass = structuredClone(raw.battlePass) as { pages: Array<{ rewards: Array<{ requirements: Array<Record<string, unknown>> }> }> };
    battlePass.pages[0].rewards[0].requirements[0].documentId = 'documents.missing.name';
    expect(() => parseCatalogs({ ...raw, battlePass })).toThrow(/unknown document/);

    const localization = structuredClone(raw.localization) as { priceEntries: Array<{ localizations: { 'en-GB': Record<string, unknown> } }> };
    localization.priceEntries[0].localizations['en-GB'].currency = 'US';
    expect(() => parseCatalogs({ ...raw, localization })).toThrow(/three-letter uppercase ISO currency code/);
  });
});
