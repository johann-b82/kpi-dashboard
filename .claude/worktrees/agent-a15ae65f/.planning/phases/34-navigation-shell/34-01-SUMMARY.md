---
phase: 34-navigation-shell
plan: 01
subsystem: frontend/docs
tags: [docs, i18n, navigation, registry]
dependency_graph:
  requires: [Phase 33 rendering primitives]
  provides: [DocsSidebar, article registry, i18n keys]
  affects: [frontend/src/components/docs, frontend/src/lib/docs, frontend/src/locales]
tech_stack:
  added: []
  patterns: [role-gated sidebar via AdminOnly, registry pattern for content lookup]
key_files:
  created:
    - frontend/src/components/docs/DocsSidebar.tsx
    - frontend/src/lib/docs/registry.ts
    - frontend/src/docs/en/user-guide/intro.md
    - frontend/src/docs/de/user-guide/intro.md
    - frontend/src/docs/en/admin-guide/intro.md
    - frontend/src/docs/de/admin-guide/intro.md
  modified:
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Registry keyed by lang/section/slug for O(1) content lookup in DocsPage
  - AdminOnly wrapper used on Admin Guide section group (role-gating at render time)
  - docs.nav.* i18n namespace added to existing docs object in both locales
metrics:
  duration: 600
  completed_date: "2026-04-16"
  tasks: 2
  files: 8
---

# Phase 34 Plan 01: Docs Data Layer and Sidebar Summary

**One-liner:** Article registry keyed by lang/section/slug, 4 stub MD files, DocsSidebar with AdminOnly role-gating, and docs.nav.* i18n keys in EN/DE.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Stub articles, registry, and i18n keys | df34bdc | 7 files |
| 2 | DocsSidebar component | aa47b6c | 1 file |

## What Was Built

- **4 stub Markdown files** at `frontend/src/docs/{en,de}/{user-guide,admin-guide}/intro.md`
- **Article registry** (`frontend/src/lib/docs/registry.ts`) exporting `sections` (sidebar structure) and `registry` (content keyed by lang/section/slug)
- **DocsSidebar component** with grouped flat list layout, active-article highlight, `w-56 shrink-0 hidden md:flex` responsive behavior, and Admin Guide section wrapped in `<AdminOnly>`
- **i18n keys** `docs.nav.{docsLabel,userGuide,adminGuide,userGuideIntro,adminGuideIntro}` added to both `en.json` and `de.json`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The 4 stub MD files are intentional stubs. Their content is placeholder text pointing to "upcoming updates". Phase 35 (User Guide) and Phase 36 (Admin Guide) will replace them with real article content.

## Self-Check: PASSED

- `frontend/src/components/docs/DocsSidebar.tsx` - FOUND (commit aa47b6c)
- `frontend/src/lib/docs/registry.ts` - FOUND (commit df34bdc)
- All 4 stub MD files - FOUND (commit df34bdc)
- i18n keys in both locales - FOUND (commit df34bdc)
- TypeScript compiles cleanly - VERIFIED
