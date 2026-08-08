import { expect, test } from '@playwright/test';

import { openWireframe } from './wireframe-helpers';

type Box = { x: number; y: number; width: number; height: number };

function gapBetween(left: Box, right: Box): number {
  return right.x - (left.x + left.width);
}

test('groups the header into summary and control sections across the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);

  const headerBoxes = await page.locator('.wireframe-header > .header-slot').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON() as Box),
  );
  const workspaceBoxes = await Promise.all([
    page.locator('.reward-rail').boundingBox(),
    page.locator('.focus-stage').boundingBox(),
  ]);
  expect(headerBoxes).toHaveLength(2);
  expect(workspaceBoxes.every(Boolean)).toBe(true);
  await expect(page.locator('.detail-rail')).toHaveCount(0);
  await expect(page.locator('.lower-band')).toHaveCount(0);

  expect(Math.abs(headerBoxes[0]!.x - workspaceBoxes[0]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(
    headerBoxes[1]!.x + headerBoxes[1]!.width
    - (workspaceBoxes[1]!.x + workspaceBoxes[1]!.width),
  )).toBeLessThanOrEqual(1);
  expect(gapBetween(headerBoxes[0]!, headerBoxes[1]!)).toBeGreaterThan(0);
  await expect(page.locator('.header-summary .season-slot')).toHaveCount(1);
  await expect(page.locator('.header-summary .primary-navigation-slot .navigation-progress')).toHaveCount(2);
  await expect(page.locator('.header-controls .route-profile-toggle')).toHaveCount(1);
  await expect(page.locator('.header-controls .account-slot')).toHaveCount(1);

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
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
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

test('switches to the stacked layout at the desktop minimum without viewport overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1181, height: 900 });
  await openWireframe(page);

  for (const width of [1181, 1180, 1024, 900, 833]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }))).toEqual({ viewportWidth: width, documentWidth: width });
  }

  const stackedRegionY = await Promise.all([
    page.locator('.focus-stage'),
    page.locator('.reward-rail'),
  ].map(async (locator) => (await locator.boundingBox())?.y ?? -1));
  expect(stackedRegionY[0]).toBeLessThan(stackedRegionY[1]);
});

test('keeps progress counters beside their labels in the stacked header', async ({ page }) => {
  await openWireframe(page);

  for (const width of [1180, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const progressRows = await page.locator('.navigation-progress').evaluateAll((rows) =>
      rows.map((row) => {
        const label = (row.querySelector('.navigation-progress__label-line')
          ?? row.querySelector('.navigation-progress__label'))!.getBoundingClientRect();
        const counter = row.querySelector('.navigation-progress__value')!.getBoundingClientRect();
        return { labelY: label.y, counterY: counter.y };
      }),
    );
    progressRows.forEach(({ labelY, counterY }) => expect(Math.abs(labelY - counterY)).toBeLessThanOrEqual(1));
  }
});

test('keeps planning selectors on one row below the stacked breakpoint when they fit', async ({ page }) => {
  await openWireframe(page);

  for (const width of [1180, 1024, 700]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = await Promise.all([
      page.locator('.route-profile-toggle'),
      page.locator('.ss-main.mode-select'),
      page.locator('.ss-main.language-select'),
    ].map((locator) => locator.boundingBox()));
    expect(controls.every(Boolean)).toBe(true);
    const centers = controls.map((box) => box!.y + box!.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  }
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
  expect(ribbonOverflow.scrollWidth).toBeLessThanOrEqual(ribbonOverflow.clientWidth);
  const counterRows = await page.locator('.document-strip__item').evaluateAll((items) =>
    new Set(items.map((item) => item.getBoundingClientRect().y)).size);
  expect(counterRows).toBeGreaterThan(1);
  const mobileNoteGeometry = await Promise.all([
    page.locator('.document-strip'),
    page.locator('[data-document-counter-note]'),
  ].map((locator) => locator.boundingBox()));
  expect(mobileNoteGeometry.every(Boolean)).toBe(true);
  expect(mobileNoteGeometry[1]!.x).toBeGreaterThanOrEqual(mobileNoteGeometry[0]!.x);
  expect(mobileNoteGeometry[1]!.x + mobileNoteGeometry[1]!.width)
    .toBeLessThanOrEqual(mobileNoteGeometry[0]!.x + mobileNoteGeometry[0]!.width);
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

test('keeps main header type and control geometry fixed across desktop viewports', async ({ page }) => {
  await openWireframe(page);

  const headerHeights = new Set<number>();
  const seasonNumberSizes = new Set<string>();
  const bodySizes = new Set<string>();
  const labelSizes = new Set<string>();
  const controlGeometry = [new Set<string>(), new Set<string>(), new Set<string>()];
  const verticalGeometry = new Set<string>();
  for (const viewport of [
    { width: 1181, height: 720 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    const header = page.locator('.wireframe-header');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    headerHeights.add(headerBox!.height);

    seasonNumberSizes.add(await page.locator('.season-number').evaluate((element) =>
      getComputedStyle(element).fontSize));
    bodySizes.add(await page.locator('.season-name').evaluate((element) =>
      getComputedStyle(element).fontSize));
    const labelElements = [
      page.locator('.season-timer'),
      page.locator('.navigation-progress__label').first(),
      page.locator('.navigation-progress__value').first(),
      page.locator('.route-profile-option__label').first(),
      page.locator('.ss-main.mode-select'),
      page.locator('.ss-main.language-select'),
    ];
    for (const element of labelElements) {
      labelSizes.add(await element.evaluate((node) => getComputedStyle(node).fontSize));
    }

    const controls = [
      page.locator('.route-profile-toggle'),
      page.locator('.ss-main.mode-select'),
      page.locator('.ss-main.language-select'),
    ];
    const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
    expect(boxes.every(Boolean)).toBe(true);
    for (const [index, box] of boxes.entries()) {
      controlGeometry[index]!.add(JSON.stringify({ width: box!.width, height: box!.height }));
    }
    const routeCenter = boxes[0]!.y + boxes[0]!.height / 2;
    const modeCenter = boxes[1]!.y + boxes[1]!.height / 2;
    const languageCenter = boxes[2]!.y + boxes[2]!.height / 2;
    expect(Math.max(routeCenter, modeCenter, languageCenter) - Math.min(routeCenter, modeCenter, languageCenter))
      .toBeLessThanOrEqual(1);
    verticalGeometry.add(JSON.stringify({
      routeTop: boxes[0]!.y - headerBox!.y,
      modeTop: boxes[1]!.y - headerBox!.y,
      languageTop: boxes[2]!.y - headerBox!.y,
    }));
  }

  expect([...headerHeights]).toEqual([96]);
  expect(seasonNumberSizes.size).toBe(1);
  expect([...bodySizes]).toEqual(['16px']);
  expect([...labelSizes]).toEqual(['13px']);
  expect(controlGeometry.every((geometry) => geometry.size === 1)).toBe(true);
  expect(verticalGeometry.size).toBe(1);
});

test('keeps body section headings at a fixed size and desktop height', async ({ page }) => {
  await openWireframe(page);

  const fontSizes = new Set<string>();
  const desktopHeights = new Set<number>();
  const desktopControlGeometry = new Set<string>();
  const actionWidths = [new Set<number>(), new Set<number>(), new Set<number>(), new Set<number>()];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1180, height: 900 },
    { width: 1181, height: 720 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    const headings = [
      page.locator('#reward-rail-heading'),
      page.locator('#focus-stage-heading'),
    ];
    const sizes = await Promise.all(headings.map((locator) =>
      locator.evaluate((element) => getComputedStyle(element).fontSize)));
    sizes.forEach((size) => fontSizes.add(size));
    if (viewport.width > 1180) {
      const sections = [
        page.locator('.reward-heading'),
        page.locator('.focus-heading'),
      ];
      const buttons = [
        page.locator('[data-reward-claim-all]'),
        page.locator('[data-reward-clear-all]'),
        page.locator('[data-view-route-schedule]'),
        page.locator('[data-commit-raid]'),
      ];
      const heights = await Promise.all(sections.map(async (locator) =>
        (await locator.boundingBox())?.height ?? 0));
      heights.forEach((height) => desktopHeights.add(height));
      const buttonBoxes = await Promise.all(buttons.map((locator) => locator.boundingBox()));
      expect(buttonBoxes.every(Boolean)).toBe(true);
      buttonBoxes.forEach((box, index) => actionWidths[index]!.add(box!.width));
      for (const [sectionIndex, section] of sections.entries()) {
        const sectionBox = await section.boundingBox();
        const buttonBox = buttonBoxes[sectionIndex * 2];
        expect(sectionBox).not.toBeNull();
        expect(buttonBox).not.toBeNull();
        const buttonFontSize = await buttons[sectionIndex * 2]!.evaluate((element) =>
          getComputedStyle(element).fontSize);
        const topGap = buttonBox!.y - sectionBox!.y;
        const bottomGap = sectionBox!.y + sectionBox!.height - buttonBox!.y - buttonBox!.height;
        expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(1);
        desktopControlGeometry.add(JSON.stringify({
          sectionHeight: sectionBox!.height,
          buttonHeight: buttonBox!.height,
          buttonFontSize,
          topGap,
          bottomGap,
        }));
      }
    }
  }

  expect([...fontSizes]).toEqual(['16px']);
  expect([...desktopHeights]).toEqual([54]);
  expect(desktopControlGeometry.size).toBe(1);
  expect(actionWidths.every((widths) => widths.size === 1)).toBe(true);
});

test('reveals the initialized interface without a startup layout shift', async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.defineProperty(window, '__layoutShiftValues', { value: shifts });
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) shifts.push(shift.value);
      });
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await openWireframe(page);
  await expect(page.locator('.wireframe-shell')).not.toHaveAttribute('data-app-pending');
  await page.waitForTimeout(100);
  const cumulativeLayoutShift = await page.evaluate(() =>
    ((window as typeof window & { __layoutShiftValues: number[] }).__layoutShiftValues)
      .reduce((total, value) => total + value, 0),
  );
  expect(cumulativeLayoutShift).toBe(0);
});

test('uses the screenshot palette without framed header slots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);

  const palette = await page.locator(':root').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      season: style.getPropertyValue('--season-accent').trim(),
      document: style.getPropertyValue('--document-border').trim(),
      action: style.getPropertyValue('--action-surface').trim(),
      purchase: style.getPropertyValue('--purchase-accent').trim(),
    };
  });
  expect(palette).toEqual({
    season: '#428c73',
    document: '#95d6bc',
    action: '#3f5960',
    purchase: '#af8a45',
  });

  const headerChrome = await page.locator('.wireframe-header > .header-slot').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderWidth };
    }),
  );
  expect(headerChrome).toEqual(Array.from({ length: 2 }, () => ({
    background: 'rgba(0, 0, 0, 0)',
    border: '0px',
  })));

  await expect(page.locator('.season-number')).toHaveCSS('color', 'rgb(66, 140, 115)');
  await expect(page.locator('[data-reward-claim-all]')).toHaveCSS('background-color', 'rgb(63, 89, 96)');
  await expect(page.locator('[data-commit-raid]')).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('[data-commit-raid]')).toHaveCSS('background-color', 'rgb(63, 89, 96)');
  const actionHeights = await Promise.all([
    '[data-reward-claim-all]',
    '[data-reward-clear-all]',
    '[data-view-route-schedule]',
    '[data-commit-raid]',
  ].map(async (selector) => (await page.locator(selector).boundingBox())?.height));
  expect(actionHeights.every(Boolean)).toBe(true);
  expect(Math.max(...actionHeights as number[]) - Math.min(...actionHeights as number[])).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-buyout-link]')).toHaveCSS('color', 'rgb(175, 138, 69)');
  await expect(page.locator('.document-strip__image-frame').first()).toHaveCSS('border-color', 'rgb(149, 214, 188)');
});
