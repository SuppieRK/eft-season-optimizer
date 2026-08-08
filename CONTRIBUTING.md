# Contributing

Thank you for contributing to EFT Season Optimizer.

## Development requirements

- Node.js 26
- npm
- Chromium for Playwright

## Prepare the project

1. Install the dependencies.

   ```sh
   npm ci
   ```

2. Install Chromium for Playwright.

   ```sh
   npx playwright install chromium
   ```

3. Start the development server.

   ```sh
   npm run dev
   ```

4. Open `http://localhost:5173/eft-season-optimizer/`.

## Make a change

Keep each change focused on one problem or feature.

When the product behavior changes, update the applicable OpenSpec files. Add or update automated tests for behavior changes.

Use the existing TypeScript, CSS, and JSON structures. Do not add a frontend framework without prior project approval.

## Change game data

The JSON catalogs in `public/data` are the runtime data sources.

Use `tests/documents.csv` as the reviewed source of truth for reward document quantities.

Keep localization IDs stable across all catalogs. When you add a localization entry, add a value for every supported locale.

Use a numeric `price` and a three-letter ISO currency code for each regional price.

Do not add source screenshots to runtime JSON. Add only assets that the project can publish.

## Change localization text

Each object in `public/data/localization.json` contains one stable ID and its locale values.

Preserve placeholders such as `{count}`, `{page}`, and `{location}`. The application replaces these placeholders at runtime.

Russian text is currently a best-effort draft. Corrections to official Escape from Tarkov terminology are welcome.

## Validate the change

Run the full validation command:

```sh
npm run check
```

When you change localization content, run the release gate:

```sh
npm run validate:release
```

The release gate remains closed while the localization catalog has development-only status.

## Submit the change

Describe the user-visible result and the reason for the change. Include screenshots for visual changes.

List the commands that you used for validation. Identify known limitations or follow-up work.

Do not include generated `dist` files, Playwright output, credentials, or private user data.

## Game assets

This repository is an unofficial fan-made project. All Escape from Tarkov image assets belong to Battlestate Games.
