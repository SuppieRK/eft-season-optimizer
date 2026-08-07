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

test('dims and preserves the current Focus result during optimizer recalculation', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        let releasing = false;
        this.addEventListener('message', (event) => {
          if (releasing) {
            releasing = false;
            return;
          }
          event.stopImmediatePropagation();
          window.setTimeout(() => {
            releasing = true;
            this.dispatchEvent(new MessageEvent('message', { data: event.data }));
          }, 350);
        });
      }
    } as typeof Worker;
  });
  await openWireframe(page);
  const focusStage = page.locator('.focus-stage');
  const focusContent = page.locator('[data-focus-content]');
  const focusHeading = page.locator('[data-focus-heading]');
  await expect(page.locator('[data-focus-document]')).toHaveCount(2, { timeout: 10_000 });
  const headingBefore = await focusHeading.textContent();
  const contentBefore = await focusContent.innerHTML();

  await documentQuantity(page, 'documents.financial.name').evaluate((input) => {
    (input as HTMLInputElement).value = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(focusStage).toHaveAttribute('aria-busy', 'true');
  await expect(focusStage).toHaveClass(/focus-stage--loading/u);
  await expect(focusHeading).toHaveText(headingBefore ?? '');
  expect(await focusContent.innerHTML()).toBe(contentBefore);
  await expect(focusContent).toHaveCSS('opacity', '0.48');
  await expect(page.locator('[data-view-route-schedule]')).toBeDisabled();
  await expect(page.locator('[data-commit-raid]')).toBeDisabled();

  await expect(focusStage).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
  await expect(focusStage).not.toHaveClass(/focus-stage--loading/u);
  await expect(focusContent).toHaveCSS('opacity', '1');

  await page.locator('#reward-page-trigger-2').click();
  await expect(focusStage).toHaveAttribute('aria-busy', 'false');
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

  const inlineCommit = page.locator('[data-commit-raid-inline]');
  await expect(inlineCommit).toHaveText('commit');
  await expect(inlineCommit).toHaveCSS('text-decoration-line', 'underline');
  await inlineCommit.click();
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
  await expect(dialog.locator('.schedule-immediate')).toHaveCount(0);
  const pageRewardOrder = new Map(await page.evaluate(async () => {
    const response = await fetch('./data/battle-pass.json');
    const catalog = await response.json() as { pages: Array<{ page: number; rewards: Array<{ id: string }> }> };
    return catalog.pages.map((battlePassPage) => [battlePassPage.page, battlePassPage.rewards.map((reward) => reward.id)] as const);
  }));
  const renderedClaimPages = await rewardPageGroups.evaluateAll((groups) => groups.flatMap((group) => (
    Array.from({ length: group.querySelectorAll('[data-schedule-reward-id]').length }, () => Number((group as HTMLElement).dataset.scheduleRewardPage))
  )));
  const renderedClaimsByPage = new Map<number, number>();
  renderedClaimPages.forEach((pageNumber) => {
    if (pageNumber > 1) {
      expect(renderedClaimsByPage.get(pageNumber - 1) ?? 0).toBeGreaterThanOrEqual((pageRewardOrder.get(pageNumber - 1)?.length ?? 0) - 1);
    }
    renderedClaimsByPage.set(pageNumber, (renderedClaimsByPage.get(pageNumber) ?? 0) + 1);
  });
  expect(renderedClaimPages.slice(0, 4)).toEqual([1, 1, 1, 1]);
  expect(renderedClaimPages[4]).toBe(2);
  const renderedRewardGroups = await rewardPageGroups.evaluateAll((groups) => groups.map((group) => ({
    page: Number((group as HTMLElement).dataset.scheduleRewardPage),
    rewardIds: [...group.querySelectorAll<HTMLElement>('[data-schedule-reward-id]')].map((item) => item.dataset.scheduleRewardId ?? ''),
  })));
  renderedRewardGroups.forEach(({ page: pageNumber, rewardIds }) => {
    const accordionOrder = pageRewardOrder.get(pageNumber) ?? [];
    expect(rewardIds.map((rewardId) => accordionOrder.indexOf(rewardId))).toEqual(
      [...rewardIds].sort((left, right) => accordionOrder.indexOf(left) - accordionOrder.indexOf(right))
        .map((rewardId) => accordionOrder.indexOf(rewardId)),
    );
  });
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
  const scheduleClose = dialog.getByRole('button', { name: 'Close' });
  await expect(scheduleClose).toHaveText('');
  await expect(scheduleClose.locator('svg.dialog-close__icon')).toHaveCount(1);
  const scheduleCloseBox = await scheduleClose.boundingBox();
  const scheduleCloseIconBox = await scheduleClose.locator('svg.dialog-close__icon').boundingBox();
  expect(scheduleCloseBox).not.toBeNull();
  expect(scheduleCloseIconBox).not.toBeNull();
  expect(Math.abs(scheduleCloseBox!.width - scheduleCloseBox!.height)).toBeLessThanOrEqual(1);
  expect(scheduleCloseIconBox!.width).toBeGreaterThanOrEqual(20);
  await scheduleClose.click();
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
  await expect(dialog.getByRole('heading', { name: 'Battle Pass buyout' })).toBeVisible();
  const buyoutClose = dialog.getByRole('button', { name: 'Close' });
  await expect(buyoutClose).toHaveText('');
  await expect(buyoutClose.locator('svg.dialog-close__icon')).toHaveCount(1);
  const buyoutCloseBox = await buyoutClose.boundingBox();
  expect(buyoutCloseBox).not.toBeNull();
  expect(Math.abs(buyoutCloseBox!.width - buyoutCloseBox!.height)).toBeLessThanOrEqual(1);
  const scenarios = dialog.locator('[data-buyout-scenario]');
  await expect(scenarios).toHaveCount(2);
  expect(await scenarios.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.buyoutScenario))).toEqual([
    'spend',
    'keep',
  ]);
  const spend = scenarios.nth(0);
  const keep = scenarios.nth(1);
  await expect(spend.getByRole('heading', { name: 'Spend Battle Pass TarCoins' })).toBeVisible();
  await expect(keep.getByRole('heading', { name: 'Keep Battle Pass TarCoins' })).toBeVisible();
  await expect(spend.getByRole('heading', { name: 'Spend Battle Pass TarCoins' })).toHaveCSS('color', 'rgb(66, 140, 115)');
  await expect(keep.getByRole('heading', { name: 'Keep Battle Pass TarCoins' })).toHaveCSS('color', 'rgb(66, 140, 115)');
  const scenarioSeparation = await scenarios.evaluateAll((elements) => {
    const spendBox = elements[0]!.getBoundingClientRect();
    const keepBox = elements[1]!.getBoundingClientRect();
    const expectedGap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-l'));
    return { actual: keepBox.top - spendBox.bottom, expected: expectedGap };
  });
  expect(scenarioSeparation.actual).toBeGreaterThanOrEqual(scenarioSeparation.expected - 1);
  for (const scenario of [spend, keep]) {
    const tables = scenario.locator('[data-buyout-table]');
    await expect(tables).toHaveCount(2);
    expect(await tables.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.buyoutTable))).toEqual([
      'tar-coin-packages',
      'classified-bundles',
    ]);
    await expect(tables.nth(0).locator('tbody tr')).not.toHaveCount(0);
    await expect(tables.nth(1).locator('tbody tr')).not.toHaveCount(0);
    await expect(tables.nth(1).locator('tfoot')).toContainText('TarCoins to spend');
  }
  await expect(spend.locator('[data-buyout-battle-pass-tar-coins]')).toHaveCount(1);
  await expect(keep.locator('[data-buyout-battle-pass-tar-coins]')).toHaveCount(0);
  await expect(spend.locator('[data-buyout-table="tar-coin-packages"]')).toContainText('$');
  await expect(keep.locator('[data-buyout-table="tar-coin-packages"]')).toContainText('$');
  await expect(dialog).not.toContainText('FROM $');
  expect(await spend.locator('[data-buyout-table="classified-bundles"] tbody').innerText())
    .toBe(await keep.locator('[data-buyout-table="classified-bundles"] tbody').innerText());
  await expect(dialog).not.toContainText('TarCoin funding');
  await expect(dialog).not.toContainText('Gross TarCoins spent');
  await expect(dialog).not.toContainText('Minimum additional TarCoins');
  await expect(dialog).not.toContainText('Starting TarCoins used');
  await expect(dialog).not.toContainText('FROM estimate');
  await expect(dialog).not.toContainText('How this is calculated');
  await expect(dialog).not.toContainText('Spending or keeping Battle Pass TarCoins');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileGeometry = await dialog.evaluate((element) => {
    const content = element.querySelector<HTMLElement>('[data-buyout-content]')!;
    return {
      contentClientWidth: content.clientWidth,
      contentScrollWidth: content.scrollWidth,
      widestTable: Math.max(...[...content.querySelectorAll('table')].map((table) => table.getBoundingClientRect().width)),
    };
  });
  expect(mobileGeometry.contentScrollWidth).toBeLessThanOrEqual(mobileGeometry.contentClientWidth);
  expect(mobileGeometry.widestTable).toBeLessThanOrEqual(mobileGeometry.contentClientWidth);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await page.locator('[data-reward-claim-all]').click();
  await expect(buyoutLink).toBeHidden({ timeout: 10_000 });
});
