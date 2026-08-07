import { expect, test } from '@playwright/test';

import { documentQuantity, openWireframe, setDocumentQuantity } from './wireframe-helpers';

const dogtagReward = 'rewards.dogtag01.name';
const gameDataVersion = '1.1.0.0.46657.8.6.2026';

async function seedOptimizerState(
  page: Parameters<typeof openWireframe>[0],
  input: {
    claimedRewardIds: string[];
    ownedDocuments?: Record<string, number>;
    classifiedDocuments?: number;
    tarCoins?: number;
    spendTarCoinsOnClassifiedDocuments?: boolean;
  },
): Promise<void> {
  const envelope = (payload: object) => encodeURIComponent(JSON.stringify({
    gameDataVersion,
    schemaVersion: 1,
    payload,
  }));
  await page.context().addCookies([
    {
      name: 'kord-breach-progress',
      value: envelope({
        claimedRewardIds: input.claimedRewardIds,
        ownedDocuments: input.ownedDocuments ?? {},
        classifiedDocuments: input.classifiedDocuments ?? 0,
        tarCoins: input.tarCoins ?? 0,
        crateCount: 1,
      }),
      url: page.url(),
    },
    {
      name: 'kord-breach-settings',
      value: envelope({
        mode: 'pvp-seasonal',
        spendTarCoinsOnClassifiedDocuments: input.spendTarCoinsOnClassifiedDocuments ?? false,
        locale: 'en',
      }),
      url: page.url(),
    },
  ]);
  await page.reload();
  await expect(page.locator('[data-season-name]')).toHaveText('KORD BREACH');
}

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
  await expect(documents.locator('figcaption strong')).toHaveText(['Project', 'Blueprints']);
  await expect(documents.locator('figcaption')).toHaveText(['Project', 'Blueprints']);
  await expect(documents.locator('figcaption span')).toHaveCount(0);
  await expect(page.locator('[data-focus-heading]')).toHaveText(/.+ \((Easy|Normal|Hard|Insane), \d+ min\)/u);
  await expect(page.locator('.detail-rail')).toHaveCount(0);
  await expect(page.locator('.focus-heading__actions [data-view-route-schedule]')).toBeVisible();
  await expect(page.locator('.focus-heading__actions [data-commit-raid]')).toBeVisible();
  await expect(page.locator('.focus-stage')).not.toContainText(/Estimated days/iu);

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
  await expect(dialog.locator('[data-route-schedule-estimate]')).toHaveText(/Estimated days: \d+/u);
  await expect(dialog.locator('.schedule-projection-day')).not.toHaveCount(0);
  await expect(dialog.locator('.schedule-day-column--raids')).not.toHaveCount(0);
  await expect(dialog.locator('.schedule-day-column--rewards')).not.toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Raids' }).first()).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Rewards to redeem' }).first()).toBeVisible();
  const rewardPageGroups = dialog.locator('[data-schedule-reward-page]');
  await expect(rewardPageGroups).not.toHaveCount(0);
  await expect(rewardPageGroups.first().locator('.schedule-reward-page__heading')).toHaveText(/^Page \d{2}$/u);
  await expect(rewardPageGroups.first().locator('li')).not.toHaveCount(0);
  await expect(dialog.locator('.schedule-day-column--rewards > ul')).toHaveCount(0);
  await expect(dialog).not.toContainText('Plan details');
  await expect(dialog).not.toContainText('Owned Classified Documents consumed');
  await expect(dialog).not.toContainText(/Page \d+ unlocked/iu);
  const desktopScrollGeometry = await dialog.evaluate((element) => {
    const dialogBox = element.getBoundingClientRect();
    const content = element.querySelector<HTMLElement>('[data-route-schedule-content]')!;
    const contentBox = content.getBoundingClientRect();
    return {
      dialogBottom: dialogBox.bottom,
      contentBottom: contentBox.bottom,
      contentClientHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
    };
  });
  expect(desktopScrollGeometry.contentBottom).toBeLessThanOrEqual(desktopScrollGeometry.dialogBottom);
  expect(desktopScrollGeometry.contentScrollHeight).toBeGreaterThan(desktopScrollGeometry.contentClientHeight);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'View full schedule' }).click();
  const [raidColumn, rewardColumn] = await Promise.all([
    dialog.locator('.schedule-day-column--raids').first().boundingBox(),
    dialog.locator('.schedule-day-column--rewards').first().boundingBox(),
  ]);
  expect(raidColumn).not.toBeNull();
  expect(rewardColumn).not.toBeNull();
  expect(rewardColumn!.y).toBeGreaterThanOrEqual(raidColumn!.y + raidColumn!.height);
  const mobileBounds = await dialog.evaluate((element) => ({
    dialogBottom: element.getBoundingClientRect().bottom,
    contentBottom: element.querySelector('[data-route-schedule-content]')!.getBoundingClientRect().bottom,
  }));
  expect(mobileBounds.contentBottom).toBeLessThanOrEqual(mobileBounds.dialogBottom);
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

test('keeps required exchanges and Classified purchases visible in the full schedule', async ({ page }) => {
  await openWireframe(page);
  const allRewardIds = await page.locator('[data-reward-id]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).dataset.rewardId ?? ''),
  );
  const claimedExceptDogtag = allRewardIds.filter((rewardId) => rewardId !== dogtagReward);

  await seedOptimizerState(page, {
    claimedRewardIds: claimedExceptDogtag,
    ownedDocuments: { 'documents.project.name': 5 },
  });
  await page.getByRole('button', { name: 'View full schedule' }).click();
  let dialog = page.locator('[data-route-schedule-dialog]');
  await expect(dialog.getByRole('heading', { name: 'Plan actions' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Regular-document exchanges' })).toBeVisible();
  await expect(dialog.locator('.schedule-plan-actions')).toContainText(/Project documentation × 5.*Financial documents/su);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await seedOptimizerState(page, {
    claimedRewardIds: claimedExceptDogtag,
    tarCoins: 500,
    spendTarCoinsOnClassifiedDocuments: true,
  });
  await page.getByRole('button', { name: 'View full schedule' }).click();
  dialog = page.locator('[data-route-schedule-dialog]');
  await expect(dialog.getByRole('heading', { name: 'Classified Document purchases' })).toBeVisible();
  await expect(dialog.locator('.schedule-plan-actions')).toContainText('Purchased Classified Documents: 20; TarCoins spent: 500');
  await expect(dialog.locator('.schedule-plan-actions')).toContainText('20 Classified Documents × 1');
  await expect(dialog).not.toContainText('Owned Classified Documents consumed');
});

test('opens a detailed buyout from the approximate Documents price', async ({ page }) => {
  await openWireframe(page);

  const buyoutLink = page.locator('[data-buyout-link]');
  await expect(buyoutLink).toBeVisible({ timeout: 10_000 });
  await expect(buyoutLink).toHaveText(/^\(~\$[\d,.]+\)$/u);
  await expect(buyoutLink).toHaveCSS('text-decoration-line', 'underline');
  await buyoutLink.click();

  const dialog = page.locator('[data-buyout-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'TarCoin funding' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Classified Document bundles' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'TarCoin packages' })).toBeVisible();
  await expect(dialog.locator('.buyout-section').nth(1).locator('li')).not.toHaveCount(0);
  await expect(dialog.locator('.buyout-section').nth(2).locator('li')).not.toHaveCount(0);
  await expect(dialog.locator('.buyout-section').nth(2)).toContainText('FROM $');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await page.locator('[data-reward-claim-all]').click();
  await expect(buyoutLink).toBeHidden({ timeout: 10_000 });
});
