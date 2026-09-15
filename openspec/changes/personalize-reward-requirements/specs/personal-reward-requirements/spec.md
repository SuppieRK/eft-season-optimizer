## ADDED Requirements

### Requirement: Personal requirement editing
The system SHALL provide an Edit requirements action immediately below the Rewards heading with a notice that requirements vary by player.
The dialog SHALL start with all pages collapsed on every opening. Players SHALL open and close each page independently.
The dialog SHALL provide document selectors, quantities, add/remove actions, and per-reward Restore default.
Editor text SHALL use the application type scale. Dropdown chevrons SHALL have the same right inset as the left text padding.
It SHALL require at least one positive safe-integer regular-document entry per reward and SHALL reject duplicate document types.
Save changes SHALL apply the whole draft. Cancel SHALL discard it. Both claimed and unclaimed rewards SHALL be editable without inventory or claim mutations.

#### Scenario: Save personal requirements
- **WHEN** the player saves a valid edited reward
- **THEN** its displayed requirements and all operational calculations use the new values without changing owned quantities or claims

#### Scenario: Invalid or canceled draft
- **WHEN** the draft is empty, has duplicate document types, has invalid quantities, or is canceled
- **THEN** saved requirements and player progress remain unchanged

### Requirement: Resolved requirement consistency
Personal requirements SHALL override defaults for customized rewards and SHALL feed progress, affordability, redemption, document needs, farming, schedules, and buyout.
Canonical reward identifiers, page membership, grants, and game rules SHALL remain unchanged.

#### Scenario: Correct a requirement during optimization
- **WHEN** Save changes changes an optimizer input while a calculation is running
- **THEN** the latest personal requirements replace stale work and the interface shows consistent updated results

### Requirement: Personal requirement persistence
Personal requirements SHALL use versioned, project- and season-scoped localStorage separate from unchanged progress cookies.
They SHALL survive reloads, locale navigation, and compatible catalog corrections. Unmodified rewards SHALL use current defaults.
Removed catalog references SHALL NOT reset unrelated requirements or progress. Storage errors SHALL be visible rather than reported as successful saves.

#### Scenario: Reload after a catalog correction
- **WHEN** a default requirement changes and the player reloads with saved personal requirements
- **THEN** compatible personal requirements, inventory, and claimed rewards remain intact

### Requirement: Complete snapshot backups
Export SHALL download a local JSON snapshot of all effective reward requirements, inventory, claims, and saved preferences.
Import SHALL offer complete replacement or requirements-only replacement, never merging silently. Requirements-only import SHALL preserve progress and preferences.
The system SHALL reject malformed, unsupported-schema, and different-season files without state changes.
Same-season catalog differences SHALL show omitted rewards and necessary default fallbacks before confirmation. Cancel SHALL change nothing.

#### Scenario: Restore after defaults change
- **WHEN** a compatible snapshot is imported after catalog default quantities change
- **THEN** the restored requirements reproduce the snapshot rather than the new defaults

#### Scenario: Restore requirements only
- **WHEN** the player confirms requirements-only replacement
- **THEN** all personal requirements are replaced while inventory, claims, and preferences remain unchanged

#### Scenario: Cancel incompatible import
- **WHEN** a player cancels the compatibility preview
- **THEN** neither live state nor browser storage changes
