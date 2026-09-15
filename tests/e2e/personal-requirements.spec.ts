import { expect, test, type Page } from '@playwright/test';
import { documentQuantity, setDocumentQuantity, trackRewardWithoutInventoryChange } from './wireframe-helpers';
import { readFile } from 'node:fs/promises';

test('personal requirements update totals and survive reload without changing inventory or claims', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const rewardId = await page.locator('[data-reward-id]').first().getAttribute('data-reward-id');
  await setDocumentQuantity(page, 'documents.financial.name', 7);
  await trackRewardWithoutInventoryChange(page, rewardId!);
  const totalBefore = await page.locator('[data-document-progress]').getAttribute('max');
  const editor = await openEditor(page);
  const quantity = editor.locator('[data-requirement-quantity]').first();
  const original = Number(await quantity.inputValue());
  await quantity.fill(String(original + 2));
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator('[data-document-progress]')).toHaveAttribute('max', String(Number(totalBefore) + 2));
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('7');
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).toBeChecked();
  await page.reload();
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-document-progress]')).toHaveAttribute('max', String(Number(totalBefore) + 2));
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('7');
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).toBeChecked();
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  await expect(page.locator('[data-requirement-quantity]').first()).toHaveValue(String(original + 2));
});

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  const editor = page.locator('.requirements-dialog:not(.requirements-import-dialog)');
  await editor.locator('summary').first().click();
  return editor;
}

async function downloadBackup(page: Page) {
  const editor = await openEditor(page);
  const download = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Export', exact: true }).click();
  const file = await readFile((await (await download).path())!);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  return JSON.parse(file.toString()) as {
    seasonId: string;
    requirements: Record<string, { documentId: string; quantity: number }[]>;
    state: { ownedDocuments: Record<string, number>; claimedRewardIds: string[]; locale: string };
  };
}

test('personal requirements stay pinned when catalog defaults temporarily match them', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const editor = await openEditor(page);
  const input = editor.locator('[data-requirement-quantity]').first();
  const personalQuantity = Number(await input.inputValue()) + 2;
  await input.fill(String(personalQuantity));
  await editor.getByRole('button', { name: 'Save changes' }).click();
  let serverQuantity = personalQuantity;
  await page.route('**/data/battle-pass.json', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.pages[0].rewards[0].requirements[0].quantity = serverQuantity;
    await route.fulfill({ json: catalog });
  });
  await page.reload();
  await openEditor(page);
  await expect(input).toHaveValue(String(personalQuantity));
  await editor.getByRole('button', { name: 'Save changes' }).click();
  serverQuantity += 4;
  await page.reload();
  await openEditor(page);
  await expect(input).toHaveValue(String(personalQuantity));
});

test('changed types immediately update farming, document needs, and redemption deductions', async ({ page }) => {
  await page.route('**/data/battle-pass.json', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.pages = [{ page: 1, rewards: [{ ...catalog.pages[0].rewards[0], requirements: [{ documentId: 'documents.financial.name', quantity: 3 }] }] }];
    await route.fulfill({ json: catalog });
  });
  await page.goto('./');
  await expect(page.locator('[data-focus-document="documents.financial.name"]')).toHaveAttribute('data-document-role', 'priority');
  const editor = await openEditor(page);
  await editor.locator('[data-requirement-document]').selectOption('documents.medical.name');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.focus-stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-focus-document="documents.medical.name"]')).toHaveAttribute('data-document-role', 'priority');
  await expect(page.locator('[data-document-id="documents.financial.name"] [data-document-need]')).toHaveText('(✓)');
  await expect(page.locator('[data-document-id="documents.medical.name"] [data-document-need]')).toHaveText('(3)');
  await expect(page.locator('.reward-item__requirements')).toContainText('(3)');
  await setDocumentQuantity(page, 'documents.medical.name', 2);
  await page.locator('[data-reward-id]').locator('..').click();
  await page.locator('.redemption-dialog').getByRole('button', { name: 'Redeem and subtract', exact: true }).click();
  await expect(documentQuantity(page, 'documents.medical.name')).toHaveValue('0');
  await expect(documentQuantity(page, 'documents.classified.name')).toHaveValue('0');
  await expect(page.locator('.reward-crate')).toBeVisible();
});

test('invalid imports and canceled compatibility previews preserve saved player data', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await setDocumentQuantity(page, 'documents.financial.name', 13);
  const backup = await downloadBackup(page);
  const editor = await openEditor(page);
  const upload = async (value: unknown) => editor.locator('input[type="file"]').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  await upload({ ...backup, seasonId: 'different-season' });
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(page.locator('.requirements-import-dialog')).toBeHidden();
  await upload({ broken: true });
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(page.locator('.requirements-import-dialog')).toBeHidden();
  const first = Object.keys(backup.requirements)[0];
  const incompatible = structuredClone(backup);
  incompatible.requirements[first] = [{ documentId: 'removed-document', quantity: 3 }];
  incompatible.requirements['removed-reward'] = [{ documentId: 'documents.financial.name', quantity: 2 }];
  await upload(incompatible);
  const preview = page.locator('.requirements-import-dialog');
  await expect(preview.locator('[data-adjustment-kind="requirements.defaultReward"]')).toBeVisible();
  await expect(preview.locator('[data-adjustment-kind="requirements.omittedReward"]')).toBeVisible();
  await preview.getByRole('button', { name: 'Cancel', exact: true }).click();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  expect(await downloadBackup(page)).toEqual(backup);
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('13');
});

test('failed storage writes do not discard previous requirements or progress', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await setDocumentQuantity(page, 'documents.financial.name', 9);
  const before = await downloadBackup(page);
  const editor = await openEditor(page);
  const input = editor.locator('[data-requirement-quantity]').first();
  await input.fill(String(Number(await input.inputValue()) + 4));
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'QuotaExceededError'); };
  });
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await page.reload();
  expect(await downloadBackup(page)).toEqual(before);
});

test('a failed complete import rolls back both cookie progress and personal requirements', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await setDocumentQuantity(page, 'documents.financial.name', 9);
  const before = await downloadBackup(page);
  const changed = structuredClone(before);
  changed.state.ownedDocuments['documents.financial.name'] = 40;
  changed.requirements[Object.keys(changed.requirements)[0]][0].quantity += 3;
  const editor = await openEditor(page);
  await editor.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
  const preview = page.locator('.requirements-import-dialog');
  await preview.getByRole('radio', { name: 'Complete backup', exact: true }).check();
  await page.evaluate(() => {
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    let failed = false;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookie.get!.call(document),
      set: (value: string) => {
        if (!failed && value.startsWith('kord-breach-ui=')) {
          failed = true;
          throw new DOMException('Cookie write blocked', 'SecurityError');
        }
        cookie.set!.call(document, value);
      },
    });
  });
  await preview.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(preview.getByRole('alert')).toBeVisible();
  await page.reload();
  expect(await downloadBackup(page)).toEqual(before);
});

test('duplicate or empty imported requirements never change saved data', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const before = await downloadBackup(page);
  const editor = await openEditor(page);
  const firstId = Object.keys(before.requirements)[0];
  for (const requirements of [[], [before.requirements[firstId][0], before.requirements[firstId][0]]]) {
    const changed = { ...before, requirements: { ...before.requirements, [firstId]: requirements } };
    await editor.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(page.locator('.requirements-import-dialog')).toBeHidden();
  }
  await page.reload();
  expect(await downloadBackup(page)).toEqual(before);
});

test('snapshot restoration retains exported requirements after catalog corrections', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const backup = await downloadBackup(page);
  await page.route('**/data/battle-pass.json', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.pages[0].rewards[0].requirements[0].quantity += 5;
    await route.fulfill({ json: catalog });
  });
  await page.reload();
  const editor = await openEditor(page);
  await editor.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator('.requirements-import-dialog').getByRole('button', { name: 'Replace', exact: true }).click();
  expect((await downloadBackup(page)).requirements).toEqual(backup.requirements);
  await page.reload();
  expect((await downloadBackup(page)).requirements).toEqual(backup.requirements);
});

test('complete reset removes personal requirements and progress but leaves unrelated storage intact', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const defaults = await downloadBackup(page);
  const editor = await openEditor(page);
  const quantity = editor.locator('[data-requirement-quantity]').first();
  await quantity.fill(String(Number(await quantity.inputValue()) + 2));
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await setDocumentQuantity(page, 'documents.financial.name', 10);
  await page.evaluate(() => localStorage.setItem('unrelated-app', 'keep'));
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-reset-cookie-state]').click();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('0');
  expect((await downloadBackup(page)).requirements).toEqual(defaults.requirements);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-app'))).toBe('keep');
});

test('Russian navigation preserves edits and the narrow editor keeps controls inside its boundary', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await setDocumentQuantity(page, 'documents.financial.name', 8);
  const editor = await openEditor(page);
  const quantity = editor.locator('[data-requirement-quantity]').first();
  const edited = String(Number(await quantity.inputValue()) + 2);
  await quantity.fill(edited);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('.ss-main.language-select').click();
  await page.locator('.ss-content.language-select .ss-option').filter({ has: page.locator('[data-flag-region="ru"]') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.requirements-edit-trigger').click();
  await editor.locator('summary').first().click();
  await expect(quantity).toHaveValue(edited);
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('8');
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await editor.evaluate((dialog) => {
    const frame = dialog.getBoundingClientRect();
    const content = dialog.querySelector('.requirements-editor-content')!;
    const visibleControls = [...dialog.querySelectorAll('button, input, select')].filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top >= frame.top && box.bottom <= frame.bottom;
    });
    return {
      left: frame.left, right: frame.right, bottom: frame.bottom,
      overflow: content.scrollWidth > content.clientWidth,
      controlsContained: visibleControls.every((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= frame.left && box.right <= frame.right;
      }),
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(390);
  expect(bounds.bottom).toBeLessThanOrEqual(844);
  expect(bounds.overflow).toBe(false);
  expect(bounds.controlsContained).toBe(true);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(page.locator('.requirements-edit-trigger')).toBeFocused();
});

test('editor text follows the app type scale and dropdown chevrons have balanced insets', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const editor = await openEditor(page);
  for (const width of [390, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    const textStyle = await page.locator('.reward-item__name').first().evaluate((node) => {
      const style = getComputedStyle(node);
      return { size: style.fontSize, family: style.fontFamily, lineHeight: style.lineHeight };
    });
    for (const selector of ['summary', 'h3', 'select', '[data-requirement-quantity]', 'footer button']) {
      const target = editor.locator(selector).first();
      await expect(target).toHaveCSS('font-size', textStyle.size);
      await expect(target).toHaveCSS('font-family', textStyle.family);
      await expect(target).toHaveCSS('line-height', textStyle.lineHeight);
    }
    const headingSize = await page.locator('.about-dialog h2').evaluate((node) => getComputedStyle(node).fontSize);
    await expect(editor.locator('h2')).toHaveCSS('font-size', headingSize);
    const spacing = await editor.locator('.requirements-select').first().evaluate((control) => {
      const select = control.querySelector('select')!;
      const style = getComputedStyle(select);
      const box = select.getBoundingClientRect();
      const arrow = control.querySelector('svg')!.getBoundingClientRect();
      return {
        left: parseFloat(style.paddingLeft),
        right: box.right - arrow.right,
        centerOffset: Math.abs((box.top + box.bottom - arrow.top - arrow.bottom) / 2),
        reserved: parseFloat(style.paddingRight),
        arrowWidth: arrow.width,
      };
    });
    expect(Math.abs(spacing.left - spacing.right)).toBeLessThanOrEqual(1);
    expect(spacing.centerOffset).toBeLessThanOrEqual(1);
    expect(spacing.reserved).toBeGreaterThan(spacing.arrowWidth + spacing.right);
  }
});

test('editor pages start collapsed and open or close independently of the main accordion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.reward-page__trigger').last().click();
  await page.locator('.requirements-edit-trigger').click();
  const editor = page.locator('.requirements-dialog:not(.requirements-import-dialog)');
  const first = editor.locator('details').first();
  const last = editor.locator('details').last();
  await expect(editor.locator('details[open]')).toHaveCount(0);
  await first.locator('summary').click();
  await last.locator('summary').click();
  await expect(editor.locator('details[open]')).toHaveCount(2);
  await first.locator('summary').click();
  await expect(editor.locator('details[open]')).toHaveCount(1);
  await expect(last).toHaveAttribute('open', '');
  await last.locator('summary').click();
  await expect(editor.locator('details[open]')).toHaveCount(0);
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.reward-page__trigger').last()).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.requirements-edit-trigger').click();
  await expect(editor.locator('details[open]')).toHaveCount(0);
});

test('canceled edits leave saved requirements unchanged and invalid entries cannot be saved', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  const total = await page.locator('[data-document-progress]').getAttribute('max');
  const editor = await openEditor(page);
  const reward = editor.locator('[data-edit-reward]').first();
  const original = await reward.locator('[data-requirement-quantity]').first().inputValue();
  await reward.locator('[data-requirement-quantity]').first().fill('0');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor).toBeVisible();
  await expect(page.locator('[data-document-progress]')).toHaveAttribute('max', total!);
  await reward.locator('[data-requirement-quantity]').first().fill('9');
  await reward.getByRole('button', { name: 'Add document' }).click();
  const firstType = await reward.locator('select').first().inputValue();
  await expect(reward.locator('select').last().locator(`option[value="${firstType}"]`)).toHaveJSProperty('disabled', true);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openEditor(page);
  await expect(reward.locator('[data-requirement-quantity]').first()).toHaveValue(original);
  while (await reward.locator('select').count() > 1) await reward.getByRole('button', { name: 'Remove', exact: true }).last().click();
  await expect(reward.getByRole('button', { name: 'Remove', exact: true })).toBeDisabled();
});

test('a complete snapshot can replace requirements only or restore all progress', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.wireframe-shell')).toHaveAttribute('aria-busy', 'false');
  await setDocumentQuantity(page, 'documents.financial.name', 7);
  const rewardId = await page.locator('[data-reward-id]').first().getAttribute('data-reward-id');
  await trackRewardWithoutInventoryChange(page, rewardId!);
  const editor = await openEditor(page);
  const quantity = editor.locator('[data-requirement-quantity]').first();
  const edited = String(Number(await quantity.inputValue()) + 3);
  await quantity.fill(edited);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const file = await readFile((await download.path())!);
  const backup = JSON.parse(file.toString()) as { requirements: Record<string, unknown> };
  expect(Object.keys(backup.requirements)).toHaveLength(await page.locator('[data-reward-id]').count());
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-reward-clear-all]').click();
  await setDocumentQuantity(page, 'documents.financial.name', 11);
  await openEditor(page);
  await editor.locator('[data-edit-reward]').first().getByRole('button', { name: 'Restore default' }).click();
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  await editor.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: file });
  const preview = page.locator('.requirements-import-dialog');
  await preview.getByRole('radio', { name: 'Requirements only', exact: true }).check();
  await preview.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('11');
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).not.toBeChecked();
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  await expect(quantity).toHaveValue(edited);
  await editor.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: file });
  await preview.getByRole('radio', { name: 'Complete backup', exact: true }).check();
  await preview.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('7');
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).toBeChecked();
  await page.reload();
  await expect(documentQuantity(page, 'documents.financial.name')).toHaveValue('7');
  await expect(page.locator(`[data-reward-id="${rewardId}"]`)).toBeChecked();
});
