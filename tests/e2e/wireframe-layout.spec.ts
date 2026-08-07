import { expect, test } from '@playwright/test';

import { openWireframe } from './wireframe-helpers';

type Box = { x: number; y: number; width: number; height: number };

function gapBetween(left: Box, right: Box): number {
  return right.x - (left.x + left.width);
}

test('keeps the header tracks aligned with the reward rail and expanded Focus region', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);

  const headerBoxes = await page.locator('.wireframe-header > .header-slot').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON() as Box),
  );
  const workspaceBoxes = await Promise.all([
    page.locator('.reward-rail').boundingBox(),
    page.locator('.focus-stage').boundingBox(),
  ]);
  expect(headerBoxes).toHaveLength(3);
  expect(workspaceBoxes.every(Boolean)).toBe(true);
  await expect(page.locator('.detail-rail')).toHaveCount(0);
  await expect(page.locator('.lower-band')).toHaveCount(0);

  expect(Math.abs(headerBoxes[0]!.x - workspaceBoxes[0]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerBoxes[0]!.width - workspaceBoxes[0]!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerBoxes[1]!.x - workspaceBoxes[1]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(
    headerBoxes[2]!.x + headerBoxes[2]!.width
    - (workspaceBoxes[1]!.x + workspaceBoxes[1]!.width),
  )).toBeLessThanOrEqual(1);

  const horizontalGap = gapBetween(headerBoxes[0]!, headerBoxes[1]!);
  expect(horizontalGap).toBeGreaterThan(0);
  expect(Math.abs(horizontalGap - gapBetween(headerBoxes[1]!, headerBoxes[2]!))).toBeLessThanOrEqual(1);
  expect(Math.abs(horizontalGap - gapBetween(workspaceBoxes[0]!, workspaceBoxes[1]!))).toBeLessThanOrEqual(1);

  const focus = page.locator('.focus-stage');
  const documentStrip = await focus.locator('.document-strip').boundingBox();
  expect(documentStrip).not.toBeNull();
  expect(Math.abs(documentStrip!.x - workspaceBoxes[1]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(documentStrip!.x + documentStrip!.width - (workspaceBoxes[1]!.x + workspaceBoxes[1]!.width))).toBeLessThanOrEqual(1);
  expect(documentStrip!.y + documentStrip!.height).toBeLessThanOrEqual(workspaceBoxes[1]!.y + workspaceBoxes[1]!.height + 1);

  const footer = await page.locator('.wireframe-footer').boundingBox();
  expect(footer).not.toBeNull();
  expect(footer!.y).toBeGreaterThanOrEqual(workspaceBoxes[1]!.y + workspaceBoxes[1]!.height);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(900);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('preserves the desktop grid and avoids viewport overflow at the wide review size', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await openWireframe(page);

  await expect(page.locator('.reward-rail')).toBeVisible();
  await expect(page.locator('.focus-stage')).toBeVisible();
  await expect(page.locator('.detail-rail')).toHaveCount(0);
  await expect(page.locator('.document-strip')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('stacks the always-available raid workspace without mobile viewport overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWireframe(page);

  await expect(page.locator('[data-raid-result]')).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator('[data-commit-raid]')).toBeVisible();
  const regionY = await Promise.all([
    page.locator('.focus-stage'),
    page.locator('.reward-rail'),
    page.locator('.wireframe-footer'),
  ].map(async (locator) => (await locator.boundingBox())?.y ?? -1));
  expect(regionY).toEqual([...regionY].sort((left, right) => left - right));
  await expect(page.locator('.focus-stage .document-strip')).toHaveCount(1);
  const ribbonOverflow = await page.locator('.document-strip').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(ribbonOverflow.scrollWidth).toBeGreaterThan(ribbonOverflow.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('keeps season proportions and existing header controls on the shared type scale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);

  const seasonNumber = await page.locator('.season-number').boundingBox();
  const seasonDetails = await page.locator('.season-details').boundingBox();
  expect(seasonNumber).not.toBeNull();
  expect(seasonDetails).not.toBeNull();
  expect(Math.abs(seasonNumber!.height - seasonDetails!.height)).toBeLessThanOrEqual(1);

  const progressFontRoles = await page.locator('.navigation-progress__value').first().locator('span').evaluateAll((elements) =>
    elements.filter((element) => !element.getAttribute('aria-hidden')).map((element) => {
      const style = getComputedStyle(element);
      return { fontSize: style.fontSize, fontWeight: style.fontWeight };
    }),
  );
  expect(new Set(progressFontRoles.map(({ fontSize }) => fontSize)).size).toBe(1);
  expect(progressFontRoles.every(({ fontWeight }) => Number(fontWeight) >= 700)).toBe(true);

  const controlFontSizes = await Promise.all([
    page.locator('.route-profile-option span').first(),
    page.locator('.ss-main.mode-select'),
    page.locator('.ss-main.language-select'),
  ].map((locator) => locator.evaluate((element) => getComputedStyle(element).fontSize)));
  expect(new Set(controlFontSizes).size).toBe(1);
});
