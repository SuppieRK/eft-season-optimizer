import { describe, expect, it } from 'vitest';

import type { BattlePassPage, RewardRecord } from '../src/catalogs';
import { countUnlockedPages, isBattlePassPageUnlocked } from '../src/page-unlocks';

function reward(id: string): RewardRecord {
  return { id, kind: 'cosmetic', requirements: [] };
}

const pages: readonly BattlePassPage[] = [
  { page: 1, rewards: [reward('1a'), reward('1b'), reward('1c')] },
  { page: 2, rewards: [reward('2a'), reward('2b')] },
  { page: 3, rewards: [reward('3a'), reward('3b'), reward('3c')] },
];

describe('Battle Pass page unlocks', () => {
  it('requires one fewer claim than the reward count on each previous page', () => {
    expect(countUnlockedPages(pages, new Set())).toBe(1);
    expect(countUnlockedPages(pages, new Set(['1a']))).toBe(1);
    expect(countUnlockedPages(pages, new Set(['1a', '1b']))).toBe(2);
    expect(countUnlockedPages(pages, new Set(['1a', '1b', '2a']))).toBe(3);
  });

  it('does not let claims on a later locked page bypass the frontier', () => {
    const claimed = new Set(['2a', '2b']);

    expect(isBattlePassPageUnlocked(pages, 1, claimed)).toBe(true);
    expect(isBattlePassPageUnlocked(pages, 2, claimed)).toBe(false);
    expect(isBattlePassPageUnlocked(pages, 3, claimed)).toBe(false);
  });
});
