import type { BattlePassPage } from './catalogs.ts';

export function countUnlockedPages(
  pages: readonly BattlePassPage[],
  claimedRewardIds: ReadonlySet<string>,
): number {
  let unlocked = Math.min(1, pages.length);
  while (unlocked < pages.length) {
    const previousPage = pages[unlocked - 1];
    const requiredClaims = Math.max(0, previousPage.rewards.length - 1);
    const claimedOnPreviousPage = previousPage.rewards
      .filter((reward) => claimedRewardIds.has(reward.id)).length;
    if (claimedOnPreviousPage < requiredClaims) break;
    unlocked += 1;
  }
  return unlocked;
}

export function isBattlePassPageUnlocked(
  pages: readonly BattlePassPage[],
  pageNumber: number,
  claimedRewardIds: ReadonlySet<string>,
): boolean {
  const pageIndex = pages.findIndex((page) => page.page === pageNumber);
  return pageIndex >= 0 && pageIndex < countUnlockedPages(pages, claimedRewardIds);
}
