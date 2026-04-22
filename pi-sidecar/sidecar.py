"""Pi Sidecar — offline-resilience proxy for the KPI Dashboard signage player.

Listens on 127.0.0.1:8080 (configure via uvicorn CLI — see README).
Proxies /api/signage/player/playlist and /media/<id> with ETag-aware caching.
Serves cached content when upstream is unreachable.
Accepts the device JWT via POST /token.
Runs background heartbeat (60s) and connectivity probe (10s) tasks.

On-disk layout under SIGNAGE_CACHE_DIR (default /var/lib/signage/):
  device_token    mode 0600 — raw JWT
  playlist.json   mode 0600 — last PlaylistEnvelope JSON
  playlist.etag   mode 0600 — last ETag value (no quotes)
  media/          mode 0700
    <uuid>        mode 0600 — raw media bytes

Environment:
  SIGNAGE_API_BASE   required at runtime (e.g. http://192.168.1.100:8000)
  SIGNAGE_CACHE_DIR  default /var/lib/signage
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import stat
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from httpx_sse import aconnect_sse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE: str = os.environ.get("SIGNAGE_API_BASE", "").rstrip("/")
CACHE_DIR: Path = Path(os.environ.get("SIGNAGE_CACHE_DIR", "/var/lib/signage"))

# ---------------------------------------------------------------------------
# Module-level state (single-device sidecar)
# ---------------------------------------------------------------------------

_device_token: Optional[str] = None
_online: bool = False
_playlist_body: Optional[bytes] = None
_playlist_etag: Optional[str] = None
_cached_media_ids: set = set()

# Consecutive upstream health probe failures
_probe_fail_count: int = 0
_PROBE_FAIL_THRESHOLD = 3

# Calibration state (Phase 62-03)
_CALIBRATION_FILE = "calibration.json"
_calibration_last_error: Optional[str] = None
_calibration_last_applied_at: Optional[str] = None
_audio_backend: Optional[str] = None  # "wpctl" | "pactl" | None — pinned at startup (D-03)
_wlr_output_name: Optional[str] = None  # cached on first successful discovery

logger = logging.getLogger("sidecar")
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# Disk helpers
# ---------------------------------------------------------------------------

def _cache_dir() -> Path:
    """Return the effective cache dir (reads env each time for test isolation)."""
    return Path(os.environ.get("SIGNAGE_CACHE_DIR", "/var/lib/signage"))


def _api_base() -> str:
    return os.environ.get("SIGNAGE_API_BASE", "").rstrip("/")


def _ensure_dirs() -> None:
    d = _cache_dir()
    d.mkdir(mode=0o700, parents=True, exist_ok=True)
    (d / "media").mkdir(mode=0o700, parents=True, exist_ok=True)


def _write_secure(path: Path, data: bytes | str) -> None:
    """Write file and chmod to 0o600."""
    if isinstance(data, str):
        data = data.encode()
    path.write_bytes(data)
    os.chmod(path, 0o600)


def _read_token() -> Optional[str]:
    path = _cache_dir() / "device_token"
    if path.exists():
        return path.read_text().strip() or None
    return None


def _load_playlist_cache() -> tuple[Optional[bytes], Optional[str]]:
    d = _cache_dir()
    body_path = d / "playlist.json"
    etag_path = d / "playlist.etag"
    body = body_path.read_bytes() if body_path.exists() else None
    etag = etag_path.read_text().strip() if etag_path.exists() else None
    return body, etag


def _save_playlist_cache(body: bytes, etag: str) -> None:
    d = _cache_dir()
    _write_secure(d / "playlist.json", body)
    _write_secure(d / "playlist.etag", etag.strip('"'))


def _load_cached_media_ids() -> set:
    media_dir = _cache_dir() / "media"
    if not media_dir.exists():
        return set()
    return {f.name for f in media_dir.iterdir() if f.is_file()}


# ---------------------------------------------------------------------------
# Calibration persistence (Phase 62-03, D-06)
# ---------------------------------------------------------------------------

def _load_calibration() -> Optional[dict]:
    """Read persisted calibration JSON or return None if absent/corrupt."""
    path = _cache_dir() / _CALIBRATION_FILE
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load persisted calibration: %s", exc)
        return None


def _save_calibration(cal: dict) -> None:
    """Persist calibration JSON to disk at mode 0o600."""
    _write_secure(_cache_dir() / _CALIBRATION_FILE, json.dumps(cal))


def _detect_audio_backend() -> Optional[str]:
    """Probe for wpctl (preferred) then pactl; pin choice for process lifetime (D-03)."""
    if shutil.which("wpctl"):
        return "wpctl"
    if shutil.which("pactl"):
        return "pactl"
    return None


async def _wait_for_wayland_socket(timeout: float = 15.0) -> bool:
    """Bounded poll for the Wayland socket at $XDG_RUNTIME_DIR/wayland-0.

    systemd `After=labwc.service` only guarantees start-order, not that the
    compositor has finished creating its socket. This helper closes that race
    without introducing indefinite blocking.

    Returns True once the socket appears. Returns False after `timeout`
    seconds; also sets `_calibration_last_error` so the next heartbeat
    surfaces the problem (Flag 1 fix).
    """
    global _calibration_last_error

    runtime_dir = os.environ.get("XDG_RUNTIME_DIR")
    if not runtime_dir:
        try:
            runtime_dir = f"/run/user/{os.getuid()}"
        except AttributeError:
            runtime_dir = "/run/user/0"

    wl_display = os.environ.get("WAYLAND_DISPLAY", "wayland-0")
    socket_path = Path(runtime_dir) / wl_display

    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        if socket_path.exists():
            return True
        await asyncio.sleep(0.2)

    logger.warning(
        "Wayland socket not available after %.1fs; calibration replay will be skipped this boot",
        timeout,
    )
    _calibration_last_error = "wayland socket unavailable at boot"
    return False


# ---------------------------------------------------------------------------
# Calibration apply (Phase 62-03, D-01/D-02/D-03/D-09)
# ---------------------------------------------------------------------------

async def _run_async(*argv: str, timeout: float = 5.0) -> tuple[int, bytes, bytes]:
    """Run argv via asyncio.create_subprocess_exec with a hard timeout.

    NEVER uses subprocess.run — cross-cutting hazard #7 (sync subprocess in
    async sidecar causes event-loop stalls).
    """
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        return -1, b"", f"timeout after {timeout}s".encode()
    return proc.returncode or 0, stdout, stderr


async def _discover_wlr_output() -> Optional[str]:
    """Parse `wlr-randr --json` and return the first enabled output's name.

    Result cached in module state `_wlr_output_name` on first success.
    """
    global _wlr_output_name, _calibration_last_error

    if _wlr_output_name:
        return _wlr_output_name

    rc, stdout, stderr = await _run_async("wlr-randr", "--json", timeout=5.0)
    if rc != 0:
        _calibration_last_error = f"wlr-randr --json: {stderr.decode(errors='replace').strip() or rc}"
        return None
    try:
        outputs = json.loads(stdout.decode(errors="replace"))
    except json.JSONDecodeError as exc:
        _calibration_last_error = f"wlr-randr --json parse: {exc}"
        return None

    for o in outputs:
        if o.get("enabled"):
            _wlr_output_name = o.get("name")
            return _wlr_output_name
    # Fallback: first output regardless
    if outputs:
        _wlr_output_name = outputs[0].get("name")
        return _wlr_output_name
    return None


async def _apply_calibration(cal: dict) -> None:
    """Apply calibration to the display via wlr-randr + wpctl/pactl.

    D-01 rotation: wlr-randr --output <name> --transform <N>
    D-02 HDMI mode: wlr-randr --output <name> --mode <mode>
    D-03 audio:   wpctl set-mute @DEFAULT_AUDIO_SINK@ <0|1>
                  (or pactl set-sink-mute @DEFAULT_SINK@ <0|1>)
    D-09 errors: recorded on _calibration_last_error; NOT retried (next SSE
        event is the retry trigger).
    """
    global _calibration_last_error, _calibration_last_applied_at

    errors: list[str] = []
    touched = False

    rotation = cal.get("rotation")
    hdmi_mode = cal.get("hdmi_mode")
    audio_enabled = cal.get("audio_enabled")

    # Discover output only if we'll actually use it
    output_name: Optional[str] = None
    if rotation in (0, 90, 180, 270) or hdmi_mode:
        output_name = await _discover_wlr_output()
        if not output_name:
            # _discover_wlr_output already set _calibration_last_error
            return

    if rotation in (0, 90, 180, 270):
        rc, _, stderr = await _run_async(
            "wlr-randr", "--output", output_name, "--transform", str(rotation),
            timeout=5.0,
        )
        touched = True
        if rc != 0:
            errors.append(f"wlr-randr --transform: {stderr.decode(errors='replace').strip() or rc}")

    if hdmi_mode:
        rc, _, stderr = await _run_async(
            "wlr-randr", "--output", output_name, "--mode", hdmi_mode,
            timeout=5.0,
        )
        touched = True
        if rc != 0:
            errors.append(f"wlr-randr --mode: {stderr.decode(errors='replace').strip() or rc}")

    if audio_enabled is not None:
        mute_flag = "0" if audio_enabled else "1"
        if _audio_backend == "wpctl":
            rc, _, stderr = await _run_async(
                "wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", mute_flag, timeout=5.0,
            )
            touched = True
            if rc != 0:
                errors.append(f"wpctl set-mute: {stderr.decode(errors='replace').strip() or rc}")
        elif _audio_backend == "pactl":
            rc, _, stderr = await _run_async(
                "pactl", "set-sink-mute", "@DEFAULT_SINK@", mute_flag, timeout=5.0,
            )
            touched = True
            if rc != 0:
                errors.append(f"pactl set-sink-mute: {stderr.decode(errors='replace').strip() or rc}")
        else:
            errors.append("audio backend unavailable (neither wpctl nor pactl)")
            touched = True

    if errors:
        # D-09: do NOT retry; wait for next calibration-changed event.
        _calibration_last_error = "; ".join(errors)
        return

    if touched:
        try:
            _save_calibration(cal)
        except OSError as exc:
            logger.warning("Failed to persist calibration: %s", exc)
        _calibration_last_applied_at = datetime.now(timezone.utc).isoformat()
        _calibration_last_error = None


async def _replay_persisted_calibration() -> None:
    """On boot: replay last-persisted calibration BEFORE network probes run (D-06)."""
    cal = _load_calibration()
    if cal is None:
        return
    logger.info("Replaying persisted calibration on boot: %s", cal)
    await _apply_calibration(cal)


# ---------------------------------------------------------------------------
# Media pruning (Pitfall 9)
# ---------------------------------------------------------------------------

async def _prune_media_cache(new_ids: set) -> None:
    """Delete cached media files whose UUID is not in new_ids."""
    global _cached_media_ids
    media_dir = _cache_dir() / "media"
    to_delete = _cached_media_ids - new_ids
    for media_id in to_delete:
        path = media_dir / media_id
        try:
            path.unlink(missing_ok=True)
            logger.info("Pruned media cache: %s", media_id)
        except Exception as exc:
            logger.warning("Failed to prune %s: %s", media_id, exc)
    _cached_media_ids = _cached_media_ids & new_ids


# ---------------------------------------------------------------------------
# Background tasks
# ---------------------------------------------------------------------------

async def _connectivity_probe_loop() -> None:
    """Poll upstream /api/health every 10s; 3 consecutive failures → offline."""
    global _online, _probe_fail_count
    while True:
        await asyncio.sleep(10)
        base = _api_base()
        if not base:
            continue
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{base}/api/health", timeout=5.0)
            if r.status_code < 500:
                _online = True
                _probe_fail_count = 0
            else:
                _probe_fail_count += 1
        except (httpx.ConnectError, httpx.TimeoutException, Exception):
            _probe_fail_count += 1
        if _probe_fail_count >= _PROBE_FAIL_THRESHOLD:
            _online = False


async def _playlist_refresh_loop() -> None:
    """Poll upstream playlist every 30s when online; update cache + prune media."""
    global _playlist_body, _playlist_etag, _cached_media_ids
    while True:
        await asyncio.sleep(30)
        token = _device_token
        if not _online or not token:
            continue
        base = _api_base()
        if not base:
            continue
        try:
            headers = {"Authorization": f"Bearer {token}"}
            if _playlist_etag:
                headers["If-None-Match"] = f'"{_playlist_etag}"'
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{base}/api/signage/player/playlist",
                    headers=headers,
                    timeout=10.0,
                )
            if r.status_code == 200:
                etag_raw = r.headers.get("ETag", "").strip('"')
                body = r.content
                _save_playlist_cache(body, etag_raw)
                _playlist_body = body
                _playlist_etag = etag_raw
                # Extract media IDs and prune stale ones
                try:
                    envelope = json.loads(body)
                    new_ids = {
                        str(it["media_id"])
                        for it in envelope.get("items", [])
                        if it.get("media_id")
                    }
                    await _prune_media_cache(new_ids)
                    # Schedule pre-fetch for new media
                    for mid in new_ids - _cached_media_ids:
                        asyncio.create_task(_prefetch_media(mid, token, base))
                    _cached_media_ids = new_ids | _cached_media_ids
                except Exception as exc:
                    logger.warning("Playlist parse error during refresh: %s", exc)
            # 304 means no change — keep existing cache
        except Exception as exc:
            logger.warning("Playlist refresh error: %s", exc)


async def _heartbeat_loop() -> None:
    """POST heartbeat to upstream every 60s when token is set."""
    while True:
        await asyncio.sleep(60)
        token = _device_token
        if not token:
            continue
        base = _api_base()
        if not base:
            continue
        body: dict = {}
        if _calibration_last_error is not None:
            body["calibration_last_error"] = _calibration_last_error
        if _calibration_last_applied_at is not None:
            body["calibration_last_applied_at"] = _calibration_last_applied_at
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{base}/api/signage/player/heartbeat",
                    headers={"Authorization": f"Bearer {token}"},
                    json=body,
                    timeout=5.0,
                )
        except Exception as exc:
            logger.debug("Heartbeat fire-and-forget error (suppressed): %s", exc)


async def _calibration_sse_loop() -> None:
    """Subscribe to /api/signage/player/stream; on `calibration-changed` event,
    fetch full calibration state and apply it (D-04, D-08).

    Reuses the existing device JWT (same token the player uses).
    On any disconnect or error, sleep 5s and retry — matches the
    _playlist_refresh_loop resilience posture.
    """
    while True:
        token = _device_token
        base = _api_base()
        if not token or not base or not _online:
            await asyncio.sleep(5)
            continue
        headers = {"Authorization": f"Bearer {token}", "Accept": "text/event-stream"}
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with aconnect_sse(
                    client, "GET", f"{base}/api/signage/player/stream", headers=headers,
                ) as event_source:
                    async for sse in event_source.aiter_sse():
                        try:
                            payload = sse.json()
                        except (ValueError, json.JSONDecodeError):
                            continue
                        if payload.get("event") != "calibration-changed":
                            continue
                        # Fetch full calibration state per D-08
                        try:
                            async with httpx.AsyncClient() as fetch_client:
                                r = await fetch_client.get(
                                    f"{base}/api/signage/player/calibration",
                                    headers={"Authorization": f"Bearer {token}"},
                                    timeout=10.0,
                                )
                            if r.status_code == 200:
                                await _apply_calibration(r.json())
                            else:
                                logger.warning(
                                    "Calibration fetch returned %s", r.status_code,
                                )
                        except httpx.HTTPError as exc:
                            logger.warning("Calibration fetch failed: %s", exc)
        except asyncio.CancelledError:
            raise
        except (httpx.HTTPError, Exception) as exc:
            logger.warning("Calibration SSE stream error: %s", exc)
        await asyncio.sleep(5)


async def _prefetch_media(media_id: str, token: str, base: str) -> None:
    """Pre-fetch a media asset into cache (background, non-blocking)."""
    global _cached_media_ids
    dest = _cache_dir() / "media" / media_id
    if dest.exists():
        _cached_media_ids.add(media_id)
        return
    try:
        url = f"{base}/api/signage/player/asset/{media_id}?token={token}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=30.0)
        if r.status_code == 200:
            _write_secure(dest, r.content)
            _cached_media_ids.add(media_id)
            logger.info("Pre-fetched media: %s", media_id)
    except Exception as exc:
        logger.warning("Pre-fetch failed for %s: %s", media_id, exc)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: load persisted state. Shutdown: cancel background tasks."""
    global _device_token, _playlist_body, _playlist_etag, _cached_media_ids, _online

    _ensure_dirs()

    # Load persisted token
    persisted_token = _read_token()
    if persisted_token:
        _device_token = persisted_token
        logger.info("Loaded persisted device token from disk.")

    # Load cached playlist
    body, etag = _load_playlist_cache()
    if body:
        _playlist_body = body
        _playlist_etag = etag

    # Load cached media IDs
    _cached_media_ids = _load_cached_media_ids()

    # Calibration boot sequence (Phase 62-03, D-06 + Flag 1 fix)
    global _audio_backend
    _audio_backend = _detect_audio_backend()
    logger.info("Audio backend pinned: %s", _audio_backend)
    wayland_ready = await _wait_for_wayland_socket(timeout=15.0)
    if wayland_ready:
        # Replay persisted calibration BEFORE any network-dependent task spawns.
        await _replay_persisted_calibration()

    # Start background tasks
    probe_task = asyncio.create_task(_connectivity_probe_loop())
    refresh_task = asyncio.create_task(_playlist_refresh_loop())
    heartbeat_task = asyncio.create_task(_heartbeat_loop())
    calibration_task = asyncio.create_task(_calibration_sse_loop())

    yield

    # Shutdown
    probe_task.cancel()
    refresh_task.cancel()
    heartbeat_task.cancel()
    calibration_task.cancel()
    for t in (probe_task, refresh_task, heartbeat_task, calibration_task):
        try:
            await t
        except asyncio.CancelledError:
            pass


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Pi Signage Sidecar", version="1.0.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class TokenRequest(BaseModel):
    token: str


@app.post("/token")
async def post_token(body: TokenRequest) -> JSONResponse:
    """Accept device JWT from the player; persist to disk (mode 0600)."""
    global _device_token
    _device_token = body.token
    token_path = _cache_dir() / "device_token"
    _write_secure(token_path, body.token)
    logger.info("Device token accepted and persisted.")
    return JSONResponse({"accepted": True})


@app.get("/health")
async def get_health() -> JSONResponse:
    """Always 200. Returns {ready, online, cached_items}.

    ready=false when no device token is present (Pitfall 11).
    online reflects last connectivity probe result.
    cached_items is the number of media files in the cache dir.
    """
    ready = _device_token is not None
    return JSONResponse({
        "ready": ready,
        "online": _online,
        "cached_items": len(_cached_media_ids),
    })


@app.get("/api/signage/player/playlist")
async def get_playlist(request: Request) -> Response:
    """ETag-aware playlist proxy.

    Online path:  forward to upstream with If-None-Match; cache 200 responses.
    Offline path: serve from cache; 503 if no cache.
    """
    global _playlist_body, _playlist_etag, _cached_media_ids

    if not _device_token:
        raise HTTPException(status_code=401, detail="no device token")

    client_etag = request.headers.get("If-None-Match", "").strip().strip('"')

    # If client ETag matches our cache, return 304 immediately (no upstream needed).
    if client_etag and _playlist_etag and client_etag == _playlist_etag:
        return Response(
            status_code=304,
            headers={
                "ETag": f'"{_playlist_etag}"',
                "Cache-Control": "no-cache",
            },
        )

    base = _api_base()

    if _online and base:
        # Forward to upstream
        headers: dict[str, str] = {"Authorization": f"Bearer {_device_token}"}
        if _playlist_etag:
            headers["If-None-Match"] = f'"{_playlist_etag}"'
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{base}/api/signage/player/playlist",
                    headers=headers,
                    timeout=10.0,
                )
            if r.status_code == 200:
                etag_raw = r.headers.get("ETag", "").strip().strip('"')
                body = r.content
                _save_playlist_cache(body, etag_raw)
                _playlist_body = body
                _playlist_etag = etag_raw
                # Prune + prefetch
                try:
                    envelope = json.loads(body)
                    new_ids = {
                        str(it["media_id"])
                        for it in envelope.get("items", [])
                        if it.get("media_id")
                    }
                    asyncio.create_task(_prune_media_cache(new_ids - _cached_media_ids))
                    _cached_media_ids = new_ids | _cached_media_ids
                except Exception:
                    pass
                resp_headers = {"Cache-Control": "no-cache"}
                if etag_raw:
                    resp_headers["ETag"] = f'"{etag_raw}"'
                return Response(
                    content=body,
                    status_code=200,
                    headers=resp_headers,
                    media_type="application/json",
                )
            elif r.status_code == 304:
                # Upstream unchanged — serve cached body (client didn't match cache)
                if _playlist_body:
                    resp_headers = {"Cache-Control": "no-cache"}
                    if _playlist_etag:
                        resp_headers["ETag"] = f'"{_playlist_etag}"'
                    return Response(
                        content=_playlist_body,
                        status_code=200,
                        headers=resp_headers,
                        media_type="application/json",
                    )
        except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
            logger.warning("Upstream playlist fetch failed: %s", exc)
            # Fall through to offline path

    # Offline path
    if _playlist_body:
        resp_headers = {"Cache-Control": "no-cache"}
        if _playlist_etag:
            resp_headers["ETag"] = f'"{_playlist_etag}"'
        return Response(
            content=_playlist_body,
            status_code=200,
            headers=resp_headers,
            media_type="application/json",
        )

    raise HTTPException(status_code=503, detail="no cache and upstream unreachable")


@app.get("/media/{media_id}")
async def get_media(media_id: str, request: Request) -> Response:
    """Serve cached media or proxy + persist from upstream.

    Cache hit: FileResponse from cache dir.
    Cache miss + online: stream from upstream, persist, return bytes.
    Cache miss + offline: 404.
    """
    global _cached_media_ids
    cache_path = _cache_dir() / "media" / media_id

    if cache_path.exists():
        _cached_media_ids.add(media_id)
        return FileResponse(str(cache_path))

    if not _online or not _device_token:
        raise HTTPException(status_code=404, detail="media unavailable offline")

    base = _api_base()
    if not base:
        raise HTTPException(status_code=404, detail="media unavailable offline")

    # Online + cache miss: fetch from upstream and persist
    url = f"{base}/api/signage/player/asset/{media_id}?token={_device_token}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=30.0)
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="media not found upstream")
        # Persist to cache
        content = r.content
        _write_secure(cache_path, content)
        _cached_media_ids.add(media_id)
        return Response(
            content=content,
            status_code=200,
            media_type=r.headers.get("content-type", "application/octet-stream"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Media proxy error for %s: %s", media_id, exc)
        raise HTTPException(status_code=502, detail="upstream error fetching media")
