---
phase: 35-user-guide-content
plan: "01"
subsystem: docs-content
tags: [user-guide, markdown, content, i18n]
dependency_graph:
  requires: [phase-34-navigation-shell]
  provides: [user-guide-content-batch-1]
  affects: [docs-sidebar, docs-page-rendering]
tech_stack:
  added: []
  patterns: [D-05-article-template, D-04-blockquote-callouts, D-06-cross-reference-links]
key_files:
  created:
    - frontend/src/docs/en/user-guide/uploading-data.md
    - frontend/src/docs/en/user-guide/sales-dashboard.md
    - frontend/src/docs/en/user-guide/hr-dashboard.md
    - frontend/src/docs/de/user-guide/uploading-data.md
    - frontend/src/docs/de/user-guide/sales-dashboard.md
    - frontend/src/docs/de/user-guide/hr-dashboard.md
  modified:
    - frontend/src/docs/en/user-guide/intro.md
    - frontend/src/docs/de/user-guide/intro.md
decisions:
  - "DE articles written as natural German prose (not literal translation), using du-form matching de.json register"
  - "Upload history columns documented verbatim from en.json/de.json locale keys"
  - "HR dashboard no-date-filter note placed in employee table section per D-07 guidance"
metrics:
  duration: 420
  completed_date: "2026-04-16"
  tasks_completed: 2
  files_changed: 8
---

# Phase 35 Plan 01: User Guide Content Batch 1 Summary

Tutorial-style EN and DE user guide articles for intro, uploading data, sales dashboard, and HR dashboard — complete with blockquote callouts, cross-reference links, and exact UI label strings from locale files.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write EN articles (intro rewrite + 3 feature articles) | f3bdab7 | 4 files |
| 2 | Write DE articles (natural German prose for all 4) | 153ccf0 | 4 files |

## Decisions Made

- **Natural DE prose:** German articles written to match German sentence structure and the du-form register confirmed by de.json locale strings ("Klicke auf", "Lade eine Datei hoch") rather than literal translation of English.
- **Label fidelity:** All button and UI element names copied verbatim from locale files (e.g., "Datei auswählen" not "Durchsuchen", "Daten aktualisieren" not "Aktualisieren").
- **D-07 cross-link placement:** The note that HR has no date filter is placed at the employee table section with a link to UGUIDE-04, satisfying the D-07 brief-mention-and-link pattern.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on file creation path:** EN files were initially written to the main repo path by the Write tool, then copied into the worktree. All 8 files are correctly committed in the worktree branch.

## Known Stubs

None. All 8 articles contain complete content derived from reading the live source files and locale strings. No placeholder text or TODOs remain.

## Verification Results

```
EN OK: intro.md      DE OK: intro.md
EN OK: uploading-data.md  DE OK: uploading-data.md
EN OK: sales-dashboard.md DE OK: sales-dashboard.md
EN OK: hr-dashboard.md    DE OK: hr-dashboard.md
6 ## sections in uploading-data.md (≥3 required)
Related Articles section present in sales-dashboard.md
```

All acceptance criteria met:
- intro.md contains "# Introduction" / "# Einleitung" (stubs replaced)
- uploading-data.md contains "> **Note:**" (role restriction callout)
- uploading-data.md contains "## Related Articles" / "## Verwandte Artikel"
- uploading-data.md contains "[Filters" / "[Filter" cross-reference links
- sales-dashboard.md contains "[Filters" per D-07
- hr-dashboard.md contains "Personio" in both EN and DE
- All articles have ≥ 3 `##` headings

## Self-Check: PASSED
