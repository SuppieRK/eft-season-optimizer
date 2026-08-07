import type { LocalizationCatalog, LocalPrice, Requirement } from './catalogs';

export type Locale = string;
export type MessageValue = string | number;

const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);

export interface Localizer {
  readonly locale: Locale;
  readonly fallbackLocale: Locale;
  readonly direction: 'ltr' | 'rtl';
  text(id: string, values?: Readonly<Record<string, MessageValue>>): string;
  price(id: string): LocalPrice | undefined;
}

export function createLocalizer(catalog: LocalizationCatalog, requestedLocale = catalog.defaultLocale): Localizer {
  const textEntries = new Map(catalog.entries.map((entry) => [entry.id, entry.localizations]));
  const priceEntries = new Map(catalog.priceEntries.map((entry) => [entry.id, entry.localizations]));
  const locale = catalog.supportedLocales.includes(requestedLocale) ? requestedLocale : catalog.defaultLocale;
  return {
    locale,
    fallbackLocale: catalog.defaultLocale,
    direction: getTextDirection(locale),
    text: (id, values) => {
      const localizations = textEntries.get(id);
      const message = localizations?.[locale] ?? localizations?.[catalog.defaultLocale] ?? `⟦missing:${id}⟧`;
      return interpolate(message, values);
    },
    price: (id) => priceEntries.get(id)?.[locale],
  };
}

export function getCompleteLocales(
  catalog: LocalizationCatalog,
  requiredTextIds: readonly string[] = catalog.entries.map((entry) => entry.id),
  requiredPriceIds: readonly string[] = catalog.priceEntries.map((entry) => entry.id),
): readonly string[] {
  return catalog.supportedLocales.filter((locale) => {
    const completeText = requiredTextIds.every((id) => {
      const entry = catalog.entries.find((candidate) => candidate.id === id);
      return Boolean(entry?.localizations[locale]?.trim());
    });
    const completePrices = requiredPriceIds.every((id) => Boolean(
      catalog.priceEntries.find((candidate) => candidate.id === id)?.localizations[locale],
    ));
    return completeText && completePrices;
  });
}

export function resolveStoredLocale(
  storedLocale: string | undefined,
  completeLocales: readonly string[],
  defaultLocale: string,
): string {
  return storedLocale && completeLocales.includes(storedLocale) ? storedLocale : defaultLocale;
}

export function getTextDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.toLowerCase().split('-')[0]) ? 'rtl' : 'ltr';
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatTarCoins(value: number, locale: string): string {
  return formatNumber(value, locale);
}

export function formatLocalPrice(price: LocalPrice, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: price.currency }).format(price.price);
}

export function formatDateTime(timestampSeconds: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(timestampSeconds * 1000);
}

export function formatCountdownUnit(value: number, locale: string, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

export function pluralCategory(value: number, locale: string): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(value);
}

export function formatCompactRequirements(
  requirements: readonly Requirement[],
  abbreviations: Readonly<Record<string, string>>,
  locale: string,
): string {
  return requirements.map(({ documentId, quantity }) => `${abbreviations[documentId] ?? `⟦missing:${documentId}⟧`} ${formatNumber(quantity, locale)}`).join(' · ');
}

export function formatAccessibleRequirements(
  requirements: readonly Requirement[],
  names: Readonly<Record<string, string>>,
  locale: string,
): string {
  return requirements.map(({ documentId, quantity }) => `${names[documentId] ?? `⟦missing:${documentId}⟧`}: ${formatNumber(quantity, locale)}`).join(', ');
}

function interpolate(template: string, values?: Readonly<Record<string, MessageValue>>): string {
  if (!values) return template;
  return template.replace(/\{([\w-]+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}
