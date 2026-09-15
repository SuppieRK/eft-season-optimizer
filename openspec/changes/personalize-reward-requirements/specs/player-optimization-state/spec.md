## MODIFIED Requirements

### Requirement: Complete reset
The centered link-styled reset button in the credits footer below the workspace SHALL require deliberate confirmation, delete all optimizer cookies and current-season personal requirement storage, and restore catalog and UI defaults. It SHALL NOT clear unrelated origin storage.

#### Scenario: Confirm reset
- **WHEN** the player confirms a complete reset
- **THEN** inventory returns to one Classified Document and zero regular documents while claimed rewards, settings, locale, selected page, and route profile return to defaults
- **AND** personal requirements return to catalog defaults

#### Scenario: Cancel reset
- **WHEN** the player cancels reset confirmation
- **THEN** no persisted or in-memory player state changes

## ADDED Requirements

### Requirement: Separate requirements editor entry
The Rewards heading area SHALL provide Edit requirements in the notice row immediately below the fixed-height heading, without adding editor controls inside normal claim rows.
The editor toolbar SHALL contain Import and Export. Save changes and Cancel SHALL appear at the bottom.

#### Scenario: Open the editor
- **WHEN** the player activates Edit requirements
- **THEN** the dedicated dialog opens on the selected reward page without changing the claim accordion
