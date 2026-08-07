import { expect, test } from '@playwright/test';

import { documentQuantity, openWireframe, setDocumentQuantity } from './wireframe-helpers';

const dogtagReward = 'rewards.dogtag01.name';

test('offers a raid beside the starting Classified Document redemption option', async ({ page }) => {
  await openWireframe(page);

  await expect(page.locator('[data-focus-heading]')).not.toHaveText('Claim now', { timeout: 10_000 });
  await expect(page.locator('[data-raid-result]')).toHaveCount(2);
  await expect(page.locator('[data-commit-raid]')).toBeVisible();
  await expect(page.locator(`[data-reward-id="${dogtagReward}"]`)).not.toBeChecked();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
});

test('shows both location documents with one clear farming priority', async ({ page }) => {
  await openWireframe(page);
  await expect(page.locator('[data-raid-result]')).toHaveCount(2, { timeout: 10_000 });

  const documents = page.locator('[data-focus-document]');
  const priority = page.locator('.focus-document:not(.focus-document--optional)');
  const optional = page.locator('.focus-document--optional');
  await expect(documents).toHaveCount(2);
  await expect(priority).toHaveCount(1);
  await expect(optional).toHaveCount(1);
  await expect(priority).toContainText('Priority');
  await expect(optional).toContainText('Optional pickup');
  await expect(page.locator('[data-detail-content]')).toContainText(/Easy|Normal|Hard|Insane/u);
  await expect(page.locator('[data-detail-content]')).toContainText(/\d+ min/u);

  const priorityOpacity = await priority.locator('.focus-document__image-frame').evaluate((element) => Number(getComputedStyle(element).opacity));
  const optionalOpacity = await optional.locator('.focus-document__image-frame').evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(priorityOpacity).toBeGreaterThan(optionalOpacity);
});

test('keeps raid results as drafts until Commit, then updates and persists inventory', async ({ page }) => {
  await openWireframe(page);
  await expect(page.locator('[data-raid-result]')).toHaveCount(2, { timeout: 10_000 });

  const resultInputs = page.locator('[data-raid-result]');
  const documentIds = await resultInputs.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).dataset.raidResult ?? ''));
  expect(documentIds).toHaveLength(2);
  await resultInputs.nth(0).fill('2');
  await resultInputs.nth(1).fill('1');

  await expect(documentQuantity(page, documentIds[0])).toHaveValue('0');
  await expect(documentQuantity(page, documentIds[1])).toHaveValue('0');

  await page.locator('[data-commit-raid]').click();
  await expect(documentQuantity(page, documentIds[0])).toHaveValue('2');
  await expect(documentQuantity(page, documentIds[1])).toHaveValue('1');
  await expect(page.locator('[data-focus-content]')).not.toContainText('Start new game day');
  await expect(page.locator('[data-focus-content]')).not.toContainText('Collected today');

  await page.reload();
  await expect(documentQuantity(page, documentIds[0])).toHaveValue('2');
  await expect(documentQuantity(page, documentIds[1])).toHaveValue('1');
});

test('accepts a zero-yield Commit and exposes the projected schedule on demand', async ({ page }) => {
  await openWireframe(page);
  await expect(page.locator('[data-raid-result]')).toHaveCount(2, { timeout: 10_000 });

  const locationBefore = await page.locator('[data-focus-heading]').textContent();
  await page.locator('[data-commit-raid]').click();
  await expect(page.locator('[data-focus-heading]')).toHaveText(locationBefore ?? '', { timeout: 10_000 });
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');

  await page.getByRole('button', { name: 'View full schedule' }).click();
  const dialog = page.locator('[data-route-schedule-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.schedule-projection-day')).not.toHaveCount(0);
  await expect(dialog).not.toContainText(/Page \d+ unlocked/iu);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('keeps both location documents useful for optional crate stockpiling', async ({ page }) => {
  await openWireframe(page);
  await setDocumentQuantity(page, 'documents.project.name', 10);
  await page.getByRole('button', { name: 'Claim all' }).click();

  await expect(page.locator('[data-document-role="stockpile"]')).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator('.focus-document--optional')).toHaveCount(0);
  await expect(page.locator('[data-focus-content]')).toContainText('Crate stockpile');
  await expect(page.locator('[data-commit-raid]')).toBeVisible();
});
