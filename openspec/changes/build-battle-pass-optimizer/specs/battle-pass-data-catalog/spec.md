## ADDED Requirements

### Requirement: Catalog separation
The system SHALL load canonical optimizer data from `documents.json`, `locations.json`, `battle-pass.json`, `optimizer-rules.json`, and `localization.json`, and SHALL keep optimizer facts out of rendering code.

#### Scenario: Valid catalogs load
- **WHEN** all five catalogs satisfy their schemas and cross-references
- **THEN** the system accepts them as the canonical runtime data set

#### Scenario: Catalog validation fails
- **WHEN** a catalog contains an invalid value or cross-reference
- **THEN** the production build and catalog validation tests fail with the catalog and offending identifier

### Requirement: Versioned season metadata
The Battle Pass catalog SHALL identify the initial game data as `1.1.0.0.46657.8.6.2026`, SHALL store the season identifier as top-level `id: "season.one"`, and SHALL store the season deadline as top-level `endsAt: 1796637600`. The catalog SHALL NOT nest these season fields under a `season` object or use `seasonEndsAtUnixSeconds`.

#### Scenario: Initial metadata is loaded
- **WHEN** the initial Battle Pass data is validated
- **THEN** its game-data version equals `1.1.0.0.46657.8.6.2026`, its top-level `id` equals `season.one`, and its `endsAt` resolves to `2026-12-07 10:00:00 UTC`

### Requirement: Document catalog
The document catalog SHALL define every regular and Classified Document with one canonical `id` equal to its name localization ID, a `kind` of `regular` or `classified`, localization IDs for its description, abbreviation and image alternative, source-location identifiers, and cleaned image path. Farmability, Black Division crate-exchange eligibility, and eligibility for a regular requirement to be backfilled by Classified Documents SHALL be derived from `kind`. The catalog SHALL NOT define `farmable`, `exchangeEligible`, or `classifiedBackfillEligible`, and SHALL NOT define a parallel short identifier or `nameId` field. Screenshot evidence used to create the assets is authoring-only and SHALL NOT be required by the runtime catalog.

#### Scenario: Document references valid locations
- **WHEN** a document lists a source location
- **THEN** that location identifier exists in `locations.json`

#### Scenario: Regular document behavior follows kind
- **WHEN** a document has `kind: "regular"`
- **THEN** it is farmable through its source locations, may appear in a Battle Pass requirement, may be exchanged for another regular document or a Black Division crate, and its missing requirement quantity may be backfilled by Classified Documents

#### Scenario: Classified Document behavior follows kind
- **WHEN** a document has `kind: "classified"`
- **THEN** it is a non-farmable reward-deficit backfill resource with no farming source locations, cannot appear as a regular Battle Pass requirement, and cannot be used in either regular-document or Black Division crate exchanges

#### Scenario: Redundant document behavior flags are rejected
- **WHEN** a document defines `farmable`, `exchangeEligible`, or `classifiedBackfillEligible`
- **THEN** catalog validation fails and identifies the redundant field

### Requirement: Screenshot-derived document thumbnails
Each document thumbnail SHALL be authored after comparing its occurrences across all supplied Battle Pass page, reward, exchange, main/guide, and document-definition screenshots. The system SHALL prefer the clearest quantity-free occurrence, then clean pixels from another occurrence of the same icon, and only then targeted reconstruction for pixels unavailable in any source. The result SHALL remove overlaid quantity numerals or counters, preserve the remaining source artwork, and be exported as a lossless PNG under `public/assets/documents/<document-id>.png`. Screenshot paths and extraction metadata are not part of the runtime JSON contract.

#### Scenario: Multiple screenshot sources exist
- **WHEN** a document icon appears in more than one supplied screenshot
- **THEN** the authoring process selects or combines the clearest, largest, least-obscured occurrences rather than defaulting to its definition screenshot

#### Scenario: Quantity overlay is removed
- **WHEN** a source document thumbnail contains an `x0`, `x1`, or other quantity overlay
- **THEN** the cleaned thumbnail reconstructs only the obscured pixels and contains no visible quantity text

#### Scenario: Cleaned thumbnail is reviewed
- **WHEN** a cleaned document image is accepted
- **THEN** a side-by-side review confirms its document artwork matches the contributing screenshot evidence outside the removed overlay and its catalog entry exposes only the final cleaned asset path

### Requirement: Location catalog routing factors
The location catalog SHALL define each location's official in-game difficulty through `difficultyId`, its matching numeric `difficultyRating`, and its `maxRaidTimeMin`. Each location's canonical `id` SHALL equal its name localization ID, and the catalog SHALL NOT define a parallel short identifier or `nameId`. `difficultyRating` SHALL map `Easy` to `1`, `Normal` to `2`, `Hard` to `3`, and `Insane` to `4`. `maxRaidTimeMin` SHALL be a positive integer used as a transparent map-size and speed proxy. These factors SHALL be shared by PvE, PvP, and PvP Seasonal; game mode SHALL affect the daily document limit rather than location routing factors.

#### Scenario: Official initial location values
- **WHEN** the initial location catalog is loaded
- **THEN** The Lab, Ice Breaker, Streets of Tarkov, Reserve, Lighthouse, and Terminal have `Insane` difficulty and difficulty rating `4`
- **AND** Ground Zero, Customs, Interchange, and Shoreline have `Hard` difficulty and difficulty rating `3`
- **AND** Woods has `Normal` difficulty and difficulty rating `2`
- **AND** Factory has `Easy` difficulty and difficulty rating `1`

#### Scenario: Initial maximum raid times
- **WHEN** the initial location catalog is loaded
- **THEN** The Lab, Ice Breaker, Ground Zero, Woods, Streets of Tarkov, Factory, Customs, Interchange, Reserve, Lighthouse, Shoreline, and Terminal have `maxRaidTimeMin` values `30, 50, 35, 25, 50, 15, 25, 35, 27, 30, 35, 45` respectively

#### Scenario: Game mode does not alter location factors
- **WHEN** the player changes between PvE, PvP, and PvP Seasonal
- **THEN** every location retains the same `difficultyRating` and `maxRaidTimeMin`

### Requirement: Screenshot-backed Battle Pass inventory
The Battle Pass catalog SHALL define season pages, reward identifiers, prerequisite relationships, document requirements, and TarCoin grants for every reconstructed reward. Each season and reward `id` SHALL equal its name localization ID, and the catalog SHALL NOT define a parallel short identifier, `nameId` field, or raw `sourceTitle` value. Reward display names SHALL be resolved from `localization.json` using the canonical reward `id`. The reward `kind` field SHALL be the sole type indicator; crate rewards SHALL use `kind: "crate"`, and the catalog SHALL NOT duplicate that classification with a `blackDivisionGearCrate` flag. Every reward requirement SHALL reference the canonical document `id` from `documents.json`. Screenshot evidence used for reconstruction is authoring-only and SHALL NOT be required by the runtime catalog.

#### Scenario: Prerequisite references
- **WHEN** a reward declares a prerequisite
- **THEN** the prerequisite references another catalog reward and does not introduce a dependency cycle

### Requirement: Implicit page unlock rule
Battle Pass pages SHALL be interpreted in ascending `page` order. Page 1 SHALL have no previous-page unlock requirement. For every later page, the number of rewards that must be acquired from the immediately previous page SHALL equal that previous page's reward count minus one. The runtime catalog SHALL NOT store a `requiresPreviousPage` flag or a replacement page-unlock field.

#### Scenario: Verified page unlock thresholds
- **WHEN** the initial Battle Pass pages are loaded
- **THEN** pages 2 through 12 require `4, 4, 4, 4, 4, 2, 3, 4, 4, 3, 3` rewards respectively from their immediately preceding pages

### Requirement: Configurable optimizer rules
The optimizer rules catalog SHALL define mode daily document limits under `dailyDocumentLimits`; `exchange.regularDocumentsPerOtherDocuments` and `exchange.regularDocumentsPerBlackDivisionGearCrate`; the complete configured set of Classified Document purchase bundles with integer document quantities and TarCoin costs; purchasable TarCoin packages with total and bonus TarCoins plus local-price references; Fastest and Safest factor-field selection; and deterministic optimizer ordering without embedding those values in UI code.

#### Scenario: Default daily limits
- **WHEN** the optimizer rules are loaded
- **THEN** `dailyDocumentLimits` defines PvE as `10`, PvP as `15`, and PvP Seasonal as `25` documents per day

#### Scenario: Black Division exchange ratio
- **WHEN** the Black Division crate rule is loaded
- **THEN** it requires `10` documents whose kind is `regular` per crate

#### Scenario: Regular-document exchange ratio
- **WHEN** the regular-document exchange rule is loaded
- **THEN** `regularDocumentsPerOtherDocuments` requires any mixture of `5` documents whose kind is `regular` for one selected regular document
- **AND** duplicate input types are valid and documents whose kind is `classified` are excluded

#### Scenario: Classified bundle configuration
- **WHEN** TarCoin-funded Classified Document purchases are evaluated
- **THEN** the available bundle costs and quantities come from `optimizer-rules.json` and support both opt-in spending decisions and the remaining-pass buyout estimate

#### Scenario: TarCoin package configuration
- **WHEN** the local real-money cost of additional TarCoins is evaluated
- **THEN** `optimizer-rules.json` supplies purchasable package totals `500, 1100, 2300, 6000, 12500, 20250`, bonus quantities `0, 100, 300, 1000, 2500, 5250`, and a local-price localization reference for each package
- **AND** the unpriced `2,000` TarCoin “RECEIVED” offer is absent from purchasable package data

#### Scenario: Route factor configuration
- **WHEN** route profiles are loaded
- **THEN** Fastest selects `maxRaidTimeMin` and Safest selects `difficultyRating` as their factor fields

### Requirement: Cross-catalog integrity
Catalog validation SHALL reject duplicate identifiers, unknown references, redundant document behavior flags, invalid kind-specific source data, negative quantities, non-positive exchange ratios or maximum raid times, difficulty ratings outside the declared scale or inconsistent with their difficulty IDs, empty required text or price localization references, invalid reward dependencies, and document requirements whose document kind is not `regular`.

#### Scenario: Unknown identifier is rejected
- **WHEN** a reward requirement references a document identifier absent from `documents.json`
- **THEN** validation fails before the optimizer can run

#### Scenario: Invalid numeric value is rejected
- **WHEN** a requirement, bundle value, or daily limit is negative, an exchange ratio or maximum raid time is non-positive, or a difficulty rating is outside its declared scale
- **THEN** validation fails and identifies the invalid field
