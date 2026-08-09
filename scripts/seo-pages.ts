import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import type { Plugin } from 'vite';

import type { Catalogs } from '../src/catalogs.ts';
import { createLocalizer, formatLocalPrice, formatNumber, getTextDirection } from '../src/localization.ts';
import { optimize, type NextRaidRecommendation } from '../src/optimizer.ts';
import type { LocaleRoute, SiteConfig } from '../src/site.ts';
import { createDefaultState } from '../src/state.ts';

const SOCIAL_IMAGE_PATH = 'assets/social/eft-season-optimizer.png';

export function validateSiteConfig(config: SiteConfig, catalogs: Catalogs): void {
  const issues: string[] = [];
  if (!config.basePath.startsWith('/') || !config.basePath.endsWith('/')) issues.push('basePath must start and end with /.');
  if (!config.canonicalUrl.endsWith(config.basePath)) issues.push('canonicalUrl must end with basePath.');
  if (config.locales.filter((route) => route.default).length !== 1) issues.push('exactly one locale route must be the default.');
  const localeIds = new Set<string>();
  const paths = new Set<string>();
  const hrefLangs = new Set<string>();
  for (const route of config.locales) {
    if (localeIds.has(route.locale)) issues.push(`duplicate locale route ${route.locale}.`);
    if (paths.has(route.path)) issues.push(`duplicate locale path ${route.path}.`);
    if (hrefLangs.has(route.hreflang)) issues.push(`duplicate hreflang ${route.hreflang}.`);
    if (route.path.startsWith('/') || (route.path && !route.path.endsWith('/'))) issues.push(`${route.locale} path must be relative and end with /.`);
    localeIds.add(route.locale);
    paths.add(route.path);
    hrefLangs.add(route.hreflang);
  }
  for (const locale of catalogs.localization.supportedLocales) {
    if (!localeIds.has(locale)) issues.push(`supported locale ${locale} has no locale route.`);
  }
  for (const route of config.locales) {
    if (!catalogs.localization.supportedLocales.includes(route.locale)) issues.push(`locale route ${route.locale} is not supported by localization.json.`);
  }
  if (issues.length > 0) throw new Error(`Site configuration failed validation:\n- ${issues.join('\n- ')}`);
}

export function localizedPages(
  config: SiteConfig,
  catalogs: Catalogs,
  googleVerification?: string,
): Plugin {
  validateSiteConfig(config, catalogs);
  const normalizedVerification = googleVerification?.trim();
  return {
    name: 'localized-static-pages',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const route = routeForRequest(context.originalUrl, config) ?? defaultRoute(config);
        return renderLocalizedPage(html, route, config, catalogs, normalizedVerification);
      },
    },
    closeBundle() {
      const rootPath = resolve('dist/index.html');
      const rootHtml = readFileSync(rootPath, 'utf8');
      for (const route of config.locales) {
        const outputPath = resolve('dist', route.path, 'index.html');
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, renderLocalizedPage(rootHtml, route, config, catalogs, normalizedVerification));
      }
      writeFileSync(resolve('dist/sitemap.xml'), createSitemap(config));
    },
  };
}

export function renderLocalizedPage(
  html: string,
  route: LocaleRoute,
  config: SiteConfig,
  catalogs: Catalogs,
  googleVerification?: string,
): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const localizer = createLocalizer(catalogs.localization, route.locale);
  const canonicalUrl = new URL(route.path, config.canonicalUrl).href;
  const socialImageUrl = new URL(SOCIAL_IMAGE_PATH, config.canonicalUrl).href;
  const normalizedVerification = googleVerification?.trim();

  document.documentElement.lang = route.locale;
  document.documentElement.dir = getTextDirection(route.locale);
  document.title = localizer.text('seo.title');
  setMeta(document, 'name', 'description', localizer.text('seo.description'));
  setMeta(document, 'name', 'robots', 'max-image-preview:large');
  setLink(document, 'canonical', canonicalUrl);
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());
  for (const localeRoute of config.locales) {
    appendAlternate(document, localeRoute.hreflang, new URL(localeRoute.path, config.canonicalUrl).href);
  }
  appendAlternate(document, 'x-default', config.canonicalUrl);

  setMeta(document, 'property', 'og:title', localizer.text('seo.title'));
  setMeta(document, 'property', 'og:description', localizer.text('seo.description'));
  setMeta(document, 'property', 'og:type', 'website');
  setMeta(document, 'property', 'og:url', canonicalUrl);
  setMeta(document, 'property', 'og:site_name', 'EFT Season Optimizer');
  setMeta(document, 'property', 'og:locale', route.ogLocale);
  document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((element) => element.remove());
  for (const alternate of config.locales.filter((candidate) => candidate.locale !== route.locale)) {
    appendMeta(document, 'property', 'og:locale:alternate', alternate.ogLocale);
  }
  setMeta(document, 'property', 'og:image', socialImageUrl);
  setMeta(document, 'property', 'og:image:type', 'image/png');
  setMeta(document, 'property', 'og:image:width', '1200');
  setMeta(document, 'property', 'og:image:height', '630');
  setMeta(document, 'property', 'og:image:alt', localizer.text('seo.socialImageAlt'));
  setMeta(document, 'name', 'twitter:card', 'summary_large_image');
  setMeta(document, 'name', 'twitter:title', localizer.text('seo.title'));
  setMeta(document, 'name', 'twitter:description', localizer.text('seo.description'));
  setMeta(document, 'name', 'twitter:image', socialImageUrl);
  setMeta(document, 'name', 'twitter:image:alt', localizer.text('seo.socialImageAlt'));

  const verification = document.querySelector('meta[name="google-site-verification"]');
  if (normalizedVerification) setMeta(document, 'name', 'google-site-verification', normalizedVerification);
  else verification?.remove();

  document.querySelectorAll<HTMLElement>('[data-static-i18n]').forEach((element) => {
    element.textContent = localizer.text(element.dataset.staticI18n!);
  });
  for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
    const marker = `data-static-i18n-${attribute}`;
    document.querySelectorAll<HTMLElement>(`[${marker}]`).forEach((element) => {
      const id = element.getAttribute(marker);
      if (id) element.setAttribute(attribute, localizer.text(id));
    });
  }

  populateDocumentStrip(document, catalogs, route.locale, config.basePath);
  populateStaticTotals(document, catalogs, route.locale);
  populateStaticFocus(document, catalogs, route.locale, config.basePath);
  populateAboutDialog(document, catalogs, route.locale);
  document.querySelectorAll<HTMLElement>('button, input, select').forEach((control) => {
    control.dataset.pendingControl = '';
    control.setAttribute('inert', '');
  });

  const structuredData = document.querySelector<HTMLScriptElement>('script[data-structured-data]');
  if (structuredData) structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: localizer.text('seo.applicationName'),
    alternateName: localizer.text('seo.applicationAlternateName'),
    url: canonicalUrl,
    description: localizer.text('seo.description'),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: localizer.text('seo.browserRequirements'),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    inLanguage: route.locale,
    image: socialImageUrl,
    sameAs: config.repositoryUrl,
    about: { '@type': 'VideoGame', name: 'Escape from Tarkov' },
  });

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

export function createSitemap(config: SiteConfig): string {
  const urls = config.locales.map((route) => `  <url>\n    <loc>${escapeXml(new URL(route.path, config.canonicalUrl).href)}</loc>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function routeForRequest(url: string | undefined, config: SiteConfig): LocaleRoute | undefined {
  if (!url) return undefined;
  const pathname = new URL(url, 'http://localhost').pathname;
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return config.locales.find((route) => normalized === `${config.basePath}${route.path}`);
}

function defaultRoute(config: SiteConfig): LocaleRoute {
  return config.locales.find((route) => route.default)!;
}

function populateDocumentStrip(document: Document, catalogs: Catalogs, locale: string, basePath: string): void {
  const localizer = createLocalizer(catalogs.localization, locale);
  const locations = new Map(catalogs.locations.locations.map((location) => [location.id, localizer.text(location.id)]));
  for (const documentRecord of catalogs.documents.documents) {
    const figure = document.querySelector<HTMLElement>(`[data-document-id="${documentRecord.id}"]`);
    if (!figure) continue;
    const fullName = localizer.text(documentRecord.id);
    const firstWord = fullName.trim().split(/\s+/u)[0] ?? fullName;
    const title = figure.querySelector<HTMLElement>('[data-document-title]');
    const image = figure.querySelector<HTMLImageElement>('img');
    const tooltipName = figure.querySelector<HTMLElement>('[data-document-tooltip-name]');
    const tooltipDescription = figure.querySelector<HTMLElement>('[data-document-tooltip-description]');
    if (title) title.textContent = firstWord;
    if (image) {
      image.alt = localizer.text(documentRecord.imageAltId);
      const source = `${basePath}${documentRecord.imagePath.replace(/^\//u, '')}`;
      const variant = (size: number) => `${source.replace(/\.webp$/u, `-${size}.webp`)} ${size}w`;
      image.srcset = `${variant(192)}, ${variant(384)}, ${source} 1254w`;
      image.sizes = '(max-width: 1180px) 96px, 5vw';
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
    }
    if (tooltipName) tooltipName.textContent = fullName;
    if (tooltipDescription) tooltipDescription.textContent = localizer.text(documentRecord.descriptionId);
    figure.querySelector('[data-document-tooltip-locations]')?.remove();
    if (documentRecord.sourceLocationIds.length > 0) {
      const locationList = document.createElement('ul');
      locationList.dataset.documentTooltipLocations = '';
      for (const locationId of documentRecord.sourceLocationIds) {
        const item = document.createElement('li');
        item.textContent = locations.get(locationId) ?? locationId;
        locationList.append(item);
      }
      figure.querySelector('[data-document-tooltip-description]')?.after(locationList);
    }
  }
}

function populateAboutDialog(document: Document, catalogs: Catalogs, locale: string): void {
  const localizer = createLocalizer(catalogs.localization, locale);
  const rewardCount = catalogs.battlePass.pages.reduce((total, page) => total + page.rewards.length, 0);
  const documentTotals = new Map<string, number>();
  for (const page of catalogs.battlePass.pages) {
    for (const reward of page.rewards) {
      for (const requirement of reward.requirements) {
        documentTotals.set(requirement.documentId, (documentTotals.get(requirement.documentId) ?? 0) + requirement.quantity);
      }
    }
  }
  const totalDocuments = [...documentTotals.values()].reduce((total, quantity) => total + quantity, 0);
  const summary = document.querySelector<HTMLElement>('[data-about-summary]');
  const number = new Intl.NumberFormat(locale);
  if (summary) summary.textContent = localizer.text('about.summary', {
    pages: number.format(catalogs.battlePass.pages.length),
    rewards: number.format(rewardCount),
    documents: number.format(totalDocuments),
  });
  const body = document.querySelector<HTMLTableSectionElement>('[data-about-table-body]');
  if (!body) return;
  body.replaceChildren();
  for (const documentRecord of catalogs.documents.documents.filter((candidate) => candidate.kind === 'regular')) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = localizer.text(documentRecord.id);
    const total = document.createElement('td');
    total.textContent = number.format(documentTotals.get(documentRecord.id) ?? 0);
    const locations = document.createElement('td');
    locations.textContent = documentRecord.sourceLocationIds.map((id) => localizer.text(id)).join(', ');
    row.append(name, total, locations);
    body.append(row);
  }
}

function populateStaticFocus(document: Document, catalogs: Catalogs, locale: string, basePath: string): void {
  const state = createDefaultState(catalogs);
  const result = optimize({
    catalogs,
    claimedRewardIds: state.claimedRewardIds,
    ownedDocuments: state.ownedDocuments,
    classifiedDocuments: state.classifiedDocuments,
    mode: state.mode,
    locale,
  });
  const nextRaid = result.profiles[state.selectedProfile].nextRaid;
  if (!nextRaid) return;
  const localizer = createLocalizer(catalogs.localization, locale);
  const content = document.querySelector<HTMLElement>('[data-focus-content]');
  const eyebrow = document.querySelector<HTMLElement>('[data-focus-eyebrow]');
  const heading = document.querySelector<HTMLElement>('[data-focus-heading]');
  const buyoutLink = document.querySelector<HTMLButtonElement>('[data-buyout-link]');
  if (!content || !eyebrow || !heading) return;
  const appError = content.querySelector('[data-app-error]');
  const estimate = result.buyout.localEstimate;
  if (buyoutLink && estimate) {
    buyoutLink.hidden = false;
    buyoutLink.textContent = localizer.text('ui.approximateBuyoutPrice', {
      price: estimate.price > 0
        ? formatLocalPrice({ price: estimate.price, currency: estimate.currency }, locale)
        : localizer.text('ui.zeroLocalPrice'),
    });
  }

  eyebrow.textContent = localizer.text(nextRaid.purpose === 'crate-stockpile' ? 'ui.crateStockpileRaid' : 'ui.nextRaid');
  heading.textContent = localizer.text('ui.raidLocationSummary', {
    location: localizer.text(nextRaid.locationId),
    difficulty: localizer.text(nextRaid.difficultyId),
    minutes: formatNumber(nextRaid.maxRaidTimeMin, locale),
  });
  content.dataset.staticNextRaid = nextRaidKey(nextRaid);

  const instruction = document.createElement('p');
  instruction.className = 'focus-instruction';
  const marker = '\uFFFC';
  const instructionText = localizer.text('ui.enterRaidResult', { commit: marker });
  const markerIndex = instructionText.indexOf(marker);
  const inlineCommit = document.createElement('button');
  inlineCommit.type = 'button';
  inlineCommit.disabled = true;
  inlineCommit.className = 'focus-instruction__commit';
  inlineCommit.dataset.commitRaidInline = '';
  inlineCommit.textContent = localizer.text('ui.commitRaidResult').toLocaleLowerCase(locale);
  instruction.append(instructionText.slice(0, markerIndex), inlineCommit, instructionText.slice(markerIndex + marker.length));

  const documentGrid = document.createElement('div');
  documentGrid.className = 'focus-documents';
  const documentsById = new Map(catalogs.documents.documents.map((record) => [record.id, record]));
  for (const recommendation of nextRaid.documents) {
    const record = documentsById.get(recommendation.documentId);
    if (!record) continue;
    const optional = recommendation.role === 'optional';
    const figure = document.createElement('figure');
    figure.className = `focus-document${optional ? ' focus-document--optional' : ''}`;
    figure.dataset.focusDocument = recommendation.documentId;
    figure.dataset.documentRole = recommendation.role;
    const status = document.createElement('span');
    status.className = 'focus-document__status';
    status.textContent = localizer.text(recommendation.role === 'priority'
      ? 'ui.priorityDocument'
      : recommendation.role === 'stockpile' ? 'ui.stockpileDocument' : 'ui.optionalDocument');
    const imageFrame = document.createElement('div');
    imageFrame.className = 'focus-document__image-frame';
    const image = document.createElement('img');
    const source = `${basePath}${record.imagePath.replace(/^\//u, '')}`;
    image.src = source;
    image.srcset = `${source.replace(/\.webp$/u, '-192.webp')} 192w, ${source.replace(/\.webp$/u, '-384.webp')} 384w, ${source} 1254w`;
    image.sizes = '140px';
    image.alt = localizer.text(record.imageAltId);
    image.width = 1254;
    image.height = 1254;
    image.setAttribute('decoding', 'async');
    image.setAttribute('fetchpriority', 'high');
    imageFrame.append(image);
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = localizer.text(record.id).trim().split(/\s+/u)[0];
    caption.append(name);
    const stepper = document.createElement('div');
    stepper.className = 'raid-result-stepper';
    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.disabled = true;
    decrement.textContent = '−';
    const input = document.createElement('input');
    input.type = 'number';
    input.disabled = true;
    input.min = '0';
    input.step = '1';
    input.value = '0';
    input.setAttribute('value', '0');
    input.dataset.raidResult = recommendation.documentId;
    const quantityLabel = localizer.text('ui.raidResult');
    input.setAttribute('aria-label', `${quantityLabel}: ${localizer.text(record.id)}`);
    decrement.setAttribute('aria-label', `${quantityLabel} − ${localizer.text(record.id)}`);
    const increment = document.createElement('button');
    increment.type = 'button';
    increment.disabled = true;
    increment.textContent = '+';
    increment.setAttribute('aria-label', `${quantityLabel} + ${localizer.text(record.id)}`);
    stepper.append(decrement, input, increment);
    figure.append(status, imageFrame, caption, stepper);
    documentGrid.append(figure);
  }
  content.replaceChildren(instruction, documentGrid);
  if (appError) content.append(appError);
}

function nextRaidKey(nextRaid: NextRaidRecommendation): string {
  return `${nextRaid.locationId}|${nextRaid.documents.map(({ documentId, role }) => `${documentId}:${role}`).join(',')}`;
}

function populateStaticTotals(document: Document, catalogs: Catalogs, locale: string): void {
  const number = new Intl.NumberFormat(locale);
  const rewards = catalogs.battlePass.pages.flatMap((page) => page.rewards);
  const requiredDocuments = rewards.flatMap((reward) => reward.requirements)
    .reduce((total, requirement) => total + requirement.quantity, 0);
  const documentTotal = document.querySelector<HTMLElement>('[data-document-progress-total]');
  const rewardTotal = document.querySelector<HTMLElement>('[data-reward-progress-total]');
  const documentProgress = document.querySelector<HTMLProgressElement>('[data-document-progress]');
  const rewardProgress = document.querySelector<HTMLProgressElement>('[data-reward-progress]');
  if (documentTotal) documentTotal.textContent = number.format(requiredDocuments);
  if (rewardTotal) rewardTotal.textContent = number.format(rewards.length);
  if (documentProgress) documentProgress.max = requiredDocuments;
  if (rewardProgress) rewardProgress.max = rewards.length;
}

function setMeta(document: Document, attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  const meta = document.querySelector<HTMLMetaElement>(selector) ?? document.createElement('meta');
  meta.setAttribute(attribute, key);
  meta.content = content;
  if (!meta.parentNode) document.head.append(meta);
}

function appendMeta(document: Document, attribute: 'name' | 'property', key: string, content: string): void {
  const meta = document.createElement('meta');
  meta.setAttribute(attribute, key);
  meta.content = content;
  document.head.append(meta);
}

function setLink(document: Document, rel: string, href: string): void {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ?? document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (!link.parentNode) document.head.append(link);
}

function appendAlternate(document: Document, hreflang: string, href: string): void {
  const link = document.createElement('link');
  link.rel = 'alternate';
  link.hreflang = hreflang;
  link.href = href;
  document.head.append(link);
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
