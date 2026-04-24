"""SSE-04 integration tests: Directus REST mutations fan out to Pi SSE within 500 ms.
SSE-06 reconnect smoke test.
Calibration-no-double-fire regression test (protects D-07 WHEN clause).

Prerequisites: `docker compose up -d` — full stack running with v1.22 migrations + triggers.

These tests require a live docker compose stack. Run:
    docker compose up -d
    pytest backend/tests/signage/test_pg_listen_sse.py -v

To skip the slow reconnect test:
    pytest backend/tests/signage/test_pg_listen_sse.py -v -m "not slow"
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator

import httpx
import pytest
import pytest_asyncio

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — LOCKED per D-17 (500 ms hard ceiling in CI).
# A flake here is real signal, not noise to be smoothed over.
# ---------------------------------------------------------------------------

SSE_TIMEOUT_MS = 500  # hard ceiling per D-17
SSE_TIMEOUT_S = SSE_TIMEOUT_MS / 1000  # 0.5

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
DIRECTUS_BASE_URL = os.environ.get("DIRECTUS_BASE_URL", "http://localhost:8055")
DIRECTUS_ADMIN_EMAIL = os.environ.get("DIRECTUS_ADMIN_EMAIL", "admin@example.com")
DIRECTUS_ADMIN_PASSWORD = os.environ.get("DIRECTUS_ADMIN_PASSWORD", "admin_test_pw")

# ---------------------------------------------------------------------------
# Table -> expected SSE event name mapping (6 surfaced signage tables).
# Source: interfaces section of 65-05-PLAN.md.
# ---------------------------------------------------------------------------

TABLE_EVENT_CASES = [
    ("signage_playlists", "playlist-changed"),
    ("signage_playlist_items", "playlist-changed"),
    ("signage_playlist_tag_map", "playlist-changed"),
    ("signage_device_tag_map", "device-changed"),
    ("signage_schedules", "schedule-changed"),
    ("signage_devices", "device-changed"),
]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class Device:
    id: str
    name: str
    playlist_id: str | None = None
    tag_id: str | None = None
    schedule_id: str | None = None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def directus_admin_token() -> str:
    """Obtain a Directus admin access token via the REST login endpoint."""
    resp = httpx.post(
        f"{DIRECTUS_BASE_URL}/auth/login",
        json={"email": DIRECTUS_ADMIN_EMAIL, "password": DIRECTUS_ADMIN_PASSWORD},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get("data", {}).get("access_token") or data.get("access_token")
    if not token:
        pytest.fail(f"Could not parse access_token from Directus login response: {data}")
    return token


@pytest_asyncio.fixture(scope="session")
async def paired_device(directus_admin_token: str) -> Device:
    """Seed a signage_device + playlist + tag + schedule for this test session.

    Uses fixed test UUIDs so the records are idempotent across re-runs.
    """
    headers = {"Authorization": f"Bearer {directus_admin_token}"}
    device_id = str(uuid.UUID("eeee0001-0000-4000-a000-000000000001"))
    playlist_id = str(uuid.UUID("eeee0002-0000-4000-a000-000000000001"))
    tag_id = str(uuid.UUID("eeee0003-0000-4000-a000-000000000001"))
    schedule_id = str(uuid.UUID("eeee0004-0000-4000-a000-000000000001"))

    async with httpx.AsyncClient(headers=headers, base_url=DIRECTUS_BASE_URL, timeout=15) as c:
        # Ensure playlist exists
        r = await c.get(f"/items/signage_playlists/{playlist_id}")
        if r.status_code == 404:
            await c.post("/items/signage_playlists", json={"id": playlist_id, "name": "Test Playlist SSE"})

        # Ensure device exists (linked to playlist)
        r = await c.get(f"/items/signage_devices/{device_id}")
        if r.status_code == 404:
            await c.post(
                "/items/signage_devices",
                json={"id": device_id, "name": "Test SSE Device", "paired": True},
            )

        # Ensure tag exists
        r = await c.get(f"/items/signage_device_tags/{tag_id}")
        if r.status_code == 404:
            await c.post("/items/signage_device_tags", json={"id": tag_id, "name": "test-sse-tag"})

        # Ensure schedule exists (linked to playlist)
        r = await c.get(f"/items/signage_schedules/{schedule_id}")
        if r.status_code == 404:
            await c.post(
                "/items/signage_schedules",
                json={
                    "id": schedule_id,
                    "playlist_id": playlist_id,
                    "device_id": device_id,
                    "day_of_week": 0,
                    "start_time": "09:00:00",
                    "end_time": "17:00:00",
                },
            )

    return Device(
        id=device_id,
        name="Test SSE Device",
        playlist_id=playlist_id,
        tag_id=tag_id,
        schedule_id=schedule_id,
    )


class SSEStream:
    """Async iterator over SSE frames from an httpx streaming response."""

    def __init__(self, response: httpx.Response) -> None:
        self._response = response
        self._buffer: list[dict] = []

    async def next_frame(self) -> dict:
        """Read lines until a complete SSE event is assembled, then return parsed dict."""
        event_name: str | None = None
        data_lines: list[str] = []

        async for line in self._response.aiter_lines():
            line = line.strip()
            if line.startswith("event:"):
                event_name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_lines.append(line[len("data:"):].strip())
            elif line == "" and (event_name or data_lines):
                # End of one SSE event
                raw_data = "\n".join(data_lines)
                try:
                    parsed = json.loads(raw_data) if raw_data else {}
                except json.JSONDecodeError:
                    parsed = {"raw": raw_data}
                return {"event": event_name, "data": parsed}

        raise RuntimeError("SSE stream ended without a complete event")


@asynccontextmanager
async def open_sse_stream(device_id: str) -> AsyncIterator[SSEStream]:
    """Open an SSE subscription to /api/signage/player/stream for `device_id`."""
    device_jwt = _get_device_jwt(device_id)
    headers = {"Authorization": f"Bearer {device_jwt}"}
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=60) as client:
        async with client.stream(
            "GET",
            f"/api/signage/player/stream",
            headers=headers,
            params={"device_id": device_id},
        ) as response:
            response.raise_for_status()
            yield SSEStream(response)


def _get_device_jwt(device_id: str) -> str:
    """Obtain a device JWT from the FastAPI pair/heartbeat endpoint or env."""
    # Use env override for tests (set DEVICE_JWT_<id> or DEVICE_JWT_DEFAULT)
    env_key = f"DEVICE_JWT_{device_id.replace('-', '_').upper()}"
    token = os.environ.get(env_key) or os.environ.get("DEVICE_JWT_DEFAULT")
    if token:
        return token
    # Fall back to requesting a device token via pair endpoint (test env)
    resp = httpx.post(
        f"{API_BASE_URL}/api/signage/pair",
        json={"device_id": device_id, "name": "Test SSE Device"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json().get("token", "")
    # If pair returns a JWT in a different field
    return resp.json().get("access_token", "test-device-jwt-placeholder")


async def issue_mutation_for(
    table: str,
    token: str,
    device: Device,
) -> None:
    """Issue a Directus REST mutation on `table` that should trigger an SSE event
    for the given `device`.

    Each mutation is designed to route through the LISTEN/NOTIFY trigger and
    resolve to `device.id` via the signage resolver.
    """
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(headers=headers, base_url=DIRECTUS_BASE_URL, timeout=10) as c:
        if table == "signage_playlists":
            # Update the playlist linked to device's schedule
            await c.patch(
                f"/items/signage_playlists/{device.playlist_id}",
                json={"name": f"Test Playlist SSE {time.time()}"},
            )
        elif table == "signage_playlist_items":
            # Insert a playlist item (UPSERT pattern)
            await c.post(
                "/items/signage_playlist_items",
                json={
                    "playlist_id": device.playlist_id,
                    "media_id": str(uuid.uuid4()),
                    "position": 1,
                },
            )
        elif table == "signage_playlist_tag_map":
            # Insert a playlist<->tag mapping row
            tag_id = str(uuid.uuid4())
            # Create temp tag
            await c.post("/items/signage_device_tags", json={"id": tag_id, "name": f"tmp-{time.time()}"})
            await c.post(
                "/items/signage_playlist_tag_map",
                json={"playlist_id": device.playlist_id, "tag_id": tag_id},
            )
        elif table == "signage_device_tag_map":
            # Insert a device<->tag mapping row
            await c.post(
                "/items/signage_device_tag_map",
                json={"device_id": device.id, "tag_id": device.tag_id},
            )
        elif table == "signage_schedules":
            # Update the schedule linked to this device's playlist
            await c.patch(
                f"/items/signage_schedules/{device.schedule_id}",
                json={"start_time": f"0{time.time() % 9:.0f}:00:00"},
            )
        elif table == "signage_devices":
            # Change device name only (WHEN clause: OLD.name IS DISTINCT FROM NEW.name)
            await c.patch(
                f"/items/signage_devices/{device.id}",
                json={"name": f"Test SSE Device {time.time()}"},
            )


# ---------------------------------------------------------------------------
# Task 1a: 6 SSE latency tests — one per surfaced signage table.
# LOCKED: SSE_TIMEOUT_MS = 500 per D-17. Flakes are real signal.
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.parametrize("table,expected_event", TABLE_EVENT_CASES)
@pytest.mark.asyncio
async def test_directus_mutation_fires_sse_within_500ms(
    table: str,
    expected_event: str,
    directus_admin_token: str,
    paired_device: Device,
) -> None:
    """SSE-04: Directus REST mutation on `table` must fan out to the subscribed
    Pi SSE stream within SSE_TIMEOUT_MS (500 ms). Hard ceiling per D-17.
    """
    async with open_sse_stream(paired_device.id) as stream:
        t0 = time.monotonic()
        # Issue the Directus mutation AFTER subscribing
        await issue_mutation_for(table, directus_admin_token, paired_device)

        frame = await asyncio.wait_for(
            stream.next_frame(),
            timeout=SSE_TIMEOUT_S,
        )
        elapsed_ms = (time.monotonic() - t0) * 1000

        assert frame["event"] == expected_event, (
            f"expected event={expected_event!r} for table={table!r}, got {frame['event']!r}"
        )
        assert elapsed_ms < SSE_TIMEOUT_MS, (
            f"SSE latency {elapsed_ms:.0f} ms exceeds {SSE_TIMEOUT_MS} ms ceiling (D-17) "
            f"for table={table!r} -> event={expected_event!r}"
        )


# ---------------------------------------------------------------------------
# Task 1b: Calibration-no-double-fire regression.
# Protects the D-07 WHEN clause: signage_devices trigger fires only on name/tags changes.
# PATCH /api/signage/devices/<id>/calibration must not produce device-changed.
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_calibration_patch_fires_single_frame_no_device_changed_double(
    paired_device: Device,
) -> None:
    """Calibration PATCH -> exactly ONE calibration-changed frame.
    NO subsequent device-changed within 500 ms (D-07: WHEN clause guards name/tags only).
    """
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as api_client:
        async with open_sse_stream(paired_device.id) as stream:
            # PATCH the calibration endpoint
            device_jwt = _get_device_jwt(paired_device.id)
            r = await api_client.patch(
                f"/api/signage/devices/{paired_device.id}/calibration",
                json={"rotation": 90},
                headers={"Authorization": f"Bearer {device_jwt}"},
            )
            assert r.status_code in (200, 204), f"calibration PATCH failed: {r.status_code}"

            # First frame must be calibration-changed
            first = await asyncio.wait_for(stream.next_frame(), timeout=2.0)
            assert first["event"] == "calibration-changed", (
                f"expected calibration-changed as first frame, got {first['event']!r}"
            )

            # Assert NO follow-up device-changed within SSE_TIMEOUT_MS
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(stream.next_frame(), timeout=SSE_TIMEOUT_S)


# ---------------------------------------------------------------------------
# Task 1c: Reconnect smoke test.
# SSE-06: listener reconnects within 10s of DB bounce; re-subscribes and
# resumes fan-out.
# Marked @pytest.mark.slow — skip with `pytest -m "not slow"`.
# ---------------------------------------------------------------------------


@pytest.mark.slow
@pytest.mark.integration
@pytest.mark.asyncio
async def test_listener_reconnects_after_db_bounce(
    directus_admin_token: str,
    paired_device: Device,
) -> None:
    """SSE-06 reconnect smoke test.

    Simulates a DB connection drop by sending SIGKILL to the postgres container
    (via docker compose restart), then asserts:
    1. `signage_pg_listen: reconnecting` appears in API container logs within 10s.
    2. Listener re-subscribes (subscribed log within 30s).
    3. Fresh Directus mutation still produces an SSE frame on the stream.

    Requires docker socket access (CI must mount /var/run/docker.sock or use DinD).
    """
    import subprocess

    # Step 1: Force reconnect by bouncing the DB container
    subprocess.run(
        ["docker", "compose", "restart", "db"],
        check=True,
        timeout=30,
    )

    # Step 2: Poll API container logs for reconnecting message
    deadline = time.monotonic() + 10
    reconnected = False
    while time.monotonic() < deadline:
        logs = subprocess.run(
            ["docker", "compose", "logs", "--tail", "50", "api"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if "signage_pg_listen: reconnecting" in logs.stdout:
            reconnected = True
            break
        await asyncio.sleep(0.5)

    if not reconnected:
        pytest.fail("expected 'signage_pg_listen: reconnecting' in API logs within 10s after DB bounce")

    # Step 3: Wait for re-subscribe confirmation
    deadline = time.monotonic() + 30
    resubscribed = False
    while time.monotonic() < deadline:
        logs = subprocess.run(
            ["docker", "compose", "logs", "--tail", "50", "api"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if "signage_pg_listen: subscribed to signage_change" in logs.stdout:
            resubscribed = True
            break
        await asyncio.sleep(1.0)

    if not resubscribed:
        pytest.fail("listener did not re-subscribe within 30s after DB bounce")

    # Step 4: Confirm SSE fan-out still works after reconnect
    async with open_sse_stream(paired_device.id) as stream:
        await issue_mutation_for("signage_playlists", directus_admin_token, paired_device)
        frame = await asyncio.wait_for(stream.next_frame(), timeout=2.0)
        assert frame["event"] == "playlist-changed", (
            f"expected playlist-changed after reconnect, got {frame['event']!r}"
        )
