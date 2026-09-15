## MODIFIED Requirements

### Requirement: Catalog-derived About content
The footer SHALL open a localized About dialog generated from validated catalogs. The dialog SHALL explain page unlocks, daily limits, regular-document exchanges, Classified backfill, Fastest and Safest routing, page and reward totals, the total required regular documents, and eligible farming maps. It SHALL state that listed maps are not individual spawn points. It SHALL label its requirement totals as catalog defaults rather than personal requirements. Static search content SHALL NOT include personal state.

#### Scenario: Battle Pass data changes
- **WHEN** valid pages, rewards, requirements, documents, or source locations change
- **THEN** the next production build updates the About totals and document-location table without a matching HTML edit

#### Scenario: Personal requirements change
- **WHEN** the player customizes requirements
- **THEN** About retains explicitly labeled default totals while the operational interface uses personal totals
