# Phase 43: Media + Playlist + Device Admin API (polling) — Research

**Researched:** 2026-04-18
**Domain:** FastAPI admin CRUD routers, tag-based playlist resolver, player polling endpoints (ETag/304), APScheduler heartbeat sweeper, dep-audit test, CI grep guards
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Admin routes in per-resource split package `backend/app/routers/signage_admin/` with `media.py`, `playlists.py`, `playlist_items.py`, `devices.py`, `tags.py`, `__init__.py` exposing a parent `APIRouter(prefix="/api/signage", dependencies=[Depends(get_current_user), Depends(require_admin)])`. `require_admin` appears exactly once (on the parent router).

**D-02:** Player routes in single `backend/app/routers/signage_player.py`. Router-level dep is `Depends(get_current_device)`. Only `GET /playlist` and `POST /heartbeat` land this phase; `GET /stream` (SSE) defers to Phase 45.

**D-03:** `backend/app/main.py` includes signage_admin parent router + signage_player router alongside the existing signage_pair router.

**D-04:** `backend/tests/test_signage_router_deps.py` — dep-audit test. `PUBLIC_SIGNAGE_ROUTES = {"/api/signage/pair/request", "/api/signage/pair/status"}`. For every `/api/signage` route: skip if in allow-list, else if player path assert `get_current_device`, else assert `require_admin`.

**D-05:** Allow-list is a module-level constant with a comment pointing to Phase 42 plan 02 SUMMARY. Future public routes require explicit allow-list entry.

**D-06:** No-match semantics: 200 with `{playlist_id: null, name: null, items: [], resolved_at: <iso>}`.

**D-07:** Successful match envelope: `{playlist_id: uuid, name: str, items: [{media_id, kind, uri, duration_ms, transition, position}, ...], resolved_at: iso}`. Items ordered by `signage_playlist_items.position ASC`.

**D-08:** Tag resolution: enabled playlists intersecting device tags, `priority DESC, updated_at DESC`, LIMIT 1. (SGN-BE-06)

**D-09:** ETag + If-None-Match caching. ETag = SHA256 of deterministic tuple. Player sends `If-None-Match`; 304 on match. Response always carries `ETag` and `Cache-Control: no-cache`.

**D-10:** `GET /playlist` does NOT update `last_seen_at` (heartbeat's job only).

**D-11:** Heartbeat payload: `{current_item_id: uuid | null, playlist_etag: str | null}`. Updates: `last_seen_at = now()`, `current_item_id`, `current_playlist_etag`. Status flip `offline → online` on successful heartbeat.

**D-12:** Heartbeat response is 204 No Content.

**D-13:** Deferred telemetry fields (`free_disk_mb`, `chromium_uptime_s`, `last_error`) out of scope.

**D-14:** APScheduler job `signage_heartbeat_sweeper`, `IntervalTrigger(minutes=1)`, `coalesce=True`, `max_instances=1`, `misfire_grace_time=30`, `asyncio.wait_for(..., timeout=20)`. Mirrors v1.15 sensor_poll pattern.

**D-15:** Sweeper SQL: `UPDATE signage_devices SET status='offline', updated_at=now() WHERE last_seen_at < now() - interval '5 minutes' AND status != 'offline' AND revoked_at IS NULL`

**D-16:** Hard delete for media. `DELETE /media/{id}` → 404 (not found) / 409 (in use, with `{detail, playlist_ids}`) / 204 (success + FS cleanup). FS cleanup via post-commit `pathlib.Path(...).rmtree(missing_ok=True)` in try/except that logs WARNING but does not roll back.

**D-17:** Bulk-replace for playlist items reorder: `PUT /api/signage/playlists/{id}/items` with `{items: [{media_id, position, duration_ms, transition}]}`. Single transaction: DELETE old rows, INSERT new. Returns 200 with new item list.

**D-18:** Bulk-replace for tag assignment:
- `PUT /api/signage/devices/{id}/tags` body `{tag_ids: [uuid, ...]}`
- `PUT /api/signage/playlists/{id}/tags` body `{tag_ids: [uuid, ...]}`
Both: DELETE existing map rows, INSERT new rows, single transaction. Idempotent.

**D-19:** Admin GET endpoints return full lists without pagination (≤5 devices, <100 media items).

**D-20:** Flat JSON responses, no `{data: ...}` wrapper. Errors use FastAPI default `{detail: "..."}`.

**D-21:** Upload shape for `POST /api/signage/media`: planner picks between (a) multipart UploadFile → Directus uploads volume, or (b) Directus-asset-UUID-only flow. Decision must land in PLAN.

### Claude's Discretion

- Exact Pydantic schema field names beyond what D-06/D-07/D-11 specify (snake_case convention from `backend/app/schemas/`)
- Heartbeat sweeper: persisted `status` column (D-14 prefers this) or computed view. D-14 says persisted; if Phase 41 didn't land `status` column, planner adds additive migration.
- SQLAlchemy relationship strategy for nested reads (joined vs selectin vs lazy) — pick what's fast at ≤100 items
- Error code boundaries beyond 401/403/404/409/204
- Test organization: one big file vs per-resource test files — mirror router layout D-01

### Deferred Ideas (OUT OF SCOPE)

- SSE broadcast → Phase 45
- Per-device telemetry → not scheduled (PROJECT.md explicitly defers)
- Media pagination → additive later
- Media preview thumbnails → Phase 46
- Audit log of admin CRUD → not scheduled
- Scheduled playlist activation (time-based) → deferred
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-BE-01 | `backend/app/routers/signage_admin/` (or `.py`) with `APIRouter(dependencies=[require_admin])` — full CRUD for media, playlists, playlist_items, devices, tags | D-01 defines the package split; sensors.py pattern is the template; `require_admin` wiring verified in directus_auth.py |
| SGN-BE-02 | `backend/app/routers/signage_player.py` with `get_current_device` dep — `GET /playlist`, `POST /heartbeat` (SSE deferred to Phase 45) | D-02; device_auth.py provides `get_current_device`; ETag/304 pattern documented below |
| SGN-BE-06 | `backend/app/services/signage_resolver.py` — tag-to-playlist query `priority DESC, updated_at DESC`, LIMIT 1 per device | D-08; SQLAlchemy join query pattern documented below |
| SGN-BE-09 | Router dep-audit test — every `/api/signage/*` admin route has `require_admin`; every `/api/signage/player/*` route has `get_current_device` | D-04/D-05; `test_sensors_admin_gate.py` `_walk_deps` pattern is the exact template |
| SGN-BE-10 | CI grep guards — no `import sqlite3`, no `import psycopg2`, no sync `subprocess.*` in `backend/app/` signage modules | D-05 / ROADMAP hazard 6+7; grep-in-test pattern verified in `test_snmp_poller_ci_guards.py` |
| SGN-SCH-01 | APScheduler heartbeat sweeper (1-min cadence) marks devices offline when `last_seen_at > 5 min`; `max_instances=1`, `coalesce=True` | D-14/D-15; scheduler.py `_run_signage_pairing_cleanup` pattern is the exact template |
</phase_requirements>

---

## Summary

Phase 43 is a **backend-only FastAPI surface** built entirely on top of infrastructure that Phases 41 and 42 already landed: 8 ORM models in `backend/app/models/signage.py`, 19+ Pydantic schemas in `backend/app/schemas/signage.py`, `get_current_user`/`require_admin` in `directus_auth.py`, `get_current_device` in `device_auth.py`, and the APScheduler singleton in `scheduler.py`. No new libraries are required.

The three main deliverables are: (1) an admin CRUD router package under `backend/app/routers/signage_admin/`; (2) a player polling router `backend/app/routers/signage_player.py` with a pure tag resolver service; and (3) a 1-minute APScheduler job that flips stale devices offline. Two additional test deliverables guard contract invariants: a dep-audit test and a CI grep-guard test.

The primary implementation risk is the `signage_devices` table potentially missing `current_playlist_etag` (a new column not defined in Phase 41). The planner must check Phase 41 schema output and add an additive Alembic migration if needed. The secondary risk is the ETag/304 pattern — this is a standard HTTP caching primitive but requires careful header handling in FastAPI (returning a `Response` directly with status 304 and no body, not a Pydantic model).

**Primary recommendation:** Mirror `sensors.py` + `test_sensors_admin_gate.py` for admin CRUD style and dep-audit pattern respectively; mirror `_run_signage_pairing_cleanup` in `scheduler.py` for the heartbeat sweeper; use `selectinload` for relationship-heavy reads at this fleet size.

---

## Standard Stack

### Core (no new installs — all already in requirements)

| Library | Purpose | Already Present |
|---------|---------|-----------------|
| FastAPI 0.135.3 | `APIRouter`, `Depends`, `HTTPException`, `Response` | Yes — `main.py` |
| SQLAlchemy 2.0 async | ORM queries with `AsyncSession`, `select`, `update`, `delete`, `insert` | Yes — all routers |
| asyncpg 0.31.0 | Async PG driver (used indirectly via SQLAlchemy) | Yes |
| Pydantic v2 | Request/response schemas — extend existing `schemas/signage.py` | Yes |
| APScheduler | `AsyncIOScheduler`, `IntervalTrigger` — existing singleton in `scheduler.py` | Yes |
| hashlib (stdlib) | SHA256 for ETag computation | Yes (stdlib) |

**No new packages required for Phase 43.** `sse-starlette` lands in Phase 45; `pdf2image` in Phase 44.

---

## Architecture Patterns

### Router Package Layout (D-01)

```
backend/app/routers/
├── signage_admin/
│   ├── __init__.py       # parent APIRouter(prefix="/api/signage", dependencies=[...])
│   ├── media.py          # sub-router, prefix="" (parent already has /api/signage)
│   ├── playlists.py
│   ├── playlist_items.py
│   ├── devices.py
│   └── tags.py
└── signage_player.py     # APIRouter(prefix="/api/signage/player", dependencies=[Depends(get_current_device)])
```

The `__init__.py` parent router pattern:

```python
# backend/app/routers/signage_admin/__init__.py
from fastapi import APIRouter, Depends
from app.security.directus_auth import get_current_user, require_admin
from . import media, playlists, playlist_items, devices, tags

router = APIRouter(
    prefix="/api/signage",
    tags=["signage-admin"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
router.include_router(media.router)
router.include_router(playlists.router)
router.include_router(playlist_items.router)
router.include_router(devices.router)
router.include_router(tags.router)
```

Each sub-router uses an empty or resource-specific prefix, e.g. `APIRouter(prefix="/media", tags=["signage-admin-media"])`. The parent router's dependencies propagate to all included routes automatically in FastAPI — this is the exact same mechanism used by `sensors.py` with `APIRouter(prefix="/api/sensors", dependencies=[...])`.

### Pattern: ETag/304 for GET /playlist (D-09)

The standard HTTP ETag conditional GET flow in FastAPI requires returning a bare `Response` object (not a Pydantic model) when the ETag matches, since FastAPI cannot serialize a 304 as a model response:

```python
import hashlib
from fastapi import APIRouter, Depends, Request, Response
from app.security.device_auth import get_current_device

@router.get("/playlist")
async def get_device_playlist(
    request: Request,
    response: Response,
    device: SignageDevice = Depends(get_current_device),
    db: AsyncSession = Depends(get_async_db_session),
):
    resolved = await resolver.resolve_playlist_for_device(db, device)
    etag = _compute_etag(resolved)
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Cache-Control"] = "no-cache"

    if_none_match = request.headers.get("If-None-Match", "")
    if if_none_match.strip('"') == etag:
        return Response(status_code=304, headers={
            "ETag": f'"{etag}"',
            "Cache-Control": "no-cache",
        })
    return resolved  # PlaylistEnvelope Pydantic model
```

ETag computation (D-09 specifics):

```python
import hashlib
import json
from datetime import datetime

def _compute_etag(envelope: PlaylistEnvelope) -> str:
    if envelope.playlist_id is None:
        # empty playlist — stable ETag for the "no content" state
        return hashlib.sha256(b"empty").hexdigest()
    parts = [
        str(envelope.playlist_id),
        envelope.updated_at.isoformat() if hasattr(envelope, "updated_at") else "",
    ]
    for item in sorted(envelope.items, key=lambda i: i.position):
        parts.append(f"{item.media_id}:{item.position}")
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()
```

### Pattern: Tag Resolver Query (D-08, SGN-BE-06)

The core query in `backend/app/services/signage_resolver.py` must:
1. Get the device's tag IDs from `signage_device_tag_map`
2. Find enabled playlists that target at least one of those tags via `signage_playlist_tag_map`
3. Order by `priority DESC, updated_at DESC`, take LIMIT 1
4. Load the playlist's items ordered by `position ASC`

```python
# Source: SQLAlchemy 2.0 async docs + project ORM model inspection
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def resolve_playlist_for_device(
    db: AsyncSession, device: SignageDevice
) -> PlaylistEnvelope:
    # Step 1: get device tag IDs
    tag_result = await db.execute(
        select(SignageDeviceTagMap.tag_id).where(
            SignageDeviceTagMap.device_id == device.id
        )
    )
    tag_ids = [row[0] for row in tag_result.fetchall()]

    if not tag_ids:
        return _empty_envelope()

    # Step 2: find the best matching enabled playlist
    playlist_result = await db.execute(
        select(SignagePlaylist)
        .join(
            SignagePlaylistTagMap,
            SignagePlaylistTagMap.playlist_id == SignagePlaylist.id,
        )
        .where(
            SignagePlaylist.enabled == True,
            SignagePlaylistTagMap.tag_id.in_(tag_ids),
        )
        .order_by(SignagePlaylist.priority.desc(), SignagePlaylist.updated_at.desc())
        .limit(1)
        .options(selectinload(SignagePlaylist.items).selectinload(SignagePlaylistItem.media))
    )
    playlist = playlist_result.scalar_one_or_none()

    if playlist is None:
        return _empty_envelope()

    return _build_envelope(playlist)
```

**Relationship loading strategy:** Use `selectinload` (two separate queries: one for items, one for media). Joined loading (`joinedload`) on a collection of items produces cartesian products and is generally avoided for one-to-many; `selectinload` is clean and measurably faster at ≤100 items.

### Pattern: Heartbeat Sweeper (D-14, SGN-SCH-01)

Register in `scheduler.py` lifespan alongside existing jobs — mirrors `_run_signage_pairing_cleanup` verbatim:

```python
HEARTBEAT_SWEEPER_JOB_ID = "signage_heartbeat_sweeper"  # NEW Phase 43

async def _run_signage_heartbeat_sweeper() -> None:
    """SGN-SCH-01: flip stale devices to offline (D-15)."""
    async with AsyncSessionLocal() as session:
        try:
            result = await asyncio.wait_for(
                session.execute(
                    update(SignageDevice)
                    .where(
                        SignageDevice.last_seen_at < func.now() - timedelta(minutes=5),
                        SignageDevice.status != "offline",
                        SignageDevice.revoked_at.is_(None),
                    )
                    .values(status="offline", updated_at=func.now())
                ),
                timeout=20,
            )
            await session.commit()
            log.info("signage_heartbeat_sweeper: flipped devices=%d", result.rowcount)
        except Exception:
            log.exception("signage_heartbeat_sweeper failed")
            await session.rollback()
```

Lifespan registration (in `lifespan()`, after pairing cleanup block):

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

**Note:** `timedelta` is already imported in `scheduler.py` (used by pairing cleanup). No new imports.

### Pattern: Dep-Audit Test (D-04, SGN-BE-09)

The existing `test_sensors_admin_gate.py` `_walk_deps` function is the exact template to copy:

```python
# backend/tests/test_signage_router_deps.py
from fastapi.routing import APIRoute
from app.main import app
from app.security.directus_auth import require_admin
from app.security.device_auth import get_current_device

# INTENTIONAL EXCEPTIONS — documented in Phase 42 Plan 02 SUMMARY.
# /request and /status are public (un-paired kiosk has no token).
# Adding a new public signage route requires an explicit entry here.
PUBLIC_SIGNAGE_ROUTES = {
    "/api/signage/pair/request",
    "/api/signage/pair/status",
}

def _walk_deps(deps):
    out = []
    for d in deps:
        out.append(d.call)
        out.extend(_walk_deps(d.dependencies))
    return out

def test_signage_admin_routes_have_require_admin():
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not route.path.startswith("/api/signage"):
            continue
        if route.path in PUBLIC_SIGNAGE_ROUTES:
            continue
        if route.path.startswith("/api/signage/player/"):
            continue
        all_calls = _walk_deps(route.dependant.dependencies)
        assert require_admin in all_calls, (
            f"admin route {route.path} missing require_admin"
        )

def test_signage_player_routes_have_get_current_device():
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not route.path.startswith("/api/signage/player/"):
            continue
        all_calls = _walk_deps(route.dependant.dependencies)
        assert get_current_device in all_calls, (
            f"player route {route.path} missing get_current_device"
        )
```

### Pattern: CI Grep Guards (SGN-BE-10)

The existing `test_snmp_poller_ci_guards.py` uses `subprocess.check_output(["grep", ...])` from within tests. The SGN-BE-10 guards live in `backend/tests/`, not in `backend/app/`, so subprocess is allowed in tests:

```python
# backend/tests/test_signage_ci_guards.py
import subprocess
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"

def _grep(pattern: str, path: Path = APP_DIR) -> list[str]:
    result = subprocess.run(
        ["grep", "-r", "--include=*.py", "-l", pattern, str(path)],
        capture_output=True, text=True,
    )
    return [line for line in result.stdout.splitlines() if line]

def test_no_sqlite3_import():
    assert _grep("import sqlite3") == [], "found sqlite3 import in backend/app/"

def test_no_psycopg2_import():
    assert _grep("import psycopg2") == [], "found psycopg2 import in backend/app/"

def test_no_sync_subprocess_in_signage():
    # Check specifically signage modules — subprocess is allowed in non-signage code
    signage_paths = list(APP_DIR.rglob("signage*.py")) + list(
        (APP_DIR / "routers" / "signage_admin").rglob("*.py")
        if (APP_DIR / "routers" / "signage_admin").exists() else []
    )
    for path in signage_paths:
        content = path.read_text()
        assert "subprocess.run" not in content, f"sync subprocess.run in {path}"
        assert "subprocess.Popen" not in content, f"sync subprocess.Popen in {path}"
        assert "subprocess.call" not in content, f"sync subprocess.call in {path}"
```

### Pattern: Admin CRUD (sensors.py style, D-19/D-20)

Each sub-router follows the `sensors.py` idiom: flat JSON, `response_model=list[...]` for lists, `status_code=201` for creates, `status_code=204` for deletes.

Media delete with 409-on-FK-restrict (D-16):

```python
from sqlalchemy.exc import IntegrityError

@router.delete("/media/{media_id}", status_code=204)
async def delete_media(
    media_id: uuid.UUID, db: AsyncSession = Depends(get_async_db_session)
) -> None:
    row = (await db.execute(select(SignageMedia).where(SignageMedia.id == media_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, detail="media not found")
    try:
        await db.execute(delete(SignageMedia).where(SignageMedia.id == media_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Find which playlists reference this media
        result = await db.execute(
            select(SignagePlaylistItem.playlist_id).where(
                SignagePlaylistItem.media_id == media_id
            )
        )
        playlist_ids = [str(r[0]) for r in result.fetchall()]
        raise HTTPException(
            409,
            detail={"detail": "media in use by playlists", "playlist_ids": playlist_ids},
        )
    # Post-commit FS cleanup (D-16) — WARNING-only if fails
    import pathlib
    slides_dir = pathlib.Path(f"/app/media/slides/{media_id}")
    try:
        if slides_dir.exists():
            import shutil
            shutil.rmtree(slides_dir, ignore_errors=True)
    except Exception:
        log.warning("could not clean up slides dir for media %s", media_id)
```

### Recommended Project Structure Addition

```
backend/app/
├── routers/
│   ├── signage_admin/         # NEW Phase 43
│   │   ├── __init__.py        # parent router + includes
│   │   ├── media.py
│   │   ├── playlists.py
│   │   ├── playlist_items.py
│   │   ├── devices.py
│   │   └── tags.py
│   └── signage_player.py      # NEW Phase 43
├── services/
│   └── signage_resolver.py    # NEW Phase 43
backend/tests/
    ├── test_signage_router_deps.py    # NEW Phase 43
    └── test_signage_ci_guards.py      # NEW Phase 43
```

### Anti-Patterns to Avoid

- **Per-endpoint `require_admin` on admin routes:** The parent router dep makes this redundant and violates cross-cutting hazard #5. Do not add `dependencies=[Depends(require_admin)]` to individual endpoints in the signage_admin sub-routers.
- **Using `joinedload` for the playlist items collection:** Produces a cartesian product with the media join. Use `selectinload` for one-to-many collections.
- **Updating `last_seen_at` in the resolver (D-10):** `GET /playlist` must be a pure read. Only `POST /heartbeat` writes device presence.
- **Returning a Pydantic model for 304:** FastAPI will try to serialize it and either error or return a body. Return `Response(status_code=304, headers={...})` directly.
- **Checking `subprocess.*` only in specific files:** The CI grep guard should scan all of `backend/app/` for sqlite3/psycopg2 and all signage-related files for sync subprocess — not just one file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA256 hash for ETag | Custom hashing | `hashlib.sha256` (stdlib) | Already available, single correct implementation |
| Auth dep propagation | Per-route gate | `APIRouter(dependencies=[...])` | FastAPI propagates deps to all included routes automatically |
| Device offline detection | Cron that queries every heartbeat | APScheduler `IntervalTrigger(minutes=1)` | Already in project, idempotent SQL batch is the correct pattern |
| Tag intersection query | Python-side filter after full table scan | SQLAlchemy `.join(...).where(...tag_id.in_(...))` | Database does the intersection efficiently; Python filtering at fleet scale is wrong and teaches bad habits |
| FK violation detection | SELECT-before-DELETE | Catch `sqlalchemy.exc.IntegrityError` | The `ON DELETE RESTRICT` FK is the guard; catching the exception is the idiomatic pattern |

---

## Schema Gaps to Verify Before Planning

The planner must check whether Phase 41 landed `current_playlist_etag` on `signage_devices`. Looking at the Phase 41 ORM model (`backend/app/models/signage.py`), the `SignageDevice` class does **not** have a `current_playlist_etag` column — only `current_item_id`, `status`, `last_seen_at`, `revoked_at`.

**Required additive migration:** The heartbeat endpoint (D-11) writes `current_playlist_etag`. An additive Alembic migration must add:
- `signage_devices.current_playlist_etag` — `Text, nullable=True`

The `status` column **does** exist in Phase 41 (`String(16)` with CHECK `IN ('online','offline','pending')`) — no migration needed for that.

The heartbeat also writes `current_item_id` which already exists as `UUID, nullable=True` with no FK (Phase 41 D-02 note: "No FK — item may be deleted while device still cached it locally"). No migration needed.

**Summary of additive migrations needed:**
- `ALTER TABLE signage_devices ADD COLUMN current_playlist_etag TEXT` — 1 column, 1 Alembic revision

---

## Common Pitfalls

### Pitfall 1: 304 returns a body in FastAPI
**What goes wrong:** Handler returns a Pydantic model with status_code=304. FastAPI tries to serialize it; the 304 response includes a body (technically invalid per HTTP spec) or raises a serialization error.
**Why it happens:** FastAPI's `response_model` machinery runs before the status code is inspected.
**How to avoid:** For conditional responses, declare `response_model=None` on the route and return either the Pydantic model directly (FastAPI serializes it) or `Response(status_code=304, headers={...})`. The `Response` object bypasses the model serialization entirely.
**Warning signs:** Tests expecting empty 304 body receive JSON; or `TypeError` in FastAPI during model validation.

### Pitfall 2: APScheduler `timedelta` in SQL WHERE vs Python
**What goes wrong:** Sweeper uses Python `datetime.now() - timedelta(minutes=5)` computed outside the SQL statement. This computes the threshold at job-start time, which is correct, but if the session is long-lived the timestamp can drift.
**How to avoid:** Use `func.now() - text("interval '5 minutes'")` or `func.now() - timedelta(minutes=5)` inside the SQLAlchemy expression so the DB evaluates `now()` at execution time. The D-15 SQL spec already uses `now() - interval '5 minutes'` which is the correct form.
**Warning signs:** Devices near the 5-minute threshold get inconsistently flipped depending on job execution latency.

### Pitfall 3: Bulk-replace join table not in one transaction
**What goes wrong:** `PUT /devices/{id}/tags` does a DELETE then INSERT in two separate `await db.execute()` calls without explicit transaction wrapping. A connection error between them leaves the device with no tags.
**How to avoid:** Ensure both operations are inside the same implicit SQLAlchemy transaction (they are by default if you don't `commit()` between them). Do `await db.execute(delete(...)); await db.execute(insert(...)); await db.commit()` — single commit covers both operations.
**Warning signs:** Devices intermittently lose all tags after a tag update that crashed mid-way.

### Pitfall 4: Sub-router prefix collision
**What goes wrong:** Parent router has `prefix="/api/signage"` and sub-router for media has `prefix="/api/signage/media"`. The final path becomes `/api/signage/api/signage/media/{id}`.
**How to avoid:** Sub-routers included into the parent router should have short prefixes like `prefix="/media"` (not the full path). The parent's prefix is prepended automatically.
**Warning signs:** Routes are registered but 404 in practice; `app.routes` shows doubled prefix.

### Pitfall 5: dep-audit `_walk_deps` misses router-level deps
**What goes wrong:** The `_walk_deps` recursive walk starts from `route.dependant.dependencies` which does include router-level deps injected at `APIRouter(dependencies=[...])` time — but only if the router is included into the app correctly. If `include_router` is called without the parent's deps, router deps don't propagate.
**How to avoid:** Verify `app.include_router(signage_admin_router)` in `main.py` is called after the parent router has been fully assembled (all sub-routers included). The dep-audit test will catch this immediately if wiring is wrong.
**Warning signs:** `test_signage_router_deps.py` fails with "admin route X missing require_admin" even though the parent router is wired correctly — indicates the include order is wrong.

### Pitfall 6: Media delete 409 detail shape
**What goes wrong:** `HTTPException(409, detail={"detail": "...", "playlist_ids": [...]})` — FastAPI renders the `detail` field of `HTTPException` as-is in the response body. If `detail` is a dict, the response is `{"detail": {"detail": "...", "playlist_ids": [...]}}` (nested `detail`).
**How to avoid:** Use `HTTPException(409, detail={"detail": "media in use by playlists", "playlist_ids": [...]})` and accept the nested shape, OR use a custom response class. The CONTEXT D-16 specifies `{detail: "media in use by playlists", playlist_ids: [...]}` — achieving this flat shape requires returning `JSONResponse(status_code=409, content={"detail": "...", "playlist_ids": [...]})` instead of `HTTPException`.
**Warning signs:** Phase 46 admin UI receives `{"detail": {"detail": "..."}}` and can't parse the playlist_ids from the expected location.

---

## Code Examples

### Verified Pattern: Router-level dep in sensors.py (HIGH confidence — read directly from source)

```python
# From backend/app/routers/sensors.py (line 47-51)
router = APIRouter(
    prefix="/api/sensors",
    tags=["sensors"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
```

### Verified Pattern: dep-audit _walk_deps in test_sensors_admin_gate.py (HIGH confidence — read directly)

```python
def _walk_deps(deps):
    out = []
    for d in deps:
        out.append(d.call)
        out.extend(_walk_deps(d.dependencies))
    return out
```

### Verified Pattern: APScheduler interval job in scheduler.py (HIGH confidence — read directly)

```python
# From backend/app/scheduler.py (lines 273-283)
scheduler.add_job(
    _run_scheduled_sensor_poll,
    trigger="interval",
    seconds=sensor_interval_s,
    id=SENSOR_POLL_JOB_ID,
    replace_existing=True,
    max_instances=1,
    coalesce=True,
    misfire_grace_time=30,
)
```

### Verified Pattern: AsyncSession delete + commit in pair router (HIGH confidence — read directly)

```python
# From backend/app/routers/signage_pair.py (lines 161-163)
await db.execute(
    delete(SignagePairingSession).where(SignagePairingSession.id == row.id)
)
await db.commit()
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is pure Python code/config changes within the existing Docker stack; no new CLI tools, services, or runtimes required).

---

## Open Questions

1. **D-21 media upload shape (Claude's Discretion)**
   - What we know: Phase 41 landed Directus RO volume mount on the api container (`/directus/uploads:ro`). Phase 46 (admin UI) needs to consume whatever shape lands here.
   - What's unclear: Whether to accept multipart `UploadFile` in the FastAPI endpoint (option a) or just register a Directus-managed UUID (option b). Option (b) defers file handling to Directus entirely — simpler for Phase 43, but Phase 46 admin UI must upload to Directus first before calling the signage API.
   - Recommendation: Option (b) — Directus-asset-UUID registration only. Keeps `POST /api/signage/media` a simple JSON endpoint; Directus handles storage, CDN paths, and the RO mount makes the files readable at Phase 44 conversion time. The plan must document this as a Phase 46 constraint (admin UI must upload to Directus `/files` endpoint first).

2. **`current_playlist_etag` column — additive migration scope**
   - What we know: The column does not exist in the Phase 41 model. The heartbeat (D-11) writes it.
   - What's unclear: Whether to add this in a dedicated plan or as a Wave 0 task in the plan that introduces the heartbeat endpoint.
   - Recommendation: Wave 0 Alembic migration plan (one small plan that adds the column and updates the ORM model). Keep it separate so the DB is ready before the router plan runs.

3. **Playlist envelope `updated_at` for ETag**
   - What we know: D-09 specifies the ETag includes `playlist.updated_at`. The `SignagePlaylist` ORM model does have `updated_at`.
   - What's unclear: The `PlaylistEnvelope` Pydantic response schema (D-07) does not explicitly include `updated_at` in the envelope spec. The ETag computation needs it at the service layer.
   - Recommendation: Carry `updated_at` in the resolver's internal data structure (not necessarily exposed in the envelope — compute ETag in the service before building the response). The planner should decide whether to include `updated_at` in the response envelope (useful for the Phase 47 player) or keep it internal.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `test_sensors_admin_gate.py` dep-audit style | Exact same pattern for signage dep-audit (D-04) | Copy-paste with signage-specific allow-list |
| `_run_signage_pairing_cleanup` sweeper | `_run_signage_heartbeat_sweeper` mirrors same shape | No new patterns needed |
| `sensors.py` admin CRUD | `signage_admin/*.py` mirrors same style | Flat JSON, 201/204, `require_admin` on router |

---

## Sources

### Primary (HIGH confidence — direct source code inspection)
- `backend/app/routers/sensors.py` — `APIRouter(dependencies=[...])` pattern, admin CRUD style, 201/204 conventions
- `backend/app/tests/test_sensors_admin_gate.py` — `_walk_deps` dep-audit pattern, exact template for SGN-BE-09
- `backend/app/scheduler.py` — APScheduler singleton, `_run_signage_pairing_cleanup` sweeper template, lifespan registration
- `backend/app/security/directus_auth.py` — `require_admin`, `get_current_user` signatures
- `backend/app/security/device_auth.py` — `get_current_device` signature
- `backend/app/models/signage.py` — ORM model field inventory (confirmed `status` exists, `current_playlist_etag` does NOT)
- `backend/app/schemas/signage.py` — existing Pydantic schema inventory (19 schemas already defined)
- `backend/app/routers/signage_pair.py` — INTENTIONAL EXCEPTION pattern for dep-audit allow-list
- `backend/tests/conftest.py` — `client` fixture (LifespanManager + ASGITransport), test harness pattern
- `backend/app/main.py` — current router registration, include pattern

### Secondary (MEDIUM confidence — project CONTEXT.md + REQUIREMENTS.md)
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` — all D-* decisions
- `.planning/REQUIREMENTS.md` — SGN-BE-01, SGN-BE-02, SGN-BE-06, SGN-BE-09, SGN-BE-10, SGN-SCH-01 spec
- `.planning/research/PITFALLS.md` §13, §15, §16, §21 — referenced in CONTEXT canonical refs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all requirements satisfied by existing installed packages
- Architecture patterns: HIGH — all patterns derived from direct source code inspection of working Phase 41/42 code
- Pitfalls: HIGH — derived from existing test failures, official FastAPI behavior, and project-specific code review
- Schema gap (missing `current_playlist_etag`): HIGH — verified by reading Phase 41 ORM model directly

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable stack; FastAPI/SQLAlchemy APIs unlikely to change within 30 days)
