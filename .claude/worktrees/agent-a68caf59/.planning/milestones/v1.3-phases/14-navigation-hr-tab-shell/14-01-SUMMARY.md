---
phase: 14-navigation-hr-tab-shell
plan: 01
subsystem: backend-api, frontend-lib, i18n
tags: [sync-meta, api-endpoint, query-keys, locale, nav-rename]
dependency_graph:
  requires: [13-sync-service-settings-extension]
  provides: [GET /api/sync/meta, fetchSyncMeta, triggerSync, syncKeys, nav.sales, hr.* locale keys]
  affects: [14-02-PLAN.md (HRPage + NavBar consume these artifacts)]
tech_stack:
  added: []
  patterns: [SyncMetaRead Pydantic schema with from_attributes, syncKeys TanStack Query factory]
key_files:
  created: []
  modified:
    - backend/app/schemas.py
    - backend/app/routers/sync.py
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "SyncMetaRead exposes last_synced_at, last_sync_status, last_sync_error only (not employees_synced/attendance/absence counts — not needed for freshness display)"
  - "GET /api/sync/meta returns SyncMetaRead() defaults (all null) when no row exists — avoids 404 on fresh installs before first sync"
  - "triggerSync in api.ts uses formatDetail() for error parsing, consistent with testPersonioConnection pattern"
  - "SyncResult interface added to api.ts (not previously present as TS type); mirrors backend SyncResult Pydantic schema"
metrics:
  duration: "~5 min"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 6
---

# Phase 14 Plan 01: Backend Sync Meta Endpoint + Frontend API Plumbing Summary

Data layer and i18n strings for Phase 14: GET /api/sync/meta endpoint, frontend fetchSyncMeta/triggerSync/SyncMetaResponse, syncKeys query factory, and nav.dashboard renamed to nav.sales with all HR page locale keys added in EN and DE.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Backend SyncMetaRead schema + GET /api/sync/meta endpoint | 2fbe65b | backend/app/schemas.py, backend/app/routers/sync.py |
| 2 | Frontend API plumbing + locale key updates (NAV-01, NAV-03) | 1d7e228 | frontend/src/lib/api.ts, frontend/src/lib/queryKeys.ts, frontend/src/locales/en.json, frontend/src/locales/de.json |

## What Was Built

### Backend (Task 1)
- `SyncMetaRead` Pydantic schema appended to `schemas.py` after `PersonioOptions`; exposes `last_synced_at`, `last_sync_status`, `last_sync_error` with `model_config = {"from_attributes": True}` for direct ORM serialization
- `GET /api/sync/meta` endpoint in `routers/sync.py` queries `PersonioSyncMeta` singleton (id=1), returns all-null `SyncMetaRead()` defaults when no row exists (safety net for fresh installs)
- Added `PersonioSyncMeta` and `SyncMetaRead` imports to sync router

### Frontend (Task 2)
- `syncKeys` factory exported from `queryKeys.ts` with `meta: () => ["sync", "meta"] as const`
- `SyncMetaResponse` interface and `fetchSyncMeta()` function added to `api.ts` (calls GET /api/sync/meta)
- `SyncResult` interface and `triggerSync()` function added to `api.ts` (calls POST /api/sync with error handling via `formatDetail`)
- `nav.dashboard` → `nav.sales` ("Sales" EN / "Vertrieb" DE) in both locale files — satisfies NAV-01
- `nav.hr`, `hr.sync.lastSynced`, `hr.sync.never`, `hr.sync.configureHint`, `hr.sync.button`, `hr.sync.success`, `hr.sync.error`, `hr.placeholder` added to both EN and DE locale files — satisfies NAV-03
- TypeScript compiles cleanly (`npx tsc --noEmit` exits 0)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - this plan is pure data layer (API endpoint + types + locale keys). No UI rendering or data binding.

## Self-Check: PASSED

Files confirmed present:
- backend/app/schemas.py: `class SyncMetaRead` verified at line 202
- backend/app/routers/sync.py: `@router.get("/meta", response_model=SyncMetaRead)` verified at line 77
- frontend/src/lib/queryKeys.ts: `export const syncKeys` added after kpiKeys
- frontend/src/lib/api.ts: `fetchSyncMeta`, `triggerSync`, `SyncMetaResponse`, `SyncResult` all exported
- frontend/src/locales/en.json: `nav.sales`, `nav.hr`, `hr.sync.*` keys present; `nav.dashboard` absent
- frontend/src/locales/de.json: `nav.sales`, `nav.hr`, `hr.sync.*` keys present; `nav.dashboard` absent

Commits confirmed present:
- 2fbe65b: feat(14-01): backend SyncMetaRead schema + GET /api/sync/meta endpoint
- 1d7e228: feat(14-01): frontend API plumbing + locale key updates (NAV-01, NAV-03)
