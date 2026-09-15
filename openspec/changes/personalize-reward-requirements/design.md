## Context

The user approved Q1–Q15 from the issue #15 design interview. Requirements can vary in type, quantity, and entry count on any page.
The live template captures reward objects at initialization. Existing progress uses three bounded cookies and must not migrate or reset unnecessarily.

## Goals / Non-Goals

Goals: edit requirements without changing inventory or claims, recalculate immediately, preserve data, and export recoverable snapshots.
Non-goals: accounts, cloud sync, screenshot recognition, inferred presets, new reward identities, or changes to game mechanics.

## Decisions

- A dedicated module validates regular, unique, positive integer requirements and resolves overrides into a new catalog view.
  The canonical catalogs remain unchanged. All operational consumers receive the resolved view.
- Personal storage uses a project- and season-specific localStorage key with a schema version. Existing cookie envelopes remain unchanged.
- The editor opens from the Rewards heading with all pages collapsed. Each page opens and closes independently.
  This behavior differs from the main accordion. The editor stages changes until Save. Cancel discards the draft.
  Document rows use localized selectors, quantities, and removal controls. Each reward offers Restore default.
  Page labels and reward names use the same type tokens as the main accordion. Native selects use inset Lucide chevrons with balanced padding.
- Saving updates live reward text, totals, affordability, document needs, redemption, and worker inputs together.
  Obsolete worker results remain suppressed by the existing cancellation mechanism.
- Export includes every reward's effective requirements, player progress, and preferences. Import replaces either all state or requirements only.
  Malformed and different-season backups fail before mutation. Same-season differences require an explicit compatibility preview.
  Imported snapshots become overrides against current defaults to reproduce the exported values.
- Complete reset clears only this application's cookies and personal storage. About remains a labeled default reference.
- Persistence errors remain visible. Cookie writes for import are preflighted, with rollback on failure before publishing new live state.

## Risks / Trade-offs

- Two storage systems can partially fail → preflight, rollback, visible errors, and reload tests.
- Captured default reward objects can become stale → update reward references and text alongside the resolved catalogs.
- Catalog removals invalidate old entries → validate by identifiers, preserve compatible entries, and disclose import fallbacks.
- Backup files contain progress → local download/import only, with no analytics payload or uploads.
- Long localized labels can overflow → scoped responsive dialog CSS and browser checks at narrow widths.
  The Russian browser test found that an inline edit link overlaps Claim all at a narrow desktop rail width.
  The edit link therefore occupies the notice row directly below the Rewards heading, preserving existing header and action heights.

## Migration Plan

Existing users retain cookies unchanged and use defaults until they save personal requirements. Catalog fingerprint updates remain based on canonical data.
Rollback leaves personal localStorage intact but unused by the older application. No dependency or deployment change is required.

## Test Boundary

The agreed public boundary is the browser interface: editor actions, downloads/uploads, reloads, locale navigation, and visible progress.
Catalog responses and browser storage failures are external boundaries that tests can control. Assertions use edits and relative changes, not fixed catalog totals.

## Open Questions

None. The user authorized preparation and execution of this plan.
