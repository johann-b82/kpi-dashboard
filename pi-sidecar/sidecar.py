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
import logging
import os
import stat
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
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
                import json as _json
                try:
                    envelope = _json.loads(body)
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
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{base}/api/signage/player/heartbeat",
                    headers={"Authorization": f"Bearer {token}"},
                    json={},
                    timeout=5.0,
                )
        except Exception as exc:
            logger.debug("Heartbeat fire-and-forget error (suppressed): %s", exc)


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

    # Start background tasks
    probe_task = asyncio.create_task(_connectivity_probe_loop())
    refresh_task = asyncio.create_task(_playlist_refresh_loop())
    heartbeat_task = asyncio.create_task(_heartbeat_loop())

    yield

    # Shutdown
    probe_task.cancel()
    refresh_task.cancel()
    heartbeat_task.cancel()
    for t in (probe_task, refresh_task, heartbeat_task):
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
                import json as _json
                try:
                    envelope = _json.loads(body)
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
