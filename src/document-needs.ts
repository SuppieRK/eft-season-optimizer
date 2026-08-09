import type { Catalogs } from './catalogs.ts';

export function calculateDocumentNeeds(
  catalogs: Catalogs,
  claimedRewardIds: readonly string[],
  ownedDocuments: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const claimedRewards = new Set(claimedRewardIds);
  const regularDocumentIds = new Set(
    catalogs.documents.documents
      .filter((document) => document.kind === 'regular')
      .map((document) => document.id),
  );
  const needs: Record<string, number> = Object.fromEntries(
    [...regularDocumentIds].map((documentId) => [documentId, 0]),
  );

  for (const page of catalogs.battlePass.pages) {
    for (const reward of page.rewards) {
      if (claimedRewards.has(reward.id)) continue;
      for (const requirement of reward.requirements) {
        if (!regularDocumentIds.has(requirement.documentId)) continue;
        needs[requirement.documentId] = (needs[requirement.documentId] ?? 0) + requirement.quantity;
      }
    }
  }

  for (const documentId of regularDocumentIds) {
    const owned = Math.max(0, Math.trunc(ownedDocuments[documentId] ?? 0));
    needs[documentId] = Math.max(0, (needs[documentId] ?? 0) - owned);
  }

  return needs;
}
