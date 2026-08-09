import { readFileSync } from 'node:fs';

import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';

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
  return {
    base: '/eft-season-optimizer/',
    plugins: [
      localeFlags(),
      cloudflareWebAnalytics(env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN),
    ],
  };
});
