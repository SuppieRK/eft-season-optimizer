import type { Catalogs, GameMode } from './catalogs';
import { getCompleteLocales } from './localization';
import type { OptimizationProfile } from './optimizer';

export type { GameMode } from './catalogs';

export interface AppState {
  readonly mode: GameMode;
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
  readonly tarCoins: number;
  readonly spendTarCoinsOnClassifiedDocuments: boolean;
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
  | { readonly type: 'set-tar-coins'; readonly quantity: number }
  | { readonly type: 'set-spending'; readonly enabled: boolean }
  | { readonly type: 'set-crate-count'; readonly quantity: number }
  | { readonly type: 'set-locale'; readonly locale: string }
  | { readonly type: 'set-profile'; readonly profile: OptimizationProfile }
  | { readonly type: 'claim-reward'; readonly rewardId: string; readonly claimed: boolean }
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
    classifiedDocuments: 0,
    tarCoins: 0,
    spendTarCoinsOnClassifiedDocuments: false,
    crateCount: 1,
    locale: catalogs.localization.defaultLocale,
    selectedPage: catalogs.battlePass.pages[0]?.page ?? 1,
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
      return validQuantity(action.quantity) ? { ...state, classifiedDocuments: action.quantity } : state;
    case 'set-tar-coins':
      return validQuantity(action.quantity) ? { ...state, tarCoins: action.quantity } : state;
    case 'set-spending':
      return { ...state, spendTarCoinsOnClassifiedDocuments: action.enabled };
    case 'set-crate-count':
      return validQuantity(action.quantity) && action.quantity > 0 ? { ...state, crateCount: action.quantity } : state;
    case 'set-locale':
      return getCompleteLocales(catalogs.localization).includes(action.locale) ? { ...state, locale: action.locale } : state;
    case 'set-profile':
      return action.profile === 'fastest' || action.profile === 'safest' ? { ...state, selectedProfile: action.profile } : state;
    case 'claim-reward':
      return updateClaimedRewards(state, catalogs, (rewardId, claimed) => rewardId === action.rewardId ? action.claimed : claimed);
    case 'claim-page':
      return updateClaimedRewards(state, catalogs, (rewardId, claimed) => {
        const page = catalogs.battlePass.pages.find((candidate) => candidate.page === action.page);
        return page?.rewards.some((reward) => reward.id === rewardId) ? action.claimed : claimed;
      });
    case 'claim-all':
      return updateClaimedRewards(state, catalogs, () => action.claimed);
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

function updateClaimedRewards(state: AppState, catalogs: Catalogs, update: (rewardId: string, claimed: boolean) => boolean): AppState {
  const claimed = new Set(state.claimedRewardIds);
  for (const reward of catalogs.battlePass.pages.flatMap((page) => page.rewards)) {
    const next = update(reward.id, claimed.has(reward.id));
    if (next) claimed.add(reward.id);
    else claimed.delete(reward.id);
  }
  return { ...state, claimedRewardIds: [...claimed].sort() };
}

function validQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 0;
}
