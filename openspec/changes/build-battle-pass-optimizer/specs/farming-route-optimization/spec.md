## ADDED Requirements

### Requirement: Pure deterministic optimizer
The optimizer SHALL accept normalized immutable data and player inputs and SHALL return a structured result without reading cookies, browser globals, DOM state, or network services.

#### Scenario: Repeat identical optimization
- **WHEN** the optimizer receives the same catalog and player input twice
- **THEN** both results are structurally identical and use the same deterministic ordering

### Requirement: Page-12-first complete-pass objective
While any Battle Pass reward remains unclaimed, the optimizer SHALL include every unclaimed reward, exclude already claimed rewards, and return a recommended legal redemption sequence satisfying implicit page-unlock thresholds. The sequence SHALL first minimize the selected profile's farming work needed to unlock Page 12, then minimize the work needed to claim every remaining reward. The player SHALL NOT need to select an individual reward or partial-pass goal. Black Division crate planning SHALL become available only after every reward is claimed.

#### Scenario: Rewards remain unclaimed
- **WHEN** one or more Battle Pass rewards are unclaimed
- **THEN** the plan includes all of them and recommends a deterministic Page-12-first legal order in which to redeem them

#### Scenario: Prerequisites constrain the recommendation
- **WHEN** an unclaimed reward cannot yet be redeemed because of reward prerequisites or the previous-page unlock threshold
- **THEN** the recommended sequence places enough legal prerequisite rewards before it

#### Scenario: All optimizer projections respect page access
- **WHEN** the optimizer creates a redemption sequence, immediate claim projection, daily claim projection, or buyout simulation
- **THEN** it does not process a reward from Page X until at least one fewer reward than the total on Page X - 1 has been claimed in that simulation

#### Scenario: Page 12 is not unlocked
- **WHEN** several legal reward combinations can advance the pass
- **THEN** the optimizer prefers the combination with the lower selected-profile farming work to unlock Page 12 before clearing optional rewards on earlier pages

#### Scenario: Page 12 is unlocked
- **WHEN** Page 12 is already available and ordinary rewards remain
- **THEN** the optimizer continues with the lower-work legal sequence that completes all remaining rewards

### Requirement: Ordinary document consumption
The optimizer SHALL aggregate required regular documents and consume matching owned regular documents before allocating Classified Documents or recommending farming.

#### Scenario: Matching regular inventory exists
- **WHEN** the player owns part of a required regular document quantity
- **THEN** that inventory reduces the matching deficit before any Classified Document is applied

#### Scenario: Regular inventory satisfies requirements
- **WHEN** owned matching regular documents satisfy every requirement across all unclaimed rewards
- **THEN** the result recommends no farming and consumes no Classified Document for those satisfied requirements

### Requirement: Regular document exchange
The optimizer SHALL read `exchange.regularDocumentsPerOtherDocuments` from `optimizer-rules.json` and SHALL support exchanging any mixture of that many surplus regular documents for one needed regular document. Duplicate source types SHALL be allowed, documents with `kind: "classified"` SHALL be excluded, and inventory needed to satisfy its own matching requirements across all unclaimed rewards SHALL be reserved rather than treated as surplus. The optimizer SHALL apply profile-beneficial exchanges only after matching regular inventory and the maximum consumable owned Classified quantity are fixed, and before farming.

#### Scenario: Mixed surplus inventory covers a deficit
- **WHEN** the player owns five surplus regular documents in any mixture and lacks one regular document required by an unclaimed reward
- **THEN** the optimizer may recommend exchanging those five documents for the needed document

#### Scenario: Duplicate source types are allowed
- **WHEN** all five exchange inputs are surplus documents of the same regular type
- **THEN** they form a valid exchange input group

#### Scenario: Matching requirements are protected
- **WHEN** an owned regular document is still required by an unclaimed reward of the same type
- **THEN** the optimizer reserves it for that requirement before calculating exchangeable surplus

#### Scenario: Classified Documents are not exchangeable
- **WHEN** the player owns Classified Documents
- **THEN** none of them count toward the regular-document exchange ratio

### Requirement: Classified Document backfill
The optimizer SHALL use owned Classified Documents only to fill eligible deficits remaining after ordinary-document requirements and matching inventory are calculated for the legal sequence of all unclaimed rewards. It SHALL maximize owned Classified consumption before optimizing route cost or regular-document exchange, fixing the consumed quantity at the smaller of owned Classified Documents and total eligible deficit. The optimizer SHALL target zero remaining owned Classified Documents whenever the eligible deficit is at least the owned quantity.

#### Scenario: Eligible deficits exhaust owned Classified Documents
- **WHEN** the all-unclaimed-rewards legal redemption sequence has eligible deficits at least as large as the owned Classified quantity
- **THEN** the optimizer consumes every owned Classified Document and reports zero remaining

#### Scenario: Classified supply exceeds eligible deficits
- **WHEN** eligible deficits are smaller than the owned Classified quantity
- **THEN** the optimizer fills every eligible deficit and reports only the unavoidable surplus as remaining

#### Scenario: Classified Documents cover an entire reward
- **WHEN** the player owns none of a reward's required regular documents and owns enough Classified Documents for every missing unit
- **THEN** the reward may be completed entirely through Classified backfill without removing its canonical ordinary-document requirements

#### Scenario: Matching regular inventory takes priority
- **WHEN** the player owns a required regular document and also owns Classified Documents
- **THEN** the matching regular document is consumed before any Classified Document is allocated to that requirement

#### Scenario: No redeemable deficit accepts backfill
- **WHEN** the all-unclaimed-rewards legal sequence contains no reward with an eligible missing-document deficit
- **THEN** the optimizer consumes no Classified Documents and reports the full owned quantity unchanged

### Requirement: Cost-aware Classified allocation
After fixing the maximum legally consumable owned Classified quantity, the optimizer SHALL allocate that quantity independently for Fastest and Safest route selection to remove the highest-cost farming work under each profile's objective. Profile cost SHALL determine which deficits receive backfill but SHALL NOT reduce the fixed consumption quantity.

#### Scenario: Classified supply is insufficient
- **WHEN** two document deficits have different best farming costs and Classified Documents can fill only one
- **THEN** each profile selects the allocation that yields its better complete deterministic route result

#### Scenario: Route cost cannot preserve usable Classified Documents
- **WHEN** multiple allocations differ in route cost but all owned Classified Documents can legally be consumed
- **THEN** every candidate considered for selection consumes the full owned quantity

### Requirement: Remaining-pass Classified buyout estimate
The optimizer SHALL calculate an informational Classified bundle estimate for every unclaimed Battle Pass reward after applying matching regular documents, the maximum usable current Classified Documents, and useful regular-document exchanges. The estimate SHALL evaluate every Classified Document bundle configured in optimizer rules and SHALL NOT alter route optimization or player state. It SHALL visit bundles by descending Classified Document quantity and take the maximum whole count of each bundle that fits within the remaining deficit before visiting the next bundle. The combined selected quantity SHALL NOT exceed the remaining deficit. An uncovered remainder SHALL be allowed and remain farmable. The selected bundle plan SHALL be staged through a legal redemption sequence in which TarCoins from claimed Battle Pass rewards are immediately available and future Battle Pass TarCoins become available only after their reward is redeemed. The result SHALL report bundle counts, gross TarCoin spend, earned Battle Pass TarCoins used, and minimum additional TarCoins required. It SHALL NOT report or persist Classified Documents as purchased, used, or excess.

#### Scenario: Large bundle is cheaper for the complete pass
- **WHEN** repeated reward deficits together require 500 Classified Documents
- **THEN** the estimate selects one 500-document bundle

#### Scenario: Bundle total stays below the remaining deficit
- **WHEN** 450 Classified Documents remain
- **THEN** the estimate selects one 250-document bundle, two 75-document bundles, and one 40-document bundle
- **AND** the selected total is 440 rather than exceeding the remaining deficit

#### Scenario: Small uncovered remainder is allowed
- **WHEN** 71 Classified Documents remain
- **THEN** the estimate selects one 40-document bundle and one 20-document bundle
- **AND** the remaining 11 documents stay farmable

#### Scenario: Existing inventory already covers the remaining pass
- **WHEN** owned regular and Classified Documents cover every unclaimed reward
- **THEN** the buyout estimate reports zero bundles, zero gross spend, and zero additional TarCoins required

#### Scenario: Redeemed reward funds a later purchase
- **WHEN** a legally redeemable reward grants TarCoins before a later bundle purchase is needed
- **THEN** the estimate credits those TarCoins after redemption and reports the amount of earned TarCoins used

#### Scenario: Future reward cannot fund an earlier purchase
- **WHEN** completing an earlier reward requires a purchase before a later TarCoin reward can be redeemed
- **THEN** the later grant is excluded from the earlier balance and the estimate reports the minimum additional TarCoins needed to keep the sequence feasible

#### Scenario: Buyout does not change farming
- **WHEN** the buyout estimate includes one or more Classified Document bundles
- **THEN** no purchase affects the Fastest or Safest farming plan

### Requirement: Local TarCoin purchase estimate
The optimizer SHALL use the TarCoin purchase packages configured in `optimizer-rules.json` and their locale-dependent `{ price, currency }` values from `localization.json` to calculate two local real-money package estimates for the remaining-pass buyout. The spend-Battle-Pass-TarCoins estimate SHALL cover the minimum additional TarCoins after applying available TarCoins from claimed and reward-sequenced Battle Pass rewards. The keep-Battle-Pass-TarCoins estimate SHALL preserve those TarCoins and cover the gross TarCoin cost of the same required Classified Document bundle plan. Each estimate SHALL normalize numeric prices to the ISO currency's fraction digits and minimize that exact cost, then excess purchased TarCoins, then package count. It SHALL calculate an estimate only when every selected package has a price for the active locale and all selected prices use one currency. The unpriced `2,000` TarCoin “RECEIVED” offer SHALL NOT be included as a purchasable package.

#### Scenario: Complete local prices exist
- **WHEN** the buyout requires additional TarCoins and the active locale has complete same-currency prices
- **THEN** the result reports spend and keep package combinations with total TarCoins purchased, excess TarCoins, numeric total price, ISO currency, and runtime-formatted package prices

#### Scenario: Local prices are incomplete
- **WHEN** one or more packages needed by every valid minimum-cost combination lacks a price for the active locale or introduces a different currency
- **THEN** the optimizer leaves the local real-money estimate unavailable and does not infer a conversion

#### Scenario: No additional TarCoins are required
- **WHEN** claimed and immediately earned Battle Pass TarCoins fund the complete buyout sequence
- **THEN** the spend estimate reports zero packages and zero local cost while the keep estimate still covers gross TarCoin spend

### Requirement: Immediate reward TarCoin availability
TarCoins granted by a Battle Pass reward SHALL become available immediately after that reward is redeemed, without waiting for completion of its Battle Pass page, and SHALL never be credited before redemption.

#### Scenario: Same-page subsequent purchase
- **WHEN** a redeemed reward grants enough TarCoins for a configured bundle needed by a later reward on the same page
- **THEN** the optimizer may purchase the bundle before planning the later reward

#### Scenario: Future TarCoins are unavailable
- **WHEN** a TarCoin reward has not yet been redeemed in the legal sequence
- **THEN** its TarCoins are excluded from the available balance

### Requirement: Fastest and Safest route objectives
For remaining document deficits, the optimizer SHALL produce a Fastest profile that minimizes `sum(assigned documents × maxRaidTimeMin)` and a Safest profile that minimizes `sum(assigned documents × difficultyRating)`. When Safest candidates have equal difficulty cost, it SHALL first prefer fewer selected locations without equipment insurance and then lower total `maxRaidTimeMin`. After profile-specific comparisons, each profile SHALL break ties by fewer distinct locations, lower raw farming quantity, and stable location identifier order. Location factors SHALL remain identical across PvE, PvP, and PvP Seasonal; the selected mode affects scheduling through its daily limit only.

#### Scenario: Fastest and Safest differ
- **WHEN** one complete route has lower maximum-raid-time cost and another has lower difficulty-rating cost
- **THEN** the optimizer returns the first as Fastest and the second as Safest

#### Scenario: Shared location wins a profile tie
- **WHEN** candidate routes tie on a profile's route cost but one uses fewer distinct locations because multiple documents share that location
- **THEN** that profile selects the route with fewer locations

#### Scenario: Equipment insurance breaks a Safest tie
- **WHEN** Safest candidate routes have equal difficulty cost and one uses fewer locations where equipment insurance is unavailable
- **THEN** the optimizer selects the route with better equipment-insurance availability before comparing maximum raid time

#### Scenario: Complete tie
- **WHEN** candidates tie on profile cost, location count, and raw quantity
- **THEN** stable location identifier order determines the result

#### Scenario: Both profiles produce the same assignment
- **WHEN** the optimal Fastest and Safest location and document assignments are identical
- **THEN** the result marks the profiles as coincident so the selected profile view can identify the shared assignment

#### Scenario: Profile has no complete route
- **WHEN** eligible locations cannot cover every remaining document for a profile
- **THEN** that profile is marked unavailable with a reason and no partial assignment

### Requirement: Location routing factors
The optimizer SHALL read each recommended location's `maxRaidTimeMin`, `difficultyId`, `difficultyRating`, and equipment `insurance` availability from `locations.json` and SHALL return the applicable factor values with every route result. It SHALL NOT derive different location factors from the selected game mode.

#### Scenario: Factory routing factors
- **WHEN** Factory is evaluated in PvE, PvP, or PvP Seasonal
- **THEN** Fastest uses `maxRaidTimeMin: 15` and Safest uses `difficultyRating: 1` with `difficultyId: "difficulty.easy"`

### Requirement: Global game-mode scheduling input
The optimizer SHALL accept exactly one selected game mode for the complete calculation. It SHALL resolve PvE, PvP, and PvP Seasonal to fixed daily document limits `10`, `15`, and `25` respectively from `optimizer-rules.json`. The selected mode SHALL affect optimizer results only through the effective daily document limit and resulting schedules and estimated day counts. It SHALL NOT alter reward expansion, document deficits, inventory consumption, Classified Document allocation, TarCoin calculations, location eligibility, route assignments, or Fastest and Safest objective values. The optimizer SHALL NOT accept a user-defined daily-limit override.

#### Scenario: Global mode changes estimated days
- **WHEN** the same route requires `50` farmed documents
- **THEN** PvE produces `5` estimated plan days, PvP produces `4`, and PvP Seasonal produces `2`
- **AND** all three calculations retain identical document deficits, location assignments, and route objective values

### Requirement: Daily planning estimate
The optimizer SHALL partition remaining farming quantities into ordered projected plan days that do not exceed the effective daily document limit. It SHALL prioritize the Page-12 unlock path, claim rewards as soon as their requirements and previous-page unlock threshold are satisfied, then clear every remaining reward. The daily limit SHALL only partition the projection; the optimizer SHALL NOT track documents collected today, remaining daily allowance, game-day resets, or raid history. It SHALL preserve location grouping where possible after the route is selected.

#### Scenario: Quantity exceeds daily limit
- **WHEN** a route requires more documents than the effective daily limit
- **THEN** the result contains multiple days and no day exceeds that limit

#### Scenario: First day advances the Battle Pass
- **WHEN** the initial Page 1 state is planned under the PvE limit
- **THEN** Day 1 claims four Page 1 rewards and records Page 2 as unlocked instead of farming an aggregate location backlog without reward progress

#### Scenario: Schedule covers the fixed objective
- **WHEN** all Battle Pass rewards begin unclaimed
- **THEN** the projected immediate claims and daily claims together contain every unclaimed reward exactly once

#### Scenario: Route comparison is independent of scheduling
- **WHEN** profile routes require the same farming quantities under different daily limits
- **THEN** changing the daily limit changes each profile schedule but not its route objective values

### Requirement: Rolling next-raid recommendation
For an available selected profile, the optimizer SHALL expose a next-raid recommendation whenever an eligible regular-document location exists. Projected immediately redeemable rewards SHALL remain advisory schedule metadata and SHALL NOT suppress the recommendation. The projection SHALL start from confirmed checked rewards and current inventory, MAY reserve covered rewards without mutating that state, and SHALL look ahead along the Page-12-first sequence to pre-farm the next ordinary-document deficit. The recommendation SHALL be recalculated from the player's current inventory after each committed raid result. Every regular document available at that location SHALL remain identifiable with an explicit `priority`, `optional`, or `stockpile` role.

#### Scenario: Recommend the next raid
- **WHEN** farming is required
- **THEN** the result identifies one next location and the document types that advance the Page-12-first complete-pass objective there

#### Scenario: Recommend a raid beside a projected claim
- **WHEN** a reward is projected to be immediately redeemable and later farming work remains
- **THEN** the result returns both the projected claim metadata and the next Battle Pass raid

#### Scenario: Pre-farm after a covered unchecked page
- **WHEN** every progression reward on the current page is covered but remains unchecked
- **THEN** the result recommends the next location needed by the projected Page-12-first sequence without adding any reward to the confirmed claimed set

#### Scenario: Stockpile after covering the pass
- **WHEN** every remaining reward requirement is covered but one or more rewards remain unchecked
- **THEN** the result keeps the all-unclaimed-rewards goal and returns an optional crate-stockpile raid
- **AND** Fastest orders eligible locations by maximum raid time, while Safest orders them by difficulty rating, equipment-insurance availability, maximum raid time, and stable location ID

#### Scenario: Commit raid results
- **WHEN** the player commits non-negative quantities obtained for either document available at the recommended location
- **THEN** those quantities are added to the ordinary inventory counters and the next recommendation is recalculated from the updated inventory

#### Scenario: Commit no documents
- **WHEN** the player commits zero for both document types
- **THEN** inventory remains unchanged and the optimizer may return the same recommendation

#### Scenario: Draft raid results
- **WHEN** the player changes a next-raid quantity but has not committed it
- **THEN** the optimizer result and persisted player inventory remain unchanged

### Requirement: Black Division crate fallback
When every Battle Pass reward is claimed, the optimizer SHALL switch to a Black Division crate-count goal, default to one crate, apply inventory whose document has `kind: "regular"` at `10` documents per crate, and exclude documents with `kind: "classified"`.

#### Scenario: All rewards claimed with insufficient regular inventory
- **WHEN** the player requests one crate and owns fewer than ten documents whose kind is `regular`
- **THEN** the result recommends farming the shortage at the eligible location with the lowest `maxRaidTimeMin`

#### Scenario: Enough documents for immediate exchange
- **WHEN** the player owns enough documents whose kind is `regular` for the requested crate count
- **THEN** the result reports no crate shortage and still returns an optional stockpile raid for another crate

#### Scenario: Classified Documents owned in crate mode
- **WHEN** the player owns Classified Documents while planning Black Division crates
- **THEN** those documents remain unchanged and do not reduce the crate shortage

### Requirement: Structured optimizer result
The optimizer result SHALL report all included unclaimed rewards and their Page-12-first legal sequence, ordinary consumption, profile-specific regular-document exchanges, Classified allocation, the independent remaining-pass buyout and local TarCoin-package estimates, deficits, location assignments and routing factors, the next recommended raid, Fastest or Safest objective values, projected daily estimates, unused resources, coincidence or unavailability state, and applicable warnings. It SHALL NOT require a persisted farming session, raid history, or event timeline.

#### Scenario: Result is rendered
- **WHEN** optimization completes successfully
- **THEN** the UI can render every summary and detail from the returned result without recomputing domain decisions
