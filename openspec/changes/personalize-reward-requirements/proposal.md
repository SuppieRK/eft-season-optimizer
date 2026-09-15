## Why

Issue #15 reports player-specific reward document types and quantities. Shared defaults alone produce incorrect farming routes and totals for these players.

## What Changes

- Add a page-based requirement editor with explicit Save and Cancel.
- Store personal requirements separately from existing progress cookies.
- Use personal requirements for all operational calculations, while About labels its totals as defaults.
- Add complete backup export and replacement import with full or requirements-only restoration.
- Preserve compatible personal requirements and progress across reloads and catalog changes.
- Extend complete reset to remove personal requirements.

## Capabilities

### New Capabilities

- `personal-reward-requirements`: Editing, validation, local persistence, snapshot backups, and effective requirements.

### Modified Capabilities

- `player-optimization-state`: Editor entry point and complete-reset scope.
- `search-discoverability`: Explicit default labeling for About totals.

## Impact

The live template, requirement resolution, browser storage, localization, and browser tests change. Existing progress cookies retain their schema.
The optimizer remains pure and receives resolved catalogs. No backend, new dependency, purchase tracking, or game-rule change is needed.
