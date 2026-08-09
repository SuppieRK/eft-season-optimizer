import { readFileSync } from 'node:fs';

import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';

import { localizedPages } from './scripts/seo-pages.ts';
import { parseCatalogs, type CatalogKey } from './src/catalogs.ts';
import { siteConfig } from './src/site.ts';

export const CLOUDFLARE_WEB_ANALYTICS_SOURCE = 'https://static.cloudflareinsights.com/beacon.min.js';

export function cloudflareWebAnalyticsTag(token: string | undefined): HtmlTagDescriptor | undefined {
  const normalizedToken = token?.trim();
  if (!normalizedToken) return undefined;
  return {
    tag: 'script',
    attrs: {
      type: 'module',
      src: CLOUDFLARE_WEB_ANALYTICS_SOURCE,
      'data-cf-beacon': JSON.stringify({ token: normalizedToken }),
    },
    injectTo: 'body',
  };
}

function cloudflareWebAnalytics(token: string | undefined): Plugin {
  return {
    name: 'cloudflare-web-analytics',
    apply: 'build',
    transformIndexHtml() {
      const tag = cloudflareWebAnalyticsTag(token);
      return tag ? [tag] : [];
    },
  };
}

const localeFlagsModule = 'virtual:locale-flags';
const resolvedLocaleFlagsModule = `\0${localeFlagsModule}`;

function localeFlags(): Plugin {
  return {
    name: 'locale-flags',
    resolveId(id) {
      return id === localeFlagsModule ? resolvedLocaleFlagsModule : undefined;
    },
    load(id) {
      if (id !== resolvedLocaleFlagsModule) return undefined;
      const catalog = JSON.parse(
        readFileSync(new URL('./public/data/localization.json', import.meta.url), 'utf8'),
      ) as { supportedLocales: string[] };
      const regions = [...new Set(catalog.supportedLocales.map((locale) => new Intl.Locale(locale).region?.toLowerCase()))]
        .filter((region): region is string => Boolean(region));
      const imports = regions.map(
        (region, index) => `import flag${index} from 'flag-icons/flags/4x3/${region}.svg?no-inline';`,
      );
      const entries = regions.map((region, index) => `${JSON.stringify(region)}: flag${index}`);
      return `${imports.join('\n')}\nexport default { ${entries.join(', ')} };`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const catalogs = parseCatalogs(Object.fromEntries(
    (Object.entries({
      documents: 'public/data/documents.json',
      locations: 'public/data/locations.json',
      battlePass: 'public/data/battle-pass.json',
      optimizerRules: 'public/data/optimizer-rules.json',
      localization: 'public/data/localization.json',
    }) as [CatalogKey, string][]).map(([key, filePath]) => [
      key,
      JSON.parse(readFileSync(new URL(filePath, import.meta.url), 'utf8')),
    ]),
  ) as Record<CatalogKey, unknown>);
  return {
    base: siteConfig.basePath,
    plugins: [
      localeFlags(),
      localizedPages(siteConfig, catalogs, env.VITE_GOOGLE_SITE_VERIFICATION),
      cloudflareWebAnalytics(env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN),
    ],
  };
});
