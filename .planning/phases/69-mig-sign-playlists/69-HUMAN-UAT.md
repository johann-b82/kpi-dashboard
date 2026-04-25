---
status: partial
phase: 69-mig-sign-playlists
source: [69-VERIFICATION.md]
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run SSE regression tests against live stack
expected: All 4 new tests pass; latencies print < 500 ms for create/update/delete/bulk-PUT, < 1000 ms for tag-map diff. Command: `cd backend && DIRECTUS_BASE_URL=http://directus:8055 pytest tests/signage/test_pg_listen_sse.py -v -k "playlist_lifecycle or playlist_tag_map_diff or fastapi_playlist_delete or fastapi_bulk_replace_items"`
result: [pending]

### 2. Run Admin Directus CRUD smoke against live stack
expected: `test_admin_can_crud_signage_playlists` PASSED; `test_admin_can_crud_signage_playlist_tag_map` XFAILED (documented composite-PK gap). Command: `cd backend && DIRECTUS_BASE_URL=http://directus:8055 pytest tests/signage/test_admin_directus_crud_smoke.py -v`
result: [pending]

### 3. Visual UX smoke — Playlists admin page
expected: Open `/signage/playlists` as Admin — list renders, create/rename/re-tag work, delete on referenced playlist shows 409 with schedule deep-links, bulk-replace items works, SSE refreshes UI on cross-tab changes.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
