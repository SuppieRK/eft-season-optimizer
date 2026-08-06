const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const battlePassPath = path.join(__dirname, '..', 'public', 'data', 'battle-pass.json');
const documentsCsvPath = path.join(__dirname, 'documents.csv');

const documentColumns = {
  financial: 'documents.financial.name',
  pmc: 'documents.pmc.name',
  project: 'documents.project.name',
  blueprints: 'documents.blueprints.name',
  test: 'documents.test.name',
  user: 'documents.user.name',
  medical: 'documents.medical.name',
  technical: 'documents.technical.name',
};

function readDocumentsCsv() {
  const lines = fs
    .readFileSync(documentsCsvPath, 'utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = lines.shift().split(',').map((header) => header.trim());
  for (const column of Object.keys(documentColumns)) {
    assert.ok(headers.includes(column), `Missing document column in CSV: ${column}`);
  }

  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? '']));
  });
}

function csvQuantity(value) {
  if (!value) {
    return 0;
  }

  const quantity = Number(value);
  assert.ok(Number.isInteger(quantity) && quantity >= 0, `Invalid CSV quantity: ${value}`);
  return quantity;
}

function sumCsvDocumentRequirements() {
  const totals = {};

  for (const row of readDocumentsCsv()) {
    for (const [column, documentId] of Object.entries(documentColumns)) {
      totals[documentId] = (totals[documentId] ?? 0) + csvQuantity(row[column]);
    }
  }

  return totals;
}

function sumDocumentRequirements() {
  const battlePass = JSON.parse(fs.readFileSync(battlePassPath, 'utf8'));
  const totals = {};

  for (const page of battlePass.pages) {
    for (const reward of page.rewards) {
      for (const requirement of reward.requirements) {
        totals[requirement.documentId] =
          (totals[requirement.documentId] ?? 0) + requirement.quantity;
      }
    }
  }

  return totals;
}

test('battle pass document requirements match the reconstructed totals', () => {
  assert.deepStrictEqual(sumDocumentRequirements(), sumCsvDocumentRequirements());
});
