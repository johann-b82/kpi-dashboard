---
phase: 43-media-playlist-device-admin-api-polling
plan: 04
type: execute
wave: 2
depends_on:
  - 43-01
  - 43-02
files_modified:
  - backend/app/routers/signage_player.py
  - backend/app/scheduler.py
  - backend/app/main.py
  - backend/tests/test_signage_player_router.py
  - backend/tests/test_signage_heartbeat_sweeper.py
autonomous: true
requirements:
  - SGN-BE-02
  - SGN-SCH-01
must_haves:
  truths:
    - "GET /api/signage/player/playlist with a valid device token returns 200 with PlaylistEnvelope"
    - "GET /api/signage/player/playlist with If-None-Match matching the current ETag returns 304 with empty body"
    - "GET /api/signage/player/playlist does NOT modify signage_devices.last_seen_at (D-10)"
    - "POST /api/signage/player/heartbeat returns 204 and updates last_seen_at/current_item_id/current_playlist_etag"
    - "POST /api/signage/player/heartbeat flips device.status from 'offline' to 'online'"
    - "APScheduler job signage_heartbeat_sweeper runs at 1-min interval with max_instances=1, coalesce=True"
    - "Sweeper flips devices with last_seen_at < now() - 5 min AND status != 'offline' AND revoked_at IS NULL to status='offline'"
  artifacts:
    - path: backend/app/routers/signage_player.py
      provides: "Player polling router (GET /playlist with ETag/304, POST /heartbeat)"
      contains: "Depends(get_current_device)"
    - path: backend/app/scheduler.py
      provides: "_run_signage_heartbeat_sweeper job registered at 1-min cadence"
      contains: "signage_heartbeat_sweeper"
    - path: backend/app/main.py
      provides: "signage_player_router included"
      contains: "signage_player"
  key_links:
    - from: backend/app/routers/signage_player.py
      to: backend/app/services/signage_resolver.py
      via: "resolve_playlist_for_device + compute_playlist_etag"
      pattern: "resolve_playlist_for_device"
    - from: backend/app/scheduler.py
      to: signage_devices.last_seen_at
      via: "UPDATE ... WHERE last_seen_at < now() - interval '5 min'"
      pattern: "last_seen_at"
---

<objective>
Implement the device-facing player polling router (SGN-BE-02) with ETag/304 caching (D-09), the heartbeat endpoint (D-11/D-12), and the 1-minute APScheduler heartbeat sweeper job (SGN-SCH-01, D-14/D-15). Wire the player router into main.py and register the sweeper alongside the existing signage_pairing_cleanup job.

Purpose: Close the polling-only feedback loop. Once this plan lands, a paired Pi can fetch its playlist, heartbeat its presence, and the server will accurately reflect online/offline state — all without SSE.

Output: New player router + extended scheduler + main.py wiring + two test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md
@backend/app/routers/signage_pair.py
@backend/app/security/device_auth.py
@backend/app/scheduler.py
@backend/app/main.py

<interfaces>
From backend/app/security/device_auth.py (Phase 42):
- `async def get_current_device(...) -> SignageDevice` — resolves Authorization: Bearer <device_token>; raises 401 on missing/invalid/revoked

From backend/app/services/signage_resolver.py (Plan 02):
- `async def resolve_playlist_for_device(db, device) -> PlaylistEnvelope`
- `def compute_playlist_etag(envelope: PlaylistEnvelope) -> str`

From backend/app/schemas/signage.py (Plan 02):
- PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest

Scheduler patterns (verified from backend/app/scheduler.py):
- `SENSOR_POLL_JOB_ID`, `_run_scheduled_sensor_poll` (v1.15)
- `_run_signage_pairing_cleanup` (Phase 42) — copy its shape
- Jobs registered inside `lifespan()` with `scheduler.add_job(...)`
- `timedelta`, `func`, `update`, `AsyncSessionLocal` already imported

From backend/app/models/signage.py:
- SignageDevice fields in use: id, status, last_seen_at, revoked_at, current_item_id, current_playlist_etag (Plan 01)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create signage_player router with /playlist (ETag/304) + /heartbeat and wire main.py</name>
  <files>backend/app/routers/signage_player.py, backend/app/main.py</files>
  <read_first>
    - backend/app/routers/signage_pair.py (current project idioms: imports, AsyncSession, get_async_db_session fixture name)
    - backend/app/security/device_auth.py (exact signature + return type of get_current_device)
    - backend/app/services/signage_resolver.py (Plan 02 — resolve_playlist_for_device and compute_playlist_etag)
    - backend/app/schemas/signage.py (HeartbeatRequest, PlaylistEnvelope)
    - backend/app/main.py (current include_router block)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-02, D-09, D-10, D-11, D-12
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md §"Pattern: ETag/304 for GET /playlist"
  </read_first>
  <action>
    Create `backend/app/routers/signage_player.py`:

    ```python
    """Phase 43 SGN-BE-02: device-facing polling endpoints.

    Per CONTEXT D-02: router-level `get_current_device` gate applies to every
    endpoint in this module. Only `/playlist` and `/heartbeat` land this phase;
    `/stream` (SSE) defers to Phase 45.
    """
    from __future__ import annotations

    from datetime import datetime, timezone

    from fastapi import APIRouter, Depends, Request, Response
    from sqlalchemy import update
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.database import get_async_db_session  # confirm exact name during read_first
    from app.models.signage import SignageDevice
    from app.schemas.signage import HeartbeatRequest, PlaylistEnvelope
    from app.security.device_auth import get_current_device
    from app.services.signage_resolver import (
        compute_playlist_etag,
        resolve_playlist_for_device,
    )

    router = APIRouter(
        prefix="/api/signage/player",
        tags=["signage-player"],
        dependencies=[Depends(get_current_device)],
    )


    @router.get("/playlist", response_model=None)
    async def get_device_playlist(
        request: Request,
        response: Response,
        device: SignageDevice = Depends(get_current_device),
        db: AsyncSession = Depends(get_async_db_session),
    ):
        """D-06/D-07/D-09/D-10: tag-resolved playlist with ETag/304.

        Does NOT update signage_devices.last_seen_at (D-10). Heartbeat owns presence.
        """
        envelope = await resolve_playlist_for_device(db, device)
        etag = compute_playlist_etag(envelope)
        quoted = f'"{etag}"'
        client_etag = request.headers.get("If-None-Match", "").strip()
        if client_etag and client_etag.strip('"') == etag:
            return Response(
                status_code=304,
                headers={"ETag": quoted, "Cache-Control": "no-cache"},
            )
        response.headers["ETag"] = quoted
        response.headers["Cache-Control"] = "no-cache"
        return envelope


    @router.post("/heartbeat", status_code=204)
    async def post_heartbeat(
        payload: HeartbeatRequest,
        device: SignageDevice = Depends(get_current_device),
        db: AsyncSession = Depends(get_async_db_session),
    ) -> Response:
        """D-11/D-12: update presence; 204 No Content."""
        now = datetime.now(timezone.utc)
        values: dict = {
            "last_seen_at": now,
            "current_item_id": payload.current_item_id,
            "current_playlist_etag": payload.playlist_etag,
        }
        if device.status == "offline":
            values["status"] = "online"
        await db.execute(
            update(SignageDevice)
            .where(SignageDevice.id == device.id)
            .values(**values)
        )
        await db.commit()
        return Response(status_code=204)
    ```

    IMPORTANT: before committing, verify the async DB session dep name in this project (likely `get_async_db_session` — check `backend/app/database.py` or whatever `signage_pair.py` imports). Use the EXACT symbol the rest of the codebase uses.

    **Wire main.py** — add near line 13:
    ```python
    from app.routers.signage_player import router as signage_player_router
    ```
    And include after `signage_admin_router` (Plan 03) line:
    ```python
    app.include_router(signage_player_router)
    ```

    FORBIDDEN in this file: `subprocess.run`, `subprocess.Popen`, `subprocess.call`, `import sqlite3`, `import psycopg2` (SGN-BE-10, enforced in Plan 05).

    No `require_admin`, no `get_current_user` in signage_player.py — the dep-audit test (Plan 05) asserts only `get_current_device` appears on these routes.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.main import app; player_paths=sorted({r.path for r in app.routes if r.path.startswith('/api/signage/player')}); print(player_paths); assert '/api/signage/player/playlist' in player_paths; assert '/api/signage/player/heartbeat' in player_paths"</automated>
  </verify>
  <acceptance_criteria>
    - File backend/app/routers/signage_player.py exists
    - grep -q "dependencies=\[Depends(get_current_device)\]" backend/app/routers/signage_player.py
    - grep -cE "require_admin|get_current_user" backend/app/routers/signage_player.py → 0
    - grep -E "subprocess\\.(run|Popen|call)|import sqlite3|import psycopg2" backend/app/routers/signage_player.py returns 0 matches
    - grep -q "Response(status_code=304" backend/app/routers/signage_player.py
    - grep -q "status_code=204" backend/app/routers/signage_player.py
    - grep -n "signage_player_router" backend/app/main.py returns ≥ 2 lines
    - `python -c "from app.main import app"` exits 0
    - `/api/signage/player/playlist` and `/api/signage/player/heartbeat` both appear in `app.routes`
  </acceptance_criteria>
  <done>Player router compiles and mounts, ETag/304 path + 204-heartbeat shape in place, device-token dep at router level.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Register signage_heartbeat_sweeper APScheduler job (SGN-SCH-01)</name>
  <files>backend/app/scheduler.py</files>
  <read_first>
    - backend/app/scheduler.py (entire file — find `_run_signage_pairing_cleanup` and its add_job registration; copy shape verbatim)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-14, D-15
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md §"Pattern: Heartbeat Sweeper"
  </read_first>
  <action>
    In `backend/app/scheduler.py`, mirror the `_run_signage_pairing_cleanup` + registration block verbatim.

    **Add module-level constant** near existing job-id constants (e.g., next to `SENSOR_POLL_JOB_ID` / pairing cleanup job id):
    ```python
    HEARTBEAT_SWEEPER_JOB_ID = "signage_heartbeat_sweeper"
    ```

    **Ensure imports** exist (most already in scheduler.py): `asyncio`, `update` from sqlalchemy, `func` from sqlalchemy, `timedelta` from datetime, `SignageDevice` from `app.models.signage`. Add any missing import at the top of the file (do not duplicate).

    **Add job function** near `_run_signage_pairing_cleanup`:
    ```python
    async def _run_signage_heartbeat_sweeper() -> None:
        """SGN-SCH-01 / D-15: flip stale devices to offline.

        Idempotent; excludes already-offline and revoked devices.
        """
        async with AsyncSessionLocal() as session:
            try:
                result = await asyncio.wait_for(
                    session.execute(
                        update(SignageDevice)
                        .where(
                            SignageDevice.last_seen_at
                            < func.now() - timedelta(minutes=5),
                            SignageDevice.status != "offline",
                            SignageDevice.revoked_at.is_(None),
                        )
                        .values(status="offline", updated_at=func.now())
                    ),
                    timeout=20,
                )
                await session.commit()
                log.info(
                    "signage_heartbeat_sweeper: flipped devices=%d",
                    result.rowcount,
                )
            except Exception:
                log.exception("signage_heartbeat_sweeper failed")
                await session.rollback()
    ```

    **Register in lifespan()** — inside the existing lifespan context, alongside the `signage_pairing_cleanup` add_job call, add:
    ```python
    scheduler.add_job(
        _run_signage_heartbeat_sweeper,
        trigger="interval",
        minutes=1,
        id=HEARTBEAT_SWEEPER_JOB_ID,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    ```

    If the `SignageDevice` model does not have an `updated_at` column (inspect model first), drop `updated_at=func.now()` from `.values(...)` and only set `status="offline"`. Do NOT invent a column.

    FORBIDDEN: any `subprocess.run`, `subprocess.Popen`, `subprocess.call`, `import sqlite3`, `import psycopg2` in scheduler.py (SGN-BE-10). The existing file already passes; don't introduce them here.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.scheduler import _run_signage_heartbeat_sweeper, HEARTBEAT_SWEEPER_JOB_ID; assert HEARTBEAT_SWEEPER_JOB_ID == 'signage_heartbeat_sweeper'; print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - grep -n "HEARTBEAT_SWEEPER_JOB_ID" backend/app/scheduler.py returns ≥ 2 lines
    - grep -n "_run_signage_heartbeat_sweeper" backend/app/scheduler.py returns ≥ 2 lines (def + add_job)
    - grep -q "minutes=1" backend/app/scheduler.py (at least for this job — may appear in other jobs as well)
    - grep -q "max_instances=1" backend/app/scheduler.py (existing + new)
    - grep -q "coalesce=True" backend/app/scheduler.py
    - grep -q "interval '5 minutes'\\|timedelta(minutes=5)" backend/app/scheduler.py
    - `python -c "from app.scheduler import _run_signage_heartbeat_sweeper"` exits 0
  </acceptance_criteria>
  <done>Sweeper job function + registration added; constant defined; existing jobs untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Tests for player router and heartbeat sweeper</name>
  <files>backend/tests/test_signage_player_router.py, backend/tests/test_signage_heartbeat_sweeper.py</files>
  <read_first>
    - backend/tests/test_signage_pair_router.py (async client + device-token header pattern)
    - backend/tests/test_device_auth.py (how to seed a device + issue a valid device token)
    - backend/tests/test_signage_pairing_cleanup.py (how the cleanup job is tested — mirror that for the heartbeat sweeper)
    - backend/tests/conftest.py (fixtures)
    - backend/app/routers/signage_player.py (Task 1)
    - backend/app/scheduler.py (Task 2)
  </read_first>
  <behavior>
    **test_signage_player_router.py** (≥ 6 tests):
    1. test_playlist_requires_device_token — GET /api/signage/player/playlist with no Authorization → 401
    2. test_playlist_rejects_user_jwt — GET with a regular Directus admin/viewer JWT (not a device token) → 401
    3. test_playlist_returns_envelope_for_device — valid device token + seeded playlist matching device's tag → 200 with JSON body having keys {playlist_id, name, items, resolved_at}; response has ETag header
    4. test_playlist_returns_304_on_matching_etag — two calls: first fetch ETag, second call with `If-None-Match: "<etag>"` → 304, body empty
    5. test_playlist_does_not_touch_last_seen_at — seed device with last_seen_at=None, call /playlist, assert device.last_seen_at still None (D-10)
    6. test_heartbeat_returns_204_and_updates_device — valid device token + body `{current_item_id: <uuid>, playlist_etag: "x"}` → 204; DB: last_seen_at updated to within last 5 seconds, current_item_id set, current_playlist_etag=="x"
    7. test_heartbeat_flips_offline_to_online — seed device with status="offline" → heartbeat → DB status=="online"
    8. test_heartbeat_requires_device_token — POST /heartbeat with no Authorization → 401

    **test_signage_heartbeat_sweeper.py** (≥ 3 tests):
    1. test_sweeper_flips_stale_device_to_offline — seed device with last_seen_at = now - 10 min, status="online", revoked_at=None → run `await _run_signage_heartbeat_sweeper()` → DB status=="offline"
    2. test_sweeper_ignores_fresh_device — seed device with last_seen_at = now - 1 min → run → status unchanged
    3. test_sweeper_ignores_revoked_device — seed device with last_seen_at = now - 10 min, revoked_at=now → run → status unchanged
    4. test_sweeper_idempotent_on_already_offline — seed device last_seen_at = now - 10 min, status="offline" → run → no error, rowcount==0 or status still "offline"
  </behavior>
  <action>
    Create `backend/tests/test_signage_player_router.py` using the async-client + device-token fixtures from `backend/tests/test_signage_pair_router.py` / `test_device_auth.py`. For each test, seed the minimum ORM rows (device, tags, map, playlist, items as needed), issue the HTTP call via the existing test client, and assert the documented outcomes.

    For test 4 (304), perform:
    ```python
    r1 = await client.get("/api/signage/player/playlist", headers={"Authorization": f"Bearer {tok}"})
    etag = r1.headers["ETag"]
    r2 = await client.get(
        "/api/signage/player/playlist",
        headers={"Authorization": f"Bearer {tok}", "If-None-Match": etag},
    )
    assert r2.status_code == 304
    assert r2.content == b""
    ```

    Create `backend/tests/test_signage_heartbeat_sweeper.py`. Import `_run_signage_heartbeat_sweeper` from `app.scheduler` and invoke it directly (no APScheduler spin-up — that's covered by sensor tests pattern; mirror `test_signage_pairing_cleanup.py` invocation style). Seed rows via `AsyncSessionLocal`, call the function, then re-SELECT and assert.

    TDD: run tests before implementation (Tasks 1+2) to confirm red; run after to confirm green. If Tasks 1/2 are already done in this execution window, write tests after and verify green.
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_player_router.py tests/test_signage_heartbeat_sweeper.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - Both test files exist
    - backend/tests/test_signage_player_router.py contains ≥ 8 test functions
    - backend/tests/test_signage_heartbeat_sweeper.py contains ≥ 3 test functions
    - `pytest backend/tests/test_signage_player_router.py backend/tests/test_signage_heartbeat_sweeper.py -x` exits 0
    - grep -q "If-None-Match" backend/tests/test_signage_player_router.py
    - grep -q "304" backend/tests/test_signage_player_router.py
    - grep -q "revoked_at" backend/tests/test_signage_heartbeat_sweeper.py
  </acceptance_criteria>
  <done>Player router + heartbeat sweeper fully tested; ETag/304 round-trip, heartbeat presence update, offline flip, and revoked-exclusion all proven.</done>
</task>

</tasks>

<verification>
- `curl -H "Authorization: Bearer <device_token>" /api/signage/player/playlist` returns 200 with envelope
- Repeating the curl with `If-None-Match: "<etag>"` returns 304
- `curl -X POST -H "Authorization: Bearer <device_token>" -d '{"current_item_id": null, "playlist_etag": null}' /api/signage/player/heartbeat` returns 204
- Scheduler: `python -c "from app.scheduler import _run_signage_heartbeat_sweeper, HEARTBEAT_SWEEPER_JOB_ID"` imports cleanly
- Tests green: `pytest backend/tests/test_signage_player_router.py backend/tests/test_signage_heartbeat_sweeper.py backend/tests/test_signage_resolver.py -x`
- No regression: `pytest backend/tests/test_signage_pair_router.py backend/tests/test_signage_pairing_cleanup.py -x`
</verification>

<success_criteria>
1. Player router enforces router-level `get_current_device`; no user-auth symbol leaks.
2. ETag/304 round-trip works end-to-end (empty body on 304).
3. Heartbeat updates last_seen_at / current_item_id / current_playlist_etag; flips offline→online; returns 204.
4. Sweeper flips stale devices to offline every minute, excludes already-offline and revoked (D-15 idempotency).
5. GET /playlist does NOT mutate last_seen_at (D-10).
</success_criteria>

<output>
After completion, create `.planning/phases/43-media-playlist-device-admin-api-polling/43-04-SUMMARY.md`
</output>
