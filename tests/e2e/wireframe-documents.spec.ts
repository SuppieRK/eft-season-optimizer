import { expect, test } from '@playwright/test';

import { documentIds, documentQuantity, documentTile, openWireframe, setDocumentQuantity } from './wireframe-helpers';

const documentTitles = ['Financial', 'PMC', 'Project', 'Blueprints', 'Test', 'User', 'Medical', 'Technical', 'Classified'];

test('renders the square document artwork in source-of-truth order', async ({ page }) => {
  await openWireframe(page);

  await expect(page.locator('[data-document-id]')).toHaveCount(documentIds.length);
  expect(await page.locator('[data-document-id]').evaluateAll((tiles) => tiles.map((tile) => (tile as HTMLElement).dataset.documentId))).toEqual(documentIds);
  await expect(page.locator('[data-document-title]')).toHaveText(documentTitles);

  for (const documentId of documentIds) {
    const tile = documentTile(page, documentId);
    const frame = await tile.locator('.document-strip__image-frame').boundingBox();
    const title = await tile.locator('[data-document-title]').boundingBox();
    const quantity = await tile.locator('.document-strip__quantity').boundingBox();
    expect(frame).not.toBeNull();
    expect(title).not.toBeNull();
    expect(quantity).not.toBeNull();
    expect(Math.abs(frame!.width - frame!.height)).toBeLessThanOrEqual(1);
    expect(title!.y + title!.height).toBeLessThanOrEqual(frame!.y);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(quantity!.y);
    await expect(tile.locator('img')).toHaveAttribute('alt', /\S+/u);
  }

  const regularBorder = await documentTile(page, 'documents.financial.name').locator('.document-strip__image-frame').evaluate((element) => getComputedStyle(element).borderColor);
  const classifiedBorder = await documentTile(page, 'documents.classified.name').locator('.document-strip__image-frame').evaluate((element) => getComputedStyle(element).borderColor);
  expect(regularBorder).not.toBe(classifiedBorder);

  const ribbon = await page.locator('.document-strip__images').boundingBox();
  const strip = await page.locator('.document-strip').boundingBox();
  expect(ribbon).not.toBeNull();
  expect(strip).not.toBeNull();
  expect(Math.abs(ribbon!.x + ribbon!.width / 2 - (strip!.x + strip!.width / 2))).toBeLessThanOrEqual(1);
});

test('shows full document details and spawn locations in tooltips', async ({ page }) => {
  await openWireframe(page);

  for (const documentId of documentIds.slice(0, -1)) {
    const tile = documentTile(page, documentId);
    const tooltip = tile.getByRole('tooltip');
    await expect(tooltip.locator('strong')).toHaveText(/\S+/u);
    await expect(tooltip.locator('p')).toHaveText(/\S+/u);
    await expect(tooltip.locator('li')).not.toHaveCount(0);
  }

  await expect(documentTile(page, 'documents.blueprints.name').getByRole('tooltip')).toContainText('The Labyrinth');
  await expect(documentTile(page, 'documents.medical.name').getByRole('tooltip')).toContainText('The Labyrinth');
  await expect(documentTile(page, 'documents.classified.name').getByRole('tooltip').locator('li')).toHaveCount(0);

  const financialTile = documentTile(page, 'documents.financial.name');
  await financialTile.hover();
  await expect(financialTile.getByRole('tooltip')).toHaveCSS('opacity', '1');
});

test('updates quantities, progress, boundaries, and cookie-restored values together', async ({ page }) => {
  await openWireframe(page);

  const financialTile = documentTile(page, 'documents.financial.name');
  const classifiedTile = documentTile(page, 'documents.classified.name');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');

  await financialTile.locator('[data-document-decrement]').click();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  await financialTile.locator('[data-document-increment]').click({ clickCount: 2 });
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await classifiedTile.locator('[data-document-decrement]').click();
  await classifiedTile.locator('[data-document-decrement]').click();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveAttribute('min', '1');
  await setDocumentQuantity(page, 'documents.project.name', 7);
  await expect(page.locator('[data-document-progress-current]')).toHaveText('10');

  await page.reload();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await expect(documentQuantity(page, 'documents.project.name')).toHaveValue('7');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('10');
});
