---
phase: 51-schedule-schema-resolver
verified: 2026-04-21T00:00:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 51: Schedule Schema + Resolver Verification Report

**Phase Goal:** Extend the signage schema with a time-window-aware playlist resolver so operators can schedule different playlists at different times of day on different days of the week. Backward-compatible: existing always-on tag-to-playlist resolution still works when no schedule matches.

**Verified:** 2026-04-21
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (union across both plans)

| #   | Truth                                                                                                                                                               | Status     | Evidence                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `alembic upgrade head` creates `signage_schedules` with all 4 CHECK constraints + partial index; downgrade clean                                                    | ✓ VERIFIED | `backend/alembic/versions/v1_18_signage_schedules.py` L44-110 shows table create with 4 CHECK constraints (weekday_mask, start_hhmm, end_hhmm, no_midnight_span) + `ix_signage_schedules_enabled_weekday` partial index; downgrade drops all three |
| 2   | `app_settings.timezone` column added with default 'Europe/Berlin'                                                                                                   | ✓ VERIFIED | Migration L35 adds `timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'`; model `_base.py` updated                                                                                       |
| 3   | `zoneinfo.ZoneInfo('Europe/Berlin')` succeeds inside container (tzdata pip pkg present)                                                                             | ✓ VERIFIED | `backend/requirements.txt:17` → `tzdata>=2024.1`; SUMMARY reports verified inside rebuilt container                                                                                        |
| 4   | `resolve_schedule_for_device` returns best (priority DESC, updated_at DESC) matching schedule envelope or None                                                      | ✓ VERIFIED | `signage_resolver.py:113` implements single-query join w/ bindparam weekday bit-test, `LIMIT 1`, ordered by priority/updated_at; tests TC1/TC2 pass (9/9)                                 |
| 5   | `resolve_playlist_for_device` composes — schedule-first, tag-fallback                                                                                               | ✓ VERIFIED | `signage_resolver.py:216` → `scheduled = await resolve_schedule_for_device(db, device); if scheduled is not None: return scheduled`                                                        |
| 6   | All 7 SGN-TIME-03 resolver test cases pass + REQ3 worked example                                                                                                   | ✓ VERIFIED | 9 `@pytest.mark.asyncio` tests in `test_signage_schedule_resolver.py` covering all 7 TCs + updated_at tiebreak + REQ3; SUMMARY records 9/9 pass                                            |
| 7   | POST/GET/PATCH/DELETE under `/api/signage/schedules` — full CRUD                                                                                                    | ✓ VERIFIED | `schedules.py` L86/108/118/129/156 — 5 handlers; sub-router has NO `dependencies=` (inherits admin gate)                                                                                  |
| 8   | Schedule mutations fire `schedule-changed` SSE post-commit with exact payload `{event, schedule_id, playlist_id}`                                                   | ✓ VERIFIED | `schedules.py` `_fanout_schedule_changed` helper (L52-83) iterates playlist_ids, per-(device, playlist_id) emit; every commit precedes fanout (L100/147/166)                              |
| 9   | Schedule routes inherit admin gate (no per-sub-router dependency)                                                                                                   | ✓ VERIFIED | `grep -c 'dependencies=\[Depends' schedules.py` = 0; parent `__init__.py` declares `dependencies=[Depends(get_current_user), Depends(require_admin)]`                                    |
| 10  | Playlist DELETE returns 409 `{detail, schedule_ids}` on FK RESTRICT                                                                                                 | ✓ VERIFIED | `playlists.py:164` catches `IntegrityError`, rolls back, re-queries `SignageSchedule.id`, returns `JSONResponse(status_code=409, content={"detail": ..., "schedule_ids": [...]})`         |
| 11  | Non-admin 403 on all schedule endpoints (admin-gate-via-parent verified)                                                                                            | ✓ VERIFIED | `test_non_admin_403_on_all_schedule_endpoints` (router test #7) passes per SUMMARY                                                                                                         |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                                       | Expected                                                  | Exists | Substantive | Wired | Status     |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------ | ----------- | ----- | ---------- |
| `backend/alembic/versions/v1_18_signage_schedules.py`          | Migration w/ all CHECK + index + timezone column          | ✓ (3.6KB) | ✓        | ✓ (revision="v1_18_signage_schedules", down_revision="v1_16_signage_devices_etag") | ✓ VERIFIED |
| `backend/app/services/_hhmm.py`                                | Exports `hhmm_to_time`, `time_to_hhmm`, `now_hhmm_in_tz`  | ✓ (1.5KB) | ✓ (3 funcs) | ✓ (imported by signage_resolver.py L46) | ✓ VERIFIED |
| `backend/app/models/signage.py`                                | `SignageSchedule` class w/ 4 CheckConstraints             | ✓        | ✓ (L330 class present, `ck_signage_schedules_no_midnight_span` L359) | ✓ (imported by schedules.py L29, playlists.py L18) | ✓ VERIFIED |
| `backend/app/schemas/signage.py`                               | `ScheduleCreate/Update/Read` trio                         | ✓        | ✓ (L230/260/264/284) | ✓ (imported by schedules.py) | ✓ VERIFIED |
| `backend/app/services/signage_resolver.py`                     | `resolve_schedule_for_device` + composed wrapper + helper | ✓ (12KB) | ✓ (L59 `_build_envelope_for_playlist`, L113 new fn, L201 wrapper) | ✓ (existing callers unchanged) | ✓ VERIFIED |
| `backend/app/routers/signage_admin/schedules.py`               | CRUD router + fanout, no router-level deps                | ✓ (6.2KB) | ✓ (5 handlers, fanout helper) | ✓ (included by `__init__.py`) | ✓ VERIFIED |
| `backend/app/routers/signage_admin/__init__.py`                | Registers schedules alongside siblings                    | ✓        | ✓ (`from . import schedules`, `router.include_router(schedules.router)`) | ✓ | ✓ VERIFIED |
| `backend/app/routers/signage_admin/playlists.py`               | DELETE returns 409 with `schedule_ids`                    | ✓        | ✓ (IntegrityError handler, JSONResponse 409) | ✓ | ✓ VERIFIED |
| `backend/requirements.txt`                                     | tzdata pinned                                              | ✓        | ✓ (`tzdata>=2024.1`) | ✓ | ✓ VERIFIED |
| `backend/tests/test_signage_schema_roundtrip.py`               | Round-trip + CHECK enforcement                            | ✓ (18KB) | ✓ | N/A | ✓ VERIFIED |
| `backend/tests/test_signage_hhmm.py`                           | 13 unit tests                                              | ✓ (4.7KB) | ✓ (13 test fns) | N/A | ✓ VERIFIED |
| `backend/tests/test_signage_schedule_resolver.py`              | 7 SGN-TIME-03 cases + REQ3 worked example                 | ✓ (20KB) | ✓ (9 test fns) | N/A | ✓ VERIFIED |
| `backend/tests/test_signage_schedule_router.py`                | 9 CRUD + SSE + 409 tests                                   | ✓ (18KB) | ✓ (9 test fns) | N/A | ✓ VERIFIED |

### Key Link Verification

| From                                                     | To                                                                     | Via                                                                   | Status  | Evidence |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | -------- |
| `resolve_playlist_for_device`                            | `resolve_schedule_for_device`                                          | `scheduled = await resolve_schedule_for_device(db, device)`           | ✓ WIRED | `signage_resolver.py:216` |
| `resolve_schedule_for_device`                            | `_hhmm.now_hhmm_in_tz`                                                 | `weekday, hhmm = now_hhmm_in_tz(tz_name)`                            | ✓ WIRED | `signage_resolver.py:146` |
| `resolve_schedule_for_device`                            | `AppSettings.timezone`                                                  | `select(AppSettings).where(AppSettings.id == 1)` → `settings.timezone` | ✓ WIRED | `signage_resolver.py:140-143` |
| `schedules.py`                                            | `signage_broadcast.notify_device`                                      | `notify_device(did, {event:"schedule-changed", ...})`                 | ✓ WIRED | `schedules.py:30, L68` |
| `schedules.py`                                            | `devices_affected_by_playlist`                                         | `affected = await devices_affected_by_playlist(db, pid)`              | ✓ WIRED | `schedules.py:58` |
| `signage_admin/__init__.py`                               | `schedules.router`                                                      | `from . import schedules` + `router.include_router(schedules.router)` | ✓ WIRED | `__init__.py` L11, L22 |
| `playlists.delete_playlist`                               | FK RESTRICT 409 handler                                                 | `except IntegrityError: ... JSONResponse(409, {detail, schedule_ids})` | ✓ WIRED | `playlists.py:164-178` |

### Data-Flow Trace (Level 4)

N/A for this phase — backend-only schema/resolver/admin router. No frontend render surface introduced. Data-flow correctness verified via integration tests (resolver tests hit real asyncpg, router tests drive via httpx ASGITransport + monkeypatched `notify_device` spy).

### Behavioral Spot-Checks

SKIPPED (no runnable entry points invoked from verifier; container-level verification documented in SUMMARY — round-trip migration PASS, pytest suites PASS, zoneinfo resolve PASS inside api container).

### Requirements Coverage

| Requirement   | Source Plan | Description                                                                                    | Status       | Evidence |
| ------------- | ----------- | ---------------------------------------------------------------------------------------------- | ------------ | -------- |
| SGN-TIME-01   | 51-01       | Alembic migration `signage_schedules` w/ CHECK constraints + round-trip clean                  | ✓ SATISFIED | Migration file + schema roundtrip tests pass; all 4 CHECKs present (ck_signage_schedules_* names match REQ wording) |
| SGN-TIME-02   | 51-01       | Resolver gains time-window awareness; priority DESC, updated_at DESC; tag-fallback; `app_settings.timezone` default Europe/Berlin | ✓ SATISFIED | `resolve_schedule_for_device` + composed wrapper; timezone loaded from `AppSettings`; 8+ callsites unchanged (signature preserved) |
| SGN-TIME-03   | 51-01       | 7 resolver integration tests                                                                    | ✓ SATISFIED | 9 tests in `test_signage_schedule_resolver.py` (7 named + updated_at tiebreak + REQ3 worked example), all pass |
| SGN-TIME-04   | 51-02       | Schedule mutations fire `notify_device` SSE fanout; players re-resolve ≤ 2 s                   | ✓ SATISFIED (automated portion) / ? NEEDS HUMAN (real-device 2 s latency) | Fanout wired post-commit; SSE payload asserted in router tests. Real connected-player 2 s E2E is operator-level. |

Orphan check: `.planning/REQUIREMENTS.md` maps only SGN-TIME-01..04 to this phase; all four are covered by plan frontmatter (SGN-TIME-01..03 in 51-01, SGN-TIME-04 in 51-02). No orphans.

### Anti-Patterns Found

| File                                    | Line  | Pattern                                            | Severity | Impact |
| --------------------------------------- | ----- | -------------------------------------------------- | -------- | ------ |
| `backend/app/services/signage_resolver.py` | — | Pure-read invariant | ℹ️ Info  | `grep -cE 'db\.commit\|db\.add\|db\.delete'` = 0 — clean (D-10 preserved) |
| `backend/app/services/signage_resolver.py` | — | SQL parameterization | ℹ️ Info  | `grep -c 'f"(weekday_mask'` = 0; uses `bindparam("wd", value=weekday)` at L182 |
| `backend/app/routers/signage_admin/schedules.py` | — | Sub-router admin gate | ℹ️ Info  | `grep -c 'dependencies=\[Depends'` = 0 — inherits from parent (D-01) |

No blockers, no warnings. Known pre-existing `test_color_validator.py` ImportError is documented in both SUMMARYs as out-of-scope (Phase 41 `schemas.py → schemas/__init__.py` package conversion dropped `_validate_oklch` re-export) — unrelated to phase 51 work.

### Known Stubs

None. Both SUMMARYs explicitly state "Known Stubs: None" and the wiring check confirms: every handler is fully wired; every envelope path calls `_build_envelope_for_playlist`; FK handler returns actual schedule IDs from a live re-query.

### Human Verification Required

One item falls outside automated verification:

### 1. Real-device 2-second SSE propagation

**Test:** On a real Pi with player connected to `/signage/stream`, POST a new `signage_schedules` row that matches the Pi's tags. Measure time until `/playlist` is re-fetched and (if ETag changed) new playlist renders.
**Expected:** Event observed + re-resolve completes within ≤ 2 s of the POST's HTTP 201.
**Why human:** Requires a running backend + real player + network timing. In-test `notify_device` spy confirms the fanout call fires post-commit, but actual wire-level SSE delivery latency is operator-observed.

### Gaps Summary

No gaps. All 4 requirements satisfied, all 11 must-have truths verified (SGN-TIME-04's automated portion verified; the 2-second operator-observable latency carries a soft human-verification flag matching the REQUIREMENTS wording "within ≤ 2 s"). Backward compatibility preserved: `resolve_playlist_for_device` signature unchanged, 8+ callsites untouched, tag-based fallback path still covered by regression test `test_empty_schedules_fallback_to_tag_resolver` and the existing `test_signage_resolver.py` (14 pass, per SUMMARY). Migration round-trip verified; tzdata present in container; all SUMMARY-referenced commits (ee3f8fc, ba082d7, 0a81594, 52cfd39, 06b50b5) exist in `git log`.

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier)_
