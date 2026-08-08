import type { Catalogs, GameMode } from './catalogs';
import { getCompleteLocales, resolvePreferredLocale } from './localization';
import type { OptimizationProfile } from './optimizer';
import { createDefaultState, getClassifiedDocumentMinimum, getDefaultRewardPage, type AppState } from './state';

export const COOKIE_SCHEMA_VERSION = 1;
export const MAX_COOKIE_BYTES = 3800;

export interface CookieAdapter {
  read(name: string): string | undefined;
  write(name: string, value: string, maxAgeSeconds: number): void;
  remove(name: string): void;
}

export const browserCookieAdapter: CookieAdapter = {
  read: (name) => document.cookie.split('; ').map((entry) => entry.split('=')).find(([key]) => key === name)?.[1],
  write: (name, value, maxAgeSeconds) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  },
  remove: (name) => {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  },
};

interface Envelope<T> {
  readonly gameDataVersion: string;
  readonly schemaVersion: number;
  readonly payload: T;
}

interface ProgressPayload {
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
  readonly crateCount: number;
}

interface SettingsPayload {
  readonly mode: GameMode;
  readonly locale: string;
}

interface UiPayload {
  readonly selectedPage?: number;
  readonly collapsedPages?: Readonly<Record<string, boolean>>;
  readonly selectedProfile?: OptimizationProfile;
  readonly cookieNoticeDismissed: boolean;
}

const COOKIE_NAMES = {
  progress: 'kord-breach-progress',
  settings: 'kord-breach-settings',
  ui: 'kord-breach-ui',
} as const;

export function saveState(state: AppState, cookies: CookieAdapter, catalogs: Catalogs): void {
  const gameDataVersion = catalogs.battlePass.gameDataVersion;
  writeEnvelope(cookies, COOKIE_NAMES.progress, {
    claimedRewardIds: state.claimedRewardIds,
    ownedDocuments: state.ownedDocuments,
    classifiedDocuments: state.classifiedDocuments,
    crateCount: state.crateCount,
  }, gameDataVersion);
  writeEnvelope(cookies, COOKIE_NAMES.settings, {
    mode: state.mode,
    locale: state.locale,
  }, gameDataVersion);
  writeEnvelope(cookies, COOKIE_NAMES.ui, {
    selectedPage: state.selectedPage,
    selectedProfile: state.selectedProfile,
    cookieNoticeDismissed: state.cookieNoticeDismissed,
  }, gameDataVersion);
}

export function restoreState(
  cookies: CookieAdapter,
  catalogs: Catalogs,
  preferredLocales: readonly string[] = [],
): AppState {
  const catalogDefaults = createDefaultState(catalogs);
  const defaults = {
    ...catalogDefaults,
    locale: resolvePreferredLocale(
      preferredLocales,
      getCompleteLocales(catalogs.localization),
      catalogDefaults.locale,
    ),
  };
  const gameDataVersion = catalogs.battlePass.gameDataVersion;
  const progress = readEnvelope<ProgressPayload>(cookies, COOKIE_NAMES.progress, gameDataVersion);
  const settings = readEnvelope<SettingsPayload>(cookies, COOKIE_NAMES.settings, gameDataVersion);
  const ui = readEnvelope<UiPayload>(cookies, COOKIE_NAMES.ui, gameDataVersion);
  const restored = {
    ...defaults,
    ...(progress ? sanitizeProgress(progress, defaults, catalogs) : {}),
    ...(settings ? sanitizeSettings(settings, defaults, catalogs) : {}),
    ...(ui ? sanitizeUi(ui, defaults, catalogs) : {}),
  };
  const selectedPage = catalogs.battlePass.pages
    .find((page) => page.page === restored.selectedPage)
    ?.rewards.some((reward) => !restored.claimedRewardIds.includes(reward.id))
    ? restored.selectedPage
    : getDefaultRewardPage(catalogs, restored.claimedRewardIds);
  return { ...restored, selectedPage };
}

export function resetPersistedState(cookies: CookieAdapter, catalogs: Catalogs, confirmed: boolean): AppState | undefined {
  if (!confirmed) return undefined;
  clearPersistedState(cookies);
  return createDefaultState(catalogs);
}

export function clearPersistedState(cookies: CookieAdapter): void {
  Object.values(COOKIE_NAMES).forEach((name) => cookies.remove(name));
}

function writeEnvelope<T>(cookies: CookieAdapter, name: string, payload: T, gameDataVersion: string): void {
  const value = JSON.stringify({ gameDataVersion, schemaVersion: COOKIE_SCHEMA_VERSION, payload } satisfies Envelope<T>);
  if (encodeURIComponent(value).length > MAX_COOKIE_BYTES) throw new RangeError(`${name} exceeds the cookie size limit`);
  cookies.write(name, value, 60 * 60 * 24 * 365);
}

function readEnvelope<T>(cookies: CookieAdapter, name: string, gameDataVersion: string): T | undefined {
  const raw = cookies.read(name);
  if (!raw) return undefined;
  try {
    const envelope = JSON.parse(decodeURIComponent(raw)) as Partial<Envelope<T>>;
    return envelope.gameDataVersion === gameDataVersion && envelope.schemaVersion === COOKIE_SCHEMA_VERSION ? envelope.payload : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeProgress(payload: ProgressPayload, defaults: AppState, catalogs: Catalogs): Partial<AppState> {
  const rewardIds = new Set(catalogs.battlePass.pages.flatMap((page) => page.rewards.map((reward) => reward.id)));
  const documentIds = new Set(catalogs.documents.documents.map((document) => document.id));
  const claimedRewardIds = [...new Set(Array.isArray(payload.claimedRewardIds) ? payload.claimedRewardIds.filter((id) => typeof id === 'string' && rewardIds.has(id)) : defaults.claimedRewardIds)].sort();
  const ownedDocuments = Object.fromEntries(Object.entries(payload.ownedDocuments ?? {}).filter(([id, quantity]) => documentIds.has(id) && validQuantity(quantity)));
  const classifiedDocuments = validQuantity(payload.classifiedDocuments) ? payload.classifiedDocuments : defaults.classifiedDocuments;
  return {
    claimedRewardIds,
    ownedDocuments: { ...defaults.ownedDocuments, ...ownedDocuments },
    classifiedDocuments: Math.max(getClassifiedDocumentMinimum(claimedRewardIds), classifiedDocuments),
    crateCount: validQuantity(payload.crateCount) && payload.crateCount > 0 ? payload.crateCount : defaults.crateCount,
  };
}

function sanitizeSettings(payload: SettingsPayload, defaults: AppState, catalogs: Catalogs): Partial<AppState> {
  const locales = getCompleteLocales(catalogs.localization);
  const mode = payload.mode === 'pve' || payload.mode === 'pvp' || payload.mode === 'pvp-seasonal' ? payload.mode : defaults.mode;
  return {
    mode,
    locale: locales.includes(payload.locale) ? payload.locale : defaults.locale,
  };
}

function sanitizeUi(payload: UiPayload, defaults: AppState, catalogs: Catalogs): Partial<AppState> {
  const pageIds = new Set(catalogs.battlePass.pages.map((page) => page.page));
  const legacySelectedPage = Number(Object.entries(payload.collapsedPages ?? {}).find(([page, collapsed]) => pageIds.has(Number(page)) && collapsed === false)?.[0]);
  const selectedPage = pageIds.has(payload.selectedPage ?? -1) ? payload.selectedPage! : pageIds.has(legacySelectedPage) ? legacySelectedPage : defaults.selectedPage;
  const selectedProfile = payload.selectedProfile === 'fastest' || payload.selectedProfile === 'safest' ? payload.selectedProfile : defaults.selectedProfile;
  return { selectedPage, selectedProfile, cookieNoticeDismissed: payload.cookieNoticeDismissed === true };
}

function validQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
