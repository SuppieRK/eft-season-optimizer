import type { Catalogs, GameMode } from './catalogs';
import { getCompleteLocales } from './localization';
import type { OptimizationProfile } from './optimizer';
import { planRewardRedemption } from './redeemable';

export type { GameMode } from './catalogs';

export interface AppState {
  readonly mode: GameMode;
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
  readonly crateCount: number;
  readonly locale: string;
  readonly selectedPage: number;
  readonly selectedProfile: OptimizationProfile;
  readonly cookieNoticeDismissed: boolean;
}

export type StateAction =
  | { readonly type: 'set-mode'; readonly mode: GameMode }
  | { readonly type: 'set-owned-document'; readonly documentId: string; readonly quantity: number }
  | { readonly type: 'increment-document'; readonly documentId: string }
  | { readonly type: 'decrement-document'; readonly documentId: string }
  | { readonly type: 'set-classified-documents'; readonly quantity: number }
  | { readonly type: 'set-crate-count'; readonly quantity: number }
  | { readonly type: 'set-locale'; readonly locale: string }
  | { readonly type: 'set-profile'; readonly profile: OptimizationProfile }
  | { readonly type: 'claim-reward'; readonly rewardId: string; readonly claimed: boolean }
  | { readonly type: 'redeem-reward'; readonly rewardId: string }
  | { readonly type: 'claim-page'; readonly page: number; readonly claimed: boolean }
  | { readonly type: 'claim-all'; readonly claimed: boolean }
  | { readonly type: 'set-page'; readonly page: number }
  | { readonly type: 'dismiss-cookie-notice' }
  | { readonly type: 'reset' };

const MODES: readonly GameMode[] = ['pve', 'pvp', 'pvp-seasonal'];

export function createDefaultState(catalogs: Catalogs): AppState {
  return {
    mode: 'pvp-seasonal',
    claimedRewardIds: [],
    ownedDocuments: Object.fromEntries(catalogs.documents.documents.map((document) => [document.id, 0])),
    classifiedDocuments: 1,
    crateCount: 1,
    locale: catalogs.localization.defaultLocale,
    selectedPage: getDefaultRewardPage(catalogs, []),
    selectedProfile: 'safest',
    cookieNoticeDismissed: false,
  };
}

export function reduceState(state: AppState, action: StateAction, catalogs: Catalogs): AppState {
  switch (action.type) {
    case 'set-mode':
      return MODES.includes(action.mode) ? { ...state, mode: action.mode } : state;
    case 'set-owned-document':
      return catalogs.documents.documents.some((document) => document.id === action.documentId) && validQuantity(action.quantity)
        ? { ...state, ownedDocuments: { ...state.ownedDocuments, [action.documentId]: action.quantity } }
        : state;
    case 'increment-document':
      return updateDocument(state, action.documentId, (quantity) => quantity + 1, catalogs);
    case 'decrement-document':
      return updateDocument(state, action.documentId, (quantity) => Math.max(0, quantity - 1), catalogs);
    case 'set-classified-documents':
      return validQuantity(action.quantity)
        ? { ...state, classifiedDocuments: Math.max(getClassifiedDocumentMinimum(state.claimedRewardIds), action.quantity) }
        : state;
    case 'set-crate-count':
      return validQuantity(action.quantity) && action.quantity > 0 ? { ...state, crateCount: action.quantity } : state;
    case 'set-locale':
      return getCompleteLocales(catalogs.localization).includes(action.locale) ? { ...state, locale: action.locale } : state;
    case 'set-profile':
      return action.profile === 'fastest' || action.profile === 'safest' ? { ...state, selectedProfile: action.profile } : state;
    case 'claim-reward':
      return updateClaimedRewards(state, catalogs, (rewardId, claimed) => rewardId === action.rewardId ? action.claimed : claimed);
    case 'redeem-reward':
      return redeemReward(state, action.rewardId, catalogs);
    case 'claim-page':
      return updateClaimedRewards(state, catalogs, (rewardId, claimed) => {
        const page = catalogs.battlePass.pages.find((candidate) => candidate.page === action.page);
        return page?.rewards.some((reward) => reward.id === rewardId) ? action.claimed : claimed;
      });
    case 'claim-all': {
      const nextState = updateClaimedRewards(state, catalogs, () => action.claimed);
      return action.claimed
        ? nextState
        : { ...nextState, selectedPage: getDefaultRewardPage(catalogs, nextState.claimedRewardIds) };
    }
    case 'set-page':
      return catalogs.battlePass.pages.some((page) => page.page === action.page) ? { ...state, selectedPage: action.page } : state;
    case 'dismiss-cookie-notice':
      return { ...state, cookieNoticeDismissed: true };
    case 'reset':
      return createDefaultState(catalogs);
  }
}

function updateDocument(state: AppState, documentId: string, update: (quantity: number) => number, catalogs: Catalogs): AppState {
  if (!catalogs.documents.documents.some((document) => document.id === documentId)) return state;
  return { ...state, ownedDocuments: { ...state.ownedDocuments, [documentId]: update(state.ownedDocuments[documentId] ?? 0) } };
}

function redeemReward(state: AppState, rewardId: string, catalogs: Catalogs): AppState {
  const reward = catalogs.battlePass.pages.flatMap((page) => page.rewards).find((candidate) => candidate.id === rewardId);
  if (!reward || state.claimedRewardIds.includes(rewardId)) return state;
  const plan = planRewardRedemption(reward, state.ownedDocuments, state.classifiedDocuments);
  if (!plan.canRedeem) return state;

  const ownedDocuments = { ...state.ownedDocuments };
  Object.entries(plan.regularDocuments).forEach(([documentId, quantity]) => {
    ownedDocuments[documentId] = (ownedDocuments[documentId] ?? 0) - quantity;
  });
  const inventoryState = {
    ...state,
    ownedDocuments,
    classifiedDocuments: state.classifiedDocuments - plan.classifiedDocuments,
  };
  return updateClaimedRewards(inventoryState, catalogs, (candidateId, claimed) => candidateId === rewardId || claimed);
}

function updateClaimedRewards(state: AppState, catalogs: Catalogs, update: (rewardId: string, claimed: boolean) => boolean): AppState {
  const claimed = new Set(state.claimedRewardIds);
  for (const reward of catalogs.battlePass.pages.flatMap((page) => page.rewards)) {
    const next = update(reward.id, claimed.has(reward.id));
    if (next) claimed.add(reward.id);
    else claimed.delete(reward.id);
  }
  const claimedRewardIds = [...claimed].sort();
  const selectedPage = pageHasUnclaimedReward(catalogs, state.selectedPage, claimed)
    ? state.selectedPage
    : getNextUnredeemedRewardPage(catalogs, claimedRewardIds, state.selectedPage);
  const classifiedDocuments = Math.max(getClassifiedDocumentMinimum(claimedRewardIds), state.classifiedDocuments);
  return { ...state, claimedRewardIds, classifiedDocuments, selectedPage };
}

export function getClassifiedDocumentMinimum(claimedRewardIds: readonly string[]): number {
  return claimedRewardIds.length === 0 ? 1 : 0;
}

export function getDefaultRewardPage(catalogs: Catalogs, claimedRewardIds: readonly string[]): number {
  const claimed = new Set(claimedRewardIds);
  return catalogs.battlePass.pages.find((page) => page.rewards.some((reward) => !claimed.has(reward.id)))?.page
    ?? catalogs.battlePass.pages[0]?.page
    ?? 1;
}

export function getNextUnredeemedRewardPage(
  catalogs: Catalogs,
  claimedRewardIds: readonly string[],
  currentPage: number,
): number {
  const claimed = new Set(claimedRewardIds);
  const currentIndex = catalogs.battlePass.pages.findIndex((page) => page.page === currentPage);
  if (currentIndex < 0) return getDefaultRewardPage(catalogs, claimedRewardIds);
  const pagesAfterCurrent = catalogs.battlePass.pages.slice(currentIndex + 1);
  const pagesBeforeCurrent = catalogs.battlePass.pages.slice(0, currentIndex);
  return [...pagesAfterCurrent, ...pagesBeforeCurrent]
    .find((page) => page.rewards.some((reward) => !claimed.has(reward.id)))?.page
    ?? catalogs.battlePass.pages[0]?.page
    ?? 1;
}

function pageHasUnclaimedReward(catalogs: Catalogs, pageNumber: number, claimedRewardIds: ReadonlySet<string>): boolean {
  return catalogs.battlePass.pages
    .find((page) => page.page === pageNumber)
    ?.rewards.some((reward) => !claimedRewardIds.has(reward.id)) === true;
}

function validQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 0;
}
