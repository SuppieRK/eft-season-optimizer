## Context

The repository currently contains the KORD BREACH screenshots and OpenSpec scaffolding but no application. The change introduces a client-only TypeScript optimizer for GitHub Pages. Players provide their game mode, document inventory, claimed rewards, and Classified Documents; the application combines those inputs with screenshot-reconstructed Battle Pass data to recommend farming locations and a reward-progressing daily plan.

The optimizer must distinguish the selected game mode's daily document limit from location routing factors. PvE, PvP, and PvP Seasonal use different daily limits, but they share the same location difficulty, insurance availability, and size characteristics. `difficultyRating` is the numeric form of the official in-game `difficultyId` and drives Safest routing, while `insurance` records whether insured player equipment can return from the location and `maxRaidTimeMin` acts as a transparent map-size and speed proxy for Fastest routing.

## Goals / Non-Goals

**Goals:**

- Deliver a static, responsive optimization tool that can be deployed to GitHub Pages without a backend.
- Keep Battle Pass facts and optimization defaults in auditable, validated JSON reconstructed from the supplied screenshots.
- Produce deterministic plans and a legal recommended redemption sequence for every unclaimed reward, or a chosen number of Black Division crates after all rewards are claimed.
- Consume matching regular inventory first, maximize owned Classified Document consumption across all remaining rewards, then use useful `5:1` exchanges of surplus regular documents before farming.
- Keep TarCoin-funded Classified Document bundles in a non-mutating informational buyout estimate instead of changing farming routes.
- Present Fastest and Safest route alternatives using maximum raid time, official difficulty rating, and equipment-insurance availability, with deterministic low-hop tie-breaking and mode-specific daily-limit schedules.
- Persist player state in cookies and allow a complete reset to catalog defaults.
- Present a green-toned, Tarkov Battle Pass-inspired interface that remains accessible and clearly unofficial.
- Show the remaining season time from canonical metadata and stop cleanly when the season ends.
- Internationalize all visible and assistive text and require human-authored item/image/screenshot descriptions before release.
- Offer a reviewed, user-submitted feedback path through GitHub Issues without requiring a backend or embedded credentials.

**Non-Goals:**

- General Battle Pass documentation, news, progression guides, or reward showcases.
- Detailed routes, spawn coordinates, keys, or navigation within a Tarkov location.
- Accounts, cloud synchronization, multiplayer sharing, or server-side processing.
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

While Battle Pass rewards remain, the left column uses an exclusive page accordion with exactly one Battle Pass page open at a time. Each page heading selects that page, and the selected page is persisted. When the selected page has no unclaimed rewards left, the accordion searches forward and opens the next later page with an unclaimed reward; it wraps to earlier incomplete pages only when no later page remains. Each page heading also shows its positive inventory-covered count. Every unclaimed reward is evaluated independently against the same current inventory snapshot because the count represents alternative choices, not rewards that can all be redeemed together. For each option, matching regular documents are applied first and the full owned Classified quantity may backfill only that reward's remaining shortage. Thus three Classified Documents make every reward requiring at most three total missing documents an individually covered option. On an unlocked page, the heading calls these options redeemable. On a locked page, the heading calls them ready when unlocked and renders only that heading count in amber. The count changes from amber to the normal redeemable treatment as soon as the implicit previous-page reward-count-minus-one threshold is met. Covered reward rows keep the existing restrained green background regardless of page access, and every reward checkbox remains freely editable for progress entry. The highlights update with inventory and remain weaker than the claimed-row completion treatment. Regular-document exchanges, farming, informational buyout bundles, and future reward grants are excluded from this document-sufficiency calculation. After every Battle Pass reward is claimed, the accordion is removed from the rendered rail and replaced by one Black Division Gear Crate reward with a localized requirement for ten documents of any non-Classified type. Global Claim all and Clear all actions sit in the rail heading; page bodies contain no buttons or selectors, only each reward's semantic claimed checkbox with its Battle Pass item name and compact document requirements. The native checkbox remains keyboard-focusable but is visually represented by a subtle green gradient across the completed row and a check icon at its inline end. A page heading receives the same green gradient when every reward on that page is claimed. Reward rows do not show artwork, long descriptions, stats, target selection, or unrelated metadata. Requirement abbreviations must remain unambiguous and expose their full localized text accessibly.

A claimed reward proves that its required documents were obtained even if the player did not enter them first. Its requirements therefore contribute to the header's document progress independently of the manually entered owned inventory. When current matching regular documents plus Classified backfill cover a checked reward, a native redemption dialog offers Redeem and subtract, Redeem only, and Cancel. Redeem and subtract atomically consumes matching regular documents first and Classified Documents only for the exact shortage; it receives initial focus so Enter chooses it. Redeem only tracks the reward without changing inventory. When recorded inventory cannot cover the checked reward, no warning popup appears: the reward is immediately marked claimed and document counts remain unchanged. Unchecking a reward and the global Claim all and Clear all actions remain tracking-only and do not reconstruct any reward allocation. Separately, the season-start grant is a state invariant: whenever the resulting claimed-reward set is empty, Classified Documents has a minimum of one. Zero remains valid while one or more rewards are claimed.

The Focus column is one next-raid workspace rather than a panel containing nested result cards. A redeemable reward never replaces or blocks the raid recommendation. Reward checkboxes remain the only confirmed progression state; projected claims may guide the schedule, but they do not mutate inventory or unlock pages in the live state. The optimizer may look ahead along the Page-12-first sequence to pre-farm the next ordinary-document deficit when the current page is already covered but its rewards remain unchecked. The Focus header shows the route purpose, localized location, official difficulty, and maximum raid time in a compact form such as `Factory (Easy, 15 min)`, with View full schedule and Commit aligned beside it. Estimated days do not appear in the normal workspace. When an optimizer-affecting state change starts a worker request, Focus keeps the current heading and result content in place, marks the region busy, and temporarily dims that existing result while stale schedule and Commit actions are disabled. Only the latest worker response replaces the result and removes the busy treatment. Page navigation and switching between already-calculated Fastest and Safest profiles do not enter this loading state. The body shows both regular document types available at that location on one continuous surface. Their visible names use the same localized first-word treatment as the persistent inventory counters, while full localized names remain available to controls and images. Pickup role remains above the image; no repeated pickup-role or planned-quantity subtitle appears below the document name. During Battle Pass farming, every still-needed document type assigned to the recommended location is a priority and remains fully emphasized; only location documents that do not advance the selected route are optional and dimmed. During optional crate stockpiling, both documents are useful and remain fully emphasized. The localized raid-result instruction renders its Commit term as an inline link-styled action that delegates to the same operation as the Focus-header Commit button. Either action adds both entered values to the existing inventory counters in one persisted update, clears the draft inputs, and requests a new recommendation. Empty and unavailable states use the same workspace structure.

The former right context rail and full-width lower band are removed. The persistent owned-document ribbon becomes the bottom section of the expanded Focus region so the existing horizontal space replaces separate page height. A compact localized note above the ribbon states that document counts are independent from reward claims and must be adjusted separately. Images dominate each tile while the localized name, decrement, direct numeric input, and increment controls remain visible and keyboard operable. Every tile, square artwork frame, and quantity control uses the exact same shared dimensions; intrinsic title width must not enlarge any tile or child control. The credits footer remains structurally separate below the workspace. Global mode and conditional crate count remain in the native setup dialog; no editable TarCoin balance or route-purchase control is exposed. The header has two semantic sections: its left summary groups season identity with total-based document and claimed-reward progress, while its right controls group the Fastest/Safest toggle, mode, and locale. A Lucide CircleHelp control beside season identity reveals a concise localized two-paragraph optimizer workflow tooltip on hover or keyboard focus. The vector's square viewBox defines its round outline independently from font metrics. The Page-12-first complete-pass objective remains fixed rather than player-selectable. The localized asset disclaimer and link-styled cookie-storage reset button are centered on one line around a vertical divider; at narrow width they stack around a horizontal divider. Reset is not duplicated in the setup dialog.

The document-progress label places a link-styled approximate localized buyout price beside `Documents`, for example `DOCUMENTS (~$100) 1 / 501`. Only the price is interactive. It updates from the independent remaining-pass buyout estimate and opens a native modal titled `Battle Pass buyout`. The modal contains exactly two concise comparison sections: Spend Battle Pass TarCoins and Keep Battle Pass TarCoins. Both scenario headings use the same season-accent color as an unlocked `X redeemable` count. A larger golden-ratio spacing step before Keep Battle Pass TarCoins visually separates the two alternatives. Each section renders TarCoin packages first and Classified Document bundles second as flat tables with bundle or package source, quantity, TarCoins, storefront price, and totals. The spend table includes one aggregated Battle Pass TarCoin contribution; the keep table excludes that contribution and purchases enough TarCoins to cover gross Classified bundle spend. It does not render separate funding, calculation-explanation, minimum-additional, starting-versus-earned, or `FROM estimate` prose. Individual package rows and table totals format their structured numeric prices for the active locale and ISO currency without storing or displaying a `FROM` prefix. The modal remains informational and does not mutate state or farming routes. If a complete local price is unavailable, the link uses a localized Buyout fallback rather than inventing a conversion. The link is removed after all Battle Pass rewards are claimed.

At and below the `1180px` desktop minimum, the regions stack in workflow order: header, Focus next raid, its internally scrolling owned-document ribbon, reward selection, then the credits footer. The responsive breakpoint matches the desktop minimum so no intermediate viewport retains a forced wider body. CSS grid areas and logical properties prepare the layout for right-to-left locales. No region relies on horizontal viewport scrolling, though the owned-document ribbon may scroll internally.

CSS custom properties will hold the screenshot-derived palette and spacing. The role colors are season accent `#428c73`, regular-document border `#95d6bc`, neutral action surface `#3f5960`, and purchase/readiness accent `#af8a45`. The page is one continuous deep blue-black stage with a restrained teal glow and CSS-only grid texture. The two header sections remain transparent and unframed; only their controls and internal dividers provide local structure. Focus-header and Rewards-header buttons share one exact control height, while Commit and Claim all/Clear all also share the neutral action-surface treatment. Thin separators define the major regions; strong borders identify only selected states, the document ribbon, dialogs, and the toast. Unclaimed regular content rows do not receive their own frames, elevated backgrounds, gradients, or shadows; claimed reward rows and fully claimed page headings use one restrained green completion gradient. The purchase/readiness accent marks the Documents buyout price and document-covered opportunities on locked pages, while red remains reserved for warnings. Exact proprietary fonts are not required; the existing condensed system stack remains dependency-free.

The sole `index.html` style block begins with the small layout-map values intended for manual adjustment: stage width, header and footer sizing, reward and Focus proportions, region spacing, responsive sizing, and document image size. One shared LiftKit-inspired proportional type scale in `src/typography.css` defines caption, label, body, heading, metric, and display sizes; a single fluid root size scales those ratios between the authoritative 1440-pixel and 2560-pixel desktop widths, and components SHALL use the roles instead of one-off font-size values. A shared scale in `src/spacing.css` uses successive golden-ratio proportions for internal gaps, padding, and region spacing; components SHALL select a named step instead of declaring independent spacing formulas. Keeping the root markup, its layout map, and its visual states in one production entry removes the former preview-versus-live divergence while shared token files remain independently editable.

Header metrics, route summary values, the next action, and each location factor use explicitly named cells rather than shared `space-between` declarations. Desktop route rows use four columns for location, assigned documents, official difficulty, and maximum raid time. Normal content is left-aligned except explicitly numeric values. Document tiles use an image row, a fixed text band below the image for the localized name and nonzero deficit, and a separate quantity-control row; no document text is absolutely positioned over artwork.

The 1440-to-2560-pixel desktop presentation is authoritative. The body establishes an independent formatting context so the shell's outer block margins do not collapse beyond the viewport minimum and create empty page-level scrolling. One narrow-screen breakpoint retains every feature and stacks controls, results, rewards, and footer inventory in workflow order. Progress blocks, Focus cards, header selectors, and document counters wrap into additional rows as their available width decreases; neither the document tray nor the viewport scrolls horizontally.

The visual hierarchy permits at most one framed surface per major region. In particular, the center SHALL NOT render a framed result inside a framed panel, a framed next action inside that result, or framed locations inside the next action. Shadows are reserved for the native dialog and cookie toast. Semantic wrappers required for accessibility may remain in the DOM but do not create another visible surface.

A persistent credits footer, structurally separate from the document section, will state: “Escape from Tarkov and all game assets displayed here belong to Battlestate Games. This is an unofficial fan-made optimization tool.” It remains available without opening a modal and is separate from the dismissible cookie notice.

Tarkov-inspired styling must preserve visible keyboard focus, semantic controls, readable contrast, responsive layout, and practical touch targets. Quantity inputs use non-negative integer validation and remain operable by keyboard. Decoration remains subordinate to content.

Document thumbnail sourcing will inventory every occurrence across the supplied screenshot collection, including Battle Pass page captures, reward views, exchange screens, main/guide screens, and dedicated document-definition screenshots. The dedicated definition screenshots primarily establish names, descriptions, and locations and receive no automatic preference as image sources. For each document, extraction chooses the clearest, largest, least-obscured occurrence and crops it to a consistent icon frame.

A naturally quantity-free occurrence is preferred. If quantity text such as `x0` or `x1` covers the best crop, matching clean pixels from another occurrence of the same icon are used before targeted reconstruction. Reconstruction is limited to pixels for which no clean screenshot source exists; it must not redesign, relabel, or otherwise alter the underlying document artwork. Cleaned icons are stored as high-quality WebP files under `public/assets/documents/<document-id>.webp`. Screenshot evidence is an authoring and review input only; runtime JSON contains the cleaned asset path and optimizer facts, not screenshot paths or extraction metadata. Every cleaned image receives a side-by-side fidelity review against all contributing sources confirming that no quantity numeral remains and no unrelated artwork was changed.

### 3. Drive the season countdown from canonical Unix metadata

`battle-pass.json` stores the season identifier as top-level `id: "season.one"` and the Unix deadline as top-level `endsAt: 1796634000`, which is `2026-12-07 09:00:00 UTC`. Runtime code treats this catalog field as the sole deadline source, validates only that it is a positive integer, converts it from seconds to milliseconds once, and calculates `max(0, endTime - Date.now())`; the value is not duplicated in runtime code or persisted in cookies.

The header displays days, hours, minutes, and seconds and refreshes at most once per second while the page is visible. At zero it stops its timer and displays “Season ended.” A details label exposes the absolute UTC end time so users can distinguish the canonical deadline from a countdown affected by an incorrect device clock. Frequent tick updates are not announced through an ARIA live region; assistive text provides a stable summary instead.

### 4. Internationalize text and make content completeness a release gate

No user-facing or assistive string is hard-coded in render functions. Domain JSON stores stable localization IDs rather than embedding one language throughout the optimizer. A dedicated `localization.json` file contains `defaultLocale`, supported-locale metadata such as display name and text direction, and an `entries` collection. Every entry keeps one stable `id` and all language values together:

```json
{
  "id": "documents.secured.description",
  "localizations": {
    "en-GB": "…",
    "ru-RU": "…"
  }
}
```

Names, descriptions, requirement abbreviations, image alternatives, screenshot descriptions, UI labels, countdown units, and validation messages use independent IDs so each entry has one semantic purpose and a consistent string value shape. Keeping all languages adjacent within the same entry makes omissions and translation differences easier to review than separate per-language dictionaries.

Locale-dependent real-money TarCoin package prices use a separate `priceEntries` collection in the same file. Each price entry keeps the same ID-centered shape, but each locale value contains only numeric major-unit `price` and a three-letter uppercase ISO `currency` code. Display strings are derived with `Intl.NumberFormat` and its narrow currency symbol; no preformatted storefront price is stored or parsed. Calculations normalize the numeric price to the ISO currency's fraction digits before comparing package combinations. Invariant TarCoin amounts remain ordinary numeric game data rather than localized currency values.

The configured default locale is always available. Catalog locale keys use regional BCP 47 tags such as `en-GB`; the region selects the corresponding 4:3 image from the installed `flag-icons` package, while the complete tag drives `Intl` formatting and browser preference matching. A Vite virtual module generated from `supportedLocales` replaces the former hard-coded `en` text-locale to `gb.svg` mapping, emits only declared 4:3 flag assets, and does not require a new icon import when another regional locale is added. A locale appears in the header selector only when every required entry has a non-empty value for that locale; offered locales may not silently fall back for missing release content. The initial `ru-RU` catalog is a complete best-effort draft whose terminology still requires human review. Its structured price entries explicitly retain the screenshot-backed USD values until reviewed regional prices are supplied; the application performs no fallback or currency conversion. Development builds may show conspicuous missing-ID markers, while production builds fail on missing, empty, duplicate, orphaned, invalid, or regionless locale IDs, missing locale values, or values for undeclared locales. The user's selected locale is stored in the UI-state cookie. On a first visit, the application chooses an exact browser preference or one unambiguous supported variant of the same language before falling back to the configured default; a valid stored locale remains authoritative.

Formatting uses `Intl.NumberFormat`, `Intl.DateTimeFormat`, and locale-aware message templates rather than string concatenation. The countdown uses localized unit labels and plural forms while retaining the canonical UTC instant. The document abbreviations in the left column are localized data, not substrings cut from translated names.

Human-authored textual descriptions for every item, displayed item image, and displayed source screenshot are a release blocker. The best-effort Russian terminology and its regional prices also require user review. A release build must verify that the default locale and every locale exposed by the selector have complete UI strings, item names and descriptions, meaningful image alternatives, and required screenshot descriptions. Infrastructure may be implemented and previewed before that content exists, but the site cannot be marked publication-ready.

### 5. Separate domain data and localization into five validated JSON catalogs

The runtime data will be split into:

- `documents.json`: regular and Classified Document identifiers, `kind`, descriptions and image alternatives, and source location identifiers. Each document's canonical `id` is its name localization ID. Farmability, crate-exchange eligibility, and Classified-backfill eligibility are derived from `kind`; the catalog does not duplicate them as booleans.
- `locations.json`: location identifiers, `difficultyId`, matching numeric `difficultyRating`, `maxRaidTimeMin`, and an `insurance` boolean that records whether insured player equipment can return from the location. Each location's canonical `id` is its name localization ID.
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
- remaining-pass buyout bundle breakdown, gross TarCoin spend, Battle Pass TarCoins used, minimum additional TarCoins required, and the minimum localized real-money TarCoin-package estimate when available;
- remaining deficits by document type;
- assigned farming quantities by location;
- Fastest and Safest internal objective values, selected locations, and deterministic ordering, without exposing an unexplained abstract score in the UI;
- daily schedule under the effective mode limit; and
- one next-raid recommendation containing its Battle Pass or crate-stockpile purpose, location, both available documents, and an explicit priority, optional, or stockpile role for each pickup; and
- warnings for unavailable routes and release configuration.

This boundary allows exhaustive unit testing and makes future data updates independent of rendering. The next-raid workspace invokes the pure engine through a module Web Worker. Each request carries a monotonically increasing identifier, and the UI ignores stale responses after newer inventory or setting changes. Draft raid-result inputs stay in the DOM and do not trigger optimization until Commit.

### 7. Resolve all remaining rewards and inventory transformations before route optimization

While any Battle Pass reward remains unclaimed, the engine always includes every unclaimed reward. It builds a legal sequence that first minimizes selected-profile farming work needed to unlock Page 12, takes Page 12 rewards, and then clears every omitted earlier reward. Requirements are accumulated by regular document type; there is no selected-reward or partial-pass goal.

The Page-12 rush uses a deterministic bounded beam search. At each locked page it enumerates the reward combinations that satisfy that page's implicit unlock threshold, scores cumulative missing work with the active route factor, and keeps at most 16 states. Ties prefer fewer source locations, lower raw quantity, and stable reward IDs. The small bound keeps interactive recalculation practical while retaining cross-page choices that a one-reward greedy rule would discard. Fastest and Safest calculate their own sequence because their route factors can favor different combinations. One shared page-access gate applies to beam expansion, Page 12 prioritization, cleanup rewards, projected immediate claims, daily claims, and buyout simulation. No optimizer path may select a reward from Page X before the confirmed and simulated claims on Page X - 1 reach that page's reward count minus one.

Existing matching regular documents are consumed first. The engine then identifies every remaining ordinary-document deficit across the legal all-unclaimed-rewards sequence that can accept Classified backfill. It fixes owned Classified consumption at `min(classifiedOwned, totalEligibleDeficit)`, making maximum legal consumption a higher-priority invariant than route-cost reduction or regular-document exchange. Whenever the eligible deficit is at least the owned quantity, the result therefore leaves zero owned Classified Documents.

Because Classified Documents are fungible backfill, the fixed maximum consumption quantity is allocated independently for Fastest and Safest along that profile's Page-12 rush sequence before cleanup deficits. This allows an owned Classified Document to make an early reward immediately redeemable instead of reducing unrelated late-pass farming. They may cover an entire reward when every required regular document is missing, but they are never chosen in place of matching regular documents already owned. Profile optimization decides where the fixed quantity is spent, not whether some legally usable owned Classified Documents are left unused.

After the maximum owned Classified quantity is fixed, each route profile may exchange any mixture of five surplus regular documents for one needed regular document. Duplicate source types are permitted. Surplus is inventory left only after reserving every matching regular document needed by all remaining rewards; Classified Documents are never exchange inputs. The exchange allocation is optimized independently for Fastest and Safest and is used only when it improves that profile's complete result.

If the all-unclaimed-rewards legal sequence contains no reward with an eligible missing-document deficit, the engine consumes no Classified Documents and reports the full owned quantity unchanged. In particular, Classified Documents are ignored in the all-rewards-claimed Black Division crate state; crate planning may continue using regular documents, but it performs no Classified action.

Aggregating requirements is sufficient for total farming quantities, while reward order is retained for presenting a legal redemption sequence and determining when TarCoin rewards become available.

### 8. Keep TarCoin spending in a separate buyout estimate

The application does not ask the player for a TarCoin balance and does not use TarCoin purchases to change farming routes. It derives informational Battle Pass TarCoins from claimed TarCoin rewards and credits future TarCoin rewards immediately after simulated redemption. The Battle Pass page only redirects the player to the Classified Document purchase flow.

The complete configured bundle table is retained because bundle prices are non-linear. It is used only for an informational estimate of Classified Document bundles that can contribute toward every unclaimed Battle Pass reward. This buyout estimate never mutates the farming recommendation or records a purchase.

The estimate first consumes matching regular documents and current Classified Documents and applies useful `5:1` regular-document exchanges. It then visits configured Classified bundles from largest document quantity to smallest and takes as many of each bundle as fit within the combined remaining deficit. The selected bundle total never exceeds that deficit; an uncovered remainder is allowed and stays part of the farming plan. For example, 450 selects `250 + 75 + 75 + 40`, 350 selects `250 + 75 + 20`, and 71 selects `40 + 20`. It stages that fixed plan through legal reward redemption order: TarCoins from already claimed Battle Pass rewards are available immediately, TarCoins granted by a future reward become available only after that reward is redeemed, and future reward grants cannot fund an earlier bundle. Its structured output reports only the recommended Classified bundle counts, gross TarCoin spend, Battle Pass TarCoins earned and used, minimum additional TarCoins required, and local TarCoin package estimates. It does not report or persist Classified Documents as purchased, used, or excess.

Classified bundle costs remain invariant integer TarCoin game data, and TarCoins are not treated as an ISO currency. Separately, `optimizer-rules.json` records the six purchasable TarCoin packages reconstructed from the supplied store screenshots. Each `tarCoins` value includes the credited bonus and therefore stores final totals `500`, `1,200`, `2,600`, `7,000`, `15,000`, and `25,500`. TarCoin packages do not retain a separate `bonusTarCoins` field. Classified Document bundle discounts are informational store presentation, are not optimizer inputs, and are not stored as `bonusTarCoins`. The unpriced one-time `2,000` TarCoin “RECEIVED” offer is not a purchasable input to cost calculations.

Each purchasable package references a structured locale-dependent price in `localization.json` containing numeric `price` and three-letter uppercase ISO `currency`. For English screenshot evidence the numeric prices are `4.99`, `9.99`, `19.99`, `49.99`, `99.99`, and `149.99` in `USD`. If every package needed by a candidate combination has a price for the active locale in one currency, the estimator chooses the combination that covers the additional TarCoin requirement by minimum normalized local cost, then excess TarCoins, then package count. It also calculates a keep-Battle-Pass-TarCoins package combination against gross TarCoin spend. Individual package rows and each table footer format the numeric amount at runtime for the active locale and currency, without a `FROM` label or separate estimate sentence. The estimator does not infer conversions or combine currencies when local pricing is incomplete.

### 9. Produce Fastest and Safest route alternatives

Each location has global routing factors shared by PvE, PvP, and PvP Seasonal. `maxRaidTimeMin` roughly tracks map size and acts as the Fastest profile's speed proxy: a longer maximum raid time implies a larger, slower location. `difficultyId` resolves the official in-game difficulty label, and `difficultyRating` stores its numeric routing value using `Easy = 1`, `Normal = 2`, `Hard = 3`, and `Insane = 4` for the Safest profile. The `insurance` boolean records whether insured player equipment can return after death on that location; it does not describe or alter documents. Keeping these factors mode-independent avoids unsupported assumptions that PvE materially changes location difficulty or that PvP Seasonal differs from PvP.

The initial catalog is:

| Location | Difficulty | Difficulty rating | Maximum raid time (min) | Insurance |
|---|---:|---:|---:|---:|
| The Lab | Insane | 4 | 30 | No |
| The Labyrinth | Insane | 4 | 30 | No |
| Ice Breaker | Insane | 4 | 50 | No |
| Ground Zero | Hard | 3 | 35 | Yes |
| Woods | Normal | 2 | 25 | Yes |
| Streets of Tarkov | Insane | 4 | 50 | Yes |
| Factory | Easy | 1 | 15 | Yes |
| Customs | Hard | 3 | 25 | Yes |
| Interchange | Hard | 3 | 35 | Yes |
| Reserve | Insane | 4 | 27 | Yes |
| Lighthouse | Insane | 4 | 30 | Yes |
| Shoreline | Hard | 3 | 35 | Yes |
| Terminal | Insane | 4 | 45 | Yes |

The optimizer evaluates the complete Classified allocation and farming assignment independently for two profiles:

- **Fastest** minimizes `sum(projected raids at a location × maxRaidTimeMin)`.
- **Safest** minimizes `sum(projected raids at a location × difficultyRating)`, then prefers routes whose selected locations support equipment insurance, then lower total projected raid time.

For route comparison only, the projected raid count at one location is the largest deficit assigned among its useful document types. This models the opportunity to collect different needed types during the same raid without inventing spawn probabilities or guaranteeing actual yield. After the profile-specific tie-breakers, each profile prefers fewer distinct locations, lower raw farming quantity, then stable location identifier order. The number of document types and sources is small enough to enumerate complete source assignments deterministically without an external solver.

The header presents one persisted Fastest/Safest toggle in its right control section, defaulting to Safest, and renders only the selected profile. The selected result explains its locations through maximum raid time and official difficulty without showing abstract profile cost. If both profiles produce the same assignment, the selected view identifies the coincidence. If catalog eligibility makes a profile impossible, the result explains why that option is unavailable rather than returning a partial route. Once every reward is claimed, the toggle disappears and the single Fastest Black Division crate plan is shown.

### 10. Present daily scheduling as a cautious, progressively disclosed estimate

The application exposes one global game-mode selector whose value is passed into every optimizer calculation. It resolves the fixed daily document limit from `optimizer-rules.json`: 10 for PvE, 15 for PvP, and 25 for PvP Seasonal. The selected mode affects optimizer output only through this scheduling limit; it does not change reward requirements, inventory consumption, Classified or TarCoin rules, location eligibility, routing factors, route assignments, or route objective values. Each mode option displays its limit; the interface has no editable or duplicate readout.

The scheduler simulates Battle Pass progression instead of merely packing aggregate deficits by location. Until Page 12 unlocks, it follows the selected profile's bounded-search sequence, farms only the missing documents for those rewards, and redeems them as soon as their requirements are available. It then takes Page 12 rewards before clearing omitted earlier rewards. Each projected day remains within the fixed mode limit and groups work by location where possible.

Scheduling is secondary to the route recommendation. The initial view always shows the selected profile's next raid and routing factors when an eligible location exists; estimated days appear only after the player opens the full schedule. Projected immediately redeemable rewards remain schedule metadata and never suppress that raid. The first projected farming assignment becomes the next-raid location; if every remaining reward requirement is already covered, the optimizer instead returns an optional crate-stockpile raid. During Battle Pass farming the result marks every still-needed document assigned to that location as a priority and returns every other regular document available there as an optional pickup. During crate stockpiling both location documents are useful. It explicitly calls the schedule a planning estimate rather than a promise about calendar dates, raid count, or random spawns.

A `View full schedule` action opens a native dialog whose header contains the selected profile's estimated days. When the selected profile requires regular-document exchanges, this action shows a bright amber Lucide exchange icon, a localized accessible exchange count, and the same warning as a hover title before the player opens the dialog. The icon keeps a reserved slot so optimizer changes do not resize the action, and it remains hidden when no exchange is required. Every schedule and buyout dialog header uses the same clearly sized Lucide X vector inside a square button, with a localized accessible Close name instead of visible Close text. The open dialog is a bounded header-plus-content layout: the header remains inside the modal frame and only the content row scrolls within the remaining dynamic viewport height, so its scrollbar never crosses the dialog border. A visible non-collapsible Plan actions section preserves every required regular-document exchange assumed by the selected route, but omits Classified consumed/remaining statistics because the persistent counters remain authoritative. The Regular-document exchanges heading uses the same amber warning color as the exchange icon. Projected rewards available before farming are placed first in Day 1's Rewards to redeem sequence instead of a separate list. Every estimated day uses a two-column manifest that clearly separates Raids, including location factors and document targets, from Rewards to redeem. Each Day heading uses the same season-accent color as the estimated-days value. The reward manifest preserves legal page progression and separates consecutive rewards into localized Battle Pass page groups with compact headings and rule lines. Within each page group, displayed rewards retain the same relative catalog order as the rewards in that page's accordion, with rewards omitted by the plan simply skipped. The manifest must visibly include every prior-page claim assumed by a later-page reward so the displayed sequence independently satisfies each page-unlock threshold. The two columns stack in the same order on narrow screens without changing the page grouping. The schedule does not use day cards, show `PAGE X UNLOCKED` labels, or assign real dates unless a later requirement establishes a trustworthy reset-time model. The left-column exclusive accordion shows one selected Battle Pass page. A selected page whose previous-page claim threshold is unmet shows `Claim N more from Page X`; that hint disappears immediately when the threshold is met.

The daily limit affects only the projected schedule and estimated number of days, not the relative cost of two plans that require the same number of farmed documents. The application does not persist or display collected-today totals, a remaining daily allowance, a game-day reset action, raid history, or an event timeline. Uncommitted raid-result inputs exist only in the current DOM. Committed results become ordinary persisted inventory and are sufficient to drive the next calculation.

### 11. Keep a Black Division crate stockpile raid available

When every reward is marked claimed, the all-unclaimed-rewards plan switches to a crate-count control with a default of one. The engine first applies the player's regular-document inventory, identified by `kind: "regular"`, toward the 10:1 crate requirement, then assigns any shortage to the eligible farming location with the lowest `maxRaidTimeMin`. A larger user-selected crate count scales the requirement. If the requested crate quantity is already covered, the next raid remains available as an optional stockpile recommendation for another crate.

While rewards remain unchecked but current inventory already covers every remaining requirement, the goal stays `all-unclaimed-rewards` and the reward rail remains visible. The next raid alone switches to optional crate-stockpile purpose. Fastest chooses the eligible location by `maxRaidTimeMin`. Safest chooses by `difficultyRating`, then equipment-insurance availability, then `maxRaidTimeMin`, followed by stable location ID.

Classified Documents are excluded because they cannot be exchanged. If the player already owns enough regular documents, the result recommends immediate exchanges before any farming.

### 12. Persist versioned state in bounded cookies and explain it once

State will be split into versioned first-party cookies for progress, optimizer settings, and UI preferences to remain within per-cookie size limits. Persisted UI preferences include the selected reward page and route profile, but not uncommitted raid-result inputs, derived next-raid output, schedule projections, or native-dialog state. At runtime, the application computes one semantic fingerprint from all five validated JSON catalogs. The fingerprint changes when any catalog value or array order changes, but not when object keys or JSON formatting are reordered. Each cookie envelope records this fingerprint and an independent integer cookie-schema version. This avoids duplicate manually maintained version fields while still identifying the exact data against which selections were created. Cookies will contain only compact JSON values, use a long but finite lifetime, and set `SameSite=Lax` and `Secure` when served over HTTPS. No game credentials or personal identifiers are stored.

On every load, the application requests all catalogs without using a stale browser cache before it restores cookies. An older cookie envelope without a fingerprint remains compatible when its `gameDataVersion` matches the loaded Battle Pass. The application restores its complete sanitized payload and rewrites all cookie envelopes with the current fingerprint. If an existing fingerprint differs from the loaded catalogs, or a legacy game-data version differs, the application deletes all optimizer cookies and immediately writes fresh default envelopes. Malformed cookies and unknown cookie-schema versions fall back safely to defaults. Fresh and reset state starts with one Classified Document, matching the season-start grant. Persisted inventory continues to take precedence except that a persisted zero is normalized to one when no rewards are claimed; persisted zero remains valid when at least one reward is claimed. The centered footer reset link requires confirmation, deletes every optimizer cookie, and restores that initial state. Cookie serialization and maximum-size behavior will be covered by tests.

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

### 15. Inject optional privacy-first analytics only into production builds

Vite will inject the official Cloudflare Web Analytics module script before the closing body tag during production builds. The build reads the public site token from `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN`. GitHub Actions maps the `CLOUDFLARE_WEB_ANALYTICS_TOKEN` repository variable to that build variable.

The development server and builds without a token will omit the beacon. A missing token will not block GitHub Pages deployment. The production build check will allow only Cloudflare's exact beacon URL and will reject unresolved Vite placeholders or malformed beacon output.

The application will not add optimizer state, document quantities, reward claims, cookies, or custom metadata to the beacon. The existing cookie notice will continue to describe only the first-party cookies that store planner selections.

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
