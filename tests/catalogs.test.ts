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

    expect(Object.fromEntries(catalogs.locations.locations.map((location) => [location.id, [location.difficultyId, location.difficultyRating, location.maxRaidTimeMin, location.insurance]]))).toEqual({
      'locations.lab.name': ['difficulty.insane', 4, 30, false],
      'locations.labyrinth.name': ['difficulty.insane', 4, 30, false],
      'locations.icebreaker.name': ['difficulty.insane', 4, 50, false],
      'locations.groundZero.name': ['difficulty.hard', 3, 35, true],
      'locations.woods.name': ['difficulty.normal', 2, 25, true],
      'locations.streets.name': ['difficulty.insane', 4, 50, true],
      'locations.factory.name': ['difficulty.easy', 1, 15, true],
      'locations.customs.name': ['difficulty.hard', 3, 25, true],
      'locations.interchange.name': ['difficulty.hard', 3, 35, true],
      'locations.reserve.name': ['difficulty.insane', 4, 27, true],
      'locations.lighthouse.name': ['difficulty.insane', 4, 30, true],
      'locations.shoreline.name': ['difficulty.hard', 3, 35, true],
      'locations.terminal.name': ['difficulty.insane', 4, 45, true],
    });

    expect(catalogs.documents.documents.find((document) => document.id === 'documents.medical.name')?.sourceLocationIds).toContain('locations.labyrinth.name');
    expect(catalogs.documents.documents.find((document) => document.id === 'documents.blueprints.name')?.sourceLocationIds).toContain('locations.labyrinth.name');

    expect(catalogs.optimizerRules.dailyDocumentLimits).toEqual({ pve: 10, pvp: 15, 'pvp-seasonal': 25 });
    expect(catalogs.optimizerRules.exchange).toEqual({
      regularDocumentsPerBlackDivisionGearCrate: 10,
      regularDocumentsPerOtherDocuments: 5,
    });
    const priceIds = new Set(catalogs.localization.priceEntries.map((entry) => entry.id));
    expect(catalogs.optimizerRules.tarCoinBundles.length).toBeGreaterThan(0);
    expect(catalogs.optimizerRules.tarCoinBundles.every((bundle) => (
      bundle.tarCoins > 0 && priceIds.has(bundle.localPriceId)
    ))).toBe(true);
    expect(JSON.stringify(readCatalogs().optimizerRules)).not.toContain('bonusTarCoins');
    expect(catalogs.optimizerRules.tarCoinBundles.every((bundle) => !('bonusTarCoins' in bundle))).toBe(true);
    expect(catalogs.optimizerRules.classifiedDocuments.bundles.every((bundle) => !('bonusTarCoins' in bundle))).toBe(true);
    expect(catalogs.localization.schemaVersion).toBe(2);
    expect(catalogs.localization.supportedLocales).toContain(catalogs.localization.defaultLocale);
    expect(catalogs.localization.priceEntries.every((entry) => {
      const value = entry.localizations[catalogs.localization.defaultLocale];
      return value !== undefined
        && Number.isFinite(value.price)
        && value.price >= 0
        && /^[A-Z]{3}$/u.test(value.currency);
    })).toBe(true);

  });

  it('loads catalogs through the configured Pages base path', async () => {
    const raw = readCatalogs();
    const requested: string[] = [];
    const requestOptions: Array<RequestInit | undefined> = [];
    const catalogs = await loadCatalogs('/eft-season-optimizer/', async (url, options) => {
      requested.push(String(url));
      requestOptions.push(options);
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
    expect(requestOptions).toEqual(Array.from({ length: 5 }, () => ({ cache: 'no-store' })));
  });

  it('creates a semantic fingerprint for every catalog value', () => {
    const raw = readCatalogs();
    const original = parseCatalogs(raw);
    const reordered = Object.fromEntries(Object.entries(raw).reverse()) as Record<CatalogKey, unknown>;
    const changed = structuredClone(raw);
    const locations = changed.locations as { locations: Array<{ maxRaidTimeMin: number }> };
    locations.locations[0].maxRaidTimeMin += 1;

    expect(original.dataFingerprint).toMatch(/^catalog-v1-[a-z0-9]+-[a-f0-9]{16}$/u);
    expect(parseCatalogs(reordered).dataFingerprint).toBe(original.dataFingerprint);
    expect(parseCatalogs(changed).dataFingerprint).not.toBe(original.dataFingerprint);
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
