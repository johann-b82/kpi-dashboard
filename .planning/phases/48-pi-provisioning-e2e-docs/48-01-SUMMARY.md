---
phase: 48-pi-provisioning-e2e-docs
plan: "01"
subsystem: pi-sidecar
tags: [sidecar, offline-resilience, fastapi, raspberry-pi, proxy-cache, etag]
dependency_graph:
  requires:
    - "backend/app/routers/signage_player.py (playlist + asset + heartbeat routes)"
    - "frontend/src/player/hooks/useSidecarStatus.ts (frozen probe contract)"
    - "frontend/src/player/lib/mediaUrl.ts (frozen rewrite logic)"
  provides:
    - "pi-sidecar/sidecar.py: FastAPI sidecar satisfying the Phase 47 player probe contract"
    - "GET /health → {ready, online, cached_items}"
    - "POST /token → persists device JWT to disk (0600)"
    - "GET /api/signage/player/playlist → ETag-aware proxy/cache"
    - "GET /media/{id} → cached bytes or upstream stream"
    - "Background heartbeat 60s, connectivity probe 10s, playlist refresh 30s"
  affects:
    - "Phase 48-02 (provision script) — installs pi-sidecar/ into /opt/signage/sidecar"
    - "Phase 48-04 (E2E walkthrough) — sidecar is the offline-resilience gate"
tech_stack:
  added:
    - "fastapi==0.115.12 (pi-sidecar venv only)"
    - "uvicorn==0.34.0 (pi-sidecar venv only)"
    - "httpx==0.28.1 (pi-sidecar venv only)"
  patterns:
    - "Single-file FastAPI app with lifespan context manager for background tasks"
    - "Module-level state for single-device sidecar (_device_token, _online, _playlist_body, _playlist_etag, _cached_media_ids)"
    - "TDD: tests written first (RED), then implementation (GREEN), 21/21 passing"
key_files:
  created:
    - pi-sidecar/sidecar.py
    - pi-sidecar/requirements.txt
    - pi-sidecar/README.md
    - pi-sidecar/tests/__init__.py
    - pi-sidecar/tests/conftest.py
    - pi-sidecar/tests/test_sidecar.py
  modified: []
decisions:
  - "Module-level state (not class) for single-device sidecar — simplest correct design for a process serving exactly one kiosk"
  - "lifespan context manager (not deprecated @app.on_event) for background task lifecycle"
  - "respx used for httpx mocking in tests (not monkeypatch) — cleaner URL-based mock DSL"
  - "Token overwritten on each POST /token; os.chmod(0o600) called after every write to preserve permissions after overwrite"
  - "_load_cached_media_ids() called at lifespan startup — media set reconstructed from disk, not from module state"
  - "test for _health_with_token_and_online writes actual files to tmp media dir so lifespan loads them correctly"
  - "Media pruning implemented as async _prune_media_cache(new_ids) coroutine; called from playlist route + background refresh"
metrics:
  duration: 263s
  completed: "2026-04-20"
  tasks_completed: 3
  files_created: 6
  tests_total: 21
  tests_passing: 21
  pass_rate: "100%"
---

# Phase 48 Plan 01: Pi Sidecar Service Summary

**One-liner:** Single-file FastAPI offline-resilience sidecar with ETag-aware playlist proxy, media byte cache, 0600 token file, and 3-background-task lifecycle on `127.0.0.1:8080`.

## What Was Built

A new top-level directory `pi-sidecar/` containing the Raspberry Pi sidecar service. The sidecar satisfies the frozen Phase 47 player contract (`window.signageSidecarReady` + `http://localhost:8080/health` probe) and closes Phase 47 D-7 (SW scope blocks `/api/*` runtime caching).

### Routes Contracted and Verified

| Route | Status | Contract |
|-------|--------|---------|
| `GET /health` | Verified | Always 200. `{ready: bool, online: bool, cached_items: int}`. `ready=false` without token (Pitfall 11 — still exits 200). |
| `POST /token` | Verified | Accepts `{"token": "<jwt>"}`, writes to `SIGNAGE_CACHE_DIR/device_token` mode 0600, returns `{"accepted": true}`. |
| `GET /api/signage/player/playlist` | Verified | ETag-aware proxy. Online: forwards If-None-Match, caches 200 responses, returns upstream 304 as cached body. Offline: serves cache or 503. Client ETag match → 304. |
| `GET /media/{id}` | Verified | Cache hit → FileResponse. Cache miss + online → proxy + persist. Cache miss + offline → 404. |
| Heartbeat (background task) | Verified | 60s interval, `POST /api/signage/player/heartbeat`, bearer token, fire-and-forget errors. |

### ETag Round-Trip

- Online: sidecar sends cached ETag to upstream via `If-None-Match`; upstream 304 → serve cached body; upstream 200 → update cache, serve new body.
- Offline: cached body returned with cached ETag in `ETag:` header; client If-None-Match match → 304.
- ETag value stored without quotes in `playlist.etag`; sent/compared with quotes in headers.

### Offline Fallback

- Upstream unreachable (ConnectError / timeout) → fall through to offline path.
- Cache present → 200 with cached body. No cache → 503 (playlist) or 404 (media).
- Background probe: 3 consecutive `/api/health` failures flip `_online=False`; any success flips `_online=True`.

### Media Pruning (Pitfall 9)

After each successful playlist refresh, `_prune_media_cache(new_ids)` deletes files in `SIGNAGE_CACHE_DIR/media/` whose UUID is not in the new envelope's `items[].media_id` set. New media IDs are pre-fetched via `asyncio.create_task(_prefetch_media(...))`.

### Sidecar Version

Git SHA of sidecar.py: `955e6bb` (commit `feat(48-01): implement Pi sidecar with offline-resilient playlist + media proxy`)

### RSS-at-Rest Measurement

**DEFER to Phase 48-05 Pi E2E measurement** — no Pi hardware available during this plan execution. Expected: ~45–55 MB based on RESEARCH §1 (FastAPI + uvicorn, 1 worker, asyncio).

## Test Results

```
21 passed in 0.13s
```

- Task 1 (health + token): 8 tests
- Task 2 (playlist proxy + ETag): 7 tests
- Task 3 (media + heartbeat + pruning): 6 tests

All run without Pi hardware using `respx` for httpx mocking and `tmp_path` for SIGNAGE_CACHE_DIR isolation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test_health_with_token_and_online initially failed because lifespan resets _cached_media_ids from disk**

- **Found during:** Task 1 TDD GREEN phase
- **Issue:** Test set `sc._cached_media_ids = {"id1", "id2"}` in memory, but TestClient enter triggers lifespan which calls `_load_cached_media_ids()` from disk, reading an empty media dir and resetting the set to `set()`.
- **Fix:** Test now writes actual files to `cache/media/id1` and `cache/media/id2` before entering the TestClient context, so lifespan loads them from disk correctly.
- **Files modified:** `pi-sidecar/tests/test_sidecar.py`
- **Commit:** 955e6bb (same commit, fixed inline before final commit)

### Out-of-scope items

None discovered.

## Known Stubs

None. All routes return real data; media cache and playlist cache are fully wired.

## Self-Check: PASSED

- `pi-sidecar/sidecar.py` exists: FOUND
- `pi-sidecar/requirements.txt` exists: FOUND
- `pi-sidecar/README.md` exists: FOUND
- `pi-sidecar/tests/test_sidecar.py` exists: FOUND
- `pi-sidecar/tests/conftest.py` exists: FOUND
- `pi-sidecar/tests/__init__.py` exists: FOUND
- Commit `955e6bb` exists: FOUND
- 21/21 tests pass: VERIFIED
