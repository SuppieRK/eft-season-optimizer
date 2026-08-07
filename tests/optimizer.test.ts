import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey, type Catalogs } from '../src/catalogs';
import { optimize } from '../src/optimizer';

const paths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function readRaw(): Record<CatalogKey, unknown> {
  return Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>;
}

function loadCatalogs(): Catalogs {
  return parseCatalogs(readRaw());
}

function allRewardIds(catalogs: Catalogs): string[] {
  return catalogs.battlePass.pages.flatMap((page) => page.rewards.map((reward) => reward.id));
}

function input(catalogs: Catalogs, overrides: Partial<Parameters<typeof optimize>[0]> = {}): Parameters<typeof optimize>[0] {
  return {
    catalogs,
    claimedRewardIds: [],
    ownedDocuments: {},
    classifiedDocuments: 0,
    tarCoins: 0,
    spendTarCoinsOnClassifiedDocuments: false,
    mode: 'pve',
    ...overrides,
  };
}

describe('optimizer', () => {
  it('uses the fixed Page-12-first complete-pass objective', () => {
    const catalogs = loadCatalogs();
    const result = optimize(input(catalogs));

    expect(result.goal).toBe('all-unclaimed-rewards');
    expect(result.unclaimedRewardIds).toHaveLength(53);
    expect(result.redemptionSequence).toHaveLength(result.unclaimedRewardIds.length);
    expect(new Set(result.redemptionSequence)).toEqual(new Set(result.unclaimedRewardIds));
    const pageByReward = new Map(catalogs.battlePass.pages.flatMap((page) => page.rewards.map((reward) => [reward.id, page.page] as const)));
    let sequenceOffset = 0;
    for (const page of catalogs.battlePass.pages.slice(0, -1)) {
      const requiredClaims = page.rewards.length - 1;
      expect(result.redemptionSequence.slice(sequenceOffset, sequenceOffset + requiredClaims)
        .every((rewardId) => pageByReward.get(rewardId) === page.page)).toBe(true);
      sequenceOffset += requiredClaims;
    }
    expect(pageByReward.get(result.redemptionSequence[sequenceOffset])).toBe(12);
    expect(Object.values(result.initialDeficits).reduce((sum, quantity) => sum + quantity, 0)).toBe(501);
    expect(result.profiles.fastest.route.available).toBe(true);
    expect(result.profiles.safest.route.available).toBe(true);
    expect(result.profiles.fastest.schedule.every((day) => day.documentQuantity <= 10)).toBe(true);
    expect(result.profiles.fastest.schedule[0].expanded).toBe(true);
    expect(result.profiles.fastest.schedule[0].rewardIdsClaimed.length).toBeGreaterThan(0);
    expect(result.profiles.fastest.schedule[0].unlockedPage).toBe(2);
    expect(result.profiles.fastest.schedule.slice(1).every((day) => !day.expanded)).toBe(true);
    expect([
      ...result.profiles.fastest.projectedImmediateRewardIds,
      ...result.profiles.fastest.schedule.flatMap((day) => day.rewardIdsClaimed),
    ].sort()).toEqual([...result.unclaimedRewardIds].sort());
  });

  it('uses the season-start Classified Document on the Page 12 rush path', () => {
    const catalogs = loadCatalogs();
    const result = optimize(input(catalogs, { classifiedDocuments: 1, mode: 'pvp-seasonal' }));

    expect(result.profiles.safest.classifiedAllocation).toEqual({ 'documents.financial.name': 1 });
    expect(result.profiles.safest.projectedImmediateRewardIds).toContain('rewards.dogtag01.name');
    expect(result.profiles.safest.nextRaid?.purpose).toBe('battle-pass');
    expect(result.profiles.safest.nextRaid?.documents.map((document) => document.role).sort()).toEqual(['optional', 'priority']);
  });

  it('looks ahead to the next farming deficit without confirming covered rewards', () => {
    const catalogs = loadCatalogs();
    const firstPageOwned = catalogs.battlePass.pages[0].rewards
      .flatMap((reward) => reward.requirements)
      .reduce<Record<string, number>>((owned, requirement) => {
        owned[requirement.documentId] = (owned[requirement.documentId] ?? 0) + requirement.quantity;
        return owned;
      }, {});
    const result = optimize(input(catalogs, { ownedDocuments: firstPageOwned }));

    expect(result.unclaimedRewardIds).toHaveLength(allRewardIds(catalogs).length);
    expect(result.profiles.safest.projectedImmediateRewardIds.length).toBeGreaterThan(0);
    expect(result.profiles.safest.nextRaid?.purpose).toBe('battle-pass');
    expect(result.profiles.safest.nextRaid?.documents.some((document) => document.role === 'priority')).toBe(true);
  });

  it('consumes matching regular documents before Classified Documents and can complete a reward with Classified Documents', () => {
    const catalogs = loadCatalogs();
    const dogtag = 'rewards.dogtag01.name';
    const allExceptDogtag = allRewardIds(catalogs).filter((id) => id !== dogtag);
    const matching = optimize(input(catalogs, {
      claimedRewardIds: allExceptDogtag,
      ownedDocuments: { 'documents.financial.name': 1 },
      classifiedDocuments: 1,
    }));
    expect(matching.classifiedConsumed).toBe(0);
    expect(matching.classifiedRemaining).toBe(1);
    expect(matching.profiles.fastest.route.rawDocumentQuantity).toBe(0);

    const classified = optimize(input(catalogs, {
      claimedRewardIds: allExceptDogtag,
      classifiedDocuments: 1,
    }));
    expect(classified.classifiedConsumed).toBe(1);
    expect(classified.classifiedRemaining).toBe(0);
    expect(classified.profiles.fastest.route.rawDocumentQuantity).toBe(0);
  });

  it('allows mixed and duplicate regular donors while protecting matching inventory', () => {
    const catalogs = loadCatalogs();
    const dogtag = 'rewards.dogtag01.name';
    const allExceptDogtag = allRewardIds(catalogs).filter((id) => id !== dogtag);
    const exchanged = optimize(input(catalogs, {
      claimedRewardIds: allExceptDogtag,
      ownedDocuments: { 'documents.project.name': 5 },
    }));
    expect(exchanged.profiles.fastest.exchanges).toEqual([{
      receivedDocumentId: 'documents.financial.name',
      donors: { 'documents.project.name': 5 },
    }]);
    expect(exchanged.profiles.fastest.route.rawDocumentQuantity).toBe(0);

    const protectedMatching = optimize(input(catalogs, {
      claimedRewardIds: allExceptDogtag,
      ownedDocuments: { 'documents.financial.name': 2 },
    }));
    expect(protectedMatching.profiles.fastest.exchanges).toEqual([]);
  });

  it('allocates owned Classified Documents per profile and leaves route factors mode-invariant', () => {
    const catalogs = loadCatalogs();
    const rewardId = 'rewards.genetex-respirator.name';
    const claimed = allRewardIds(catalogs).filter((id) => id !== rewardId);
    const pve = optimize(input(catalogs, { claimedRewardIds: claimed, classifiedDocuments: 1, mode: 'pve' }));
    const seasonal = optimize(input(catalogs, { claimedRewardIds: claimed, classifiedDocuments: 1, mode: 'pvp-seasonal' }));

    expect(pve.effectiveDailyLimit).toBe(10);
    expect(seasonal.effectiveDailyLimit).toBe(25);
    expect(pve.profiles.fastest.route.profileCost).toBe(seasonal.profiles.fastest.route.profileCost);
    expect(pve.profiles.safest.route.profileCost).toBe(seasonal.profiles.safest.route.profileCost);
    expect(pve.profiles.fastest.route.locations.map((location) => location.locationId)).toContain('locations.lab.name');
    expect(pve.profiles.safest.route.locations.map((location) => location.locationId)).toContain('locations.groundZero.name');
    expect(pve.profiles.fastest.classifiedConsumed).toBe(1);
    expect(pve.profiles.safest.classifiedConsumed).toBe(1);
  });

  it('combines coincident routes and exposes the selected location factors', () => {
    const catalogs = loadCatalogs();
    const dogtag = 'rewards.dogtag01.name';
    const result = optimize(input(catalogs, { claimedRewardIds: allRewardIds(catalogs).filter((id) => id !== dogtag) }));
    const fastestLocation = result.profiles.fastest.route.locations[0];

    expect(result.profilesCoincide).toBe(true);
    expect(fastestLocation.locationId).toBe('locations.customs.name');
    expect(fastestLocation.difficultyId).toBe('difficulty.hard');
    expect(fastestLocation.difficultyRating).toBe(3);
    expect(fastestLocation.maxRaidTimeMin).toBe(25);
  });

  it('returns an unavailable profile instead of a partial assignment', () => {
    const catalogs = structuredClone(loadCatalogs()) as Catalogs;
    const financial = catalogs.documents.documents.find((document) => document.id === 'documents.financial.name') as { sourceLocationIds: string[] };
    financial.sourceLocationIds = [];
    const dogtag = 'rewards.dogtag01.name';
    const result = optimize(input(catalogs, { claimedRewardIds: allRewardIds(catalogs).filter((id) => id !== dogtag) }));

    expect(result.profiles.fastest.route.available).toBe(false);
    expect(result.profiles.fastest.route.locations).toEqual([]);
    expect(result.profiles.fastest.warnings.length).toBeGreaterThan(0);
    expect(result.profiles.fastest.nextRaid).toBeUndefined();
  });

  it('keeps the informational buyout independent and credits TarCoins only after redemption', () => {
    const raw = readRaw();
    const battlePass = structuredClone(raw.battlePass) as Record<string, unknown>;
    battlePass.pages = [{
      page: 1,
      rewards: [
        { id: 'rewards.tarcoins50-01.name', kind: 'tarcoins', tarCoinsAwarded: 50, requirements: [] },
        { id: 'rewards.burn-poster.name', kind: 'cosmetic', requirements: [{ documentId: 'documents.test.name', quantity: 1 }] },
      ],
    }];
    const catalogs = parseCatalogs({ ...raw, battlePass });
    const staged = optimize(input(catalogs));
    const disabled = optimize(input(catalogs, { tarCoins: 500 }));
    const enabled = optimize(input(catalogs, { spendTarCoinsOnClassifiedDocuments: true, tarCoins: 500 }));

    expect(staged.buyout.minimumAdditionalTarCoins).toBe(450);
    expect(staged.buyout.earnedTarCoinsAwarded).toBe(50);
    expect(staged.buyout.earnedTarCoinsUsed).toBe(50);
    expect(staged.buyout.localEstimate?.packageCounts[0]).toBe(1);
    expect(staged.buyout.localEstimate?.currency).toBe('USD');
    expect(disabled.profiles.fastest.purchases.classifiedDocumentsPurchased).toBe(0);
    expect(enabled.profiles.fastest.purchases.classifiedDocumentsPurchased).toBeGreaterThan(0);
    expect(enabled.buyout).toEqual(disabled.buyout);
  });

  it('does not fund a purchase with TarCoins from an uncovered reward', () => {
    const raw = readRaw();
    const battlePass = structuredClone(raw.battlePass) as Record<string, unknown>;
    battlePass.pages = [
      {
        page: 1,
        rewards: [
          {
            id: 'rewards.tarcoins50-01.name',
            kind: 'tarcoins',
            tarCoinsAwarded: 500,
            requirements: [{ documentId: 'documents.test.name', quantity: 100 }],
          },
          {
            id: 'rewards.burn-poster.name',
            kind: 'cosmetic',
            requirements: [{ documentId: 'documents.test.name', quantity: 200 }],
          },
        ],
      },
      {
        page: 2,
        rewards: [
          {
            id: 'rewards.dogtag01.name',
            kind: 'cosmetic',
            requirements: [{ documentId: 'documents.financial.name', quantity: 1 }],
          },
        ],
      },
    ];
    const catalogs = parseCatalogs({ ...raw, battlePass });
    const result = optimize(input(catalogs, { spendTarCoinsOnClassifiedDocuments: true }));

    expect(result.profiles.fastest.redemptionSequence[0]).toBe('rewards.tarcoins50-01.name');
    expect(result.profiles.fastest.purchases.classifiedDocumentsPurchased).toBe(0);
    expect(result.profiles.fastest.purchases.earnedTarCoinsUsed).toBe(0);
  });

  it('does not consume Classified Documents when there is no redeemable reward', () => {
    const catalogs = loadCatalogs();
    const result = optimize(input(catalogs, {
      claimedRewardIds: allRewardIds(catalogs),
      classifiedDocuments: 7,
    }));

    expect(result.unclaimedRewardIds).toEqual([]);
    expect(result.classifiedConsumed).toBe(0);
    expect(result.classifiedRemaining).toBe(7);
    expect(result.buyout.minimumAdditionalTarCoins).toBe(0);
  });

  it('changes only schedule limits for the global mode', () => {
    const catalogs = loadCatalogs();
    const pve = optimize(input(catalogs, { mode: 'pve' }));
    const pvp = optimize(input(catalogs, { mode: 'pvp' }));
    const seasonal = optimize(input(catalogs, { mode: 'pvp-seasonal' }));

    expect(pve.effectiveDailyLimit).toBe(10);
    expect(pvp.effectiveDailyLimit).toBe(15);
    expect(seasonal.effectiveDailyLimit).toBe(25);
    expect(pve.profiles.fastest.route.locations).toEqual(pvp.profiles.fastest.route.locations);
    expect(pve.profiles.fastest.schedule.length).toBeGreaterThan(pvp.profiles.fastest.schedule.length);
    expect(pvp.profiles.fastest.schedule.length).toBeGreaterThan(seasonal.profiles.fastest.schedule.length);
  });

  it('switches to regular-document Black Division crate planning after the pass', () => {
    const catalogs = loadCatalogs();
    const claimed = allRewardIds(catalogs);
    const result = optimize(input(catalogs, { claimedRewardIds: claimed, classifiedDocuments: 7 }));

    expect(result.goal).toBe('black-division-crates');
    expect(result.cratePlan).toEqual({
      crateCount: 1,
      regularDocumentsRequired: 10,
      regularDocumentsOwned: 0,
      regularDocumentsToFarm: 10,
      farmingLocationId: 'locations.factory.name',
    });
    expect(result.classifiedRemaining).toBe(7);
    expect(result.profiles.fastest.purchases.classifiedDocumentsPurchased).toBe(0);
    expect(result.profiles.fastest.route.locations[0].locationId).toBe('locations.factory.name');

    const immediate = optimize(input(catalogs, { claimedRewardIds: claimed, ownedDocuments: { 'documents.project.name': 20 }, crateCount: 2 }));
    expect(immediate.cratePlan?.regularDocumentsToFarm).toBe(0);
    expect(immediate.profiles.fastest.route.locations).toEqual([]);
    expect(immediate.profiles.fastest.nextRaid?.purpose).toBe('crate-stockpile');
    expect(immediate.profiles.fastest.nextRaid?.locationId).toBe('locations.factory.name');
    expect(immediate.profiles.fastest.nextRaid?.documents.every((document) => document.role === 'stockpile')).toBe(true);
  });

  it('keeps the reward goal and recommends profile-specific stockpile raids when the remaining pass is covered', () => {
    const catalogs = loadCatalogs();
    const ownedDocuments = Object.fromEntries(catalogs.documents.documents
      .filter((document) => document.kind === 'regular')
      .map((document) => [document.id, 999]));
    const result = optimize(input(catalogs, { ownedDocuments }));

    expect(result.goal).toBe('all-unclaimed-rewards');
    expect(result.profiles.fastest.route.rawDocumentQuantity).toBe(0);
    expect(result.profiles.fastest.nextRaid).toMatchObject({
      purpose: 'crate-stockpile',
      locationId: 'locations.factory.name',
    });
    expect(result.profiles.safest.nextRaid?.purpose).toBe('crate-stockpile');
    expect(result.profiles.safest.nextRaid?.documents.every((document) => document.role === 'stockpile')).toBe(true);
  });

  it('selects optional stockpile locations by the active profile with deterministic secondary factors', () => {
    const catalogs = structuredClone(loadCatalogs()) as Catalogs;
    const factory = catalogs.locations.locations.find((location) => location.id === 'locations.factory.name') as {
      maxRaidTimeMin: number;
      difficultyRating: number;
    };
    const customs = catalogs.locations.locations.find((location) => location.id === 'locations.customs.name') as {
      maxRaidTimeMin: number;
      difficultyRating: number;
    };
    factory.maxRaidTimeMin = 10;
    factory.difficultyRating = 4;
    customs.maxRaidTimeMin = 20;
    customs.difficultyRating = 1;
    const ownedDocuments = Object.fromEntries(catalogs.documents.documents
      .filter((document) => document.kind === 'regular')
      .map((document) => [document.id, 999]));
    const result = optimize(input(catalogs, { ownedDocuments }));

    expect(result.profiles.fastest.nextRaid?.locationId).toBe('locations.factory.name');
    expect(result.profiles.safest.nextRaid?.locationId).toBe('locations.customs.name');
    expect(result.profilesCoincide).toBe(false);
  });
});
