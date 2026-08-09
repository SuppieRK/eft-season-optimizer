# player-optimization-state Specification

## Purpose
TBD - created by archiving change build-battle-pass-optimizer. Update Purpose after archive.
## Requirements
### Requirement: Framework-free static interface
The application SHALL render as semantic HTML and CSS with TypeScript compiled to browser JavaScript, without requiring a UI framework, backend, account, or server-side API. The reviewed Battle Pass workspace SHALL be the sole source HTML template. The build SHALL emit configured localized `index.html` entries that load one application bundle and SHALL NOT expose a separate `wireframe.html` application page.

#### Scenario: Production site loads from static assets
- **WHEN** the GitHub Pages production build is opened
- **THEN** the interface and optimizer load from generated static HTML, CSS, JavaScript, image, and JSON assets

#### Scenario: One application template is built
- **WHEN** local development, Playwright, or the production deployment opens a configured locale URL
- **THEN** it loads the reviewed Battle Pass workspace from a localized `index.html`
- **AND** no alternate `wireframe.html` page is available in the build

### Requirement: Optional production web analytics
The production build SHALL inject exactly one official Cloudflare Web Analytics module script when a non-empty public site token is configured. Local development and builds without a token SHALL omit the beacon. A missing token SHALL NOT block deployment. The application SHALL NOT add optimizer state, document quantities, reward claims, cookies, or custom metadata to the analytics payload.

#### Scenario: Production token is configured
- **WHEN** the production build receives `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
- **THEN** it injects one module script from `https://static.cloudflareinsights.com/beacon.min.js` before the closing body tag
- **AND** its `data-cf-beacon` value contains the configured site token

#### Scenario: Analytics token is unavailable
- **WHEN** local development starts or a production build has no analytics token
- **THEN** the page contains no Cloudflare Web Analytics beacon
- **AND** the application and GitHub Pages deployment remain available

#### Scenario: Analytics does not change planner storage
- **WHEN** analytics is enabled
- **THEN** the application does not send player-controlled optimizer state as analytics metadata

### Requirement: Two-column Battle Pass layout
The desktop interface SHALL use a two-section header with season identity and total progress grouped on the left and route-profile, mode, and locale controls grouped on the right; a left reward column; one expanded Focus column containing the current next raid and persistent owned-document ribbon; and a separate credits footer containing the asset disclaimer and reset action. Normal-content placement SHALL be isolated in one editable CSS layout map, typography SHALL use one shared proportional caption/label/body/heading/metric/display token scale, and internal gaps, padding, and region spacing SHALL use one shared golden-ratio token scale. Layout, typography, spacing, and palette or visual-state styling SHALL remain independently editable.

#### Scenario: Desktop layout
- **WHEN** the viewport supports the desktop layout
- **THEN** the left reward column and expanded Focus column appear between the header and footer in that order
- **AND** the Focus column spans the former center and right-column tracks
- **AND** shell margins do not create page-level vertical scrolling when the complete desktop layout is shorter than the viewport

#### Scenario: Narrow-screen layout
- **WHEN** the viewport is `1180px` wide or narrower
- **THEN** the regions stack as header, Focus next raid with its internally scrolling owned-document ribbon, left reward selection, and credits footer without viewport-level horizontal scrolling

#### Scenario: Adjust desktop placement
- **WHEN** a maintainer changes a documented rail width, spacing value, type size, or named grid track in the layout map
- **THEN** the live interface uses that value without requiring a duplicate static page or changes to optimizer, state, localization, or visual-state code

### Requirement: Battle Pass-inspired presentation
The interface SHALL use the supplied screenshots as the source of truth for a green-toned, dense Battle Pass-inspired visual hierarchy while preserving readable contrast, visible keyboard focus, semantic controls, responsive behavior, and practical touch targets. The palette SHALL use `#428c73` for season identity, `#95d6bc` for regular-document borders, `#3f5960` for neutral action surfaces, and `#af8a45` for purchase prices and ready-when-unlocked opportunities. All major regions SHALL share one continuous stage. Both header sections SHALL be transparent and borderless while retaining spacing, internal separators, and individually framed controls. Every Focus-header and Rewards-header action SHALL have the same exact control height; Commit and Claim all/Clear all SHALL also use the same neutral action-surface treatment. Strong framing SHALL be limited to outer regions, selected states, the document ribbon, dialogs, and the toast; unclaimed regular content rows SHALL use spacing and separators instead of repeated bordered or elevated containers, while completed reward and page states MAY use one restrained green gradient.

#### Scenario: Keyboard navigation
- **WHEN** a player navigates interactive controls using only a keyboard
- **THEN** the focused control remains visibly identifiable and operable

#### Scenario: Major region renders content
- **WHEN** a header, reward rail, route workspace, context rail, or document ribbon is displayed
- **THEN** it has at most one visually framed surface and does not express hierarchy through cards nested inside cards

#### Scenario: Header uses the Battle Pass palette
- **WHEN** the desktop or narrow header is displayed
- **THEN** its season identity uses the season accent and its placement slots do not render background boxes or outer borders
- **AND** the Documents buyout price uses the purchase accent
- **AND** season identity and progress appear in the left section while route, mode, and locale controls appear in the right section
- **AND** focusing or hovering the square Lucide CircleHelp control beside season identity shows localized instructions for setting existing progress, following Next raid, entering extracted documents, and committing the result

### Requirement: Header season countdown
The header SHALL display the selected locale as the country flag derived from its regional BCP 47 key and a countdown derived from Unix timestamp `1796634000`. The visible countdown SHALL use the game's invariant `d`/`h`/`m` notation without seconds or localized unit abbreviations, and SHALL expose the absolute end time `2026-12-07 09:00:00 UTC`.

#### Scenario: Active countdown
- **WHEN** the device time is before the season deadline
- **THEN** the countdown shows the non-negative remaining duration and refreshes no more than once per second while visible

#### Scenario: Season has ended
- **WHEN** the device time reaches or exceeds `1796634000`
- **THEN** the timer stops, never displays a negative value, and shows the localized equivalent of `Season ended`

### Requirement: Exclusive accordion reward navigation
While at least one Battle Pass reward remains unclaimed, the left column SHALL display every Battle Pass page heading as an exclusive accordion and SHALL keep exactly one selected page body open. Selecting another page heading SHALL close the previous page, open the selected page, and persist that selected page.

When the selected page becomes fully claimed, the accordion SHALL select the first later page that contains an unclaimed reward. It SHALL wrap to an earlier incomplete page only when no later incomplete page exists.

#### Scenario: Completing a middle page advances forward
- **WHEN** the selected page becomes fully claimed while both an earlier and a later page contain unclaimed rewards
- **THEN** the later page opens automatically

#### Scenario: Select an accordion page
- **WHEN** the player activates a page heading
- **THEN** the previously open page closes, only the selected page's reward rows remain displayed, and the selected page is persisted

#### Scenario: Select the default accordion page
- **WHEN** the selected page has no unclaimed rewards and at least one Battle Pass reward remains unclaimed
- **THEN** the first page containing an unclaimed reward opens

#### Scenario: Show covered options on an unlocked page
- **WHEN** current matching regular documents and the owned Classified quantity can cover one or more unclaimed rewards on an unlocked page individually
- **THEN** that page heading shows `({count} redeemable)` using the number of individually covered reward options
- **AND** every option is evaluated independently against the same current inventory snapshot, with matching regular documents applied before Classified Documents backfill that reward's shortage
- **AND** each covered reward row receives the existing restrained green document-coverage treatment
- **AND** the calculation excludes claimed rewards, regular-document exchanges, informational buyout bundles, farming, and future reward grants

#### Scenario: Show covered options on a locked page
- **WHEN** current matching regular documents and the owned Classified quantity can cover one or more unclaimed rewards on a page whose previous-page unlock threshold is unmet
- **THEN** that page heading shows `({count} ready when unlocked)` using the same independent-option count
- **AND** the count receives a restrained amber opportunity treatment while covered reward rows keep their existing green document-coverage treatment
- **AND** only the count wording and color change to redeemable as soon as the previous page reaches its implicit reward-count-minus-one threshold
- **AND** the player can still freely mark rewards on the locked page as redeemed or unredeemed

#### Scenario: Three Classified Documents create four Page 1 options
- **WHEN** the player owns no regular documents and owns `3` Classified Documents
- **THEN** Page 1 counts Dogtag, TarCoins, Burn Poster, and Black Division Gear Crate as four individually redeemable options
- **AND** the count does not imply that all four can be redeemed from those same three Classified Documents

#### Scenario: Hide an empty inventory-redeemable count
- **WHEN** no unclaimed reward on a page can be covered by current documents
- **THEN** that page heading shows no redeemable-count label

#### Scenario: Remove a covered-reward highlight
- **WHEN** a covered reward is no longer covered by inventory or is marked claimed
- **THEN** its green document-coverage highlight disappears
- **AND** the claimed reward treatment remains visually stronger than the covered-reward highlight

#### Scenario: Replace the completed accordion with the crate reward
- **WHEN** all Battle Pass rewards are claimed
- **THEN** no reward-page accordion is rendered
- **AND** the rail renders only the localized Black Division Gear Crate reward with a requirement of `10` documents of any non-Classified type

#### Scenario: Complete one reward page
- **WHEN** every reward on a page is marked claimed while at least one Battle Pass reward remains unclaimed
- **THEN** that page heading uses the same restrained green completion treatment as a claimed reward row

### Requirement: Compact reward rows
A visible left-column reward row SHALL contain only the localized Battle Pass item name, a compact localized list of document requirements, and the control required to mark the reward claimed. It SHALL NOT display reward artwork, long descriptions, stats, target selection, or unrelated metadata.

#### Scenario: Reward row content
- **WHEN** a reward page is expanded
- **THEN** each reward row shows the item name and unambiguous abbreviated document quantities with accessible full text

### Requirement: Reward claim controls
The interface SHALL provide one semantic claimed checkbox for each reward and global Claim all and Clear all buttons in the reward-rail heading. Reward page bodies SHALL contain no interactive controls other than the reward checkboxes. The checkbox SHALL remain keyboard-focusable while its checked state is represented by a restrained green row gradient and a check icon at the inline end. When current matching regular documents plus Classified backfill cover a checked reward, a native redemption dialog SHALL offer Redeem and subtract, Redeem only, and Cancel before state changes. Redeem and subtract SHALL atomically mark the reward claimed, subtract matching regular documents first, and subtract Classified Documents only for the exact remaining shortage. It SHALL receive initial focus and therefore be activated by Enter immediately after the dialog opens. Redeem only SHALL mark the reward claimed without mutating inventory, and Cancel SHALL change neither claims nor inventory. When recorded inventory cannot cover a checked reward, the interface SHALL mark it claimed immediately without opening a warning dialog or changing document counts. Unchecking a claimed reward and global Claim all/Clear all SHALL remain tracking-only and SHALL NOT reconstruct a reward's consumed allocation. Independently, whenever no rewards remain claimed, the season-start Classified Document grant SHALL enforce a minimum inventory of one; zero SHALL remain valid while one or more rewards are claimed.

#### Scenario: Display a claimed reward
- **WHEN** a reward is marked claimed
- **THEN** its row uses a restrained green gradient and shows a check icon at the inline end
- **AND** its semantic checkbox remains keyboard-focusable

#### Scenario: Confirm subtraction with Enter
- **WHEN** the redemption dialog opens for a reward covered by recorded inventory and the player immediately presses Enter
- **THEN** Redeem and subtract is activated

#### Scenario: Redeem and subtract matching inventory
- **WHEN** the player checks an unclaimed reward, recorded inventory covers it, and the player chooses Redeem and subtract
- **THEN** the reward becomes claimed and the displayed regular/Classified allocation is subtracted atomically
- **AND** matching regular documents are consumed before Classified Documents

#### Scenario: Redeem without changing inventory
- **WHEN** the player chooses Redeem only in the redemption dialog
- **THEN** only that reward's claimed state changes

#### Scenario: Track a redemption with incomplete inventory
- **WHEN** the player checks an unclaimed reward that current regular and Classified Documents cannot fully cover
- **THEN** the reward still becomes claimed without a warning dialog
- **AND** every entered document quantity remains unchanged

#### Scenario: Cancel individual redemption
- **WHEN** the player cancels the redemption dialog
- **THEN** neither claimed rewards nor document inventory changes

#### Scenario: Unclaim a reward
- **WHEN** the player unchecks a claimed reward
- **THEN** that reward becomes unclaimed and entered document quantities remain unchanged
- **AND** if no rewards remain claimed, Classified Documents is raised to the season-start minimum of `1`

#### Scenario: Clear all rewards globally
- **WHEN** the player invokes global Clear all
- **THEN** every reward is marked unclaimed
- **AND** entered document quantities remain unchanged
- **AND** Classified Documents is at least `1`

#### Scenario: Claim all rewards globally
- **WHEN** the player invokes global Claim all
- **THEN** every reward is marked claimed and the interface enters the Black Division crate goal state
- **AND** no document inventory is consumed

### Requirement: Center-column optimizer output
The expanded Focus column SHALL render one flat next-raid workspace focused on the selected route profile's next raid, warnings, empty states, and completed states. Its header SHALL show the route purpose and a compact localized location summary containing official difficulty and maximum raid time, with View full schedule and Commit beside it. Estimated days SHALL NOT appear in the normal workspace. A projected immediately redeemable reward SHALL NOT replace, hide, or disable the next-raid workspace. Reward checkboxes SHALL remain the only confirmed progression state, and projected claims SHALL NOT mutate inventory. When an optimizer-affecting change starts a worker request, Focus SHALL preserve its current heading and result DOM, set `aria-busy` to true, dim the heading and result content, and disable stale View full schedule and Commit actions. A newer optimizer-affecting change SHALL terminate the in-flight optimizer worker, replace any queued input with the newest immutable state snapshot, and start only that newest calculation. A terminated worker response or error SHALL NOT render. The latest matching worker response SHALL replace the result and clear the busy treatment. Page selection and switching between an existing result's Fastest and Safest profiles SHALL NOT trigger this loading treatment. When Battle Pass farming remains, Focus SHALL show one recommended location and exactly the regular document types available there. Each displayed document SHALL use the same localized first-word visible name as its persistent inventory counter while retaining its full localized name for accessible controls and image alternatives. Its pickup role SHALL appear only above the image; Focus SHALL NOT show a repeated pickup-role or planned-quantity subtitle below the document name. Every still-needed document assigned to the recommended location SHALL remain fully emphasized as a priority; available documents that do not advance the selected route SHALL be optional and dimmed. When every remaining reward requirement is already covered, Focus SHALL show an optional crate-stockpile raid and SHALL keep both location documents fully emphasized. Each displayed document SHALL have a transient non-negative raid-result input initialized to `0`. The localized raid-result instruction SHALL render its Commit term as a keyboard-operable inline link-styled action that performs the same atomic operation as the Focus-header Commit button. The persistent document ribbon SHALL place a localized note above its counters stating that document counts are independent from reward claims and must be adjusted separately. Focus SHALL NOT duplicate regular-document deficits, the selected mode's daily limit, or Classified consumed/remaining optimizer statistics.

#### Scenario: Inputs change
- **WHEN** a player changes any optimizer input
- **THEN** the center column refreshes to show the deterministic result while the surrounding controls remain available

#### Scenario: A newer input supersedes active work
- **WHEN** an optimizer-affecting input changes while an optimizer worker is still calculating an older state
- **THEN** the older worker is terminated and only a replacement worker for the newest state may update Focus

#### Scenario: Synchronous input burst
- **WHEN** several optimizer-affecting changes occur in one browser task
- **THEN** the application queues one worker calculation using the final state snapshot

#### Scenario: Farming is required next
- **WHEN** the selected profile's next schedule day contains one or more locations
- **THEN** the center shows the first recommended location, both document types available there, their priority or optional state, and separate raid-result inputs
- **AND** no focused-route card, nested location card, collected-today control, or game-day reset control is rendered

#### Scenario: A reward is immediately redeemable
- **WHEN** one or more unchecked rewards are covered by current inventory or Classified backfill
- **THEN** the center still shows the next recommended raid with both raid-result inputs and Commit
- **AND** the reward rail remains the only place that offers the optional redemption controls

#### Scenario: Current page is covered but unchecked
- **WHEN** the current page has no ordinary-document farming deficit but its progression rewards remain unchecked
- **THEN** the center pre-farms the next ordinary-document deficit on the projected Page-12-first path without marking a reward or page completed

#### Scenario: Remaining pass is fully covered
- **WHEN** current resources cover every remaining reward requirement
- **THEN** the center shows an optional crate-stockpile raid with both location documents presented as useful pickups

#### Scenario: Commit a farming result
- **WHEN** the player activates Commit after entering non-negative whole-number quantities
- **THEN** the quantities are added to the existing document inventory controls in one update
- **AND** the persisted inventory, header progress, deficits, reward recommendations, and next raid are refreshed
- **AND** the transient raid-result inputs return to zero
- **AND** activating either the Focus-header Commit button or the instruction's inline Commit action produces the same result

#### Scenario: Change a farming draft
- **WHEN** the player edits a raid-result quantity without activating Commit
- **THEN** the document inventory, cookie state, and optimizer recommendation do not change

#### Scenario: Buyout estimate is presented
- **WHEN** at least one Battle Pass reward remains unclaimed
- **THEN** the Documents progress label shows a link-styled approximate localized local-price estimate when complete pricing is available
- **AND** activating only that price link opens a native modal titled `Battle Pass buyout` with exactly two sections ordered Spend Battle Pass TarCoins and Keep Battle Pass TarCoins
- **AND** both scenario headings use the same season-accent color as an unlocked redeemable count
- **AND** each section shows TarCoin packages first and Classified Document bundles second in concise tables with source, quantity, TarCoins, storefront price, and totals
- **AND** the Keep Battle Pass TarCoins section has a larger spacing step above it than the spacing within either scenario
- **AND** the spend table includes one aggregated Battle Pass TarCoin contribution while the keep table excludes it and buys enough TarCoins to cover gross Classified bundle spend
- **AND** the modal does not show separate funding, calculation-explanation, minimum-additional, starting-versus-earned, or `FROM estimate` prose
- **AND** the estimate remains explicitly informational and does not change the farming route or player state

#### Scenario: Local purchase estimate is available
- **WHEN** additional TarCoins are required and complete same-currency package prices exist for the active locale
- **THEN** the linked header price is visibly approximate and both comparison tables show their package breakdown and calculated localized total

#### Scenario: Classified Documents have no redeemable use
- **WHEN** the player owns Classified Documents but no unclaimed reward has an eligible missing-document deficit
- **THEN** the persistent Classified counter remains unchanged

### Requirement: Header setup and Focus actions
The header SHALL contain a compact setup button labelled with the selected game mode and its fixed limit. It SHALL open a native setup dialog containing the global mode selector ordered as PvP Seasonal, PvP, then PvE and defaulting to PvP Seasonal. It SHALL NOT expose or persist an editable TarCoin balance, a crate-count control, or an optional route-purchase control. The Focus header SHALL instead show the recommended location, official difficulty, maximum raid time, View full schedule, and Commit. The full schedule SHALL preserve flat non-mutating exchange guidance, while the independent buyout SHALL move to the Documents progress price link and modal. The optimizer objective SHALL always rush Page 12 and then complete all unclaimed rewards while any remain, so the interface SHALL NOT expose a reward-goal selector, an editable daily-limit control, a separate daily-limit readout, or controls that mutate inventory for suggested exchanges.

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
The header's left summary section SHALL present total-based document progress and a link-styled approximate localized remaining-pass price beside the Documents label while rewards remain, plus claimed-reward progress. The right control section SHALL contain one Fastest/Safest toggle beside mode and locale controls. Each profile option SHALL expose a concise localized tooltip on hover and keyboard focus: Fastest prioritizes raids with lower maximum time, while Safest prioritizes raids with easier difficulty. The document total SHALL be derived from every Battle Pass requirement quantity, and the reward total SHALL be derived from every Battle Pass reward. The toggle SHALL default to Safest, persist as a UI preference, and control the focused result and full schedule. The independent buyout price SHALL update with state and locale but SHALL NOT change with the selected route profile. The interface SHALL render only the selected profile at a time and SHALL NOT display the internal abstract profile-cost value.

#### Scenario: Initial progress uses catalog totals
- **WHEN** the player opens the planner without valid persisted progress
- **THEN** Classified Documents defaults to `1`, regular documents and claimed rewards default to zero, and the header reflects those values against the complete catalog-derived totals

#### Scenario: Persist zero with one or more redemptions
- **WHEN** valid persisted progress contains zero Classified Documents and at least one claimed reward
- **THEN** the restored Classified Document count remains `0`

#### Scenario: Normalize zero with no redemptions
- **WHEN** valid persisted progress contains zero Classified Documents and no claimed rewards
- **THEN** the restored Classified Document count is raised to `1`

#### Scenario: Persisted progress is restored
- **WHEN** valid cookies contain owned document quantities and claimed rewards
- **THEN** the document and reward progress bars initialize from that restored state
- **AND** changing an inventory counter updates the persisted quantity and document progress together

#### Scenario: Claimed rewards contribute document progress
- **WHEN** one or more rewards are checked as claimed
- **THEN** their cumulative regular-document requirements contribute to the document progress value
- **AND** every document quantity control retains its separately entered value and a minimum of zero

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

### Requirement: Focus document inventory
The bottom of the expanded Focus region SHALL provide one contiguous in-game-inspired document-ribbon section containing an inventory tile for every regular and Classified Document. Each tile SHALL keep its localized title separate above square artwork and a separate quantity-control row containing decrement, direct numeric entry, and increment actions. Every tile, artwork frame, and quantity-control row SHALL use the same shared dimensions, and intrinsic title width SHALL NOT enlarge them. Document names SHALL NOT be positioned over artwork. The ribbon SHALL use one centered horizontal row on desktop and SHALL scroll internally at narrow widths rather than increasing page height. A separate sibling credits footer SHALL appear below the workspace with spacing and a dividing rule; the disclaimer SHALL NOT be part of the document section.

#### Scenario: Enter an owned quantity directly
- **WHEN** the player enters a valid non-negative integer for a document
- **THEN** the owned quantity changes to that exact integer and the optimizer recomputes without waiting for the input to lose focus

#### Scenario: Decrement at zero
- **WHEN** the player decrements a document whose owned quantity is zero
- **THEN** the quantity remains zero

#### Scenario: Decrement the season-start Classified Document
- **WHEN** no rewards are claimed and the player decrements or directly enters a Classified Document quantity below `1`
- **THEN** the Classified Document quantity remains `1`

#### Scenario: Use the season-start Classified Document
- **WHEN** at least one reward is claimed and its reviewed redemption consumes the final Classified Document
- **THEN** the Classified Document quantity may become `0`

#### Scenario: Invalid inventory value
- **WHEN** the player enters a negative, fractional, non-numeric, or cleared quantity
- **THEN** the interface truncates fractional values toward zero and clamps all other invalid values to that document's current minimum

### Requirement: Persistent asset disclaimer
The separate credits footer SHALL persistently state that Escape from Tarkov and all displayed game assets belong to Battlestate Games and that the optimizer is an unofficial fan-made tool. It SHALL center the localized disclaimer and a semantic link-styled button labelled `Reset cookie storage` on one line with a vertical divider, then stack them on separate lines with a horizontal divider when the available viewport width is sufficiently small.

#### Scenario: Disclaimer remains available
- **WHEN** the optimizer is displayed at any goal or progress state
- **THEN** the disclaimer remains available without opening a modal

### Requirement: Focused daily-plan disclosure
The Focus column SHALL present the selected profile's next raid without an estimated-day value. A `View full schedule` action SHALL open a native dialog whose header contains the estimated days. When the selected profile requires one or more regular-document exchanges, the action SHALL show a bright amber Lucide exchange icon, expose the localized exchange count in its accessible name and hover title, and retain its normal dimensions. The icon SHALL remain hidden when the selected profile requires no exchange. The schedule and buyout dialog headers SHALL use the same clearly sized Lucide X vector inside square close buttons with localized accessible Close names and SHALL NOT show visible Close text. The dialog SHALL keep its header and scrolling content within one bounded modal frame, and its content scrollbar SHALL NOT extend across the dialog boundary at desktop or narrow viewports. Schedule and buyout content scrollbars SHALL use the same thin black-track styling as the reward accordion. The dialog SHALL preserve every selected-profile regular-document exchange in a visible non-collapsible Plan actions section, omit Classified consumed/remaining statistics, and render every projected day as a rule-separated manifest with distinct Raids and Rewards to redeem regions. The Regular-document exchanges heading SHALL use the same amber warning color as the exchange icon. Each Day heading SHALL use the same season-accent color as the estimated-days value. Projected immediately redeemable rewards SHALL appear first in Day 1's Rewards to redeem sequence and SHALL NOT appear in a separate list. Within each day's Rewards to redeem region, the dialog SHALL preserve legal page progression and separate consecutive rewards by localized Battle Pass page headings and rule lines. Rewards within each page group SHALL use the same relative catalog order as that page's reward accordion. Before the first displayed Page X reward, the displayed sequence SHALL contain at least one fewer reward than the total on Page X - 1. These page groups SHALL remain intact when the Raids and Rewards to redeem regions stack at narrow viewports. The schedule SHALL NOT render day cards or page-unlocked labels and SHALL NOT create daily farming state.

#### Scenario: Required exchange is visible before schedule disclosure
- **WHEN** the selected profile contains one or more regular-document exchanges
- **THEN** View full schedule shows the amber exchange icon and exposes the localized exchange count before the dialog opens
- **AND** a selected profile without exchanges does not show the icon or warning

#### Scenario: Multi-day estimate
- **WHEN** the remaining farming quantity spans multiple daily limits
- **THEN** the default view shows only the selected profile's next raid and its location factors
- **AND** estimated days appear only inside the full-schedule dialog
- **AND** the player can explicitly open and close the complete schedule dialog

### Requirement: Dynamic page unlock guidance
Each selected reward page after Page 1 SHALL show how many more rewards must be claimed from the preceding page while that page's unlock threshold is unmet. The hint SHALL disappear as soon as the threshold is met, and the interface SHALL NOT show `PAGE X UNLOCKED` labels.

#### Scenario: Previous-page threshold changes
- **WHEN** the player claims enough rewards on the preceding page to meet the next page's unlock threshold
- **THEN** the `Claim N more from Page X` hint disappears immediately

### Requirement: Versioned cookie persistence
The application SHALL persist player-controlled progress, optimizer settings, locale, the selected reward page, and the selected route profile in bounded first-party cookies carrying both a semantic fingerprint of all five loaded data catalogs and an independent cookie-schema version. The catalog fingerprint SHALL change for catalog value or array-order changes and SHALL remain stable for object-key or JSON-formatting changes. The application SHALL request the catalogs without using stale browser cache before cookie restoration. Uncommitted raid-result inputs, the next recommended location, projected daily state, raid history, event history, and native-dialog states SHALL NOT be persisted.

#### Scenario: Restore valid state
- **WHEN** the player returns with valid supported cookies
- **THEN** the stored inventory, claimed rewards, settings, locale, selected page, and route profile are restored

#### Scenario: Reject invalid state
- **WHEN** a cookie is malformed or has an unsupported schema version
- **THEN** the affected state falls back safely to catalog defaults

#### Scenario: Refresh state after catalog data changes
- **WHEN** the player reloads with an optimizer cookie whose catalog fingerprint differs because an entry was added, removed, or modified in any of the five freshly loaded catalogs
- **THEN** the application sanitizes and preserves compatible inventory, claims, settings, locale, selected page, and route profile values
- **AND** removed or invalid catalog references fall back safely to current defaults
- **AND** the application immediately rewrites every optimizer cookie with the current fingerprint
- **AND** no manual catalog version update is required

#### Scenario: Migrate legacy state without data loss
- **WHEN** the player reloads with older cookie envelopes that have no catalog fingerprint and have a game-data version matching the loaded Battle Pass
- **THEN** the application restores the sanitized player progress, settings, locale, selected page, and route profile
- **AND** the application rewrites all optimizer cookies with the current catalog fingerprint

### Requirement: Complete reset
The centered link-styled reset button in the credits footer below the workspace SHALL require deliberate confirmation, delete all optimizer cookies, and restore catalog and UI defaults.

#### Scenario: Confirm reset
- **WHEN** the player confirms a complete reset
- **THEN** inventory returns to one Classified Document and zero regular documents while claimed rewards, settings, locale, selected page, and route profile return to defaults

#### Scenario: Cancel reset
- **WHEN** the player cancels reset confirmation
- **THEN** no persisted or in-memory player state changes
