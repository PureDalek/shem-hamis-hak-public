# שם המשחק

A mobile-first Hebrew name-discovery game. Browse Israeli names, keep a shortlist, and compare favourites in a tournament. The project is an ordinary React and TypeScript app whose code and catalog live in this folder; it can be built and hosted on any static hosting provider.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build and the domain tests:

```sh
npm test
npm run build
npm run preview
```

For the automated desktop and phone browser journey checks, install Playwright's Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

The `dist` folder is the deployable site. `netlify.toml` configures the build for Netlify. See [milestones](docs/milestones.md) for what is working and what remains.

## What currently works

- Multiple searches with boy, girl, and unisex choices; first or middle name; surname preview; optional inspiration names and numerology filters.
- Name cards, local like/pass and undo, name details and source-specific 2024 statistics.
- Saved/passed lists, custom names and tournaments with user-selected entrants; names remain on the shortlist after the tournament.
- Optional partner comparison by exchanging shortlist files manually. The file contains only saved name spellings and is never sent automatically.
- Browser-local persistence, backup and restore, family names and a local catalog/settings editor. The editor exposes recommendation weights and a preview using the current search.

The default build uses only local storage. Optional code for account backup and an authenticated shared publisher is included, but requires a configured and verified Supabase project before use; see [cloud setup](docs/cloud-setup.md). Automatic partner pairing, advertisements, and real payments are not implemented. Without cloud configuration the editor only changes the visitor's own browser.

## Update names and settings for all visitors

1. Open **פרופיל → הגדרות ועריכת מאגר מקומית** in the app. Edits affect that browser immediately.
2. Export the catalog and/or settings using the buttons in the editor.
3. Replace `src/data/catalog.json` and/or `src/data/settings.json` in this project with the exported files.
4. Run `npm test` and `npm run build`, review the changes, then deploy the new build. Existing visitors may have local overrides, which take precedence in their own browser.

Changes to the source and generated catalog can also be made directly in this repository. IDs should remain stable when changing display names. Add a source link for a reviewed meaning or origin; the editor accepts HTTPS links and shows them on name cards. The browser editor's local backup is exported from the profile; it is separate from the shared catalog export.

## Catalog provenance

`src/data/catalog.json` is generated from the [Israeli Central Bureau of Statistics workbook for 1949–2024](https://www.cbs.gov.il/he/mediarelease/DocLib/2025/391/11_25_391t1.xlsx), release 391/2025. It includes names with a published count of at least five in at least one population/gender series during 2020–2024. The app displays 2024 counts by the source population group; suppressed or absent values are not treated as zero. Gender filters reflect groups in which a name appears in the selected period, not a judgment about who may use a name. This selection is not claimed to match the Claude sketch's catalog.

To regenerate the source data, download the workbook to `data/raw/cbs-2024.xlsx` and run:

```sh
python -m pip install openpyxl
python scripts/import-cbs.py data/raw/cbs-2024.xlsx
```

The raw workbook is ignored by Git. Regenerating replaces the catalog, so retain or reapply editorial changes separately and review the resulting diff before publishing. The workbook does not supply meanings. A small starter set of Hebrew word interpretations lives separately in `src/data/editorial.json`, with links to the relevant Wiktionary entries; remaining meanings stay blank until sourced and reviewed. These are possible interpretations, since spellings can have multiple origins.

The Wiktionary entries are available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the starter descriptions are short paraphrases with links to their source entries.

## How the code is organized

- `src/domain.ts`: name filtering, recommendation ordering, numerology and tournament rules.
- `src/storage.ts`: versioned browser storage and backup validation.
- `src/cloud.ts`, `src/CloudAccount.tsx`, `src/CloudAdmin.tsx`: optional account backup and protected publication.
- `src/App.tsx`, `src/Admin.tsx`, `src/style.css`: app screens and the local editor.
- `src/data/`: portable catalog and default settings.
- `scripts/import-cbs.py`: repeatable source-data transformation.
- `supabase/migrations/` and `tests/db/`: database policy migration and local authorization checks.

The mixed ordering combines published counts, a stable per-search variation, and a simple letter similarity to liked/inspiration names. It is a heuristic, not an AI model or a statement of name quality. Exact 2024 total popularity cannot be inferred from the visible group counts because some source values are suppressed or absent.
