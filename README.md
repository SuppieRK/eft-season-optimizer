# EFT Season Optimizer

EFT Season Optimizer is a fan-made farming planner for the Escape from Tarkov KORD BREACH Battle Pass.

The site recommends the next location to farm. It uses owned documents, claimed rewards, the route preference, and the daily mode limit.

The current catalog targets game-data version `1.1.0.0.46657.8.6.2026`.

The localization catalog marks the project as development-only. The Russian draft and human-authored item text require review.

## Features

- Track owned documents and claimed Battle Pass rewards.
- Compare the Fastest and Safest route profiles.
- Apply the fixed daily limits for PvE, PvP, and PvP Seasonal.
- Plan reward claims with the Battle Pass page-unlock rules.
- Include regular-document exchanges and Classified Document backfill.
- Compare buyout estimates that spend or keep earned TarCoins.
- Show one next-raid recommendation and a full projected schedule.
- Store progress and interface choices in first-party cookies.
- Operate as a static site with no application server.

## Requirements

- Node.js 26
- npm
- Chromium for the Playwright tests

## Local development

1. Install the dependencies.

   ```sh
   npm ci
   ```

2. Install Chromium for Playwright.

   ```sh
   npx playwright install chromium
   ```

3. Start the Vite development server.

   ```sh
   npm run dev
   ```

4. Open `http://localhost:5173/eft-season-optimizer/`.

## Validation

Run all automated checks before you submit a change.

```sh
npm run check
```

You can also run each check separately:

```sh
npm run lint
npm run test:build
npm test
npm run test:e2e
npm run validate:release
```

Use the Playwright interface to examine browser tests:

```sh
npm run test:e2e:ui
```

## Data catalogs

The application reads its game data from JSON files in [`public/data`](public/data).

| File | Content |
| --- | --- |
| [`battle-pass.json`](public/data/battle-pass.json) | Season metadata, pages, rewards, requirements, and TarCoin rewards |
| [`documents.json`](public/data/documents.json) | Document types, descriptions, images, and source locations |
| [`locations.json`](public/data/locations.json) | Location difficulty ratings and maximum raid times |
| [`optimizer-rules.json`](public/data/optimizer-rules.json) | Daily limits, exchanges, purchase bundles, and route rules |
| [`localization.json`](public/data/localization.json) | Localized interface text, item text, descriptions, and prices |

[`tests/documents.csv`](tests/documents.csv) is the reviewed source of truth for reward document quantities. Catalog tests compare `battle-pass.json` with this file.

The localization catalog contains `en-GB` and a best-effort `ru-RU` draft. The Russian text requires review against official game terminology.

## Project structure

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | Application markup and the primary layout styles |
| [`src`](src) | TypeScript logic and shared style files |
| [`public`](public) | Static data and document image assets |
| [`tests`](tests) | Unit, catalog, render, release, and Playwright tests |
| [`openspec`](openspec) | Product requirements and implementation decisions |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | Validation and GitHub Pages deployment workflow |

## GitHub Pages

The `main` branch deploys through GitHub Actions. Pull requests run the same validation without a deployment.

The Vite base path is `/eft-season-optimizer/`. If the repository name changes, update these files:

- `vite.config.ts`
- `playwright.config.ts`
- `scripts/check-build.cjs`

## Local storage

The application stores progress, document counts, and interface choices in first-party cookies. It does not send this state to an application server.

Use the reset action in the site footer to erase the stored optimizer state.

## Asset disclaimer

This site is an unofficial fan-made project. All Escape from Tarkov image assets belong to Battlestate Games.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you submit a change.

Report security vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License

The source code is available under the [MIT License](LICENSE).
