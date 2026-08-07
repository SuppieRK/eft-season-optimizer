import { expect, test } from '@playwright/test';

import {
  documentQuantity,
  openRewardDialog,
  openWireframe,
  redeemVisiblePageWithoutInventory,
  rewardRow,
  setDocumentQuantity,
  trackRewardWithoutInventoryChange,
} from './wireframe-helpers';

const dogtagReward = 'rewards.dogtag01.name';
const tarCoinsReward = 'rewards.tarcoins50-01.name';

test('keeps one accordion page open and persists the selected page', async ({ page }) => {
  await openWireframe(page);

  await expect(page.locator('.reward-page__trigger')).toHaveCount(12);
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-1');
  await expect(page.locator('.reward-page__panel:visible')).toHaveCount(1);
  await expect(page.locator('#reward-page-panel-1')).toBeVisible();
  await expect(page.locator('#reward-page-panel-2')).toBeHidden();

  await page.locator('#reward-page-trigger-2').click();
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-2');
  await expect(page.locator('.reward-page__panel:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-2');
});

test('uses alternative-option redeemable counts from the same inventory snapshot', async ({ page }) => {
  await openWireframe(page);

  await expect(page.locator('#reward-page-trigger-1 .reward-page__redeemable')).toHaveText('(1 redeemable)');
  await setDocumentQuantity(page, 'documents.classified.name', 3);
  await expect(page.locator('#reward-page-trigger-1 .reward-page__redeemable')).toHaveText('(4 redeemable)');
});

test('focuses Redeem and subtract so Enter consumes inventory and completes the row', async ({ page }) => {
  await openWireframe(page);

  const dialog = await openRewardDialog(page, dogtagReward);
  const subtract = dialog.getByRole('button', { name: 'Redeem and subtract' });
  const rewardCheckbox = page.locator(`[data-reward-id="${dogtagReward}"]`);
  await expect(rewardCheckbox).not.toBeChecked();
  await expect(subtract).toBeFocused();
  await expect(dialog).toContainText('Classified Documents (1)');

  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(rewardCheckbox).toBeChecked();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveAttribute('min', '0');
  await expect(page.locator('[data-reward-progress-current]')).toHaveText('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');

  const row = rewardRow(page, dogtagReward);
  expect(await row.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('linear-gradient');
  expect(Number(await row.evaluate((element) => getComputedStyle(element, '::after').opacity))).toBeGreaterThan(0);
  await rewardCheckbox.focus();
  await expect(rewardCheckbox).toBeFocused();

  await row.locator('label').click();
  await expect(rewardCheckbox).not.toBeChecked();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveAttribute('min', '1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');
});

test('tracks a reward directly when recorded inventory is insufficient', async ({ page }) => {
  await openWireframe(page);

  await rewardRow(page, tarCoinsReward).locator('label').click();
  await expect(page.locator('dialog.redemption-dialog')).toBeHidden();
  await expect(page.locator(`[data-reward-id="${tarCoinsReward}"]`)).toBeChecked();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(documentQuantity(page, 'documents.project.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.blueprints.name')).toHaveValue('0');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('4');
});

test('supports Redeem only without changing inventory', async ({ page }) => {
  await openWireframe(page);

  await trackRewardWithoutInventoryChange(page, dogtagReward);
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('2');
  await rewardRow(page, dogtagReward).locator('label').click();
  await expect(page.locator(`[data-reward-id="${dogtagReward}"]`)).not.toBeChecked();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');
});

test('subtracts matching regular documents before the Classified shortage', async ({ page }) => {
  await openWireframe(page);

  await setDocumentQuantity(page, 'documents.project.name', 1);
  await setDocumentQuantity(page, 'documents.blueprints.name', 1);
  const dialog = await openRewardDialog(page, tarCoinsReward);
  await expect(dialog.locator('li')).toHaveText([
    'Project documentation (1)',
    'Blueprints and technical documentation (1)',
    'Classified Documents (1)',
  ]);
  await expect(dialog.getByRole('button', { name: 'Redeem and subtract' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(documentQuantity(page, 'documents.project.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.blueprints.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('0');
  await expect(page.locator(`[data-reward-id="${tarCoinsReward}"]`)).toBeChecked();
});

test('marks completed rewards and pages with the same gradient and advances to Page 02', async ({ page }) => {
  await openWireframe(page);

  await redeemVisiblePageWithoutInventory(page, 1);
  const pageOne = page.locator('#reward-page-trigger-1').locator('..');
  await expect(pageOne).toHaveClass(/reward-page--complete/u);
  await expect(page.locator('#reward-page-trigger-1 .reward-page__count')).toHaveText('5 / 5');
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-2');
  const pageBackground = await page.locator('#reward-page-trigger-1').evaluate((element) => getComputedStyle(element).backgroundImage);
  const rewardBackground = await rewardRow(page, dogtagReward).evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(pageBackground).toContain('linear-gradient');
  expect(pageBackground).toBe(rewardBackground);

  await page.reload();
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-2');
});

test('keeps bulk actions tracking-only and replaces full completion with the crate fallback', async ({ page }) => {
  await openWireframe(page);
  await setDocumentQuantity(page, 'documents.financial.name', 2);

  await page.locator('[data-reward-claim-all]').click();
  await expect(page.locator('.reward-page')).toHaveCount(0);
  await expect(page.locator('[data-reward-pages]')).toContainText('Black Division Gear Crate');
  await expect(page.locator('[data-reward-pages]')).toContainText('Any non-Classified documents (10)');
  await expect(page.locator('[data-reward-claim-all]')).toBeDisabled();
  await expect(page.locator('[data-reward-progress-current]')).toHaveText('53');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');

  await setDocumentQuantity(page, 'documents.classified.name', 0);
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('0');

  await page.locator('[data-reward-clear-all]').click();
  await expect(page.locator('.reward-page')).toHaveCount(12);
  await expect(page.locator('[data-reward-progress-current]')).toHaveText('0');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('.reward-page__trigger[aria-expanded="true"]')).toHaveAttribute('id', 'reward-page-trigger-1');
});

test('wraps compact requirements without truncation or unlocked labels', async ({ page }) => {
  await openWireframe(page);

  await expect(rewardRow(page, tarCoinsReward).locator('.reward-item__requirements')).toHaveText('Project (2) · Blueprints (1)');
  const overflow = await rewardRow(page, tarCoinsReward).locator('.reward-item__requirements').evaluate((element) => {
    const style = getComputedStyle(element);
    return { overflowWrap: style.overflowWrap, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  });
  expect(overflow.overflowWrap).toBe('anywhere');
  expect(overflow.textOverflow).not.toBe('ellipsis');
  expect(overflow.whiteSpace).not.toBe('nowrap');
  await expect(page.getByText(/PAGE \d+ UNLOCKED/iu)).toHaveCount(0);
});
