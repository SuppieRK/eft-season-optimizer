## 1. Create the JSON Catalogs First

- [x] 1.1 Create `public/data/documents.json` with every regular and Classified Document using its name localization ID as the single canonical ID, plus descriptions, image references, source locations, and `kind`; derive farmability, crate-exchange eligibility, and Classified-backfill eligibility from `kind` without storing redundant flags.
- [x] 1.2 Create `public/data/locations.json` with every location using its name localization ID as the single canonical ID, plus `difficultyId`, matching `difficultyRating`, and `maxRaidTimeMin` shared across game modes.
- [x] 1.3 Create `public/data/battle-pass.json` with game-data version `1.1.0.0.46657.8.6.2026`, top-level season `id` and `endsAt: 1796634000`, pages, rewards, prerequisites, document requirements, and TarCoin grants.
- [x] 1.4 Create `public/data/optimizer-rules.json` with `dailyDocumentLimits` of `10`/`15`/`25` for PvE/PvP/PvP Seasonal, the regular-document `5:1` and Black Division `10:1` exchanges, the complete Classified Document bundles, the six screenshot-priced purchasable TarCoin packages and their local-price IDs, and deterministic tie-break ordering; exclude the unpriced `2,000` TarCoin “RECEIVED” offer from purchase calculations.
- [x] 1.5 Create `public/data/localization.json` with locale metadata and ID-centered `{ id, localizations }` text and structured local-price entries for the default development locale, including every ID referenced by the other four catalogs and screenshot-backed English numeric prices plus ISO currency codes for the six TarCoin packages.
- [x] 1.6 Use the supplied Battle Pass page, reward, exchange, main/guide, and dedicated definition screenshots as authoring evidence for each document icon; keep screenshot evidence outside the runtime catalogs.
- [x] 1.7 Select or combine the clearest, largest, least-obscured occurrences for each document, preferring quantity-free sources and treating dedicated document screenshots primarily as definition evidence rather than preferred artwork sources.
- [x] 1.8 Crop consistent icon frames to `public/assets/documents/<document-id>.webp`; remove `x0`, `x1`, and other quantity counters by using clean matching pixels from another occurrence first and targeted reconstruction only where no clean source pixels exist.
- [x] 1.9 Review every cleaned WebP side by side with the contributing screenshot evidence, reject quantity remnants or unrelated visual changes, and keep only the final image path in the runtime document catalog.
- [x] 1.10 Review the five JSON files and cleaned document images against the complete screenshot collection, record unresolved human-authored descriptions as explicit development placeholders, and confirm that no optimizer fact is hidden in TypeScript or UI markup.

## 2. Scaffold the Static TypeScript Application

- [x] 2.1 Scaffold a framework-free Vite `vanilla-ts` application around the existing `public/data` catalogs without replacing or regenerating them.
- [x] 2.2 Configure strict TypeScript, semantic HTML entry markup, CSS entry points, and modules for catalogs, localization, optimizer, state, persistence, and rendering.
- [x] 2.3 Add Vitest, jsdom, and Testing Library DOM with unit, DOM, and production-build test commands.
- [x] 2.4 Configure Vite's GitHub Pages base path as `/eft-season-optimizer/` and add an Actions workflow that builds and deploys `dist`.
- [x] 2.5 Add a production-build check proving HTML, scripts, styles, images, and JSON resolve under the repository base path.

## 3. Validate and Load Catalog Data

- [x] 3.1 Define TypeScript types and runtime parsers for all five JSON catalogs, including localization-backed canonical entity IDs, rejection of parallel `nameId` fields, kind-derived document behavior without redundant boolean flags, and location `difficultyId`, `difficultyRating`, and `maxRaidTimeMin` records.
- [x] 3.2 Implement catalog loading that returns normalized immutable domain data and actionable validation failures before optimizer startup.
- [x] 3.3 Validate duplicate IDs, numeric ranges, text and structured-price localization references, document/location references, kind-derived document behavior and source invariants, absence of redundant behavior flags, ordered pages and the implicit previous-page-minus-one unlock rule, reward prerequisites, dependency cycles, redeemability, exchange ratios, bundle and TarCoin package values, asset paths, and season metadata.
- [x] 3.4 Add catalog tests for game version `1.1.0.0.46657.8.6.2026`, timestamp `1796634000`, difficulty ID/rating mappings, maximum raid times, mode limits, `5:1` regular-document and `10:1` Black Division exchange ratios, six purchasable TarCoin packages, and their exact English local prices.
- [x] 3.5 Retain the manually verified `tests/documents.csv` as an authoring review fixture with blank cells interpreted as zero, without using it to reject later reviewed Battle Pass item or quantity adjustments at runtime or in automated tests.

## 4. Build the Localization Foundation

- [x] 4.1 Implement an ID-based localization resolver over `localization.json` with default-locale fallback and conspicuous development missing-ID markers.
- [x] 4.2 Validate unique and referenced IDs across text and price collections, declared-language keys, non-empty default values, locale metadata, single-purpose string entries, and structured prices with finite non-negative numeric values and three-letter uppercase ISO currency codes.
- [x] 4.3 Implement locale-aware number, TarCoin amount, local real-money price, date, time, plural, countdown-unit, validation-message, and compact document-requirement formatting with `Intl` APIs and dedicated message templates.
- [x] 4.4 Persist and restore the selected complete locale through the UI-state model, falling back to the configured default when unsupported.
- [x] 4.5 Add localization unit tests for text and structured-price ID resolution, incomplete-locale exclusion without real-money price fallback or conversion, unsupported-locale fallback for text, localized TarCoin amounts and local currency prices, compact accessible requirements, and right-to-left direction metadata.

## 5. Implement Reward and Resource Planning

- [x] 5.1 Define immutable optimizer inputs with exactly one global game mode and structured profile result types without browser, cookie, DOM, or network dependencies.
- [x] 5.2 Implement the fixed all-unclaimed-rewards objective, legal redemption ordering from reward prerequisites and implicit page unlocks, deterministic recommended next rewards, and exclusion of already claimed rewards without a selected-reward goal.
- [x] 5.3 Aggregate regular-document requirements and consume matching owned regular inventory before any Classified allocation.
- [x] 5.4 Implement maximum legal owned Classified Document consumption across the all-unclaimed-rewards sequence after matching regular inventory, target zero remaining whenever deficits allow, preserve canonical ordinary requirements, and leave Classified Documents unchanged when no redeemable deficit accepts backfill.
- [x] 5.5 Implement mixed-input `5:1` regular-document exchange planning after maximum owned Classified consumption is fixed: reserve all matching requirements, allow duplicate regular donor types, exclude Classified donors, and optimize useful donor/recipient allocations independently per profile.
- [x] 5.6 Implement opt-in staged Classified bundle selection only after maximum legal current Classified consumption and useful regular exchanges, with reward-immediate TarCoin availability, no credit for unredeemed rewards, and deterministic route tie-breaking by profile improvement, fewer TarCoins, smaller overcoverage, and fewer bundles.
- [x] 5.7 Implement the independent remaining-pass buyout estimator over every configured Classified bundle and legal reward sequence, reporting bundle counts, gross TarCoin spend, claimed and reward-sequenced Battle Pass TarCoins used, and minimum additional TarCoins required without tracking Classified Documents as purchased, used, or excess.
- [x] 5.8 Implement minimum local real-money TarCoin-package estimation by normalizing active-locale numeric prices to currency fraction units, then excess TarCoins and package count; format results at runtime without a `FROM` label, reject incomplete or mixed-currency calculations, and keep it independent of the spending selector.
- [x] 5.9 Add unit tests for global reward sequencing, prerequisites and page unlocks, claimed rewards, sufficient inventory, mixed and duplicate `5:1` regular exchanges, protected matching inventory, Classified exclusion from exchanges, partial and whole-reward Classified backfill, forced maximum Classified consumption before exchanges, zero remaining when possible, unavoidable surplus, no redeemable deficit, immediate TarCoin use, buyout with staged reward earnings, early-purchase top-up, selector independence, bundle tie-breaking, circular-credit prevention, minimum local package cost, excess and package-count ties, and unavailable local prices.

## 6. Implement Fastest and Safest Routing

- [x] 6.1 Enumerate feasible location subsets and document assignments so documents sharing a location can be farmed together without requiring an external solver.
- [x] 6.2 Implement the Fastest profile using `maxRaidTimeMin`, then tie-break by fewer locations, lower raw quantity, and stable location ID.
- [x] 6.3 Implement the Safest profile using `difficultyRating`, then tie-break by fewer locations, lower raw quantity, and stable location ID.
- [x] 6.4 Hold maximum legal owned Classified consumption fixed while optimizing its deficit allocation, subsequent regular-document exchanges, and optional later TarCoin purchases independently for the Fastest and Safest profile objectives.
- [x] 6.5 Detect identical profile assignments and return one coincident result marker; return an explicit unavailable profile instead of a partial route when coverage is impossible.
- [x] 6.6 Return each profile's locations, document assignments, routing factor values, objective values, resource use, and warnings in deterministic order.
- [x] 6.7 Add exhaustive small-fixture tests for shared locations, distinct Fastest/Safest outcomes, coincident outcomes, profile unavailability, profile-specific Classified allocation, game-mode invariance, and complete ties.

## 7. Add Scheduling and Black Division Planning

- [x] 7.1 Resolve the one global game mode to its fixed `10`/`15`/`25` daily document limit and generate a daily estimate for every available route profile without exceeding that limit while retaining location grouping where possible.
- [x] 7.2 Return summary-first progression data with reward claims and page unlocks, the first/current day expanded by default, and future days collapsed, without assigning real calendar dates or guaranteed raid counts.
- [x] 7.3 Implement the all-rewards-claimed Black Division crate goal with a default count of one, regular-document inventory as identified by `kind`, and the eligible location with the lowest `maxRaidTimeMin` for any shortage.
- [x] 7.4 Leave owned Classified Documents unchanged and exclude Classified backfill and TarCoin bundle purchases from Black Division crate planning.
- [x] 7.5 Add tests proving the global PvE/PvP/PvP Seasonal selector produces fixed `10`/`15`/`25` daily limits, affects all profile schedules and estimated days, leaves route selection unchanged, advances the page-unlock frontier, covers every reward exactly once, and handles immediate crate exchange, shortages, and scaled crate counts.

## 8. Implement State, Cookies, and Core Controls

- [x] 8.1 Implement the typed application store/reducer for one global mode, daily limit, claimed rewards, owned documents, Classified Documents, TarCoins, spending choice, crate count after pass completion, locale, and collapse state; do not store a reward-goal selection.
- [x] 8.2 Implement versioned bounded first-party cookies for progress, settings, locale, and collapse state with game-data version and independent schema version metadata.
- [x] 8.3 Restore valid cookie state, safely default malformed or unsupported state, and enforce serialized size limits without storing derived optimizer results.
- [x] 8.4 Implement deliberate reset confirmation that clears every optimizer cookie and restores catalog defaults; reserve cookie-notice dismissal integration for the final task group.
- [x] 8.5 Add state and persistence tests for reducer transitions, cookie round trips, version mismatch, malformed data, size limits, reset confirmation, and reset cancellation.

## 9. Build the Five-Region Battle Pass Interface

- [x] 9.1 Implement the semantic header, left rewards column, center results column, right controls column, and footer document/disclaimer regions in stable source order.
- [x] 9.2 Implement the green-toned Battle Pass-inspired CSS system, dense panels, restrained texture, visible focus, readable contrast, touch targets, and unofficial-tool presentation.
- [x] 9.3 Implement the header's localized locale selector and countdown to `2026-12-07 09:00:00 UTC`, including visibility-aware ticking, zero clamping, stable assistive text, and `Season ended` state.
- [x] 9.4 Implement independently collapsible reward pages whose visible rows contain only item name, compact accessible document requirements, and claimed controls, without target selection.
- [x] 9.5 Implement per-reward, per-page, and global Claim all/Clear all behavior, including transition to Black Division crate controls when all rewards are claimed.
- [x] 9.6 Implement right-column one global PvE/PvP/PvP Seasonal selector, effective daily-limit, TarCoin, and reset controls, with no reward-goal selector.
- [x] 9.7 Implement the footer document tray with images, localized names, decrement, direct non-negative integer entry, increment, validation, internal scrolling, and persistent Battlestate Games disclaimer.
- [x] 9.8 Implement center-column recommended reward order, Fastest and Safest result cards, combined coincident result, unavailable state, deficits, regular exchanges, resource allocation, routing factors, localized summary-first remaining-pass buyout and structured local package-cost estimates and breakdowns, warnings, and collapsible daily estimates.
- [x] 9.9 Add responsive grid areas and logical CSS properties that stack header, rewards, controls, results, and footer without viewport horizontal scrolling and support right-to-left locales.
- [x] 9.10 Add DOM and accessibility tests for keyboard operation, region order, reward-row content limits, inventory entry, claims, controls, countdown, route cards, localized buyout pricing and selector independence, schedule disclosure, disclaimer, responsive states, and focus visibility.

## 10. Add Feedback and Publication Configuration

- [x] 10.1 Implement the in-page feedback form with exact title/body preview and optimizer context disabled by default.
- [x] 10.2 Add explicit compact-context opt-in for game-data version, mode, and the mode-derived effective daily limit while excluding detailed inventory and reward state by default.
- [x] 10.3 Build the prefilled `/issues/new` URL with `URLSearchParams`, safe length enforcement, and new-tab `noopener`/`noreferrer` behavior without tokens or issue-submission API calls.
- [x] 10.4 Keep GitHub opening disabled with a localized publication explanation until owner/repository configuration is supplied, while leaving composition and preview testable.
- [x] 10.5 Add feedback tests for encoding, preview fidelity, context privacy, length rejection, unconfigured target behavior, and absence of automatic submission.

## 11. Complete Additional Localizations and Cookie Notice Last

- [ ] 11.1 Add the user-supplied additional language values to each existing `localization.json` entry and expose only languages with complete coverage in the selector.
- [ ] 11.2 Replace every development placeholder with reviewed human-authored item names and descriptions, image alternatives, screenshot descriptions, UI text, TarCoin price and buyout messages, requirement abbreviations, route factor labels, and feedback text for every release locale.
- [x] 11.3 Add production release-gate validation that rejects missing language values, missing or orphaned IDs, placeholders, absent descriptions, incomplete selectable locales, and untranslated assistive text.
- [x] 11.4 Implement the non-blocking dismissible cookie-storage toast as the final UI feature, persist its dismissal, clear that dismissal during complete reset, and test first-use, dismissal, return-visit, and reset behavior.
- [x] 11.5 After the toast is complete, run strict OpenSpec validation, all unit and DOM tests, accessibility checks, catalog validation, and the GitHub Pages production build; document any publication blockers without bypassing localization or UI/UX approval gates.
- [x] 11.6 Add complete best-effort `ru-RU` text coverage, preserve every interpolation placeholder, expose the locale through its generated Russian flag asset, retain explicit screenshot-backed USD prices until regional prices are reviewed, and keep Russian terminology review as a release blocker.
- [x] 11.7 Remove localization entries that have no reference in the application entry, maintained TypeScript modules, or runtime data catalogs, and add a regression that rejects future unreferenced text or structured-price IDs.

## 12. Correct Interactive UI and Development Tooling

- [x] 12.1 Replace native disclosure event feedback with one explicit delegated action path, keep one handler per render, route Classified Document card changes to the dedicated inventory field, and add a stateful rerender regression test.
- [x] 12.2 Remove the combinatorial Classified allocation path that blocks controls while preserving deterministic Fastest and Safest allocation by profile factor.
- [x] 12.3 Rework the five-region layout against the in-game screenshots; show Fastest and Safest side by side, move deficits to a shared comparison, hide internal profile cost, and verify desktop and narrow responsive presentations in Chromium.
- [x] 12.4 Add current flat-config ESLint and Stylelint checks, integrate them into the repository check command, and pass lint, tests, catalog validation, and the production build.
- [x] 12.5 Remove the editable daily-limit override and implement fixed mode-derived limits plus a daily reward progression that prioritizes page unlocks and accounts for every unclaimed reward.
- [x] 12.6 Apply the implicit previous-page reward-count-minus-one gate to every optimizer sequence, projection, purchase, and buyout path, with step-by-step regression coverage.

## 13. Focus the Route Planner UI

- [x] 13.1 Replace the superseded side-by-side dashboard requirements with a persisted Fastest/Safest toggle, focused next action, native full-schedule dialog, dynamic page hints, and selected-profile footer deficits.
- [x] 13.2 Add selected-profile state and cookie persistence, preserve owned quantities during tracking-only reward claims, and remove obsolete schedule-collapse state.
- [x] 13.3 Render one selected route, its next action, an optional full schedule, dynamic page-threshold guidance, and nonzero deficits on matching document cards; remove duplicated daily limits and page-unlocked labels.
- [x] 13.4 Compact the five-region Tarkov-inspired layout with readable LiftKit-ratio type and spacing, accessible controls, responsive workflow ordering, and no fake game branding.
- [x] 13.5 Add localization entries and focused DOM/state/persistence tests for the redesigned interactions.
- [x] 13.6 Pass lint, tests, catalog validation, production build, strict OpenSpec validation, and desktop/mobile Chromium review.

## 14. Flatten the Screenshot-Driven Visual Hierarchy

- [x] 14.1 Update the proposal, design, and player-state specification to require one continuous Battle Pass stage, one flat route manifest, sibling secondary disclosures, and a contiguous document ribbon without repeated nested framing.
- [x] 14.2 Flatten center rendering for farming, immediate claims, unavailable routes, crate mode, and the full schedule; show routing factors directly and remove obsolete focused-route, next-action-card, location-card, and nested Farm Locations structures.
- [x] 14.3 Replace the panel-heavy CSS with the screenshot-derived flat shell, reward and control rails, manifest rows, pale selected tabs, integrated document ribbon, and elevation limited to the dialog and toast.
- [x] 14.4 Update DOM regressions for flat structure, visible routing factors, sibling disclosures, preserved interactions, and every result state.
- [x] 14.5 Pass lint, all tests, catalog and build checks, strict OpenSpec validation, and Chromium review at `2560×1440`, `1440×900`, and `390×844` without clipped primary labels or viewport horizontal overflow.

## 15. Expose a Simple Editable Layout Contract

- [x] 15.1 Update the proposal, design, and player-state specification to isolate placement and type sizing in one editable CSS layout map, use named route cells, and place document copy below images while preserving all behavior.
- [x] 15.2 Normalize renderer markup into stable summary, action, location, and document-tile cells without changing event attributes, state, optimizer output, disclosures, or accessibility labels.
- [x] 15.3 Move normal-content geometry, spacing, overflow, responsive behavior, and type sizing into `src/layout.css`; reduce `src/styles.css` to screenshot-derived palette and visual states with no shared placement rules, negative margins, or normal-content overlays.
- [x] 15.4 Update DOM regressions for the named route cells and fixed document bands while preserving every interaction and optimizer result state.
- [x] 15.5 Pass lint, all tests, catalog and build checks, strict OpenSpec validation, and Chromium review at `2560×1440`, `1440×900`, and `390×844` without text overlap, clipped primary labels, or viewport horizontal overflow.

## 16. Build the Selected-Item Battle Pass Workspace

- [x] 16.1 Replace superseded OpenSpec layout requirements with one selected reward page, header profile/locale/setup controls, a current-route-day center, selected-stop right context, and compact image-first inventory tiles.
- [x] 16.2 Replace collapsed-page state with backward-compatible selected-page persistence and a one-Classified-Document minimum whenever no rewards are claimed, an exclusive reward-page accordion with checkbox-only page bodies and green completed reward/page states, per-page individually redeemable option counts, a reviewed individual-redemption dialog whose default Enter action performs available atomic regular/Classified inventory subtraction, direct tracking without a popup when inventory is insufficient, tracking-only global heading actions, a non-accordion Black Division crate fallback after completion, claimed-reward contribution to document progress without regular-document counter floors, header setup-dialog behavior, and a separate centered credits footer with the persistent disclaimer, confirmed cookie-storage reset link, document-section divider, and responsive inline-to-stacked separator without changing optimizer or public data schemas.
- [x] 16.3 Implement the Page-12-first deterministic optimizer sequence and render one rolling next-raid recommendation: show both documents available at the location with priority/optional emphasis and transient quantity inputs, commit valid results atomically to the existing persisted counters, recalculate the recommendation, and show location factors plus non-mutating plan, exchange, purchase, buyout, and projected-schedule guidance in the right rail without daily farming state, raid history, or an event timeline.
- [x] 16.4 Restyle the editable five-region layout against the screenshot selection/detail hierarchy with readable typography, thin separators, compact controls, and responsive stacking without nested dashboard panels.
- [x] 16.5 Update state, persistence, jsdom, Playwright behavioral, and accessibility regressions; pass lint, tests, build, strict OpenSpec validation, and Chromium review at `2560×1440`, `1440×900`, and `390×844`.
- [x] 16.6 Keep the rolling next raid available beside projected redeemable rewards, make reward checkboxes the only confirmed progression state, pre-farm the next Page-12-path deficit when a covered page remains unchecked, and expose projected immediate claims as advisory metadata only.
- [x] 16.7 Add deterministic Fastest/Safest optional crate-stockpile raids when the remaining pass or requested crate quantity is already covered, with explicit priority, optional, and stockpile document roles and Commit support for both location documents.
- [x] 16.8 Add optimizer, renderer, and Playwright regressions for the clean-state raid, covered-page look-ahead, non-mutating redeemability, stockpile fallback, role emphasis, Commit persistence, and unavailable-route exception; pass the complete verification suite.
- [x] 16.9 Highlight each individually redeemable unclaimed accordion reward with a distinct lower-emphasis background driven by the same inventory snapshot as the page count, preserve the stronger claimed treatment, and add a Playwright regression.
- [x] 16.10 Remove the right rail and full-width lower band; expand Focus across both tracks with location factors, View full schedule, Commit, and the persistent owned-document ribbon; move estimated days plus non-collapsible exchange and Classified-purchase actions into a raids-versus-rewards schedule modal; expose the independent approximate localized buyout price beside Documents with a detailed Classified and TarCoin package modal; remove Classified consumed/remaining presentation; and update desktop/mobile Playwright regressions.
- [x] 16.11 Use the persistent inventory counters' localized first-word document labels for priority, optional, and stockpile pickups in Focus while preserving full localized accessible names, and add a Playwright regression.
- [x] 16.12 Remove repeated pickup-role and planned-quantity subtitles below Focus document names while preserving the role label above each image, and add a Playwright regression.
- [x] 16.13 Align the stacked responsive breakpoint with the `1180px` desktop minimum and add boundary Playwright coverage proving intermediate viewports never inherit page-level horizontal overflow.
- [x] 16.14 Prevent the desktop shell's outer margin from collapsing beyond the viewport-height body and add a Playwright regression proving no empty page-level vertical scroll appears when content fits.
- [x] 16.15 Promote the reviewed Battle Pass workspace to the sole production `index.html`, remove the separate `wireframe.html` page, retarget Playwright and build validation to the repository root, and reject duplicate preview output.
- [x] 16.16 Keep the full-schedule header and scrolling content inside one dynamic-viewport-bounded modal frame, prevent the vertical scrollbar from crossing its border, and add desktop/mobile Playwright geometry regressions.
- [x] 16.17 Group each full-schedule day's Rewards to redeem manifest by Battle Pass page with compact localized page headings and rule separators while preserving legal redemption order and responsive stacking, and add a Playwright regression.
- [x] 16.18 Render the localized raid-result instruction's Commit term as a keyboard-operable inline link-styled action that delegates to the Focus-header Commit operation, and add a Playwright regression proving identical inventory persistence.
- [x] 16.19 Constrain every persistent document-ribbon tile, artwork frame, and quantity control to the same shared dimensions regardless of intrinsic title width, and add a Chromium geometry regression covering every document type.
- [x] 16.20 Replace the Battle Pass buyout prose with ordered Spend Battle Pass TarCoins and Keep Battle Pass TarCoins comparisons, calculate a separate keep-TarCoins local package estimate against gross bundle spend, render TarCoin packages before Classified Document bundles as concise tables, and add optimizer and Chromium regressions.
- [x] 16.21 Merge projected immediate rewards into Day 1's ordered full-schedule reward manifest so every displayed later-page claim visibly follows the previous page's reward-count-minus-one threshold, and add a Chromium regression that audits all rendered page transitions.
- [x] 16.22 Render rewards within every full-schedule page group in the same relative catalog order as the corresponding rewards accordion, and extend the Chromium schedule audit across all groups.
- [x] 16.23 Distinguish the page-heading count for document-covered rewards on locked pages with localized ready-when-unlocked wording and amber text, preserve freely editable rewards and existing row highlights, share the implicit page-unlock helper, and add unit plus Chromium transition regressions.
- [x] 16.24 Preserve and temporarily dim the current Focus result with an accessible busy state during optimizer-affecting worker requests, disable stale route actions, avoid loading treatment for page/profile-only changes, and add a delayed-worker Chromium regression proving no content replacement flicker.
- [x] 16.25 Apply the screenshot-derived season, document-border, action-surface, and purchase colors; remove outer boxes and borders from the header placement surfaces; and add Chromium style regressions for the palette and header chrome.
- [x] 16.26 Regroup the header into left season/progress and right route/mode/locale sections, align Commit with the neutral Claim all/Clear all treatment, separate the keep-TarCoins buyout scenario with a larger spacing step, and add a localized independent-document-counter note with Chromium regressions.
- [x] 16.27 Add a localized question-mark help control beside season identity that reveals concise optimizer instructions on hover and keyboard focus, with a Chromium interaction regression.
- [x] 16.28 Give every Rewards-header and Focus-header action one shared exact height while preserving content-sized widths, and add a Chromium geometry regression.
- [x] 16.29 Replace stored minor-unit and preformatted TarCoin package prices with `{ price, currency }` locale objects, validate three-letter uppercase currency codes, normalize numeric prices for exact package comparison, format all prices at runtime, remove `FROM` from the buyout UI, and update catalog, optimizer, localization, and Chromium regressions.
- [x] 16.30 Highlight both Battle Pass buyout scenario headings with the same season-accent color used by unlocked redeemable counts, with a Chromium style regression.
- [x] 16.31 Replace visible Close text in schedule and buyout dialog headers with square icon buttons while preserving localized accessible names and keyboard behavior, with Chromium content and geometry regressions.
- [x] 16.32 Add the maintained tree-shakable Lucide vanilla package and replace font-dependent close/help glyphs with consistently sized X and CircleHelp vectors, with Chromium SVG size and aspect-ratio regressions.
- [x] 16.33 Replace the hard-coded `en` to `gb.svg` selector mapping with regional BCP 47 catalog keys, generate a Vite flag module containing only declared 4:3 `flag-icons` images, select an exact or unambiguous browser-preferred locale only when no valid cookie exists, format local prices with narrow currency symbols, and add catalog, persistence, localization, and Chromium regressions.
- [x] 16.34 Add concise localized Fastest and Safest tooltips that explain lower-max-time or easier-difficulty priority on hover and keyboard focus, with Chromium interaction regressions.
- [x] 16.35 Update the season deadline to `1796634000`, remove the duplicate runtime timestamp constant and equality rejection, retain positive-integer catalog validation, and update countdown and OpenSpec regressions.
- [x] 16.36 Apply the reward accordion's thin black scrollbar styling to schedule and buyout modal content, remove hard-coded runtime season ID and game-version equality checks, derive cookie versioning from the loaded catalog, and replace fixed reward/document total regressions with catalog-derived expectations.
- [x] 16.37 Fold credited bonuses into each purchasable TarCoin package's `tarCoins` total, remove `bonusTarCoins` from TarCoin and Classified Document bundles, exclude Classified bundle discount presentation from calculations, rename package price IDs to the final totals, and update catalog and optimizer regressions.
- [x] 16.38 Select the informational buyout's Classified Document bundle plan against the combined remaining-pass deficit before staging its purchases through legal reward progression, so volume bundles are compared against repeated small purchases.
- [x] 16.39 Remove editable and persisted TarCoin inventory, derive informational TarCoins from claimed Battle Pass rewards, use one Classified Document balance during buyout simulation, and cover remaining deficits from 500 to zero with bundle-selection regressions.
- [x] 16.40 Make informational Classified bundle selection fill the remaining deficit from largest bundle to smallest without exceeding it, allow a farmable uncovered remainder, and add the confirmed 450, 350, and 71 examples to regressions.
