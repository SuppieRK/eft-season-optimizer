import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey } from '../src/catalogs';
import { clearPersistedState, restoreState, resetPersistedState, saveState, type CookieAdapter } from '../src/persistence';
import { createDefaultState, reduceState } from '../src/state';

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

function memoryCookies(): CookieAdapter & { values: Record<string, string> } {
  const values: Record<string, string> = {};
  return {
    values,
    read: (name) => values[name],
    write: (name, value) => { values[name] = encodeURIComponent(value); },
    remove: (name) => { delete values[name]; },
  };
}

describe('state and cookie persistence', () => {
  it('reduces global controls, inventory, claims, and selected page immutably', () => {
    const catalog = catalogs();
    const initial = createDefaultState(catalog);
    const documentId = 'documents.financial.name';
    const rewardId = 'rewards.dogtag01.name';
    const changed = reduceState(initial, { type: 'increment-document', documentId }, catalog);
    const claimed = reduceState(changed, { type: 'claim-reward', rewardId, claimed: true }, catalog);
    const mode = reduceState(claimed, { type: 'set-mode', mode: 'pvp-seasonal' }, catalog);
    const selected = reduceState(mode, { type: 'set-page', page: 2 }, catalog);

    expect(initial.mode).toBe('pvp-seasonal');
    expect(initial.classifiedDocuments).toBe(1);
    expect(initial.ownedDocuments[documentId]).toBe(0);
    expect(selected.ownedDocuments[documentId]).toBe(1);
    expect(selected.claimedRewardIds).toEqual([rewardId]);
    expect(claimed.ownedDocuments).toEqual(changed.ownedDocuments);
    expect(selected.mode).toBe('pvp-seasonal');
    expect(selected.selectedPage).toBe(2);
    expect(reduceState(selected, { type: 'set-page', page: 99 }, catalog)).toBe(selected);
    expect(reduceState(selected, { type: 'decrement-document', documentId }, catalog).ownedDocuments[documentId]).toBe(0);
    expect(reduceState(initial, { type: 'decrement-document', documentId }, catalog).ownedDocuments[documentId]).toBe(0);
  });

  it('round-trips versioned progress, settings, and UI cookies', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    const initial = createDefaultState(catalog);
    const state = reduceState(reduceState(reduceState(reduceState(reduceState(reduceState(initial, { type: 'set-mode', mode: 'pvp' }, catalog), { type: 'set-owned-document', documentId: 'documents.financial.name', quantity: 3 }, catalog), { type: 'set-classified-documents', quantity: 12 }, catalog), { type: 'set-profile', profile: 'safest' }, catalog), { type: 'set-page', page: 3 }, catalog), { type: 'dismiss-cookie-notice' }, catalog);

    saveState(state, cookies);
    const restored = restoreState(cookies, catalog);
    expect(restored.mode).toBe('pvp');
    expect(restored.ownedDocuments['documents.financial.name']).toBe(3);
    expect(restored.classifiedDocuments).toBe(12);
    expect(restored.cookieNoticeDismissed).toBe(true);
    expect(restored.selectedProfile).toBe('safest');
    expect(restored.ownedDocuments).toEqual(state.ownedDocuments);
    expect(restored.selectedPage).toBe(3);
  });

  it('uses the browser locale only when no supported locale cookie exists', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    const localization = {
      ...structuredClone(catalog.localization),
      supportedLocales: ['en-GB', 'fr-FR'],
      entries: catalog.localization.entries.map((entry) => ({
        ...entry,
        localizations: { ...entry.localizations, 'fr-FR': entry.localizations['en-GB'] },
      })),
      priceEntries: catalog.localization.priceEntries.map((entry) => ({
        ...entry,
        localizations: { ...entry.localizations, 'fr-FR': entry.localizations['en-GB'] },
      })),
    };
    const localizedCatalog = { ...catalog, localization };

    expect(restoreState(cookies, localizedCatalog, ['fr-FR']).locale).toBe('fr-FR');
    saveState({ ...createDefaultState(localizedCatalog), locale: 'en-GB' }, cookies);
    expect(restoreState(cookies, localizedCatalog, ['fr-FR']).locale).toBe('en-GB');
  });

  it('enforces one Classified Document only while no rewards are claimed', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    const initial = createDefaultState(catalog);
    const floored = reduceState(initial, { type: 'set-classified-documents', quantity: 0 }, catalog);
    const claimed = reduceState(floored, { type: 'claim-reward', rewardId: 'rewards.dogtag01.name', claimed: true }, catalog);
    const zeroWithClaim = reduceState(claimed, { type: 'set-classified-documents', quantity: 0 }, catalog);
    const noClaimsAgain = reduceState(zeroWithClaim, { type: 'claim-reward', rewardId: 'rewards.dogtag01.name', claimed: false }, catalog);

    expect(floored.classifiedDocuments).toBe(1);
    expect(zeroWithClaim.classifiedDocuments).toBe(0);
    expect(noClaimsAgain.classifiedDocuments).toBe(1);

    saveState({ ...initial, classifiedDocuments: 0 }, cookies);
    expect(restoreState(cookies, catalog).classifiedDocuments).toBe(1);
    saveState(zeroWithClaim, cookies);
    expect(restoreState(cookies, catalog).classifiedDocuments).toBe(0);
  });

  it('redeems a reward by subtracting matching regular documents before Classified Documents', () => {
    const catalog = catalogs();
    const initial = createDefaultState(catalog);
    const prepared = reduceState(reduceState(reduceState(initial,
      { type: 'set-owned-document', documentId: 'documents.project.name', quantity: 1 }, catalog),
    { type: 'set-owned-document', documentId: 'documents.blueprints.name', quantity: 1 }, catalog),
    { type: 'set-classified-documents', quantity: 1 }, catalog);
    const redeemed = reduceState(prepared, { type: 'redeem-reward', rewardId: 'rewards.tarcoins50-01.name' }, catalog);

    expect(redeemed.claimedRewardIds).toContain('rewards.tarcoins50-01.name');
    expect(redeemed.ownedDocuments['documents.project.name']).toBe(0);
    expect(redeemed.ownedDocuments['documents.blueprints.name']).toBe(0);
    expect(redeemed.classifiedDocuments).toBe(0);

    const insufficient = reduceState(initial, { type: 'redeem-reward', rewardId: 'rewards.tarcoins50-01.name' }, catalog);
    expect(insufficient).toBe(initial);
  });

  it('selects the first page with unclaimed rewards and resets there after clearing completion', () => {
    const catalog = catalogs();
    const initial = createDefaultState(catalog);
    const afterPageOne = reduceState(initial, { type: 'claim-page', page: 1, claimed: true }, catalog);
    const completed = reduceState(afterPageOne, { type: 'claim-all', claimed: true }, catalog);
    const cleared = reduceState(completed, { type: 'claim-all', claimed: false }, catalog);

    expect(afterPageOne.selectedPage).toBe(2);
    expect(completed.selectedPage).toBe(1);
    expect(cleared.selectedPage).toBe(1);

    const cookies = memoryCookies();
    saveState({ ...afterPageOne, selectedPage: 1 }, cookies);
    expect(restoreState(cookies, catalog).selectedPage).toBe(2);
  });

  it('migrates the previously expanded reward page without invalidating the UI cookie', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    saveState(createDefaultState(catalog), cookies);
    cookies.values['kord-breach-ui'] = encodeURIComponent(JSON.stringify({
      gameDataVersion: '1.1.0.0.46657.8.6.2026',
      schemaVersion: 1,
      payload: { collapsedPages: { '1': true, '2': false }, selectedProfile: 'safest', cookieNoticeDismissed: true },
    }));

    const restored = restoreState(cookies, catalog);
    expect(restored.selectedPage).toBe(2);
    expect(restored.selectedProfile).toBe('safest');
    expect(restored.cookieNoticeDismissed).toBe(true);
  });

  it('falls back malformed or incompatible segments and enforces cookie size limits', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    const defaults = createDefaultState(catalog);
    saveState({ ...defaults, mode: 'pvp', tarCoins: 3 }, cookies);
    cookies.values['kord-breach-settings'] = encodeURIComponent(JSON.stringify({ gameDataVersion: 'old', schemaVersion: 1, payload: { mode: 'pvp-seasonal' } }));
    const restored = restoreState(cookies, catalog);
    expect(restored.mode).toBe('pvp-seasonal');
    expect(restored.tarCoins).toBe(3);

    expect(() => saveState({ ...defaults, claimedRewardIds: Array.from({ length: 1000 }, (_, index) => `unknown-${index}`) }, cookies)).toThrow(/cookie size limit/);
  });

  it('requires deliberate reset confirmation and clears every optimizer cookie', () => {
    const catalog = catalogs();
    const cookies = memoryCookies();
    saveState(createDefaultState(catalog), cookies);
    expect(resetPersistedState(cookies, catalog, false)).toBeUndefined();
    expect(Object.keys(cookies.values)).toHaveLength(3);
    const reset = resetPersistedState(cookies, catalog, true);
    expect(reset).toEqual(createDefaultState(catalog));
    expect(cookies.values).toEqual({});
    clearPersistedState(cookies);
  });
});
