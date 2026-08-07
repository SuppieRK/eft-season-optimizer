import { describe, expect, it } from 'vitest';

import type { BattlePassPage, RewardRecord } from '../src/catalogs';
import { countPageRedeemableRewards, planRewardRedemption } from '../src/redeemable';

const financial = 'documents.financial.name';
const project = 'documents.project.name';
const page: BattlePassPage = {
  page: 1,
  rewards: [
    { id: 'reward.financial', kind: 'gear', requirements: [{ documentId: financial, quantity: 1 }] },
    { id: 'reward.project', kind: 'gear', requirements: [{ documentId: project, quantity: 1 }] },
    {
      id: 'reward.mixed',
      kind: 'gear',
      requirements: [
        { documentId: financial, quantity: 1 },
        { documentId: project, quantity: 1 },
      ],
    },
  ],
};

function count(overrides: Partial<Parameters<typeof countPageRedeemableRewards>[0]> = {}): number {
  return countPageRedeemableRewards({
    page,
    claimedRewardIds: [],
    ownedDocuments: {},
    classifiedDocuments: 0,
    ...overrides,
  });
}

describe('page redeemable reward count', () => {
  it('counts each reward as an independent redemption option', () => {
    expect(count({ ownedDocuments: { [financial]: 1, [project]: 1 } })).toBe(3);
    expect(count({ classifiedDocuments: 1 })).toBe(2);
    expect(count({ ownedDocuments: { [financial]: 1 }, classifiedDocuments: 1 })).toBe(3);
  });

  it('reports four Page 1 options for three Classified Documents', () => {
    const classifiedPage: BattlePassPage = {
      page: 1,
      rewards: [
        { id: 'reward.dogtag', kind: 'gear', requirements: [{ documentId: financial, quantity: 1 }] },
        { id: 'reward.tarcoins', kind: 'tarcoins', requirements: [{ documentId: project, quantity: 3 }] },
        { id: 'reward.poster', kind: 'cosmetic', requirements: [{ documentId: financial, quantity: 3 }] },
        { id: 'reward.crate', kind: 'crate', requirements: [{ documentId: project, quantity: 3 }] },
        { id: 'reward.ceiling', kind: 'cosmetic', requirements: [{ documentId: financial, quantity: 4 }] },
      ],
    };
    expect(countPageRedeemableRewards({
      page: classifiedPage,
      claimedRewardIds: [],
      ownedDocuments: {},
      classifiedDocuments: 3,
    })).toBe(4);
  });

  it('excludes claimed rewards from the count', () => {
    expect(count({
      claimedRewardIds: ['reward.financial'],
      ownedDocuments: { [financial]: 1, [project]: 1 },
    })).toBe(2);
  });
});

describe('reward redemption plan', () => {
  const reward: RewardRecord = {
    id: 'reward.plan',
    kind: 'gear',
    requirements: [
      { documentId: financial, quantity: 2 },
      { documentId: project, quantity: 2 },
    ],
  };

  it('uses matching regular documents before Classified backfill', () => {
    expect(planRewardRedemption(reward, { [financial]: 1, [project]: 2 }, 1)).toEqual({
      canRedeem: true,
      regularDocuments: { [financial]: 1, [project]: 2 },
      classifiedDocuments: 1,
      uncoveredDocuments: 0,
    });
  });

  it('reports an uncovered shortage when recorded inventory is insufficient', () => {
    expect(planRewardRedemption(reward, { [financial]: 1 }, 1)).toMatchObject({
      canRedeem: false,
      classifiedDocuments: 1,
      uncoveredDocuments: 2,
    });
  });
});
