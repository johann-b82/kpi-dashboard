---
phase: 68-mig-sign-tags-schedules
verified: 2026-04-25T00:00:00Z
status: human_needed
score: 3/3 must-haves verified (automated)
---

# Phase 68: MIG-SIGN — Tags + Schedules Verification Report

**Phase Goal:** Signage tags and schedules CRUD happen through Directus; admin UI continues to create/rename/delete tags and schedules with the same UX; Pi players receive `tag_map` and `schedule-changed` SSE fan-out within 500 ms of the Directus write.
**Verified:** 2026-04-25
**Status:** human_needed (all static checks PASS; live-stack assertions deferred per Plan 02/08 Acceptance "DEFERRED — requires live DB")
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Admin can create/rename/delete signage tags via Directus SDK; FastAPI tag routes removed | ✓ VERIFIED | `backend/app/routers/signage_admin/tags.py` deleted; `__init__.py` no longer registers it; `signageApi.listTags/createTag/updateTag/deleteTag` use `directus.request(readItems/createItem/updateItem/deleteItem('signage_device_tags', …))` |
| 2 | Admin can create/edit/delete schedules; `start_hhmm < end_hhmm` enforced via Alembic CHECK + Directus Flow; FastAPI schedules router removed | ✓ VERIFIED | `schedules.py` deleted; Alembic `v1_23_signage_schedule_check.py` ensures CHECK with canonical name `ck_signage_schedules_start_before_end`; `bootstrap-roles.sh` §6 provisions Flow throwing `schedule_end_before_start`; `signageApi.list/create/update/deleteSchedule` use Directus SDK; FE maps coded error to i18n key `signage.admin.schedules.error.start_after_end` |
| 3 | Directus-originated mutations fan out correct SSE events within 500 ms; tag CRUD silent | ✓ VERIFIED (static) / ? UNCERTAIN (timing) | `test_pg_listen_sse.py::test_directus_schedule_lifecycle_fires_sse_each_step` covers create/update/delete → schedule-changed; `test_directus_signage_device_tags_fires_no_sse` validates tag CRUD silence; D-09 pattern preserved. Sub-500 ms wall-clock requires live stack to confirm. |

**Score:** 3/3 truths verified (static analysis); live-stack timing in Truth 3 routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/app/routers/signage_admin/tags.py` | Deleted | ✓ VERIFIED | File absent from directory listing |
| `backend/app/routers/signage_admin/schedules.py` | Deleted | ✓ VERIFIED | File absent (only `.pyc` cache remains, ignored) |
| `backend/app/routers/signage_admin/__init__.py` | Tags/schedules unregistered | ✓ VERIFIED | imports/include_router calls absent for tags + schedules; only analytics, media, playlists, playlist_items, devices |
| `backend/alembic/versions/v1_23_signage_schedule_check.py` | CHECK rename migration | ✓ VERIFIED | File exists; `CHECK (start_hhmm < end_hhmm)` predicate confirmed; canonical name `ck_signage_schedules_start_before_end` |
| `directus/bootstrap-roles.sh` §6 | Flow + operation provisioning | ✓ VERIFIED | Lines 204–281 idempotently POST Flow + exec operation; throws `schedule_end_before_start` when `start >= end`; scoped to `signage_schedules` items.create+items.update |
| `frontend/src/signage/lib/signageApi.ts` | Tag + schedule fns swapped to Directus SDK | ✓ VERIFIED | All 8 fns use `directus.request(…)` against `signage_device_tags` / `signage_schedules`; public signatures unchanged |
| `frontend/src/signage/components/ScheduleEditDialog.tsx` | Maps `schedule_end_before_start` → i18n | ✓ VERIFIED | `isScheduleEndBeforeStartError` helper at line 91/97; routes to `signage.admin.schedules.error.start_after_end` |
| `frontend/src/locales/{en,de}.json` | `start_after_end` i18n key | ✓ VERIFIED | EN line 388 + DE line 388 present |
| `backend/tests/signage/test_signage_schedule_check.py` | DB CHECK regression tests | ✓ VERIFIED | Created; 5 tests covering positive/negative/boundary/round-trip/constraint-name |
| `backend/tests/signage/test_pg_listen_sse.py` | Schedule lifecycle + tag-silent SSE | ✓ VERIFIED | Tests `test_directus_schedule_lifecycle_fires_sse_each_step` (line 437) and `test_directus_signage_device_tags_fires_no_sse` (line 594) |
| `backend/tests/signage/test_admin_directus_crud_smoke.py` | Admin CRUD smoke for both collections | ✓ VERIFIED | `test_admin_can_crud_signage_device_tags` (line 38) + `test_admin_can_crud_signage_schedules` (line 76) |
| `.github/workflows/ci.yml` grep guard | Block `/api/signage/tags`/`schedules` in backend/app | ✓ VERIFIED | Guard at lines 99–113 fails CI if patterns reappear |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `signageApi.listTags` etc. | Directus collection `signage_device_tags` | `directus.request(readItems/createItem/updateItem/deleteItem)` | ✓ WIRED | Imports `@directus/sdk` and `directus` singleton; signature stable |
| `signageApi.list/create/update/deleteSchedule` | Directus collection `signage_schedules` | `directus.request(...)` | ✓ WIRED | Field allowlist `SCHEDULE_FIELDS` mirrors `SignageSchedule` type |
| Directus Flow | DB CHECK constraint | `start_hhmm < end_hhmm` predicate | ✓ WIRED | Flow throws code BEFORE DB; CHECK is last line of defense |
| Directus error envelope | FE i18n | `isScheduleEndBeforeStartError` (matches both `Error.message` JSON and `errors[].extensions.code`) | ✓ WIRED | Dual-shape detection covers Plan 02 throw shape and SDK envelope |
| Postgres LISTEN trigger on `signage_schedules` | SSE `schedule-changed` event | Phase 65 LISTEN bridge | ✓ WIRED | Existing trigger preserved; D-00d unchanged |
| Backend `__init__.py` router registration | tags/schedules subrouters | `include_router(...)` | ✓ NOT_PRESENT (correct) | Includes removed; phase intent achieved |
| CI guard | backend/app source | `grep -rnE` job | ✓ WIRED | Step 99–113 in ci.yml |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| `backend/app/routers/signage_admin/__pycache__/schedules.cpython-311.pyc` | Stale `.pyc` referencing deleted `_fanout_schedule_changed` | ℹ️ Info | Build artifact; will be regenerated; no source pollution |

No TODO/FIXME/PLACEHOLDER stubs in modified source files. No hardcoded empty arrays in render paths. No `/api/signage/tags*` or `/api/signage/schedules*` literals remain in `backend/app/` (matches CI guard).

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| MIG-SIGN-01 | `signage_tags` CRUD via Directus; FastAPI route removed; FE swapped; SSE bridge verified | ✓ SATISFIED | tags.py deleted; signageApi tag fns use SDK; tag-silent SSE test added; CI guard locks pattern |
| MIG-SIGN-02 | `signage_schedules` CRUD via Directus; CHECK + Flow enforce `start<end`; SSE bridge; router removed | ✓ SATISFIED | schedules.py deleted; Alembic v1.23 + bootstrap §6; FE i18n mapping; schedule-changed SSE lifecycle test |

REQUIREMENTS.md still shows MIG-SIGN-01/02 as `- [ ]` checkbox un-ticked (line 388 of REQUIREMENTS.md), but the status table maps both to `Phase 68 | Complete`. Recommend the orchestrator tick the checkboxes to match the status table.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| No leftover tag/schedule routes in backend source | `grep -rn "/api/signage/tags\|/api/signage/schedules" backend/app/` | empty | ✓ PASS |
| `_fanout_schedule_changed` removed from source | `grep -rn "_fanout_schedule_changed" backend/` (excluding `.pyc` + test docstrings) | only docstring refs in test_pg_listen_sse.py + stale `.pyc` | ✓ PASS |
| Frontend tag/schedule fns use Directus SDK | grep `directus.request` in signageApi.ts for tag+schedule fns | 8 occurrences (4 tag + 4 schedule) | ✓ PASS |
| CI guard exists | grep guard literal in ci.yml | matches lines 99–113 | ✓ PASS |
| Alembic upgrade head succeeds | `alembic upgrade head` against live DB | not executed (no live stack) | ? SKIP |
| pytest signage suite passes | `pytest backend/tests/signage` | not executed | ? SKIP |
| Live Directus Flow rejects inverted range | `curl POST /items/signage_schedules` with start > end | not executed | ? SKIP |

### Human Verification Required

The plans for 02 and 08 explicitly mark live-stack assertions as DEFERRED. These require the docker compose stack and cannot be verified statically:

### 1. Alembic upgrade applies CHECK constraint cleanly

**Test:** Run `docker compose up -d` then `docker compose exec api alembic upgrade head`
**Expected:** Exits 0; `pg_constraint` shows `ck_signage_schedules_start_before_end` on `signage_schedules`
**Why human:** Requires running PostgreSQL + Alembic CLI; not present on host

### 2. Schedule pytest suite passes against live DB

**Test:** `docker compose exec api pytest backend/tests/signage/test_signage_schedule_check.py -x -q`
**Expected:** 5 tests pass; round-trip downgrade/upgrade clean
**Why human:** Tests skip without DB connection

### 3. Directus Flow rejects inverted-range writes with code

**Test:** With stack running and bootstrap-roles.sh applied, POST to `/items/signage_schedules` body `{playlist_id: <valid>, weekday_mask: 0x7F, start_hhmm: 900, end_hhmm: 600, priority: 1, enabled: true}` using Admin token.
**Expected:** HTTP 400 with `errors[0].message` containing `schedule_end_before_start`
**Why human:** Requires live Directus + Flow registration

### 4. Schedule lifecycle fires `schedule-changed` SSE within 500 ms

**Test:** Run `pytest backend/tests/signage/test_pg_listen_sse.py::test_directus_schedule_lifecycle_fires_sse_each_step`
**Expected:** create/update/delete each emit a `schedule-changed` frame within the 500 ms ceiling
**Why human:** Requires live Postgres LISTEN bridge + Directus + FastAPI SSE endpoint

### 5. Admin CRUD smoke against Directus passes

**Test:** Run `pytest backend/tests/signage/test_admin_directus_crud_smoke.py`
**Expected:** Admin JWT can create/read/update/delete on `signage_device_tags` and `signage_schedules` via Directus
**Why human:** Requires live Directus container + Admin token

### 6. Admin UI flow regression (visual)

**Test:** With stack running, log in as Admin; navigate to /signage/tags and /signage/schedules; create, rename, delete one of each. Submit a schedule with end < start and confirm translated inline error appears.
**Expected:** All operations succeed; reversed-range write blocked client-side; if client-side bypassed, server-side block surfaces translated message
**Why human:** Visual UX assertion + i18n rendering

### Gaps Summary

No automated gaps found. Phase 68 delivers all six core deliverables called out by the objective:

1. tags.py + schedules.py routers deleted ✓
2. Frontend signageApi swapped to Directus SDK ✓
3. DB CHECK constraint (Alembic v1.23 rename) ✓
4. Directus Flow for schedule validation (bootstrap-roles.sh §6) ✓
5. SSE regression coverage (schedule lifecycle + tag silence) ✓
6. CI grep guard (ci.yml lines 99–113) ✓
7. Admin permission smoke test (test_admin_directus_crud_smoke.py) ✓

The static surface achieves the phase goal. The remaining uncertainty is timing/runtime — items the plan summaries themselves flagged as DEFERRED until the live stack runs (Plans 02 and 08). Routing those to human verification rather than declaring a gap.

**Note:** REQUIREMENTS.md still has `- [ ]` unchecked checkboxes for MIG-SIGN-01/02 even though its status table marks both Complete. Recommend ticking the checkboxes for self-consistency.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
