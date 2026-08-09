import rawSiteConfig from '../site.config.json' with { type: 'json' };

export interface LocaleRoute {
  readonly locale: string;
  readonly path: string;
  readonly hreflang: string;
  readonly ogLocale: string;
  readonly default?: boolean;
}

export interface SiteConfig {
  readonly basePath: string;
  readonly canonicalUrl: string;
  readonly repositoryUrl: string;
  readonly locales: readonly LocaleRoute[];
}

export const siteConfig = rawSiteConfig satisfies SiteConfig;

export function getDefaultLocaleRoute(config: SiteConfig = siteConfig): LocaleRoute {
  const route = config.locales.find((candidate) => candidate.default);
  if (!route) throw new Error('Site configuration has no default locale route.');
  return route;
}

export function getLocaleRoute(locale: string, config: SiteConfig = siteConfig): LocaleRoute | undefined {
  return config.locales.find((candidate) => candidate.locale === locale);
}

export function getLocaleRouteForPath(pathname: string, config: SiteConfig = siteConfig): LocaleRoute | undefined {
  const normalizedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return config.locales.find((route) => normalizedPath === `${config.basePath}${route.path}`);
}

export function getLocalePath(locale: string, config: SiteConfig = siteConfig): string {
  const route = getLocaleRoute(locale, config);
  if (!route) throw new Error(`Site configuration has no route for locale ${locale}.`);
  return `${config.basePath}${route.path}`;
}

export function getLocaleUrl(locale: string, config: SiteConfig = siteConfig): string {
  const route = getLocaleRoute(locale, config);
  if (!route) throw new Error(`Site configuration has no route for locale ${locale}.`);
  return new URL(route.path, config.canonicalUrl).href;
}
