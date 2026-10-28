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

For the automated desktop and phone browser journey and accessibility checks, install Playwright's Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

The accessibility scans cover selected core screens and do not replace keyboard and screen-reader review.

The `dist` folder is the deployable site. The [live app](https://puredalek.github.io/shem-hamis-hak-public/) is published by the GitHub Pages workflow when `main` is pushed to the public repository. The local checkout also has a separate private `origin`; pushing there alone does not update the site. To release reviewed changes, push `main` to the `pages` remote as well. `netlify.toml` remains available for Netlify. See [milestones](docs/milestones.md) for what is working and what remains.

## What currently works

- Multiple searches with boy, girl, and unisex choices; first or middle name; surname preview; optional inspiration names, length, first-letter and numerology filters. Active filters can be removed during discovery.
- Name cards, local like/pass and undo, name details and source-specific statistics. Finishing the filtered list starts another discovery round automatically, preserving saved decisions; undo and reload retain the current round.
- Optional theme filters cover all 2,431 spellings, including explicit unresolved cases. Themes include nature, biblical/traditional, mythology, international origins, light, joy/love, strength, faith, precious things, places, virtues, music/colors and life/family. Multiple selections match any selected category; exclusions remove matches for any excluded theme or for records published for selected population groups. Absence of a published record does not prove absence from a group. These are editorial associations, sometimes conditional on possible meanings, and remain locally editable. See the [classification audit](docs/name-categories.md).
- Five-year totals are lower bounds based on published counts for selected population groups and birth years 2020–2024. Suppressed figures and other groups are not zero; the source uses current names in the 2025 population snapshot. The low-count filter (at most 100 published records) cannot establish that a name is rare in the whole population.
- Saved/passed lists with name search and sorting, custom names and tournaments with user-selected entrants; names remain on the shortlist after the tournament. A saved name's details can suggest other eligible, undecided names based on selected shared length, topics or letters; the reasons are shown and shared letters are not claimed to sound alike.
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

`src/data/catalog.json` is generated from the [Israeli Central Bureau of Statistics workbook for 1949–2024](https://www.cbs.gov.il/he/mediarelease/DocLib/2025/391/11_25_391t1.xlsx), release 391/2025. It includes names with a published count of at least five in at least one population/gender series during 2020–2024. The app displays published 2020–2024 counts by source population group; suppressed or absent values are not treated as zero. Gender filters reflect groups in which a name appears in the selected period, not a judgment about who may use a name. This selection is not claimed to match the Claude sketch's catalog.

To regenerate the source data, download the workbook to `data/raw/cbs-2024.xlsx` and run:

```sh
python -m pip install openpyxl
python scripts/import-cbs.py data/raw/cbs-2024.xlsx
```

The raw workbook is ignored by Git. Regenerating replaces the catalog, so retain or reapply editorial changes separately and review the resulting diff before publishing. The workbook does not supply meanings. Sourced interpretations live separately in `src/data/editorial.json`. The original six entries were supplemented with 154 descriptions from a fixed random pilot of 200 previously unannotated names on 28 October 2026. A subsequent review added 18 conditional interpretations, including ten candidates from `review_flagged.csv` and eight unresolved pilot cases. The full research pass then covered all 2,253 remaining names and added 1,850 interpretations. The current total is **2,028 names with interpretations, out of 2,431 names (83.42%)**; **403 remain unresolved**. These are possible or disputed interpretations, including explicitly qualified analyses of component words, rather than 2,028 independently established etymologies. The pilot report retains its original historical results.

Name details show whether an interpretation is documented, possible or disputed, any qualification, and the number of distinct linked source pages. The count is not a certainty score or independent corroboration: several dictionary entries may establish different parts of one name's derivation. Each new reference explains its role, including when it only supports a word rather than the complete name. Ambiguous transliterations are explicitly conditional. Old entries default to “possible”; none are silently promoted to certain. Local or published edits to a meaning discard inherited evidence unless evidence is explicitly supplied with the edit. The editor shows existing sources and allows a new HTTPS source to be attached after editing.

The supplemental CSV contains no source citations and was used only to select research candidates. Its original file was not changed. Manual decisions, its input hash, source revision/attribution metadata and the current summary are preserved in `data/research/meaning-evidence/`. Run `python scripts/enrich-name-evidence.py --publish` to reapply those reviewed decisions and expose the existing pilot's references. `--refresh-sources` additionally reads metadata from the ignored dictionary response caches; no research or approval happens automatically. The original pilot finalizer reconstructs its sample from the immutable initial exclusions, so subsequent catalog enrichment does not change the random cohort.

The Wiktionary entries are available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the starter descriptions are short paraphrases with links to their source entries.

The [full research report](docs/name-meaning-full-pass.md) explains the completed pass and its limits. `data/research/all-name-meanings/catalog-with-meanings.csv` exports **every catalog name**, including the earlier pilot results. `results.csv` and `results.json` track the initially unannotated cohort, including unresolved results and the exact or mapped lookups attempted. `sources.json` retains source revisions or dated extraction metadata and attribution. A missing match means no match in the recorded sources, not that a name has no meaning. Source pages that only document a name or an unrelated homograph do not automatically become meanings.

The full pass used Hebrew and English Wiktionary, explicitly mapped source-language spellings, [Kaikki/Wiktextract](https://kaikki.org/) dictionary extracts, and the public-domain Strong material in [Open Scriptures' Hebrew XML](https://github.com/openscriptures/strongs/blob/master/hebrew/StrongHebrewG.xml). The extraction snapshots use the 1 October 2026 English Wiktionary dump, processed on 25 October 2026. Strong's traditional etymologies are qualified and are not presented as modern consensus; copyrighted TWOT material is not extracted. Hebrew adaptations of Wiktionary content retain their CC BY-SA attribution and licensing, including a notice in the name details.

Manual full-pass decisions live in `reviewed*.tsv` and the explicit approval plans in `data/research/all-name-meanings/`. Retrieval never approves a meaning. With the ignored raw evidence caches present, `python scripts/full-name-research.py finalize --publish` reapplies those decisions and `python scripts/export-name-meaning-audit.py` exports the complete catalog and validates coverage. The publication journal protects locally changed entries and is independent of dry-run output. To refresh retrieval, use `fetch --site he` followed by `fetch --site en` sequentially; requests are spaced and stop on errors. `scripts/fetch-name-dictionaries.py` retrieves the named language exports, and `index-extracts` indexes only the required entries. Latin-title checks fetch complete pages rather than treating a language-specific extract as complete evidence about all languages.

The [200-name pilot report](docs/name-meaning-pilot.md) records outcomes and measured time. Its portable JSON and CSV exports, random seed, manual review decisions, and source revision/attribution metadata are in `data/research/name-meanings-200/`. Wiktionary-based pilot descriptions are Hebrew adaptations: retain the source attribution and applicable share-alike licensing when redistributing them. Other sources are linked for brief factual descriptions; the pilot does not grant a license to reproduce their articles or databases. This content review is not an independent linguistic audit.

To repeat evidence retrieval, install Python's `requests` package and run `python scripts/research-name-meanings.py exact` and `python scripts/research-name-meanings.py mapped`. The ignored response cache is under `data/raw/name-meanings-200/`. Retrieval alone never approves or publishes a meaning. `python scripts/finalize-name-meaning-pilot.py` validates the fixed sample and manual decisions and refreshes the report; add `--publish` only to merge reviewed meanings into the editorial file. The recorded completion time remains fixed unless `--finish` is explicitly supplied.

## How the code is organized

- `src/domain.ts`: name filtering, recommendation ordering, numerology and tournament rules.
- `src/storage.ts`: versioned browser storage and backup validation.
- `src/cloud.ts`, `src/CloudAccount.tsx`, `src/CloudAdmin.tsx`: optional account backup and protected publication.
- `src/App.tsx`, `src/Admin.tsx`, `src/style.css`: app screens and the local editor.
- `src/data/`: portable catalog and default settings.
- `scripts/import-cbs.py`: repeatable source-data transformation.
- `supabase/migrations/` and `tests/db/`: database policy migration and local authorization checks.

The mixed ordering combines published counts, a stable per-search variation, and a simple letter similarity to liked/inspiration names. It is a heuristic, not an AI model or a statement of name quality. Exact 2024 total popularity cannot be inferred from the visible group counts because some source values are suppressed or absent.
