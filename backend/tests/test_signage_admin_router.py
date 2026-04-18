"""Integration tests for /api/signage admin CRUD router — SGN-BE-01.

Covers:
  - Admin gate matrix (admin 201 / viewer 403 / no-jwt 401)
  - Media DELETE 404 / 409-with-playlist_ids / 204
  - Bulk-replace playlist items atomic (D-17)
  - Bulk-replace device tags + playlist tags atomic (D-18)

Seeds via asyncpg; drives via the project's async `client` fixture.
Skips cleanly when POSTGRES_* is unset so `pytest --collect-only` passes
on a partial tree.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
import pytest_asyncio

from tests.test_directus_auth import _mint, ADMIN_UUID, VIEWER_UUID


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
        pytest.skip("POSTGRES_* not set — admin router tests need a live DB")
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
        # Order: maps first, then items, playlists, media, devices, tags.
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


async def _insert_media(dsn: str, *, title: str = "m", kind: str = "image") -> uuid.UUID:
    mid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_media (id, kind, title, uri) VALUES ($1, $2, $3, $4)",
            mid,
            kind,
            title,
            f"https://example.com/{title}",
        )
    finally:
        await conn.close()
    return mid


async def _insert_playlist(dsn: str, *, name: str = "p") -> uuid.UUID:
    pid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_playlists (id, name) VALUES ($1, $2)",
            pid,
            name,
        )
    finally:
        await conn.close()
    return pid


async def _insert_playlist_item(
    dsn: str, *, playlist_id: uuid.UUID, media_id: uuid.UUID, position: int
) -> uuid.UUID:
    iid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            """
            INSERT INTO signage_playlist_items (id, playlist_id, media_id, position, duration_s)
            VALUES ($1, $2, $3, $4, $5)
            """,
            iid,
            playlist_id,
            media_id,
            position,
            10,
        )
    finally:
        await conn.close()
    return iid


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
            "INSERT INTO signage_device_tags (name) VALUES ($1) RETURNING id",
            name,
        )
    finally:
        await conn.close()


async def _insert_device_tag_map(dsn: str, *, device_id: uuid.UUID, tag_id: int) -> None:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_device_tag_map (device_id, tag_id) VALUES ($1, $2)",
            device_id,
            tag_id,
        )
    finally:
        await conn.close()


async def _count_items(dsn: str, playlist_id: uuid.UUID) -> int:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        return await conn.fetchval(
            "SELECT COUNT(*) FROM signage_playlist_items WHERE playlist_id = $1",
            playlist_id,
        )
    finally:
        await conn.close()


async def _device_tag_ids(dsn: str, device_id: uuid.UUID) -> list[int]:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        rows = await conn.fetch(
            "SELECT tag_id FROM signage_device_tag_map WHERE device_id = $1 ORDER BY tag_id",
            device_id,
        )
    finally:
        await conn.close()
    return [r["tag_id"] for r in rows]


async def _playlist_tag_ids(dsn: str, playlist_id: uuid.UUID) -> list[int]:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        rows = await conn.fetch(
            "SELECT tag_id FROM signage_playlist_tag_map WHERE playlist_id = $1 ORDER BY tag_id",
            playlist_id,
        )
    finally:
        await conn.close()
    return [r["tag_id"] for r in rows]


# ---------------------------------------------------------------------------
# Admin gate matrix (POST /playlists)
# ---------------------------------------------------------------------------


async def test_admin_can_create_playlist(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        r = await client.post(
            "/api/signage/playlists",
            json={"name": "lobby loop", "priority": 1, "enabled": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "lobby loop"
        assert uuid.UUID(body["id"])
    finally:
        await _cleanup(dsn)


async def test_viewer_cannot_create_playlist(client):
    await _require_db()
    token = _mint(VIEWER_UUID)
    r = await client.post(
        "/api/signage/playlists",
        json={"name": "nope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403, r.text
    assert "admin" in r.json().get("detail", "").lower()


async def test_no_jwt_cannot_create_playlist(client):
    await _require_db()
    r = await client.post("/api/signage/playlists", json={"name": "nope"})
    assert r.status_code == 401, r.text


# ---------------------------------------------------------------------------
# Media DELETE: 404 / 409-with-playlist_ids / 204
# ---------------------------------------------------------------------------


async def test_delete_media_404_when_not_found(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        r = await client.delete(
            f"/api/signage/media/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 404, r.text
    finally:
        await _cleanup(dsn)


async def test_delete_media_409_when_referenced(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        media_id = await _insert_media(dsn, title="ref-media")
        playlist_id = await _insert_playlist(dsn, name="pl-ref")
        await _insert_playlist_item(
            dsn, playlist_id=playlist_id, media_id=media_id, position=1
        )

        r = await client.delete(
            f"/api/signage/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 409, r.text
        body = r.json()
        assert body["detail"] == "media in use by playlists"
        assert isinstance(body["playlist_ids"], list)
        assert len(body["playlist_ids"]) >= 1
        # Must contain the seeded playlist id as a UUID string.
        assert str(playlist_id) in body["playlist_ids"]
    finally:
        await _cleanup(dsn)


async def test_delete_media_204_when_unreferenced(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        media_id = await _insert_media(dsn, title="free-media")
        r = await client.delete(
            f"/api/signage/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 204, r.text
        # Row is gone
        conn = await asyncpg.connect(dsn=dsn)
        try:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM signage_media WHERE id = $1", media_id
            )
        finally:
            await conn.close()
        assert n == 0
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# Bulk-replace playlist items (D-17)
# ---------------------------------------------------------------------------


async def test_put_playlist_items_bulk_replaces_atomically(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        playlist_id = await _insert_playlist(dsn, name="bulk-pl")
        m1 = await _insert_media(dsn, title="old-m1")
        m2 = await _insert_media(dsn, title="old-m2")
        m3 = await _insert_media(dsn, title="old-m3")
        await _insert_playlist_item(dsn, playlist_id=playlist_id, media_id=m1, position=1)
        await _insert_playlist_item(dsn, playlist_id=playlist_id, media_id=m2, position=2)
        await _insert_playlist_item(dsn, playlist_id=playlist_id, media_id=m3, position=3)

        new_m1 = await _insert_media(dsn, title="new-m1")
        new_m2 = await _insert_media(dsn, title="new-m2")

        r = await client.put(
            f"/api/signage/playlists/{playlist_id}/items",
            json={
                "items": [
                    {"media_id": str(new_m1), "position": 5, "duration_s": 20},
                    {"media_id": str(new_m2), "position": 6, "duration_s": 15},
                ]
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body) == 2
        positions = [it["position"] for it in body]
        assert positions == [5, 6]
        returned_media_ids = {it["media_id"] for it in body}
        assert returned_media_ids == {str(new_m1), str(new_m2)}

        # Follow-up GET confirms the new state.
        g = await client.get(
            f"/api/signage/playlists/{playlist_id}/items",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert g.status_code == 200, g.text
        items = g.json()
        assert len(items) == 2
        assert [it["position"] for it in items] == [5, 6]

        # DB-side commit: count in DB is exactly 2 (DELETE half of tx ran).
        assert await _count_items(dsn, playlist_id) == 2
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# Bulk-replace device tags (D-18)
# ---------------------------------------------------------------------------


async def test_put_device_tags_bulk_replaces(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        device_id = await _insert_device(dsn, name="dev-a")
        t_a = await _insert_tag(dsn, name="tag-A")
        t_b = await _insert_tag(dsn, name="tag-B")
        t_c = await _insert_tag(dsn, name="tag-C")
        await _insert_device_tag_map(dsn, device_id=device_id, tag_id=t_a)
        await _insert_device_tag_map(dsn, device_id=device_id, tag_id=t_b)

        r = await client.put(
            f"/api/signage/devices/{device_id}/tags",
            json={"tag_ids": [t_c]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tag_ids"] == [t_c]

        assert await _device_tag_ids(dsn, device_id) == [t_c]
    finally:
        await _cleanup(dsn)


# ---------------------------------------------------------------------------
# Bulk-replace playlist tags (D-18)
# ---------------------------------------------------------------------------


async def test_put_playlist_tags_bulk_replaces(client):
    dsn = await _require_db()
    try:
        token = _mint(ADMIN_UUID)
        playlist_id = await _insert_playlist(dsn, name="pl-tags")
        t_a = await _insert_tag(dsn, name="ptag-A")
        t_b = await _insert_tag(dsn, name="ptag-B")
        t_c = await _insert_tag(dsn, name="ptag-C")

        # Seed existing [A, B] via API to exercise the endpoint as well.
        r0 = await client.put(
            f"/api/signage/playlists/{playlist_id}/tags",
            json={"tag_ids": [t_a, t_b]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r0.status_code == 200, r0.text

        r = await client.put(
            f"/api/signage/playlists/{playlist_id}/tags",
            json={"tag_ids": [t_c]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tag_ids"] == [t_c]

        assert await _playlist_tag_ids(dsn, playlist_id) == [t_c]
    finally:
        await _cleanup(dsn)
