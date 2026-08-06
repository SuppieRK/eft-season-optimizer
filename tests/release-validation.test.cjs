const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateReleaseCatalogs } = require('../scripts/validate-release.cjs');

test('release validation blocks known development content', () => {
  const issues = validateReleaseCatalogs(
    {
      releaseStatus: 'development-only',
      supportedLocales: ['en'],
      entries: [{ id: 'reward.short.pending', localizations: { en: 'Pending description placeholder' } }],
      priceEntries: [],
    },
    { documents: [{ id: 'documents.test.name' }] },
  );

  assert.deepStrictEqual(issues, [
    'localization.releaseStatus is development-only',
    'reward.short.pending contains development placeholder text',
    'documents.test.name lacks reviewed description or image alternative',
  ]);
});

test('release validation accepts reviewed complete catalog fragments', () => {
  assert.deepStrictEqual(validateReleaseCatalogs(
    {
      releaseStatus: 'release',
      supportedLocales: ['en'],
      entries: [{ id: 'documents.test.name', localizations: { en: 'Test documents' } }],
      priceEntries: [],
    },
    { documents: [{ id: 'documents.test.name', descriptionId: 'documents.test.description', imageAltId: 'documents.test.alt' }] },
  ), []);
});
