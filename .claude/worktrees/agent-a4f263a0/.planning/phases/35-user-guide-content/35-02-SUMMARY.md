---
phase: 35-user-guide-content
plan: "02"
subsystem: docs-content
tags: [user-guide, markdown, content, i18n, registry]
dependency_graph:
  requires: [phase-34-navigation-shell, phase-35-plan-01]
  provides: [user-guide-content-batch-2, docs-registry-complete]
  affects: [docs-sidebar, docs-page-rendering]
tech_stack:
  added: []
  patterns: [D-05-article-template, D-04-blockquote-callouts, D-06-cross-reference-links, flat-i18n-keys]
key_files:
  created:
    - frontend/src/docs/en/user-guide/filters.md
    - frontend/src/docs/de/user-guide/filters.md
    - frontend/src/docs/en/user-guide/language-and-theme.md
    - frontend/src/docs/de/user-guide/language-and-theme.md
  modified:
    - frontend/src/lib/docs/registry.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "i18n keys added as flat keys (keySeparator:false) matching existing en.json/de.json convention"
  - "docs.nav.* keys for all 6 user guide articles added to both locale files"
  - "registry.ts updated with 10 new ?raw imports and complete sections/registry objects"
metrics:
  duration: 600
  completed_date: "2026-04-16"
  tasks_completed: 2
  files_changed: 7
---

# Phase 35 Plan 02: User Guide Content Batch 2 Summary

EN and DE user guide articles for filters/date ranges and language/dark mode, plus wiring all 5 new articles into registry.ts with ?raw imports, sections entries, and flat i18n nav keys in both languages.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write EN + DE articles for filters and language/theme | 1300709 | 4 files |
| 2 | Wire all 5 new articles into registry.ts and i18n locale files | c41fa9b | 3 files |

## Decisions Made

- **Flat i18n keys:** Locale files use `keySeparator: false` throughout the project. New `docs.nav.*` keys added as flat strings (`"docs.nav.uploadingData": "Uploading Data"`) rather than nested objects, matching all existing keys.
- **Umlaut preservation:** German locale key value uses `"Filter & Zeiträume"` with the ä umlaut (not "Zeitraeume").
- **Phase 34 base files:** registry.ts and stub admin intro files were checked out from the phase 34 worktree branch before adding plan 02 content — no architectural changes needed.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on worktree setup:** This parallel agent worktree required checking out source files (docs/ directory, registry.ts) from phase 34 and plan 01 worktree branches before executing plan 02 tasks. All prerequisite files were obtained via `git checkout <branch> -- <paths>` with no content changes.

## Known Stubs

None. All 6 user guide articles have substantive content. Registry wires all articles to their markdown source.

## Self-Check
