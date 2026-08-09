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

function expectedNeedsFromCsv(): Record<string, number> {
  const [headerLine, ...lines] = readFileSync(resolve('tests/documents.csv'), 'utf8').trim().split(/\r?\n/u);
  const headers = headerLine.split(',').slice(2);
  const documentIds: Record<string, string> = {
    financial: 'documents.financial.name',
    pmc: 'documents.pmc.name',
    project: 'documents.project.name',
    blueprints: 'documents.blueprints.name',
    test: 'documents.test.name',
    user: 'documents.user.name',
    medical: 'documents.medical.name',
    technical: 'documents.technical.name',
  };

  return Object.fromEntries(headers.map((header, columnIndex) => [
    documentIds[header],
    lines.reduce((total, line) => total + (Number(line.split(',')[columnIndex + 2]) || 0), 0),
  ]));
}

describe('document needs', () => {
  it('reports exact full-pass requirements for every regular document', () => {
    const catalogs = loadCatalogs();

    expect(calculateDocumentNeeds(catalogs, [], {})).toEqual(expectedNeedsFromCsv());
  });

  it('subtracts owned documents and requirements from claimed rewards', () => {
    const catalogs = loadCatalogs();
    const firstReward = catalogs.battlePass.pages[0].rewards[0];

    const needs = calculateDocumentNeeds(catalogs, [firstReward.id], {
      'documents.financial.name': 10,
      'documents.project.name': 200,
    });

    const initialFinancial = expectedNeedsFromCsv()['documents.financial.name'];
    const claimedFinancial = firstReward.requirements.find((requirement) => (
      requirement.documentId === 'documents.financial.name'
    ))?.quantity ?? 0;
    expect(needs['documents.financial.name']).toBe(initialFinancial - claimedFinancial - 10);
    expect(needs['documents.project.name']).toBe(0);
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
