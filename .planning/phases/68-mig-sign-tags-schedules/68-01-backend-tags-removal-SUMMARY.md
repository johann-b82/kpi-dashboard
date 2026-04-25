---
phase: 68-mig-sign-tags-schedules
plan: 01
subsystem: backend
tags: [mig-sign, tags, fastapi, directus, removal]
requirements: [MIG-SIGN-01]
dependency_graph:
  requires:
    - "Phase 65 SCHEMA-04 — signage_device_tags collection exposed via Directus"
  provides:
    - "FastAPI no longer registers /api/signage/tags routes"
    - "signage_admin router import surface clean (six sub-routers)"
  affects:
    - "Plan 68-04 (frontend signageApi.ts swap to Directus)"
    - "Plan 68-07 (CI grep guard — /api/signage/tags must remain absent)"
tech-stack:
  added: []
  patterns:
    - "Router-level admin gate preserved (one require_admin in __init__.py)"
key-files:
  created: []
  modified:
    - "backend/app/routers/signage_admin/__init__.py"
  deleted:
    - "backend/app/routers/signage_admin/tags.py"
decisions:
  - "D-04 scope: only signage_tags collection routes removed; tag-map writes (signage_playlist_tag_map, signage_device_tag_map) deferred to Phase 69/70"
  - "D-05 SSE: signage_device_tags has no LISTEN trigger, only the *_tag_map tables do — removing FastAPI tags CRUD does not change SSE behavior"
  - "Test files required no edits — RBAC matrix already had zero tag-route references and signage permission allowlist test had zero references to the deleted module/path"
metrics:
  duration: "59s"
  tasks: 2
  files: 2
  completed: "2026-04-25"
---

# Phase 68 Plan 01: Backend Tags Removal Summary

Deleted FastAPI signage tags router (`tags.py`) and its registration in `signage_admin/__init__.py`; verified test suite already had no references requiring updates.

## Scope

MIG-SIGN-01 — tags CRUD moves to Directus. The FastAPI surface is removed so the frontend cannot accidentally route through it. Per D-04, this plan covers ONLY `signage_tags` collection routes; tag-map writes (Phase 69/70) are untouched.

## Changes

### Deleted

- `backend/app/routers/signage_admin/tags.py` (87 lines) — full file removed via `git rm`.

### Modified

- `backend/app/routers/signage_admin/__init__.py`
  - Line 11: `from . import analytics, devices, media, playlist_items, playlists, schedules, tags` → drop `, tags`
  - Line 24: removed `router.include_router(tags.router)`

## Verification

- `test -f backend/app/routers/signage_admin/tags.py` → exits 1 (file gone). PASS
- `grep -rn "tags\.router" backend/app/routers/signage_admin/` → no match. PASS
- `grep -rnE "from \. import .*tags" backend/app/routers/signage_admin/__init__.py` → no match. PASS
- `grep -rn "signage_admin\.tags" backend/tests/` → no match. PASS
- `grep -rn "/api/signage/tags" backend/app/` → no match. PASS (CI guard in Plan 07 will enforce ongoing).
- `grep -rn "/api/signage/tags" backend/tests/` → no match. PASS — nothing to catalogue for Plan 03.
- Python import smoke test: blocked locally by Python 3.9 missing `enum.StrEnum` (project requires 3.11+); failure is unrelated to this plan's deletions and confirmed reachable from `app.security.roles` not from the removed tags module.

## Tag-route References for Plan 03

Per Task 2 acceptance criteria, ran `grep -rn "/api/signage/tags" backend/tests/` — **no files matched**. Nothing to catalogue for Plan 03's port/delete pass.

## Deviations from Plan

None — plan executed exactly as written. Task 2 required no file edits because the test suite already had zero references; this is the expected state per the plan's interfaces note ("No tag routes are currently in READ_ROUTES … No edits needed there").

## Commits

- `e878d89` — `refactor(68-01): remove FastAPI signage tags router`

## Self-Check

- File existence:
  - MISSING (expected): `backend/app/routers/signage_admin/tags.py` — verified deleted
  - FOUND: `backend/app/routers/signage_admin/__init__.py`
  - FOUND: `.planning/phases/68-mig-sign-tags-schedules/68-01-backend-tags-removal-SUMMARY.md`
- Commit existence:
  - FOUND: `e878d89`

## Self-Check: PASSED
