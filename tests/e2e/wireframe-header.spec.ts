import { expect, test } from '@playwright/test';

import { openWireframe } from './wireframe-helpers';

test('shows the season identity, relative countdown, totals, and default route profile', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-07T09:58:30.000Z') });
  await openWireframe(page);

  await expect(page.locator('.season-number')).toHaveText('S1');
  await expect(page.locator('.season-number')).toHaveAttribute('aria-label', 'Season 1');
  await expect(page.locator('[data-season-timer]')).toHaveText('122d 0h 1m');
  await expect(page.locator('[data-season-timer]')).toHaveAttribute('datetime', '2026-12-07T10:00:00.000Z');
  await expect(page.locator('[data-season-timer]')).toHaveAttribute('aria-label', /122 days, 0 hours, 1 minute/);

  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');
  await expect(page.locator('[data-document-progress-total]')).toHaveText('501');
  await expect(page.locator('[data-reward-progress-current]')).toHaveText('0');
  await expect(page.locator('[data-reward-progress-total]')).toHaveText('53');
  await expect(page.locator('[data-document-progress]')).toHaveJSProperty('value', 1);
  await expect(page.locator('[data-reward-progress]')).toHaveJSProperty('value', 0);
  await expect(page.locator('input[name="route-profile"][value="safest"]')).toBeChecked();
  await expect(page.locator('input[name="route-profile"][value="fastest"]')).not.toBeChecked();

  const fastestOption = page.locator('.route-profile-option').filter({ hasText: 'Fastest' });
  const fastestTooltip = page.locator('[data-fastest-tooltip]');
  const safestInput = page.locator('input[name="route-profile"][value="safest"]');
  const safestTooltip = page.locator('[data-safest-tooltip]');
  await expect(fastestTooltip).toHaveCSS('opacity', '0');
  await fastestOption.hover();
  await expect(fastestTooltip).toHaveCSS('opacity', '1');
  await expect(fastestTooltip).toHaveText('Fastest prioritizes raids with lower max time.');
  await page.mouse.move(1000, 800);
  await safestInput.focus();
  await expect(safestTooltip).toHaveCSS('opacity', '1');
  await expect(safestTooltip).toHaveText('Safest prioritizes raids with easier difficulty.');

  const helpTrigger = page.locator('[data-season-help-trigger]');
  const helpTooltip = page.locator('[data-season-help-tooltip]');
  await expect(helpTrigger.locator('svg.season-help__icon')).toHaveCount(1);
  await expect(helpTrigger).toHaveAttribute('aria-label', 'How to use the optimizer');
  const helpGeometry = await Promise.all([
    helpTrigger.boundingBox(),
    helpTrigger.locator('svg.season-help__icon').boundingBox(),
  ]);
  expect(helpGeometry.every(Boolean)).toBe(true);
  helpGeometry.forEach((box) => expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1));
  await expect(helpTooltip).toHaveCSS('opacity', '0');
  await helpTrigger.hover();
  await expect(helpTooltip).toHaveCSS('opacity', '1');
  await expect(helpTooltip).toContainText('Follow Next Raid');
  expect(await helpTooltip.textContent()).toContain('\n\nFollow Next Raid');
  await page.mouse.move(1000, 800);
  await helpTrigger.focus();
  await expect(helpTooltip).toHaveCSS('opacity', '1');
});

test('persists the Fastest route selection', async ({ page }) => {
  await openWireframe(page);

  await page.locator('.route-profile-option').filter({ hasText: 'Fastest' }).click();
  await expect(page.locator('input[name="route-profile"][value="fastest"]')).toBeChecked();
  await page.reload();
  await expect(page.locator('input[name="route-profile"][value="fastest"]')).toBeChecked();
});

test('orders and persists game modes while keeping the language selector icon-only', async ({ page }) => {
  await openWireframe(page);

  const modeControl = page.locator('.ss-main.mode-select');
  const languageControl = page.locator('.ss-main.language-select');
  await expect(modeControl).toContainText('PvP Seasonal · 25 / day');
  await expect(page.locator('[data-language-select]')).toHaveValue('en-GB');
  await expect(languageControl.locator('.locale-choice__flag[data-flag-region="gb"]')).toBeVisible();

  const languageNameStyle = await languageControl.locator('.locale-choice__name').evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, width: style.width, height: style.height, clipPath: style.clipPath };
  });
  expect(languageNameStyle).toEqual({ position: 'absolute', width: '1px', height: '1px', clipPath: 'inset(50%)' });

  const controlStyles = await Promise.all([modeControl, languageControl].map((control) => control.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { fontSize: style.fontSize, center: rect.top + rect.height / 2 };
  })));
  expect(controlStyles[0]?.fontSize).toBe(controlStyles[1]?.fontSize);
  expect(Math.abs((controlStyles[0]?.center ?? 0) - (controlStyles[1]?.center ?? 0))).toBeLessThanOrEqual(1);

  await modeControl.click();
  const modeMenu = page.locator('.ss-content.mode-select');
  await expect(modeMenu).toBeVisible();
  await expect(modeMenu.locator('.ss-option')).toHaveText([
    'PvP Seasonal · 25 / day',
    'PvP · 15 / day',
    'PvE · 10 / day',
  ]);
  const opensBelowMode = await Promise.all([modeControl, modeMenu].map((locator) => locator.boundingBox()));
  expect(opensBelowMode[1]!.y).toBeGreaterThanOrEqual(opensBelowMode[0]!.y + opensBelowMode[0]!.height - 1);
  await modeMenu.locator('.ss-option').filter({ hasText: 'PvP · 15 / day' }).click();
  await expect(page.locator('[data-mode-select]')).toHaveValue('pvp');
  await expect(modeControl).toContainText('PvP · 15 / day');

  await languageControl.click();
  const languageMenu = page.locator('.ss-content.language-select');
  await expect(languageMenu).toBeVisible();
  await expect(languageMenu.locator('.ss-option')).toHaveCount(1);
  await expect(languageMenu.locator('.locale-choice__flag[data-flag-region="gb"]')).toBeVisible();
  const opensBelowLanguage = await Promise.all([languageControl, languageMenu].map((locator) => locator.boundingBox()));
  expect(opensBelowLanguage[1]!.y).toBeGreaterThanOrEqual(opensBelowLanguage[0]!.y + opensBelowLanguage[0]!.height - 1);
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.locator('[data-mode-select]')).toHaveValue('pvp');
  await expect(page.locator('.ss-main.mode-select')).toContainText('PvP · 15 / day');
});

test('loads the production application without errors or failed app resources', async ({ page }) => {
  const errors: string[] = [];
  const failedResources: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failedResources.push(`${response.status()} ${response.url()}`);
  });

  await openWireframe(page);
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});
