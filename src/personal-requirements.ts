import type { Catalogs, Requirement } from './catalogs';

export type PersonalRequirements = Readonly<Record<string, readonly Requirement[]>>;

export function personalRequirementsKey(catalogs: Catalogs): string {
  return `eft-season-optimizer:requirements:${catalogs.battlePass.id}`;
}

export function validateRequirements(value: unknown, catalogs?: Catalogs): readonly Requirement[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('requirements.invalid');
  const types = new Set<string>();
  const regularIds = catalogs && new Set(catalogs.documents.documents.filter((entry) => entry.kind === 'regular').map((entry) => entry.id));
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('documentId' in entry) || !('quantity' in entry)
      || typeof entry.documentId !== 'string' || !entry.documentId
      || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0
      || types.has(entry.documentId)) throw new Error('requirements.invalid');
    if (regularIds && !regularIds.has(entry.documentId)) throw new Error('requirements.unknownDocument');
    types.add(entry.documentId);
    return { documentId: entry.documentId, quantity: entry.quantity };
  });
}

export function requirementSnapshot(catalogs: Catalogs): PersonalRequirements {
  return Object.fromEntries(catalogs.battlePass.pages.flatMap((page) => page.rewards.map((reward) =>
    [reward.id, reward.requirements.map((entry) => ({ ...entry }))])));
}

function sameRequirements(left: readonly Requirement[], right: readonly Requirement[]): boolean {
  return left.length === right.length && left.every((entry) => right.some((other) =>
    other.documentId === entry.documentId && other.quantity === entry.quantity));
}

export function normalizePersonalRequirements(
  value: PersonalRequirements,
  catalogs: Catalogs,
  preservedIds: ReadonlySet<string> = new Set(),
): PersonalRequirements {
  const defaults = requirementSnapshot(catalogs);
  return Object.fromEntries(Object.entries(value).flatMap(([id, entries]) => {
    if (!Object.hasOwn(defaults, id)) throw new Error('requirements.invalid');
    const valid = validateRequirements(entries, catalogs);
    return !preservedIds.has(id) && sameRequirements(valid, defaults[id]) ? [] : [[id, valid]];
  }));
}

export function resolvePersonalCatalogs(catalogs: Catalogs, overrides: PersonalRequirements): Catalogs {
  return {
    ...catalogs,
    battlePass: {
      ...catalogs.battlePass,
      pages: catalogs.battlePass.pages.map((page) => ({
        ...page,
        rewards: page.rewards.map((reward) => ({
          ...reward,
          requirements: Object.hasOwn(overrides, reward.id) ? overrides[reward.id] : reward.requirements,
        })),
      })),
    },
  };
}

export function loadPersonalRequirements(catalogs: Catalogs): { overrides: PersonalRequirements; warning?: string } {
  try {
    const raw = localStorage.getItem(personalRequirementsKey(catalogs));
    if (!raw) return { overrides: {} };
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== 'object' || !('schemaVersion' in stored) || stored.schemaVersion !== 1
      || !('requirements' in stored) || !stored.requirements || typeof stored.requirements !== 'object'
      || Array.isArray(stored.requirements)) throw new Error('requirements.storageReadError');
    const defaults = requirementSnapshot(catalogs);
    const compatible: Record<string, readonly Requirement[]> = {};
    let warning: string | undefined;
    for (const [id, entries] of Object.entries(stored.requirements)) {
      try {
        if (!Object.hasOwn(defaults, id)) throw new Error('requirements.changedCatalog');
        compatible[id] = validateRequirements(entries, catalogs);
      } catch {
        warning = 'requirements.changedCatalog';
      }
    }
    // Retain explicit overrides even if a catalog correction now matches them.
    return { overrides: compatible, warning };
  } catch {
    return { overrides: {}, warning: 'requirements.storageReadError' };
  }
}

export function savePersonalRequirements(overrides: PersonalRequirements, catalogs: Catalogs): void {
  localStorage.setItem(personalRequirementsKey(catalogs), JSON.stringify({ schemaVersion: 1, requirements: overrides }));
}

export function clearPersonalRequirements(catalogs: Catalogs): void {
  localStorage.removeItem(personalRequirementsKey(catalogs));
}
