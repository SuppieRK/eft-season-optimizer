export type CatalogKey =
  | 'documents'
  | 'locations'
  | 'battlePass'
  | 'optimizerRules'
  | 'localization';

export const GAME_DATA_VERSION = '1.1.0.0.46657.8.6.2026';
export const SEASON_ENDS_AT = 1_796_637_600;

export type DocumentKind = 'regular' | 'classified';
export type RewardKind = 'cosmetic' | 'gear' | 'crate' | 'tarcoins';
export type GameMode = 'pve' | 'pvp' | 'pvp-seasonal';
export type DifficultyId =
  | 'difficulty.easy'
  | 'difficulty.normal'
  | 'difficulty.hard'
  | 'difficulty.insane';

export interface LocalizationEntry {
  readonly id: string;
  readonly localizations: Readonly<Record<string, string>>;
}

export interface LocalPrice {
  readonly price: number;
  readonly currency: string;
}

export interface PriceEntry {
  readonly id: string;
  readonly localizations: Readonly<Record<string, LocalPrice>>;
}

export interface LocalizationCatalog {
  readonly schemaVersion: number;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly releaseStatus: string;
  readonly entries: readonly LocalizationEntry[];
  readonly priceEntries: readonly PriceEntry[];
}

export interface DocumentRecord {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly descriptionId: string;
  readonly imageAltId: string;
  readonly imagePath: string;
  readonly sourceLocationIds: readonly string[];
  readonly sourceDescriptionId?: string;
  readonly redemptionRule?: string;
}

export interface DocumentsCatalog {
  readonly schemaVersion: number;
  readonly documents: readonly DocumentRecord[];
}

export interface LocationRecord {
  readonly id: string;
  readonly difficultyId: DifficultyId;
  readonly maxRaidTimeMin: number;
  readonly difficultyRating: number;
}

export interface LocationsCatalog {
  readonly schemaVersion: number;
  readonly difficultyRatingScale: { readonly min: number; readonly max: number };
  readonly locations: readonly LocationRecord[];
}

export interface Requirement {
  readonly documentId: string;
  readonly quantity: number;
}

export interface RewardRecord {
  readonly id: string;
  readonly kind: RewardKind;
  readonly requirements: readonly Requirement[];
  readonly tarCoinsAwarded?: number;
}

export interface BattlePassPage {
  readonly page: number;
  readonly rewards: readonly RewardRecord[];
}

export interface BattlePassCatalog {
  readonly schemaVersion: number;
  readonly gameDataVersion: string;
  readonly id: string;
  readonly endsAt: number;
  readonly pages: readonly BattlePassPage[];
}

export interface ClassifiedBundle {
  readonly classifiedDocuments: number;
  readonly tarCoins: number;
  readonly bonusTarCoins: number;
}

export interface TarCoinBundle {
  readonly tarCoins: number;
  readonly bonusTarCoins: number;
  readonly localPriceId: string;
}

export interface OptimizerRulesCatalog {
  readonly schemaVersion: number;
  readonly dailyDocumentLimits: Readonly<Record<GameMode, number>>;
  readonly exchange: {
    readonly regularDocumentsPerBlackDivisionGearCrate: number;
    readonly regularDocumentsPerOtherDocuments: number;
  };
  readonly tarCoinBundles: readonly TarCoinBundle[];
  readonly classifiedDocuments: {
    readonly backfillOnly: true;
    readonly purchaseSource: string;
    readonly bundles: readonly ClassifiedBundle[];
    readonly purchasePolicy: string;
  };
  readonly routeProfiles: {
    readonly fastest: { readonly factorField: 'maxRaidTimeMin'; readonly tieBreakOrder: readonly string[] };
    readonly safest: { readonly factorField: 'difficultyRating'; readonly tieBreakOrder: readonly string[] };
    readonly combinedDisplayRule: string;
    readonly unavailableRule: string;
    readonly classifiedAllocationRule: string;
    readonly regularExchangeRule: string;
    readonly blackDivisionCrateFallback: string;
  };
  readonly dailySchedule: {
    readonly enabled: boolean;
    readonly scheduleOrder: string;
    readonly futureDaysCollapsedByDefault: boolean;
    readonly showOverflowAsNextDay: boolean;
  };
}

export interface Catalogs {
  readonly documents: DocumentsCatalog;
  readonly locations: LocationsCatalog;
  readonly battlePass: BattlePassCatalog;
  readonly optimizerRules: OptimizerRulesCatalog;
  readonly localization: LocalizationCatalog;
}

type JsonObject = Record<string, unknown>;

export class CatalogValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Catalog validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'CatalogValidationError';
    this.issues = issues;
  }
}

function asObject(value: unknown, label: string, issues: string[]): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push(`${label} must be an object`);
    return {};
  }
  return value as JsonObject;
}

function asArray(value: unknown, label: string, issues: string[]): readonly unknown[] {
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array`);
    return [];
  }
  return value;
}

function asString(value: unknown, label: string, issues: string[]): string {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${label} must be a non-empty string`);
    return '';
  }
  return value;
}

function asInteger(value: unknown, label: string, issues: string[], minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    issues.push(`${label} must be an integer >= ${minimum}`);
    return minimum;
  }
  return value;
}

function asNumber(value: unknown, label: string, issues: string[], minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    issues.push(`${label} must be a finite number >= ${minimum}`);
    return minimum;
  }
  return value;
}

function asCurrencyCode(value: unknown, label: string, issues: string[]): string {
  const currency = asString(value, label, issues);
  if (currency && !/^[A-Z]{3}$/u.test(currency)) issues.push(`${label} must be a three-letter uppercase ISO currency code`);
  return currency;
}

function asBoolean(value: unknown, label: string, issues: string[]): boolean {
  if (typeof value !== 'boolean') {
    issues.push(`${label} must be a boolean`);
    return false;
  }
  return value;
}

function asStringMap(value: unknown, label: string, issues: string[]): Record<string, string> {
  const object = asObject(value, label, issues);
  const result: Record<string, string> = {};
  for (const [locale, localizedValue] of Object.entries(object)) {
    result[locale] = asString(localizedValue, `${label}.${locale}`, issues);
  }
  return result;
}

function requireId(value: unknown, label: string, issues: string[]): string {
  return asString(value, label, issues);
}

function requireUnique(ids: readonly string[], label: string, issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`${label} contains duplicate id ${id}`);
    seen.add(id);
  }
}

function requireTextId(id: string, textIds: ReadonlySet<string>, label: string, issues: string[]): void {
  if (!textIds.has(id)) issues.push(`${label} references unknown localization id ${id}`);
}

function parseLocalization(raw: unknown, issues: string[]): LocalizationCatalog {
  const object = asObject(raw, 'localization', issues);
  const supportedLocales = asArray(object.supportedLocales, 'localization.supportedLocales', issues).map((value, index) =>
    asString(value, `localization.supportedLocales[${index}]`, issues),
  );
  requireUnique(supportedLocales, 'localization.supportedLocales', issues);
  for (const [index, locale] of supportedLocales.entries()) {
    try {
      if (!new Intl.Locale(locale).region) {
        issues.push(`localization.supportedLocales[${index}] must include a region for its flag`);
      }
    } catch {
      issues.push(`localization.supportedLocales[${index}] must be a valid BCP 47 locale`);
    }
  }
  const defaultLocale = asString(object.defaultLocale, 'localization.defaultLocale', issues);
  if (!supportedLocales.includes(defaultLocale)) issues.push(`localization.defaultLocale ${defaultLocale} is not supported`);

  const entries = asArray(object.entries, 'localization.entries', issues).map((value, index) => {
    const entry = asObject(value, `localization.entries[${index}]`, issues);
    return {
      id: requireId(entry.id, `localization.entries[${index}].id`, issues),
      localizations: asStringMap(entry.localizations, `localization.entries[${index}].localizations`, issues),
    };
  });
  const priceEntries = asArray(object.priceEntries, 'localization.priceEntries', issues).map((value, index) => {
    const entry = asObject(value, `localization.priceEntries[${index}]`, issues);
    const localizations = asObject(entry.localizations, `localization.priceEntries[${index}].localizations`, issues);
    const prices: Record<string, LocalPrice> = {};
    for (const [locale, valueForLocale] of Object.entries(localizations)) {
      const price = asObject(valueForLocale, `localization.priceEntries[${index}].localizations.${locale}`, issues);
      prices[locale] = {
        price: asNumber(price.price, `localization.priceEntries[${index}].${locale}.price`, issues),
        currency: asCurrencyCode(price.currency, `localization.priceEntries[${index}].${locale}.currency`, issues),
      };
    }
    return { id: requireId(entry.id, `localization.priceEntries[${index}].id`, issues), localizations: prices };
  });
  const textIds = entries.map((entry) => entry.id);
  const priceIds = priceEntries.map((entry) => entry.id);
  requireUnique(textIds, 'localization.entries', issues);
  requireUnique(priceIds, 'localization.priceEntries', issues);
  requireUnique([...textIds, ...priceIds], 'localization collections', issues);

  for (const entry of entries) {
    for (const locale of Object.keys(entry.localizations)) {
      if (!supportedLocales.includes(locale)) issues.push(`${entry.id} uses undeclared locale ${locale}`);
    }
    if (!entry.localizations[defaultLocale]) issues.push(`${entry.id} is missing default locale ${defaultLocale}`);
  }
  for (const entry of priceEntries) {
    for (const locale of Object.keys(entry.localizations)) {
      if (!supportedLocales.includes(locale)) issues.push(`${entry.id} uses undeclared locale ${locale}`);
    }
    if (!entry.localizations[defaultLocale]) issues.push(`${entry.id} is missing default locale ${defaultLocale}`);
  }

  return {
    schemaVersion: asInteger(object.schemaVersion, 'localization.schemaVersion', issues, 1),
    defaultLocale,
    supportedLocales,
    releaseStatus: asString(object.releaseStatus, 'localization.releaseStatus', issues),
    entries,
    priceEntries,
  };
}

function parseLocations(raw: unknown, localization: LocalizationCatalog, issues: string[]): LocationsCatalog {
  const object = asObject(raw, 'locations', issues);
  const scale = asObject(object.difficultyRatingScale, 'locations.difficultyRatingScale', issues);
  const min = asInteger(scale.min, 'locations.difficultyRatingScale.min', issues, 1);
  const max = asInteger(scale.max, 'locations.difficultyRatingScale.max', issues, min);
  const expectedRatings: Record<DifficultyId, number> = {
    'difficulty.easy': 1,
    'difficulty.normal': 2,
    'difficulty.hard': 3,
    'difficulty.insane': 4,
  };
  const locations = asArray(object.locations, 'locations.locations', issues).map((value, index) => {
    const location = asObject(value, `locations.locations[${index}]`, issues);
    const id = requireId(location.id, `locations.locations[${index}].id`, issues);
    if (!id.endsWith('.name')) issues.push(`${id} must be the canonical name localization id`);
    requireTextId(id, new Set(localization.entries.map((entry) => entry.id)), `locations.locations[${index}].id`, issues);
    const difficultyId = asString(location.difficultyId, `locations.locations[${index}].difficultyId`, issues) as DifficultyId;
    if (!(difficultyId in expectedRatings)) issues.push(`${id} has unknown difficulty id ${difficultyId}`);
    const difficultyRating = asInteger(location.difficultyRating, `${id}.difficultyRating`, issues, 1);
    if (expectedRatings[difficultyId] !== difficultyRating) issues.push(`${id} difficulty rating does not match ${difficultyId}`);
    if (difficultyRating < min || difficultyRating > max) issues.push(`${id} difficulty rating is outside the declared scale`);
    return {
      id,
      difficultyId,
      maxRaidTimeMin: asInteger(location.maxRaidTimeMin, `${id}.maxRaidTimeMin`, issues, 1),
      difficultyRating,
    };
  });
  requireUnique(locations.map((location) => location.id), 'locations.locations', issues);
  return { schemaVersion: asInteger(object.schemaVersion, 'locations.schemaVersion', issues, 1), difficultyRatingScale: { min, max }, locations };
}

function parseDocuments(raw: unknown, locations: LocationsCatalog, localization: LocalizationCatalog, issues: string[]): DocumentsCatalog {
  const object = asObject(raw, 'documents', issues);
  const locationIds = new Set(locations.locations.map((location) => location.id));
  const textIds = new Set(localization.entries.map((entry) => entry.id));
  const documents = asArray(object.documents, 'documents.documents', issues).map((value, index) => {
    const document = asObject(value, `documents.documents[${index}]`, issues);
    for (const redundantField of ['nameId', 'farmable', 'exchangeEligible', 'classifiedBackfillEligible']) {
      if (redundantField in document) issues.push(`${document.id ?? `documents.documents[${index}]`} contains redundant field ${redundantField}`);
    }
    const id = requireId(document.id, `documents.documents[${index}].id`, issues);
    if (!id.endsWith('.name')) issues.push(`${id} must be the canonical name localization id`);
    requireTextId(id, textIds, `documents.documents[${index}].id`, issues);
    const kind = asString(document.kind, `${id}.kind`, issues) as DocumentKind;
    if (kind !== 'regular' && kind !== 'classified') issues.push(`${id} has unknown document kind ${kind}`);
    const sourceLocationIds = asArray(document.sourceLocationIds, `${id}.sourceLocationIds`, issues).map((locationId, sourceIndex) => {
      const sourceId = asString(locationId, `${id}.sourceLocationIds[${sourceIndex}]`, issues);
      if (!locationIds.has(sourceId)) issues.push(`${id} references unknown source location ${sourceId}`);
      return sourceId;
    });
    if (kind === 'regular' && sourceLocationIds.length === 0) issues.push(`${id} must have a farming source location`);
    if (kind === 'classified' && sourceLocationIds.length > 0) issues.push(`${id} cannot have farming source locations`);
    const descriptionId = asString(document.descriptionId, `${id}.descriptionId`, issues);
    const imageAltId = asString(document.imageAltId, `${id}.imageAltId`, issues);
    requireTextId(descriptionId, textIds, `${id}.descriptionId`, issues);
    requireTextId(imageAltId, textIds, `${id}.imageAltId`, issues);
    const sourceDescriptionId = document.sourceDescriptionId === undefined ? undefined : asString(document.sourceDescriptionId, `${id}.sourceDescriptionId`, issues);
    if (sourceDescriptionId) requireTextId(sourceDescriptionId, textIds, `${id}.sourceDescriptionId`, issues);
    if (kind === 'classified' && !sourceDescriptionId) issues.push(`${id} must have sourceDescriptionId`);
    return {
      id,
      kind,
      descriptionId,
      imageAltId,
      imagePath: asString(document.imagePath, `${id}.imagePath`, issues),
      sourceLocationIds,
      ...(sourceDescriptionId ? { sourceDescriptionId } : {}),
      ...(document.redemptionRule === undefined ? {} : { redemptionRule: asString(document.redemptionRule, `${id}.redemptionRule`, issues) }),
    };
  });
  requireUnique(documents.map((document) => document.id), 'documents.documents', issues);
  return { schemaVersion: asInteger(object.schemaVersion, 'documents.schemaVersion', issues, 1), documents };
}

function parseBattlePass(raw: unknown, documents: DocumentsCatalog, localization: LocalizationCatalog, issues: string[]): BattlePassCatalog {
  const object = asObject(raw, 'battlePass', issues);
  const textIds = new Set(localization.entries.map((entry) => entry.id));
  const documentIds = new Set(documents.documents.map((document) => document.id));
  const pages = asArray(object.pages, 'battlePass.pages', issues).map((value, pageIndex) => {
    const page = asObject(value, `battlePass.pages[${pageIndex}]`, issues);
    const pageNumber = asInteger(page.page, `battlePass.pages[${pageIndex}].page`, issues, 1);
    const rewards = asArray(page.rewards, `battlePass.pages[${pageIndex}].rewards`, issues).map((rewardValue, rewardIndex) => {
      const reward = asObject(rewardValue, `battlePass.pages[${pageNumber}].rewards[${rewardIndex}]`, issues);
      const id = requireId(reward.id, `battlePass.pages[${pageNumber}].rewards[${rewardIndex}].id`, issues);
      if (!id.endsWith('.name')) issues.push(`${id} must be the canonical name localization id`);
      requireTextId(id, textIds, `battlePass reward ${id}`, issues);
      const kind = asString(reward.kind, `${id}.kind`, issues) as RewardKind;
      if (!['cosmetic', 'gear', 'crate', 'tarcoins'].includes(kind)) issues.push(`${id} has unknown reward kind ${kind}`);
      const requirements = asArray(reward.requirements, `${id}.requirements`, issues).map((requirementValue, requirementIndex) => {
        const requirement = asObject(requirementValue, `${id}.requirements[${requirementIndex}]`, issues);
        const documentId = asString(requirement.documentId, `${id}.requirements[${requirementIndex}].documentId`, issues);
        if (!documentIds.has(documentId)) issues.push(`${id} references unknown document ${documentId}`);
        const document = documents.documents.find((candidate) => candidate.id === documentId);
        if (document?.kind !== 'regular') issues.push(`${id} requirement ${documentId} must reference a regular document`);
        return { documentId, quantity: asInteger(requirement.quantity, `${id}.${documentId}.quantity`, issues, 1) };
      });
      const tarCoinsAwarded = reward.tarCoinsAwarded === undefined ? undefined : asInteger(reward.tarCoinsAwarded, `${id}.tarCoinsAwarded`, issues);
      if (kind === 'tarcoins' && (!tarCoinsAwarded || tarCoinsAwarded <= 0)) issues.push(`${id} must award TarCoins`);
      if (kind !== 'tarcoins' && tarCoinsAwarded !== undefined) issues.push(`${id} has TarCoins but is not a TarCoins reward`);
      return { id, kind, requirements, ...(tarCoinsAwarded === undefined ? {} : { tarCoinsAwarded }) };
    });
    requireUnique(rewards.map((reward) => reward.id), `battlePass.pages[${pageNumber}].rewards`, issues);
    return { page: pageNumber, rewards };
  });
  const pageNumbers = pages.map((page) => page.page);
  requireUnique(pageNumbers.map(String), 'battlePass.pages', issues);
  if (pageNumbers[0] !== 1) issues.push('battlePass.pages must start at page 1');
  for (let index = 1; index < pageNumbers.length; index += 1) {
    if (pageNumbers[index] !== pageNumbers[index - 1] + 1) issues.push('battlePass.pages must be contiguous and ordered');
    const expectedUnlockCount = pages[index - 1].rewards.length - 1;
    if (expectedUnlockCount < 0) issues.push(`battlePass page ${pageNumbers[index - 1]} cannot unlock a later page`);
  }
  requireUnique(pages.flatMap((page) => page.rewards.map((reward) => reward.id)), 'battlePass rewards', issues);
  if ('requiresPreviousPage' in object) issues.push('battlePass must derive page unlocks and cannot store requiresPreviousPage');
  if ('season' in object) issues.push('battlePass must keep season metadata at the top level');
  if ('seasonEndsAtUnixSeconds' in object) issues.push('battlePass must use endsAt');
  return {
    schemaVersion: asInteger(object.schemaVersion, 'battlePass.schemaVersion', issues, 1),
    gameDataVersion: asString(object.gameDataVersion, 'battlePass.gameDataVersion', issues),
    id: asString(object.id, 'battlePass.id', issues),
    endsAt: asInteger(object.endsAt, 'battlePass.endsAt', issues, 1),
    pages,
  };
}

function parseRules(raw: unknown, localization: LocalizationCatalog, issues: string[]): OptimizerRulesCatalog {
  const object = asObject(raw, 'optimizerRules', issues);
  const rawLimits = asObject(object.dailyDocumentLimits, 'optimizerRules.dailyDocumentLimits', issues);
  const dailyDocumentLimits = {
    pve: asInteger(rawLimits.pve, 'optimizerRules.dailyDocumentLimits.pve', issues, 1),
    pvp: asInteger(rawLimits.pvp, 'optimizerRules.dailyDocumentLimits.pvp', issues, 1),
    'pvp-seasonal': asInteger(rawLimits['pvp-seasonal'], 'optimizerRules.dailyDocumentLimits.pvp-seasonal', issues, 1),
  } as const;
  const exchange = asObject(object.exchange, 'optimizerRules.exchange', issues);
  const rawTarCoinBundles = asArray(object.tarCoinBundles, 'optimizerRules.tarCoinBundles', issues);
  const priceIds = new Set(localization.priceEntries.map((entry) => entry.id));
  const tarCoinBundles = rawTarCoinBundles.map((value, index) => {
    const bundle = asObject(value, `optimizerRules.tarCoinBundles[${index}]`, issues);
    const localPriceId = asString(bundle.localPriceId, `optimizerRules.tarCoinBundles[${index}].localPriceId`, issues);
    if (!priceIds.has(localPriceId)) issues.push(`${localPriceId} is not defined in localization.priceEntries`);
    return {
      tarCoins: asInteger(bundle.tarCoins, `optimizerRules.tarCoinBundles[${index}].tarCoins`, issues, 1),
      bonusTarCoins: asInteger(bundle.bonusTarCoins, `optimizerRules.tarCoinBundles[${index}].bonusTarCoins`, issues),
      localPriceId,
    };
  });
  const classified = asObject(object.classifiedDocuments, 'optimizerRules.classifiedDocuments', issues);
  if (classified.backfillOnly !== true) issues.push('optimizerRules.classifiedDocuments.backfillOnly must be true');
  const classifiedBundles = asArray(classified.bundles, 'optimizerRules.classifiedDocuments.bundles', issues).map((value, index) => {
    const bundle = asObject(value, `optimizerRules.classifiedDocuments.bundles[${index}]`, issues);
    return {
      classifiedDocuments: asInteger(bundle.classifiedDocuments, `optimizerRules.classifiedDocuments.bundles[${index}].classifiedDocuments`, issues, 1),
      tarCoins: asInteger(bundle.tarCoins, `optimizerRules.classifiedDocuments.bundles[${index}].tarCoins`, issues, 1),
      bonusTarCoins: asInteger(bundle.bonusTarCoins, `optimizerRules.classifiedDocuments.bundles[${index}].bonusTarCoins`, issues),
    };
  });
  const routeProfiles = asObject(object.routeProfiles, 'optimizerRules.routeProfiles', issues);
  const parseProfile = <T extends 'maxRaidTimeMin' | 'difficultyRating'>(name: 'fastest' | 'safest', factorField: T) => {
    const profile = asObject(routeProfiles[name], `optimizerRules.routeProfiles.${name}`, issues);
    const actualFactorField = asString(profile.factorField, `optimizerRules.routeProfiles.${name}.factorField`, issues);
    if (actualFactorField !== factorField) issues.push(`${name} must use ${factorField}`);
    const tieBreakOrder = asArray(profile.tieBreakOrder, `optimizerRules.routeProfiles.${name}.tieBreakOrder`, issues).map((value, index) =>
      asString(value, `optimizerRules.routeProfiles.${name}.tieBreakOrder[${index}]`, issues),
    );
    return { factorField, tieBreakOrder };
  };
  const schedule = asObject(object.dailySchedule, 'optimizerRules.dailySchedule', issues);
  return {
    schemaVersion: asInteger(object.schemaVersion, 'optimizerRules.schemaVersion', issues, 1),
    dailyDocumentLimits,
    exchange: {
      regularDocumentsPerBlackDivisionGearCrate: asInteger(exchange.regularDocumentsPerBlackDivisionGearCrate, 'optimizerRules.exchange.regularDocumentsPerBlackDivisionGearCrate', issues, 1),
      regularDocumentsPerOtherDocuments: asInteger(exchange.regularDocumentsPerOtherDocuments, 'optimizerRules.exchange.regularDocumentsPerOtherDocuments', issues, 1),
    },
    tarCoinBundles,
    classifiedDocuments: {
      backfillOnly: asBoolean(classified.backfillOnly, 'optimizerRules.classifiedDocuments.backfillOnly', issues) as true,
      purchaseSource: asString(classified.purchaseSource, 'optimizerRules.classifiedDocuments.purchaseSource', issues),
      bundles: classifiedBundles,
      purchasePolicy: asString(classified.purchasePolicy, 'optimizerRules.classifiedDocuments.purchasePolicy', issues),
    },
    routeProfiles: {
      fastest: parseProfile('fastest', 'maxRaidTimeMin'),
      safest: parseProfile('safest', 'difficultyRating'),
      combinedDisplayRule: asString(routeProfiles.combinedDisplayRule, 'optimizerRules.routeProfiles.combinedDisplayRule', issues),
      unavailableRule: asString(routeProfiles.unavailableRule, 'optimizerRules.routeProfiles.unavailableRule', issues),
      classifiedAllocationRule: asString(routeProfiles.classifiedAllocationRule, 'optimizerRules.routeProfiles.classifiedAllocationRule', issues),
      regularExchangeRule: asString(routeProfiles.regularExchangeRule, 'optimizerRules.routeProfiles.regularExchangeRule', issues),
      blackDivisionCrateFallback: asString(routeProfiles.blackDivisionCrateFallback, 'optimizerRules.routeProfiles.blackDivisionCrateFallback', issues),
    },
    dailySchedule: {
      enabled: asBoolean(schedule.enabled, 'optimizerRules.dailySchedule.enabled', issues),
      scheduleOrder: asString(schedule.scheduleOrder, 'optimizerRules.dailySchedule.scheduleOrder', issues),
      futureDaysCollapsedByDefault: asBoolean(schedule.futureDaysCollapsedByDefault, 'optimizerRules.dailySchedule.futureDaysCollapsedByDefault', issues),
      showOverflowAsNextDay: asBoolean(schedule.showOverflowAsNextDay, 'optimizerRules.dailySchedule.showOverflowAsNextDay', issues),
    },
  };
}

export function parseCatalogs(raw: Readonly<Record<CatalogKey, unknown>>): Catalogs {
  const issues: string[] = [];
  const localization = parseLocalization(raw.localization, issues);
  const locations = parseLocations(raw.locations, localization, issues);
  const documents = parseDocuments(raw.documents, locations, localization, issues);
  const battlePass = parseBattlePass(raw.battlePass, documents, localization, issues);
  const optimizerRules = parseRules(raw.optimizerRules, localization, issues);
  if (battlePass.gameDataVersion !== GAME_DATA_VERSION) issues.push(`battlePass.gameDataVersion must equal ${GAME_DATA_VERSION}`);
  if (battlePass.id !== 'season.one') issues.push('battlePass.id must equal season.one');
  if (battlePass.endsAt !== SEASON_ENDS_AT) issues.push(`battlePass.endsAt must equal ${SEASON_ENDS_AT}`);
  if (issues.length > 0) throw new CatalogValidationError(issues);
  return deepFreeze({ documents, locations, battlePass, optimizerRules, localization });
}

export async function loadCatalogs(baseUrl = import.meta.env.BASE_URL, fetcher: typeof fetch = fetch): Promise<Catalogs> {
  const paths: Record<CatalogKey, string> = {
    documents: 'data/documents.json',
    locations: 'data/locations.json',
    battlePass: 'data/battle-pass.json',
    optimizerRules: 'data/optimizer-rules.json',
    localization: 'data/localization.json',
  };
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const entries = await Promise.all(
    (Object.entries(paths) as [CatalogKey, string][]).map(async ([key, relativePath]) => {
      const response = await fetcher(`${base}${relativePath}`);
      if (!response.ok) throw new Error(`Unable to load ${key} catalog (${response.status})`);
      return [key, await response.json()] as const;
    }),
  );
  return parseCatalogs(Object.fromEntries(entries) as Record<CatalogKey, unknown>);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value as Record<string, unknown>)) deepFreeze(nestedValue);
  return Object.freeze(value);
}
