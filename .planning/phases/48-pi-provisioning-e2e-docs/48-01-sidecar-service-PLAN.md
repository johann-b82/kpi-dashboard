---
phase: 48-pi-provisioning-e2e-docs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pi-sidecar/sidecar.py
  - pi-sidecar/requirements.txt
  - pi-sidecar/README.md
  - pi-sidecar/tests/test_sidecar.py
  - pi-sidecar/tests/conftest.py
autonomous: true
requirements: [SGN-OPS-03]
must_haves:
  truths:
    - "Running `uvicorn sidecar:app` binds 127.0.0.1:8080 only; GET /health returns {ready, online, cached_items}"
    - "GET /api/signage/player/playlist online-path forwards Authorization+If-None-Match upstream and stores body+ETag under SIGNAGE_CACHE_DIR"
    - "GET /api/signage/player/playlist offline-path returns cached body+ETag with 304 support via If-None-Match"
    - "GET /media/{id} streams from cache dir when present; otherwise proxies backend asset passthrough and persists"
    - "POST /token accepts {token}, persists to SIGNAGE_CACHE_DIR/device_token mode 0600, returns {accepted:true}"
    - "Background heartbeat task posts /api/signage/player/heartbeat every 60s when online (closes SGN-PLY-05 at the Pi layer per RESEARCH §2)"
    - "pytest runs under pi-sidecar/ without Pi hardware — monkeypatches httpx + tmp SIGNAGE_CACHE_DIR"
  artifacts:
    - path: pi-sidecar/sidecar.py
      provides: "Single-file FastAPI sidecar (/health, /api/signage/player/playlist, /media/{id}, /token, background tasks)"
    - path: pi-sidecar/requirements.txt
      provides: "fastapi==0.115.12, uvicorn==0.34.0, httpx==0.28.1 pin set (RESEARCH §3)"
    - path: pi-sidecar/tests/test_sidecar.py
      provides: "Hardware-free unit+integration tests covering all five routes + offline fallback + ETag 304"
    - path: pi-sidecar/README.md
      provides: "Run/dev instructions; documents SIGNAGE_API_BASE + SIGNAGE_CACHE_DIR env"
  key_links:
    - from: pi-sidecar/sidecar.py
      to: "{SIGNAGE_API_BASE}/api/signage/player/playlist"
      via: "httpx.AsyncClient with If-None-Match"
      pattern: "httpx\\.AsyncClient"
    - from: pi-sidecar/sidecar.py
      to: "{SIGNAGE_CACHE_DIR}/{playlist.json,playlist.etag,device_token,media/}"
      via: "anyio.Path / os.chmod(0o600)"
      pattern: "SIGNAGE_CACHE_DIR"
---

<objective>
Implement the Raspberry Pi offline-resilience sidecar as a single-file FastAPI app at `pi-sidecar/sidecar.py`. Closes Phase 47 D-7 (SW-scope runtime-cache gap) by moving runtime caching for the playlist envelope and media bytes onto the Pi. Provides the HTTP contract the Phase 47 player already probes for via `window.signageSidecarReady` + `http://localhost:8080/health`.

Purpose: The sidecar is the linchpin of v1.16's 5-minute offline target. It proxy-caches `/api/signage/player/playlist` (ETag-aware) and `/media/<id>` (bytes), serves cached content when upstream is unreachable, accepts the device JWT from the player via `POST /token`, and owns the 60s heartbeat (SGN-PLY-05 deferred by Phase 47 VERIFICATION.md).
Output: `pi-sidecar/` top-level directory (new) with the service, pinned requirements, README, and a hardware-free pytest suite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
@.planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
@backend/app/routers/signage_player.py
@frontend/src/player/hooks/useSidecarStatus.ts
@frontend/src/player/lib/mediaUrl.ts
</context>

<interfaces>
<!-- Frozen sidecar contract expected by Phase 47 player (do NOT break these) -->

From frontend/src/player/hooks/useSidecarStatus.ts:
- Probes `http://localhost:8080/health` with 200ms timeout
- Expects JSON body `{ online: boolean }` on 200 OK
- `online: true`  → chip hidden (sidecar healthy)
- `online: false` → chip visible (sidecar present, backend unreachable)
- `!ok` or thrown  → treated as 'unknown' (no sidecar)

From frontend/src/player/lib/mediaUrl.ts:
- When `window.signageSidecarReady === true`, rewrites to `http://localhost:8080/media/<media_id>`
- Otherwise falls back to backend `/api/signage/player/asset/<id>?token=…` (Phase 47 DEFECT-5)

Upstream backend (unchanged, do not proxy blindly):
- `GET  /api/signage/player/playlist`    — Authorization: Bearer <device_token>; returns PlaylistEnvelope + ETag
- `GET  /api/signage/player/asset/{id}`  — ?token=<device_token> query auth; streams bytes
- `POST /api/signage/player/heartbeat`   — Authorization: Bearer <device_token>; body {current_item_id?}
- `GET  /api/health`                     — public, used only for connectivity probe
</interfaces>

<pitfalls_inherited>
From 48-RESEARCH.md §11 — copied forward because they bind this plan's implementation:

- **Pitfall 6 (ProtectSystem=strict + venv):** Ensure the venv is compiled at provision time; sidecar must NOT write to `/opt/signage/sidecar/`. All writes go to `SIGNAGE_CACHE_DIR` (defaults `/var/lib/signage/`).
- **Pitfall 9 (media cache grows unbounded):** On each successful upstream playlist refresh, prune `SIGNAGE_CACHE_DIR/media/<uuid>` files whose UUID is not present in the new envelope. Implement in the background refresh task.
- **Pitfall 11 (sidecar-restart token re-post):** On cold start without a persisted `device_token`, `/health` MUST return `{ready: false, online: false, cached_items: 0}` but still exit 200 — the player's probe must succeed so useSidecarStatus can transition correctly.
- **Pitfall 12 (token file permissions):** After writing `device_token`, call `os.chmod(path, 0o600)` explicitly; default umask leaks the JWT.
- **Anti-pattern (§Architecture Patterns):** Never `await` media downloads inside a route handler. Pre-fetch via `asyncio.create_task`. Route handlers serve from cache only; if cache miss + online, stream through `httpx.AsyncClient.stream` into a `FileResponse`-wrapped temp file.
</pitfalls_inherited>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Sidecar scaffolding + /health + /token + tests</name>
  <files>pi-sidecar/sidecar.py, pi-sidecar/requirements.txt, pi-sidecar/README.md, pi-sidecar/tests/__init__.py, pi-sidecar/tests/conftest.py, pi-sidecar/tests/test_sidecar.py</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §1 Unknown 1+2 (FastAPI choice, token handoff)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §2 (HTTP routes table + on-disk layout)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md D-1, D-2, D-6
  </read_first>
  <behavior>
    - Test: `GET /health` with empty cache + no token → 200 `{ready: false, online: false, cached_items: 0}`
    - Test: `GET /health` with token present + upstream mocked 200 → 200 `{ready: true, online: true, cached_items: N}`
    - Test: `POST /token {"token":"abc"}` → 200 `{accepted: true}`; token file written at `SIGNAGE_CACHE_DIR/device_token` mode 0o600
    - Test: `POST /token` overwrites prior token; file permissions remain 0o600
    - Test: on startup, sidecar reads existing `device_token` file into memory
    - Test: CORS / host binding — uvicorn config documented in README (binds 127.0.0.1 only)
  </behavior>
  <action>
    Create `pi-sidecar/` at repo root with:

    `pi-sidecar/requirements.txt` — verbatim from RESEARCH §3:
    ```
    fastapi==0.115.12
    uvicorn==0.34.0
    httpx==0.28.1
    ```

    `pi-sidecar/sidecar.py` — single-file FastAPI app with this skeleton:
    - Env: `SIGNAGE_API_BASE` (required at runtime; tests inject), `SIGNAGE_CACHE_DIR` (default `/var/lib/signage`)
    - On startup: ensure cache dirs exist; read `device_token` if present into module-level state; start background tasks (stubbed in Task 1, implemented in Tasks 2-3)
    - Routes in this task: `GET /health`, `POST /token`
    - `POST /token` writes `{cache_dir}/device_token` then `os.chmod(path, 0o600)` (Pitfall 12)
    - `GET /health` returns `{ready: <token-present>, online: <last-probe-result>, cached_items: <len(cached_media)>}` — always 200

    `pi-sidecar/tests/conftest.py`:
    - `tmp_cache_dir` fixture: monkeypatches `SIGNAGE_CACHE_DIR` to tmp path
    - `client` fixture: `fastapi.testclient.TestClient(app)` with tmp cache dir + mocked `SIGNAGE_API_BASE=http://upstream.test`

    `pi-sidecar/tests/test_sidecar.py` — TDD: write the 6 tests from `<behavior>` FIRST, confirm RED, then implement.

    `pi-sidecar/README.md` — dev/run instructions:
    ```
    # Pi sidecar

    Runs on the Raspberry Pi at 127.0.0.1:8080 to proxy-cache the KPI
    Dashboard signage player endpoints.

    ## Dev
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    SIGNAGE_API_BASE=http://localhost:8000 SIGNAGE_CACHE_DIR=/tmp/signage-cache \
      .venv/bin/uvicorn sidecar:app --host 127.0.0.1 --port 8080

    ## Test
    .venv/bin/pip install pytest httpx
    .venv/bin/pytest tests/
    ```

    Do NOT implement playlist proxy, media proxy, or heartbeat in this task — stubs/TODOs OK. Those land in Tasks 2-3.
  </action>
  <verify>
    <automated>cd pi-sidecar && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest && .venv/bin/pytest tests/ -v</automated>
  </verify>
  <done>
    `pi-sidecar/` directory exists with scaffolding. `GET /health` and `POST /token` return the contracted shapes. All 6 behavior tests pass. Token file is mode 0o600.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Playlist proxy with ETag handling + background poll + online/offline probe</name>
  <files>pi-sidecar/sidecar.py, pi-sidecar/tests/test_sidecar.py</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §2 "ETag Handling (Detailed)" + "Refresh Semantics"
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §1 Unknown 3 (ETag determinism)
    - backend/app/services/signage_resolver.py compute_playlist_etag (lines 179-196) for reference
  </read_first>
  <behavior>
    - Test: online mode — upstream returns 200 + ETag `"abc"` + body {envelope}; sidecar caches body+ETag and returns 200 to client
    - Test: online mode, client sends `If-None-Match: "abc"` matching cache → sidecar returns 304 (no body)
    - Test: online mode, sidecar sends cached ETag to upstream; upstream 304 → sidecar returns cached body/etag to client
    - Test: offline mode — upstream raises httpx.ConnectError; sidecar returns cached body + cached ETag with status 200
    - Test: offline + client If-None-Match matches cache → 304
    - Test: offline + no cache present → 503 with `{detail: "no cache and upstream unreachable"}`
    - Test: background connectivity probe — mock upstream /api/health failing 3x flips `online=false` in /health response
  </behavior>
  <action>
    Extend `sidecar.py`:

    1. Module-level state: `_online: bool`, `_device_token: str|None`, `_playlist_body: bytes|None`, `_playlist_etag: str|None`
    2. `GET /api/signage/player/playlist` handler:
       - If `_device_token` is None → 401 `{detail: "no device token"}`
       - If `_online`: httpx.AsyncClient call with `Authorization: Bearer <token>` + pass-through `If-None-Match` header. On 200: store body+ETag to disk (`playlist.json`, `playlist.etag`) AND in-memory; return 200 with ETag header. On 304: return cached body (or 304 if client ETag matches). On httpx error: fall through to offline.
       - Offline branch: if cache present → return cached body+ETag (304 if client ETag matches); else → 503
    3. Connectivity probe background task: every 10s `GET {API_BASE}/api/health`. 3 consecutive failures flip `_online=False`; any success flips `_online=True`.
    4. Playlist refresh background task: every 30s when online, send `If-None-Match: <cached_etag>` to upstream; on 200, update cache and schedule media pre-fetch (Task 3).
    5. Media pruning (Pitfall 9): on each successful refresh, iterate `cache_dir/media/` and delete files whose UUID is not in the new envelope's `items[].media_id` set.

    Tests must mock `httpx.AsyncClient.get` via `respx` or `monkeypatch`.

    Register task startup/shutdown via FastAPI `lifespan=` context manager (NOT deprecated `@app.on_event`).
  </action>
  <verify>
    <automated>cd pi-sidecar && .venv/bin/pip install respx && .venv/bin/pytest tests/ -v -k "playlist or probe or etag"</automated>
  </verify>
  <done>
    All 7 playlist/probe behavior tests pass. Cache files are written to tmp dir during tests. Background tasks start and stop cleanly with lifespan.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Media passthrough + cache + heartbeat background task</name>
  <files>pi-sidecar/sidecar.py, pi-sidecar/tests/test_sidecar.py</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §2 "Refresh Semantics" (media on-demand), §Architecture Patterns (no blocking downloads)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §11 Pitfall 9 (unbounded growth) + §Anti-Patterns
    - backend/app/routers/signage_player.py (asset passthrough route + heartbeat route contracts)
  </read_first>
  <behavior>
    - Test: `GET /media/{id}` with file present in cache → streams file bytes, status 200, correct Content-Type if known
    - Test: `GET /media/{id}` cache miss + online → sidecar streams from upstream `/asset/{id}?token=<t>`, persists to cache, returns bytes
    - Test: `GET /media/{id}` cache miss + offline → 404 (no fallback possible without bytes)
    - Test: heartbeat task fires every 60s, POSTs `/api/signage/player/heartbeat` with bearer token; failure is silent (fire-and-forget)
    - Test: heartbeat is NOT posted when `_device_token is None`
    - Test: media pruning — after playlist refresh removes media_id X, a subsequent `GET /media/X` cache-miss path is exercised
  </behavior>
  <action>
    Extend `sidecar.py`:

    1. `GET /media/{media_id}` handler:
       - If cached file exists at `{cache_dir}/media/{media_id}` → return `FileResponse(path)` (FastAPI handles streaming)
       - Else if `_online` and `_device_token`: open `httpx.AsyncClient.stream("GET", f"{API_BASE}/api/signage/player/asset/{id}?token={token}")`, write to temp file, move to cache path, then `FileResponse` (do NOT block — use `asyncio.to_thread` for the rename)
       - Else: 404 `{detail: "media unavailable offline"}`
    2. Heartbeat background task (lifespan-managed): every 60s, if `_device_token` set, POST `{API_BASE}/api/signage/player/heartbeat` with `Authorization: Bearer <token>`. Catch and log all exceptions; never let a failure kill the task.
    3. Playlist-refresh hook extension: after a successful refresh, schedule `asyncio.create_task(prefetch_media(...))` for every media_id not yet in cache — do NOT await.

    Update README with the /media route and cache-dir layout from RESEARCH §2.
  </action>
  <verify>
    <automated>cd pi-sidecar && .venv/bin/pytest tests/ -v</automated>
  </verify>
  <done>
    All behavior tests in Tasks 1-3 pass (13+ tests total). `pytest tests/ -v` exits 0. Sidecar runs cleanly with `uvicorn sidecar:app` and survives a curl sequence to all 5 routes.
  </done>
</task>

</tasks>

<verification>
- `cd pi-sidecar && .venv/bin/pytest tests/ -v` exits 0 with ≥13 passing tests.
- `grep -E "signageSidecarReady|online: boolean" pi-sidecar/sidecar.py README.md` confirms `/health` body shape.
- `python3 -c "import ast; ast.parse(open('pi-sidecar/sidecar.py').read())"` — file is syntactically valid.
- Token file permissions verified (0o600) by a test.
</verification>

<success_criteria>
- Sidecar implements all five routes from RESEARCH §2 (/health, /api/signage/player/playlist, /media/{id}, POST /token, heartbeat background task — no route for heartbeat, it's a task).
- ETag round-trip works: If-None-Match matches → 304; mismatch → 200 with new body.
- Offline fallback: upstream unreachable + cache present → serves cache; no cache → 503 (playlist) or 404 (media).
- Media cache pruning implemented per Pitfall 9.
- Tests run without Pi hardware; only requires `pytest`, `httpx`, `respx`.
</success_criteria>

<output>
After completion, create `.planning/phases/48-pi-provisioning-e2e-docs/48-01-SUMMARY.md` per the GSD template. Must record:
- Sidecar version (git SHA of sidecar.py)
- Test count + pass rate
- RSS-at-rest measurement if run locally (`ps aux | grep uvicorn` in MB) — otherwise flag DEFER to Phase 48-05 Pi E2E measurement
- Routes contracted and verified
</output>

<files_to_read>
- .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
- .planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
- backend/app/routers/signage_player.py
- backend/app/services/signage_resolver.py
- frontend/src/player/hooks/useSidecarStatus.ts
- frontend/src/player/lib/mediaUrl.ts
- CLAUDE.md
</files_to_read>
