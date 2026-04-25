"""Phase 68 MIG-SIGN-01/02 D-08: Admin Directus CRUD smoke.

Asserts Admin (admin_access: true) can fully CRUD signage_device_tags
and signage_schedules via Directus REST. If a 401/403 surfaces,
add explicit Admin permission rows in directus/bootstrap-roles.sh §6.

Requires `docker compose up -d` (full stack with Plan 01/03 routers
removed and snapshot applied).
"""
from __future__ import annotations

import os
import time

import httpx
import pytest

DIRECTUS_BASE_URL = os.environ.get("DIRECTUS_BASE_URL", "http://localhost:8055")
DIRECTUS_ADMIN_EMAIL = os.environ.get("DIRECTUS_ADMIN_EMAIL", "admin@example.com")
DIRECTUS_ADMIN_PASSWORD = os.environ.get("DIRECTUS_ADMIN_PASSWORD", "admin_test_pw")


@pytest.fixture(scope="session")
def directus_admin_token() -> str:
    with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
        r = c.post("/auth/login", json={
            "email": DIRECTUS_ADMIN_EMAIL,
            "password": DIRECTUS_ADMIN_PASSWORD,
        })
        r.raise_for_status()
        return r.json()["data"]["access_token"]


def _hdr(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


def test_admin_can_crud_signage_device_tags(directus_admin_token: str) -> None:
    name_a = f"phase68-smoke-{int(time.time() * 1000)}"
    name_b = f"{name_a}-renamed"
    with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
        r = c.post(
            "/items/signage_device_tags",
            headers=_hdr(directus_admin_token),
            json={"name": name_a},
        )
        assert r.status_code in (200, 201), (
            f"create failed (D-08 fallback?): {r.status_code} {r.text}"
        )
        tag_id = r.json()["data"]["id"]

        r = c.patch(
            f"/items/signage_device_tags/{tag_id}",
            headers=_hdr(directus_admin_token),
            json={"name": name_b},
        )
        assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"

        r = c.delete(
            f"/items/signage_device_tags/{tag_id}",
            headers=_hdr(directus_admin_token),
        )
        assert r.status_code == 204, f"delete failed: {r.status_code} {r.text}"

        r = c.get(
            f"/items/signage_device_tags/{tag_id}",
            headers=_hdr(directus_admin_token),
        )
        # Directus returns 403 (Forbidden) for GET on a missing row by design
        # (avoids leaking existence). Either 404 or 403 confirms the row is gone.
        assert r.status_code in (403, 404), (
            f"row should be gone: {r.status_code} {r.text}"
        )


def test_admin_can_crud_signage_schedules(directus_admin_token: str) -> None:
    # Reuse any existing playlist or create a transient one via Directus.
    transient_playlist_id: str | None = None
    with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
        r = c.get(
            "/items/signage_playlists?limit=1&fields=id",
            headers=_hdr(directus_admin_token),
        )
        r.raise_for_status()
        rows = r.json()["data"]
        if rows:
            playlist_id = rows[0]["id"]
        else:
            r = c.post(
                "/items/signage_playlists",
                headers=_hdr(directus_admin_token),
                json={"name": f"phase68-smoke-pl-{int(time.time() * 1000)}"},
            )
            assert r.status_code in (200, 201), (
                f"playlist create failed (D-08 fallback?): {r.status_code} {r.text}"
            )
            playlist_id = r.json()["data"]["id"]
            transient_playlist_id = playlist_id

        r = c.post(
            "/items/signage_schedules",
            headers=_hdr(directus_admin_token),
            json={
                "playlist_id": playlist_id,
                "weekday_mask": 127,
                "start_hhmm": 600,
                "end_hhmm": 720,
                "priority": 10,
                "enabled": True,
            },
        )
        assert r.status_code in (200, 201), (
            f"create failed (D-08 fallback?): {r.status_code} {r.text}"
        )
        sched_id = r.json()["data"]["id"]

        r = c.patch(
            f"/items/signage_schedules/{sched_id}",
            headers=_hdr(directus_admin_token),
            json={"priority": 20},
        )
        assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"

        r = c.delete(
            f"/items/signage_schedules/{sched_id}",
            headers=_hdr(directus_admin_token),
        )
        assert r.status_code == 204, f"delete failed: {r.status_code} {r.text}"

        # Cleanup transient playlist if we created one.
        if transient_playlist_id is not None:
            c.delete(
                f"/items/signage_playlists/{transient_playlist_id}",
                headers=_hdr(directus_admin_token),
            )
