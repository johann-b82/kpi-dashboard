# Outline Wiki Seed Snapshots

These are markdown exports of the KPI Dashboard Outline collection. Outline is canonical; this directory is a snapshot for version history and disaster recovery.

## Regenerate

- Sign into <https://wiki.internal> with your Dex credentials.
- Open the **KPI Dashboard** collection.
- For each page, click the `⋯` menu in the top-right of the document → **Download** → **Markdown**.
- Save each file as `##-slug.md` in this directory, matching the filenames listed below (preserve the numeric prefix so the TOC ordering survives in git).
- Strip any image-attachment lines (markdown image syntax referencing Outline upload identifiers) and rewrite absolute `https://wiki.internal/doc/...` cross-links to relative `./NN-slug.md` form (decision D-07: text-only snapshots).
- Commit the updated files via the GSD execute-phase flow.

## Files

- `00-landing.md` — collection landing page (DOC-09)
- `01-dev-setup.md` — Dev Setup (DOC-01)
- `02-architecture.md` — Docker Compose Architecture (DOC-02)
- `03-api-reference.md` — API Reference (DOC-03)
- `04-personio-sync.md` — Personio Sync Runbook (DOC-04)
- `05-sales-dashboard.md` — Sales Dashboard User Guide (DOC-05)
- `06-hr-dashboard.md` — HR Dashboard User Guide (DOC-06)
- `07-settings.md` — Settings Walkthrough (DOC-07)
- `08-admin-runbook.md` — Admin Runbook (DOC-08)

## Cadence

Re-exported at phase completion and at milestone boundaries (D-06).
