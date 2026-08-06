import type {
  BattlePassPage,
  Catalogs,
  ClassifiedBundle,
  DocumentKind,
  GameMode,
  LocationRecord,
  RewardRecord,
} from './catalogs';

export type OptimizationProfile = 'fastest' | 'safest';

export interface OptimizerInput {
  readonly catalogs: Catalogs;
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
  readonly tarCoins: number;
  readonly spendTarCoinsOnClassifiedDocuments: boolean;
  readonly mode: GameMode;
  readonly locale?: string;
  readonly crateCount?: number;
}

export interface DocumentAssignment {
  readonly documentId: string;
  readonly quantity: number;
}

export interface LocationAssignment {
  readonly locationId: string;
  readonly difficultyId: LocationRecord['difficultyId'];
  readonly difficultyRating: number;
  readonly maxRaidTimeMin: number;
  readonly documents: readonly DocumentAssignment[];
}

export interface ExchangePlan {
  readonly receivedDocumentId: string;
  readonly donors: Readonly<Record<string, number>>;
}

export interface ClassifiedPurchasePlan {
  readonly bundleCounts: readonly number[];
  readonly tarCoinsSpent: number;
  readonly startingTarCoinsUsed: number;
  readonly earnedTarCoinsUsed: number;
  readonly classifiedDocumentsPurchased: number;
  readonly classifiedDocumentsUsed: number;
  readonly excessClassifiedDocuments: number;
}

export interface LocalTarCoinEstimate {
  readonly packageCounts: readonly number[];
  readonly tarCoinsPurchased: number;
  readonly excessTarCoins: number;
  readonly costMinor: number;
  readonly currency: string;
  readonly display: string;
}

export interface BuyoutEstimate {
  readonly bundleCounts: readonly number[];
  readonly classifiedDocumentsPurchased: number;
  readonly classifiedDocumentsUsed: number;
  readonly excessClassifiedDocuments: number;
  readonly grossTarCoinsSpent: number;
  readonly startingTarCoinsUsed: number;
  readonly earnedTarCoinsAwarded: number;
  readonly earnedTarCoinsUsed: number;
  readonly minimumAdditionalTarCoins: number;
  readonly localEstimate?: LocalTarCoinEstimate;
}

export interface RouteResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly locations: readonly LocationAssignment[];
  readonly profileCost: number;
  readonly rawDocumentQuantity: number;
  readonly deficits: Readonly<Record<string, number>>;
}

export interface ScheduleDay {
  readonly day: number;
  readonly expanded: boolean;
  readonly documentQuantity: number;
  readonly locations: readonly LocationAssignment[];
  readonly rewardIdsClaimed: readonly string[];
  readonly unlockedPage?: number;
}

export interface CratePlan {
  readonly crateCount: number;
  readonly regularDocumentsRequired: number;
  readonly regularDocumentsOwned: number;
  readonly regularDocumentsToFarm: number;
  readonly farmingLocationId?: string;
}

export interface ProfileResult {
  readonly profile: OptimizationProfile;
  readonly route: RouteResult;
  readonly classifiedAllocation: Readonly<Record<string, number>>;
  readonly classifiedConsumed: number;
  readonly classifiedRemaining: number;
  readonly exchanges: readonly ExchangePlan[];
  readonly remainingSurplus: Readonly<Record<string, number>>;
  readonly purchases: ClassifiedPurchasePlan;
  readonly immediateRewardIds: readonly string[];
  readonly schedule: readonly ScheduleDay[];
  readonly warnings: readonly string[];
}

export interface OptimizerResult {
  readonly goal: 'all-unclaimed-rewards' | 'black-division-crates';
  readonly unclaimedRewardIds: readonly string[];
  readonly redemptionSequence: readonly string[];
  readonly matchingRegularDocumentsConsumed: Readonly<Record<string, number>>;
  readonly initialDeficits: Readonly<Record<string, number>>;
  readonly classifiedConsumed: number;
  readonly classifiedRemaining: number;
  readonly effectiveDailyLimit: number;
  readonly profiles: Readonly<Record<OptimizationProfile, ProfileResult>>;
  readonly profilesCoincide: boolean;
  readonly buyout: BuyoutEstimate;
  readonly cratePlan?: CratePlan;
}

interface RouteCandidate extends RouteResult {
  readonly locationIds: readonly string[];
}

interface BundleSelection {
  readonly counts: readonly number[];
  readonly totalDocuments: number;
  readonly totalTarCoins: number;
}

interface BundleState extends BundleSelection {
  readonly count: number;
}

interface StagedPurchaseResult {
  readonly allocation: Readonly<Record<string, number>>;
  readonly purchase: ClassifiedPurchasePlan;
}

const PROFILE_FACTORS: Record<OptimizationProfile, 'maxRaidTimeMin' | 'difficultyRating'> = {
  fastest: 'maxRaidTimeMin',
  safest: 'difficultyRating',
};

export function optimize(input: OptimizerInput): OptimizerResult {
  validateInput(input);
  const allRewards = orderedRewards(input.catalogs.battlePass.pages);
  const claimed = new Set(input.claimedRewardIds);
  const unclaimedRewards = allRewards.filter((reward) => !claimed.has(reward.id));
  const redemptionSequence = legalRedemptionSequence(input.catalogs.battlePass.pages, claimed);
  const requirements = aggregateRequirements(unclaimedRewards);
  const matching = consumeMatchingInventory(requirements, input.ownedDocuments, input.catalogs);
  const initialDeficits = subtract(requirements, matching.consumed);
  const classifiedToConsume = Math.min(input.classifiedDocuments, sumValues(initialDeficits));
  const effectiveDailyLimit = input.catalogs.optimizerRules.dailyDocumentLimits[input.mode];
  if (unclaimedRewards.length === 0) return optimizeCrates(input, effectiveDailyLimit);
  const profiles = {
    fastest: buildProfile('fastest', input, initialDeficits, classifiedToConsume, matching.surplus),
    safest: buildProfile('safest', input, initialDeficits, classifiedToConsume, matching.surplus),
  } as const;
  const buyout = calculateBuyout(input, unclaimedRewards, redemptionSequence);
  const profilesCoincide = sameAssignment(profiles.fastest, profiles.safest);
  return {
    goal: 'all-unclaimed-rewards',
    unclaimedRewardIds: unclaimedRewards.map((reward) => reward.id),
    redemptionSequence,
    matchingRegularDocumentsConsumed: matching.consumed,
    initialDeficits,
    classifiedConsumed: classifiedToConsume,
    classifiedRemaining: input.classifiedDocuments - classifiedToConsume,
    effectiveDailyLimit,
    profiles,
    profilesCoincide,
    buyout,
  };
}

function validateInput(input: OptimizerInput): void {
  if (!Number.isInteger(input.classifiedDocuments) || input.classifiedDocuments < 0) throw new RangeError('Classified Documents must be a non-negative integer');
  if (!Number.isInteger(input.tarCoins) || input.tarCoins < 0) throw new RangeError('TarCoins must be a non-negative integer');
  if (input.crateCount !== undefined && (!Number.isInteger(input.crateCount) || input.crateCount < 1)) throw new RangeError('Crate count must be a positive integer');
  for (const [documentId, quantity] of Object.entries(input.ownedDocuments)) {
    if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError(`Owned quantity for ${documentId} must be a non-negative integer`);
  }
}

function orderedRewards(pages: readonly BattlePassPage[]): readonly RewardRecord[] {
  return pages.flatMap((page) => page.rewards);
}

function legalRedemptionSequence(pages: readonly BattlePassPage[], claimed: ReadonlySet<string>): readonly string[] {
  return pages.flatMap((page) => page.rewards.filter((reward) => !claimed.has(reward.id)).map((reward) => reward.id));
}

function aggregateRequirements(rewards: readonly RewardRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const reward of rewards) {
    for (const requirement of reward.requirements) totals[requirement.documentId] = (totals[requirement.documentId] ?? 0) + requirement.quantity;
  }
  return sortRecord(totals);
}

function consumeMatchingInventory(
  requirements: Readonly<Record<string, number>>,
  owned: Readonly<Record<string, number>>,
  catalogs: Catalogs,
): { consumed: Readonly<Record<string, number>>; surplus: Readonly<Record<string, number>> } {
  const consumed: Record<string, number> = {};
  const surplus: Record<string, number> = {};
  const regularIds = new Set(catalogs.documents.documents.filter((document) => document.kind === 'regular').map((document) => document.id));
  for (const [documentId, quantity] of Object.entries(requirements)) {
    const available = owned[documentId] ?? 0;
    consumed[documentId] = Math.min(available, quantity);
    if (available > quantity) surplus[documentId] = available - quantity;
  }
  for (const [documentId, quantity] of Object.entries(owned)) {
    if (regularIds.has(documentId) && !(documentId in requirements) && quantity > 0) surplus[documentId] = quantity;
  }
  return { consumed: sortRecord(consumed), surplus: sortRecord(surplus) };
}

function buildProfile(
  profile: OptimizationProfile,
  input: OptimizerInput,
  initialDeficits: Readonly<Record<string, number>>,
  classifiedToConsume: number,
  surplus: Readonly<Record<string, number>>,
): ProfileResult {
  const allocation = allocateClassified(initialDeficits, classifiedToConsume, profile, input.catalogs);
  const afterClassified = subtract(initialDeficits, allocation);
  const exchanges = applyExchanges(afterClassified, surplus, profile, input.catalogs);
  let route = routeForDeficits(exchanges.deficits, profile, input.catalogs);
  let purchases = emptyPurchase(input.catalogs.optimizerRules.classifiedDocuments.bundles.length);
  if (input.spendTarCoinsOnClassifiedDocuments && sumValues(route.deficits) > 0) {
    const staged = selectStagedPurchases(input, allocation, exchanges.plans, profile);
    if (staged) {
      route = routeForDeficits(subtract(route.deficits, staged.allocation), profile, input.catalogs);
      purchases = staged.purchase;
    }
  }
  const progression = scheduleProgressiveRoute(
    route,
    input.catalogs.battlePass.pages,
    input.claimedRewardIds,
    input.catalogs.optimizerRules.dailyDocumentLimits[input.mode],
    profile,
  );
  return {
    profile,
    route,
    classifiedAllocation: allocation,
    classifiedConsumed: sumValues(allocation),
    classifiedRemaining: input.classifiedDocuments - sumValues(allocation),
    exchanges: exchanges.plans,
    remainingSurplus: exchanges.surplus,
    purchases,
    immediateRewardIds: progression.immediateRewardIds,
    schedule: progression.days,
    warnings: route.available ? [] : [route.reason ?? 'Route unavailable'],
  };
}

function allocateClassified(
  deficits: Readonly<Record<string, number>>,
  quantity: number,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): Readonly<Record<string, number>> {
  const target = Math.min(quantity, sumValues(deficits));
  if (target === 0) return {};
  return sortRecord(greedyClassified(deficits, target, profile, catalogs));
}

function greedyClassified(
  deficits: Readonly<Record<string, number>>,
  quantity: number,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): Record<string, number> {
  const ids = Object.keys(deficits).sort((left, right) => {
    const difference = bestSourceFactor(right, profile, catalogs) - bestSourceFactor(left, profile, catalogs);
    return difference || left.localeCompare(right);
  });
  const allocation: Record<string, number> = {};
  let remaining = quantity;
  for (const id of ids) {
    const value = Math.min(deficits[id], remaining);
    if (value > 0) allocation[id] = value;
    remaining -= value;
    if (remaining === 0) break;
  }
  return allocation;
}

function applyExchanges(
  deficits: Readonly<Record<string, number>>,
  startingSurplus: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): { deficits: Readonly<Record<string, number>>; surplus: Readonly<Record<string, number>>; plans: readonly ExchangePlan[] } {
  const ratio = catalogs.optimizerRules.exchange.regularDocumentsPerOtherDocuments;
  const currentDeficits = { ...deficits };
  const surplus = { ...startingSurplus };
  const plans: ExchangePlan[] = [];
  while (sumValues(surplus) >= ratio && sumValues(currentDeficits) > 0) {
    const before = routeForDeficits(currentDeficits, profile, catalogs);
    let bestId: string | undefined;
    let bestRoute: RouteCandidate | undefined;
    for (const documentId of Object.keys(currentDeficits).sort()) {
      if (currentDeficits[documentId] <= 0) continue;
      const candidateDeficits = { ...currentDeficits, [documentId]: currentDeficits[documentId] - 1 };
      const candidateRoute = routeForDeficits(candidateDeficits, profile, catalogs);
      const improvement = routeImprovement(before, candidateRoute);
      if (improvement > 0 && (!bestRoute || improvement > routeImprovement(before, bestRoute))) {
        bestId = documentId;
        bestRoute = candidateRoute;
      }
    }
    if (!bestId || !bestRoute) break;
    const donors = takeSurplus(surplus, ratio);
    currentDeficits[bestId] -= 1;
    for (const [documentId, quantity] of Object.entries(donors)) surplus[documentId] -= quantity;
    plans.push({ receivedDocumentId: bestId, donors });
  }
  return { deficits: sortRecord(currentDeficits), surplus: sortRecord(surplus), plans };
}

function selectStagedPurchases(
  input: OptimizerInput,
  ownedClassifiedAllocation: Readonly<Record<string, number>>,
  exchanges: readonly ExchangePlan[],
  profile: OptimizationProfile,
): StagedPurchaseResult | undefined {
  const rewardsById = new Map(orderedRewards(input.catalogs.battlePass.pages).map((reward) => [reward.id, reward]));
  const regularInventory: Record<string, number> = { ...input.ownedDocuments };
  for (const exchange of exchanges) {
    for (const [documentId, quantity] of Object.entries(exchange.donors)) regularInventory[documentId] = (regularInventory[documentId] ?? 0) - quantity;
    regularInventory[exchange.receivedDocumentId] = (regularInventory[exchange.receivedDocumentId] ?? 0) + 1;
  }
  const ownedClassifiedRemaining = { ...ownedClassifiedAllocation };
  const bundles = input.catalogs.optimizerRules.classifiedDocuments.bundles;
  const bundleCounts = bundles.map(() => 0);
  let purchasedAvailable = 0;
  let purchasedTotal = 0;
  let purchasedUsed = 0;
  let startingBalance = input.tarCoins;
  let earnedBalance = 0;
  let startingUsed = 0;
  let earnedUsed = 0;
  const purchasedAllocation: Record<string, number> = {};
  for (const rewardId of legalRedemptionSequence(input.catalogs.battlePass.pages, new Set(input.claimedRewardIds))) {
    const reward = rewardsById.get(rewardId);
    if (!reward) continue;
    const missing: Record<string, number> = {};
    for (const requirement of reward.requirements) {
      const available = regularInventory[requirement.documentId] ?? 0;
      const regularUsed = Math.min(available, requirement.quantity);
      regularInventory[requirement.documentId] = available - regularUsed;
      let remainder = requirement.quantity - regularUsed;
      const ownedClassified = Math.min(ownedClassifiedRemaining[requirement.documentId] ?? 0, remainder);
      if (ownedClassified > 0) ownedClassifiedRemaining[requirement.documentId] -= ownedClassified;
      remainder -= ownedClassified;
      if (remainder > 0) missing[requirement.documentId] = (missing[requirement.documentId] ?? 0) + remainder;
    }
    const useExistingPurchased = allocateClassified(missing, Math.min(purchasedAvailable, sumValues(missing)), profile, input.catalogs);
    for (const [documentId, quantity] of Object.entries(useExistingPurchased)) {
      missing[documentId] -= quantity;
      purchasedAvailable -= quantity;
      purchasedUsed += quantity;
      purchasedAllocation[documentId] = (purchasedAllocation[documentId] ?? 0) + quantity;
    }
    const remaining = sumValues(missing);
    if (remaining > 0) {
      const selection = chooseBundlesForDocuments(remaining, bundles, startingBalance + earnedBalance)
        ?? chooseMaxAffordableBundles(remaining, bundles, startingBalance + earnedBalance);
      if (selection) {
        selection.counts.forEach((count, index) => { bundleCounts[index] += count; });
        purchasedTotal += selection.totalDocuments;
        purchasedAvailable += selection.totalDocuments;
        const fromStarting = Math.min(startingBalance, selection.totalTarCoins);
        startingBalance -= fromStarting;
        startingUsed += fromStarting;
        const fromEarned = Math.min(earnedBalance, selection.totalTarCoins - fromStarting);
        earnedBalance -= fromEarned;
        earnedUsed += fromEarned;
        const purchased = allocateClassified(missing, Math.min(selection.totalDocuments, remaining), profile, input.catalogs);
        for (const [documentId, quantity] of Object.entries(purchased)) {
          missing[documentId] -= quantity;
          purchasedAvailable -= quantity;
          purchasedUsed += quantity;
          purchasedAllocation[documentId] = (purchasedAllocation[documentId] ?? 0) + quantity;
        }
      }
    }
    if (reward.tarCoinsAwarded) earnedBalance += reward.tarCoinsAwarded;
  }
  if (purchasedTotal === 0) return undefined;
  return {
    allocation: sortRecord(purchasedAllocation),
    purchase: {
      bundleCounts,
      tarCoinsSpent: startingUsed + earnedUsed,
      startingTarCoinsUsed: startingUsed,
      earnedTarCoinsUsed: earnedUsed,
      classifiedDocumentsPurchased: purchasedTotal,
      classifiedDocumentsUsed: purchasedUsed,
      excessClassifiedDocuments: purchasedTotal - purchasedUsed,
    },
  };
}

function routeForDeficits(
  deficits: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): RouteCandidate {
  const positiveDeficits = sortRecord(Object.fromEntries(Object.entries(deficits).filter(([, quantity]) => quantity > 0)));
  const rawDocumentQuantity = sumValues(positiveDeficits);
  if (rawDocumentQuantity === 0) return { available: true, locations: [], profileCost: 0, rawDocumentQuantity: 0, deficits: {}, locationIds: [] };
  const documents = new Map(catalogs.documents.documents.map((document) => [document.id, document]));
  const locations = [...catalogs.locations.locations].sort((left, right) => left.id.localeCompare(right.id));
  let best: RouteCandidate | undefined;
  for (let mask = 1; mask < 1 << locations.length; mask += 1) {
    const selected = locations.filter((_, index) => (mask & (1 << index)) !== 0);
    const selectedIds = new Set(selected.map((location) => location.id));
    const byLocation = new Map<string, DocumentAssignment[]>();
    let cost = 0;
    let available = true;
    for (const [documentId, quantity] of Object.entries(positiveDeficits)) {
      const document = documents.get(documentId);
      const source = document?.sourceLocationIds
        .map((sourceId) => locations.find((location) => location.id === sourceId))
        .filter((location): location is LocationRecord => Boolean(location && selectedIds.has(location.id)))
        .sort((left, right) => Number(left[PROFILE_FACTORS[profile]]) - Number(right[PROFILE_FACTORS[profile]]) || left.id.localeCompare(right.id))[0];
      if (!source) {
        available = false;
        break;
      }
      cost += quantity * Number(source[PROFILE_FACTORS[profile]]);
      const assignments = byLocation.get(source.id) ?? [];
      assignments.push({ documentId, quantity });
      byLocation.set(source.id, assignments);
    }
    if (!available) continue;
    const route: RouteCandidate = {
      available: true,
      locations: [...byLocation.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([locationId, documentsAtLocation]) => {
        const location = locations.find((candidate) => candidate.id === locationId)!;
        return {
        locationId,
        difficultyId: location.difficultyId,
        difficultyRating: location.difficultyRating,
        maxRaidTimeMin: location.maxRaidTimeMin,
        documents: documentsAtLocation.sort((left, right) => left.documentId.localeCompare(right.documentId)),
        };
      }),
      profileCost: cost,
      rawDocumentQuantity,
      deficits: positiveDeficits,
      locationIds: [...byLocation.keys()].sort(),
    };
    if (!best || compareRoutes(route, best) < 0) best = route;
  }
  return best ?? {
    available: false,
    reason: `No eligible source locations cover ${Object.keys(positiveDeficits).join(', ')}`,
    locations: [],
    profileCost: Number.POSITIVE_INFINITY,
    rawDocumentQuantity,
    deficits: positiveDeficits,
    locationIds: [],
  };
}

function scheduleProgressiveRoute(
  route: RouteResult,
  pages: readonly BattlePassPage[],
  initialClaimedRewardIds: readonly string[],
  dailyLimit: number,
  profile: OptimizationProfile,
): { immediateRewardIds: readonly string[]; days: readonly ScheduleDay[] } {
  if (!route.available) return { immediateRewardIds: [], days: [] };
  const unclaimedRewards = orderedRewards(pages).filter((reward) => !initialClaimedRewardIds.includes(reward.id));
  const totalRequirements = aggregateRequirements(unclaimedRewards);
  const farmRemaining = { ...route.deficits };
  const available = Object.fromEntries(Object.entries(totalRequirements).map(([documentId, quantity]) => [documentId, quantity - (farmRemaining[documentId] ?? 0)]));
  const claimed = new Set(initialClaimedRewardIds);
  const immediateRewardIds: string[] = [];
  claimAvailableRewards(pages, claimed, available, immediateRewardIds);

  const sources = new Map<string, LocationAssignment>();
  for (const location of route.locations) for (const document of location.documents) sources.set(document.documentId, location);
  const days: ScheduleDay[] = [];
  while (sumValues(farmRemaining) > 0) {
    const locations: LocationAssignment[] = [];
    const rewardIdsClaimed: string[] = [];
    const unlockedBefore = unlockedPageCount(pages, claimed);
    let documentQuantity = 0;
    while (documentQuantity < dailyLimit) {
      claimAvailableRewards(pages, claimed, available, rewardIdsClaimed);
      const target = selectProgressionTarget(pages, claimed, available, farmRemaining, sources, profile);
      if (!target) break;
      const missing = missingRequirements(target, available);
      const documentIds = Object.keys(missing).sort((left, right) => {
        const leftSource = sources.get(left);
        const rightSource = sources.get(right);
        return (leftSource?.locationId ?? '').localeCompare(rightSource?.locationId ?? '') || left.localeCompare(right);
      });
      let farmed = 0;
      for (const documentId of documentIds) {
        const source = sources.get(documentId);
        if (!source) continue;
        const quantity = Math.min(missing[documentId], farmRemaining[documentId] ?? 0, dailyLimit - documentQuantity);
        if (quantity <= 0) continue;
        available[documentId] = (available[documentId] ?? 0) + quantity;
        farmRemaining[documentId] -= quantity;
        documentQuantity += quantity;
        farmed += quantity;
        addLocationAssignment(locations, source, documentId, quantity);
        if (documentQuantity === dailyLimit) break;
      }
      if (farmed === 0) break;
    }
    claimAvailableRewards(pages, claimed, available, rewardIdsClaimed);
    if (documentQuantity === 0) break;
    const unlockedAfter = unlockedPageCount(pages, claimed);
    days.push({
      day: days.length + 1,
      expanded: days.length === 0,
      documentQuantity,
      locations: locations.sort((left, right) => left.locationId.localeCompare(right.locationId)),
      rewardIdsClaimed,
      ...(unlockedAfter > unlockedBefore ? { unlockedPage: pages[unlockedAfter - 1].page } : {}),
    });
  }
  const trailingClaims: string[] = [];
  claimAvailableRewards(pages, claimed, available, trailingClaims);
  if (days.length > 0 && trailingClaims.length > 0) {
    const last = days[days.length - 1];
    days[days.length - 1] = { ...last, rewardIdsClaimed: [...last.rewardIdsClaimed, ...trailingClaims] };
  } else {
    immediateRewardIds.push(...trailingClaims);
  }
  return { immediateRewardIds, days };
}

function progressionCandidates(pages: readonly BattlePassPage[], claimed: ReadonlySet<string>): readonly RewardRecord[] {
  const unlocked = unlockedPageCount(pages, claimed);
  const frontier = pages[unlocked - 1];
  if (unlocked < pages.length) return frontier.rewards.filter((reward) => !claimed.has(reward.id));
  return pages.slice(0, unlocked).flatMap((page) => page.rewards.filter((reward) => !claimed.has(reward.id)));
}

function unlockedPageCount(pages: readonly BattlePassPage[], claimed: ReadonlySet<string>): number {
  let unlocked = Math.min(1, pages.length);
  while (unlocked < pages.length) {
    const previous = pages[unlocked - 1];
    const required = Math.max(0, previous.rewards.length - 1);
    if (previous.rewards.filter((reward) => claimed.has(reward.id)).length < required) break;
    unlocked += 1;
  }
  return unlocked;
}

function claimAvailableRewards(
  pages: readonly BattlePassPage[],
  claimed: Set<string>,
  available: Record<string, number>,
  output: string[],
): void {
  while (true) {
    const reward = progressionCandidates(pages, claimed)
      .filter((candidate) => candidate.requirements.every((requirement) => (available[requirement.documentId] ?? 0) >= requirement.quantity))
      .sort((left, right) => sumRequirements(left) - sumRequirements(right) || left.id.localeCompare(right.id))[0];
    if (!reward) return;
    for (const requirement of reward.requirements) available[requirement.documentId] -= requirement.quantity;
    claimed.add(reward.id);
    output.push(reward.id);
  }
}

function selectProgressionTarget(
  pages: readonly BattlePassPage[],
  claimed: ReadonlySet<string>,
  available: Readonly<Record<string, number>>,
  farmRemaining: Readonly<Record<string, number>>,
  sources: ReadonlyMap<string, LocationAssignment>,
  profile: OptimizationProfile,
): RewardRecord | undefined {
  return progressionCandidates(pages, claimed)
    .filter((reward) => {
      const missing = missingRequirements(reward, available);
      return Object.entries(missing).every(([documentId, quantity]) => quantity <= (farmRemaining[documentId] ?? 0) && sources.has(documentId));
    })
    .sort((left, right) => compareProgressionTargets(left, right, available, sources, profile))[0];
}

function compareProgressionTargets(
  left: RewardRecord,
  right: RewardRecord,
  available: Readonly<Record<string, number>>,
  sources: ReadonlyMap<string, LocationAssignment>,
  profile: OptimizationProfile,
): number {
  const leftMissing = missingRequirements(left, available);
  const rightMissing = missingRequirements(right, available);
  const factor = PROFILE_FACTORS[profile];
  const cost = (missing: Readonly<Record<string, number>>): number => Object.entries(missing)
    .reduce((sum, [documentId, quantity]) => sum + quantity * Number(sources.get(documentId)?.[factor] ?? Number.POSITIVE_INFINITY), 0);
  const leftLocations = new Set(Object.keys(leftMissing).map((documentId) => sources.get(documentId)?.locationId)).size;
  const rightLocations = new Set(Object.keys(rightMissing).map((documentId) => sources.get(documentId)?.locationId)).size;
  return cost(leftMissing) - cost(rightMissing)
    || leftLocations - rightLocations
    || sumValues(leftMissing) - sumValues(rightMissing)
    || left.id.localeCompare(right.id);
}

function missingRequirements(reward: RewardRecord, available: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(reward.requirements
    .map((requirement) => [requirement.documentId, Math.max(0, requirement.quantity - (available[requirement.documentId] ?? 0))] as const)
    .filter(([, quantity]) => quantity > 0));
}

function sumRequirements(reward: RewardRecord): number {
  return reward.requirements.reduce((sum, requirement) => sum + requirement.quantity, 0);
}

function addLocationAssignment(
  locations: LocationAssignment[],
  source: LocationAssignment,
  documentId: string,
  quantity: number,
): void {
  let location = locations.find((candidate) => candidate.locationId === source.locationId);
  if (!location) {
    location = { ...source, documents: [] };
    locations.push(location);
  }
  const documents = location.documents as DocumentAssignment[];
  const document = documents.find((candidate) => candidate.documentId === documentId);
  if (document) (document as { quantity: number }).quantity += quantity;
  else documents.push({ documentId, quantity });
}

function scheduleRoute(route: RouteResult, dailyLimit: number): readonly ScheduleDay[] {
  if (!route.available || route.rawDocumentQuantity === 0) return [];
  const days: Array<{ day: number; expanded: boolean; documentQuantity: number; locations: LocationAssignment[]; rewardIdsClaimed: string[] }> = [];
  for (const location of route.locations) {
    for (const document of location.documents) {
      let remaining = document.quantity;
      while (remaining > 0) {
        let day = days[days.length - 1];
        if (!day || day.documentQuantity === dailyLimit) {
          day = { day: days.length + 1, expanded: days.length === 0, documentQuantity: 0, locations: [], rewardIdsClaimed: [] };
          days.push(day);
        }
        const quantity = Math.min(remaining, dailyLimit - day.documentQuantity);
        const existingLocation = day.locations.find((candidate) => candidate.locationId === location.locationId);
        if (existingLocation) {
          const existingDocument = existingLocation.documents.find((candidate) => candidate.documentId === document.documentId);
          if (existingDocument) (existingDocument as { quantity: number }).quantity += quantity;
          else (existingLocation.documents as DocumentAssignment[]).push({ documentId: document.documentId, quantity });
        } else {
          day.locations.push({ ...location, documents: [{ documentId: document.documentId, quantity }] });
        }
        day.documentQuantity += quantity;
        remaining -= quantity;
      }
    }
  }
  return days.map((day) => ({ ...day, locations: day.locations.map((location) => ({ ...location, documents: [...location.documents] })) }));
}

function optimizeCrates(input: OptimizerInput, effectiveDailyLimit: number): OptimizerResult {
  const crateCount = input.crateCount ?? 1;
  const ratio = input.catalogs.optimizerRules.exchange.regularDocumentsPerBlackDivisionGearCrate;
  const regularDocuments = input.catalogs.documents.documents.filter((document) => document.kind === 'regular');
  const regularDocumentsOwned = regularDocuments.reduce((sum, document) => sum + (input.ownedDocuments[document.id] ?? 0), 0);
  const regularDocumentsRequired = crateCount * ratio;
  const regularDocumentsToFarm = Math.max(0, regularDocumentsRequired - regularDocumentsOwned);
  const eligibleLocations = input.catalogs.locations.locations.filter((location) => regularDocuments.some((document) => document.sourceLocationIds.includes(location.id)))
    .sort((left, right) => left.maxRaidTimeMin - right.maxRaidTimeMin || left.id.localeCompare(right.id));
  const farmingLocation = regularDocumentsToFarm > 0 ? eligibleLocations[0] : undefined;
  const farmingDocument = farmingLocation ? regularDocuments.find((document) => document.sourceLocationIds.includes(farmingLocation.id)) : undefined;
  const deficits = farmingDocument && farmingLocation ? { [farmingDocument.id]: regularDocumentsToFarm } : {};
  const profiles = (['fastest', 'safest'] as const).reduce((result, profile) => {
    const route = farmingLocation && farmingDocument
      ? {
          available: true,
          locations: [{
            locationId: farmingLocation.id,
            difficultyId: farmingLocation.difficultyId,
            difficultyRating: farmingLocation.difficultyRating,
            maxRaidTimeMin: farmingLocation.maxRaidTimeMin,
            documents: [{ documentId: farmingDocument.id, quantity: regularDocumentsToFarm }],
          }],
          profileCost: regularDocumentsToFarm * Number(farmingLocation[PROFILE_FACTORS[profile]]),
          rawDocumentQuantity: regularDocumentsToFarm,
          deficits,
        }
      : regularDocumentsToFarm === 0
        ? { available: true, locations: [], profileCost: 0, rawDocumentQuantity: 0, deficits: {} }
        : { available: false, reason: 'No regular-document source location is available for Black Division crates', locations: [], profileCost: Number.POSITIVE_INFINITY, rawDocumentQuantity: regularDocumentsToFarm, deficits };
    result[profile] = {
      profile,
      route,
      classifiedAllocation: {},
      classifiedConsumed: 0,
      classifiedRemaining: input.classifiedDocuments,
      exchanges: [],
      remainingSurplus: {},
      purchases: emptyPurchase(input.catalogs.optimizerRules.classifiedDocuments.bundles.length),
      immediateRewardIds: [],
      schedule: scheduleRoute(route, effectiveDailyLimit),
      warnings: route.available ? [] : [route.reason ?? 'Route unavailable'],
    };
    return result;
  }, {} as Record<OptimizationProfile, ProfileResult>);
  return {
    goal: 'black-division-crates',
    unclaimedRewardIds: [],
    redemptionSequence: [],
    matchingRegularDocumentsConsumed: {},
    initialDeficits: {},
    classifiedConsumed: 0,
    classifiedRemaining: input.classifiedDocuments,
    effectiveDailyLimit,
    profiles,
    profilesCoincide: true,
    buyout: emptyBuyout(input.catalogs.optimizerRules.classifiedDocuments.bundles.length, input.catalogs.optimizerRules.tarCoinBundles.length),
    cratePlan: {
      crateCount,
      regularDocumentsRequired,
      regularDocumentsOwned,
      regularDocumentsToFarm,
      ...(farmingLocation ? { farmingLocationId: farmingLocation.id } : {}),
    },
  };
}

function compareRoutes(left: RouteResult, right: RouteResult): number {
  if (left.available !== right.available) return left.available ? -1 : 1;
  if (left.profileCost !== right.profileCost) return left.profileCost - right.profileCost;
  if (left.locations.length !== right.locations.length) return left.locations.length - right.locations.length;
  if (left.rawDocumentQuantity !== right.rawDocumentQuantity) return left.rawDocumentQuantity - right.rawDocumentQuantity;
  return locationIds(left).localeCompare(locationIds(right));
}

function routeImprovement(before: RouteResult, after: RouteResult): number {
  if (!before.available && after.available) return Number.POSITIVE_INFINITY;
  if (!before.available || !after.available) return 0;
  return before.profileCost - after.profileCost;
}

function bestSourceFactor(documentId: string, profile: OptimizationProfile, catalogs: Catalogs): number {
  const document = catalogs.documents.documents.find((candidate) => candidate.id === documentId);
  const sourceFactors = document?.sourceLocationIds.map((locationId) => {
    const location = catalogs.locations.locations.find((candidate) => candidate.id === locationId);
    return location ? Number(location[PROFILE_FACTORS[profile]]) : Number.POSITIVE_INFINITY;
  }) ?? [];
  return Math.min(...sourceFactors);
}

function takeSurplus(surplus: Record<string, number>, quantity: number): Record<string, number> {
  let remaining = quantity;
  const result: Record<string, number> = {};
  for (const documentId of Object.keys(surplus).sort()) {
    const taken = Math.min(surplus[documentId], remaining);
    if (taken > 0) result[documentId] = taken;
    remaining -= taken;
    if (remaining === 0) break;
  }
  return result;
}

function chooseBundlesForDocuments(target: number, bundles: readonly ClassifiedBundle[], maxTarCoins?: number): BundleSelection | undefined {
  if (target <= 0) return { counts: bundles.map(() => 0), totalDocuments: 0, totalTarCoins: 0 };
  const maxBundleDocuments = Math.max(...bundles.map((bundle) => bundle.classifiedDocuments));
  const maxDocuments = target + maxBundleDocuments;
  const states: Array<BundleState | undefined> = Array.from({ length: maxDocuments + 1 });
  states[0] = { counts: bundles.map(() => 0), totalDocuments: 0, totalTarCoins: 0, count: 0 };
  for (let documentCount = 0; documentCount <= maxDocuments; documentCount += 1) {
    const state = states[documentCount];
    if (!state) continue;
    bundles.forEach((bundle, bundleIndex) => {
      const nextDocuments = Math.min(maxDocuments, documentCount + bundle.classifiedDocuments);
      const nextTarCoins = state.totalTarCoins + bundle.tarCoins;
      if (maxTarCoins !== undefined && nextTarCoins > maxTarCoins) return;
      const counts = [...state.counts];
      counts[bundleIndex] += 1;
      const next: BundleState = {
        counts,
        totalDocuments: state.totalDocuments + bundle.classifiedDocuments,
        totalTarCoins: nextTarCoins,
        count: state.count + 1,
      };
      if (!states[nextDocuments] || compareBundleStates(next, states[nextDocuments]!) < 0) states[nextDocuments] = next;
    });
  }
  return states.slice(target).filter((state): state is BundleState => Boolean(state)).sort(compareBundleStates)[0];
}

function compareBundleStates(left: BundleState, right: BundleState): number {
  if (left.totalTarCoins !== right.totalTarCoins) return left.totalTarCoins - right.totalTarCoins;
  if (left.totalDocuments !== right.totalDocuments) return left.totalDocuments - right.totalDocuments;
  if (left.count !== right.count) return left.count - right.count;
  return left.counts.join(',').localeCompare(right.counts.join(','));
}

function chooseMaxAffordableBundles(target: number, bundles: readonly ClassifiedBundle[], maxTarCoins: number): BundleSelection | undefined {
  const states: Array<BundleState | undefined> = Array.from({ length: target + 1 });
  states[0] = { counts: bundles.map(() => 0), totalDocuments: 0, totalTarCoins: 0, count: 0 };
  for (let documentCount = 0; documentCount <= target; documentCount += 1) {
    const state = states[documentCount];
    if (!state) continue;
    bundles.forEach((bundle, bundleIndex) => {
      const nextTarCoins = state.totalTarCoins + bundle.tarCoins;
      if (nextTarCoins > maxTarCoins) return;
      const nextDocuments = Math.min(target, documentCount + bundle.classifiedDocuments);
      const counts = [...state.counts];
      counts[bundleIndex] += 1;
      const next: BundleState = {
        counts,
        totalDocuments: state.totalDocuments + bundle.classifiedDocuments,
        totalTarCoins: nextTarCoins,
        count: state.count + 1,
      };
      const current = states[nextDocuments];
      if (!current || next.totalDocuments > current.totalDocuments || (next.totalDocuments === current.totalDocuments && compareBundleStates(next, current) < 0)) states[nextDocuments] = next;
    });
  }
  return states.filter((state): state is BundleState => state !== undefined).filter((state) => state.totalDocuments > 0)
    .sort((left, right) => right.totalDocuments - left.totalDocuments || compareBundleStates(left, right))[0];
}

function calculateBuyout(input: OptimizerInput, rewards: readonly RewardRecord[], sequence: readonly string[]): BuyoutEstimate {
  const regularInventory: Record<string, number> = {};
  for (const document of input.catalogs.documents.documents) if (document.kind === 'regular') regularInventory[document.id] = input.ownedDocuments[document.id] ?? 0;
  const requirements = aggregateRequirements(rewards);
  const matching = consumeMatchingInventory(requirements, input.ownedDocuments, input.catalogs);
  const deficits = subtract(requirements, matching.consumed);
  const preparedExchanges = prepareGlobalExchanges(deficits, matching.surplus, input.catalogs.optimizerRules.exchange.regularDocumentsPerOtherDocuments);
  for (const [documentId, startingQuantity] of Object.entries(matching.surplus)) {
    const remainingQuantity = preparedExchanges.surplus[documentId] ?? 0;
    regularInventory[documentId] -= startingQuantity - remainingQuantity;
  }
  for (const [documentId, quantity] of Object.entries(preparedExchanges.received)) regularInventory[documentId] = (regularInventory[documentId] ?? 0) + quantity;

  let classifiedAvailable = input.classifiedDocuments;
  let purchased = 0;
  let purchasedUsed = 0;
  let grossSpent = 0;
  let startingBalance = input.tarCoins;
  let earnedBalance = 0;
  let startingUsed = 0;
  let earnedUsed = 0;
  let additional = 0;
  let earnedAwarded = 0;
  const bundleCounts = input.catalogs.optimizerRules.classifiedDocuments.bundles.map(() => 0);
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));
  for (const rewardId of sequence) {
    const reward = rewardsById.get(rewardId);
    if (!reward) continue;
    let missing = 0;
    for (const requirement of reward.requirements) {
      const available = regularInventory[requirement.documentId] ?? 0;
      const consumed = Math.min(available, requirement.quantity);
      regularInventory[requirement.documentId] = available - consumed;
      missing += requirement.quantity - consumed;
    }
    const fromOwnedClassified = Math.min(classifiedAvailable, missing);
    classifiedAvailable -= fromOwnedClassified;
    missing -= fromOwnedClassified;
    if (missing > 0) {
      const selection = chooseBundlesForDocuments(missing, input.catalogs.optimizerRules.classifiedDocuments.bundles);
      if (!selection) continue;
      selection.counts.forEach((count, index) => { bundleCounts[index] += count; });
      purchased += selection.totalDocuments;
      classifiedAvailable += selection.totalDocuments;
      const spend = selection.totalTarCoins;
      grossSpent += spend;
      const fromStarting = Math.min(startingBalance, spend);
      startingBalance -= fromStarting;
      startingUsed += fromStarting;
      const afterStarting = spend - fromStarting;
      const fromEarned = Math.min(earnedBalance, afterStarting);
      earnedBalance -= fromEarned;
      earnedUsed += fromEarned;
      additional += afterStarting - fromEarned;
      const purchasedClassified = Math.min(classifiedAvailable, missing);
      classifiedAvailable -= purchasedClassified;
      purchasedUsed += purchasedClassified;
      missing -= purchasedClassified;
    }
    if (reward.tarCoinsAwarded) {
      earnedBalance += reward.tarCoinsAwarded;
      earnedAwarded += reward.tarCoinsAwarded;
    }
  }
  const localEstimate = estimateLocalTarCoins(additional, input.catalogs, input.locale ?? input.catalogs.localization.defaultLocale);
  return {
    bundleCounts,
    classifiedDocumentsPurchased: purchased,
    classifiedDocumentsUsed: purchasedUsed,
    excessClassifiedDocuments: purchased - purchasedUsed,
    grossTarCoinsSpent: grossSpent,
    startingTarCoinsUsed: startingUsed,
    earnedTarCoinsAwarded: earnedAwarded,
    earnedTarCoinsUsed: earnedUsed,
    minimumAdditionalTarCoins: additional,
    ...(localEstimate ? { localEstimate } : {}),
  };
}

function prepareGlobalExchanges(
  deficits: Readonly<Record<string, number>>,
  surplus: Readonly<Record<string, number>>,
  ratio: number,
): { received: Readonly<Record<string, number>>; surplus: Readonly<Record<string, number>> } {
  const remainingDeficits = { ...deficits };
  const remainingSurplus = { ...surplus };
  const received: Record<string, number> = {};
  while (sumValues(remainingSurplus) >= ratio) {
    const recipient = Object.keys(remainingDeficits).sort().find((documentId) => remainingDeficits[documentId] > 0);
    if (!recipient) break;
    const donors = takeSurplus(remainingSurplus, ratio);
    if (sumValues(donors) !== ratio) break;
    remainingDeficits[recipient] -= 1;
    received[recipient] = (received[recipient] ?? 0) + 1;
    for (const [documentId, quantity] of Object.entries(donors)) remainingSurplus[documentId] -= quantity;
  }
  return { received: sortRecord(received), surplus: sortRecord(remainingSurplus) };
}

function estimateLocalTarCoins(required: number, catalogs: Catalogs, locale: string): LocalTarCoinEstimate | undefined {
  if (required <= 0) return { packageCounts: catalogs.optimizerRules.tarCoinBundles.map(() => 0), tarCoinsPurchased: 0, excessTarCoins: 0, costMinor: 0, currency: '', display: '0' };
  const prices = new Map(catalogs.localization.priceEntries.map((entry) => [entry.id, entry.localizations[locale]]));
  const currencies = new Set(catalogs.optimizerRules.tarCoinBundles.map((bundle) => prices.get(bundle.localPriceId)?.currency).filter((currency): currency is string => Boolean(currency)));
  let best: { estimate: LocalTarCoinEstimate; state: BundleState } | undefined;
  for (const currency of currencies) {
    const bundles = catalogs.optimizerRules.tarCoinBundles.map((bundle, index) => ({ bundle, index, price: prices.get(bundle.localPriceId)! })).filter((entry) => entry.price.currency === currency);
    const selection = choosePricedPackages(required, bundles.map((entry) => ({
      classifiedDocuments: entry.bundle.tarCoins,
      tarCoins: entry.price.amountMinor,
      bonusTarCoins: 0,
    })));
    if (!selection) continue;
    const packageCounts = catalogs.optimizerRules.tarCoinBundles.map(() => 0);
    bundles.forEach((entry, index) => { packageCounts[entry.index] = selection.counts[index]; });
    const estimate: LocalTarCoinEstimate = {
      packageCounts,
      tarCoinsPurchased: selection.totalDocuments,
      excessTarCoins: selection.totalDocuments - required,
      costMinor: selection.totalTarCoins,
      currency,
      display: new Intl.NumberFormat(locale, { style: 'currency', currency }).format(selection.totalTarCoins / 100),
    };
    if (!best || estimate.costMinor < best.estimate.costMinor || (estimate.costMinor === best.estimate.costMinor && estimate.excessTarCoins < best.estimate.excessTarCoins)) best = { estimate, state: selection as BundleState };
  }
  return best?.estimate;
}

function choosePricedPackages(target: number, bundles: readonly ClassifiedBundle[]): BundleSelection | undefined {
  return chooseBundlesForDocuments(target, bundles);
}

function subtract(left: Readonly<Record<string, number>>, right: Readonly<Record<string, number>>): Record<string, number> {
  return sortRecord(Object.fromEntries(Object.entries(left).map(([id, quantity]) => [id, Math.max(0, quantity - (right[id] ?? 0))] as const).filter(([, quantity]) => quantity > 0)));
}

function sumValues(values: Readonly<Record<string, number>>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function sortRecord(values: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter(([, quantity]) => quantity > 0).sort(([left], [right]) => left.localeCompare(right)));
}

function locationIds(route: RouteResult): string {
  return route.locations.map((location) => location.locationId).join('|');
}

function sameAssignment(left: ProfileResult, right: ProfileResult): boolean {
  return JSON.stringify(left.route.locations) === JSON.stringify(right.route.locations)
    && JSON.stringify(left.route.deficits) === JSON.stringify(right.route.deficits);
}

function emptyPurchase(bundleCount: number): ClassifiedPurchasePlan {
  return { bundleCounts: Array.from({ length: bundleCount }, () => 0), tarCoinsSpent: 0, startingTarCoinsUsed: 0, earnedTarCoinsUsed: 0, classifiedDocumentsPurchased: 0, classifiedDocumentsUsed: 0, excessClassifiedDocuments: 0 };
}

function emptyBuyout(bundleCount: number, packageCount: number): BuyoutEstimate {
  return {
    bundleCounts: Array.from({ length: bundleCount }, () => 0),
    classifiedDocumentsPurchased: 0,
    classifiedDocumentsUsed: 0,
    excessClassifiedDocuments: 0,
    grossTarCoinsSpent: 0,
    startingTarCoinsUsed: 0,
    earnedTarCoinsAwarded: 0,
    earnedTarCoinsUsed: 0,
    minimumAdditionalTarCoins: 0,
    localEstimate: estimateZeroLocalTarCoins(packageCount),
  };
}

function estimateZeroLocalTarCoins(packageCount: number): LocalTarCoinEstimate {
  return { packageCounts: Array.from({ length: packageCount }, () => 0), tarCoinsPurchased: 0, excessTarCoins: 0, costMinor: 0, currency: '', display: '0' };
}

export function documentBehavior(kind: DocumentKind): { farmable: boolean; exchangeable: boolean; classifiedBackfillEligible: boolean } {
  return kind === 'regular'
    ? { farmable: true, exchangeable: true, classifiedBackfillEligible: true }
    : { farmable: false, exchangeable: false, classifiedBackfillEligible: false };
}
