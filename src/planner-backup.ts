import type { Catalogs } from './catalogs';
import { getCompleteLocales } from './localization';
import { browserCookieAdapter, saveState, type CookieAdapter } from './persistence';
import { personalRequirementsKey, requirementSnapshot, savePersonalRequirements, validateRequirements, type PersonalRequirements } from './personal-requirements';
import { createDefaultState, getClassifiedDocumentMinimum, type AppState } from './state';

export interface ImportAdjustment {
  readonly kind: 'requirements.omittedReward' | 'requirements.defaultReward' | 'requirements.adjustedProgress';
  readonly id: string;
}

export interface BackupPreview {
  readonly requirements: PersonalRequirements;
  readonly state: AppState;
  readonly adjustments: readonly ImportAdjustment[];
}

export function exportPlannerBackup(catalogs: Catalogs, state: AppState): string {
  return JSON.stringify({
    format: 'eft-season-optimizer-backup',
    schemaVersion: 1,
    seasonId: catalogs.battlePass.id,
    requirements: requirementSnapshot(catalogs),
    state,
  }, null, 2);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('requirements.invalidBackup');
  return value as Record<string, unknown>;
}

function quantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('requirements.invalidBackup');
  return value;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((id: unknown) => typeof id === 'string') || new Set(value).size !== value.length) {
    throw new Error('requirements.invalidBackup');
  }
  return value;
}

export function previewPlannerBackup(raw: string, catalogs: Catalogs): BackupPreview {
  let data: Record<string, unknown>;
  try {
    data = object(JSON.parse(raw));
  } catch {
    throw new Error('requirements.invalidBackup');
  }
  if (data.format !== 'eft-season-optimizer-backup' || data.schemaVersion !== 1 || typeof data.seasonId !== 'string') {
    throw new Error('requirements.invalidBackup');
  }
  if (data.seasonId !== catalogs.battlePass.id) throw new Error('requirements.differentSeason');
  const snapshot = object(data.requirements);
  if (Object.keys(snapshot).length === 0) throw new Error('requirements.invalidBackup');
  const defaults = requirementSnapshot(catalogs);
  const adjustments: ImportAdjustment[] = [];
  const requirements = { ...defaults };
  for (const [id, entries] of Object.entries(snapshot)) {
    const valid = validateRequirements(entries);
    if (!Object.hasOwn(defaults, id)) {
      adjustments.push({ kind: 'requirements.omittedReward', id });
      continue;
    }
    if (valid.some((entry) => catalogs.documents.documents.some((record) => record.id === entry.documentId && record.kind !== 'regular'))) {
      throw new Error('requirements.invalidBackup');
    }
    try {
      requirements[id] = validateRequirements(valid, catalogs);
    } catch {
      adjustments.push({ kind: 'requirements.defaultReward', id });
    }
  }
  Object.keys(defaults).filter((id) => !Object.hasOwn(snapshot, id)).forEach((id) => adjustments.push({ kind: 'requirements.defaultReward', id }));

  const input = object(data.state);
  const stateDefaults = createDefaultState(catalogs);
  const claimed = strings(input.claimedRewardIds);
  const owned = Object.fromEntries(Object.entries(object(input.ownedDocuments)).map(([id, value]) => [id, quantity(value)]));
  const classified = quantity(input.classifiedDocuments);
  const selectedPage = quantity(input.selectedPage);
  if (input.mode !== 'pve' && input.mode !== 'pvp' && input.mode !== 'pvp-seasonal') throw new Error('requirements.invalidBackup');
  if (input.selectedProfile !== 'fastest' && input.selectedProfile !== 'safest') throw new Error('requirements.invalidBackup');
  if (typeof input.locale !== 'string') throw new Error('requirements.invalidBackup');
  const claimedRewardIds = claimed.filter((id) => Object.hasOwn(defaults, id));
  const documentIds = new Set(catalogs.documents.documents.map((entry) => entry.id));
  const validOwned = Object.fromEntries(Object.entries(owned).filter(([id]) => documentIds.has(id)));
  [...claimed.filter((id) => !Object.hasOwn(defaults, id)), ...Object.keys(owned).filter((id) => !documentIds.has(id))]
    .forEach((id) => adjustments.push({ kind: 'requirements.adjustedProgress', id }));
  const locale = getCompleteLocales(catalogs.localization).includes(input.locale) ? input.locale : stateDefaults.locale;
  const page = catalogs.battlePass.pages.some((entry) => entry.page === selectedPage) ? selectedPage : stateDefaults.selectedPage;
  const classifiedDocuments = Math.max(getClassifiedDocumentMinimum(claimedRewardIds), classified);
  if (locale !== input.locale) adjustments.push({ kind: 'requirements.adjustedProgress', id: 'ui.locale' });
  if (page !== selectedPage) adjustments.push({ kind: 'requirements.adjustedProgress', id: 'battlePass.page' });
  if (classifiedDocuments !== classified) adjustments.push({ kind: 'requirements.adjustedProgress', id: 'documents.classified.name' });
  return {
    requirements,
    adjustments,
    state: {
      ...stateDefaults,
      claimedRewardIds,
      ownedDocuments: { ...stateDefaults.ownedDocuments, ...validOwned },
      classifiedDocuments,
      mode: input.mode,
      locale,
      selectedPage: page,
      selectedProfile: input.selectedProfile,
    },
  };
}

// Preflight the unchanged cookie schema and keep previous values for rollback.
// A requirements-only import does not write any progress cookies.
export function persistPlannerImport(preview: BackupPreview, catalogs: Catalogs, complete: boolean): void {
  const writes: { name: string; value: string; maxAge: number; previous?: string }[] = [];
  const staging: CookieAdapter = {
    read: (name) => browserCookieAdapter.read(name),
    write: (name, value, maxAge) => writes.push({ name, value, maxAge, previous: browserCookieAdapter.read(name) }),
    remove: () => { throw new Error('requirements.invalidBackup'); },
  };
  if (complete) saveState(preview.state, staging, catalogs);
  const key = personalRequirementsKey(catalogs);
  const previous = localStorage.getItem(key);
  let requirementsSaved = false;
  const attempted: typeof writes = [];
  try {
    savePersonalRequirements(preview.requirements, catalogs);
    requirementsSaved = true;
    for (const write of writes) {
      attempted.push(write);
      browserCookieAdapter.write(write.name, write.value, write.maxAge);
      if (decodeURIComponent(browserCookieAdapter.read(write.name) ?? '') !== write.value) throw new Error('requirements.storageWriteError');
    }
  } catch {
    let rollbackFailed = false;
    if (requirementsSaved) {
      try {
        if (previous === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous);
      } catch { rollbackFailed = true; }
    }
    for (const write of attempted) {
      try {
        if (write.previous === undefined) browserCookieAdapter.remove(write.name);
        else browserCookieAdapter.write(write.name, decodeURIComponent(write.previous), write.maxAge);
      } catch { rollbackFailed = true; }
    }
    throw new Error(rollbackFailed ? 'requirements.rollbackError' : 'requirements.storageWriteError');
  }
}
