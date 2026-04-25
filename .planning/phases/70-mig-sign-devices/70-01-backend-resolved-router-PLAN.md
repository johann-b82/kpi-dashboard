---
phase: 70-mig-sign-devices
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/signage_admin/resolved.py
  - backend/app/routers/signage_admin/__init__.py
autonomous: true
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "GET /api/signage/resolved/{device_id} returns {current_playlist_id, current_playlist_name, tag_ids} for an existing device"
    - "GET /api/signage/resolved/{device_id} returns 404 for an unknown device id"
    - "Route is admin-gated via package-level dependencies (not per-route)"
  artifacts:
    - path: "backend/app/routers/signage_admin/resolved.py"
      provides: "GET /resolved/{device_id} route handler"
      contains: "resolve_playlist_for_device"
    - path: "backend/app/routers/signage_admin/__init__.py"
      provides: "Resolved router registration"
      contains: "router.include_router(resolved.router)"
  key_links:
    - from: "backend/app/routers/signage_admin/resolved.py"
      to: "backend/app/services/signage_resolver.py"
      via: "resolve_playlist_for_device(db, row)"
      pattern: "from app.services.signage_resolver import resolve_playlist_for_device"
    - from: "backend/app/routers/signage_admin/__init__.py"
      to: "backend/app/routers/signage_admin/resolved.py"
      via: "include_router"
      pattern: "from \\. import .*resolved"
---

<objective>
Create the new FastAPI per-device resolved-playlist endpoint that the frontend Devices page will call once-per-row in `useQueries`. This endpoint replaces the server-side `_attach_resolved_playlist` enrichment that today's `GET /api/signage/devices` performs (the list itself moves to Directus).

Purpose: Implements MIG-SIGN-04 hybrid surface — Directus owns device rows, FastAPI owns resolver compute (per ROADMAP success criterion #3 + locked architectural decision "GET /signage/devices is hybrid").

Output:
- New router file `backend/app/routers/signage_admin/resolved.py` with one route: `GET /resolved/{device_id}`
- Registration in `signage_admin/__init__.py` so the route mounts under the package's existing admin gate
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@backend/app/routers/signage_admin/__init__.py
@backend/app/routers/signage_admin/devices.py
@backend/app/services/signage_resolver.py
@backend/app/schemas/signage.py

<interfaces>
<!-- Existing resolver service (USE AS-IS, do not modify) -->

From backend/app/services/signage_resolver.py:
```python
async def resolve_playlist_for_device(db: AsyncSession, device: SignageDevice) -> ResolvedEnvelope
# ResolvedEnvelope has: .playlist_id (UUID|None), .name (str|None)
```

From backend/app/models/signage.py:
```python
class SignageDevice: id (UUID), name (str), ...
class SignageDeviceTagMap: device_id (UUID), tag_id (int)
```

From backend/app/routers/signage_admin/devices.py (lines 62-79 — the function being lifted):
```python
async def _attach_resolved_playlist(db, device) -> SignageDeviceRead:
    envelope = await resolve_playlist_for_device(db, device)
    out = SignageDeviceRead.model_validate(device)
    out.current_playlist_id = envelope.playlist_id
    out.current_playlist_name = envelope.name
    tag_rows = await db.execute(
        select(SignageDeviceTagMap.tag_id).where(SignageDeviceTagMap.device_id == device.id)
    )
    tag_ids = [tid for (tid,) in tag_rows.fetchall()]
    out.tag_ids = tag_ids or None
    return out
```

The new route returns the THREE computed fields only (`current_playlist_id`, `current_playlist_name`, `tag_ids`) — NOT the full `SignageDeviceRead` shape, since the FE merges these onto a Directus-fetched row.

From backend/app/routers/signage_admin/__init__.py — package-level admin gate (D-01c, hazard #5):
```python
router = APIRouter(
    prefix="/api/signage",
    tags=["signage-admin"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
router.include_router(analytics.router)
router.include_router(media.router)
router.include_router(playlists.router)
router.include_router(playlist_items.router)
router.include_router(devices.router)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create resolved.py router</name>
  <files>backend/app/routers/signage_admin/resolved.py</files>
  <read_first>
    - backend/app/routers/signage_admin/devices.py (lines 62-79: _attach_resolved_playlist — source of the lift)
    - backend/app/routers/signage_admin/__init__.py (admin gate inheritance)
    - backend/app/services/signage_resolver.py (resolve_playlist_for_device signature)
    - backend/app/database.py (get_async_db_session import path)
    - backend/app/models/__init__.py or backend/app/models/signage.py (SignageDevice, SignageDeviceTagMap exports)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pattern 1 — write this exactly)
  </read_first>
  <behavior>
    - GET /api/signage/resolved/{device_id} with a known device_id returns 200 with body {current_playlist_id, current_playlist_name, tag_ids}
    - GET /api/signage/resolved/{device_id} with an unknown UUID returns 404 detail "device not found"
    - GET /api/signage/resolved/{device_id} with a malformed UUID returns 422 (FastAPI default UUID parsing)
    - Field names match SignageDeviceRead extras EXACTLY: current_playlist_id (UUID|None), current_playlist_name (str|None), tag_ids (list[int]|None — None if device has zero tag-map rows)
    - Route does NOT add its own require_admin / get_current_user dependencies (inherits from package router per D-01c)
  </behavior>
  <action>
    Create `backend/app/routers/signage_admin/resolved.py` with this exact content (D-01, D-01a, D-01b, D-01c, D-01d):

    ```python
    """Phase 70 D-01 — per-device resolved playlist computation.

    Lifted from devices.py::_attach_resolved_playlist (lines 62-79). Returns the
    same three fields the FE was reading off SignageDeviceRead:
    current_playlist_id, current_playlist_name, tag_ids. Field names match
    exactly so the FE merge is `{...directusRow, ...resolvedResponse}` with
    zero rename (D-01).

    Admin gate inherited from signage_admin package router (D-01c / cross-cutting
    hazard #5) — do NOT add a second gate here.
    """
    from __future__ import annotations

    import uuid

    from fastapi import APIRouter, Depends, HTTPException
    from pydantic import BaseModel
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.database import get_async_db_session
    from app.models import SignageDevice, SignageDeviceTagMap
    from app.services.signage_resolver import resolve_playlist_for_device

    router = APIRouter(prefix="/resolved", tags=["signage-admin-resolved"])


    class ResolvedDeviceResponse(BaseModel):
        current_playlist_id: uuid.UUID | None = None
        current_playlist_name: str | None = None
        tag_ids: list[int] | None = None


    @router.get("/{device_id}", response_model=ResolvedDeviceResponse)
    async def get_resolved_for_device(
        device_id: uuid.UUID,
        db: AsyncSession = Depends(get_async_db_session),
    ) -> ResolvedDeviceResponse:
        """Per-device resolved playlist + tag_ids. 404 on unknown device."""
        row = (
            await db.execute(
                select(SignageDevice).where(SignageDevice.id == device_id)
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(404, "device not found")
        envelope = await resolve_playlist_for_device(db, row)
        tag_rows = await db.execute(
            select(SignageDeviceTagMap.tag_id).where(
                SignageDeviceTagMap.device_id == device_id
            )
        )
        tag_ids = [tid for (tid,) in tag_rows.fetchall()]
        return ResolvedDeviceResponse(
            current_playlist_id=envelope.playlist_id,
            current_playlist_name=envelope.name,
            tag_ids=tag_ids or None,
        )
    ```

    Verify import path `from app.models import SignageDevice, SignageDeviceTagMap` resolves — if `app.models/__init__.py` re-exports them (it does, confirmed by devices.py line 18 using `from app.models import SignageDevice, SignageDeviceTagMap`), keep as-is. Otherwise switch to `from app.models.signage import SignageDevice, SignageDeviceTagMap`.

    Do NOT add `Depends(require_admin)` or `Depends(get_current_user)` — admin gate is inherited from package router (D-01c).
  </action>
  <acceptance_criteria>
    - File exists at `backend/app/routers/signage_admin/resolved.py`
    - File contains the literal string `prefix="/resolved"` (anchors route under `/api/signage/resolved/`)
    - File contains `class ResolvedDeviceResponse(BaseModel):` with all three fields: `current_playlist_id`, `current_playlist_name`, `tag_ids`
    - File contains `from app.services.signage_resolver import resolve_playlist_for_device`
    - File contains `raise HTTPException(404, "device not found")`
    - File does NOT contain `require_admin` or `get_current_user` (package gate inheritance)
    - `python -c "from app.routers.signage_admin import resolved"` from backend/ runs without ImportError
    - `grep -c "@router.get" backend/app/routers/signage_admin/resolved.py` returns 1 (single route)
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import resolved; assert hasattr(resolved, 'router'); assert resolved.router.prefix == '/resolved'; print('OK')"</automated>
  </verify>
  <done>resolved.py file exists with single GET route, ResolvedDeviceResponse model, package-gate inheritance preserved, imports resolve cleanly</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Register resolved router in signage_admin package</name>
  <files>backend/app/routers/signage_admin/__init__.py</files>
  <read_first>
    - backend/app/routers/signage_admin/__init__.py (current state — 23 lines)
    - backend/app/routers/signage_admin/resolved.py (created in Task 1)
  </read_first>
  <action>
    Edit `backend/app/routers/signage_admin/__init__.py`:

    1. Update the import line from:
       ```python
       from . import analytics, devices, media, playlist_items, playlists
       ```
       to:
       ```python
       from . import analytics, devices, media, playlist_items, playlists, resolved
       ```

    2. After the existing `router.include_router(devices.router)` line, append:
       ```python
       router.include_router(resolved.router)
       ```

    Do NOT modify the package router's `prefix="/api/signage"`, `tags`, or `dependencies` — they are correct.
  </action>
  <acceptance_criteria>
    - `grep -c "resolved" backend/app/routers/signage_admin/__init__.py` returns at least 2 (one in import, one in include_router)
    - `grep "from . import" backend/app/routers/signage_admin/__init__.py` line includes `resolved`
    - `grep "router.include_router(resolved.router)" backend/app/routers/signage_admin/__init__.py` matches exactly one line
    - The package router's existing `dependencies=[Depends(get_current_user), Depends(require_admin)]` is unchanged (preserves single-source admin gate per cross-cutting hazard #5)
    - `python -c "from app.routers.signage_admin import router; print([r.path for r in router.routes if hasattr(r, 'path')])"` from backend/ includes `/api/signage/resolved/{device_id}`
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import router; paths = [r.path for r in router.routes if hasattr(r, 'path')]; assert '/api/signage/resolved/{device_id}' in paths, f'route not registered: {paths}'; print('OK')"</automated>
  </verify>
  <done>resolved.router is included under /api/signage prefix and inherits the admin gate; route appears in the FastAPI route table</done>
</task>

</tasks>

<verification>
- New endpoint `GET /api/signage/resolved/{device_id}` resolves and returns the documented shape
- Admin-package gate still single-source (no per-route admin dep added)
- Existing routes (analytics, devices, media, playlists, playlist_items) unaffected
</verification>

<success_criteria>
- `cd backend && python -c "from app.routers.signage_admin import router; assert any(r.path == '/api/signage/resolved/{device_id}' for r in router.routes if hasattr(r, 'path'))"` exits 0
- No new admin gate dependency added inside resolved.py
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-01-backend-resolved-router-SUMMARY.md`
</output>
