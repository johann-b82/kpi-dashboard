---
phase: 68-mig-sign-tags-schedules
plan: 08
subsystem: signage / authz / tests
tags: [signage, directus, admin, smoke-test, mig-sign-01, mig-sign-02, d-08]
requires:
  - "Phase 68 Plan 01 (FastAPI tags router removed; Directus owns CRUD)"
  - "Phase 68 Plan 03 (FastAPI schedules router removed; Directus owns CRUD)"
  - "Phase 65 (Directus bootstrap-roles.sh §5 — Administrator policy admin_access: true)"
provides:
  - "Backend integration smoke proving Admin can CRUD signage_device_tags + signage_schedules via Directus REST"
  - "MIG-SIGN-01 + MIG-SIGN-02 acceptance evidence (admin path end-to-end)"
affects:
  - backend/tests/signage/test_admin_directus_crud_smoke.py
tech_stack_added: []
patterns:
  - "Session-scoped directus_admin_token fixture using httpx.Client + /auth/login"
  - "Transient resource pattern: reuse existing playlist or create+cleanup a temporary one"
  - "Assertion message tagged with 'D-08 fallback?' so a 401/403 immediately points to bootstrap-roles.sh §6 remediation"
key_files_created:
  - backend/tests/signage/test_admin_directus_crud_smoke.py
key_files_modified: []
decisions:
  - "D-08 bet CONFIRMED — no bootstrap-roles.sh §6 fallback needed. Administrator policy (admin_access: true) grants full CRUD on signage_device_tags and signage_schedules without explicit permission rows."
  - "GET-after-DELETE assertion accepts 403 OR 404 — Directus returns 403 (Forbidden) for missing rows by design (avoids existence leak); both outcomes confirm the row is gone."
  - "Schedule test self-provisions a playlist when none exist (current state: 0 rows in signage_playlists). Plan 68-09+ or seed data may populate playlists later; this test stays robust to either state."
  - "Task 2 (comment refresh in test_permission_field_allowlists.py) was a no-op — grep for tags.py/schedules.py/FastAPI tag/FastAPI schedule already returned 0 matches. File was already in post-Phase-68 state. Acceptance criteria (0 matches OR Phase-68-tagged comments) satisfied without any edit."
metrics:
  duration: "99s"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
  completed_date: "2026-04-25"
---

# Phase 68 Plan 08: Admin Permission Smoke Summary

Admin Directus CRUD smoke green for signage_device_tags + signage_schedules — D-08 bet (admin_access: true is sufficient) confirmed; no bootstrap-roles.sh fallback rows needed.

## What Was Built

- New integration test file `backend/tests/signage/test_admin_directus_crud_smoke.py` (135 LOC) with two cases:
  1. `test_admin_can_crud_signage_device_tags` — POST → PATCH → DELETE → GET-confirms-gone.
  2. `test_admin_can_crud_signage_schedules` — resolve/create playlist → POST schedule → PATCH priority → DELETE → cleanup transient playlist.

## Tasks Completed

| # | Name | Commit | Result |
|---|------|--------|--------|
| 1 | Admin Directus CRUD smoke test for tags + schedules | adac3e1 | 2 passed in 0.67s |
| 2 | Refresh comments in test_permission_field_allowlists.py | (no-op — no diff) | grep returned 0 matches; file already clean |

## Verification

```text
docker compose exec -T api pytest tests/signage/test_admin_directus_crud_smoke.py -v
tests/signage/test_admin_directus_crud_smoke.py::test_admin_can_crud_signage_device_tags PASSED [ 50%]
tests/signage/test_admin_directus_crud_smoke.py::test_admin_can_crud_signage_schedules    PASSED [100%]
============================== 2 passed in 0.67s ===============================
```

```text
docker compose exec -T api pytest tests/signage/test_permission_field_allowlists.py -v
2 skipped in 0.01s
```
(skipped inside container because BOOTSTRAP_PATH resolves to a host path; pre-existing behavior unrelated to this plan — exits 0 either way.)

```text
grep -nE "tags\.py|schedules\.py|FastAPI tag|FastAPI schedule|/api/signage/tags|/api/signage/schedules" \
  backend/tests/signage/test_permission_field_allowlists.py
NO MATCHES
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] GET-after-DELETE expectation relaxed from `== 404` to `in (403, 404)`**
- **Found during:** Task 1 first run.
- **Issue:** Initial assertion expected 404 on `GET /items/signage_device_tags/{id}` after DELETE. Directus actually returns 403 to avoid leaking row existence to unauthorized callers; for a missing row, 403 is the documented behavior.
- **Fix:** Accept either 403 or 404 — both confirm the row is unreadable/gone.
- **Files modified:** `backend/tests/signage/test_admin_directus_crud_smoke.py`
- **Commit:** adac3e1

**2. [Rule 2 — Critical functionality] Schedule test now self-provisions a playlist**
- **Found during:** Task 1 first run (schedule test SKIPPED).
- **Issue:** Plan text used `pytest.skip` if no playlist existed. The DB currently has zero playlists, so the schedule case never actually exercised CRUD — defeating the smoke's purpose for MIG-SIGN-02.
- **Fix:** Create a transient playlist via `POST /items/signage_playlists` when none exist; clean it up after the schedule DELETE.
- **Files modified:** `backend/tests/signage/test_admin_directus_crud_smoke.py`
- **Commit:** adac3e1

### Auth Gates

None.

### Architectural Decisions Deferred

None.

## D-08 Outcome

**Bet confirmed.** `directus/bootstrap-roles.sh` §6 was NOT needed. Administrator policy `admin_access: true` already grants:

- `POST /items/signage_device_tags` → 200
- `PATCH /items/signage_device_tags/{id}` → 200
- `DELETE /items/signage_device_tags/{id}` → 204
- `POST /items/signage_schedules` → 200
- `PATCH /items/signage_schedules/{id}` → 200
- `DELETE /items/signage_schedules/{id}` → 204
- `POST /items/signage_playlists` (used for transient setup) → 200

No new permission rows were committed. If a future Directus upgrade or policy change breaks this, the assertion message contains the literal "D-08 fallback?" string, pointing the next engineer directly at `bootstrap-roles.sh` §6.

## Comment Refresh Scope

Task 2 inspected `backend/tests/signage/test_permission_field_allowlists.py` for any reference to the deleted FastAPI tag/schedule routers (`tags.py`, `schedules.py`, `/api/signage/tags`, `/api/signage/schedules`, `FastAPI tag`, `FastAPI schedule`). Result: **0 matches**. The file's scope is sales_records + personio_employees parity only; it never mentioned the signage routers. No edit was required and no commit was made for Task 2 — acceptance criteria are met.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/tests/signage/test_admin_directus_crud_smoke.py
- FOUND: commit adac3e1 in `git log --oneline`
