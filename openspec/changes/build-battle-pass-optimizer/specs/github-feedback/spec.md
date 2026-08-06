## ADDED Requirements

### Requirement: In-page feedback composition
The application SHALL provide a persistent Feedback control that opens an in-page form and SHALL let the player preview the exact GitHub issue title and body before leaving the site.

#### Scenario: Preview feedback
- **WHEN** the player enters feedback and requests a preview
- **THEN** the interface displays the exact encoded issue content in readable form before enabling the GitHub action

### Requirement: Optional optimizer context
The feedback form SHALL keep optimizer context inclusion off by default and SHALL include context only after explicit player opt-in.

#### Scenario: Submit without context
- **WHEN** the player leaves context inclusion disabled
- **THEN** the preview excludes mode, limit, inventory, and reward state

#### Scenario: Include compact context
- **WHEN** the player enables context inclusion
- **THEN** the preview may include game-data version, mode, and the mode-derived effective daily limit
- **AND** it excludes detailed inventory and claimed-reward state unless separately and explicitly included in the visible preview

### Requirement: Prefilled GitHub issue composer
With a valid repository target, the application SHALL construct an encoded GitHub `/issues/new` URL using `URLSearchParams` and SHALL open it in a new tab for GitHub authentication, review, and submission.

#### Scenario: Open configured issue composer
- **WHEN** the player confirms a preview and a valid owner and repository are configured
- **THEN** the application opens the configured new-issue composer with title, body, and optional template parameters using `noopener` and `noreferrer`

### Requirement: No automatic issue submission
The static application SHALL NOT embed a write-capable GitHub token, call an issue-submission API, or represent feedback as sent before the player submits it on GitHub.

#### Scenario: Confirm feedback
- **WHEN** the player confirms the preview
- **THEN** the application only opens GitHub and does not perform a background issue creation request

### Requirement: Deferred repository configuration
The feedback preview SHALL remain testable before publication, but the GitHub-opening action SHALL remain disabled until a valid owner and repository are configured after UI/UX approval.

#### Scenario: Local review without repository
- **WHEN** no valid repository target is configured
- **THEN** the player can use the form and preview but sees a localized explanation that GitHub submission is available after publication

### Requirement: Feedback privacy and length limits
The application SHALL apply conservative message and generated-URL limits, SHALL show all included data in the preview, and SHALL reject a report that cannot fit safely in the configured URL limit.

#### Scenario: Feedback exceeds limit
- **WHEN** the encoded issue URL would exceed the configured safe limit
- **THEN** the interface reports a localized error and does not open a truncated or partial issue
