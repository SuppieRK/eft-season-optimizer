import { expect, type Locator, type Page } from '@playwright/test';

export const documentIds = [
  'documents.financial.name',
  'documents.pmc.name',
  'documents.project.name',
  'documents.blueprints.name',
  'documents.test.name',
  'documents.user.name',
  'documents.medical.name',
  'documents.technical.name',
  'documents.classified.name',
] as const;

export async function openWireframe(page: Page): Promise<void> {
  await page.goto('wireframe.html');
  await expect(page.locator('[data-season-name]')).toHaveText('KORD BREACH');
  await expect(page.locator('.reward-page')).toHaveCount(12);
}

export function documentTile(page: Page, documentId: string): Locator {
  return page.locator(`[data-document-id="${documentId}"]`);
}

export function documentQuantity(page: Page, documentId: string): Locator {
  return documentTile(page, documentId).locator('[data-document-quantity]');
}

export async function setDocumentQuantity(page: Page, documentId: string, quantity: number): Promise<void> {
  const input = documentQuantity(page, documentId);
  await input.fill(String(quantity));
  await input.press('Tab');
  await expect(input).toHaveValue(String(quantity));
}

export function rewardRow(page: Page, rewardId: string): Locator {
  return page.locator(`[data-reward-id="${rewardId}"]`).locator('..').locator('..');
}

export async function openRewardDialog(page: Page, rewardId: string): Promise<Locator> {
  await rewardRow(page, rewardId).locator('label').click();
  const dialog = page.locator('dialog.redemption-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function trackRewardWithoutInventoryChange(page: Page, rewardId: string): Promise<void> {
  await rewardRow(page, rewardId).locator('label').click();
  const dialog = page.locator('dialog.redemption-dialog');
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'Redeem only' }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).toBeChecked();
}

export async function redeemVisiblePageWithoutInventory(page: Page, pageNumber: number): Promise<void> {
  const panel = page.locator(`#reward-page-panel-${pageNumber}`);
  const rewardIds = await panel.locator('[data-reward-id]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).dataset.rewardId ?? ''),
  );
  for (const rewardId of rewardIds) await trackRewardWithoutInventoryChange(page, rewardId);
}
