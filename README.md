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

## Optimizer logic

The optimizer code is in [`src/optimizer.ts`](src/optimizer.ts). The rules and numeric values are in [`public/data/optimizer-rules.json`](public/data/optimizer-rules.json).

The application has a cost optimizer and a farming optimizer. Both optimizers use the same owned Documents and claimed rewards.

### Shared document rules

The optimizer includes every unclaimed reward. A player cannot select a smaller optimization goal.

The optimizer adds all requirements for the unclaimed rewards. It then applies resources in this order:

1. It uses owned regular Documents of the required type.
2. It reserves regular Documents that match later requirements.
3. It marks only the excess regular Documents as exchange surplus.
4. It allocates owned Classified Documents to the remaining shortages.
5. It exchanges five surplus regular Documents for one missing regular Document when the exchange improves the selected route.
6. It applies optional Classified Document purchases when the TarCoin option is active.
7. It sends the final shortages to the farming optimizer.

Classified Documents fill shortages during reward redemption. They never replace a matching regular Document that the player owns.

Each route profile allocates the same owned Classified Document total independently. The allocation follows the reward sequence for that profile.

The allocation follows a greedy Page 12 reward order. Within each reward, it applies Classified Documents to the highest source factor first.

After this sequence, any remaining Classified Documents target the document types with the highest source factor.

The route exchange process evaluates one received Document at a time. It selects the exchange that gives the largest positive route-cost reduction.

A tie uses the stable document ID order. Exchange donors also use stable document ID order.

### Reward order

Page 1 is always unlocked. Each later page needs claims from the page immediately before it.

The required claim count is one less than the reward count on the previous page. The optimizer applies this rule to every simulated claim.

The optimizer first finds a path to Page 12. It then selects Page 12 rewards before it clears skipped rewards on earlier pages.

The final reward-order search uses a beam width of 16. At each locked page, it evaluates every reward combination that unlocks the next page.

The search ranks progression states in this order:

1. More unlocked pages.
2. Lower profile cost for missing Documents.
3. Fewer best-source locations.
4. Fewer missing Documents.
5. Stable reward ID order.

The Classified Document allocation uses a greedy legal sequence before the final beam search. The final sequence remains subject to every page-unlock rule.

### Cost optimizer

The cost optimizer produces the informational Battle Pass buyout. This calculation does not change inventory, claimed rewards, or saved TarCoins.

The buyout result does not depend on the Spend Battle Pass TarCoins option. The result always includes spend and keep scenarios.

The optimizer calculates the remaining buyout in this order:

1. It applies matching regular Documents to all unclaimed rewards.
2. It applies the five-for-one exchange to global surplus.
3. It subtracts owned Classified Documents from the remaining Document total.
4. It selects Classified Document bundles without exceeding that total.
5. It simulates the legal reward sequence and the TarCoins that each reward gives.
6. It calculates local TarCoin package costs for the spend and keep scenarios.

The global buyout exchange fills missing document types in stable document ID order. This exchange does not use a route profile.

#### Classified Document bundle selection

The optimizer sorts Classified Document bundles by these fields:

1. Higher Classified Document quantity.
2. Lower TarCoin cost for equal quantities.
3. Stable catalog order.

For each bundle size, the optimizer selects the largest count that does not exceed the remaining shortage. It then processes the next bundle size.

This largest-first rule prevents unused Classified Documents. It can leave a shortage that is smaller than the smallest bundle.

The remaining shortage stays in the farming plan. The Classified Document bundle stage does not minimize the TarCoin cost across all possible combinations.

The buyout simulation purchases the selected bundles only when a reward needs them. It processes selected bundles from the smallest quantity to the largest.

The simulation uses TarCoins from already claimed rewards first. It adds TarCoins from a planned reward only after that reward becomes legally redeemable.

The buyout simulation uses the Safest reward sequence. Both cost scenarios use the same Classified Document bundle plan and gross TarCoin total.

#### Spend Battle Pass TarCoins

This scenario applies earned Battle Pass TarCoins to each Classified Document bundle. The remaining TarCoin amount requires store packages.

The optimizer does not accept an owned TarCoin balance. Only TarCoins from claimed and simulated Battle Pass rewards reduce this scenario cost.

#### Keep Battle Pass TarCoins

This scenario keeps all Battle Pass TarCoins. Store packages must cover the complete gross TarCoin cost of the Classified Document bundles.

#### Store package selection

The store-package optimizer can use each package more than once. A package combination must meet or exceed the required TarCoin amount.

The optimizer compares package combinations in this order:

1. Lower local price.
2. Fewer excess TarCoins.
3. Fewer packages.
4. Stable package-count order.

The optimizer converts prices to integer currency units before comparison. It uses only packages with localized prices in the same currency.

### Optional TarCoin route purchases

The Spend Battle Pass TarCoins option changes the farming route. It remains separate from the informational buyout calculation.

The route simulation processes rewards in legal order. For each reward, it applies regular Documents, owned Classified Documents, and previously purchased Classified Documents.

If a shortage remains, the optimizer searches for a bundle combination that the current earned TarCoin balance can fund.

For a complete combination, the optimizer uses this order:

1. Lower TarCoin cost.
2. Fewer Classified Documents above the shortage.
3. Fewer bundles.
4. Stable bundle-count order.

If no affordable combination covers the shortage, the optimizer selects the affordable combination with the largest Classified Document total.

Purchased Classified Documents remain available for later simulated rewards. A TarCoin reward enters the balance only after its reward is legally redeemed.

The optimizer recalculates the farming shortages and reward sequence after it applies the purchased Classified Documents.

### Farming optimizer

The farming optimizer produces independent Fastest and Safest routes. The selected game mode changes only the daily Document limit.

The fixed daily limits are 10 for PvE, 15 for PvP, and 25 for PvP Seasonal.

The optimizer does not model spawn probabilities, raid counts, extraction rates, or a per-location spawn limit. Each missing Document contributes one unit.

#### Location assignment

The optimizer evaluates every nonempty subset of configured locations. It rejects a subset when that subset cannot provide every missing document type.

For each missing document type, it selects the best eligible source in the subset. It assigns the full quantity of that type to one location.

The Fastest score is `sum(document quantity × maxRaidTimeMin)`. The maximum raid time acts as a speed and map-size proxy.

The Safest score is `sum(document quantity × difficultyRating)`. The difficulty rating uses Easy 1, Normal 2, Hard 3, and Insane 4.

Equipment insurance is a location property. It states whether insured player equipment can return after death.

Insurance does not apply to Documents. The Lab, The Labyrinth, and Ice Breaker are the only locations without equipment insurance.

The Fastest optimizer compares complete routes in this order:

1. Lower Fastest score.
2. Fewer distinct locations.
3. Fewer missing Documents.
4. Stable location ID order.

The Safest optimizer compares complete routes in this order:

1. Lower Safest score.
2. Fewer selected locations without equipment insurance.
3. Lower total maximum raid time for the selected locations.
4. Fewer distinct locations.
5. Fewer missing Documents.
6. Stable location ID order.

When one document type has equal-cost sources, Fastest uses stable location ID order. Safest uses insurance, lower maximum raid time, then stable location ID order.

The optimizer has no separate location-switch penalty. The distinct-location tie-break reduces location changes only after the earlier comparisons are equal.

#### Daily farming schedule

The schedule first claims each legally available reward that current resources cover. These claims are projections and do not change saved reward checkboxes.

The scheduler selects the next legal reward from the profile reward sequence. It farms only document shortages that belong to that reward.

Within a reward, the scheduler puts the lower profile factor first. It then uses location ID and document ID as stable tie-breakers.

The scheduler adds Documents until it reaches the fixed daily limit. It can include more than one location on the same day.

After each farming batch, the scheduler claims newly covered legal rewards. It continues this process until no farming shortage remains.

The next-raid recommendation is the first location in the first projected day. One Document is the priority pickup.

Other regular Documents at that location appear as optional pickups. The player can enter all results before the next recommendation.

If current inventory covers the pass, the optimizer recommends a stockpile raid for a future Black Division crate.

Fastest stockpiling uses maximum raid time, difficulty rating, then location ID. Safest uses difficulty, insurance, maximum raid time, then location ID.

#### Black Division crate fallback

If all Battle Pass rewards are claimed, the optimizer changes its goal to Black Division crates. One crate costs ten regular Documents of any type.

The optimizer subtracts all owned regular Documents from the requested total. Classified Documents and TarCoins do not reduce the crate requirement.

The daily schedule divides the remaining regular Document quantity by the selected mode limit. The next raid uses the applicable stockpile location order.

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
| [`locations.json`](public/data/locations.json) | Location difficulty ratings, maximum raid times, and equipment-insurance availability |
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
