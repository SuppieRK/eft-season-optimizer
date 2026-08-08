import type { Catalogs } from './catalogs';
import { buildIssueUrl, composeFeedback, openIssueComposer, validateFeedbackMessage, type FeedbackConfig } from './feedback';
import { formatAccessibleRequirements, formatCompactRequirements, formatCountdownUnit, formatDateTime, formatLocalPrice, formatNumber, createLocalizer } from './localization';
import { optimize, type LocationAssignment, type NextRaidRecommendation, type OptimizerResult, type ProfileResult, type ScheduleDay } from './optimizer';
import { getClassifiedDocumentMinimum, type AppState, type StateAction } from './state';

let countdownTimer: number | undefined;
let countdownVisibilityHandler: (() => void) | undefined;

export function renderApp(documentRoot: Document, catalogs: Catalogs, state: AppState, dispatch: (action: StateAction) => void): void {
  const localizer = createLocalizer(catalogs.localization, state.locale);
  const app = documentRoot.querySelector<HTMLElement>('#app');
  if (!app) throw new Error('Application root is missing');
  const setupWasOpen = app.querySelector<HTMLDialogElement>('[data-setup-dialog]')?.open === true;
  const result = optimize({
    catalogs,
    claimedRewardIds: state.claimedRewardIds,
    ownedDocuments: state.ownedDocuments,
    classifiedDocuments: state.classifiedDocuments,
    spendTarCoinsOnClassifiedDocuments: state.spendTarCoinsOnClassifiedDocuments,
    mode: state.mode,
    locale: state.locale,
    crateCount: state.crateCount,
  });
  documentRoot.documentElement.lang = localizer.locale;
  documentRoot.documentElement.dir = localizer.direction;
  documentRoot.title = localizer.text('app.title');
  app.removeAttribute('aria-busy');
  app.innerHTML = `
    ${renderHeader(localizer, catalogs, state, result)}
    <main class="layout" data-region="workspace">
      <section class="workspace-region rewards" data-region="rewards" aria-labelledby="rewards-title">${renderRewards(localizer, catalogs, state)}</section>
      <section class="workspace-region results" data-region="results" aria-labelledby="results-title">${renderResults(localizer, catalogs, state, result)}</section>
      <aside class="workspace-region route-context" data-region="route-context" aria-labelledby="route-context-title">${renderRouteContext(localizer, state, result)}</aside>
    </main>
    ${renderFooter(localizer, catalogs, state, result)}
    ${renderSetupDialog(localizer, catalogs, state, result)}
    ${state.cookieNoticeDismissed ? '' : `<aside class="cookie-toast" role="status" data-cookie-toast><p>${escapeHtml(localizer.text('cookieNotice.message'))}</p><button type="button" data-action="dismiss-cookie-notice">${escapeHtml(localizer.text('cookieNotice.dismiss'))}</button></aside>`}
  `;
  bindEvents(app, dispatch, localizer);
  bindFeedback(app, catalogs, state, localizer);
  if (setupWasOpen) openDialog(app, '[data-setup-dialog]');
  startCountdown(documentRoot, localizer, catalogs.battlePass.endsAt);
}

export function stopCountdown(documentRoot: Document): void {
  if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
  if (countdownVisibilityHandler) documentRoot.removeEventListener('visibilitychange', countdownVisibilityHandler);
  countdownTimer = undefined;
  countdownVisibilityHandler = undefined;
}

function renderHeader(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, state: AppState, result: OptimizerResult): string {
  const locales = catalogs.localization.supportedLocales.map((locale) => `<option value="${escapeHtml(locale)}" ${locale === localizer.locale ? 'selected' : ''}>${escapeHtml(locale)}</option>`).join('');
  const rewardCount = catalogs.battlePass.pages.reduce((count, page) => count + page.rewards.length, 0);
  const modeName = localizer.text(`mode.${state.mode === 'pvp-seasonal' ? 'pvpSeasonal' : state.mode}`);
  const modeSummary = localizer.text('ui.modeSummary', { mode: modeName, count: formatNumber(result.effectiveDailyLimit, localizer.locale), day: localizer.text('ui.day') });
  return `<header class="site-header" data-region="header">
    <div class="season-identity"><div><p class="eyebrow">${escapeHtml(localizer.text(catalogs.battlePass.id))}</p><h1>${escapeHtml(localizer.text('app.title'))}</h1></div></div>
    <div class="header-stat"><span>${escapeHtml(localizer.text('ui.progress'))}</span><strong>${formatNumber(state.claimedRewardIds.length, localizer.locale)} / ${formatNumber(rewardCount, localizer.locale)}</strong></div>
    <div class="season-status"><strong data-countdown>${escapeHtml(localizer.text('season.countdown', { time: '…' }))}</strong><span data-countdown-end>${escapeHtml(localizer.text('season.endsAt', { time: formatDateTime(catalogs.battlePass.endsAt, localizer.locale) }))}</span></div>
    <div class="header-actions">
      ${result.goal === 'all-unclaimed-rewards' ? renderProfileToggle(localizer, state) : ''}
      <label class="locale-control"><span>${escapeHtml(localizer.text('ui.locale'))}</span><select data-field="locale">${locales}</select></label>
      <button class="setup-trigger" type="button" data-action="open-setup">${escapeHtml(modeSummary)}</button>
    </div>
  </header>`;
}

function renderRewards(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, state: AppState): string {
  const claimedRewardIds = new Set(state.claimedRewardIds);
  const selectedIndex = Math.max(0, catalogs.battlePass.pages.findIndex((page) => page.page === state.selectedPage));
  const page = catalogs.battlePass.pages[selectedIndex];
  const previousPage = catalogs.battlePass.pages[selectedIndex - 1];
  const requiredClaims = previousPage ? Math.max(0, previousPage.rewards.length - 1) : 0;
  const claimedOnPreviousPage = previousPage?.rewards.filter((reward) => claimedRewardIds.has(reward.id)).length ?? 0;
  const claimsNeeded = Math.max(0, requiredClaims - claimedOnPreviousPage);
  const unlock = previousPage && claimsNeeded > 0 ? `<small class="page-guidance">${escapeHtml(localizer.text('ui.claimMoreFromPage', { count: claimsNeeded, page: previousPage.page }))}</small>` : '';
  const rows = page.rewards.map((reward) => {
    const compact = formatCompactRequirements(reward.requirements, Object.fromEntries(reward.requirements.map((requirement) => [requirement.documentId, compactDocumentLabel(localizer.text(requirement.documentId))])), localizer.locale);
    const accessible = formatAccessibleRequirements(reward.requirements, Object.fromEntries(reward.requirements.map((requirement) => [requirement.documentId, localizer.text(requirement.documentId)])), localizer.locale);
    const claimed = state.claimedRewardIds.includes(reward.id);
    return `<li class="reward-row"><label><input type="checkbox" data-reward-id="${escapeHtml(reward.id)}" ${claimed ? 'checked' : ''} /> <span>${escapeHtml(localizer.text(reward.id))}</span></label><span class="requirement-compact" title="${escapeHtml(accessible)}">${escapeHtml(compact)}</span></li>`;
  }).join('');
  const pageOptions = catalogs.battlePass.pages.map((candidate) => `<option value="${candidate.page}" ${candidate.page === page.page ? 'selected' : ''}>${candidate.page} / ${catalogs.battlePass.pages.length}</option>`).join('');
  return `<div class="section-heading"><h2 id="rewards-title">${escapeHtml(localizer.text('battlePass.rewardList'))}</h2><div><button type="button" data-action="claim-all">${escapeHtml(localizer.text('battlePass.claimAll'))}</button><button type="button" data-action="clear-all">${escapeHtml(localizer.text('battlePass.clearAll'))}</button></div></div>
    <nav class="reward-page-nav" aria-label="${escapeHtml(localizer.text('battlePass.page'))}">
      <button type="button" data-action="set-page" data-page="${previousPage?.page ?? page.page}" ${previousPage ? '' : 'disabled'} aria-label="${escapeHtml(localizer.text('ui.previousPage'))}">‹</button>
      <label><span>${escapeHtml(localizer.text('battlePass.page'))}</span><select data-field="reward-page">${pageOptions}</select></label>
      <button type="button" data-action="set-page" data-page="${catalogs.battlePass.pages[selectedIndex + 1]?.page ?? page.page}" ${selectedIndex + 1 < catalogs.battlePass.pages.length ? '' : 'disabled'} aria-label="${escapeHtml(localizer.text('ui.nextPage'))}">›</button>
    </nav>
    <section class="reward-page" data-page="${page.page}">
      <header class="reward-page-header"><div><strong>${escapeHtml(localizer.text('battlePass.page'))} ${page.page}</strong>${unlock}</div><div class="page-actions"><button type="button" data-action="claim-page" data-page="${page.page}">${escapeHtml(localizer.text('battlePass.claimAll'))}</button><button type="button" data-action="clear-page" data-page="${page.page}">${escapeHtml(localizer.text('battlePass.clearAll'))}</button></div></header>
      <ul>${rows}</ul>
    </section>`;
}

function renderSetupDialog(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, state: AppState, result: OptimizerResult): string {
  const modes = (['pvp-seasonal', 'pvp', 'pve'] as const).map((mode) => {
    const label = localizer.text(`mode.${mode === 'pvp-seasonal' ? 'pvpSeasonal' : mode}`);
    return `<label><input type="radio" name="mode" value="${mode}" data-field="mode" ${state.mode === mode ? 'checked' : ''} /><span>${escapeHtml(label)}</span><small>${formatNumber(catalogs.optimizerRules.dailyDocumentLimits[mode], localizer.locale)} / ${escapeHtml(localizer.text('ui.day'))}</small></label>`;
  }).join('');
  return `<dialog class="setup-dialog" data-setup-dialog aria-labelledby="setup-dialog-title"><header><h2 id="setup-dialog-title">${escapeHtml(localizer.text('ui.controls'))}</h2><button type="button" data-action="close-setup">${escapeHtml(localizer.text('ui.close'))}</button></header><div class="setup-fields">
      <fieldset class="mode-selector"><legend>${escapeHtml(localizer.text('optimizer.mode'))}</legend><div>${modes}</div></fieldset>
      <label class="check-row"><input type="checkbox" data-field="spending" ${state.spendTarCoinsOnClassifiedDocuments ? 'checked' : ''} /> ${escapeHtml(localizer.text('optimizer.includeTarCoins'))}</label>
      ${result.goal === 'black-division-crates' ? `<label>${escapeHtml(localizer.text('ui.crateCount'))}<input type="number" min="1" step="1" value="${state.crateCount}" data-field="crate-count" /></label>` : ''}
    </div><footer><button class="danger-action" type="button" data-action="reset">${escapeHtml(localizer.text('ui.reset'))}</button></footer></dialog>`;
}

function renderResults(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, state: AppState, result: OptimizerResult): string {
  const profile = result.profiles[result.goal === 'black-division-crates' ? 'fastest' : state.selectedProfile];
  return `<div class="results-heading"><h2 id="results-title">${escapeHtml(localizer.text('ui.results'))}</h2></div>${renderRouteWorkspace(localizer, catalogs, profile, result)}${renderScheduleDialog(localizer, profile)}`;
}

function renderProfileToggle(localizer: ReturnType<typeof createLocalizer>, state: AppState): string {
  return `<div class="profile-toggle" role="group" aria-label="${escapeHtml(localizer.text('ui.routePreference'))}">${(['fastest', 'safest'] as const).map((profile) => `<button type="button" data-action="set-profile" data-profile="${profile}" aria-pressed="${state.selectedProfile === profile}" title="${escapeHtml(localizer.text(`ui.${profile}Reason`))}">${escapeHtml(localizer.text(`optimizer.${profile}`))}</button>`).join('')}</div>`;
}

function renderRouteWorkspace(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, profile: ProfileResult, result: OptimizerResult): string {
  const title = localizer.text(`optimizer.${profile.profile}`);
  const heading = result.goal === 'black-division-crates'
    ? localizer.text('optimizer.blackDivisionFallback')
    : localizer.text('ui.unclaimedRewards', { count: formatNumber(result.unclaimedRewardIds.length, localizer.locale) });
  const header = `<header class="manifest-header">
    <div class="manifest-profile"><p class="eyebrow">${escapeHtml(title)}</p>${result.profilesCoincide && result.goal === 'all-unclaimed-rewards' ? `<small>${escapeHtml(localizer.text('ui.sameRoute'))}</small>` : ''}</div>
    <h3 class="manifest-reward-count">${escapeHtml(heading)}</h3>
    <strong class="manifest-estimated-days">${escapeHtml(localizer.text('ui.estimatedDays', { count: profile.schedule.length }))}</strong>
  </header>`;
  if (!profile.route.available) return `<article class="route-workspace unavailable" data-route-workspace>${header}<p class="manifest-empty">${escapeHtml(localizer.text('optimizer.noRoute'))}</p></article>`;
  const firstDay = profile.schedule[0];
  const crate = result.goal === 'black-division-crates' ? `<p class="crate-shortage">${escapeHtml(localizer.text('ui.crateShortage', { count: formatNumber(result.cratePlan!.regularDocumentsToFarm, localizer.locale) }))}</p>` : '';
  const action = firstDay
    ? renderCurrentRouteDay(localizer, catalogs, firstDay)
    : profile.nextRaid ? renderStockpileRaid(localizer, catalogs, profile.nextRaid) : `<div class="manifest-empty"><p class="eyebrow">${escapeHtml(localizer.text('ui.nextAction'))}</p><h3 class="manifest-action-title">${escapeHtml(localizer.text('ui.readyNow'))}</h3></div>`;
  return `<article class="route-workspace" data-route-workspace>${header}<p class="estimate-note">${escapeHtml(localizer.text('ui.planEstimate'))}</p>${crate}${action}</article>`;
}

function renderCurrentRouteDay(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, day: ScheduleDay): string {
  const stops = day.locations.map((location, index) => {
    const name = localizer.text(location.locationId);
    const label = localizer.text('ui.routeStopLabel', { current: index + 1, total: day.locations.length, location: name });
    return `<button type="button" role="tab" data-action="select-stop" data-stop-index="${index}" aria-selected="${index === 0}" aria-controls="route-stop-panel-${index}" aria-label="${escapeHtml(label)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(name)}</strong></button>`;
  }).join('');
  const panels = day.locations.map((location, index) => `<section class="route-stop-panel" id="route-stop-panel-${index}" data-stop-panel="${index}" role="tabpanel" ${index === 0 ? '' : 'hidden'}>${renderAssignedDocumentArtwork(localizer, catalogs, location)}</section>`).join('');
  return `<section class="current-route-day" data-schedule-day="${day.day}"><header><p class="eyebrow">${escapeHtml(localizer.text('ui.farmNext'))}</p><h3>${escapeHtml(localizer.text('ui.scheduleDay', { day: day.day, count: formatNumber(day.documentQuantity, localizer.locale) }))}</h3></header><div class="route-stop-tabs" role="tablist" aria-label="${escapeHtml(localizer.text('ui.farmLocations'))}">${stops}</div><div class="route-stop-stage">${panels}</div></section>`;
}

function renderAssignedDocumentArtwork(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, location: LocationAssignment): string {
  return `<div class="route-documents">${location.documents.map((assignment) => {
    const document = catalogs.documents.documents.find((candidate) => candidate.id === assignment.documentId);
    if (!document) return '';
    return `<article class="route-document"><img src="${escapeHtml(assetUrl(document.imagePath))}" alt="${escapeHtml(localizer.text(document.imageAltId))}" width="1254" height="1254" /><div><strong>${escapeHtml(localizer.text(document.id))}</strong><span>× ${formatNumber(assignment.quantity, localizer.locale)}</span></div></article>`;
  }).join('')}</div>`;
}

function renderStockpileRaid(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, raid: NextRaidRecommendation): string {
  const documents = raid.documents.map((recommendation) => {
    const document = catalogs.documents.documents.find((candidate) => candidate.id === recommendation.documentId);
    if (!document) return '';
    return `<article class="route-document" data-document-role="${recommendation.role}"><img src="${escapeHtml(assetUrl(document.imagePath))}" alt="${escapeHtml(localizer.text(document.imageAltId))}" width="1254" height="1254" /><div><strong>${escapeHtml(localizer.text(document.id))}</strong><span>${escapeHtml(localizer.text('ui.stockpileDocument'))}</span></div></article>`;
  }).join('');
  return `<section class="current-route-day route-stockpile"><header><p class="eyebrow">${escapeHtml(localizer.text('ui.crateStockpileRaid'))}</p><h3>${escapeHtml(localizer.text(raid.locationId))}</h3></header><div class="route-stop-stage"><div class="route-documents">${documents}</div></div></section>`;
}

function renderRouteContext(localizer: ReturnType<typeof createLocalizer>, state: AppState, result: OptimizerResult): string {
  const profile = result.profiles[result.goal === 'black-division-crates' ? 'fastest' : state.selectedProfile];
  const firstDay = profile.schedule[0];
  let primary: string;
  if (!profile.route.available) {
    primary = `<p class="context-empty warning">${escapeHtml(localizer.text('optimizer.noRoute'))}</p>`;
  } else if (firstDay) {
    primary = firstDay.locations.map((location, index) => renderStopContext(localizer, location, index, firstDay.locations.length)).join('');
  } else if (profile.nextRaid) {
    primary = renderStockpileContext(localizer, profile.nextRaid);
  } else {
    primary = `<div class="context-empty"><p class="eyebrow">${escapeHtml(localizer.text('ui.nextAction'))}</p><strong>${escapeHtml(localizer.text('ui.readyNow'))}</strong></div>`;
  }
  const dayClaims = firstDay?.rewardIdsClaimed.length ? `<section class="context-day-outcome"><p class="eyebrow">${escapeHtml(localizer.text('ui.claimOnDay'))}</p><ul class="day-claims-list">${firstDay.rewardIdsClaimed.map((id) => `<li>${escapeHtml(localizer.text(id))}</li>`).join('')}</ul></section>` : '';
  const schedule = profile.schedule.length > 0 ? `<div class="context-actions"><button type="button" data-action="open-schedule">${escapeHtml(localizer.text('ui.viewFullSchedule'))}</button></div>` : '';
  return `<h2 id="route-context-title">${escapeHtml(localizer.text('ui.routeStop'))}</h2><div class="route-context-primary">${primary}</div>${dayClaims}${schedule}<div class="context-disclosures">${renderPlanDetails(localizer, profile)}${result.goal === 'all-unclaimed-rewards' ? renderBuyout(localizer, result) : ''}</div>`;
}

function renderStockpileContext(localizer: ReturnType<typeof createLocalizer>, raid: NextRaidRecommendation): string {
  const difficulty = localizer.text(raid.difficultyId);
  return `<section class="route-stop-context" data-stockpile-context><p class="eyebrow">${escapeHtml(localizer.text('ui.crateStockpileRaid'))}</p><h3>${escapeHtml(localizer.text(raid.locationId))}</h3><p class="context-factor">${escapeHtml(localizer.text('ui.locationFactor', { difficulty, minutes: formatNumber(raid.maxRaidTimeMin, localizer.locale) }))}</p><ul class="context-document-list">${raid.documents.map((document) => `<li><span>${escapeHtml(localizer.text(document.documentId))}</span><strong>${escapeHtml(localizer.text('ui.stockpileDocument'))}</strong></li>`).join('')}</ul></section>`;
}

function renderStopContext(localizer: ReturnType<typeof createLocalizer>, location: LocationAssignment, index: number, total: number): string {
  const name = localizer.text(location.locationId);
  const difficulty = localizer.text(location.difficultyId);
  return `<section class="route-stop-context" data-stop-context="${index}" ${index === 0 ? '' : 'hidden'}><p class="eyebrow">${escapeHtml(localizer.text('ui.routeStopLabel', { current: index + 1, total, location: name }))}</p><h3>${escapeHtml(name)}</h3><p class="context-factor">${escapeHtml(localizer.text('ui.locationFactor', { difficulty, minutes: formatNumber(location.maxRaidTimeMin, localizer.locale) }))}</p><ul class="context-document-list">${location.documents.map((document) => `<li><span>${escapeHtml(localizer.text(document.documentId))}</span><strong>× ${formatNumber(document.quantity, localizer.locale)}</strong></li>`).join('')}</ul></section>`;
}

function renderPlanDetails(localizer: ReturnType<typeof createLocalizer>, profile: ProfileResult): string {
  const exchanges = profile.exchanges.length > 0 ? `<p>${escapeHtml(localizer.text('ui.exchange', { count: profile.exchanges.length }))}</p>` : '';
  const purchases = profile.purchases.bundleCounts.some((count) => count > 0) ? `<p>${escapeHtml(localizer.text('ui.classifiedPurchases'))}</p>` : '';
  const warnings = profile.warnings.map((warning) => `<p class="warning">${escapeHtml(localizer.text('ui.warning', { text: warning }))}</p>`).join('');
  return `<details class="plan-details"><summary>${escapeHtml(localizer.text('ui.planDetails'))}</summary><div><p>${escapeHtml(localizer.text('ui.classifiedUse', { used: formatNumber(profile.classifiedConsumed, localizer.locale), remaining: formatNumber(profile.classifiedRemaining, localizer.locale) }))}</p>${exchanges}${purchases}${warnings}</div></details>`;
}

function renderScheduleDay(localizer: ReturnType<typeof createLocalizer>, day: ScheduleDay, focused = false): string {
  const claims = day.rewardIdsClaimed.length > 0 ? `<div class="day-claims"><strong class="day-claims-label">${escapeHtml(localizer.text('ui.claimOnDay'))}</strong><ul class="day-claims-list">${day.rewardIdsClaimed.map((id) => `<li>${escapeHtml(localizer.text(id))}</li>`).join('')}</ul></div>` : '';
  const locations = day.locations.map((location) => {
    const difficulty = localizer.text(location.difficultyId);
    const factor = localizer.text('ui.locationFactor', { difficulty, minutes: formatNumber(location.maxRaidTimeMin, localizer.locale) });
    return `<li class="manifest-location">
      <strong class="manifest-location-name">${escapeHtml(localizer.text(location.locationId))}</strong>
      <span class="manifest-documents">${location.documents.map((document) => `${escapeHtml(localizer.text(document.documentId))} × ${formatNumber(document.quantity, localizer.locale)}`).join(' · ')}</span>
      <small class="manifest-difficulty">${escapeHtml(difficulty)}</small>
      <small class="manifest-raid-time" title="${escapeHtml(factor)}">${escapeHtml(formatCountdownUnit(location.maxRaidTimeMin, localizer.locale, 'minute'))}</small>
    </li>`;
  }).join('');
  const action = focused ? `<div class="manifest-action"><p class="eyebrow">${escapeHtml(localizer.text('ui.nextAction'))}</p><h3 class="manifest-action-title">${escapeHtml(localizer.text('ui.farmNext'))}</h3></div>` : '';
  return `<section class="manifest-day ${focused ? 'manifest-next' : ''}" data-schedule-day="${day.day}"><header class="manifest-day-header">${action}<h4 class="manifest-day-total">${escapeHtml(localizer.text('ui.scheduleDay', { day: day.day, count: formatNumber(day.documentQuantity, localizer.locale) }))}</h4></header><ul class="manifest-locations">${locations}</ul>${claims}</section>`;
}

function renderScheduleDialog(localizer: ReturnType<typeof createLocalizer>, profile: ProfileResult): string {
  if (profile.schedule.length === 0) return '';
  return `<dialog class="schedule-dialog" data-schedule-dialog aria-labelledby="schedule-dialog-title"><header><div><p class="eyebrow">${escapeHtml(localizer.text(`optimizer.${profile.profile}`))}</p><h2 id="schedule-dialog-title">${escapeHtml(localizer.text('ui.fullSchedule'))}</h2></div><button type="button" data-action="close-schedule">${escapeHtml(localizer.text('ui.close'))}</button></header><div class="schedule-list">${profile.schedule.map((day) => renderScheduleDay(localizer, day)).join('')}</div></dialog>`;
}

function renderBuyout(localizer: ReturnType<typeof createLocalizer>, result: OptimizerResult): string {
  const buyout = result.buyout;
  const localPrice = buyout.localEstimate && buyout.localEstimate.price > 0 && buyout.localEstimate.currency
    ? formatLocalPrice({ price: buyout.localEstimate.price, currency: buyout.localEstimate.currency }, localizer.locale)
    : undefined;
  return `<details class="buyout"><summary>${escapeHtml(localizer.text('ui.buyout'))}</summary><div><p>${escapeHtml(localizer.text('ui.buyoutGrossTarCoins', { count: formatNumber(buyout.grossTarCoinsSpent, localizer.locale) }))}</p>${localPrice ? `<p>${escapeHtml(localizer.text('ui.tarCoinPackageCost', { price: localPrice }))}</p>` : ''}</div></details>`;
}

function renderFooter(localizer: ReturnType<typeof createLocalizer>, catalogs: Catalogs, state: AppState, result: OptimizerResult): string {
  const deficits = result.profiles[result.goal === 'black-division-crates' ? 'fastest' : state.selectedProfile].route.deficits;
  const documents = catalogs.documents.documents.map((document) => {
    const name = localizer.text(document.id);
    const quantity = document.kind === 'classified' ? state.classifiedDocuments : state.ownedDocuments[document.id] ?? 0;
    const minimum = document.kind === 'classified' ? getClassifiedDocumentMinimum(state.claimedRewardIds) : 0;
    const deficit = document.kind === 'regular' ? deficits[document.id] ?? 0 : 0;
    return `<article class="document-tile ${document.kind}" data-document-card="${escapeHtml(document.id)}">
      <div class="document-artwork"><img src="${escapeHtml(assetUrl(document.imagePath))}" alt="${escapeHtml(localizer.text(document.imageAltId))}" width="1254" height="1254" /></div>
      <div class="document-copy"><span class="document-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>${deficit > 0 ? `<span class="document-deficit" data-deficit="${deficit}">${escapeHtml(localizer.text('ui.stillNeed', { count: formatNumber(deficit, localizer.locale) }))}</span>` : ''}</div>
      <div class="quantity-stepper"><button type="button" data-action="decrement" data-document-id="${escapeHtml(document.id)}" data-document-kind="${document.kind}" aria-label="${escapeHtml(`${localizer.text('ui.quantity')} − ${name}`)}">−</button><label><span class="sr-only">${escapeHtml(`${localizer.text('ui.quantity')} ${name}`)}</span><input type="number" min="${minimum}" step="1" value="${quantity}" data-document-id="${escapeHtml(document.id)}" data-document-kind="${document.kind}" /></label><button type="button" data-action="increment" data-document-id="${escapeHtml(document.id)}" data-document-kind="${document.kind}" aria-label="${escapeHtml(`${localizer.text('ui.quantity')} + ${name}`)}">+</button></div>
    </article>`;
  }).join('');
  return `<footer class="site-footer" data-region="footer"><div class="section-heading"><h2>${escapeHtml(localizer.text('ui.documentsOwned'))}</h2></div><div class="document-tray">${documents}</div><div class="footer-meta"><p class="disclaimer">${escapeHtml(localizer.text('footer.disclaimer'))}</p><details class="feedback"><summary>${escapeHtml(localizer.text('feedback.button'))}</summary><form class="feedback-form" data-feedback-form><h3>${escapeHtml(localizer.text('feedback.heading'))}</h3><label>${escapeHtml(localizer.text('feedback.message'))}<textarea data-feedback-message maxlength="2000" rows="5"></textarea></label><label class="check-row"><input type="checkbox" data-feedback-context /> ${escapeHtml(localizer.text('feedback.includeContext'))}</label><pre data-feedback-preview></pre><p data-feedback-status>${escapeHtml(localizer.text('feedback.unconfigured'))}</p><button type="submit" data-feedback-open disabled>${escapeHtml(localizer.text('feedback.openGitHub'))}</button></form></details></div></footer>`;
}

function bindEvents(app: HTMLElement, dispatch: (action: StateAction) => void, localizer: ReturnType<typeof createLocalizer>): void {
  app.onclick = (event) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    const page = Number(control.dataset.page);
    const documentId = control.dataset.documentId;
    const documentKind = control.dataset.documentKind;
    const quantityInput = control.closest('[data-document-card]')?.querySelector<HTMLInputElement>('input[data-document-id]');
    if (action === 'claim-all') dispatch({ type: 'claim-all', claimed: true });
    else if (action === 'clear-all') dispatch({ type: 'claim-all', claimed: false });
    else if (action === 'claim-page' && Number.isInteger(page)) dispatch({ type: 'claim-page', page, claimed: true });
    else if (action === 'clear-page' && Number.isInteger(page)) dispatch({ type: 'claim-page', page, claimed: false });
    else if (action === 'set-page' && Number.isInteger(page)) dispatch({ type: 'set-page', page });
    else if (action === 'select-stop') selectStop(app, Number(control.dataset.stopIndex));
    else if (action === 'set-profile' && (control.dataset.profile === 'fastest' || control.dataset.profile === 'safest')) dispatch({ type: 'set-profile', profile: control.dataset.profile });
    else if (action === 'open-schedule') openDialog(app, '[data-schedule-dialog]');
    else if (action === 'close-schedule') closeDialog(app, '[data-schedule-dialog]');
    else if (action === 'open-setup') openDialog(app, '[data-setup-dialog]');
    else if (action === 'close-setup') closeDialog(app, '[data-setup-dialog]');
    else if (action === 'increment' && documentId && documentKind === 'classified') dispatch({ type: 'set-classified-documents', quantity: Number(quantityInput?.value ?? 0) + 1 });
    else if (action === 'decrement' && documentId && documentKind === 'classified') dispatch({ type: 'set-classified-documents', quantity: Math.max(0, Number(quantityInput?.value ?? 0) - 1) });
    else if (action === 'increment' && documentId) dispatch({ type: 'increment-document', documentId });
    else if (action === 'decrement' && documentId) dispatch({ type: 'decrement-document', documentId });
    else if (action === 'dismiss-cookie-notice') dispatch({ type: 'dismiss-cookie-notice' });
    else if (action === 'reset' && window.confirm(localizer.text('ui.resetConfirm'))) {
      closeDialog(app, '[data-setup-dialog]');
      dispatch({ type: 'reset' });
    }
  };
  app.onchange = (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches('[data-reward-id]')) dispatch({ type: 'claim-reward', rewardId: target.dataset.rewardId!, claimed: (target as HTMLInputElement).checked });
    else if (target.matches('[data-field="reward-page"]')) dispatch({ type: 'set-page', page: Number(target.value) });
    else if (target.matches('[data-field="locale"]')) dispatch({ type: 'set-locale', locale: target.value });
    else if (target.matches('[data-field="mode"]')) dispatch({ type: 'set-mode', mode: target.value as AppState['mode'] });
    else if (target.matches('[data-field="spending"]')) dispatch({ type: 'set-spending', enabled: (target as HTMLInputElement).checked });
    else if (target.matches('[data-field="crate-count"]')) commitQuantity(target, (quantity) => dispatch({ type: 'set-crate-count', quantity }), localizer);
    else if (target.matches('[data-document-kind="classified"]')) commitQuantity(target, (quantity) => dispatch({ type: 'set-classified-documents', quantity }), localizer);
    else if (target.matches('[data-document-id]')) commitQuantity(target, (quantity) => dispatch({ type: 'set-owned-document', documentId: target.dataset.documentId!, quantity }), localizer);
  };
}

function openDialog(app: HTMLElement, selector: string): void {
  const dialog = app.querySelector<HTMLDialogElement>(selector);
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(app: HTMLElement, selector: string): void {
  const dialog = app.querySelector<HTMLDialogElement>(selector);
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function selectStop(app: HTMLElement, index: number): void {
  const selected = app.querySelector<HTMLElement>(`[data-stop-panel="${index}"]`);
  if (!selected) return;
  app.querySelectorAll<HTMLElement>('[data-stop-panel], [data-stop-context]').forEach((panel) => { panel.hidden = Number(panel.dataset.stopPanel ?? panel.dataset.stopContext) !== index; });
  app.querySelectorAll<HTMLElement>('[data-stop-index]').forEach((button) => button.setAttribute('aria-selected', String(Number(button.dataset.stopIndex) === index)));
}

function bindFeedback(app: HTMLElement, catalogs: Catalogs, state: AppState, localizer: ReturnType<typeof createLocalizer>): void {
  const form = app.querySelector<HTMLFormElement>('[data-feedback-form]');
  const message = app.querySelector<HTMLTextAreaElement>('[data-feedback-message]');
  const includeContext = app.querySelector<HTMLInputElement>('[data-feedback-context]');
  const preview = app.querySelector<HTMLElement>('[data-feedback-preview]');
  const status = app.querySelector<HTMLElement>('[data-feedback-status]');
  const openButton = app.querySelector<HTMLButtonElement>('[data-feedback-open]');
  if (!form || !message || !includeContext || !preview || !status || !openButton) return;
  const config: FeedbackConfig = {};
  const update = (): void => {
    const valid = validateFeedbackMessage(message.value);
    const report = composeFeedback(localizer, message.value, includeContext.checked, {
      gameDataVersion: catalogs.battlePass.gameDataVersion,
      mode: state.mode,
      effectiveDailyLimit: catalogs.optimizerRules.dailyDocumentLimits[state.mode],
    });
    preview.textContent = `${report.title}\n\n${report.body}`;
    const url = valid ? buildIssueUrl(report, config) : undefined;
    openButton.disabled = !url;
    status.textContent = valid ? localizer.text('feedback.unconfigured') : localizer.text('feedback.invalid');
    openButton.dataset.issueUrl = url ?? '';
  };
  message.addEventListener('input', update);
  includeContext.addEventListener('change', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = openButton.dataset.issueUrl;
    if (url) openIssueComposer(url);
  });
  update();
}

function commitQuantity(input: HTMLInputElement | HTMLSelectElement, commit: (quantity: number) => void, localizer: ReturnType<typeof createLocalizer>): void {
  const quantity = Number(input.value);
  if (!Number.isInteger(quantity) || quantity < 0 || !input.value.trim()) {
    input.setCustomValidity(localizer.text('ui.invalidQuantity'));
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  commit(quantity);
}

function startCountdown(documentRoot: Document, localizer: ReturnType<typeof createLocalizer>, endsAt: number): void {
  stopCountdown(documentRoot);
  const update = (): void => {
    if (documentRoot.visibilityState === 'hidden') return;
    const element = documentRoot.querySelector<HTMLElement>('[data-countdown]');
    if (!element) return;
    const seconds = Math.max(0, Math.ceil(endsAt - Date.now() / 1000));
    if (seconds === 0) {
      element.textContent = localizer.text('season.ended');
      if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
      return;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const time = [formatCountdownUnit(days, localizer.locale, 'day'), formatCountdownUnit(hours, localizer.locale, 'hour'), formatCountdownUnit(minutes, localizer.locale, 'minute'), formatCountdownUnit(remainingSeconds, localizer.locale, 'second')].join(', ');
    element.textContent = localizer.text('season.countdown', { time });
  };
  countdownVisibilityHandler = update;
  documentRoot.addEventListener('visibilitychange', update);
  update();
  countdownTimer = window.setInterval(update, 1000);
}

function compactDocumentLabel(name: string): string {
  return name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 4).toUpperCase();
}

function assetUrl(path: string): string {
  return new URL(path.replace(/^\//, ''), document.baseURI).toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}
