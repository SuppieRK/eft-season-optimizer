## ADDED Requirements

### Requirement: Dedicated ID-centered localization catalog
The system SHALL store all translated content in `localization.json` with default and supported locale metadata, a text `entries` collection, and a structured `priceEntries` collection. Every object SHALL have one stable `id` and a `localizations` object containing values for declared languages side by side.

#### Scenario: Localization entry is loaded
- **WHEN** an entry with ID `documents.secured.description` is loaded
- **THEN** its language variants are read from that entry's `localizations` object rather than separate language files

### Requirement: Single-purpose localization IDs
Names, textual descriptions, requirement abbreviations, image alternatives, displayed screenshot descriptions, UI labels, countdown units, validation messages, and feedback text SHALL use independent stable localization IDs with string values.

#### Scenario: Document content references localization
- **WHEN** a document record is loaded
- **THEN** its name, description, abbreviation, and image alternative resolve through their respective IDs in `localization.json`

### Requirement: Structured locale-dependent prices
Real-money TarCoin package prices SHALL use independent entries in `localization.json` whose value for each locale contains only a finite non-negative numeric `price` in major currency units and a three-letter uppercase ISO `currency` code. Optimizer rules SHALL reference these entries by ID. Code SHALL normalize `price` to the ISO currency's fraction digits for exact cost comparison, format it at runtime for the active locale, and SHALL NOT infer a price for another locale.

#### Scenario: Local package price is loaded
- **WHEN** a TarCoin package references `tarCoinBundles.500.localPrice` under English
- **THEN** its localized value is `{ "price": 4.99, "currency": "USD" }`

#### Scenario: Local package price is unavailable
- **WHEN** the active locale lacks a structured price for a TarCoin package
- **THEN** the application does not copy the default locale's real-money price or infer a currency conversion for that package

### Requirement: No hard-coded user-facing strings
Rendering and domain code SHALL obtain every visible and assistive user-facing string from the active localization, except data literals that are intentionally invariant such as numeric identifiers and canonical timestamps.

#### Scenario: Switch locale
- **WHEN** the player changes the active locale
- **THEN** all visible labels, validation messages, result explanations, disclaimer text, and assistive strings resolve from the selected localization without reloading game facts

### Requirement: Complete selectable locales
The header locale selector SHALL expose only declared locales that have a non-empty value for every required text and structured-price localization ID, and the configured default locale SHALL always satisfy that coverage.

#### Scenario: Incomplete locale exists in development data
- **WHEN** one declared locale is missing any required entry value
- **THEN** that locale is not offered as selectable and a production validation fails

### Requirement: Localization catalog integrity
Production validation SHALL reject duplicate or orphaned IDs across both entry collections, missing or empty required values, malformed structured prices, undeclared language keys, unknown domain references, and absent default-locale coverage.

#### Scenario: Duplicate localization ID
- **WHEN** two entries have the same stable ID
- **THEN** validation fails and identifies the duplicate

#### Scenario: Domain references unknown ID
- **WHEN** a gameplay catalog references an ID absent from `localization.json`
- **THEN** validation fails before the production build succeeds

### Requirement: Development missing-content behavior
Development builds MAY render conspicuous missing-ID markers for unfinished content, but production builds SHALL NOT contain missing-ID markers or placeholder descriptions.

#### Scenario: Missing development value
- **WHEN** a developer previews an unresolved localization ID
- **THEN** the UI identifies the missing ID rather than silently substituting unrelated text

#### Scenario: Production contains placeholder
- **WHEN** release validation detects a missing marker or placeholder description
- **THEN** publication is blocked

### Requirement: Locale selection persistence and fallback
The application SHALL persist the selected locale in versioned UI-state cookies and SHALL fall back to the configured default when a stored or browser-preferred locale is unsupported.

#### Scenario: Restore supported locale
- **WHEN** the stored locale is complete and supported
- **THEN** the application restores it on the next visit

#### Scenario: Stored locale is no longer supported
- **WHEN** the stored locale is absent from the supported complete locales
- **THEN** the application uses the configured default locale

### Requirement: Locale-aware formatting
The application SHALL use locale-aware number, date, time, plural, and message formatting and SHALL NOT construct translated sentences by concatenating independently translated fragments.

#### Scenario: Render countdown in selected locale
- **WHEN** the countdown is active under a selected locale
- **THEN** unit labels and plural forms use that locale while the underlying deadline remains Unix timestamp `1796637600`

#### Scenario: Render numeric document quantity
- **WHEN** a document quantity is displayed
- **THEN** it is formatted using the active locale without changing its numeric value

#### Scenario: Render a TarCoin price
- **WHEN** a Classified bundle subtotal, Battle Pass TarCoin contribution, or TarCoin package total is displayed
- **THEN** its invariant integer amount is formatted with the active locale's number rules and inserted into a dedicated localized TarCoin price message
- **AND** the interface does not treat TarCoins as an ISO currency

#### Scenario: Render a local real-money estimate
- **WHEN** a complete same-currency TarCoin package estimate is available for the active locale
- **THEN** its normalized numeric amount is formatted for that locale and currency in the table total
- **AND** individual package rows format the same structured numeric data without stored display text or a `FROM` prefix

### Requirement: Localized compact requirement text
The shortened document requirements in the left reward column SHALL use dedicated localized abbreviations and SHALL expose unabridged localized text to assistive technology.

#### Scenario: Compact requirement is shown
- **WHEN** a reward has multiple document requirements
- **THEN** its visible compact list uses configured localized abbreviations and its accessible text identifies every full document name and quantity

### Requirement: Right-to-left readiness
The layout SHALL use semantic source order and logical layout properties so a locale may declare right-to-left text direction without changing optimizer behavior or losing access to any region.

#### Scenario: Activate right-to-left locale
- **WHEN** a complete supported locale declares right-to-left direction
- **THEN** document flow and alignment adapt while header, reward selection, controls, results, inventory, and disclaimer remain operable

### Requirement: Human-authored content release gate
Publication SHALL be blocked until the configured default locale and every selectable locale contain reviewed human-authored item names and descriptions, meaningful alternatives for displayed item images, and descriptions for every displayed source screenshot.

#### Scenario: Screenshot description missing
- **WHEN** a displayed source screenshot lacks a reviewed description in any selectable locale
- **THEN** release validation fails and identifies the screenshot and locale

#### Scenario: All release content is complete
- **WHEN** every required entry has reviewed values for every selectable locale and no placeholders remain
- **THEN** the localization content gate passes
