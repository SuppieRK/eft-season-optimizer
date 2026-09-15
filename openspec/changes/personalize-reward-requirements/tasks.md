## 1. Editing and effective requirements

- [x] 1.1 Add a failing browser test for editing, live totals, and reload preservation of inventory and claims.
- [x] 1.2 Implement validated personal storage, resolved catalogs, and the localized page-based editor.
- [x] 1.3 Connect all live calculations, redemption, and worker refresh to personal requirements.

## 2. Backup and lifecycle protection

- [x] 2.1 Add and pass browser tests for draft cancellation, validation, and restore-default behavior.
- [x] 2.2 Add and pass snapshot export/import tests for both replacement scopes and compatibility handling.
- [x] 2.3 Verify catalog changes, locale navigation, complete reset, and storage failure behavior.

## 3. Presentation and verification

- [x] 3.1 Label About totals as defaults and document local storage and backup behavior.
- [x] 3.2 Verify English/Russian desktop and narrow editor layouts and keyboard controls.
- [x] 3.3 Run lint, build, unit/catalog tests, full browser suite, and OpenSpec validation.

Verification on Node 26.7.0: lint, production build checks, 85 unit tests, 2 catalog tests, 84 browser tests, release validation, and strict OpenSpec validation passed.
The browser suite includes editor/backup tests and 15 catalog-change scenarios that also verify saved personal requirements.

## 4. UI review corrections

- [x] 4.1 Match editor text to the application type scale and balance dropdown chevron insets.
- [x] 4.2 Start each editor session with all pages collapsed and allow independent page toggles.
- [x] 4.3 Update browser coverage and documentation without changing the main accordion behavior.

After these corrections, all 85 browser tests passed. Layout assertions cover 390px, 1440px, and 2560px widths.
