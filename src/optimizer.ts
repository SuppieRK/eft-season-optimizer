import type {
  BattlePassPage,
  Catalogs,
  ClassifiedBundle,
  DocumentKind,
  GameMode,
  LocationRecord,
  RewardRecord,
} from './catalogs';
import { countUnlockedPages } from './page-unlocks';

export type OptimizationProfile = 'fastest' | 'safest';

export interface OptimizerInput {
  readonly catalogs: Catalogs;
  readonly claimedRewardIds: readonly string[];
  readonly ownedDocuments: Readonly<Record<string, number>>;
  readonly classifiedDocuments: number;
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
  readonly insurance: boolean;
  readonly documents: readonly DocumentAssignment[];
}

export interface ExchangePlan {
  readonly receivedDocumentId: string;
  readonly donors: Readonly<Record<string, number>>;
}

export interface LocalTarCoinEstimate {
  readonly packageCounts: readonly number[];
  readonly tarCoinsPurchased: number;
  readonly excessTarCoins: number;
  readonly price: number;
  readonly currency: string;
}

export interface BuyoutEstimate {
  readonly bundleCounts: readonly number[];
  readonly grossTarCoinsSpent: number;
  readonly earnedTarCoinsAwarded: number;
  readonly earnedTarCoinsUsed: number;
  readonly minimumAdditionalTarCoins: number;
  readonly localEstimate?: LocalTarCoinEstimate;
  readonly keepBattlePassTarCoinsLocalEstimate?: LocalTarCoinEstimate;
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

export interface NextRaidDocument {
  readonly documentId: string;
  readonly role: 'priority' | 'optional' | 'stockpile';
  readonly targetQuantity: number;
}

export interface NextRaidRecommendation {
  readonly purpose: 'battle-pass' | 'crate-stockpile';
  readonly locationId: string;
  readonly difficultyId: LocationRecord['difficultyId'];
  readonly difficultyRating: number;
  readonly maxRaidTimeMin: number;
  readonly insurance: boolean;
  readonly documents: readonly NextRaidDocument[];
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
  readonly redemptionSequence: readonly string[];
  readonly route: RouteResult;
  readonly classifiedAllocation: Readonly<Record<string, number>>;
  readonly classifiedConsumed: number;
  readonly classifiedRemaining: number;
  readonly exchanges: readonly ExchangePlan[];
  readonly remainingSurplus: Readonly<Record<string, number>>;
  readonly projectedImmediateRewardIds: readonly string[];
  readonly nextRaid?: NextRaidRecommendation;
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
  readonly locationsWithoutInsurance: number;
  readonly totalRaidTimeMin: number;
}

interface BundleSelection {
  readonly counts: readonly number[];
  readonly totalDocuments: number;
  readonly totalTarCoins: number;
}

interface BundleState extends BundleSelection {
  readonly count: number;
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
  const redemptionSequence = profiles.safest.redemptionSequence;
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
  if (input.crateCount !== undefined && (!Number.isInteger(input.crateCount) || input.crateCount < 1)) throw new RangeError('Crate count must be a positive integer');
  for (const [documentId, quantity] of Object.entries(input.ownedDocuments)) {
    if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError(`Owned quantity for ${documentId} must be a non-negative integer`);
  }
}

function orderedRewards(pages: readonly BattlePassPage[]): readonly RewardRecord[] {
  return pages.flatMap((page) => page.rewards);
}

function claimedBattlePassTarCoins(input: OptimizerInput): number {
  const claimed = new Set(input.claimedRewardIds);
  return orderedRewards(input.catalogs.battlePass.pages).reduce(
    (total, reward) => total + (claimed.has(reward.id) ? reward.tarCoinsAwarded ?? 0 : 0),
    0,
  );
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
  const allocation = allocateClassifiedForProgression(
    initialDeficits,
    classifiedToConsume,
    profile,
    input.catalogs,
    input.catalogs.battlePass.pages,
    input.claimedRewardIds,
  );
  const afterClassified = subtract(initialDeficits, allocation);
  const exchanges = applyExchanges(afterClassified, surplus, profile, input.catalogs);
  const route = routeForDeficits(exchanges.deficits, profile, input.catalogs);
  const redemptionSequence = pageTwelveFirstSequence(
    input.catalogs.battlePass.pages,
    input.claimedRewardIds,
    route,
    profile,
    input.catalogs,
  );
  const progression = scheduleProgressiveRoute(
    route,
    input.catalogs.battlePass.pages,
    input.claimedRewardIds,
    input.catalogs.optimizerRules.dailyDocumentLimits[input.mode],
    profile,
    redemptionSequence,
  );
  return {
    profile,
    redemptionSequence,
    route,
    classifiedAllocation: allocation,
    classifiedConsumed: sumValues(allocation),
    classifiedRemaining: input.classifiedDocuments - sumValues(allocation),
    exchanges: exchanges.plans,
    remainingSurplus: exchanges.surplus,
    projectedImmediateRewardIds: progression.projectedImmediateRewardIds,
    nextRaid: route.available
      ? buildNextRaidRecommendation(progression.days[0]?.locations[0], input.catalogs)
        ?? buildStockpileRaidRecommendation(profile, input.catalogs)
      : undefined,
    schedule: progression.days,
    warnings: route.available ? [] : [route.reason ?? 'Route unavailable'],
  };
}

function allocateClassifiedForProgression(
  deficits: Readonly<Record<string, number>>,
  quantity: number,
  profile: OptimizationProfile,
  catalogs: Catalogs,
  pages: readonly BattlePassPage[],
  claimedRewardIds: readonly string[],
): Readonly<Record<string, number>> {
  const target = Math.min(quantity, sumValues(deficits));
  if (target === 0) return {};
  const baseRoute = routeForDeficits(deficits, profile, catalogs);
  const sequence = greedyPageTwelveSequence(pages, claimedRewardIds, baseRoute, profile, catalogs);
  const rewards = new Map(orderedRewards(pages).map((reward) => [reward.id, reward]));
  const remainingDeficits = { ...deficits };
  const allocation: Record<string, number> = {};
  let remaining = target;
  for (const rewardId of sequence) {
    const reward = rewards.get(rewardId);
    if (!reward) continue;
    const requirements = [...reward.requirements].sort((left, right) =>
      bestSourceFactor(right.documentId, profile, catalogs) - bestSourceFactor(left.documentId, profile, catalogs)
      || left.documentId.localeCompare(right.documentId));
    for (const requirement of requirements) {
      const availableDeficit = Math.min(requirement.quantity, remainingDeficits[requirement.documentId] ?? 0);
      const used = Math.min(availableDeficit, remaining);
      if (used <= 0) continue;
      allocation[requirement.documentId] = (allocation[requirement.documentId] ?? 0) + used;
      remainingDeficits[requirement.documentId] -= used;
      remaining -= used;
      if (remaining === 0) return sortRecord(allocation);
    }
  }
  if (remaining > 0) {
    const fallback = greedyClassified(remainingDeficits, remaining, profile, catalogs);
    for (const [documentId, used] of Object.entries(fallback)) {
      allocation[documentId] = (allocation[documentId] ?? 0) + used;
    }
  }
  return sortRecord(allocation);
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

function routeForDeficits(
  deficits: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): RouteCandidate {
  const positiveDeficits = sortRecord(Object.fromEntries(Object.entries(deficits).filter(([, quantity]) => quantity > 0)));
  const rawDocumentQuantity = sumValues(positiveDeficits);
  if (rawDocumentQuantity === 0) return {
    available: true,
    locations: [],
    profileCost: 0,
    rawDocumentQuantity: 0,
    deficits: {},
    locationIds: [],
    locationsWithoutInsurance: 0,
    totalRaidTimeMin: 0,
  };
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
        .sort((left, right) => compareSourceLocations(left, right, profile))[0];
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
    const routeLocations = [...byLocation.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([locationId, documentsAtLocation]) => {
      const location = locations.find((candidate) => candidate.id === locationId)!;
      return {
        locationId,
        difficultyId: location.difficultyId,
        difficultyRating: location.difficultyRating,
        maxRaidTimeMin: location.maxRaidTimeMin,
        insurance: location.insurance,
        documents: documentsAtLocation.sort((left, right) => left.documentId.localeCompare(right.documentId)),
      };
    });
    const route: RouteCandidate = {
      available: true,
      locations: routeLocations,
      profileCost: cost,
      rawDocumentQuantity,
      deficits: positiveDeficits,
      locationIds: [...byLocation.keys()].sort(),
      locationsWithoutInsurance: routeLocations.filter((location) => !location.insurance).length,
      totalRaidTimeMin: routeLocations.reduce((total, location) => total + location.maxRaidTimeMin, 0),
    };
    if (!best || compareRoutes(route, best, profile) < 0) best = route;
  }
  return best ?? {
    available: false,
    reason: `No eligible source locations cover ${Object.keys(positiveDeficits).join(', ')}`,
    locations: [],
    profileCost: Number.POSITIVE_INFINITY,
    rawDocumentQuantity,
    deficits: positiveDeficits,
    locationIds: [],
    locationsWithoutInsurance: Number.POSITIVE_INFINITY,
    totalRaidTimeMin: Number.POSITIVE_INFINITY,
  };
}

const PROGRESSION_BEAM_WIDTH = 16;

interface ProgressionSequenceState {
  readonly claimed: ReadonlySet<string>;
  readonly sequence: readonly string[];
  readonly requirements: Readonly<Record<string, number>>;
}

function greedyPageTwelveSequence(
  pages: readonly BattlePassPage[],
  initialClaimedRewardIds: readonly string[],
  route: RouteResult,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): readonly string[] {
  const initiallyClaimed = new Set(initialClaimedRewardIds);
  const unclaimed = orderedRewards(pages).filter((reward) => !initiallyClaimed.has(reward.id));
  const totalRequirements = aggregateRequirements(unclaimed);
  const available = Object.fromEntries(
    Object.entries(totalRequirements).map(([documentId, quantity]) => [
      documentId,
      Math.max(0, quantity - (route.deficits[documentId] ?? 0)),
    ]),
  );
  let state: ProgressionSequenceState = { claimed: initiallyClaimed, sequence: [], requirements: {} };
  while (countUnlockedPages(pages, state.claimed) < pages.length) {
    const unlocked = countUnlockedPages(pages, state.claimed);
    const frontier = pages[unlocked - 1];
    const claimedOnFrontier = frontier.rewards.filter((reward) => state.claimed.has(reward.id)).length;
    const claimsNeeded = Math.max(0, frontier.rewards.length - 1 - claimedOnFrontier);
    const candidates = frontier.rewards.filter((reward) => !state.claimed.has(reward.id));
    const expanded = rewardCombinations(candidates, claimsNeeded).map((combination) => {
      const claimed = new Set(state.claimed);
      let requirements = state.requirements;
      const orderedCombination = [...combination].sort((left, right) =>
        compareCleanupRewards(left, right, requirements, available, profile, catalogs));
      for (const reward of orderedCombination) {
        claimed.add(reward.id);
        requirements = addRequirements(requirements, reward);
      }
      return {
        claimed,
        sequence: [...state.sequence, ...orderedCombination.map((reward) => reward.id)],
        requirements,
      };
    });
    const next = rankProgressionStates(expanded, pages, available, profile, catalogs)[0];
    if (!next) break;
    state = next;
  }
  return state.sequence;
}

function pageTwelveFirstSequence(
  pages: readonly BattlePassPage[],
  initialClaimedRewardIds: readonly string[],
  route: RouteResult,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): readonly string[] {
  if (pages.length === 0) return [];
  const initiallyClaimed = new Set(initialClaimedRewardIds);
  const unclaimed = orderedRewards(pages).filter((reward) => !initiallyClaimed.has(reward.id));
  if (unclaimed.length === 0) return [];
  const totalRequirements = aggregateRequirements(unclaimed);
  const available = Object.fromEntries(
    Object.entries(totalRequirements).map(([documentId, quantity]) => [
      documentId,
      Math.max(0, quantity - (route.deficits[documentId] ?? 0)),
    ]),
  );
  let beam: readonly ProgressionSequenceState[] = [{ claimed: initiallyClaimed, sequence: [], requirements: {} }];
  while (beam.some((state) => countUnlockedPages(pages, state.claimed) < pages.length)) {
    const expanded = new Map<string, ProgressionSequenceState>();
    for (const state of beam) {
      const unlocked = countUnlockedPages(pages, state.claimed);
      if (unlocked >= pages.length) {
        expanded.set(sequenceStateKey(state), state);
        continue;
      }
      const frontier = pages[unlocked - 1];
      const claimedOnFrontier = frontier.rewards.filter((reward) => state.claimed.has(reward.id)).length;
      const claimsNeeded = Math.max(0, frontier.rewards.length - 1 - claimedOnFrontier);
      const candidates = frontier.rewards.filter((reward) => !state.claimed.has(reward.id));
      for (const combination of rewardCombinations(candidates, claimsNeeded)) {
        const claimed = new Set(state.claimed);
        let requirements = state.requirements;
        const orderedCombination = [...combination].sort((left, right) =>
          compareCleanupRewards(left, right, requirements, available, profile, catalogs));
        for (const reward of orderedCombination) {
          claimed.add(reward.id);
          requirements = addRequirements(requirements, reward);
        }
        const next: ProgressionSequenceState = {
          claimed,
          sequence: [...state.sequence, ...orderedCombination.map((reward) => reward.id)],
          requirements,
        };
        const key = sequenceStateKey(next);
        const previous = expanded.get(key);
        if (!previous || next.sequence.join('|').localeCompare(previous.sequence.join('|')) < 0) {
          expanded.set(key, next);
        }
      }
    }
    const nextBeam = rankProgressionStates([...expanded.values()], pages, available, profile, catalogs)
      .slice(0, PROGRESSION_BEAM_WIDTH);
    if (nextBeam.length === 0) break;
    beam = nextBeam;
  }
  const best = rankProgressionStates([...beam], pages, available, profile, catalogs)[0]
    ?? { claimed: initiallyClaimed, sequence: [], requirements: {} };
  const claimed = new Set(best.claimed);
  const sequence = [...best.sequence];
  const accumulated = { ...best.requirements };
  while (claimed.size < initiallyClaimed.size + unclaimed.length) {
    const legalCandidates = progressionCandidates(pages, claimed);
    const finalPageIds = new Set(pages[pages.length - 1].rewards.map((reward) => reward.id));
    const finalPageCandidates = legalCandidates.filter((reward) => finalPageIds.has(reward.id));
    const candidates = finalPageCandidates.length > 0 ? finalPageCandidates : legalCandidates;
    const reward = [...candidates]
      .sort((left, right) => compareCleanupRewards(left, right, accumulated, available, profile, catalogs))[0];
    if (!reward) break;
    claimed.add(reward.id);
    sequence.push(reward.id);
    Object.assign(accumulated, addRequirements(accumulated, reward));
  }
  return sequence;
}

function rewardCombinations(
  rewards: readonly RewardRecord[],
  count: number,
): readonly (readonly RewardRecord[])[] {
  if (count <= 0) return [[]];
  if (count > rewards.length) return [];
  const combinations: RewardRecord[][] = [];
  const visit = (start: number, selected: RewardRecord[]): void => {
    if (selected.length === count) {
      combinations.push([...selected]);
      return;
    }
    for (let index = start; index <= rewards.length - (count - selected.length); index += 1) {
      selected.push(rewards[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return combinations;
}

function sequenceStateKey(state: ProgressionSequenceState): string {
  return [...state.claimed].sort().join('|');
}

function addRequirements(
  requirements: Readonly<Record<string, number>>,
  reward: RewardRecord,
): Readonly<Record<string, number>> {
  const next = { ...requirements };
  for (const requirement of reward.requirements) {
    next[requirement.documentId] = (next[requirement.documentId] ?? 0) + requirement.quantity;
  }
  return next;
}

function progressionWork(
  requirements: Readonly<Record<string, number>>,
  available: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): { readonly cost: number; readonly locations: number; readonly quantity: number } {
  let cost = 0;
  let quantity = 0;
  const locations = new Set<string>();
  for (const [documentId, required] of Object.entries(requirements)) {
    const missing = Math.max(0, required - (available[documentId] ?? 0));
    if (missing === 0) continue;
    quantity += missing;
    cost += missing * bestSourceFactor(documentId, profile, catalogs);
    const source = bestSource(documentId, profile, catalogs);
    if (source) locations.add(source.id);
  }
  return { cost, locations: locations.size, quantity };
}

function rankProgressionStates(
  states: readonly ProgressionSequenceState[],
  pages: readonly BattlePassPage[],
  available: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): readonly ProgressionSequenceState[] {
  return states.map((state) => ({
    state,
    unlockedPages: countUnlockedPages(pages, state.claimed),
    work: progressionWork(state.requirements, available, profile, catalogs),
    stableOrder: state.sequence.join('|'),
  })).sort((left, right) => right.unlockedPages - left.unlockedPages
    || left.work.cost - right.work.cost
    || left.work.locations - right.work.locations
    || left.work.quantity - right.work.quantity
    || left.stableOrder.localeCompare(right.stableOrder))
    .map(({ state }) => state);
}

function compareCleanupRewards(
  left: RewardRecord,
  right: RewardRecord,
  accumulated: Readonly<Record<string, number>>,
  available: Readonly<Record<string, number>>,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): number {
  const current = progressionWork(accumulated, available, profile, catalogs);
  const leftWork = progressionWork(addRequirements(accumulated, left), available, profile, catalogs);
  const rightWork = progressionWork(addRequirements(accumulated, right), available, profile, catalogs);
  return (leftWork.cost - current.cost) - (rightWork.cost - current.cost)
    || leftWork.locations - rightWork.locations
    || sumRequirements(left) - sumRequirements(right)
    || left.id.localeCompare(right.id);
}

function bestSource(
  documentId: string,
  profile: OptimizationProfile,
  catalogs: Catalogs,
): LocationRecord | undefined {
  const document = catalogs.documents.documents.find((candidate) => candidate.id === documentId);
  return document?.sourceLocationIds
    .map((locationId) => catalogs.locations.locations.find((location) => location.id === locationId))
    .filter((location): location is LocationRecord => Boolean(location))
    .sort((left, right) => compareSourceLocations(left, right, profile))[0];
}

function buildNextRaidRecommendation(
  location: LocationAssignment | undefined,
  catalogs: Catalogs,
): NextRaidRecommendation | undefined {
  if (!location) return undefined;
  const assignments = new Map(location.documents.map((document) => [document.documentId, document.quantity]));
  const priorityDocumentId = location.documents[0]?.documentId;
  const documents = catalogs.documents.documents
    .filter((document) => document.kind === 'regular' && document.sourceLocationIds.includes(location.locationId))
    .map((document) => ({
      documentId: document.id,
      role: document.id === priorityDocumentId ? 'priority' as const : 'optional' as const,
      targetQuantity: document.id === priorityDocumentId ? assignments.get(document.id) ?? 0 : 0,
    }));
  return {
    purpose: 'battle-pass',
    locationId: location.locationId,
    difficultyId: location.difficultyId,
    difficultyRating: location.difficultyRating,
    maxRaidTimeMin: location.maxRaidTimeMin,
    insurance: location.insurance,
    documents,
  };
}

function buildStockpileRaidRecommendation(
  profile: OptimizationProfile,
  catalogs: Catalogs,
): NextRaidRecommendation | undefined {
  const primaryFactor = PROFILE_FACTORS[profile];
  const regularDocuments = catalogs.documents.documents.filter((document) => document.kind === 'regular');
  const location = catalogs.locations.locations
    .filter((candidate) => regularDocuments.some((document) => document.sourceLocationIds.includes(candidate.id)))
    .sort((left, right) => profile === 'safest'
      ? compareSourceLocations(left, right, profile)
      : Number(left[primaryFactor]) - Number(right[primaryFactor])
        || left.difficultyRating - right.difficultyRating
        || left.id.localeCompare(right.id))[0];
  if (!location) return undefined;
  return {
    purpose: 'crate-stockpile',
    locationId: location.id,
    difficultyId: location.difficultyId,
    difficultyRating: location.difficultyRating,
    maxRaidTimeMin: location.maxRaidTimeMin,
    insurance: location.insurance,
    documents: regularDocuments
      .filter((document) => document.sourceLocationIds.includes(location.id))
      .map((document) => ({ documentId: document.id, role: 'stockpile', targetQuantity: 0 })),
  };
}

function scheduleProgressiveRoute(
  route: RouteResult,
  pages: readonly BattlePassPage[],
  initialClaimedRewardIds: readonly string[],
  dailyLimit: number,
  profile: OptimizationProfile,
  redemptionSequence: readonly string[],
): { projectedImmediateRewardIds: readonly string[]; days: readonly ScheduleDay[] } {
  if (!route.available) return { projectedImmediateRewardIds: [], days: [] };
  const unclaimedRewards = orderedRewards(pages).filter((reward) => !initialClaimedRewardIds.includes(reward.id));
  const totalRequirements = aggregateRequirements(unclaimedRewards);
  const farmRemaining = { ...route.deficits };
  const available = Object.fromEntries(Object.entries(totalRequirements).map(([documentId, quantity]) => [documentId, quantity - (farmRemaining[documentId] ?? 0)]));
  const claimed = new Set(initialClaimedRewardIds);
  const projectedImmediateRewardIds: string[] = [];
  claimAvailableRewards(pages, claimed, available, projectedImmediateRewardIds, redemptionSequence);

  const sources = new Map<string, LocationAssignment>();
  for (const location of route.locations) for (const document of location.documents) sources.set(document.documentId, location);
  const days: ScheduleDay[] = [];
  while (sumValues(farmRemaining) > 0) {
    const locations: LocationAssignment[] = [];
    const rewardIdsClaimed: string[] = [];
    const unlockedBefore = countUnlockedPages(pages, claimed);
    let documentQuantity = 0;
    while (documentQuantity < dailyLimit) {
      claimAvailableRewards(pages, claimed, available, rewardIdsClaimed, redemptionSequence);
      const target = selectProgressionTarget(pages, claimed, available, farmRemaining, sources, profile, redemptionSequence);
      if (!target) break;
      const missing = missingRequirements(target, available);
      const documentIds = Object.keys(missing).sort((left, right) => {
        const leftSource = sources.get(left);
        const rightSource = sources.get(right);
        return Number(leftSource?.[PROFILE_FACTORS[profile]] ?? Number.POSITIVE_INFINITY)
          - Number(rightSource?.[PROFILE_FACTORS[profile]] ?? Number.POSITIVE_INFINITY)
          || (leftSource?.locationId ?? '').localeCompare(rightSource?.locationId ?? '')
          || left.localeCompare(right);
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
    claimAvailableRewards(pages, claimed, available, rewardIdsClaimed, redemptionSequence);
    if (documentQuantity === 0) break;
    const unlockedAfter = countUnlockedPages(pages, claimed);
    days.push({
      day: days.length + 1,
      expanded: days.length === 0,
      documentQuantity,
      locations,
      rewardIdsClaimed,
      ...(unlockedAfter > unlockedBefore ? { unlockedPage: pages[unlockedAfter - 1].page } : {}),
    });
  }
  const trailingClaims: string[] = [];
  claimAvailableRewards(pages, claimed, available, trailingClaims, redemptionSequence);
  if (days.length > 0 && trailingClaims.length > 0) {
    const last = days[days.length - 1];
    days[days.length - 1] = { ...last, rewardIdsClaimed: [...last.rewardIdsClaimed, ...trailingClaims] };
  } else {
    projectedImmediateRewardIds.push(...trailingClaims);
  }
  return { projectedImmediateRewardIds, days };
}

function progressionCandidates(pages: readonly BattlePassPage[], claimed: ReadonlySet<string>): readonly RewardRecord[] {
  const unlocked = countUnlockedPages(pages, claimed);
  const frontier = pages[unlocked - 1];
  if (unlocked < pages.length) return frontier.rewards.filter((reward) => !claimed.has(reward.id));
  return pages.slice(0, unlocked).flatMap((page) => page.rewards.filter((reward) => !claimed.has(reward.id)));
}

function claimAvailableRewards(
  pages: readonly BattlePassPage[],
  claimed: Set<string>,
  available: Record<string, number>,
  output: string[],
  redemptionSequence: readonly string[],
): void {
  const sequenceOrder = new Map(redemptionSequence.map((rewardId, index) => [rewardId, index]));
  while (true) {
    const reward = progressionCandidates(pages, claimed)
      .filter((candidate) => candidate.requirements.every((requirement) => (available[requirement.documentId] ?? 0) >= requirement.quantity))
      .sort((left, right) => (sequenceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sequenceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        || sumRequirements(left) - sumRequirements(right)
        || left.id.localeCompare(right.id))[0];
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
  redemptionSequence: readonly string[],
): RewardRecord | undefined {
  const sequenceOrder = new Map(redemptionSequence.map((rewardId, index) => [rewardId, index]));
  return progressionCandidates(pages, claimed)
    .filter((reward) => {
      const missing = missingRequirements(reward, available);
      return Object.entries(missing).every(([documentId, quantity]) => quantity <= (farmRemaining[documentId] ?? 0) && sources.has(documentId));
    })
    .sort((left, right) => (sequenceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sequenceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      || compareProgressionTargets(left, right, available, sources, profile))[0];
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
  const profiles = (['fastest', 'safest'] as const).reduce((result, profile) => {
    const nextRaid = buildStockpileRaidRecommendation(profile, input.catalogs);
    const farmingLocation = nextRaid
      ? input.catalogs.locations.locations.find((location) => location.id === nextRaid.locationId)
      : undefined;
    const farmingDocument = farmingLocation
      ? regularDocuments.find((document) => document.sourceLocationIds.includes(farmingLocation.id))
      : undefined;
    const deficits = farmingDocument && farmingLocation && regularDocumentsToFarm > 0
      ? { [farmingDocument.id]: regularDocumentsToFarm }
      : {};
    const route = farmingLocation && farmingDocument
      ? regularDocumentsToFarm > 0 ? {
          available: true,
          locations: [{
            locationId: farmingLocation.id,
            difficultyId: farmingLocation.difficultyId,
            difficultyRating: farmingLocation.difficultyRating,
            maxRaidTimeMin: farmingLocation.maxRaidTimeMin,
            insurance: farmingLocation.insurance,
            documents: [{ documentId: farmingDocument.id, quantity: regularDocumentsToFarm }],
          }],
          profileCost: regularDocumentsToFarm * Number(farmingLocation[PROFILE_FACTORS[profile]]),
          rawDocumentQuantity: regularDocumentsToFarm,
          deficits,
        } : { available: true, locations: [], profileCost: 0, rawDocumentQuantity: 0, deficits: {} }
      : { available: false, reason: 'No regular-document source location is available for Black Division crates', locations: [], profileCost: Number.POSITIVE_INFINITY, rawDocumentQuantity: regularDocumentsToFarm, deficits };
    const schedule = scheduleRoute(route, effectiveDailyLimit);
    result[profile] = {
      profile,
      redemptionSequence: [],
      route,
      classifiedAllocation: {},
      classifiedConsumed: 0,
      classifiedRemaining: input.classifiedDocuments,
      exchanges: [],
      remainingSurplus: {},
      projectedImmediateRewardIds: [],
      nextRaid,
      schedule,
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
    profilesCoincide: sameAssignment(profiles.fastest, profiles.safest),
    buyout: emptyBuyout(input.catalogs.optimizerRules.classifiedDocuments.bundles.length, input.catalogs.optimizerRules.tarCoinBundles.length),
    cratePlan: {
      crateCount,
      regularDocumentsRequired,
      regularDocumentsOwned,
      regularDocumentsToFarm,
      ...(profiles.fastest.nextRaid ? { farmingLocationId: profiles.fastest.nextRaid.locationId } : {}),
    },
  };
}

function compareRoutes(left: RouteCandidate, right: RouteCandidate, profile: OptimizationProfile): number {
  if (left.available !== right.available) return left.available ? -1 : 1;
  if (left.profileCost !== right.profileCost) return left.profileCost - right.profileCost;
  if (profile === 'safest' && left.locationsWithoutInsurance !== right.locationsWithoutInsurance) {
    return left.locationsWithoutInsurance - right.locationsWithoutInsurance;
  }
  if (profile === 'safest' && left.totalRaidTimeMin !== right.totalRaidTimeMin) {
    return left.totalRaidTimeMin - right.totalRaidTimeMin;
  }
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

function compareSourceLocations(left: LocationRecord, right: LocationRecord, profile: OptimizationProfile): number {
  const primaryDifference = Number(left[PROFILE_FACTORS[profile]]) - Number(right[PROFILE_FACTORS[profile]]);
  if (primaryDifference !== 0 || profile === 'fastest') return primaryDifference || left.id.localeCompare(right.id);
  if (left.insurance !== right.insurance) return left.insurance ? -1 : 1;
  return left.maxRaidTimeMin - right.maxRaidTimeMin || left.id.localeCompare(right.id);
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

function chooseBundlesForDocuments(target: number, bundles: readonly ClassifiedBundle[]): BundleSelection | undefined {
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

function chooseBundlesWithoutOverage(target: number, bundles: readonly ClassifiedBundle[]): BundleSelection {
  const counts = bundles.map(() => 0);
  let remaining = Math.max(0, target);
  let totalDocuments = 0;
  let totalTarCoins = 0;
  const bundleIndexes = bundles.map((_, index) => index).sort((leftIndex, rightIndex) => (
    bundles[rightIndex].classifiedDocuments - bundles[leftIndex].classifiedDocuments
      || bundles[leftIndex].tarCoins - bundles[rightIndex].tarCoins
      || leftIndex - rightIndex
  ));
  for (const bundleIndex of bundleIndexes) {
    const bundle = bundles[bundleIndex];
    const count = Math.floor(remaining / bundle.classifiedDocuments);
    if (count === 0) continue;
    counts[bundleIndex] = count;
    const documents = count * bundle.classifiedDocuments;
    totalDocuments += documents;
    totalTarCoins += count * bundle.tarCoins;
    remaining -= documents;
  }
  return { counts, totalDocuments, totalTarCoins };
}

function compareBundleStates(left: BundleState, right: BundleState): number {
  if (left.totalTarCoins !== right.totalTarCoins) return left.totalTarCoins - right.totalTarCoins;
  if (left.totalDocuments !== right.totalDocuments) return left.totalDocuments - right.totalDocuments;
  if (left.count !== right.count) return left.count - right.count;
  return left.counts.join(',').localeCompare(right.counts.join(','));
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

  const bundles = input.catalogs.optimizerRules.classifiedDocuments.bundles;
  const regularDeficit = Object.entries(requirements).reduce(
    (total, [documentId, quantity]) => total + Math.max(0, quantity - (regularInventory[documentId] ?? 0)),
    0,
  );
  const remainingDocuments = Math.max(0, regularDeficit - input.classifiedDocuments);
  const bundlePlan = chooseBundlesWithoutOverage(remainingDocuments, bundles);
  const plannedBundleIndexes = bundlePlan.counts.flatMap((count, bundleIndex) => (
    Array.from({ length: count }, () => bundleIndex)
  )).sort((leftIndex, rightIndex) => (
    bundles[leftIndex].classifiedDocuments - bundles[rightIndex].classifiedDocuments
      || bundles[leftIndex].tarCoins - bundles[rightIndex].tarCoins
      || leftIndex - rightIndex
  ));

  let classifiedAvailable = input.classifiedDocuments;
  let grossSpent = 0;
  let earnedBalance = claimedBattlePassTarCoins(input);
  let earnedUsed = 0;
  let additional = 0;
  let earnedAwarded = earnedBalance;
  const bundleCounts = bundles.map(() => 0);
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));
  const simulatedClaimed = new Set(input.claimedRewardIds);
  for (const rewardId of sequence) {
    const reward = rewardsById.get(rewardId);
    if (!reward || !progressionCandidates(input.catalogs.battlePass.pages, simulatedClaimed).some((candidate) => candidate.id === rewardId)) continue;
    let missing = 0;
    for (const requirement of reward.requirements) {
      const available = regularInventory[requirement.documentId] ?? 0;
      const consumed = Math.min(available, requirement.quantity);
      regularInventory[requirement.documentId] = available - consumed;
      missing += requirement.quantity - consumed;
    }
    const availableClassified = Math.min(classifiedAvailable, missing);
    classifiedAvailable -= availableClassified;
    missing -= availableClassified;
    if (missing > 0) {
      while (classifiedAvailable < missing && plannedBundleIndexes.length > 0) {
        const bundleIndex = plannedBundleIndexes.shift()!;
        const bundle = bundles[bundleIndex];
        bundleCounts[bundleIndex] += 1;
        classifiedAvailable += bundle.classifiedDocuments;
        grossSpent += bundle.tarCoins;
        const fromEarned = Math.min(earnedBalance, bundle.tarCoins);
        earnedBalance -= fromEarned;
        earnedUsed += fromEarned;
        additional += bundle.tarCoins - fromEarned;
      }
      classifiedAvailable = Math.max(0, classifiedAvailable - missing);
    }
    if (reward.tarCoinsAwarded) {
      earnedBalance += reward.tarCoinsAwarded;
      earnedAwarded += reward.tarCoinsAwarded;
    }
    simulatedClaimed.add(reward.id);
  }
  const locale = input.locale ?? input.catalogs.localization.defaultLocale;
  const localEstimate = estimateLocalTarCoins(additional, input.catalogs, locale);
  const keepBattlePassTarCoinsLocalEstimate = estimateLocalTarCoins(grossSpent, input.catalogs, locale);
  return {
    bundleCounts,
    grossTarCoinsSpent: grossSpent,
    earnedTarCoinsAwarded: earnedAwarded,
    earnedTarCoinsUsed: earnedUsed,
    minimumAdditionalTarCoins: additional,
    ...(localEstimate ? { localEstimate } : {}),
    ...(keepBattlePassTarCoinsLocalEstimate ? { keepBattlePassTarCoinsLocalEstimate } : {}),
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
  if (required <= 0) return { packageCounts: catalogs.optimizerRules.tarCoinBundles.map(() => 0), tarCoinsPurchased: 0, excessTarCoins: 0, price: 0, currency: '' };
  const prices = new Map(catalogs.localization.priceEntries.map((entry) => [entry.id, entry.localizations[locale]]));
  const currencies = new Set(catalogs.optimizerRules.tarCoinBundles.map((bundle) => prices.get(bundle.localPriceId)?.currency).filter((currency): currency is string => Boolean(currency)));
  let best: { estimate: LocalTarCoinEstimate; state: BundleState } | undefined;
  for (const currency of currencies) {
    const currencyScale = getCurrencyScale(currency);
    const bundles = catalogs.optimizerRules.tarCoinBundles.map((bundle, index) => ({ bundle, index, price: prices.get(bundle.localPriceId)! })).filter((entry) => entry.price.currency === currency);
    const selection = choosePricedPackages(required, bundles.map((entry) => ({
      classifiedDocuments: entry.bundle.tarCoins,
      tarCoins: Math.round(entry.price.price * currencyScale),
    })));
    if (!selection) continue;
    const packageCounts = catalogs.optimizerRules.tarCoinBundles.map(() => 0);
    bundles.forEach((entry, index) => { packageCounts[entry.index] = selection.counts[index]; });
    const estimate: LocalTarCoinEstimate = {
      packageCounts,
      tarCoinsPurchased: selection.totalDocuments,
      excessTarCoins: selection.totalDocuments - required,
      price: selection.totalTarCoins / currencyScale,
      currency,
    };
    if (!best || estimate.price < best.estimate.price || (estimate.price === best.estimate.price && estimate.excessTarCoins < best.estimate.excessTarCoins)) best = { estimate, state: selection as BundleState };
  }
  return best?.estimate;
}

function getCurrencyScale(currency: string): number {
  const fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
  return 10 ** fractionDigits;
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
    && JSON.stringify(left.route.deficits) === JSON.stringify(right.route.deficits)
    && JSON.stringify(left.nextRaid) === JSON.stringify(right.nextRaid);
}

function emptyBuyout(bundleCount: number, packageCount: number): BuyoutEstimate {
  return {
    bundleCounts: Array.from({ length: bundleCount }, () => 0),
    grossTarCoinsSpent: 0,
    earnedTarCoinsAwarded: 0,
    earnedTarCoinsUsed: 0,
    minimumAdditionalTarCoins: 0,
    localEstimate: estimateZeroLocalTarCoins(packageCount),
    keepBattlePassTarCoinsLocalEstimate: estimateZeroLocalTarCoins(packageCount),
  };
}

function estimateZeroLocalTarCoins(packageCount: number): LocalTarCoinEstimate {
  return { packageCounts: Array.from({ length: packageCount }, () => 0), tarCoinsPurchased: 0, excessTarCoins: 0, price: 0, currency: '' };
}

export function documentBehavior(kind: DocumentKind): { farmable: boolean; exchangeable: boolean; classifiedBackfillEligible: boolean } {
  return kind === 'regular'
    ? { farmable: true, exchangeable: true, classifiedBackfillEligible: true }
    : { farmable: false, exchangeable: false, classifiedBackfillEligible: false };
}
