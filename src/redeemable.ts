import type { BattlePassPage, RewardRecord } from './catalogs';

export interface RewardRedemptionPlan {
  readonly canRedeem: boolean;
  readonly regularDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
  readonly uncoveredDocuments: number;
}

export interface PageRedeemableInput {
  readonly page: BattlePassPage;
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
}

export function planRewardRedemption(
  reward: RewardRecord,
  ownedDocuments: Readonly<Record<string, number>>,
  classifiedDocuments: number,
): RewardRedemptionPlan {
  const regularDocuments: Record<string, number> = {};
  let missingDocuments = 0;

  reward.requirements.forEach(({ documentId, quantity }) => {
    const matchingQuantity = Math.min(Math.max(0, ownedDocuments[documentId] ?? 0), quantity);
    if (matchingQuantity > 0) regularDocuments[documentId] = matchingQuantity;
    missingDocuments += quantity - matchingQuantity;
  });

  const classifiedQuantity = Math.min(Math.max(0, classifiedDocuments), missingDocuments);
  const uncoveredDocuments = missingDocuments - classifiedQuantity;
  return {
    canRedeem: uncoveredDocuments === 0,
    regularDocuments,
    classifiedDocuments: classifiedQuantity,
    uncoveredDocuments,
  };
}

export function countPageRedeemableRewards(input: PageRedeemableInput): number {
  const claimed = new Set(input.claimedRewardIds);
  return input.page.rewards.filter((reward) => (
    !claimed.has(reward.id)
    && planRewardRedemption(reward, input.ownedDocuments, input.classifiedDocuments).canRedeem
  )).length;
}
