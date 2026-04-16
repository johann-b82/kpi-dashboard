---
phase: 36-admin-guide-content
plan: 02
subsystem: docs
tags: [admin-guide, personio, user-management, i18n, bilingual]
dependency_graph:
  requires: [36-01]
  provides: [AGUIDE-03, AGUIDE-04, I18N-01]
  affects: [frontend/src/lib/docs/registry.ts, frontend/src/locales]
tech_stack:
  added: []
  patterns: [markdown-content, registry-wiring, i18n-flat-keys]
key_files:
  created:
    - frontend/src/docs/en/admin-guide/personio.md
    - frontend/src/docs/de/admin-guide/personio.md
    - frontend/src/docs/en/admin-guide/user-management.md
    - frontend/src/docs/de/admin-guide/user-management.md
  modified:
    - frontend/src/lib/docs/registry.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions: []
metrics:
  duration: 138s
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Phase 36 Plan 02: Admin Guide Remaining Articles Summary

Personio integration and user management articles authored in EN+DE, wired into registry with full sidebar and i18n coverage completing I18N-01.

## What Was Done

### Task 1: Author EN+DE personio and user-management articles
**Commit:** a5c6752

- Created EN Personio article covering credentials, sync interval, field mapping (sick leave type, production department, skill attributes), manual sync, and cross-links
- Created DE Personio article as natural German translation preserving English API terms
- Created EN user management article covering roles (Administrator/Viewer), creating users via Directus, promoting users, admin UUID configuration
- Created DE user management article as natural German translation preserving English UI/technical terms
- All articles include security callouts (D-08) and cross-links (D-10)

### Task 2: Wire personio and user-management into registry and i18n
**Commit:** 3bcd318

- Added 4 raw imports to registry.ts (en/de personio + user-management)
- Added 2 entries to sections["admin-guide"] array (personio, user-management)
- Added entries to both en and de registry objects
- Added adminPersonio and adminUserManagement nav keys to en.json and de.json
- Admin guide sidebar now shows all 5 articles

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
