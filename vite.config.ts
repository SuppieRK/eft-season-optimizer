import { readFileSync } from 'node:fs';

import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  base: '/eft-season-optimizer/',
  plugins: [localeFlags()],
});
