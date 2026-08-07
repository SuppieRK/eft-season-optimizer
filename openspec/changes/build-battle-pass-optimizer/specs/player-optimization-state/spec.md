## ADDED Requirements

### Requirement: Framework-free static interface
The application SHALL render as semantic HTML and CSS with TypeScript compiled to browser JavaScript, without requiring a UI framework, backend, account, or server-side API.

#### Scenario: Production site loads from static assets
- **WHEN** the GitHub Pages production build is opened
- **THEN** the interface and optimizer load from generated static HTML, CSS, JavaScript, image, and JSON assets

### Requirement: Five-region Battle Pass layout
The desktop interface SHALL use a header containing global profile, locale, and setup access; a left reward column; a center current-route-day column; a right selected-stop context column; and a footer containing document inventory and the asset disclaimer. Normal-content placement and typography sizing SHALL be isolated in one editable CSS layout map, separate from palette and visual-state styling.

#### Scenario: Desktop layout
- **WHEN** the viewport supports the desktop layout
- **THEN** the left, center, and right columns appear between the header and footer in that order

#### Scenario: Narrow-screen layout
- **WHEN** the viewport cannot fit the three columns accessibly
- **THEN** the regions stack as header, center route day, right stop context, left reward selection, and footer without viewport-level horizontal scrolling

#### Scenario: Adjust desktop placement
- **WHEN** a maintainer changes a documented rail width, spacing value, type size, or named grid track in the layout map
- **THEN** the live interface uses that value without requiring a duplicate static page or changes to optimizer, state, localization, or visual-state code

### Requirement: Battle Pass-inspired presentation
The interface SHALL use the supplied screenshots as the source of truth for a green-toned, dense Battle Pass-inspired visual hierarchy while preserving readable contrast, visible keyboard focus, semantic controls, responsive behavior, and practical touch targets. All five regions SHALL share one continuous stage. Strong framing SHALL be limited to outer regions, selected states, the document ribbon, dialogs, and the toast; regular content rows SHALL use spacing and separators instead of repeated bordered or elevated containers.

#### Scenario: Keyboard navigation
- **WHEN** a player navigates interactive controls using only a keyboard
- **THEN** the focused control remains visibly identifiable and operable

#### Scenario: Major region renders content
- **WHEN** a header, reward rail, route workspace, context rail, or document ribbon is displayed
- **THEN** it has at most one visually framed surface and does not express hierarchy through cards nested inside cards

### Requirement: Header season countdown
The header SHALL display the selected locale and a countdown derived from Unix timestamp `1796637600`, including days, hours, minutes, and seconds, and SHALL expose the absolute end time `2026-12-07 10:00:00 UTC`.

#### Scenario: Active countdown
- **WHEN** the device time is before the season deadline
- **THEN** the countdown shows the non-negative remaining duration and refreshes no more than once per second while visible

#### Scenario: Season has ended
- **WHEN** the device time reaches or exceeds `1796637600`
- **THEN** the timer stops, never displays a negative value, and shows the localized equivalent of `Season ended`

### Requirement: Per-page reward navigation
The left column SHALL display exactly one selected Battle Pass page and provide previous, next, and direct page navigation.

#### Scenario: Select one reward page
- **WHEN** the player uses previous, next, or direct page navigation
- **THEN** only the selected page's reward rows are displayed and the selected page is persisted

### Requirement: Compact reward rows
A visible left-column reward row SHALL contain only the localized Battle Pass item name, a compact localized list of document requirements, and the control required to mark the reward claimed. It SHALL NOT display reward artwork, long descriptions, stats, target selection, or unrelated metadata.

#### Scenario: Reward row content
- **WHEN** a reward page is expanded
- **THEN** each reward row shows the item name and unambiguous abbreviated document quantities with accessible full text

### Requirement: Reward claim controls
The interface SHALL provide per-reward claimed controls, per-day Claim all and Clear all actions, and global Claim all and Clear all actions. These controls SHALL track already-claimed rewards only and SHALL NOT consume or mutate owned document quantities.

#### Scenario: Claim all rewards in one day
- **WHEN** the player invokes Claim all for a Battle Pass day
- **THEN** every reward in that day is marked claimed without changing rewards in other days

#### Scenario: Clear all rewards globally
- **WHEN** the player invokes global Clear all
- **THEN** every reward is marked unclaimed

#### Scenario: Claim all rewards globally
- **WHEN** the player invokes global Claim all
- **THEN** every reward is marked claimed and the interface enters the Black Division crate goal state

### Requirement: Center-column optimizer output
The center column SHALL render one flat current-route-day workspace focused on the selected route profile's next farming or claiming action, estimated days, warnings, empty states, and completed states. When farming is next it SHALL present the first schedule day's locations as an ordered selectable stop strip and SHALL show the selected stop's assigned document artwork and quantities on the continuous center surface. The center SHALL NOT duplicate regular-document deficits or the selected mode's daily limit.

#### Scenario: Inputs change
- **WHEN** a player changes any optimizer input
- **THEN** the center column refreshes to show the deterministic result while the surrounding controls remain available

#### Scenario: Farming is required next
- **WHEN** the selected profile's next schedule day contains one or more locations
- **THEN** the center shows its day and document total, ordered selectable location stops, and the selected stop's assigned document artwork and quantities
- **AND** no focused-route card, next-action card, location card, or nested Farm Locations disclosure is rendered

#### Scenario: Buyout estimate is presented
- **WHEN** unclaimed rewards have deficits that can be covered by configured Classified Document bundles
- **THEN** the right context column shows the localized gross TarCoin price and minimum additional TarCoins required, with a collapsible breakdown of starting and earned TarCoins used, bundle counts, purchased Classified Documents, and excess
- **AND** the estimate remains explicitly informational when TarCoin spending is disabled

#### Scenario: Local purchase estimate is available
- **WHEN** additional TarCoins are required and complete same-currency package prices exist for the active locale
- **THEN** the right context column labels the minimum local package cost as a `FROM` estimate and shows its package breakdown and excess TarCoins

#### Scenario: Classified Documents have no redeemable use
- **WHEN** the player owns Classified Documents but no unclaimed reward has an eligible missing-document deficit
- **THEN** the right context column reports that the Classified quantity remains unchanged and shows no Classified redemption or purchase action

### Requirement: Header setup and right-column route context
The header SHALL contain a compact setup button labelled with the selected game mode and its fixed limit. It SHALL open a native setup dialog containing the global mode selector, optional TarCoin spending, TarCoin balance, conditional crate count, and reset controls. The right column SHALL instead show the selected route stop's location, assigned documents, official difficulty, maximum raid time, complete-day claim outcome, full-schedule access, and flat plan and buyout disclosures. The optimizer objective SHALL always be all unclaimed rewards while any remain, so the interface SHALL NOT expose a reward-goal selector, an editable daily-limit control, or a separate daily-limit readout.

#### Scenario: Mode selection applies its default
- **WHEN** the player selects PvE, PvP, or PvP Seasonal
- **THEN** the effective daily limit becomes `10`, `15`, or `25` respectively

#### Scenario: Global mode selection recomputes optimizer output
- **WHEN** the player changes the global game mode
- **THEN** every available route profile is rescheduled using the selected mode's effective daily document limit
- **AND** no reward, location, or route card retains a separate mode selection

#### Scenario: Mode selection leaves route factors unchanged
- **WHEN** the player changes between PvE, PvP, and PvP Seasonal
- **THEN** the effective daily limit changes to that mode's default while location maximum raid times and difficulty ratings remain unchanged

### Requirement: Header progress and route alternative presentation
The header's primary navigation area SHALL present total-based document progress, claimed-reward progress, and one Fastest/Safest toggle. The document total SHALL be derived from every Battle Pass requirement quantity, and the reward total SHALL be derived from every Battle Pass reward. The toggle SHALL default to Safest, persist as a UI preference, and control the focused result, footer deficits, and full schedule. The interface SHALL render only the selected profile at a time and SHALL NOT display the internal abstract profile-cost value.

#### Scenario: Initial progress uses catalog totals
- **WHEN** no documents are recorded and no rewards are claimed
- **THEN** the header shows zero against the complete catalog-derived document and reward totals

#### Scenario: Profile routes differ
- **WHEN** Fastest and Safest optimization produce different location assignments
- **THEN** changing the toggle replaces the focused locations, routing factors, allocations, deficits, and daily estimate with the selected profile's values

#### Scenario: Profile routes coincide
- **WHEN** Fastest and Safest optimization produce the same location and document assignment
- **THEN** the selected profile view identifies that the assignments coincide without rendering a duplicate result card

#### Scenario: Every reward is claimed
- **WHEN** the optimizer enters the Black Division crate goal
- **THEN** the profile toggle is hidden and one Fastest crate plan is shown

#### Scenario: Profile unavailable
- **WHEN** a route profile cannot cover every remaining document with catalog-eligible locations
- **THEN** the center column explains that the profile is unavailable and does not show a partial route

### Requirement: Footer document inventory
The footer SHALL provide one contiguous in-game-inspired document ribbon containing an inventory tile for every regular and Classified Document. Each tile SHALL use a dedicated image row, a fixed text band below the image containing its localized name and optional deficit, and a separate quantity-control row containing decrement, direct numeric entry, and increment actions. Document names and deficits SHALL NOT be absolutely positioned over artwork. Each regular-document tile SHALL show the selected profile's remaining deficit when it is nonzero; Classified Documents and zero deficits SHALL show no deficit label.

#### Scenario: Enter an owned quantity directly
- **WHEN** the player enters a valid non-negative integer for a document
- **THEN** the owned quantity changes to that exact integer and the optimizer recomputes

#### Scenario: Decrement at zero
- **WHEN** the player decrements a document whose owned quantity is zero
- **THEN** the quantity remains zero

#### Scenario: Invalid inventory value
- **WHEN** the player enters a negative, fractional, non-numeric, or out-of-range quantity
- **THEN** the interface reports a localized validation error and does not commit the invalid value

### Requirement: Persistent asset disclaimer
The footer SHALL persistently state that Escape from Tarkov and all displayed game image assets belong to Battlestate Games and that the optimizer is an unofficial fan-made tool.

#### Scenario: Disclaimer remains available
- **WHEN** the optimizer is displayed at any goal or progress state
- **THEN** the disclaimer remains available without opening a modal and cannot be dismissed with the cookie notice

### Requirement: Focused daily-plan disclosure
The center column SHALL present the selected profile's next action as a flat planning estimate. A `View full schedule` action SHALL open a native dialog containing every estimated day as rule-separated manifest rows with farming targets, locations, routing factors, and rewards to claim. The schedule SHALL NOT render day cards or page-unlocked labels.

#### Scenario: Multi-day estimate
- **WHEN** the remaining farming quantity spans multiple daily limits
- **THEN** the default view shows only the selected profile's next action and estimated days
- **AND** the player can explicitly open and close the complete schedule dialog

### Requirement: Dynamic page unlock guidance
Each selected reward page after Page 1 SHALL show how many more rewards must be claimed from the preceding page while that page's unlock threshold is unmet. The hint SHALL disappear as soon as the threshold is met, and the interface SHALL NOT show `PAGE X UNLOCKED` labels.

#### Scenario: Previous-page threshold changes
- **WHEN** the player claims enough rewards on the preceding page to meet the next page's unlock threshold
- **THEN** the `Claim N more from Page X` hint disappears immediately

### Requirement: Versioned cookie persistence
The application SHALL persist player-controlled progress, optimizer settings, locale, the selected reward page, and the selected route profile in bounded first-party cookies carrying both game-data version `1.1.0.0.46657.8.6.2026` and an independent cookie-schema version. The selected route stop and native-dialog states SHALL NOT be persisted.

#### Scenario: Restore valid state
- **WHEN** the player returns with valid supported cookies
- **THEN** the stored inventory, claimed rewards, settings, locale, selected page, and route profile are restored

#### Scenario: Reject invalid state
- **WHEN** a cookie is malformed or has an unsupported schema version
- **THEN** the affected state falls back safely to catalog defaults

### Requirement: Cookie-storage notice
The application SHALL show a non-blocking dismissible toast on first use explaining that cookies store planner selections on the device, and SHALL persist the dismissal.

#### Scenario: Dismiss notice
- **WHEN** the player dismisses the cookie-storage toast
- **THEN** the toast does not appear on the next visit with valid dismissal state

### Requirement: Complete reset
The reset action SHALL require deliberate confirmation, delete all optimizer cookies including notice dismissal, and restore catalog and UI defaults.

#### Scenario: Confirm reset
- **WHEN** the player confirms a complete reset
- **THEN** inventory, claimed rewards, settings, locale, selected page, route profile, and notice dismissal return to defaults

#### Scenario: Cancel reset
- **WHEN** the player cancels reset confirmation
- **THEN** no persisted or in-memory player state changes
