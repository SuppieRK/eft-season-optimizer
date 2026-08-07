// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey } from '../src/catalogs';
import { renderApp, stopCountdown } from '../src/render';
import { createDefaultState, reduceState, type AppState, type StateAction } from '../src/state';

const paths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function catalogs() {
  return parseCatalogs(Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>);
}

afterEach(() => {
  stopCountdown(document);
  document.body.innerHTML = '';
});

describe('Battle Pass interface', () => {
  it('renders the selected-page, current-day, route-context, and inventory regions', () => {
    const catalog = catalogs();
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, createDefaultState(catalog), () => undefined);

    expect([...document.querySelectorAll('[data-region]')].map((node) => node.getAttribute('data-region'))).toEqual(['header', 'workspace', 'rewards', 'results', 'route-context', 'footer']);
    expect(document.querySelectorAll('.reward-page')).toHaveLength(1);
    expect(document.querySelectorAll('.reward-row')).toHaveLength(catalog.battlePass.pages[0].rewards.length);
    expect(document.querySelectorAll('.reward-row img')).toHaveLength(0);
    expect(document.querySelectorAll('.document-tile')).toHaveLength(9);
    expect(document.querySelector('.disclaimer')?.textContent).toContain('Battlestate Games');
    expect(document.querySelector('[data-countdown]')?.textContent).toContain('Season ends in');
    expect(document.querySelector('[data-countdown-end]')?.textContent).toContain('2026');
    expect(document.querySelector('.schedule-dialog:not([open])')).toBeTruthy();
    expect(document.querySelector('.setup-dialog:not([open])')).toBeTruthy();
    expect(document.querySelector('[data-field="mode"]')).toBeTruthy();
    expect(document.querySelector('[data-field="daily-limit"]')).toBeNull();
    expect(document.querySelector('.limit-readout')).toBeNull();
    expect(document.querySelectorAll('.mode-selector small')).toHaveLength(3);
    expect(document.querySelectorAll('[data-route-workspace]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-action="select-stop"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.route-document').length).toBeGreaterThan(0);
    expect(document.querySelector('.route-stop-context:not([hidden])')).toBeTruthy();
    expect(document.querySelector('.manifest-profile')).toBeTruthy();
    expect(document.querySelector('.manifest-reward-count')?.textContent).toContain('rewards remain');
    expect(document.querySelector('.manifest-estimated-days')?.textContent).toContain('Estimated days');
    expect(document.querySelector('.route-stop-context:not([hidden]) h3')?.textContent).toBeTruthy();
    expect(document.querySelector('.context-factor')?.textContent).toContain('maximum raid time');
    expect(document.querySelector('.context-disclosures > .plan-details')).toBeTruthy();
    expect(document.querySelector('.context-disclosures > .buyout')).toBeTruthy();
    expect(document.querySelectorAll('[data-action="set-profile"]')).toHaveLength(2);
    expect(document.querySelector('.header-actions > .profile-toggle + .locale-control')).toBeTruthy();
    expect(document.querySelector('[data-profile="safest"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.deficit-overview')).toBeNull();
    expect(document.querySelectorAll('.document-deficit').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.document-artwork')).toHaveLength(9);
    expect(document.querySelectorAll('.document-copy')).toHaveLength(9);
    expect(document.querySelector('.document-artwork .document-name')).toBeNull();
    expect(document.querySelector('.document-copy .document-name')).toBeTruthy();
    expect(document.querySelector('.document-copy + .quantity-stepper')).toBeTruthy();
    expect(document.querySelector('.page-unlocked')).toBeNull();
    expect(document.querySelector('.season-mark')).toBeNull();
    expect(document.querySelector('.context-day-outcome')).toBeTruthy();
    expect(document.querySelector('[data-field="locale"]')).toBeTruthy();
    expect(document.querySelector('[data-cookie-toast]')).toBeTruthy();
  });

  it('exposes keyboard-operable claims and inventory quantity controls', () => {
    const catalog = catalogs();
    const actions: unknown[] = [];
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, createDefaultState(catalog), (action) => actions.push(action));

    const claimAll = document.querySelector<HTMLButtonElement>('[data-action="claim-all"]')!;
    claimAll.click();
    const quantity = document.querySelector<HTMLInputElement>('[data-document-id="documents.financial.name"]')!;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('change', { bubbles: true }));

    expect(actions).toContainEqual({ type: 'claim-all', claimed: true });
    expect(actions).toContainEqual({ type: 'set-owned-document', documentId: 'documents.financial.name', quantity: 3 });
    expect(actions).not.toContainEqual({ type: 'dismiss-cookie-notice' });
    document.querySelector<HTMLButtonElement>('[data-action="dismiss-cookie-notice"]')!.click();
    expect(actions).toContainEqual({ type: 'dismiss-cookie-notice' });
    expect(document.querySelectorAll('button[data-action="increment"]')).toHaveLength(9);
    expect(document.querySelectorAll('button[data-action="decrement"]')).toHaveLength(9);
  });

  it('re-renders once per action, persists page and route choices, and keeps setup open', () => {
    const catalog = catalogs();
    let state: AppState = createDefaultState(catalog);
    const actions: StateAction[] = [];
    const dispatch = (action: StateAction): void => {
      actions.push(action);
      state = reduceState(state, action, catalog);
      renderApp(document, catalog, state, dispatch);
    };
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, state, dispatch);

    const pageSelect = document.querySelector<HTMLSelectElement>('[data-field="reward-page"]')!;
    pageSelect.value = '2';
    pageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.selectedPage).toBe(2);
    expect(document.querySelector('.reward-page[data-page="2"]')).toBeTruthy();

    for (let count = 0; count < 2; count += 1) {
      document.querySelector<HTMLButtonElement>('[data-document-id="documents.financial.name"][data-action="increment"]')!.click();
    }
    expect(document.querySelector<HTMLInputElement>('input[data-document-id="documents.financial.name"]')?.value).toBe('2');
    expect(actions.filter((action) => action.type === 'increment-document')).toHaveLength(2);

    const classified = document.querySelector<HTMLInputElement>('input[data-document-id="documents.classified.name"]')!;
    classified.value = '7';
    classified.dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.classifiedDocuments).toBe(7);
    expect(state.ownedDocuments['documents.classified.name']).toBe(0);

    document.querySelector<HTMLButtonElement>('[data-profile="safest"]')!.click();
    expect(state.selectedProfile).toBe('safest');
    expect(document.querySelector('[data-profile="safest"]')?.getAttribute('aria-pressed')).toBe('true');

    document.querySelector<HTMLButtonElement>('[data-action="open-setup"]')!.click();
    expect(document.querySelector('[data-setup-dialog]')?.hasAttribute('open')).toBe(true);
    document.querySelector<HTMLInputElement>('[data-field="mode"][value="pvp"]')!.click();
    expect(state.mode).toBe('pvp');
    expect(document.querySelector('[data-setup-dialog]')?.hasAttribute('open')).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-action="close-setup"]')!.click();
    expect(document.querySelector('[data-setup-dialog]')?.hasAttribute('open')).toBe(false);

    document.querySelector<HTMLButtonElement>('[data-action="open-schedule"]')!.click();
    expect(document.querySelector('[data-schedule-dialog]')?.hasAttribute('open')).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-action="close-schedule"]')!.click();
    expect(document.querySelector('[data-schedule-dialog]')?.hasAttribute('open')).toBe(false);
  });

  it('removes page guidance at the claim threshold without consuming owned documents', () => {
    const catalog = catalogs();
    let state: AppState = {
      ...createDefaultState(catalog),
      ownedDocuments: { ...createDefaultState(catalog).ownedDocuments, 'documents.financial.name': 3 },
    };
    const dispatch = (action: StateAction): void => {
      state = reduceState(state, action, catalog);
      renderApp(document, catalog, state, dispatch);
    };
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, state, dispatch);

    const pageSelect = document.querySelector<HTMLSelectElement>('[data-field="reward-page"]')!;
    pageSelect.value = '2';
    pageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.page-guidance')?.textContent).toContain('Claim 4 more from Page 1');
    document.querySelector<HTMLButtonElement>('[data-action="set-page"][data-page="1"]')!.click();
    for (let count = 0; count < 4; count += 1) {
      document.querySelector<HTMLInputElement>('.reward-page[data-page="1"] input[data-reward-id]:not(:checked)')!.click();
    }
    const updatedPageSelect = document.querySelector<HTMLSelectElement>('[data-field="reward-page"]')!;
    updatedPageSelect.value = '2';
    updatedPageSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.querySelector('.page-guidance')).toBeNull();
    expect(state.ownedDocuments['documents.financial.name']).toBe(3);
  });

  it('shows one Fastest crate plan and no profile toggle after every reward is claimed', () => {
    const catalog = catalogs();
    const claimedRewardIds = catalog.battlePass.pages.flatMap((page) => page.rewards.map((reward) => reward.id));
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, { ...createDefaultState(catalog), claimedRewardIds, selectedProfile: 'safest' }, () => undefined);

    expect(document.querySelector('[data-action="set-profile"]')).toBeNull();
    expect(document.querySelectorAll('[data-route-workspace]')).toHaveLength(1);
    expect(document.querySelector('[data-route-workspace]')?.textContent).toContain('Black Division');
    expect(document.querySelector('[data-field="crate-count"]')).toBeTruthy();
  });

  it('uses the same flat manifest for an immediate-claim plan', () => {
    const catalog = catalogs();
    const ownedDocuments = Object.fromEntries(catalog.documents.documents.map((document) => [document.id, document.kind === 'regular' ? 999 : 0]));
    document.body.innerHTML = '<div id="app"></div>';
    renderApp(document, catalog, { ...createDefaultState(catalog), ownedDocuments }, () => undefined);

    expect(document.querySelector('.claim-stage')).toBeTruthy();
    expect(document.querySelector('.route-stop-tabs')).toBeNull();
    expect(document.querySelector('.route-context .claim-list')).toBeTruthy();
  });
});
