import { expect, test } from '@playwright/test';

import { documentIds, documentQuantity, documentTile, openWireframe, setDocumentQuantity } from './wireframe-helpers';

const documentTitles = ['Financial', 'PMC', 'Project', 'Blueprints', 'Test', 'User', 'Medical', 'Technical', 'Classified'];

test('renders the square document artwork in source-of-truth order', async ({ page }) => {
  await openWireframe(page);

  await expect(page.locator('[data-document-id]')).toHaveCount(documentIds.length);
  expect(await page.locator('[data-document-id]').evaluateAll((tiles) => tiles.map((tile) => (tile as HTMLElement).dataset.documentId))).toEqual(documentIds);
  const renderedTitles = await page.locator('[data-document-title]').allTextContents();
  expect(renderedTitles.map((title) => title.replaceAll('\u00AD', ''))).toEqual(documentTitles);
  expect(renderedTitles.some((title) => title.includes('\u00AD'))).toBe(true);

  for (const documentId of documentIds) {
    const tile = documentTile(page, documentId);
    const frame = await tile.locator('.document-strip__image-frame').boundingBox();
    const title = await tile.locator('[data-document-title]').boundingBox();
    const quantity = await tile.locator('.document-strip__quantity').boundingBox();
    expect(frame).not.toBeNull();
    expect(title).not.toBeNull();
    expect(quantity).not.toBeNull();
    expect(Math.abs(frame!.width - frame!.height)).toBeLessThanOrEqual(1);
    expect(title!.y + title!.height).toBeLessThanOrEqual(frame!.y);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(quantity!.y);
    const image = tile.locator('img');
    await expect(image).toHaveAttribute('alt', /\S+/u);
    await expect(image).toHaveAttribute('width', '1254');
    await expect(image).toHaveAttribute('height', '1254');
    const targetSizes = await tile.locator('.document-strip__quantity > *').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    expect(targetSizes.every(({ width, height }) => width >= 24 && height >= 24)).toBe(true);
  }

  const geometries = await page.locator('[data-document-id]').evaluateAll((tiles) => tiles.map((tile) => {
    const frame = tile.querySelector('.document-strip__image-frame')!.getBoundingClientRect();
    const title = tile.querySelector('[data-document-title]')!.getBoundingClientRect();
    const quantity = tile.querySelector('.document-strip__quantity')!.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    return {
      tile: [tileBox.width, tileBox.height],
      title: [title.width, title.height],
      frame: [frame.width, frame.height],
      quantity: [quantity.width, quantity.height],
    };
  }));
  geometries.slice(1).forEach((geometry) => expect(geometry).toEqual(geometries[0]));

  const regularBorder = await documentTile(page, 'documents.financial.name').locator('.document-strip__image-frame').evaluate((element) => getComputedStyle(element).borderColor);
  const classifiedBorder = await documentTile(page, 'documents.classified.name').locator('.document-strip__image-frame').evaluate((element) => getComputedStyle(element).borderColor);
  expect(regularBorder).not.toBe(classifiedBorder);

  const ribbon = await page.locator('.document-strip__images').boundingBox();
  const strip = await page.locator('.document-strip').boundingBox();
  const counterNote = page.locator('[data-document-counter-note]');
  const counterNoteBox = await counterNote.boundingBox();
  expect(ribbon).not.toBeNull();
  expect(strip).not.toBeNull();
  expect(counterNoteBox).not.toBeNull();
  await expect(counterNote).toHaveText('Document counts are independent from reward claims and must be adjusted separately.');
  expect(counterNoteBox!.y + counterNoteBox!.height).toBeLessThanOrEqual(ribbon!.y);
  expect(Math.abs(ribbon!.x + ribbon!.width / 2 - (strip!.x + strip!.width / 2))).toBeLessThanOrEqual(1);
});

test('wraps Russian document titles at language-correct hyphenation points', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWireframe(page);
  await page.locator('.ss-main.language-select').click();
  await page.locator('.ss-content.language-select .ss-option')
    .filter({ has: page.locator('[data-flag-region="ru"]') })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', /^ru(?:-|$)/u);
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');

  const layout = await page.locator('[data-document-id]').evaluateAll((tiles) => tiles.map((tile) => {
    const title = tile.querySelector<HTMLElement>('[data-document-title]')!;
    const frame = tile.querySelector<HTMLElement>('.document-strip__image-frame')!.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(title);
    const lineBoxes = [...range.getClientRects()];
    return {
      hasSoftHyphen: title.textContent?.includes('\u00AD') ?? false,
      lineCount: lineBoxes.length,
      staysInsideTile: lineBoxes.every((box) => box.left >= tileBox.left - 1 && box.right <= tileBox.right + 1),
      staysAboveImage: lineBoxes.every((box) => box.bottom <= frame.top),
    };
  }));

  expect(layout.some(({ lineCount }) => lineCount > 1)).toBe(true);
  expect(layout.every(({ hasSoftHyphen, staysInsideTile, staysAboveImage }) =>
    hasSoftHyphen && staysInsideTile && staysAboveImage)).toBe(true);
  expect(await page.locator('.focus-content').evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
});

test('shows full document details and spawn locations in tooltips', async ({ page }) => {
  await openWireframe(page);

  for (const documentId of documentIds.slice(0, -1)) {
    const tile = documentTile(page, documentId);
    const tooltip = tile.getByRole('tooltip');
    await expect(tooltip.locator('strong')).toHaveText(/\S+/u);
    await expect(tooltip.locator('p')).toHaveText(/\S+/u);
    await expect(tooltip.locator('li')).not.toHaveCount(0);
  }

  await expect(documentTile(page, 'documents.blueprints.name').getByRole('tooltip')).toContainText('The Labyrinth');
  await expect(documentTile(page, 'documents.medical.name').getByRole('tooltip')).toContainText('The Labyrinth');
  await expect(documentTile(page, 'documents.classified.name').getByRole('tooltip').locator('li')).toHaveCount(0);

  const financialTile = documentTile(page, 'documents.financial.name');
  await financialTile.hover();
  await expect(financialTile.getByRole('tooltip')).toHaveCSS('opacity', '1');
});

test('updates quantities, progress, boundaries, and cookie-restored values together', async ({ page }) => {
  await openWireframe(page);

  const financialTile = documentTile(page, 'documents.financial.name');
  const classifiedTile = documentTile(page, 'documents.classified.name');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('1');

  await financialTile.locator('[data-document-decrement]').click();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  await financialTile.locator('[data-document-increment]').click({ clickCount: 2 });
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await classifiedTile.locator('[data-document-decrement]').click();
  await classifiedTile.locator('[data-document-decrement]').click();
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveAttribute('min', '1');
  await setDocumentQuantity(page, 'documents.project.name', 7);
  await expect(page.locator('[data-document-progress-current]')).toHaveText('10');

  await page.reload();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  await expect(documentQuantity(page, 'documents.project.name')).toHaveValue('7');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('[data-document-progress-current]')).toHaveText('10');
});

test('clamps direct inventory values instead of rejecting them', async ({ page }) => {
  await openWireframe(page);
  const financial = documentQuantity(page, 'documents.financial.name');
  const classified = documentQuantity(page, 'documents.classified.name');

  await financial.evaluate((input) => {
    input.value = '-4';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(financial).toHaveValue('0');

  await financial.evaluate((input) => {
    input.value = '3.9';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(financial).toHaveValue('3');

  await classified.evaluate((input) => {
    input.value = '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(classified).toHaveValue('1');
});

test('shows the centered asset disclaimer and resets cookie-backed state', async ({ page }) => {
  await openWireframe(page);

  const focus = page.locator('.focus-stage');
  const shell = page.locator('.wireframe-shell');
  const strip = page.locator('.document-strip');
  const images = page.locator('.document-strip__images');
  const footer = page.locator('.wireframe-footer');
  const disclaimer = page.locator('[data-asset-disclaimer]');
  const reset = page.locator('[data-reset-cookie-state]');

  await expect(disclaimer).toHaveText('Escape from Tarkov and all game assets displayed here belong to Battlestate Games. This is an unofficial fan-made optimization tool.');
  await expect(reset).toHaveText('Reset cookie storage');
  await expect(reset).toHaveJSProperty('tagName', 'BUTTON');
  await expect(reset).toHaveCSS('text-decoration-line', 'underline');

  await expect(focus.locator('.document-strip')).toHaveCount(1);
  await expect(strip.locator('.wireframe-footer')).toHaveCount(0);
  await expect(focus.locator('.wireframe-footer')).toHaveCount(0);
  const separators = footer.locator('.wireframe-footer__separator');
  await expect(separators).toHaveCount(2);
  await expect(separators.first()).toBeVisible();
  const [focusBox, shellBox, stripBox, imagesBox, footerBox] = await Promise.all([focus, shell, strip, images, footer].map((element) => element.boundingBox()));
  expect(focusBox).not.toBeNull();
  expect(shellBox).not.toBeNull();
  expect(stripBox).not.toBeNull();
  expect(imagesBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(focusBox!.y + focusBox!.height + 1);
  expect(footerBox!.y - (focusBox!.y + focusBox!.height)).toBeGreaterThanOrEqual(8);
  expect(Math.abs(footerBox!.x + footerBox!.width / 2 - (shellBox!.x + shellBox!.width / 2))).toBeLessThanOrEqual(1);
  const [disclaimerBox, resetBox, separatorBox] = await Promise.all([disclaimer, reset, separators.first()].map((element) => element.boundingBox()));
  expect(disclaimerBox).not.toBeNull();
  expect(resetBox).not.toBeNull();
  expect(separatorBox).not.toBeNull();
  expect(Math.abs(disclaimerBox!.y + disclaimerBox!.height / 2 - (resetBox!.y + resetBox!.height / 2))).toBeLessThanOrEqual(1);
  expect(separatorBox!.height).toBeGreaterThan(separatorBox!.width);

  await documentTile(page, 'documents.financial.name').locator('[data-document-increment]').click({ clickCount: 2 });
  await page.locator('#reward-page-trigger-2').click();
  await page.locator('.route-profile-option').filter({ hasText: 'Fastest' }).click();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('2');
  expect((await page.context().cookies()).length).toBeGreaterThan(0);

  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await Promise.all([page.waitForNavigation(), reset.click()]);

  expect(confirmation).toBe('Reset all planner selections?');
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('1');
  await expect(page.locator('#reward-page-trigger-1')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('input[name="route-profile"][value="safest"]')).toBeChecked();
  const plannerCookies = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith('kord-breach-'));
  expect(plannerCookies).toEqual([]);

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(footer).toHaveCSS('flex-direction', 'column');
  const [narrowDisclaimerBox, narrowResetBox, narrowSeparatorBox] = await Promise.all([disclaimer, reset, separators.first()].map((element) => element.boundingBox()));
  expect(narrowDisclaimerBox).not.toBeNull();
  expect(narrowResetBox).not.toBeNull();
  expect(narrowSeparatorBox).not.toBeNull();
  expect(narrowResetBox!.y).toBeGreaterThanOrEqual(narrowDisclaimerBox!.y + narrowDisclaimerBox!.height);
  expect(narrowSeparatorBox!.width).toBeGreaterThan(narrowSeparatorBox!.height);
});
