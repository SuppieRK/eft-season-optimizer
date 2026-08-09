## ADDED Requirements

### Requirement: Shared site and locale-route configuration
The system SHALL keep the GitHub Pages base path, canonical root URL, repository URL, and locale routes in one site configuration. English SHALL use the existing root URL. Russian SHALL use `/ru/`. Vite, runtime locale navigation, sitemap generation, build validation, and Playwright SHALL read this configuration.

#### Scenario: Locale pages are built
- **WHEN** the production build completes
- **THEN** `dist/index.html` contains the English application page
- **AND** `dist/ru/index.html` contains the Russian application page
- **AND** both pages load one shared application bundle and shared root-path cookies

### Requirement: Stable localized search pages
Each locale URL SHALL contain localized visible HTML before JavaScript runs, the correct `html lang`, one visible `h1`, a concise title and description, a self-referencing absolute canonical, reciprocal `en` and `ru` language links, and an English-root `x-default`. Each page SHALL contain localized Open Graph, X card, and WebApplication JSON-LD metadata. The page SHALL NOT contain `noindex` or `nofollow`.

#### Scenario: Search crawler does not run JavaScript
- **WHEN** a crawler loads either locale URL without JavaScript
- **THEN** it can read the season identity, interface purpose, optimizer rules, catalog totals, and document location table in that page's language

### Requirement: URL-controlled locale navigation
An explicit locale URL SHALL be authoritative. On the unprefixed root only, the application SHALL check the saved locale first and the browser locale second. A Russian result SHALL replace the root URL with `/ru/` before initialization. The language selector SHALL save the locale and navigate to its configured URL without clearing other optimizer state.

#### Scenario: Change the selected language
- **WHEN** the player selects Russian from the English page
- **THEN** the browser opens `/ru/`
- **AND** document inventory, claimed rewards, mode, selected profile, and other persisted state remain unchanged

#### Scenario: Open an explicit Russian URL with an English cookie
- **WHEN** the player opens `/ru/` with a saved English locale
- **THEN** the application uses Russian and updates only the saved locale

### Requirement: Crawlable loading and error states
The initial application shell SHALL remain visible, SHALL expose meaningful localized content, SHALL keep controls inert, and SHALL report a busy state while catalogs load. Successful initialization SHALL enable the shell. Failed initialization SHALL stop the busy state, keep controls disabled, and show a readable localized error.

#### Scenario: Catalog loading fails
- **WHEN** one required catalog request fails
- **THEN** the localized shell and error remain visible
- **AND** unavailable controls cannot change state

### Requirement: Catalog-derived About content
The footer SHALL open a localized About dialog generated from validated catalogs. The dialog SHALL explain page unlocks, daily limits, regular-document exchanges, Classified backfill, Fastest and Safest routing, page and reward totals, the total required regular documents, and eligible farming maps. It SHALL state that listed maps are not individual spawn points.

#### Scenario: Battle Pass data changes
- **WHEN** valid pages, rewards, requirements, documents, or source locations change
- **THEN** the next production build updates the About totals and document-location table without a matching HTML edit

### Requirement: Sitemap and crawler policy
The build SHALL generate `/eft-season-optimizer/sitemap.xml` with only the English and Russian canonical URLs. It SHALL omit `index.html`, query and hash variants, data files, asset files, `priority`, `changefreq`, and speculative `lastmod`. The project SHALL NOT emit a project-level `robots.txt`.

#### Scenario: Search sitemap is built
- **WHEN** the production output is validated
- **THEN** the sitemap contains exactly the two configured locale URLs
- **AND** `dist/robots.txt` does not exist

### Requirement: Social and structured metadata
The build SHALL include one original 1200 by 630 PNG social image with project-owned graphics and no official logos, screenshots, or game-owned document artwork. Both locale pages SHALL reference it through absolute Open Graph, X card, and WebApplication JSON-LD metadata. Structured data SHALL describe a free browser utility about Escape from Tarkov and SHALL NOT include ratings, reviews, or WebSite site-name markup.

#### Scenario: Social metadata is validated
- **WHEN** either locale page is built
- **THEN** its social title, description, image alternative, locale, canonical URL, and structured-data language match that page

### Requirement: Responsive document image delivery
The asset build SHALL keep each original document image and create 192 and 384 pixel WebP variants. Static document-ribbon images SHALL reserve their dimensions, load lazily, and decode asynchronously. The current Focus image SHALL use the responsive sources and high fetch priority.

#### Scenario: Document artwork is requested
- **WHEN** the persistent document ribbon loads
- **THEN** the browser can select an appropriate responsive image without downloading every original image

### Requirement: Optional search verification
The production build SHALL inject Google site-verification metadata when `VITE_GOOGLE_SITE_VERIFICATION` is non-empty. GitHub Actions SHALL map the `GOOGLE_SITE_VERIFICATION` repository variable to that build variable. An empty value SHALL omit the metadata and SHALL NOT fail deployment.

#### Scenario: Verification is not configured
- **WHEN** the production build receives no verification value
- **THEN** both locale pages omit the verification metadata and all other search output remains valid
