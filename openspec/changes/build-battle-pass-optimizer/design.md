## Context

The repository currently contains the KORD BREACH screenshots and OpenSpec scaffolding but no application. The change introduces a client-only TypeScript optimizer for GitHub Pages. Players provide their game mode, document inventory, claimed rewards, Classified Documents, and TarCoin policy; the application combines those inputs with screenshot-reconstructed Battle Pass data to recommend farming locations and a reward-progressing daily plan.

The optimizer must distinguish the selected game mode's daily document limit from location routing factors. PvE, PvP, and PvP Seasonal use different daily limits, but they share the same location difficulty and size characteristics. `difficultyRating` is the numeric form of the official in-game `difficultyId` and drives Safest routing, while `maxRaidTimeMin` acts as a transparent map-size and speed proxy for Fastest routing.

## Goals / Non-Goals

**Goals:**

- Deliver a static, responsive optimization tool that can be deployed to GitHub Pages without a backend.
- Keep Battle Pass facts and optimization defaults in auditable, validated JSON reconstructed from the supplied screenshots.
- Produce deterministic plans and a legal recommended redemption sequence for every unclaimed reward, or a chosen number of Black Division crates after all rewards are claimed.
- Consume matching regular inventory first, maximize owned Classified Document consumption across all remaining rewards, then use useful `5:1` exchanges of surplus regular documents before farming or optional purchases.
- Optionally model TarCoin-funded Classified Document bundles without making TarCoin spending the default.
- Present Fastest and Safest route alternatives using maximum raid time and official difficulty rating, with deterministic low-hop tie-breaking and mode-specific daily-limit schedules.
- Persist player state in cookies and allow a complete reset to catalog defaults.
- Present a green-toned, Tarkov Battle Pass-inspired interface that remains accessible and clearly unofficial.
- Show the remaining season time from canonical metadata and stop cleanly when the season ends.
- Internationalize all visible and assistive text and require human-authored item/image/screenshot descriptions before release.
- Offer a reviewed, user-submitted feedback path through GitHub Issues without requiring a backend or embedded credentials.

**Non-Goals:**

- General Battle Pass documentation, news, progression guides, or reward showcases.
- Detailed routes, spawn coordinates, keys, or navigation within a Tarkov location.
- Accounts, cloud synchronization, telemetry, multiplayer sharing, or server-side processing.
- Automatic ingestion or OCR of screenshots at runtime.
- Predicting raid outcomes, PvP encounters, exact drop rates, or completion time from live game data.
- Pixel-for-pixel replication of the official interface, claiming ownership of game imagery, or presenting the tool as an official Battlestate Games product.

## Decisions

### 1. Use a framework-free Vite and TypeScript static application

The website will use semantic HTML, CSS, and TypeScript modules with direct DOM APIs. Vite's `vanilla-ts` setup will provide the development server and compile and bundle TypeScript into browser JavaScript. No UI framework or client runtime is required.

The reviewed Battle Pass workspace is the sole production `index.html` entry. Local development, Playwright, production builds, and GitHub Pages load that root entry directly; no secondary `wireframe.html` preview is shipped. The entry imports the shared catalog, localization, persistence, state, redemption, and optimizer-worker modules rather than maintaining a second domain implementation.

GitHub Pages serves the generated HTML, CSS, JavaScript, and JSON assets. A GitHub Actions workflow will build and deploy Vite's `dist` output. For a repository Pages site, the Vite base path will be configurable and initially set to `/eft-season-optimizer/`; a future custom-domain deployment can use `/`.

UI state will be coordinated through a small typed store or reducer and focused, idempotent render functions. All canonical game data ships as versioned JSON assets, and all player state stays in the browser.

Alternatives considered:

- React would provide component abstractions, but its runtime and framework surface are unnecessary for this focused static optimizer.
- Raw `tsc` plus manually managed assets is viable, but Vite simplifies local development, static asset loading, production bundling, and Pages base-path handling without imposing a UI framework.
- A server-rendered framework would add deployment and routing complexity without providing value for a fully client-side tool.

### 2. Follow the Battle Pass layout and visual hierarchy without making an exact clone

The screenshots are the visual and layout reference as well as evidence for Battle Pass data. The interface will derive a compact green-toned visual system from them: deep blue-black surfaces, muted military greens for selection and progress, desaturated text and borders, and restrained amber or red accents for warnings.

The desktop information architecture has two workspace columns and one credits footer:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: season · countdown · total progress · profile · setup│
├───────────────┬──────────────────────────────────────────────┤
│ Left          │ Focus                                        │
│ Reward pages  │ Next raid + actions + two raid-result docs  │
│               ├──────────────────────────────────────────────┤
│               │ Persistent owned-document ribbon            │
├───────────────┴──────────────────────────────────────────────┤
│ Footer: asset disclaimer · reset                             │
└──────────────────────────────────────────────────────────────┘
```

While Battle Pass rewards remain, the left column uses an exclusive page accordion with exactly one Battle Pass page open at a time. Each page heading selects that page, and the selected page is persisted. When the selected page has no unclaimed rewards left, the accordion opens the first page that still contains an unclaimed reward. Each page heading also shows its positive inventory-redeemable count. Every unclaimed reward is evaluated independently against the same current inventory snapshot because the count represents alternative choices, not rewards that can all be redeemed together. For each option, matching regular documents are applied first and the full owned Classified quantity may backfill only that reward's remaining shortage. Thus three Classified Documents make every reward requiring at most three total missing documents an individually redeemable option. Each such unclaimed row receives a restrained background highlight from the same calculation as the page count. The highlight updates with inventory and remains weaker than the claimed-row completion treatment. Regular-document exchanges, TarCoin purchases, farming, future reward grants, and page-unlock state are excluded from this document-sufficiency label. After every Battle Pass reward is claimed, the accordion is removed from the rendered rail and replaced by one Black Division Gear Crate reward with a localized requirement for ten documents of any non-Classified type. Global Claim all and Clear all actions sit in the rail heading; page bodies contain no buttons or selectors, only each reward's semantic claimed checkbox with its Battle Pass item name and compact document requirements. The native checkbox remains keyboard-focusable but is visually represented by a subtle green gradient across the completed row and a check icon at its inline end. A page heading receives the same green gradient when every reward on that page is claimed. Reward rows do not show artwork, long descriptions, stats, target selection, or unrelated metadata. Requirement abbreviations must remain unambiguous and expose their full localized text accessibly.

A claimed reward proves that its required documents were obtained even if the player did not enter them first. Its requirements therefore contribute to the header's document progress independently of the manually entered owned inventory. When current matching regular documents plus Classified backfill cover a checked reward, a native redemption dialog offers Redeem and subtract, Redeem only, and Cancel. Redeem and subtract atomically consumes matching regular documents first and Classified Documents only for the exact shortage; it receives initial focus so Enter chooses it. Redeem only tracks the reward without changing inventory. When recorded inventory cannot cover the checked reward, no warning popup appears: the reward is immediately marked claimed and document counts remain unchanged. Unchecking a reward and the global Claim all and Clear all actions remain tracking-only and do not reconstruct any reward allocation. Separately, the season-start grant is a state invariant: whenever the resulting claimed-reward set is empty, Classified Documents has a minimum of one. Zero remains valid while one or more rewards are claimed.

The Focus column is one next-raid workspace rather than a panel containing nested result cards. A redeemable reward never replaces or blocks the raid recommendation. Reward checkboxes remain the only confirmed progression state; projected claims may guide the schedule, but they do not mutate inventory or unlock pages in the live state. The optimizer may look ahead along the Page-12-first sequence to pre-farm the next ordinary-document deficit when the current page is already covered but its rewards remain unchecked. The Focus header shows the route purpose, localized location, official difficulty, and maximum raid time in a compact form such as `Factory (Easy, 15 min)`, with View full schedule and Commit aligned beside it. Estimated days do not appear in the normal workspace. The body shows both regular document types available at that location on one continuous surface. Their visible names use the same localized first-word treatment as the persistent inventory counters, while full localized names remain available to controls and images. Pickup role remains above the image; no repeated role or planned-quantity subtitle appears below the document name. During Battle Pass farming, exactly one document is the current priority and remains fully emphasized while the companion pickup is dimmed. During optional crate stockpiling, both documents are useful and remain fully emphasized. The player enters the extracted quantity for either type and activates Commit. Commit adds both values to the existing inventory counters in one persisted update, clears the draft inputs, and requests a new recommendation. Empty and unavailable states use the same workspace structure.

The former right context rail and full-width lower band are removed. The persistent owned-document ribbon becomes the bottom section of the expanded Focus region so the existing horizontal space replaces separate page height. Images dominate each tile while the localized name, decrement, direct numeric input, and increment controls remain visible and keyboard operable. The credits footer remains structurally separate below the workspace. Global mode, TarCoin spending, TarCoin balance, and conditional crate count remain in the native setup dialog. The header's primary navigation area shows total-based document and claimed-reward progress plus the Fastest/Safest toggle; locale and setup utilities remain in the adjacent account area. The Page-12-first complete-pass objective remains fixed rather than player-selectable. The localized asset disclaimer and link-styled cookie-storage reset button are centered on one line around a vertical divider; at narrow width they stack around a horizontal divider. Reset is not duplicated in the setup dialog.

The document-progress label places a link-styled approximate localized buyout price beside `Documents`, for example `DOCUMENTS (~$100) 1 / 501`. Only the price is interactive. It updates from the independent remaining-pass buyout estimate and opens a native modal containing the Classified Document bundle counts, gross and additional TarCoins, starting and earned TarCoin contributions, and the selected local TarCoin package counts, storefront prices, total minimum price, purchased amount, and excess. It remains informational, does not depend on the route-spending selector, and does not mutate state. If a complete local price is unavailable, the link uses a localized Buyout fallback rather than inventing a conversion. The link is removed after all Battle Pass rewards are claimed.

At and below the `1180px` desktop minimum, the regions stack in workflow order: header, Focus next raid, its internally scrolling owned-document ribbon, reward selection, then the credits footer. The responsive breakpoint matches the desktop minimum so no intermediate viewport retains a forced wider body. CSS grid areas and logical properties prepare the layout for right-to-left locales. No region relies on horizontal viewport scrolling, though the owned-document ribbon may scroll internally.

CSS custom properties will hold the screenshot-derived palette and spacing. The page is one continuous deep blue-black stage with a restrained teal glow and CSS-only grid texture. Thin separators define the major regions; strong borders identify only selected states, the document ribbon, dialogs, and the toast. Unclaimed regular content rows do not receive their own frames, elevated backgrounds, gradients, or shadows; claimed reward rows and fully claimed page headings use one restrained green completion gradient. Pale cream marks selected tabs, teal marks route and progress accents, and amber or red remains reserved for actions and warnings. Exact proprietary fonts are not required; the existing condensed system stack remains dependency-free.

The sole `index.html` style block begins with the small layout-map values intended for manual adjustment: stage width, header and footer sizing, reward and Focus proportions, region spacing, responsive sizing, and document image size. One shared LiftKit-inspired proportional type scale in `src/typography.css` defines caption, label, body, heading, metric, and display sizes; a single fluid root size scales those ratios between the authoritative 1440-pixel and 2560-pixel desktop widths, and components SHALL use the roles instead of one-off font-size values. A shared scale in `src/spacing.css` uses successive golden-ratio proportions for internal gaps, padding, and region spacing; components SHALL select a named step instead of declaring independent spacing formulas. Keeping the root markup, its layout map, and its visual states in one production entry removes the former preview-versus-live divergence while shared token files remain independently editable.

Header metrics, route summary values, the next action, and each location factor use explicitly named cells rather than shared `space-between` declarations. Desktop route rows use four columns for location, assigned documents, official difficulty, and maximum raid time. Normal content is left-aligned except explicitly numeric values. Document tiles use an image row, a fixed text band below the image for the localized name and nonzero deficit, and a separate quantity-control row; no document text is absolutely positioned over artwork.

The 1440-to-2560-pixel desktop presentation is authoritative. The body establishes an independent formatting context so the shell's outer block margins do not collapse beyond the viewport minimum and create empty page-level scrolling. One narrow-screen breakpoint retains every feature and stacks controls, results, rewards, and footer inventory in workflow order. The document tray may scroll internally; the viewport does not scroll horizontally.

The visual hierarchy permits at most one framed surface per major region. In particular, the center SHALL NOT render a framed result inside a framed panel, a framed next action inside that result, or framed locations inside the next action. Shadows are reserved for the native dialog and cookie toast. Semantic wrappers required for accessibility may remain in the DOM but do not create another visible surface.

A persistent credits footer, structurally separate from the document section, will state: “Escape from Tarkov and all game image assets displayed here belong to Battlestate Games. This is an unofficial fan-made optimization tool.” It remains available without opening a modal and is separate from the dismissible cookie notice.

Tarkov-inspired styling must preserve visible keyboard focus, semantic controls, readable contrast, responsive layout, and practical touch targets. Quantity inputs use non-negative integer validation and remain operable by keyboard. Decoration remains subordinate to content.

Document thumbnail sourcing will inventory every occurrence across the supplied screenshot collection, including Battle Pass page captures, reward views, exchange screens, main/guide screens, and dedicated document-definition screenshots. The dedicated definition screenshots primarily establish names, descriptions, and locations and receive no automatic preference as image sources. For each document, extraction chooses the clearest, largest, least-obscured occurrence and crops it to a consistent icon frame.

A naturally quantity-free occurrence is preferred. If quantity text such as `x0` or `x1` covers the best crop, matching clean pixels from another occurrence of the same icon are used before targeted reconstruction. Reconstruction is limited to pixels for which no clean screenshot source exists; it must not redesign, relabel, or otherwise alter the underlying document artwork. Cleaned icons are stored as lossless PNG files under `public/assets/documents/<document-id>.png`. Screenshot evidence is an authoring and review input only; runtime JSON contains the cleaned asset path and optimizer facts, not screenshot paths or extraction metadata. Every cleaned image receives a side-by-side fidelity review against all contributing sources confirming that no quantity numeral remains and no unrelated artwork was changed.

### 3. Drive the season countdown from canonical Unix metadata

`battle-pass.json` stores the season identifier as top-level `id: "season.one"` and the Unix deadline as top-level `endsAt: 1796637600`, which is `2026-12-07 10:00:00 UTC`. Runtime code converts `endsAt` from seconds to milliseconds once and calculates `max(0, endTime - Date.now())`; the value is not persisted in cookies.

The header displays days, hours, minutes, and seconds and refreshes at most once per second while the page is visible. At zero it stops its timer and displays “Season ended.” A details label exposes the absolute UTC end time so users can distinguish the canonical deadline from a countdown affected by an incorrect device clock. Frequent tick updates are not announced through an ARIA live region; assistive text provides a stable summary instead.

### 4. Internationalize text and make content completeness a release gate

No user-facing or assistive string is hard-coded in render functions. Domain JSON stores stable localization IDs rather than embedding one language throughout the optimizer. A dedicated `localization.json` file contains `defaultLocale`, supported-locale metadata such as display name and text direction, and an `entries` collection. Every entry keeps one stable `id` and all language values together:

```json
{
  "id": "documents.secured.description",
  "localizations": {
    "en": "…",
    "ru": "…"
  }
}
```

Names, descriptions, requirement abbreviations, image alternatives, screenshot descriptions, UI labels, countdown units, and validation messages use independent IDs so each entry has one semantic purpose and a consistent string value shape. Keeping all languages adjacent within the same entry makes omissions and translation differences easier to review than separate per-language dictionaries.

Locale-dependent real-money TarCoin package prices use a separate `priceEntries` collection in the same file. Each price entry keeps the same ID-centered shape, but each locale value is structured as integer `amountMinor`, ISO `currency`, and exact storefront `display`; calculations never parse the display string. Invariant TarCoin amounts remain ordinary numeric game data rather than localized currency values.

The configured default locale is always available. A locale appears in the header selector only when every required entry has a non-empty value for that locale; offered locales may not silently fall back for missing release content. Development builds may show conspicuous missing-ID markers, while production builds fail on missing, empty, duplicate, or orphaned IDs, missing locale values, or values for undeclared locales. The user's selected locale is stored in the UI-state cookie and falls back to the configured default when unsupported.

Formatting uses `Intl.NumberFormat`, `Intl.DateTimeFormat`, and locale-aware message templates rather than string concatenation. The countdown uses localized unit labels and plural forms while retaining the canonical UTC instant. The document abbreviations in the left column are localized data, not substrings cut from translated names.

Human-authored textual descriptions for every item, displayed item image, and displayed source screenshot are a release blocker. The user will provide this content. A release build must verify that the default locale and every locale exposed by the selector have complete UI strings, item names and descriptions, meaningful image alternatives, and required screenshot descriptions. Infrastructure may be implemented and previewed before that content exists, but the site cannot be marked publication-ready.

### 5. Separate domain data and localization into five validated JSON catalogs

The runtime data will be split into:

- `documents.json`: regular and Classified Document identifiers, `kind`, descriptions and image alternatives, and source location identifiers. Each document's canonical `id` is its name localization ID. Farmability, crate-exchange eligibility, and Classified-backfill eligibility are derived from `kind`; the catalog does not duplicate them as booleans.
- `locations.json`: location identifiers, `difficultyId`, matching numeric `difficultyRating`, and `maxRaidTimeMin`. Each location's canonical `id` is its name localization ID.
- `battle-pass.json`: top-level season `id` and `endsAt` metadata, game-data version, ordered pages, rewards, document requirements, and TarCoin grants. The initial canonical `gameDataVersion` is `1.1.0.0.46657.8.6.2026`, combining the current game version and evidence date supplied by the user.
- `optimizer-rules.json`: mode daily limits, `5:1` regular-document and `10:1` crate exchange ratios, Classified Document bundles, screenshot-priced TarCoin purchase packages, and deterministic optimization tie-breaking rules.
- `localization.json`: default and supported locale metadata plus ID-centered text and structured local-price entries; each entry has an `id` and a `localizations` object containing the values for every declared language side by side.

JSON data will be validated during tests and production builds before it is accepted by the optimizer. TypeScript domain types and validation schemas will reject unknown references, duplicate identifiers, duplicate name aliases, separate `nameId` fields, redundant document behavior flags, invalid kind-specific source data, negative quantities, non-positive maximum raid times, difficulty ratings outside the declared scale or inconsistent with `difficultyId`, invalid page ordering, and requirements for non-regular document kinds. Entity references use the same canonical localization-backed `id` throughout all catalogs; no parallel short ID or `nameId` is maintained.

Battle Pass page unlocks are an implicit rule derived from the ordered page groups: page 1 has no prior-page unlock requirement, and each later page requires acquisition of one fewer reward than exists on the immediately previous page. The verified thresholds for pages 2 through 12 are `4, 4, 4, 4, 4, 2, 3, 4, 4, 3, 3`. The runtime catalog stores no boolean or numeric page-unlock field.

Keeping global rules outside `locations.json` avoids coupling mode-wide limits and store bundles to map data. Keeping all localizable content in ID-centered `localization.json` entries avoids mixing translated prose with optimizer facts or scattering one language across separate files. Authoring data directly in TypeScript was rejected because the user requires independently editable JSON ground truth.

### 6. Isolate a pure optimizer engine from the UI

The optimizer will accept a normalized immutable input and return a structured result without reading cookies, browser globals, or UI state. The result will include:

- every unclaimed reward and its recommended legal redemption sequence;
- regular documents consumed and remaining;
- regular documents exchanged by source type and needed document received;
- Classified Documents consumed and left over;
- TarCoin bundles purchased, TarCoins spent, and unused purchased documents;
- remaining-pass buyout bundle breakdown, gross TarCoin spend, starting and earned TarCoins used, minimum additional TarCoins required, and the minimum localized real-money TarCoin-package estimate when available;
- remaining deficits by document type;
- assigned farming quantities by location;
- Fastest and Safest internal objective values, selected locations, and deterministic ordering, without exposing an unexplained abstract score in the UI;
- daily schedule under the effective mode limit; and
- one next-raid recommendation containing its Battle Pass or crate-stockpile purpose, location, both available documents, and an explicit priority, optional, or stockpile role for each pickup; and
- warnings for unavailable routes and release configuration.

This boundary allows exhaustive unit testing and makes future data updates independent of rendering. The next-raid workspace invokes the pure engine through a module Web Worker. Each request carries a monotonically increasing identifier, and the UI ignores stale responses after newer inventory or setting changes. Draft raid-result inputs stay in the DOM and do not trigger optimization until Commit.

### 7. Resolve all remaining rewards and inventory transformations before route optimization

While any Battle Pass reward remains unclaimed, the engine always includes every unclaimed reward. It builds a legal sequence that first minimizes selected-profile farming work needed to unlock Page 12, takes Page 12 rewards, and then clears every omitted earlier reward. Requirements are accumulated by regular document type; there is no selected-reward or partial-pass goal.

The Page-12 rush uses a deterministic bounded beam search. At each locked page it enumerates the reward combinations that satisfy that page's implicit unlock threshold, scores cumulative missing work with the active route factor, and keeps at most 16 states. Ties prefer fewer source locations, lower raw quantity, and stable reward IDs. The small bound keeps interactive recalculation practical while retaining cross-page choices that a one-reward greedy rule would discard. Fastest and Safest calculate their own sequence because their route factors can favor different combinations.

Existing matching regular documents are consumed first. The engine then identifies every remaining ordinary-document deficit across the legal all-unclaimed-rewards sequence that can accept Classified backfill. It fixes owned Classified consumption at `min(classifiedOwned, totalEligibleDeficit)`, making maximum legal consumption a higher-priority invariant than route-cost reduction or regular-document exchange. Whenever the eligible deficit is at least the owned quantity, the result therefore leaves zero owned Classified Documents.

Because Classified Documents are fungible backfill, the fixed maximum consumption quantity is allocated independently for Fastest and Safest along that profile's Page-12 rush sequence before cleanup deficits. This allows an owned Classified Document to make an early reward immediately redeemable instead of reducing unrelated late-pass farming. They may cover an entire reward when every required regular document is missing, but they are never chosen in place of matching regular documents already owned. Profile optimization decides where the fixed quantity is spent, not whether some legally usable owned Classified Documents are left unused.

After the maximum owned Classified quantity is fixed, each route profile may exchange any mixture of five surplus regular documents for one needed regular document. Duplicate source types are permitted. Surplus is inventory left only after reserving every matching regular document needed by all remaining rewards; Classified Documents are never exchange inputs. The exchange allocation is optimized independently for Fastest and Safest and is used only when it improves that profile's complete result.

If the all-unclaimed-rewards legal sequence contains no reward with an eligible missing-document deficit, the engine consumes no Classified Documents and reports the full owned quantity unchanged. In particular, Classified Documents are ignored in the all-rewards-claimed Black Division crate state; crate planning may continue using regular documents, but it performs no Classified action.

Aggregating requirements is sufficient for total farming quantities, while reward order is retained for presenting a legal redemption sequence and determining when TarCoin rewards become available.

### 8. Make TarCoin spending staged and opt-in, with a separate buyout estimate

The player will provide a current TarCoin balance. When “Spend TarCoins on Classified Documents” is disabled, bundles are excluded from route purchases and farming recommendations but remain available to the informational buyout estimator. When enabled, bundle evaluation begins only after matching regular inventory, the maximum legally usable owned Classified quantity, and useful regular-document exchanges are applied. TarCoins from a Battle Pass reward become spendable immediately after that reward is redeemed; there is no additional page-completion delay. The Battle Pass page only redirects the player to the Classified Document purchase flow.

Bundle selection is evaluated independently for Fastest and Safest as a bounded dynamic-programming problem over the TarCoin balance available at each reward step and the remaining deficits. The primary goal is to reduce the active profile's route cost; ties prefer fewer TarCoins spent, fewer excess purchased Classified Documents, and fewer bundles. This avoids assuming a linear TarCoin-to-document rate and prevents circular use of TarCoins from a reward that has not yet been redeemed.

The complete configured bundle table is retained because bundle prices are non-linear and is also used for a separate informational estimate of buying enough Classified Documents to complete every unclaimed Battle Pass reward. This buyout estimate is calculated regardless of the “Spend TarCoins on Classified Documents” selector and never mutates the farming recommendation, enables spending, or records a purchase.

The estimate first consumes owned matching regular documents and owned Classified Documents, applies useful `5:1` regular-document exchanges, then evaluates configured Classified bundle combinations against the remaining ordinary-document deficits for all unclaimed rewards. It simulates legal reward redemption order: the starting TarCoin balance is available immediately, TarCoins granted by a reward become available only after that reward is redeemed, and future reward grants cannot fund an earlier purchase. The estimator minimizes the additional TarCoins required to keep the staged sequence feasible, then total TarCoins spent, excess Classified Documents purchased, and bundle count. Its structured output reports the bundle breakdown, Classified Documents purchased and used, excess purchased documents, gross TarCoin spend, starting TarCoins used, Battle Pass TarCoins earned and used, and minimum additional TarCoins required.

Classified bundle costs remain invariant integer TarCoin game data, and TarCoins are not treated as an ISO currency. Separately, `optimizer-rules.json` records the six purchasable TarCoin packages reconstructed from the supplied store screenshots: totals `500`, `1,100`, `2,300`, `6,000`, `12,500`, and `20,250`, with bonus quantities `0`, `100`, `300`, `1,000`, `2,500`, and `5,250`. The unpriced one-time `2,000` TarCoin “RECEIVED” offer is not a purchasable input to cost calculations.

Each purchasable package references a structured locale-dependent price in `localization.json` containing integer minor units, ISO currency, and the exact localized storefront display. For English screenshot evidence the prices are `FROM $ 4.99`, `FROM $ 9.99`, `FROM $ 19.99`, `FROM $ 49.99`, `FROM $ 99.99`, and `FROM $ 149.99`. If every package needed by a candidate combination has a price for the active locale in one currency, the estimator chooses the combination that covers the additional TarCoin requirement by minimum local minor-unit cost, then excess TarCoins, then package count. Because the screenshots label prices “FROM,” the UI presents the result as a minimum/from estimate. It does not infer conversions or combine currencies when local pricing is incomplete.

### 9. Produce Fastest and Safest route alternatives

Each location has two global routing factors shared by PvE, PvP, and PvP Seasonal. `maxRaidTimeMin` roughly tracks map size and acts as the Fastest profile's speed proxy: a longer maximum raid time implies a larger, slower location. `difficultyId` resolves the official in-game difficulty label, and `difficultyRating` stores its numeric routing value using `Easy = 1`, `Normal = 2`, `Hard = 3`, and `Insane = 4` for the Safest profile. Keeping these factors mode-independent avoids unsupported assumptions that PvE materially changes location difficulty or that PvP Seasonal differs from PvP.

The initial catalog is:

| Location | Difficulty | Difficulty rating | Maximum raid time (min) |
|---|---:|---:|---:|
| The Lab | Insane | 4 | 30 |
| The Labyrinth | Insane | 4 | 30 |
| Ice Breaker | Insane | 4 | 50 |
| Ground Zero | Hard | 3 | 35 |
| Woods | Normal | 2 | 25 |
| Streets of Tarkov | Insane | 4 | 50 |
| Factory | Easy | 1 | 15 |
| Customs | Hard | 3 | 25 |
| Interchange | Hard | 3 | 35 |
| Reserve | Insane | 4 | 27 |
| Lighthouse | Insane | 4 | 30 |
| Shoreline | Hard | 3 | 35 |
| Terminal | Insane | 4 | 45 |

The optimizer evaluates the complete Classified allocation and farming assignment independently for two profiles:

- **Fastest** minimizes `sum(assigned documents × maxRaidTimeMin)`.
- **Safest** minimizes `sum(assigned documents × difficultyRating)`.

Each profile breaks ties by fewer distinct locations, lower raw farming quantity, then stable location identifier order. Shared document availability is therefore handled directly by the assignment. The number of known locations is small enough to enumerate candidate location subsets deterministically without an external solver.

The header presents one persisted Fastest/Safest toggle in the primary navigation area, defaulting to Safest, and renders only the selected profile. The selected result explains its locations through maximum raid time and official difficulty without showing abstract profile cost. If both profiles produce the same assignment, the selected view identifies the coincidence. If catalog eligibility makes a profile impossible, the result explains why that option is unavailable rather than returning a partial route. Once every reward is claimed, the toggle disappears and the single Fastest Black Division crate plan is shown.

### 10. Present daily scheduling as a cautious, progressively disclosed estimate

The application exposes one global game-mode selector whose value is passed into every optimizer calculation. It resolves the fixed daily document limit from `optimizer-rules.json`: 10 for PvE, 15 for PvP, and 25 for PvP Seasonal. The selected mode affects optimizer output only through this scheduling limit; it does not change reward requirements, inventory consumption, Classified or TarCoin rules, location eligibility, routing factors, route assignments, or route objective values. Each mode option displays its limit; the interface has no editable or duplicate readout.

The scheduler simulates Battle Pass progression instead of merely packing aggregate deficits by location. Until Page 12 unlocks, it follows the selected profile's bounded-search sequence, farms only the missing documents for those rewards, and redeems them as soon as their requirements are available. It then takes Page 12 rewards before clearing omitted earlier rewards. Each projected day remains within the fixed mode limit and groups work by location where possible.

Scheduling is secondary to the route recommendation. The initial view always shows the selected profile's next raid and routing factors when an eligible location exists; estimated days appear only after the player opens the full schedule. Projected immediately redeemable rewards remain schedule metadata and never suppress that raid. The first projected farming assignment becomes the next-raid location; if every remaining reward requirement is already covered, the optimizer instead returns an optional crate-stockpile raid. During Battle Pass farming the result marks one document as the priority and returns every regular document available at that location so an optional pickup can still be recorded. During crate stockpiling both location documents are useful. It explicitly calls the schedule a planning estimate rather than a promise about calendar dates, raid count, or random spawns.

A `View full schedule` action opens a native dialog whose header contains the selected profile's estimated days. A visible non-collapsible Plan actions section preserves every required regular-document exchange and opt-in Classified Document purchase assumed by the selected route, but omits Classified consumed/remaining statistics because the persistent counters remain authoritative. Projected rewards available now appear separately. Every estimated day uses a two-column manifest that clearly separates Raids, including location factors and document targets, from Rewards to redeem; those columns stack in that order on narrow screens. The schedule does not use day cards, show `PAGE X UNLOCKED` labels, or assign real dates unless a later requirement establishes a trustworthy reset-time model. The left-column exclusive accordion shows one selected Battle Pass page. A selected page whose previous-page claim threshold is unmet shows `Claim N more from Page X`; that hint disappears immediately when the threshold is met.

The daily limit affects only the projected schedule and estimated number of days, not the relative cost of two plans that require the same number of farmed documents. The application does not persist or display collected-today totals, a remaining daily allowance, a game-day reset action, raid history, or an event timeline. Uncommitted raid-result inputs exist only in the current DOM. Committed results become ordinary persisted inventory and are sufficient to drive the next calculation.

### 11. Keep a Black Division crate stockpile raid available

When every reward is marked claimed, the all-unclaimed-rewards plan switches to a crate-count control with a default of one. The engine first applies the player's regular-document inventory, identified by `kind: "regular"`, toward the 10:1 crate requirement, then assigns any shortage to the eligible farming location with the lowest `maxRaidTimeMin`. A larger user-selected crate count scales the requirement. If the requested crate quantity is already covered, the next raid remains available as an optional stockpile recommendation for another crate.

While rewards remain unchecked but current inventory already covers every remaining requirement, the goal stays `all-unclaimed-rewards` and the reward rail remains visible. The next raid alone switches to optional crate-stockpile purpose. Fastest chooses the eligible location by `maxRaidTimeMin`, Safest chooses by `difficultyRating`, and each uses the other factor followed by stable location ID as deterministic tie-breakers.

Classified Documents and Classified bundle purchases are excluded because Classified Documents cannot be exchanged. If the player already owns enough regular documents, the result recommends immediate exchanges before any farming.

### 12. Persist versioned state in bounded cookies and explain it once

State will be split into versioned first-party cookies for progress, optimizer settings, and UI preferences to remain within per-cookie size limits. Persisted UI preferences include the selected reward page and route profile, but not uncommitted raid-result inputs, derived next-raid output, schedule projections, or native-dialog state. Each envelope records the current `gameDataVersion` (`1.1.0.0.46657.8.6.2026` initially) and an independent integer cookie-schema version. The former identifies which game facts the selections were created against; the latter controls parsing and migration. Cookies will contain only compact JSON values, use a long but finite lifetime, and set `SameSite=Lax` and `Secure` when served over HTTPS. No game credentials or personal identifiers are stored.

On load, invalid or unknown cookie versions fall back safely to defaults. Fresh and reset state starts with one Classified Document, matching the season-start grant. Persisted inventory continues to take precedence except that a persisted zero is normalized to one when no rewards are claimed; persisted zero remains valid when at least one reward is claimed. The centered footer reset link requires confirmation, deletes every optimizer cookie, and restores that initial state. Cookie serialization and maximum-size behavior will be covered by tests.

On first use, a compact dismissible toast explains that cookies store planner selections on the device and links to a short details view. It does not block the optimizer or imply tracking. Dismissing the notice is persisted so it does not reappear on every visit. A complete reset removes the dismissal state as well, allowing the notice to appear again.

Alternatives considered:

- `localStorage` offers more space and simpler APIs, but cookies are an explicit product requirement.
- A single cookie is simpler but risks exceeding common per-cookie limits as claimed rewards and inventory values grow.

### 13. Open a prefilled GitHub issue for feedback, with user review

A persistent Feedback control opens a small in-page form. The user enters feedback and may enable “include optimizer context,” which is off by default. Before leaving the site, the UI previews the exact issue title and body.

On confirmation, the application uses `URLSearchParams` to open the repository's GitHub `/issues/new` composer in a new tab with encoded `title`, `body`, and optional template parameters. GitHub handles authentication, final review, and submission. The static site does not call the Issues API, embed a token, or claim that feedback was sent automatically.

Optional context is compact and non-sensitive: application data version, selected mode, effective daily limit, and whether the daily limit is customized. Inventory and claimed-reward details are excluded unless the user explicitly opts in and sees them in the preview. Input and generated URLs are length-limited. The repository target is release configuration rather than optimizer logic, and `.github/ISSUE_TEMPLATE/feedback.md` will provide structure on GitHub.

The owner and repository will be configured only after the UI/UX has been reviewed and the site is approved for publication. During local review, the feedback form and preview may be exercised, but its “Open GitHub issue” action remains disabled with a clear “available after publication” explanation until a valid repository target is configured.

Alternatives considered:

- Calling the GitHub Issues REST API directly is rejected because a public static site cannot safely store a write-capable token and GitHub must authenticate the submitter.
- A blank issue link is viable but creates unnecessary work compared with a concise prefilled report.
- Automatic submission is rejected because the user should review the content and explicitly submit it on GitHub.

### 14. Test data, optimizer invariants, DOM behavior, and user workflows separately

Vitest will cover JSON validation and pure optimizer scenarios, including prerequisite closure, classified backfill, immediate TarCoin availability, bundle selection, difficulty mappings, maximum raid times, Fastest and Safest alternatives, low-hop tie-breaking, fixed mode limits, reward claims that unlock the next page, complete reward coverage by the schedule, an always-present clean-state raid, covered-page look-ahead, and crate-stockpile fallback. Fake-timer tests will verify the exact season timestamp, localized countdown formatting, zero clamping, and timer shutdown. Localization validation tests will compare referenced IDs with `localization.json`, enforce unique entry IDs, verify every declared language value, and check item/image/screenshot description coverage. jsdom and Testing Library DOM will cover domain and state transitions retained outside the root entry. A Chromium-only Playwright suite will cover the production root interface behavior that requires a real browser: native redemption-dialog focus and Enter defaults when subtraction is available, direct tracking without a popup when inventory is insufficient, inventory preservation, always-available raid entry and Commit controls, SlimSelect menus, computed completed-state styles, exclusive accordion transitions, document artwork and tooltips, inventory controls, progress and cookie restoration, profile and mode persistence, global tracking-only actions, and the crate-stockpile fallback. The deployment check will install Chromium, run this suite, and reject a duplicate preview page before publishing.

Feedback tests will verify URL encoding, context opt-in, content limits, and that no issue-submission API is called. A production build check will catch broken GitHub Pages asset paths.

Screenshot transcription tests will assert known page/reward totals so data changes remain reviewable; screenshot paths remain outside the runtime catalogs.

## Risks / Trade-offs

- [Screenshot transcription errors] → Validate cross-references and totals, and review reconstructed data independently against the supplied screenshots before release without shipping screenshot paths in runtime catalogs.
- [Maximum raid time is only a speed proxy and official difficulty may not match personal risk] → Label both factors clearly, display the values used in every result, and keep them editable in the JSON catalog as game knowledge evolves.
- [Tarkov-inspired styling becomes unreadable or appears deceptively official] → Derive a restrained palette and layout language, preserve accessibility requirements, avoid copied branding assets, and display an unofficial-tool disclaimer.
- [The countdown is wrong because the device clock is wrong] → Store the canonical Unix timestamp, show the absolute UTC deadline, clamp at zero, and describe the timer as device-clock based.
- [Translations or textual descriptions are incomplete at publication] → Validate every referenced ID and declared language within the ID-centered catalog, expose only complete locales, fail production validation, and keep content completion as an explicit release gate.
- [The three-column layout becomes unusable on narrow or translated screens] → Use semantic source order, named grid areas, logical CSS properties, internal footer-tray scrolling, and stacked responsive regions.
- [TarCoin rewards create order-dependent plans] → Credit TarCoins immediately after each reward redemption, use deterministic bundle tie-breaking, and never credit an unredeemed reward early.
- [Cookie state exceeds browser limits or becomes incompatible] → Split and version cookies, test serialized size, and fall back to defaults on invalid state.
- [Framework-free DOM code accumulates inconsistent state] → Keep one typed state model, pure derivation functions, and small idempotent render functions.
- [Prefilled feedback exposes player state or exceeds URL limits] → Keep context opt-in, preview the exact report, exclude detailed inventory by default, and enforce conservative input and URL limits.
- [Exhaustive subset enumeration grows] → Keep location activation enumeration bounded to the small catalog; introduce branch-and-bound only if measured performance requires it.
- [Game rules or store bundles change] → Version season data and optimizer rules in JSON rather than hard-coding values.
- [Static asset paths fail on GitHub Pages] → Configure and test the repository base path in the production build and deployment workflow.

## Migration Plan

1. Scaffold Vite's framework-free `vanilla-ts` application, semantic HTML/CSS shell, automated test environment, and GitHub Pages workflow.
2. Transcribe and validate the five JSON catalogs, including `localization.json`, against the supplied screenshots and human-authored descriptions.
3. Implement the pure optimizer and scenario tests before connecting UI state.
4. Add the five-region responsive layout, footer inventory controls, season countdown, asset disclaimer, optimizer results, cautious schedule disclosure, versioned cookie persistence and toast, reset behavior, feedback issue composer, and localization infrastructure.
5. Load human-authored localized item/image/screenshot descriptions, validate every release locale, and complete accessibility and UI/UX review.
6. After UI/UX and content approval, configure the GitHub owner/repository and feedback template, verify a production build with the GitHub Pages base path, and deploy through GitHub Actions.

There is no existing application data to migrate. Rollback consists of restoring the previous Pages deployment or disabling the new workflow; versioned cookies can be ignored or cleared by a later build.

## Release Gates

- The configured default locale and every locale shown in the selector have a non-empty localization in every required ID entry.
- Human-authored item names and descriptions, image alternatives, and displayed screenshot descriptions are present and reviewed.
- The five-region UI and its responsive stacking have passed UI/UX and accessibility review.
- No development missing-key markers or placeholder descriptions remain in the production build.

## Deferred Publication Configuration

The GitHub owner/repository URL and any feedback label remain intentionally unset until the UI/UX is reviewed and the site is approved for publication. They are release configuration, not unresolved optimizer behavior.
