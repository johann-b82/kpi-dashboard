---
phase: 43-media-playlist-device-admin-api-polling
verified: 2026-04-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 43: Media/Playlist/Device Admin API + Polling — Verification Report

**Phase Goal:** Admins can CRUD signage content and devices via FastAPI; devices can resolve their current playlist and heartbeat over plain polling — polling alone is a functionally complete player loop before SSE lands.
**Verified:** 2026-04-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin router-level gate: POST `/api/signage/playlists` requires admin JWT — 403 for Viewer, 401 for no JWT | ✓ VERIFIED | `backend/app/routers/signage_admin/__init__.py:13-17` defines router-level `Depends(get_current_user), Depends(require_admin)`. Tests `test_admin_can_create_playlist`, `test_viewer_cannot_create_playlist`, `test_no_jwt_cannot_create_playlist` pass. |
| 2 | Tag-to-playlist resolver: tag-matched device + two playlists at different priorities → GET `/api/signage/player/playlist` returns higher-priority items ordered | ✓ VERIFIED | `backend/app/services/signage_resolver.py` implements `priority DESC, updated_at DESC` ordering + `selectinload`; 10 resolver tests pass (including priority, tie-break, position ASC). Player router `signage_player.py:42-60` calls resolver and returns envelope. |
| 3 | Heartbeat + sweeper: POST `/api/signage/player/heartbeat` updates `last_seen_at`; APScheduler 1-min sweeper flips offline with `max_instances=1, coalesce=True` | ✓ VERIFIED | `signage_player.py:62-85` implements heartbeat with 204 + update; `scheduler.py:189-225` defines `_run_signage_heartbeat_sweeper`; `scheduler.py:354-361` registers job at `minutes=1, max_instances=1, coalesce=True`. 9 player tests + 6 sweeper tests pass. |
| 4 | Router dep-audit: every admin signage route has `require_admin`; every `/api/signage/player/*` has `get_current_device` | ✓ VERIFIED | `backend/tests/test_signage_router_deps.py` walks `app.routes` dependant trees. 3 dep-audit tests pass including `test_signage_admin_routes_have_require_admin` (found>0 admin routes) and `test_signage_player_routes_have_get_current_device` (found≥2). |
| 5 | CI grep guards: no `sqlite3`/`psycopg2`/`subprocess.run`/`subprocess.Popen` in backend/app signage modules | ✓ VERIFIED | `backend/tests/test_signage_ci_guards.py` — 4 tests pass. Independent grep verification: `rg '^import sqlite3\|^import psycopg2'` in `backend/app/` = 0 hits; `rg 'subprocess\.(run\|Popen\|call)'` in `backend/app/**signage**` = 0 hits. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/v1_16_signage_devices_etag.py` | Additive migration | ✓ VERIFIED | Contains `op.add_column` for `current_playlist_etag TEXT NULL`; `down_revision="v1_16_signage"` (note: Phase 41 used abbreviated rev id, plan spec said `v1_16_signage_schema` — actual Phase 41 revision is `v1_16_signage` so this is correct). |
| `backend/app/models/signage.py` | ORM `current_playlist_etag` | ✓ VERIFIED | Line 190: `current_playlist_etag: Mapped[str \| None] = mapped_column(Text, nullable=True)`. |
| `backend/app/services/signage_resolver.py` | `resolve_playlist_for_device` + `compute_playlist_etag` | ✓ VERIFIED | Both defined; uses `selectinload`, `priority.desc()`, `updated_at.desc()`, `limit(1)`; does not touch `last_seen_at`. |
| `backend/app/schemas/signage.py` | `PlaylistEnvelope`, `PlaylistEnvelopeItem`, `HeartbeatRequest` | ✓ VERIFIED | Importable; empty-envelope construction works. |
| `backend/app/routers/signage_admin/` | Parent router + 5 sub-routers + `main.py` wiring | ✓ VERIFIED | All 6 files present; `require_admin` appears only once at parent `__init__.py:16`; `main.py:15,31` imports & includes. |
| `backend/app/routers/signage_player.py` | Player router with device-token gate + ETag/304 + heartbeat | ✓ VERIFIED | `dependencies=[Depends(get_current_device)]` at router level; no `require_admin` or `get_current_user` symbols; ETag 304 branch present; heartbeat flips offline→online. |
| `backend/app/scheduler.py` | `_run_signage_heartbeat_sweeper` + `HEARTBEAT_SWEEPER_JOB_ID` | ✓ VERIFIED | Constant at line 42; function at 189; registration at 354 with `minutes=1`, `max_instances=1`, `coalesce=True`, `misfire_grace_time=30`; WHERE clause excludes `status="offline"` and `revoked_at IS NOT NULL`. |
| `backend/tests/test_signage_*.py` | 6 test files with ≥41 tests | ✓ VERIFIED | All present; 41 tests collected, 41 passed in 4.22s. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `signage_admin/__init__.py` | `directus_auth.require_admin` | `Depends(require_admin)` at parent | ✓ WIRED |
| `signage_player.py` | `signage_resolver.py` | `resolve_playlist_for_device + compute_playlist_etag` import + call | ✓ WIRED |
| `scheduler.py` | `signage_devices.last_seen_at` | `update(SignageDevice).where(last_seen_at < now - 5min)` | ✓ WIRED |
| `main.py` | `signage_admin` + `signage_player` routers | `include_router` at lines 30-31 | ✓ WIRED |
| `signage_resolver.py` | `SignagePlaylist.items` | `selectinload(SignagePlaylist.items).selectinload(SignagePlaylistItem.media)` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `signage_player.py` `/playlist` | `envelope` | `resolve_playlist_for_device(db, device)` → DB query over SignageDevice/Tag/Playlist joins | Yes (integration tests pass with real seeded data) | ✓ FLOWING |
| `signage_player.py` `/heartbeat` | `values` dict | Request payload + `datetime.now()` → `UPDATE signage_devices` | Yes (test asserts DB row updated) | ✓ FLOWING |
| `scheduler.py` sweeper | `result.rowcount` | `UPDATE signage_devices ... WHERE last_seen_at < now() - 5min` | Yes (test seeds stale device, asserts status flip) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signage routes registered | `app.routes` introspection via docker exec | 28 `/api/signage/*` routes listed (incl. pair, admin, player) | ✓ PASS |
| Phase 43 test suite | `pytest tests/test_signage_{resolver,admin_router,player_router,heartbeat_sweeper,router_deps,ci_guards}.py` | 41 passed in 4.22s | ✓ PASS |
| Regression (adjacent signage) | `pytest tests/test_signage_schema_roundtrip.py tests/test_signage_pair_router.py tests/test_signage_pairing_cleanup.py` | 21 passed in 2.90s | ✓ PASS |
| CI guards pass on live codebase | Grep tool: `^import sqlite3\|^import psycopg2` in backend/app/ | 0 hits | ✓ PASS |
| CI guards (signage subprocess) | Grep tool: `subprocess.(run\|Popen\|call)` in backend/app/**signage** | 0 hits | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SGN-BE-01 | 43-03 | Admin signage CRUD router with router-level `require_admin` | ✓ SATISFIED | `signage_admin/` package with 6 files; router-level gate; 9/9 router tests pass (admin/viewer/no-JWT matrix, 409-on-FK, bulk-replace items/tags) |
| SGN-BE-02 | 43-01, 43-04 | Player router with device-token gate — `/playlist` (ETag/304) + `/heartbeat` | ✓ SATISFIED | `signage_player.py` with 2 endpoints + migration for `current_playlist_etag`; 9/9 player tests pass (including 304, last_seen_at no-touch, offline→online flip) |
| SGN-BE-06 | 43-02 | Tag-to-playlist resolver with `priority DESC, updated_at DESC` LIMIT 1 | ✓ SATISFIED | `signage_resolver.py` + 10/10 tests pass including priority + tie-break + position ordering |
| SGN-BE-09 | 43-05 | Router dep-audit test | ✓ SATISFIED | `test_signage_router_deps.py` 3/3 tests pass with non-vacuous assertions |
| SGN-BE-10 | 43-05 | CI grep guards for sqlite3/psycopg2/subprocess | ✓ SATISFIED | `test_signage_ci_guards.py` 4/4 tests pass; independent grep confirms 0 hits |
| SGN-SCH-01 | 43-04 | APScheduler heartbeat sweeper (1-min, max_instances=1, coalesce=True) | ✓ SATISFIED | `scheduler.py` registration at minutes=1/max_instances=1/coalesce=True; 6/6 sweeper tests pass (stale flip, fresh skip, revoked skip, idempotency) |

**All 6 phase-declared requirement IDs satisfied.** REQUIREMENTS.md maps exactly these 6 IDs to Phase 43 (lines 138-143). Zero orphaned requirements.

### Anti-Patterns Found

None. Modified files scanned:
- `backend/app/routers/signage_admin/*.py` — no TODO/FIXME/placeholder
- `backend/app/routers/signage_player.py` — no empty handlers, no hardcoded returns
- `backend/app/services/signage_resolver.py` — no stubs
- `backend/app/scheduler.py` — uses real SQL update, logs rowcount
- Tests use proper async fixtures, assert real DB state

### Human Verification Required

None for this phase. All success criteria are programmatically verifiable and verified via the test suite + route introspection + grep guards. End-to-end polling flow with a real Raspberry Pi kiosk is a downstream phase concern.

### Gaps Summary

No gaps. Every must-have is wired end-to-end:
- Admin JWT gate enforced at router level with 401/403 matrix proven via tests
- Tag-to-playlist resolver returns the correct playlist with correct ordering
- ETag/304 round-trip proven (empty body on 304)
- Heartbeat updates presence and flips offline→online
- APScheduler sweeper registered with exact required parameters (minutes=1, max_instances=1, coalesce=True)
- Dep-audit and CI guard tests are non-vacuous (assert len(found) > 0 / ≥ 2 / ≥ 3)

Minor observation (not a gap):
- Plan 43-01 spec referenced `down_revision = "v1_16_signage_schema"` but actual Phase 41 revision id is `v1_16_signage`. The migration correctly uses `down_revision = "v1_16_signage"` so it chains properly — this is right per the actual alembic history.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
