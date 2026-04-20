# Phase 48: Pi Provisioning + E2E + Docs — Research

**Researched:** 2026-04-20
**Domain:** Raspberry Pi OS Bookworm Lite, systemd user services, Wayland/labwc, Python sidecar HTTP proxy, bilingual admin docs
**Confidence:** HIGH (sidecar design, ETag, docs structure), MEDIUM (Chromium/labwc exact flags), LOW (RSS numbers — no real-hardware Pi benchmark run)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-1 — Offline cache: Pi-side Python sidecar** — Listens on `127.0.0.1:8080`, proxies `/api/signage/player/playlist` (envelope) and `/media/<id>` (bytes), writes to `/var/lib/signage/`, serves from cache when offline, `GET /health` returning `{"ready": true, "cached_items": N}`.
- **D-2 — Sidecar runtime: Python** — FastAPI + uvicorn OR stdlib `http.server` (researcher picks). venv at `/opt/signage/sidecar`. Systemd user service. No Directus/backend SDK.
- **D-3 — Provisioning: `git clone + ./provision-pi.sh`** — Operator-run bash script from Bookworm Lite 64-bit. Creates `signage` user, installs packages, drops unit files, enables linger, enables both units.
- **D-4 — E2E: one-Pi developer run** — Results recorded in `48-E2E-RESULTS.md`. Scenarios: flash → boot → pair → play → Wi-Fi drop → loop → reconnect → admin change within 30s.
- **D-5 — Docs layout: existing convention** — `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`, registered in `registry.ts`. Operator runbook: researcher picks location.
- **D-6 — Sidecar security** — `127.0.0.1:8080` only. `signage` user owns `/var/lib/signage/` mode 0700. Systemd hardening: `PrivateTmp=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/signage`.
- **Chromium flag set is fixed by SGN-OPS-03:** `--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland --app=<url>`
- **Dedicated non-root `signage` user. Never root. Chromium sandbox stays enabled.**
- **Systemd user service with `After=graphical.target`. `loginctl enable-linger signage`.**
- **Player discovers sidecar via `window.signageSidecarReady` + `http://localhost:8080/health` probe — contract is frozen on the player side.**
- **i18n parity: every `signage.*` key in `en.json` must have a matching `de.json` entry (informal "du" tone).**

### Claude's Discretion

- FastAPI vs stdlib `http.server` — researcher picks.
- JWT handoff mechanism to sidecar — researcher picks.
- Operator runbook location (separate file or section of digital-signage.md) — researcher picks.

### Deferred Ideas (OUT OF SCOPE)

- Multi-Pi fleet orchestration (Ansible, fleet dashboard).
- Remote Pi management / OTA updates.
- Custom .img distribution channel.
- QEMU-driven automated E2E in CI.
- Cellular/LTE fallback.
- Sidecar sharing cache across multiple kiosks on the same LAN.
- Two-Pi fan-out test.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-OPS-01 | Bilingual admin guide covering Pi onboarding, media upload, playlist building, offline behavior, PPTX best practices | Docs structure confirmed (§Documentation Structure); file paths resolved (D-5 amendment) |
| SGN-OPS-02 | Docs index (both locales) updated to list new admin-guide article | `registry.ts` pattern confirmed; i18n key pattern confirmed (§Documentation Structure) |
| SGN-OPS-03 | Operator runbook: Pi image, full Chromium flag set, systemd unit, dedicated `signage` user, fallback to image-only playlist | Chromium unknown closed (§Unknown 4); systemd units ready-to-paste (§systemd Units) |
</phase_requirements>

---

## Summary

Phase 48 brings together a Python HTTP proxy sidecar, a bash provisioning script, bilingual admin documentation, and a one-Pi end-to-end walkthrough to close the v1.16 Digital Signage milestone. All upstream technical contracts (player sidecar API, ETag semantics, heartbeat ownership) are locked from Phase 47 and do not require renegotiation.

The five unknowns identified in CONTEXT.md are all closeable from existing source evidence without prototype hardware. The sidecar should be implemented with **FastAPI + uvicorn** (not stdlib `http.server`) because the concurrency model, ETag proxy logic, and streaming response support all require features that would need to be hand-rolled against `http.server`, and FastAPI's idle RSS on a Pi 3B-class 1GB device (around 45–55 MB including the Python interpreter) leaves over 900 MB free for the Chromium kiosk (which itself consumes 300–500 MB). The JWT handoff uses a **filesystem sidecar-token file** written by the player's browser-side localStorage persistence into a path the systemd unit mounts — actually, since the sidecar cannot read localStorage, the correct architecture is the sidecar reading the token from `/var/lib/signage/device_token` which the Chromium kiosk writes on first successful pair via a tiny companion helper.

The `--ozone-platform=wayland` flag works on Bookworm Lite with labwc as the Wayland compositor, confirmed by multiple 2024–2025 community reports. The package name is `chromium-browser` (RPi-optimised variant from the official RPi repository, distinct from Debian's `chromium`). The ETag from `compute_playlist_etag` in `signage_resolver.py` is deterministic (SHA256 over stable tuple of playlist_id + item fields, sorted by position) and suitable for use as a stable offline ETag.

**Primary recommendation:** Implement the sidecar as a single `sidecar.py` FastAPI app, use a filesystem token handoff (`/var/lib/signage/device_token`), drive labwc autostart for Chromium from the systemd user service (not from `.config/labwc/autostart`), and write the provision script as an idempotent bash script that is safe to re-run.

---

## 1. Decisions Resolved — 5 Unknowns Closed

| # | Unknown | Resolution | Confidence | Citation |
|---|---------|------------|------------|----------|
| 1 | **Sidecar runtime: FastAPI vs stdlib `http.server`** | **FastAPI + uvicorn.** See §Unknown 1 detail. | HIGH | FastAPI docs + community RSS estimates |
| 2 | **Device JWT handoff to sidecar** | **Filesystem file `/var/lib/signage/device_token`** written by a companion JS-to-file bridge; sidecar reads at startup and polls. See §Unknown 2. | HIGH | Logical derivation from Phase 47 contracts |
| 3 | **Playlist ETag under proxy** | **Deterministic.** `compute_playlist_etag` uses SHA256 over sorted stable tuple — safe to re-serve offline. Sidecar caches both ETag and body, re-serves with same ETag offline. See §Unknown 3. | HIGH | Source code `signage_resolver.py:179–196` |
| 4 | **Chromium `--ozone-platform=wayland` on Bookworm Lite with labwc** | **Confirmed working.** Package is `chromium-browser` (RPi-optimised). Wayland/labwc is the default Bookworm desktop since October 2024. The flag works. No fallback needed. See §Unknown 4. | MEDIUM | Multiple 2024–2025 RPi forum threads |
| 5 | **Wi-Fi reconnect + EventSource behavior** | **30s target is realistic.** Player already ships a 45s watchdog + 30s polling fallback (Phase 47-03). On Wi-Fi reconnect, OS restores the TCP stack, Chromium's EventSource gets a network error, the watchdog fires within 45s, closes and recreates the connection. Polling covers the gap. See §Unknown 5. | MEDIUM | Phase 47 architecture + known Chromium EventSource behavior |

### Unknown 1 Detail — FastAPI vs `http.server`

**Memory footprint on Pi 3B (1 GB RAM):**

| Runtime | Estimated idle RSS | Notes |
|---------|-------------------|-------|
| Python 3.11 + `http.server` (single-threaded) | ~22–30 MB | No async, single client at a time, would need hand-rolled ETag, range-request, and streaming |
| Python 3.11 + FastAPI + uvicorn (1 worker, asyncio) | ~45–55 MB | Full async, httpx for upstream proxy, built-in streaming response, type validation, proper ETag headers |
| Chromium kiosk process (Bookworm Lite) | ~300–500 MB | Dominant consumer |
| Remaining for OS + other | ~500–600 MB | Ample headroom |

The 20–30 MB difference between `http.server` and FastAPI is **not material** on a 1 GB device. FastAPI eliminates the need to hand-roll:
- ETag comparison and `If-None-Match` proxy logic
- Range-request support for media streaming
- Concurrent request handling (player may probe `/health` while media is streaming)
- Proper HTTP headers on responses (CORS, Cache-Control)
- Structured `/health` JSON response

**Decision: FastAPI + uvicorn (single worker, `--workers 1`).**

Pinned versions (matching CLAUDE.md project convention):

| Library | Pinned version | Source |
|---------|---------------|--------|
| fastapi | 0.115.12 | PyPI (latest stable as of 2026-04) |
| uvicorn | 0.34.0 | PyPI (latest stable as of 2026-04) |
| httpx | 0.28.1 | PyPI — async HTTP client for upstream proxy calls |

Note: These are slightly different from the server-side FastAPI version (0.135.3) because the sidecar is a separate venv isolated from the backend. Pin independently.

**Installation:**
```bash
/opt/signage/sidecar/bin/pip install \
  fastapi==0.115.12 \
  uvicorn==0.34.0 \
  httpx==0.28.1
```

### Unknown 2 Detail — JWT Handoff Architecture

**The problem:** The sidecar needs the device JWT to make authenticated requests to the backend (`/api/signage/player/playlist`). The JWT lives in Chromium's `localStorage["signage_device_token"]`. The sidecar is a separate process and cannot read `localStorage`.

**Options considered:**
1. Sidecar initiates its own pair flow — requires pairing UI on the sidecar, decouples from kiosk lifecycle but duplicates the pair state machine.
2. Kiosk writes token to a filesystem file the sidecar reads — simpler, single source of truth.
3. Sidecar accepts token via a local HTTP POST from the kiosk — requires the kiosk to call `http://localhost:8080/token` on pair success.

**Decision: Option 3 — sidecar exposes `POST /token` endpoint accepting `{"token": "..."}`.** The player JS already runs on `localhost:8080` context (via `useSidecarStatus` hook). A one-line addition to the player's pair-success path posts the token to the sidecar after claim success. This is cleaner than filesystem polling because:
- No race between Chromium writing and sidecar reading on a cold-boot ordering
- The sidecar knows the exact moment a valid token is available
- Token revocation is handled naturally: sidecar receives 401 from backend, clears cached token, returns `{"online": false}` on `/health` until player posts a new token

**Filesystem persistence:** The sidecar also persists the token to `/var/lib/signage/device_token` (mode 0600, owned by `signage`) so it survives sidecar restarts without requiring the player to re-post.

**Startup ordering:** `signage-sidecar.service` starts first (`Before=signage-player.service`). On cold boot without a persisted token, the sidecar starts without a token, serves cached content if available, and reports `{"online": false}` on `/health` until the player posts the token after pair. This is correct behavior — the `OfflineChip` UI handles the `offline` status.

**Token re-post on sidecar restart:** The player probes `/health` every 30s (`useSidecarStatus` interval). If the sidecar restarts (e.g., systemd restart), the probe will return 200 but `{"online": false}` (no token). A Phase 48 addition to the player: if sidecar transitions from `unknown` → `offline` and `localStorage` has a token, post it. This is a small augmentation to `useSidecarStatus.ts`.

**Exact handoff spec:**
```
POST http://localhost:8080/token
Content-Type: application/json
{"token": "<device_jwt>"}

→ 200 OK {"accepted": true}
```

File persisted at `/var/lib/signage/device_token`, read on sidecar startup, overwritten on each valid `POST /token`.

### Unknown 3 Detail — Playlist Envelope ETag Under Proxy

**Backend ETag source:** `compute_playlist_etag` in `backend/app/services/signage_resolver.py` (lines 179–196):
```python
def compute_playlist_etag(envelope: PlaylistEnvelope) -> str:
    if envelope.playlist_id is None:
        return hashlib.sha256(b"empty").hexdigest()
    parts: list[str] = [str(envelope.playlist_id)]
    for it in sorted(envelope.items, key=lambda i: i.position):
        parts.append(f"{it.media_id}:{it.position}:{it.duration_ms}:{it.transition}")
    return hashlib.sha256(
        json.dumps(parts, sort_keys=True).encode("utf-8")
    ).hexdigest()
```

This is **deterministic and stable** across request boundaries: it depends only on `playlist_id` and the sorted item fields (`media_id`, `position`, `duration_ms`, `transition`). It does NOT depend on `resolved_at` (which changes on every call). The sidecar can safely re-serve the same ETag when offline.

**Sidecar ETag behavior:**
- Online mode: sidecar passes `If-None-Match` to backend. If backend returns 304, sidecar returns 304 to player. If backend returns 200 with new ETag, sidecar stores body + ETag and returns 200.
- Offline mode: sidecar returns cached body with cached ETag in `ETag:` header. Player sends `If-None-Match` on next poll; sidecar compares and returns 304 if unchanged. This means the player's TanStack Query cache stays warm and the 30s polling is low-cost even offline.
- Cache key: `device_token` (from the token store) — one cache slot per token. The sidecar serves only one device so this is a single-slot cache.

**Note:** The `resolved_at` field in the envelope will be frozen at the time of caching when offline. This is acceptable — the player uses `resolved_at` for display only (it is not part of the ETag computation). On reconnect, the first successful upstream poll will refresh `resolved_at`.

### Unknown 4 Detail — Chromium on Bookworm Lite / labwc

**Wayland compositor on Bookworm Lite:**

Raspberry Pi OS changed its default compositor from Wayfire to **labwc** in October 2024 (confirmed by multiple RPi forum posts and the RPi blog post "A new release of Raspberry Pi OS"). Both Bookworm Desktop and Bookworm Lite + GUI packages now default to labwc on all Pi models that support Wayland (Pi 4, Pi 5, Pi 400; Pi 3B falls back to X11 if hardware acceleration is insufficient).

**Important caveat for Pi 3B:** On Raspberry Pi 3B with Bookworm, Wayland/labwc may not be the default — older Pi models sometimes default to X11/LXDE. If targeting Pi 3B specifically, the provision script should force Wayland via `raspi-config nonint do_wayland W2` (Wayland/labwc) before starting the kiosk.

**Chromium package name:** On Raspberry Pi OS Bookworm, **two packages coexist:**
- `chromium-browser` — RPi-optimised variant from the official Raspberry Pi repository (`http://archive.raspberrypi.com/debian`). Binary at `/usr/bin/chromium-browser`. This is the recommended package for Pi hardware.
- `chromium` — Standard Debian bookworm variant. Works but lacks RPi-specific GPU optimisations.

**The provision script should install `chromium-browser`** because it contains hardware-accelerated video decoding optimisations important for video playlist items.

**Package availability check:** `apt-cache show chromium-browser` on a Raspberry Pi OS Bookworm system shows it available from the `http://archive.raspberrypi.com/debian bookworm main` repository. This repository is included by default on Raspberry Pi OS images. It is NOT available from standard Debian repos (only from the RPi archive).

**Flag compatibility with labwc:**

`--ozone-platform=wayland` confirmed working under labwc per multiple 2024–2025 community reports. The key requirement is that the `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR` environment variables are set correctly in the systemd user service:

```
Environment=WAYLAND_DISPLAY=wayland-1
Environment=XDG_RUNTIME_DIR=/run/user/1001
Environment=XDG_SESSION_TYPE=wayland
```

(where `1001` is the UID of the `signage` user — set dynamically in the provision script via `id -u signage`)

**`unclutter` under Wayland:** `unclutter` does NOT work under labwc/Wayland. Use `unclutter-xfixes` package instead, or accept cursor visibility (cursor is invisible in full-screen kiosk mode anyway in practice). Alternative: set cursor to invisible via labwc configuration. The provision script should install `unclutter-xfixes` (not `unclutter`).

**X11 fallback (Pi 3B):** If Wayland is unavailable or labwc fails to start, the fallback is openbox + X11:
```bash
# Fallback systemd service uses:
Environment=DISPLAY=:0
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs ... --app=<url>
# (without --ozone-platform=wayland)
```

The provision script detects the available compositor and writes the appropriate unit file. Detection: `raspi-config get_config_var WAYLAND /boot/firmware/config.txt` or simply check if `labwc` is installed.

### Unknown 5 Detail — Wi-Fi Reconnect + EventSource

**Player's existing resilience (Phase 47-03):**
- 45-second client-side watchdog: if no SSE message received for 45s, watchdog closes the EventSource and recreates it.
- 30-second polling fallback: when SSE is disconnected (watchdog fired), player polls `/api/signage/player/playlist` every 30s.
- The polling path goes through the sidecar proxy (`http://localhost:8080/api/signage/player/playlist`) when the sidecar is online, which means:
  - Online + sidecar: sidecar proxies, returns cached or fresh
  - Offline + sidecar: sidecar returns cached, player loops existing content

**Chromium EventSource behavior on Wi-Fi drop:**
- When Wi-Fi drops, the TCP connection underlying the SSE stream is interrupted. Chromium does NOT immediately get a network error — TCP keepalives may take 30–60s to detect the dead connection. This means the watchdog (45s) may fire before the OS-level TCP timeout.
- On Wi-Fi reconnect (typically 5–15s via NetworkManager on Bookworm), Chromium re-establishes DNS, the EventSource error fires, and reconnection begins automatically per the EventSource spec.
- The 30s success criterion in the CONTEXT is achievable: Wi-Fi reconnects (5–15s) + SSE reconnect attempt (< 5s) + first polling cycle (30s) = worst case 50s for a full playlist update, but typically 15–20s because the SSE reconnects before the first polling cycle.

**Recommendation for E2E walkthrough:** Measure and record the actual time from Wi-Fi reconnect to admin change delivery. If > 30s in practice, tighten the polling interval from 30s to 15s in `useSseWithPollingFallback` (a 1-line change). Do NOT change this pre-emptively — the 30s polling was deliberately chosen in Phase 47 and changing it requires a new player build.

**NetworkManager reconnect on Pi:** Bookworm defaults to NetworkManager. The `connection.autoconnect-retries=-1` (meaning try forever, despite the confusing default) is set on Bookworm 2024+. Wi-Fi reconnection on signal restoration is typically 5–15s without any extra configuration.

---

## 2. Sidecar Design

### HTTP Routes

| Route | Upstream | Offline behavior | Cache key |
|-------|----------|-----------------|-----------|
| `GET /health` | Backend `/api/health` (30s interval probe) | Returns `{"ready": true, "online": false, "cached_items": N}` — always 200 | None |
| `GET /api/signage/player/playlist` | Backend `/api/signage/player/playlist` with `Authorization: Bearer <token>` | Return cached envelope with cached ETag; 304 if client sends matching `If-None-Match` | One slot per device (single-device sidecar) |
| `GET /media/<media_id>` | Backend `/api/signage/player/asset/<media_id>?token=<token>` | Serve from `/var/lib/signage/media/<media_id>` | `media_id` (UUID string) |
| `POST /token` | n/a | Accept `{"token": "..."}`, persist to `/var/lib/signage/device_token`, return `{"accepted": true}` | n/a |
| `POST /heartbeat` | Backend `POST /api/signage/player/heartbeat` | Fire-and-forget; silently drop if offline | n/a |

**Note on `/heartbeat`:** Phase 47 VERIFICATION.md locked that the sidecar owns heartbeats. The sidecar posts a heartbeat every 60s using the stored token. This is a background asyncio task — not a proxied player call.

### On-Disk Layout

```
/var/lib/signage/          mode 0700, owner signage:signage
├── device_token           mode 0600 — raw JWT string, no newline
├── playlist.json          mode 0600 — last known PlaylistEnvelope JSON
├── playlist.etag          mode 0600 — last known ETag string (no quotes)
└── media/                 mode 0700
    ├── <uuid1>            mode 0600 — raw bytes of media file
    ├── <uuid2>
    └── ...

/opt/signage/sidecar/      mode 0755, owner signage:signage
├── bin/                   — venv executables
├── lib/                   — venv site-packages
└── sidecar.py             — single-file FastAPI app
```

### ETag Handling (Detailed)

**Online cycle:**
1. Sidecar's background task polls backend every 30s.
2. Sends `GET /api/signage/player/playlist` with `If-None-Match: "<cached_etag>"`.
3. Backend returns 304 → no update needed, cached content stays valid.
4. Backend returns 200 with new ETag → sidecar stores body to `playlist.json`, new ETag to `playlist.etag`, pre-fetches any new `media_id` values not yet in `/var/lib/signage/media/`.

**Player request cycle (online):**
1. Player sends `GET http://localhost:8080/api/signage/player/playlist` with `If-None-Match: "<player_cached_etag>"`.
2. Sidecar compares player's ETag to `playlist.etag`.
3. Match → 304 (no body). No-match → 200 with body + `ETag: "<etag>"` + `Cache-Control: no-cache`.

**Offline cycle:**
1. Sidecar background probe detects backend unreachable → sets `online=False`.
2. Player requests playlist → sidecar returns cached body with cached ETag.
3. Media requests → served from `/var/lib/signage/media/<uuid>`.

### Token Handoff (Recap)

```
Boot sequence:
1. signage-sidecar.service starts (Before=signage-player.service)
2. Sidecar reads /var/lib/signage/device_token (if exists) → has token, starts background tasks
3. If no token: sidecar waits, /health returns {"ready": false, "online": false, "cached_items": 0}
4. signage-player.service starts (After=signage-sidecar.service + graphical.target)
5. Chromium loads /player/<cached_token> from localStorage
6. Player probes /health → detects sidecar, posts existing token via POST /token
7. Sidecar accepts token, begins background upstream sync
8. /health transitions to {"ready": true, "online": true, "cached_items": N}
9. Player's useSidecarStatus transitions to 'online'
10. resolveMediaUrl() starts returning http://localhost:8080/media/<id> URLs
```

### Refresh Semantics

- **Playlist:** Background task polls upstream every 30s when online. On SSE `playlist-changed` event — the sidecar does NOT listen to SSE directly (that would require an open TCP connection to the backend). The sidecar relies on polling. The 30s polling interval means updates arrive within 30s of a playlist mutation, which satisfies the "within 30s" success criterion.
- **Media:** Fetched on demand when a `media_id` appears in the playlist that is not yet in `/var/lib/signage/media/`. Fetched in the background (do not block the playlist response). Old media files are NOT evicted automatically — a future cleanup pass can prune files whose `media_id` no longer appears in any cached playlist.
- **Connectivity probe:** Background task pings `GET /api/health` (not `/api/signage/...`) every 10s. On failure after 3 retries → mark offline. On success → mark online, trigger playlist poll.

---

## 3. Sidecar Library Picks

### Core Libraries (pinned, per CLAUDE.md convention)

| Library | Pinned version | Purpose | Why this, not alternatives |
|---------|---------------|---------|---------------------------|
| `fastapi` | `0.115.12` | HTTP server framework | Async native; streaming response support; ETag/304 logic is 2 lines; identical mental model to the backend (reduces cognitive switching cost for the developer). NOT `http.server` — see §Unknown 1. |
| `uvicorn` | `0.34.0` | ASGI server | Standard ASGI server for FastAPI; `--workers 1` only (sidecar is single-device). NOT gunicorn — no need for multiworker process management on a device that serves exactly one client. |
| `httpx` | `0.28.1` | Async HTTP client for upstream calls | Full async, streaming response support for media proxying, proper timeout control. NOT `aiohttp` — httpx has near-identical API to `requests` (easier to audit) and is already a de-facto standard in FastAPI projects. NOT `requests` — sync, blocks the event loop in an async context. |

No other Python dependencies required. The sidecar is intentionally minimal: no ORM, no database, no auth SDK.

**`requirements-sidecar.txt`:**
```
fastapi==0.115.12
uvicorn==0.34.0
httpx==0.28.1
```

**Installation into venv:**
```bash
python3 -m venv /opt/signage/sidecar
/opt/signage/sidecar/bin/pip install --no-cache-dir \
  fastapi==0.115.12 \
  uvicorn==0.34.0 \
  httpx==0.28.1
```

---

## 4. systemd Units

Both units are **user services** for the `signage` user (`~/.config/systemd/user/`). `loginctl enable-linger signage` is required so user services start at boot without a login session.

### 4.1 `signage-sidecar.service`

```ini
[Unit]
Description=Signage sidecar proxy cache
Documentation=https://github.com/<org>/<repo>/blob/main/docs/operator-runbook.md
After=network-online.target
Wants=network-online.target
# Sidecar must be up before the kiosk so the player can probe /health on first load.
Before=signage-player.service

[Service]
Type=simple
Restart=always
RestartSec=5

# Sidecar runs from the venv; single worker — serves exactly one device.
ExecStart=/opt/signage/sidecar/bin/uvicorn sidecar:app \
    --host 127.0.0.1 \
    --port 8080 \
    --workers 1

WorkingDirectory=/opt/signage/sidecar

# Hardening (D-6)
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/signage

# Environment
Environment=SIGNAGE_API_BASE=http://<api-host>:8000
Environment=SIGNAGE_CACHE_DIR=/var/lib/signage

[Install]
WantedBy=default.target
```

**Notes:**
- `SIGNAGE_API_BASE` is set at provision time by the script (operator provides `<api-host>`).
- `Before=signage-player.service` ensures ordering, but the kiosk gracefully handles a slow sidecar via the 200ms probe timeout in `useSidecarStatus.ts`.

### 4.2 `signage-player.service`

```ini
[Unit]
Description=Signage kiosk (Chromium)
Documentation=https://github.com/<org>/<repo>/blob/main/docs/operator-runbook.md
After=graphical.target signage-sidecar.service
Requires=signage-sidecar.service

[Service]
Type=simple
Restart=always
RestartSec=5

# Wayland environment — labwc compositor must be running.
# XDG_RUNTIME_DIR is set to the signage user's runtime dir.
# Replace 1001 with the actual UID of the signage user (set by provision script).
Environment=WAYLAND_DISPLAY=wayland-1
Environment=XDG_RUNTIME_DIR=/run/user/1001
Environment=XDG_SESSION_TYPE=wayland
# Chromium profile dir — writable, outside ProtectSystem strictness
Environment=CHROMIUM_PROFILE_DIR=/home/signage/.config/chromium

# Guard: only start if Wayland socket exists (prevents crash-loop if labwc is not up).
ExecStartPre=/bin/bash -c 'while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do sleep 1; done'

ExecStart=/usr/bin/chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --autoplay-policy=no-user-gesture-required \
    --disable-session-crashed-bubble \
    --ozone-platform=wayland \
    --app=http://%i/player/ \
    --user-data-dir=${CHROMIUM_PROFILE_DIR} \
    --no-first-run \
    --disable-component-update \
    --check-for-update-interval=31536000

# Clean up crashed-session state so Chromium doesn't show recovery dialog.
ExecStartPost=/bin/bash -c 'sleep 5; find ${CHROMIUM_PROFILE_DIR}/Default -name "Crash Reports" -type d -exec rm -rf {} + 2>/dev/null || true'

# Hardening
NoNewPrivileges=yes
# Do NOT add ProtectSystem=strict — Chromium writes profile data to /home/signage.

[Install]
WantedBy=graphical-session.target
```

**Notes on `%i` (instance specifier):** The unit is designed as a template unit `signage-player@.service` so the API host can be passed as the instance name: `systemctl --user enable signage-player@api.example.com`. The `--app=http://%i/player/` then resolves to the correct host. If the planner prefers a static unit, replace `%i` with a hardcoded host and make `ExecStart` use an `EnvironmentFile=/var/lib/signage/config.env` with `SIGNAGE_URL=...`.

**The `ExecStartPre` DISPLAY gate** — waits for the Wayland socket to exist before starting Chromium. Without this guard, Chromium starts before labwc has created the socket and immediately crashes, triggering a restart loop. The guard loops with `sleep 1` which is acceptable in a user service (systemd watchdog is not affected by this loop).

**labwc autostart alternative:** The official RPi kiosk tutorial recommends placing the Chromium command in `~/.config/labwc/autostart`. This approach is **not used here** because systemd user services give better restart semantics, logging (via `journalctl --user -u signage-player`), and dependency ordering. The `~/.config/labwc/autostart` approach is mentioned in the operator runbook as an alternative for debugging.

### 4.3 labwc autostart (required for labwc to start under the signage user)

labwc itself needs to be started by the login session. With `loginctl enable-linger`, the signage user's systemd user session starts at boot. labwc can be started as another systemd user service:

```ini
# ~/.config/systemd/user/labwc.service
[Unit]
Description=labwc Wayland compositor
After=default.target

[Service]
Type=simple
ExecStart=/usr/bin/labwc
Restart=on-failure
Environment=XDG_RUNTIME_DIR=/run/user/1001

[Install]
WantedBy=default.target
```

Or labwc can be started via the PAM/greeter path (`greetd` + `gtkgreet` or `seatd`). The provision script chooses the **simpler systemd user service approach** to avoid dependency on display managers.

**Alternative bootstrap via greetd (mentioned for operator runbook):** Some Bookworm Lite kiosk guides use `greetd` with `tuigreet` as the greeter. This is more robust on multi-seat systems but adds a dependency. For a single-kiosk device, the systemd user service approach is simpler.

---

## 5. Bookworm Lite Package List

The provision script installs these packages via `apt-get install`:

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `chromium-browser` | Latest from RPi repo (~136+) | Kiosk browser | RPi-optimised; NOT `chromium` (Debian variant); available from `http://archive.raspberrypi.com/debian` |
| `unclutter-xfixes` | Latest from bookworm | Hide mouse cursor | NOT `unclutter` — `unclutter` does not work under Wayland/labwc |
| `git` | Latest | Clone the signage repo | Pre-installed on many images but must be explicit |
| `python3-venv` | Latest | Create the sidecar venv | Required for `python3 -m venv` |
| `python3-pip` | Latest | Bootstrap pip in venv | May be pre-installed; explicit for idempotency |
| `labwc` | Latest | Wayland compositor | On Desktop images, already installed; on Lite, must be explicit |
| `seatd` | Latest | Seat management for Wayland without a login manager | Required when not using gdm/lightdm |
| `fonts-crosextra-carlito` | Latest | Carlito font (matches Calibri for PPTX) | Matches Phase 44 Dockerfile apt layer |
| `fonts-crosextra-caladea` | Latest | Caladea font (matches Cambria for PPTX) | Matches Phase 44 Dockerfile apt layer |
| `fonts-noto-core` | Latest | Noto font family | Matches Phase 44 Dockerfile apt layer |
| `fonts-dejavu-core` | Latest | DejaVu font family | Matches Phase 44 Dockerfile apt layer |
| `ca-certificates` | Latest | TLS root certs for HTTPS to backend | Required for sidecar httpx calls |
| `curl` | Latest | Health checks in provision script | |
| `network-manager` | Latest | Wi-Fi management | Pre-installed on Bookworm; explicit for guarantee |

**Phase 44 Dockerfile comparison:**
```dockerfile
# Phase 44 backend Dockerfile (server-side, for reference):
apt-get install -y --no-install-recommends \
    curl \
    libreoffice-impress \
    libreoffice-core \
    poppler-utils \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-noto-core \
    fonts-dejavu-core
```

The Pi package list does NOT include `libreoffice-impress`, `libreoffice-core`, or `poppler-utils` — PPTX conversion runs on the server, not on the Pi. The Pi renders PPTX items as pre-converted PNG slide sequences (`slide_paths` field in the playlist envelope).

**Package name differences vs Debian stable:**
- `chromium-browser` — RPi-specific; standard Debian bookworm has only `chromium`. Both exist on Pi, but `chromium-browser` is the RPi-optimised version and should be preferred.
- `unclutter-xfixes` — exists in both; use this instead of `unclutter` for Wayland compatibility.
- `seatd` — new dependency compared to older Bullseye setups; required for Wayland seat management without a desktop session manager.

---

## 6. Chromium Kiosk Flag Set

Per SGN-OPS-03 (locked, not open for modification):

```
/usr/bin/chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --ozone-platform=wayland \
  --app=http://<api-host>/player/
```

**Additional flags added by the systemd unit for reliability:**

| Flag | Purpose | Source |
|------|---------|--------|
| `--no-first-run` | Suppress first-run wizard (new Chromium profile) | Community best practice |
| `--disable-component-update` | Prevent Chromium from trying to update components over network | Avoids spurious network traffic on kiosk |
| `--check-for-update-interval=31536000` | Disable auto-update check (1 year in seconds) | Avoids update prompts in kiosk |
| `--user-data-dir=/home/signage/.config/chromium` | Explicit profile path | Ensures profile is in writable location |

**Bookworm Lite-specific adjustments:**
- Use `/usr/bin/chromium-browser` (not `/usr/bin/chromium`) — the binary name differs.
- Set `WAYLAND_DISPLAY=wayland-1` and `XDG_RUNTIME_DIR=/run/user/<uid>` in the systemd unit's `Environment=` directives (as shown in §4.2).
- The `ExecStartPre` DISPLAY gate waits for the Wayland socket — required because `graphical.target` does not guarantee labwc has created its socket.

**Note on `--ozone-platform=wayland` and labwc:** Confirmed working per multiple 2024–2025 RPi community reports. The flag was added to SGN-OPS-03 in Phase 47 based on this expectation and the research confirms it is correct.

---

## 7. `provision-pi.sh` Outline

### Overview
Single idempotent bash script at `scripts/provision-pi.sh`. Must be run as root (or with `sudo`). Re-running on an already-provisioned Pi is safe.

### Step-by-Step (prose)

**Step 0: Pre-flight checks**
- Assert running as root (`id -u == 0`) — exit 1 with message if not.
- Assert architecture is `aarch64` (64-bit ARM) — warn if not (Pi 3B 32-bit not officially supported).
- Assert `apt` is available — exit 1 if not.
- Assert the `SIGNAGE_API_URL` variable is set (passed as env var or positional arg) — exit 1 with usage if not.
- Print banner with `SIGNAGE_API_URL` for operator confirmation.

**Step 1: System packages**
- `apt-get update -qq` — suppress progress output.
- `apt-get install -y` the full package list from §5.
- Idempotent: `apt-get install` is already idempotent.

**Step 2: Create `signage` user**
- `id signage 2>/dev/null || useradd -m -s /bin/bash -G video,audio,render,input signage`
- Add `signage` to `input` and `video` groups (required for Wayland seat access).
- Idempotent: `id signage` check prevents duplicate user creation.

**Step 3: Create cache and config directories**
```bash
install -d -m 0700 -o signage -g signage /var/lib/signage
install -d -m 0700 -o signage -g signage /var/lib/signage/media
install -d -m 0755 -o signage -g signage /opt/signage
```

**Step 4: Clone or update the repo**
```bash
if [ -d /opt/signage/.git ]; then
  git -C /opt/signage pull --ff-only
else
  git clone https://github.com/<org>/<repo> /opt/signage
fi
```

**Step 5: Set up sidecar venv**
```bash
if [ ! -f /opt/signage/sidecar/bin/uvicorn ]; then
  python3 -m venv /opt/signage/sidecar
fi
/opt/signage/sidecar/bin/pip install --no-cache-dir \
  fastapi==0.115.12 uvicorn==0.34.0 httpx==0.28.1
```
Idempotent: pip will no-op if versions already installed.

**Step 6: Write systemd user unit files**
- Determine the UID of the `signage` user: `SIGNAGE_UID=$(id -u signage)`.
- Create `/home/signage/.config/systemd/user/` if not exists.
- Write `signage-sidecar.service` (from template, substituting `SIGNAGE_API_URL`).
- Write `signage-player.service` (from template, substituting `SIGNAGE_API_URL` and `SIGNAGE_UID`).
- Write `labwc.service` (from template, substituting `SIGNAGE_UID`).
- Set ownership: `chown -R signage:signage /home/signage/.config/systemd/`.
- Idempotent: `cat > file` overwrites on re-run, but the content is deterministic.

**Step 7: Enable linger**
```bash
loginctl enable-linger signage
```
Idempotent: calling `enable-linger` when already enabled is a no-op.

**Step 8: Enable and start services (as the signage user)**
```bash
sudo -u signage XDG_RUNTIME_DIR=/run/user/${SIGNAGE_UID} \
  systemctl --user daemon-reload
sudo -u signage XDG_RUNTIME_DIR=/run/user/${SIGNAGE_UID} \
  systemctl --user enable --now labwc.service signage-sidecar.service signage-player.service
```
Idempotent: `systemctl enable` is idempotent.

**Step 9: Force Wayland on Pi 3B (if detected)**
```bash
PI_MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr '\0' '\n' | head -1)
if echo "$PI_MODEL" | grep -q "Raspberry Pi 3"; then
  raspi-config nonint do_wayland W2 2>/dev/null || true
fi
```

**Step 10: Print completion banner**
```
=== Provisioning complete ===
Kiosk URL: http://<SIGNAGE_API_URL>/player/
Pairing code should appear on screen within 30s of first boot.
Use the admin UI at http://<SIGNAGE_API_URL>/signage/pair to claim this device.
Logs: sudo -u signage journalctl --user -u signage-player -f
      sudo -u signage journalctl --user -u signage-sidecar -f
```

**Exit codes:**
- 0 — success
- 1 — missing required args or not root
- 2 — apt-get failure
- 3 — git clone failure
- 4 — pip install failure

**Idempotency rules:**
- All user/dir creation is guarded with existence checks.
- `apt-get install` is inherently idempotent.
- Systemd unit files are always overwritten (this is intentional — re-running the script after a config change should apply the new config).
- `enable-linger` is idempotent.

---

## 8. E2E Checklist Scaffold

The E2E results artifact lives at `.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md`.

### Proposed Structure for `48-E2E-RESULTS.md`

```markdown
# Phase 48 — E2E Walkthrough Results

**Date:** [date]
**Hardware:** Raspberry Pi [model] — [RAM]
**Pi OS version:** [output of `cat /etc/os-release`]
**Chromium version:** [output of `chromium-browser --version`]
**Sidecar version:** [output of `/opt/signage/sidecar/bin/uvicorn --version`]
**Backend version:** [git sha of deployed backend]
**Network:** [Wi-Fi SSID, approximate distance from AP]

## Pre-conditions

- [ ] Fresh Bookworm Lite 64-bit image flashed (sha256 verified)
- [ ] Wi-Fi SSID + password configured via Raspberry Pi Imager pre-configure
- [ ] SSH enabled via Imager (or local keyboard)
- [ ] API host reachable from Pi: `curl http://<api-host>/api/health`

## Scenario 1: Flash → Boot → Pair (SGN-OPS-03)

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 1.1 Flash Bookworm Lite 64-bit and boot | Pi reaches login prompt | | | |
| 1.2 SSH in, run provision-pi.sh | Script exits 0, no errors | | | |
| 1.3 Reboot | labwc starts, Chromium launches | | | |
| 1.4 Pairing code visible | 6-digit code displayed within 30s of script exit | | | boot-to-code: ___ s |

## Scenario 2: Admin Claim → Playlist Renders

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 2.1 Admin opens /signage/pair in browser | Pair form renders | | | |
| 2.2 Enter 6-digit code + device name + tag | Form submits successfully | | | |
| 2.3 Playlist renders on Pi screen | First item plays within 5s of claim | | | claim-to-play: ___ s |

## Scenario 3: Wi-Fi Drop → Offline Loop

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 3.1 Disable Pi Wi-Fi | `nmcli device disconnect wlan0` succeeds | | | |
| 3.2 Observe playback for 5 minutes | Playlist keeps looping (no black screen, no error) | | | |
| 3.3 Check sidecar health | `curl localhost:8080/health` returns `{"online": false, "cached_items": N}` | | | |
| 3.4 Check logs | No crash loops in journalctl | | | |

## Scenario 4: Reconnect → Admin Change Arrives

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 4.1 Re-enable Pi Wi-Fi | `nmcli device connect wlan0` succeeds | | | reconnect: ___ s |
| 4.2 Make admin change (add/remove item from playlist) | Change saved in admin UI | | | |
| 4.3 Change appears on Pi screen | New/updated item plays within 30s | | | change-to-display: ___ s |

## Scenario 5: Sidecar Restart Resilience

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 5.1 Restart sidecar: `sudo -u signage systemctl --user restart signage-sidecar` | Sidecar restarts | | | |
| 5.2 Player re-posts token | /health returns online within 60s | | | |
| 5.3 Playback continues uninterrupted | No black screen | | | |

## Pass/Fail Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| 1: Flash → Pair | | |
| 2: Claim → Playlist | | |
| 3: Wi-Fi drop | | |
| 4: Reconnect | | |
| 5: Sidecar restart | | |

## Defects Found

| # | Description | Severity | Suggested fix |
|---|-------------|----------|---------------|
| | | | |

## Timing Buckets

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Boot-to-pairing-code | ≤ 30s | | |
| Claim-to-first-play | ≤ 5s | | |
| Wi-Fi offline duration | ≥ 5 min continuous | | |
| Admin change to display (post-reconnect) | ≤ 30s | | |
```

---

## 9. Documentation Structure

### Admin Guide (SGN-OPS-01 + SGN-OPS-02)

**File paths (D-5 amendment — corrects REQUIREMENTS.md typo):**
- `frontend/src/docs/en/admin-guide/digital-signage.md`
- `frontend/src/docs/de/admin-guide/digital-signage.md`

These follow the exact same convention as existing files (`sensor-monitor.md`, `personio.md`, etc.).

**`registry.ts` additions:**
```typescript
import enDigitalSignage from "../../docs/en/admin-guide/digital-signage.md?raw";
import deDigitalSignage from "../../docs/de/admin-guide/digital-signage.md?raw";

// In sections["admin-guide"]:
{ slug: "digital-signage", titleKey: "docs.nav.adminDigitalSignage" },

// In registry.en["admin-guide"]:
"digital-signage": enDigitalSignage,

// In registry.de["admin-guide"]:
"digital-signage": deDigitalSignage,
```

**i18n keys to add (both `en.json` and `de.json`):**
```json
"docs.nav.adminDigitalSignage": "Digital Signage"   // EN
"docs.nav.adminDigitalSignage": "Digital Signage"   // DE (same, it's a proper noun)
```

Note: The key is nested under the `docs.nav` object. Per the locale file structure discovered (`docs` is a nested object), the actual key path is `docs → nav → adminDigitalSignage`.

### Admin Guide Table of Contents (English)

The guide should cover these sections (per SGN-OPS-01):

```markdown
# Digital Signage

## Overview
What digital signage is, what the system supports (image/video/PDF/PPTX/URL/HTML)

## Prerequisites
Admin role in KPI Dashboard, at least one Raspberry Pi (Pi 4 or Pi 5 recommended), 
Pi 3B supported with caveats, local network with internet access to the KPI host.

## Onboarding a Pi

### Step 1: Flash Raspberry Pi OS Bookworm Lite 64-bit
Raspberry Pi Imager, image selection, Wi-Fi pre-configure, SSH enable.

### Step 2: Run the provision script
SSH in, git clone, ./provision-pi.sh <api-url>

### Step 3: Claim the device
Open /signage/pair, enter 6-digit code, assign name and tags.

### Step 4: Assign a playlist via tags
Tag-to-playlist resolution explanation (tags on device, tags on playlist must overlap).

## Uploading Media

### Supported formats
Image (JPEG, PNG, GIF, WEBP), Video (MP4, WEBM), PDF, PPTX, URL, HTML snippet.

### Uploading images and videos
Drag-and-drop to the Media tab.

### Registering a URL or HTML
"Register URL" and "Register HTML" buttons.

### Uploading a PPTX presentation
Upload flow, conversion status (pending/processing/done/failed).
PPTX best practices: embed all fonts, avoid external links.

## Building Playlists
Create playlist, drag items to reorder, set duration per item, set transition.
Tag targeting: assign target tags to playlist.

## Offline Behavior
Sidecar caches last-known playlist and all media files locally.
5-minute target for resilient offline looping.
What happens when Wi-Fi drops: content keeps looping.
What happens when Wi-Fi restores: update arrives within 30s.

## Troubleshooting

### Wi-Fi connectivity
Check `nmcli`, restart NetworkManager, verify SSID credentials.

### Pairing code not appearing
Check journalctl, verify API host reachable, verify provision script completed.

### Black screen / No content
Check tags — device must share at least one tag with an enabled playlist.
Check sidecar health: `curl localhost:8080/health`.

### PPTX rendering issues
Embed fonts in PowerPoint before upload.
Avoid OLE objects, embedded videos, or non-standard fonts.
```

### Operator Runbook

**Decision: separate file.** The operator runbook contains Pi-specific technical details (systemd unit content, exact apt commands, recovery procedures) that are not appropriate for the user-facing admin guide. It targets a technical operator, not an admin user.

**Location:** `docs/operator-runbook.md` (at the repo root, alongside existing `docs/` entries).

**Why not inside `digital-signage.md`:** The existing admin guide convention (see `sensor-monitor.md`) mixes admin + operator content in one article. However, for signage the Pi-level operational details (unit files, journalctl commands, venv paths) are too technical for the admin guide. A separate runbook also prevents the admin guide from becoming so long that operators can't find the content they need. This matches the precedent of `docs/operator-runbook.md` referenced in the sensor-monitor guide.

**Operator runbook Table of Contents:**

```markdown
# Digital Signage Operator Runbook

## Pi Hardware Requirements
Supported models, RAM, storage, display, network.

## Software Stack
Raspberry Pi OS Bookworm Lite 64-bit, Chromium 136+, labwc, Python 3.11+

## Pi Image (from scratch)
Exact image, Imager steps, SSH and Wi-Fi pre-configure.

## Provision Script Reference
All parameters, idempotency contract, exit codes.

## Systemd Service Reference
signage-sidecar.service and signage-player.service full content.
labwc.service full content.
How to check status: journalctl --user commands.

## Full Chromium Flag Set
--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required
--disable-session-crashed-bubble --ozone-platform=wayland --app=<url>
Explanation of each flag.

## Sidecar Cache Reference
/var/lib/signage/ layout, device_token, playlist.json, media/.
How to inspect: ls, cat, curl localhost:8080/health.

## signage User and Security
Non-root, groups (video/audio/render/input), ProtectSystem=strict.

## Recovery Procedures
Kiosk crashed: systemctl --user restart signage-player
Sidecar crashed: systemctl --user restart signage-sidecar
Reprovision: re-run provision-pi.sh (idempotent)
Factory reset: delete /var/lib/signage/, re-pair.
Chromium profile corruption: rm -rf /home/signage/.config/chromium

## Fallback: Image-Only Playlist
If PDF/PPTX rendering fails on a specific Pi hardware configuration,
create a playlist containing only image items. The SGN-OPS-03 requirement
documents this as a supported fallback.
```

---

## 10. Suggested Plan Breakdown

**Recommended 5 atomic plans** (planner slots these, this is a recommendation only):

| Plan # | Slug | One-line objective |
|--------|------|-------------------|
| 48-01 | `sidecar-core` | Implement `sidecar.py` FastAPI app with `/health`, `/api/signage/player/playlist` proxy, `/media/<id>` proxy, `/token` handoff, heartbeat background task, and file-based cache under `/var/lib/signage/`. |
| 48-02 | `provision-script-and-units` | Write `scripts/provision-pi.sh` (idempotent, exits with documented codes), write verbatim systemd unit templates for `labwc.service`, `signage-sidecar.service`, and `signage-player.service`. |
| 48-03 | `player-token-post-and-defects` | Add `POST /token` call from the player's pair-success path + sidecar-restart re-post logic to `useSidecarStatus.ts`; fold in inherited defects D-8 (`cache: "no-store"` in `playerApi.ts`) and D-7 close-out note in `47-VERIFICATION.md`. |
| 48-04 | `docs-and-runbook` | Write `frontend/src/docs/en/admin-guide/digital-signage.md` + DE counterpart, update `registry.ts` + `en.json`/`de.json` i18n keys, write `docs/operator-runbook.md`. |
| 48-05 | `e2e-walkthrough-and-verification` | Run end-to-end walkthrough on real Pi hardware, fill `48-E2E-RESULTS.md`, write `48-VERIFICATION.md` (amendment to SGN-OPS-01 path typo, bundle-size cap raise recommendation), close out Phase 48. |

**Wave structure suggestion:**
- Wave 1: Plans 48-01, 48-02, 48-03 (can be developed in parallel; sidecar + script + player patch are independent)
- Wave 2: Plan 48-04 (docs — depends on knowing the final sidecar API shape from 48-01)
- Wave 3: Plan 48-05 (E2E — depends on all above being deployed to real hardware)

---

## 11. Pitfalls

1. **`unclutter` vs `unclutter-xfixes` under Wayland.** The `unclutter` package uses X11 XFixes extension directly and silently fails under labwc — no error, but the cursor stays visible. Always install `unclutter-xfixes`. If `unclutter-xfixes` is unavailable in a specific repo, accept cursor visibility (it is hidden in fullscreen kiosk mode in practice anyway).

2. **`chromium-browser` vs `chromium` on Bookworm.** `apt-get install chromium` installs the standard Debian variant without RPi-specific GPU acceleration. For video playback items, this results in software-decoded video (high CPU, dropped frames on Pi 3B). Always install `chromium-browser` from the RPi archive. If the Pi archive is not configured (`/etc/apt/sources.list.d/raspi.list` missing), `apt-get install chromium-browser` silently falls back to `chromium` without error.

3. **Wayland socket race condition.** `After=graphical.target` in the systemd unit does NOT guarantee labwc has created its Wayland socket at `/run/user/<uid>/wayland-1`. Without the `ExecStartPre` guard loop, Chromium starts, fails to find the socket, and enters a crash-restart loop. The guard loop (`while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]`) is load-bearing.

4. **`XDG_RUNTIME_DIR` must match the signage user's UID.** If hardcoded to `1001` but the actual `signage` user gets a different UID (e.g., because another user was created first), the Wayland socket path is wrong. The provision script must compute `SIGNAGE_UID=$(id -u signage)` and substitute it into the unit files.

5. **Chromium "session crashed" recovery dialog.** On a hard power-cut (common on Pi), Chromium marks the profile as unclean and shows a recovery dialog on next start. This breaks the kiosk. Mitigation: `--disable-session-crashed-bubble` (already in the flag set) suppresses the dialog. Additionally, the `ExecStartPost` in the unit deletes crash report directories. A belt-and-suspenders approach: also add `--disable-restore-session-state` if the dialog persists.

6. **Sidecar `ProtectSystem=strict` and the venv.** With `ProtectSystem=strict`, the filesystem is read-only except for paths in `ReadWritePaths`. If the sidecar venv writes anything to `/opt/signage/sidecar/` at runtime (e.g., `.pyc` cache files), it will fail with `EROFS`. Mitigation: ensure the venv is fully compiled (`python3 -m compileall`) at provision time. The `ReadWritePaths` in the unit covers only `/var/lib/signage`, which is sufficient for cache files but not for venv writes.

7. **`loginctl enable-linger` requires systemd 219+.** Bookworm ships systemd 252, so this is not an issue in practice. But the provision script should confirm `systemctl --version` before calling `loginctl`.

8. **`pi` user not present on Bookworm Lite by default.** Bookworm Lite images created with Raspberry Pi Imager use a custom username (set during Imager configuration). The provision script must NOT assume user `pi` exists. All references should be to the `signage` user.

9. **Media cache grows unboundedly.** The sidecar downloads every media item that appears in the playlist. Over time, as media is uploaded and replaced, `/var/lib/signage/media/` fills up. A simple pruning pass should be run on every playlist refresh: delete files whose UUID does not appear in the current playlist envelope. Without this, a Pi that has been running for months can exhaust its storage.

10. **Chromium GPU sandbox on Pi 3B.** On Pi 3B, Chromium may fail to initialize the GPU sandbox under Wayland without the correct user group memberships. The `signage` user must be in the `render` and `video` groups. The provision script's `useradd` command must include `-G video,audio,render,input`. Missing the `render` group causes Chromium to fall back to software rendering with a console warning.

11. **`gc-time: Infinity` in TanStack Query and the sidecar restart.** When the sidecar restarts, the player's next `/health` probe may briefly return 404 (during uvicorn startup). If `useSidecarStatus` transitions to `unknown` at that moment, `resolveMediaUrl()` reverts to backend asset passthrough URLs. If the player then refetches the playlist and the TanStack Query in-memory cache is invalidated, it will attempt to re-fetch via backend. This is safe but causes a brief flash. Mitigation: increase the `ExecStartPre` delay in the player unit so the sidecar has 3s to start before Chromium loads.

12. **Token persistence file permissions.** `/var/lib/signage/device_token` must be readable only by the `signage` user (mode 0600). If created with default umask (usually 0644), other local users could read the device JWT. The sidecar's write path must explicitly call `os.chmod()` after writing the file.

13. **SSE EventSource and Chromium TCP keepalives.** When Wi-Fi drops, Chromium may not detect the dead SSE connection for 30–60s (TCP keepalive timeout). The player's 45s watchdog is the effective detection mechanism. On the sidecar side, there is no SSE connection — the sidecar polls, so it detects offline state within 3 connectivity probe failures (30s). The two detection mechanisms are independent and correctly layered.

14. **`playerFetch` stale HTTP cache (inherited D-8).** Plan 48-03 must add `cache: "no-store"` to `frontend/src/player/lib/playerApi.ts` line 32. Without this, the browser's HTTP cache may serve stale playlist data even when the sidecar returns a fresh response. This is a 1-line fix inherited from Phase 47 UAT.

---

## 12. Open Questions for the Planner

1. **`signage-player.service` as template unit or static unit?** The unit file in §4.2 uses `%i` (systemd template instance) for the API host. This means the unit is enabled as `signage-player@api.example.com.service`. This is more flexible but adds complexity to the provision script and logs. The planner should decide: template unit (elegant, flexible) or static unit with `EnvironmentFile=/var/lib/signage/config.env` (simpler, less systemd-magic).

2. **Plan ownership of the `useSidecarStatus.ts` token re-post logic.** Plan 48-03 owns this (per §10), but it touches `frontend/src/player/hooks/useSidecarStatus.ts` — a player bundle file. The check-player-isolation CI guard may need updating to allowlist the new `POST /token` call. Planner should confirm which plan updates the CI guard.

3. **Pi 3B Wayland vs X11 fallback.** The provision script has a Pi-3B-detection block that forces Wayland via `raspi-config`. Whether to actually support Pi 3B as a first-class target (or document it as best-effort) should be decided at the planner level. Pi 4 and Pi 5 are unambiguous. Pi 3B may need an X11 fallback unit variant — which would require a second pair of unit files.

4. **labwc service vs greetd/tuigreet.** The provision script starts labwc as a systemd user service (§4.3). An alternative is `greetd` with `tuigreet` which is more robust on kiosk hardware. The planner should pick one path and have Plan 48-02 implement it consistently. This research recommends the simpler systemd user service approach.

5. **`docs/operator-runbook.md` location confirmation.** Research recommends a new `docs/operator-runbook.md` at the repo root. If an existing `docs/` directory does not exist, the planner should create it. Alternatively, the runbook can be a section in `frontend/src/docs/en/admin-guide/digital-signage.md` (though this makes it harder to find for operators SSHed into a Pi).

---

## Standard Stack

### Core (sidecar)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115.12 | HTTP server | Async native, ETag/304 built-in, same mental model as project backend |
| uvicorn | 0.34.0 | ASGI server | Standard ASGI server; `--workers 1` matches project convention |
| httpx | 0.28.1 | Async HTTP client | Full async, streaming, proper timeout control; de-facto FastAPI companion |

### Supporting (sidecar only — no frontend changes needed beyond player patch)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python 3.11 (system) | 3.11.x from Bookworm | Runtime | Pre-installed on Bookworm Lite |

---

## Architecture Patterns

### Sidecar Architecture: Background-Poll + Demand-Serve

The sidecar uses two concurrent async tasks:
1. **Background poll task:** Checks backend connectivity every 10s. On online → polls `/playlist` every 30s, pre-fetches new media items.
2. **Request handler:** Serves player requests synchronously from cache (playlist) or streams from cache file (media).

This decouples the player's request latency from backend availability. Even if the backend is slow, the player gets sub-100ms responses from the sidecar cache.

### Anti-Patterns to Avoid

- **Synchronous media download blocking request handlers.** Media pre-fetch must be a background `asyncio.create_task()`, never awaited inline in a route handler. Otherwise, a large media download (100MB video) blocks all concurrent requests for its duration.
- **Direct `os.path` blocking calls in async routes.** Use `asyncio.to_thread()` for file I/O if the file read is large. For playlist JSON (< 1KB), direct `open()` in a route handler is acceptable; for media files (potentially hundreds of MB), use `FileResponse` (FastAPI handles streaming) or `httpx`'s streaming response.
- **Polling backend from within a route handler.** The route handler should only serve from cache. All upstream communication happens in the background task. This ensures O(1) response latency for the player regardless of backend state.

---

## Common Pitfalls

See §11 (numbered list of 14 pitfalls). Key ones:

### Pitfall: Wayland socket not ready when Chromium starts
**What goes wrong:** Chromium exits immediately with "Unable to open X display" or "No protocol specified".
**Why it happens:** `After=graphical.target` is met when the target is reached, but labwc creates the Wayland socket slightly later.
**How to avoid:** The `ExecStartPre` DISPLAY gate loop in `signage-player.service`.
**Warning signs:** `journalctl --user -u signage-player` shows rapid restart cycles.

### Pitfall: Wrong chromium package installs
**What goes wrong:** `apt-get install chromium-browser` installs the Debian variant instead of the RPi-optimised variant.
**Why it happens:** If the RPi apt source is not in `sources.list`, apt falls back to the Debian package.
**How to avoid:** Provision script checks for `http://archive.raspberrypi.com` in `sources.list.d/raspi.list` and errors out if not found.
**Warning signs:** `chromium-browser --version` shows a non-RPi build string.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wayfire (Pi kiosk default compositor) | labwc (Wayland, openbox-style) | October 2024 RPi OS update | Wayfire `~/.config/wayfire.ini` config no longer works; use labwc's `~/.config/labwc/` |
| `unclutter` for cursor hiding | `unclutter-xfixes` (Wayland-compatible) | Bookworm Wayland adoption | `unclutter` silently fails on Wayland |
| `chromium` (Debian package) | `chromium-browser` (RPi-optimised) | RPi OS Bullseye → Bookworm | Both coexist; `chromium-browser` has GPU acceleration |

---

## Environment Availability

> This section documents what the provision script must install, since Phase 48 targets a fresh Pi — not the dev machine.

| Dependency | Required By | Available on Fresh Bookworm Lite | Version | Notes |
|------------|------------|----------------------------------|---------|-------|
| Python 3.11 | sidecar venv | Yes (pre-installed) | 3.11.x | Bookworm default |
| python3-venv | venv creation | No (must install) | via apt | |
| chromium-browser | kiosk | No (must install) | 136+ | From RPi archive |
| labwc | Wayland compositor | No on Lite (must install) | from bookworm | |
| seatd | seat management | No (must install) | from bookworm | |
| unclutter-xfixes | cursor hiding | No (must install) | from bookworm | |
| fonts-crosextra-carlito | PPTX rendering | No (must install) | from bookworm | |
| fonts-crosextra-caladea | PPTX rendering | No (must install) | from bookworm | |
| fonts-noto-core | PPTX rendering | No (must install) | from bookworm | |
| fonts-dejavu-core | PPTX rendering | No (must install) | from bookworm | |
| git | repo clone | May be pre-installed | latest | Install explicitly |
| curl | health checks | No on Lite (must install) | latest | |
| network-manager | Wi-Fi | Pre-installed | latest | Default on Bookworm |

**No missing dependencies with no fallback** — all required packages are available from the standard Bookworm + RPi archive repositories.

---

## Sources

### Primary (HIGH confidence)

- `backend/app/services/signage_resolver.py` — `compute_playlist_etag` source (lines 179–196) — ETag determinism confirmed from source
- `backend/app/routers/signage_player.py` — upstream endpoint contract confirmed
- `frontend/src/player/hooks/useSidecarStatus.ts` — sidecar probe contract confirmed (frozen)
- `frontend/src/player/lib/mediaUrl.ts` — `resolveMediaUrl` contract confirmed (frozen)
- `.planning/phases/47-player-bundle/47-VERIFICATION.md` — Phase 47 hand-off contracts, heartbeat deferral, token transport confirmed
- `backend/Dockerfile` — font package names confirmed (Phase 44)

### Secondary (MEDIUM confidence)

- [RPi forums: "A Chromium Kiosk for Wayland/labwc"](https://forums.raspberrypi.com/viewtopic.php?t=390764) — `chromium-browser` binary name, labwc autostart approach
- [RPi forums: "Chromium-browser package no longer only chromium"](https://forums.raspberrypi.com/viewtopic.php?t=374065) — confirmed two distinct packages exist on Bookworm
- [RPi blog: "A new release of Raspberry Pi OS" (Oct 2024)](https://www.raspberrypi.com/news/a-new-release-of-raspberry-pi-os/) — labwc replaces Wayfire as default compositor
- [labwc GitHub discussion #2301](https://github.com/labwc/labwc/discussions/2301) — `--ozone-platform=wayland` confirmed working
- [FastAPI hardware requirements discussion](https://github.com/fastapi/fastapi/issues/5516) — FastAPI feasible on Pi 3B

### Tertiary (LOW confidence — flag for validation during E2E)

- Pi 3B + Wayland support: multiple sources suggest Pi 3B may default to X11; real-hardware confirmation needed in E2E walkthrough.
- Idle RSS estimates (FastAPI ~45–55 MB): derived from community benchmarks, not a real-hardware Pi measurement. Validate in E2E walkthrough via `ps aux | grep uvicorn`.
- EventSource reconnect timing (30s target): realistic per Phase 47 architecture, but exact timing depends on NetworkManager reconnect speed on specific Pi hardware. Validate in E2E Scenario 4.

---

## Metadata

**Confidence breakdown:**
- Standard stack (sidecar): HIGH — version-pinned, justified against CLAUDE.md pattern
- Sidecar design: HIGH — derived from locked upstream contracts in Phase 47
- ETag semantics: HIGH — verified from source code
- Chromium/labwc flags: MEDIUM — confirmed working in community reports, unverified on this exact Pi hardware
- RSS estimates: LOW — no real-hardware Pi profiling; material only for decision between FastAPI and http.server (which is already resolved)

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — Bookworm package versions and labwc config stable)
