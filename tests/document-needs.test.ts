import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey, type Catalogs } from '../src/catalogs';
import { calculateDocumentNeeds } from '../src/document-needs';

const paths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function loadCatalogs(): Catalogs {
  return parseCatalogs(Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>);
}

describe('document needs', () => {
  it('reports catalog-derived full-pass requirements for every regular document', () => {
    const catalogs = loadCatalogs();
    const needs = calculateDocumentNeeds(catalogs, [], {});
    const regularDocumentIds = catalogs.documents.documents
      .filter((document) => document.kind === 'regular')
      .map((document) => document.id);
    const requirementTotal = catalogs.battlePass.pages
      .flatMap((page) => page.rewards)
      .flatMap((reward) => reward.requirements)
      .reduce((total, requirement) => total + requirement.quantity, 0);

    expect(Object.keys(needs).sort()).toEqual([...regularDocumentIds].sort());
    expect(Object.values(needs).reduce((total, need) => total + need, 0)).toBe(requirementTotal);
  });

  it('subtracts owned documents and requirements from claimed rewards', () => {
    const catalogs = loadCatalogs();
    const firstReward = catalogs.battlePass.pages[0].rewards[0];
    const baseline = calculateDocumentNeeds(catalogs, [], {});
    const ownedDocuments = {
      'documents.financial.name': 10,
      'documents.project.name': 200,
    };

    const needs = calculateDocumentNeeds(catalogs, [firstReward.id], ownedDocuments);

    for (const [documentId, baselineNeed] of Object.entries(baseline)) {
      const claimedQuantity = firstReward.requirements.find((requirement) => (
        requirement.documentId === documentId
      ))?.quantity ?? 0;
      expect(needs[documentId]).toBe(Math.max(
        0,
        baselineNeed - claimedQuantity - (ownedDocuments[documentId as keyof typeof ownedDocuments] ?? 0),
      ));
    }
  });

  it('does not apply Classified backfill, exchanges, mode, or route profile choices', () => {
    const catalogs = loadCatalogs();
    const baseline = calculateDocumentNeeds(catalogs, [], {});

    expect(calculateDocumentNeeds(catalogs, [], {
      'documents.classified.name': 1_000,
    })).toEqual(baseline);
    expect(baseline).not.toHaveProperty('documents.classified.name');
  });

  it('clamps each fulfilled document requirement to zero', () => {
    const catalogs = loadCatalogs();
    const ownedDocuments = Object.fromEntries(
      catalogs.documents.documents.map((document) => [document.id, 10_000]),
    );

    expect(Object.values(calculateDocumentNeeds(catalogs, [], ownedDocuments)))
      .toEqual(expect.arrayContaining([0]));
    expect(Object.values(calculateDocumentNeeds(catalogs, [], ownedDocuments)).every((need) => need === 0)).toBe(true);
  });
});
