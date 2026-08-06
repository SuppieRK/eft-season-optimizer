import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  GAME_DATA_VERSION,
  SEASON_ENDS_AT,
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

    expect(catalogs.battlePass.gameDataVersion).toBe(GAME_DATA_VERSION);
    expect(catalogs.battlePass.id).toBe('season.one');
    expect(catalogs.battlePass.endsAt).toBe(SEASON_ENDS_AT);
    expect(catalogs.battlePass.pages.map((page) => page.rewards.length)).toEqual([5, 5, 5, 5, 5, 3, 4, 5, 5, 4, 4, 3]);
    expect(catalogs.battlePass.pages.slice(1).map((page) => page.rewards.length)).toEqual([5, 5, 5, 5, 3, 4, 5, 5, 4, 4, 3]);
    expect(catalogs.battlePass.pages.slice(1).map((_, index) => catalogs.battlePass.pages[index].rewards.length - 1)).toEqual([4, 4, 4, 4, 4, 2, 3, 4, 4, 3, 3]);
    expect(catalogs.battlePass.pages.flatMap((page) => page.rewards)).toHaveLength(53);

    expect(Object.fromEntries(catalogs.locations.locations.map((location) => [location.id, [location.difficultyId, location.difficultyRating, location.maxRaidTimeMin]]))).toEqual({
      'locations.lab.name': ['difficulty.insane', 4, 30],
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

    expect(catalogs.optimizerRules.dailyDocumentLimits).toEqual({ pve: 10, pvp: 15, 'pvp-seasonal': 25 });
    expect(catalogs.optimizerRules.exchange).toEqual({
      regularDocumentsPerBlackDivisionGearCrate: 10,
      regularDocumentsPerOtherDocuments: 5,
    });
    expect(catalogs.optimizerRules.tarCoinBundles.map((bundle) => [bundle.tarCoins, bundle.bonusTarCoins])).toEqual([
      [500, 0],
      [1100, 100],
      [2300, 300],
      [6000, 1000],
      [12500, 2500],
      [20250, 5250],
    ]);
    expect(catalogs.localization.priceEntries.map((entry) => entry.localizations.en)).toEqual([
      { amountMinor: 499, currency: 'USD', display: 'FROM $ 4.99' },
      { amountMinor: 999, currency: 'USD', display: 'FROM $ 9.99' },
      { amountMinor: 1999, currency: 'USD', display: 'FROM $ 19.99' },
      { amountMinor: 4999, currency: 'USD', display: 'FROM $ 49.99' },
      { amountMinor: 9999, currency: 'USD', display: 'FROM $ 99.99' },
      { amountMinor: 14999, currency: 'USD', display: 'FROM $ 149.99' },
    ]);

    const tarCoinRewards = catalogs.battlePass.pages.flatMap((page) => page.rewards)
      .filter((reward) => reward.tarCoinsAwarded !== undefined)
      .map((reward) => [reward.id, reward.tarCoinsAwarded]);
    expect(tarCoinRewards).toEqual([
      ['rewards.tarcoins50-01.name', 50],
      ['rewards.tarcoins50-02.name', 50],
      ['rewards.tarcoins50-03.name', 50],
      ['rewards.tarcoins50-04.name', 50],
      ['rewards.tarcoins50-05.name', 50],
      ['rewards.tarcoins50-06.name', 50],
      ['rewards.tarcoins50-07.name', 50],
      ['rewards.tarcoins50-08.name', 50],
      ['rewards.tarcoins100.name', 100],
      ['rewards.tarcoins150.name', 150],
    ]);
  });

  it('loads catalogs through the configured Pages base path', async () => {
    const raw = readCatalogs();
    const requested: string[] = [];
    const catalogs = await loadCatalogs('/kord-breach-optimizer/', async (url) => {
      requested.push(String(url));
      const key = Object.entries(catalogPaths).find(([, filePath]) => String(url).endsWith(filePath.replace('public/', '')))?.[0] as CatalogKey;
      return { ok: true, status: 200, json: async () => raw[key] } as Response;
    });

    expect(catalogs.documents.documents).toHaveLength(9);
    expect(requested).toEqual([
      '/kord-breach-optimizer/data/documents.json',
      '/kord-breach-optimizer/data/locations.json',
      '/kord-breach-optimizer/data/battle-pass.json',
      '/kord-breach-optimizer/data/optimizer-rules.json',
      '/kord-breach-optimizer/data/localization.json',
    ]);
  });

  it('rejects redundant behavior fields and broken references', () => {
    const raw = readCatalogs();
    const documents = structuredClone(raw.documents) as { documents: Array<Record<string, unknown>> };
    documents.documents[0].farmable = true;
    expect(() => parseCatalogs({ ...raw, documents })).toThrow(CatalogValidationError);

    const battlePass = structuredClone(raw.battlePass) as { pages: Array<{ rewards: Array<{ requirements: Array<Record<string, unknown>> }> }> };
    battlePass.pages[0].rewards[0].requirements[0].documentId = 'documents.missing.name';
    expect(() => parseCatalogs({ ...raw, battlePass })).toThrow(/unknown document/);
  });
});
