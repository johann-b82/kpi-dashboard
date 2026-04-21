"""Integration tests for /api/signage/schedules admin CRUD + SSE fanout.

Phase 51 Plan 02 (SGN-TIME-04). Covers:
  - Full CRUD smoke (POST/GET list/GET by id/PATCH/DELETE)
  - SSE fanout via monkeypatched notify_device: payload shape + recipient set
  - PATCH cross-playlist fanout (union old + new playlists)
  - DELETE pre-commit capture of playlist_id
  - PATCH merged-state validation (start_hhmm < end_hhmm → 422)
  - Non-admin 403 on all endpoints (parent router admin gate)
  - Playlist DELETE 409 with schedule_ids when signage_schedules blocks FK RESTRICT

Seeds via asyncpg, drives via the project's async ``client`` fixture (httpx
AsyncClient + ASGITransport + LifespanManager). Mirrors test_signage_admin_router.py
style — no extra fixtures needed.
"""
from __future__ import annotations

import os
import uuid

import asyncpg
import pytest

from tests.test_directus_auth import ADMIN_UUID, VIEWER_UUID, _mint


def _pg_dsn() -> str | None:
    user = os.environ.get("POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD")
    db = os.environ.get("POSTGRES_DB")
    host_env = os.environ.get("POSTGRES_HOST")
    host = host_env if (host_env and host_env != "localhost") else "db"
    port = os.environ.get("POSTGRES_PORT", "5432")
    if not (user and password and db):
        return None
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


async def _require_db() -> str:
    dsn = _pg_dsn()
    if dsn is None:
        pytest.skip("POSTGRES_* not set — schedule router tests need a live DB")
    try:
        conn = await asyncpg.connect(dsn=dsn)
        try:
            await conn.execute("SELECT 1")
        finally:
            await conn.close()
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"Postgres not reachable ({dsn}): {exc!s}")
    return dsn


async def _cleanup(dsn: str) -> None:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        # Order: schedules first (FK RESTRICT to playlists), then maps, items,
        # playlists, media, devices, tags.
        await conn.execute("DELETE FROM signage_schedules")
        await conn.execute("DELETE FROM signage_playlist_tag_map")
        await conn.execute("DELETE FROM signage_device_tag_map")
        await conn.execute("DELETE FROM signage_playlist_items")
        await conn.execute("DELETE FROM signage_playlists")
        await conn.execute("DELETE FROM signage_media")
        await conn.execute("DELETE FROM signage_pairing_sessions")
        await conn.execute("DELETE FROM signage_devices")
        await conn.execute("DELETE FROM signage_device_tags")
    finally:
        await conn.close()


async def _insert_playlist(dsn: str, *, name: str = "p") -> uuid.UUID:
    pid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_playlists (id, name) VALUES ($1, $2)", pid, name
        )
    finally:
        await conn.close()
    return pid


async def _insert_device(dsn: str, *, name: str = "d") -> uuid.UUID:
    did = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_devices (id, name, status) VALUES ($1, $2, 'offline')",
            did,
            name,
        )
    finally:
        await conn.close()
    return did


async def _insert_tag(dsn: str, *, name: str) -> int:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        return await conn.fetchval(
            "INSERT INTO signage_device_tags (name) VALUES ($1) RETURNING id", name
        )
    finally:
        await conn.close()


async def _link_device_tag(dsn: str, device_id: uuid.UUID, tag_id: int) -> None:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_device_tag_map (device_id, tag_id) VALUES ($1, $2)",
            device_id,
            tag_id,
        )
    finally:
        await conn.close()


async def _link_playlist_tag(
    dsn: str, playlist_id: uuid.UUID, tag_id: int
) -> None:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_playlist_tag_map (playlist_id, tag_id) VALUES ($1, $2)",
            playlist_id,
            tag_id,
        )
    finally:
        await conn.close()


async def _insert_schedule(
    dsn: str,
    *,
    playlist_id: uuid.UUID,
    weekday_mask: int = 127,
    start_hhmm: int = 700,
    end_hhmm: int = 1700,
    priority: int = 0,
    enabled: bool = True,
) -> uuid.UUID:
    sid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            """
            INSERT INTO signage_schedules
              (id, playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            sid,
            playlist_id,
            weekday_mask,
            start_hhmm,
            end_hhmm,
            priority,
            enabled,
        )
    finally:
        await conn.close()
    return sid


class _NotifySpy:
    """Captures every ``notify_device(device_id, payload)`` call."""

    def __init__(self) -> None:
        self.calls: list[tuple[uuid.UUID, dict]] = []

    def __call__(self, device_id, payload: dict) -> None:
        self.calls.append((device_id, payload))


# ---------------------------------------------------------------------------
# POST — create + SSE fanout
# ---------------------------------------------------------------------------


async def test_create_schedule_returns_201_and_fires_sse(client, monkeypatch):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        playlist_id = await _insert_playlist(dsn, name="sched-pl")
        tag_id = await _insert_tag(dsn, name="sched-tag")
        await _link_playlist_tag(dsn, playlist_id, tag_id)
        device_id = await _insert_device(dsn, name="sched-dev")
        await _link_device_tag(dsn, device_id, tag_id)

        spy = _NotifySpy()
        monkeypatch.setattr(
            "app.routers.signage_admin.schedules.notify_device", spy
        )

        r = await client.post(
            "/api/signage/schedules",
            json={
                "playlist_id": str(playlist_id),
                "weekday_mask": 127,
                "start_hhmm": 700,
                "end_hhmm": 1700,
                "priority": 0,
                "enabled": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["playlist_id"] == str(playlist_id)
        assert uuid.UUID(body["id"])
        schedule_id = body["id"]

        # SSE spy captured exactly one call for the single affected device
        assert len(spy.calls) == 1, spy.calls
        called_device, payload = spy.calls[0]
        assert called_device == device_id
        assert payload == {
            "event": "schedule-changed",
            "schedule_id": schedule_id,
            "playlist_id": str(playlist_id),
        }
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# GET list — ordering
# ---------------------------------------------------------------------------


async def test_list_schedules_orders_by_priority_then_updated_at(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        pl = await _insert_playlist(dsn, name="sched-list")
        low = await _insert_schedule(dsn, playlist_id=pl, priority=0)
        high = await _insert_schedule(dsn, playlist_id=pl, priority=10)
        mid = await _insert_schedule(dsn, playlist_id=pl, priority=5)

        r = await client.get(
            "/api/signage/schedules",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) == 3
        ids = [row["id"] for row in rows]
        # priority DESC → high, mid, low
        assert ids == [str(high), str(mid), str(low)]
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# GET by id — 404 when missing
# ---------------------------------------------------------------------------


async def test_get_schedule_404_for_missing(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        r = await client.get(
            f"/api/signage/schedules/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 404, r.text
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# PATCH — merged-state validation
# ---------------------------------------------------------------------------


async def test_patch_schedule_validates_start_lt_end_returns_422(
    client, monkeypatch
):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        pl = await _insert_playlist(dsn, name="sched-patch")
        sid = await _insert_schedule(
            dsn, playlist_id=pl, start_hhmm=800, end_hhmm=1700
        )

        # Mute fanout so we isolate the validation error
        monkeypatch.setattr(
            "app.routers.signage_admin.schedules.notify_device", _NotifySpy()
        )

        # PATCH only end_hhmm=700 → merged state is start=800, end=700 → 422
        r = await client.patch(
            f"/api/signage/schedules/{sid}",
            json={"end_hhmm": 700},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422, r.text
        detail = r.json()["detail"]
        assert "start_hhmm must be less than end_hhmm" in str(detail)

        # Row is unchanged (no partial commit on validation failure)
        conn = await asyncpg.connect(dsn=dsn)
        try:
            row = await conn.fetchrow(
                "SELECT start_hhmm, end_hhmm FROM signage_schedules WHERE id=$1",
                sid,
            )
        finally:
            await conn.close()
        assert row["start_hhmm"] == 800
        assert row["end_hhmm"] == 1700
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# PATCH — cross-playlist union fanout
# ---------------------------------------------------------------------------


async def test_patch_schedule_changing_playlist_fans_out_union(
    client, monkeypatch
):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        # Playlist A with device_a tag; Playlist B with device_b tag
        pl_a = await _insert_playlist(dsn, name="pl-a")
        pl_b = await _insert_playlist(dsn, name="pl-b")
        tag_a = await _insert_tag(dsn, name="tag-a")
        tag_b = await _insert_tag(dsn, name="tag-b")
        await _link_playlist_tag(dsn, pl_a, tag_a)
        await _link_playlist_tag(dsn, pl_b, tag_b)
        dev_a = await _insert_device(dsn, name="dev-a")
        dev_b = await _insert_device(dsn, name="dev-b")
        await _link_device_tag(dsn, dev_a, tag_a)
        await _link_device_tag(dsn, dev_b, tag_b)

        sid = await _insert_schedule(dsn, playlist_id=pl_a)

        spy = _NotifySpy()
        monkeypatch.setattr(
            "app.routers.signage_admin.schedules.notify_device", spy
        )

        r = await client.patch(
            f"/api/signage/schedules/{sid}",
            json={"playlist_id": str(pl_b)},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["playlist_id"] == str(pl_b)

        # Recipient set: both dev_a (via old pl_a) and dev_b (via new pl_b).
        # One event per (device, playlist_id) pair. Each device should appear
        # exactly once paired with its matching playlist_id.
        received = {(d, p["playlist_id"]) for d, p in spy.calls}
        assert (dev_a, str(pl_a)) in received
        assert (dev_b, str(pl_b)) in received
        # All payloads are schedule-changed with the same schedule_id
        for _dev, payload in spy.calls:
            assert payload["event"] == "schedule-changed"
            assert payload["schedule_id"] == str(sid)
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# DELETE — pre-commit capture of playlist_id
# ---------------------------------------------------------------------------


async def test_delete_schedule_captures_playlist_id_pre_commit(
    client, monkeypatch
):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        pl = await _insert_playlist(dsn, name="pl-del")
        tag_id = await _insert_tag(dsn, name="tag-del")
        await _link_playlist_tag(dsn, pl, tag_id)
        dev = await _insert_device(dsn, name="dev-del")
        await _link_device_tag(dsn, dev, tag_id)
        sid = await _insert_schedule(dsn, playlist_id=pl)

        spy = _NotifySpy()
        monkeypatch.setattr(
            "app.routers.signage_admin.schedules.notify_device", spy
        )

        r = await client.delete(
            f"/api/signage/schedules/{sid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 204, r.text

        # Row is gone
        conn = await asyncpg.connect(dsn=dsn)
        try:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM signage_schedules WHERE id=$1", sid
            )
        finally:
            await conn.close()
        assert n == 0

        # notify_device was called with the captured playlist_id even though
        # the row is gone post-commit
        assert len(spy.calls) == 1, spy.calls
        called_dev, payload = spy.calls[0]
        assert called_dev == dev
        assert payload == {
            "event": "schedule-changed",
            "schedule_id": str(sid),
            "playlist_id": str(pl),
        }
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# Admin gate — non-admin 403 on every schedule endpoint
# ---------------------------------------------------------------------------


async def test_non_admin_403_on_all_schedule_endpoints(client):
    dsn = await _require_db()
    try:
        token = _mint(VIEWER_UUID)
        pl_id = uuid.uuid4()
        sid = uuid.uuid4()
        headers = {"Authorization": f"Bearer {token}"}

        # POST
        r = await client.post(
            "/api/signage/schedules",
            json={
                "playlist_id": str(pl_id),
                "weekday_mask": 127,
                "start_hhmm": 700,
                "end_hhmm": 1700,
            },
            headers=headers,
        )
        assert r.status_code == 403, r.text

        # GET list
        r = await client.get("/api/signage/schedules", headers=headers)
        assert r.status_code == 403, r.text

        # GET by id
        r = await client.get(f"/api/signage/schedules/{sid}", headers=headers)
        assert r.status_code == 403, r.text

        # PATCH
        r = await client.patch(
            f"/api/signage/schedules/{sid}",
            json={"priority": 1},
            headers=headers,
        )
        assert r.status_code == 403, r.text

        # DELETE
        r = await client.delete(
            f"/api/signage/schedules/{sid}", headers=headers
        )
        assert r.status_code == 403, r.text
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# Playlist DELETE 409 with schedule_ids (Task 2 / RESEARCH Q2)
# ---------------------------------------------------------------------------


async def test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids(
    client,
):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        pl = await _insert_playlist(dsn, name="pl-blocked")
        sid = await _insert_schedule(dsn, playlist_id=pl)

        r = await client.delete(
            f"/api/signage/playlists/{pl}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 409, r.text
        body = r.json()
        assert body["detail"] == "playlist has active schedules"
        assert str(sid) in body["schedule_ids"]

        # Playlist still exists — the RESTRICT FK blocked the delete
        conn = await asyncpg.connect(dsn=dsn)
        try:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM signage_playlists WHERE id=$1", pl
            )
        finally:
            await conn.close()
        assert n == 1
    finally:
        await _cleanup(dsn)


async def test_delete_playlist_409_body_shape(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        pl = await _insert_playlist(dsn, name="pl-shape")
        sid_1 = await _insert_schedule(dsn, playlist_id=pl, priority=1)
        sid_2 = await _insert_schedule(dsn, playlist_id=pl, priority=2)

        r = await client.delete(
            f"/api/signage/playlists/{pl}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 409, r.text
        body = r.json()
        assert set(body.keys()) == {"detail", "schedule_ids"}
        assert isinstance(body["detail"], str)
        assert isinstance(body["schedule_ids"], list)
        assert all(isinstance(x, str) for x in body["schedule_ids"])
        assert set(body["schedule_ids"]) == {str(sid_1), str(sid_2)}
    finally:
        await _cleanup(dsn)
