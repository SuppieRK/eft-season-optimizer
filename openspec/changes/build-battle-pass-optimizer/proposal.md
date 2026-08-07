## Why

Escape from Tarkov players currently have to manually reconcile Battle Pass reward prerequisites, their existing document inventory, mode-specific daily limits, and the relative cost of farming each location. A static optimization tool can turn the screenshot-backed KORD BREACH data into a personalized plan for earning all unclaimed rewards as quickly as possible, then farming Black Division crates after the pass is complete.

## What Changes

- Add an optimization-only, framework-free HTML and CSS website with TypeScript compiled to browser JavaScript for static hosting on GitHub Pages, with no backend dependency.
- Add a restrained green-toned interface with five explicit regions derived from the supplied Battle Pass screens: a slim header with total document and reward progress, route-profile, locale, and compact setup controls; a left single-page reward rail; a center current-day route workspace; a right selected-stop context rail; and a contiguous footer document ribbon plus the asset disclaimer. The regions share one continuous stage instead of nesting bordered cards inside panels.
- Keep all normal-content geometry and typography sizing in one small editable CSS layout map, separate from palette and visual-state styling. Use explicit named cells for route summaries and location factors, and place document names and deficits in fixed bands below their images so text placement is predictable and directly adjustable.
- Add auditable JSON catalogs for document types and source locations; location difficulty ratings and maximum raid times; Battle Pass pages, rewards, prerequisites and document requirements reconstructed from the supplied screenshots; cleaned document thumbnails extracted from those screenshots with quantity overlays removed; configurable optimizer rules; and a dedicated `localization.json` catalog for translated text, descriptions, and local prices. The Battle Pass catalog carries game-data version `1.1.0.0.46657.8.6.2026`.
- Add one global selector for PvE, PvP, or PvP Seasonal, using fixed daily document limits of 10, 15, and 25 respectively. The selected mode affects optimizer scheduling through that limit only, and the limit appears only with its mode option.
- Require every document inventory card, including Classified Documents, to expose decrement, direct numeric entry, and increment actions so the player can enter exactly how many documents they already own.
- Add left-column reward controls showing one Battle Pass page at a time, with previous/next and direct page selection plus per-page and global Claim all and Clear all actions while preserving reward prerequisite relationships.
- Add an optimizer whose fixed objective is to earn every unclaimed reward as quickly as possible and recommend a legal reward-redemption sequence. It consumes matching regular documents first, maximizes consumption of owned Classified Documents across remaining reward deficits with the aim of leaving zero whenever possible, applies useful `5:1` exchanges of surplus regular documents for needed regular documents, and only then optionally spends available TarCoins on discrete Classified Document bundles. If no redeemable reward can accept Classified backfill, owned Classified Documents remain untouched.
- Retain every configured Classified Document bundle to calculate an informational remaining-Battle-Pass buyout estimate that follows legal redemption order, accounts for starting and immediately earned TarCoins, and reports gross spend and minimum additional TarCoins required. Capture the six screenshot-priced TarCoin purchase packages separately and use locale-dependent structured prices to show the minimum local real-money package cost where complete local pricing is available.
- Add Fastest and Safest route alternatives using maximum raid time and official difficulty rating respectively, prefer fewer locations when a profile's cost ties, and expose them through one persisted header toggle that defaults to Safest. Game mode affects the daily document limit but does not change location routing factors.
- Present only the selected profile's next action as a current-route-day workspace: selectable ordered stops in the center and the selected stop's location factors, assigned documents, and day outcome in the right rail. Put the complete estimated schedule in an optional native dialog and keep secondary plan and buyout details as flat disclosures. Keep page-unlock guidance dynamic and hide it once the previous-page claim threshold is met.
- Add a Black Division crate strategy for players who have redeemed every Battle Pass reward, using the 10:1 regular-document exchange and recommending the eligible farming location with the lowest maximum raid time while excluding Classified Documents from exchange.
- Add a live season countdown backed by Unix timestamp `1796637600` (`2026-12-07 10:00:00 UTC`) and transition it to a stable ended state at expiry.
- Persist player inputs and UI state in cookies, show a dismissible toast explaining that storage, and provide a reset action that restores catalog defaults and the notice.
- Display a persistent disclaimer stating that Escape from Tarkov image assets belong to Battlestate Games and that the optimizer is an unofficial fan-made tool.
- Add internationalization infrastructure for every user-facing string, item label and description, image alternative, and displayed screenshot description. `localization.json` keeps each stable text ID and all of its language variants together in one object. Human-authored textual descriptions and complete localizations are required before release.
- Add a feedback action that lets the player review a compact, privacy-conscious report and opens GitHub's prefilled new-issue composer for final submission.
- Keep general Battle Pass guidance and detailed in-map navigation outside the scope of the site; supplied screenshots remain the backed-up source of truth for reconstructing and auditing optimizer data.

## Capabilities

### New Capabilities

- `battle-pass-data-catalog`: Defines the versioned JSON data for documents, locations, mode limits, difficulty ratings, maximum raid times, season end timestamp, exchange and purchase rules, reward prerequisites, reward requirements, and TarCoin rewards. Supplied screenshots remain authoring evidence, not runtime catalog fields.
- `player-optimization-state`: Covers the five-region Battle Pass-like framework-free layout, season countdown and disclaimer, global mode selection with fixed limits, footer document inventory counts, tracking-only claimed-reward controls, collapsible reward days, a persisted route-profile toggle, a full-schedule dialog, TarCoin opt-in, cookie persistence and its dismissible notice, and reset behavior.
- `farming-route-optimization`: Computes all-unclaimed-reward deficits and a legal recommended redemption sequence, regular inventory and `5:1` regular exchange use, maximum owned Classified consumption, optional staged TarCoin bundle purchases, a remaining-pass Classified buyout estimate that accounts for earned TarCoins and local TarCoin package prices, Fastest-by-raid-time and Safest-by-difficulty low-hop route alternatives, daily schedules, and the Black Division crate fallback strategy.
- `github-feedback`: Provides a user-reviewed feedback flow that opens a prefilled GitHub issue without embedding repository credentials or silently transmitting optimizer state.
- `internationalized-content`: Defines the dedicated ID-centered `localization.json` catalog, locale selection and persistence, translation coverage, locale-aware formatting, human-authored item/image/screenshot descriptions, fallback behavior, and release-blocking content validation.

### Modified Capabilities

- None.

## Impact

- Introduces a framework-free static HTML, CSS, and compiled TypeScript frontend, optimizer domain logic, JSON data assets, automated tests, and GitHub Pages deployment configuration.
- Uses the supplied screenshots as authoring evidence for data reconstruction and validation; optimizer behavior reads normalized JSON rather than image content at runtime.
- Stores player-specific selections locally in cookies and does not require accounts, a server, or external APIs.
- Adds a dedicated localization catalog and build-time content-completeness checks; publication is blocked until the configured release locales and textual descriptions are complete.
- Establishes implementation constraints for the frontend toolchain, JSON validation, optimizer ordering, cookie schema and migration, and responsive presentation.
