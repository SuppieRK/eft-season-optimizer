import { expect, test } from '@playwright/test';

import { openWireframe } from './wireframe-helpers';

type Box = { x: number; y: number; width: number; height: number };

function gapBetween(left: Box, right: Box): number {
  return right.x - (left.x + left.width);
}

test('keeps the three header and workspace columns aligned on the desktop grid', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);

  const headerBoxes = await page.locator('.wireframe-header > .header-slot').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON() as Box),
  );
  const workspaceBoxes = await Promise.all([
    page.locator('.reward-rail').boundingBox(),
    page.locator('.focus-stage').boundingBox(),
    page.locator('.detail-rail').boundingBox(),
  ]);
  expect(headerBoxes).toHaveLength(3);
  expect(workspaceBoxes.every(Boolean)).toBe(true);

  for (let index = 0; index < 3; index += 1) {
    expect(Math.abs(headerBoxes[index]!.x - workspaceBoxes[index]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(headerBoxes[index]!.width - workspaceBoxes[index]!.width)).toBeLessThanOrEqual(1);
  }

  const horizontalGap = gapBetween(headerBoxes[0]!, headerBoxes[1]!);
  expect(horizontalGap).toBeGreaterThan(0);
  expect(Math.abs(horizontalGap - gapBetween(headerBoxes[1]!, headerBoxes[2]!))).toBeLessThanOrEqual(1);
  expect(Math.abs(horizontalGap - gapBetween(workspaceBoxes[0]!, workspaceBoxes[1]!))).toBeLessThanOrEqual(1);

  const documentStrip = await page.locator('.document-strip').boundingBox();
  expect(documentStrip).not.toBeNull();
  expect(Math.abs(documentStrip!.x - workspaceBoxes[0]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(documentStrip!.x + documentStrip!.width - (workspaceBoxes[2]!.x + workspaceBoxes[2]!.width))).toBeLessThanOrEqual(1);
  const verticalGap = documentStrip!.y - (workspaceBoxes[0]!.y + workspaceBoxes[0]!.height);
  expect(Math.abs(verticalGap - horizontalGap)).toBeLessThanOrEqual(1);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('preserves the desktop grid and avoids viewport overflow at the wide review size', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await openWireframe(page);

  await expect(page.locator('.reward-rail')).toBeVisible();
  await expect(page.locator('.focus-stage')).toBeVisible();
  await expect(page.locator('.detail-rail')).toBeVisible();
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
    page.locator('.detail-rail'),
    page.locator('.reward-rail'),
    page.locator('.document-strip'),
  ].map(async (locator) => (await locator.boundingBox())?.y ?? -1));
  expect(regionY).toEqual([...regionY].sort((left, right) => left - right));
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
