import { expect, test } from '@playwright/test';

import { documentQuantity, openWireframe, setDocumentQuantity } from './wireframe-helpers';

test('shows meaningful inert content while the application initializes', async ({ page }) => {
  let releaseRequests!: () => void;
  const requestGate = new Promise<void>((resolve) => { releaseRequests = resolve; });
  await page.route('**/data/*.json', async (route) => {
    await requestGate;
    await route.continue();
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const shell = page.locator('.wireframe-shell');
  await expect(shell).toBeVisible();
  await expect(shell).toHaveAttribute('aria-busy', 'true');
  await expect(shell).not.toHaveAttribute('inert');
  await expect(shell.locator('[data-pending-control]').first()).toHaveAttribute('inert', '');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KORD BREACH');
  await expect(page.locator('[data-document-progress-label]')).toHaveText('Documents');
  await expect(page.locator('[data-focus-heading]')).toHaveText(/^.+ \(.+, \d+ min\)$/u);
  await expect(page.locator('[data-focus-content] img').first()).toHaveAttribute('fetchpriority', 'high');
  expect(await page.locator('[data-raid-result]').evaluateAll((inputs) => (
    inputs.map((input) => (input as HTMLInputElement).value)
  ))).toEqual(['0', '0']);
  await expect(page.locator('[data-reward-loading]')).toHaveText('Loading Battle Pass rewards…');
  await page.evaluate(() => Reflect.set(window, '__staticFocusImage', document.querySelector('[data-focus-content] img')));

  releaseRequests();
  await expect(shell).toHaveAttribute('aria-busy', 'false');
  await expect(shell.locator('[data-pending-control]')).toHaveCount(0);
  await expect(page.locator('[data-reward-loading]')).toHaveCount(0);
  expect(await page.locator('[data-raid-result]').evaluateAll((inputs) => (
    inputs.map((input) => (input as HTMLInputElement).value)
  ))).toEqual(['0', '0']);
  expect(await page.evaluate(() => Reflect.get(window, '__staticFocusImage') === document.querySelector('[data-focus-content] img'))).toBe(true);
});

test('shows a readable static error when catalog initialization fails', async ({ page }) => {
  await page.route('**/data/documents.json', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('./');

  const shell = page.locator('.wireframe-shell');
  await expect(shell).toHaveAttribute('aria-busy', 'false');
  await expect(shell).not.toHaveAttribute('data-app-pending');
  await expect(page.locator('[data-app-error]')).toBeVisible();
  await expect(page.locator('[data-app-error]')).toContainText('could not load');
  await expect(page.locator('[data-reward-claim-all]')).toBeDisabled();
});

test('keeps localized content available without JavaScript', async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(baseURL);
  await expect(page).toHaveTitle('Escape from Tarkov KORD BREACH Battle Pass Optimizer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KORD BREACH');
  await expect(page.locator('[data-about-summary]')).toContainText('53 rewards');

  await page.goto(new URL('ru/', baseURL).href);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');
  await expect(page).toHaveTitle('Оптимизатор Боевого пропуска KORD BREACH для Escape from Tarkov');
  await expect(page.locator('[data-about-summary]')).toContainText('53');
  await expect(page.locator('[data-about-table-body] tr')).toHaveCount(8);

  await context.close();
});

test('opens the catalog-derived About dialog', async ({ page }) => {
  await openWireframe(page);
  const limits = await page.evaluate(async () => {
    const response = await fetch(new URL('data/optimizer-rules.json', document.baseURI));
    const rules = await response.json() as {
      dailyDocumentLimits: { pve: number; pvp: number; 'pvp-seasonal': number };
    };
    return rules.dailyDocumentLimits;
  });
  await page.getByRole('button', { name: 'About this optimizer' }).click();
  const dialog = page.locator('[data-about-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'About this optimizer' })).toBeVisible();
  await expect(dialog.locator('[data-about-summary]')).toContainText('12 Battle Pass pages');
  await expect(dialog.locator('[data-about-table-body] tr')).toHaveCount(8);
  await expect(dialog).toContainText('Financial documents');
  await expect(dialog).toContainText('Customs');
  await expect(dialog).toContainText(
    `PvE allows ${limits.pve} documents per day, PvP allows ${limits.pvp}, and PvP Seasonal allows ${limits['pvp-seasonal']}.`,
  );
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('language navigation preserves the shared optimizer state', async ({ page }) => {
  await openWireframe(page);
  await setDocumentQuantity(page, 'documents.financial.name', 7);
  await page.locator('.ss-main.language-select').click();
  await page.locator('.ss-content.language-select .ss-option').filter({
    has: page.locator('[data-flag-region="ru"]'),
  }).click();

  await expect(page).toHaveURL(/\/eft-season-optimizer\/ru\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('7');
});

test('redirects a first Russian browser visit and keeps explicit Russian authoritative', async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page).toHaveURL(/\/eft-season-optimizer\/ru\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');

  await page.evaluate(() => {
    document.cookie = 'kord-breach-settings=; Max-Age=0; Path=/';
  });
  await page.goto(new URL('ru/', baseURL).href);
  await expect(page).toHaveURL(/\/eft-season-optimizer\/ru\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');
  await context.close();
});
