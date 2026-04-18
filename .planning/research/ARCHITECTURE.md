# ARCHITECTURE — v1.16 Digital Signage Integration

**Researched:** 2026-04-18
**Confidence:** HIGH for integration patterns (mirrors sensors/HR precedent); MEDIUM for PPTX worker location + player bundle trade-offs (gray areas with defensible recommendation).

## 1. Key Architecture Decisions

### Player Frontend — Separate Vite Bundle (Recommended)

Build the player as a second Vite entry point in the same `frontend/` project, emitting a separate bundle served at `/player/*`, NOT as another wouter route in the main SPA.

**Rationale:**
- Main SPA bundle carries Directus SDK, AuthContext, Recharts, shadcn, i18next — a Pi kiosk needs **none** of this.
- Player auth is orthogonal (device_token, not Directus JWT) — adding branches to `App.tsx` contaminates the auth flow.
- A Pi runs Chromium 24/7; target <200KB gzipped player bundle vs. ~600KB for main SPA.

**Implementation:** Two Vite inputs via `rollupOptions.input`:
```
{ main: 'index.html', player: 'player.html' }
```
FastAPI serves `GET /player/{device_token}` → built `player/index.html`.

**Trade-off:** Single-bundle is ~1 day faster to ship. Acceptable for tight timeline, plan to split in v1.17.

### Device Authentication — Opaque Bearer Token (Not JWT)

Devices are not Directus users. Mint `secrets.token_urlsafe(32)` on pair-claim, store `sha256(token + server_pepper)` in `devices.token_hash`.

**Why opaque, not JWT:** Devices don't expire sessions like user JWTs; tokens live until admin revokes (flip `devices.revoked=true`). JWT exp/refresh is ceremony with no benefit.

**Auth dep:** New `backend/app/security/device_auth.py` exporting `get_current_device(Authorization: Bearer <token>) -> Device`. Mirrors `directus_auth.get_current_user`.

**Router composition:**
```python
# /api/signage/* admin endpoints (admin-gated)
signage_admin_router = APIRouter(
    prefix="/api/signage",
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
# /api/signage/player/* (device-token-gated)
signage_player_router = APIRouter(
    prefix="/api/signage/player",
    dependencies=[Depends(get_current_device)],
)
# /api/signage/pair/* (unauthenticated pre-auth)
signage_pair_router = APIRouter(prefix="/api/signage/pair")
```

### Pairing State Machine

```
[Pi boots, no token]
  │
  └─► POST /api/signage/pair/request  (anonymous, rate-limited 5/min by IP)
        → { pairing_code: "A3F-K9M", pairing_session_id: <uuid>, expires_in: 600 }
        → Pi stores session_id in memory, displays code on screen
  │
  ├─► Pi polls every 3s: GET /api/signage/pair/status?pairing_session_id=<uuid>
  │     → 200 { status: "pending" } | { status: "claimed", device_token, device_id }
  │     → 404 when expired (10min)
  │
  [Admin, separately]
   └─► Admin visits /signage/pair → enters A3F-K9M + device name + tags
        → POST /api/signage/pair/claim (admin-gated)
           { pairing_code, name, tags: ["lobby"] }
        → backend: creates Device row, mints token, marks session "claimed"
  │
  └─► Pi's next poll returns { status: "claimed", device_token }
        → Pi stores token in localStorage, reloads as /player/{device_token}
```

**Table:** `signage_pairing_sessions` (id UUID PK, code VARCHAR(8) UNIQUE, device_id FK NULL, claimed_at, expires_at, created_at). Cleanup expired rows in daily 03:00 UTC retention job.

**Key insight:** Pi polls by `pairing_session_id` (UUID, machine-secure), not the 6-digit code. Admin enters the code (human-friendly), Pi polls by UUID. Codes are low-entropy and shoulder-surferable; UUIDs stay in Pi memory.

**Code format:** 6 chars base32 grouped `XXX-XXX` (exclude 0/O/1/I). 32⁶ ≈ 1B — with 10min expiry + rate-limited admin claims, collision/brute-force risk negligible.

### SSE Implementation — Safe with `--workers 1`

For ≤5 devices, holding one asyncio task per Pi inside a single uvicorn worker is trivially fine. SSE coexists with APScheduler in the event loop.

**Pattern:** `GET /api/signage/player/stream` (device-token-gated). Uses `sse-starlette==3.2.0` (mature, handles disconnect cleanup).

**Broadcast — in-process `asyncio.Queue` per device:**
```python
# backend/app/services/signage_broadcast.py
_device_queues: dict[int, asyncio.Queue] = {}

async def notify_device(device_id: int, event: dict) -> None:
    q = _device_queues.get(device_id)
    if q is not None:
        try: q.put_nowait(event)
        except asyncio.QueueFull: pass  # drop; Pi polls every 30s as safety net

async def device_event_stream(device_id: int):
    q = asyncio.Queue(maxsize=32)
    _device_queues[device_id] = q
    try:
        yield {"event": "hello", "data": json.dumps({"device_id": device_id})}
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=25)
                yield {"event": event["type"], "data": json.dumps(event["payload"])}
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}  # keepalive
    finally:
        _device_queues.pop(device_id, None)
```

**Triggering:** Admin PUT /api/signage/playlists/{id} → resolve affected devices (tag query) → `notify_device(d_id, ...)`.

**Worker=1 invariant:** Queues are in-process. Any future scale to >1 worker breaks silently. Add the same comment block present in `docker-compose.yml` and `scheduler.py`.

**Polling baseline (30s) is belt-and-braces** — ensures correctness if SSE drops through a reverse proxy that strips `text/event-stream`.

### Directus ↔ Alembic Ownership

FastAPI owns all new tables via Alembic. Directus gets read-access collections for CMS UX on select tables.

| Table | Alembic-managed | Exposed to Directus CMS UI? | Rationale |
|---|---|---|---|
| `signage_media` | ✅ | **Yes** (remove from `DB_EXCLUDE_TABLES`) | Admins upload via Directus's native file picker |
| `signage_playlists` | ✅ | **Yes** | Directus M2M UI handles ordered lists well |
| `signage_playlist_items` | ✅ | **Yes** | Junction table renders inline |
| `signage_device_tags` | ✅ | **Yes** | Simple lookup table |
| `signage_devices` | ✅ | **No** (excluded) | `token_hash` must never appear in Directus |
| `signage_pairing_sessions` | ✅ | **No** | Ephemeral state |

**Critical ordering:** Remove media/playlists from `DB_EXCLUDE_TABLES` **only after** Alembic migration runs. The `migrate` → `directus` startup ordering enforces this.

**Media upload path:** Directus `/files` endpoint for uploads (native multipart + storage + metadata). FastAPI `/api/signage/media` only lists/resolves (joins `directus_files` for public URL).

**Note:** PITFALLS.md recommends backend-owned media volume (not Directus file storage) to avoid UUID/path mismatches and UID permission friction. This is a trade-off to resolve during Schema phase discuss — whichever is chosen, it must be consistent across phases.

### Tag-Based Routing Query

**Schema:**
```sql
signage_devices (id, name, token_hash, revoked, last_seen_at, created_at, updated_at)
signage_device_tags (id, name UNIQUE)
signage_device_tag_map (device_id FK, tag_id FK, PK(device_id, tag_id))
signage_playlists (id, name, priority INT DEFAULT 0, enabled, updated_at)
signage_playlist_tag_map (playlist_id FK, tag_id FK, PK(playlist_id, tag_id))
signage_playlist_items (id, playlist_id FK, media_id, order_index, duration_s, transition)
```

**Resolution query (one-playlist-per-device):**
```sql
SELECT p.*
FROM signage_playlists p
JOIN signage_playlist_tag_map pt ON pt.playlist_id = p.id
WHERE p.enabled = true
  AND pt.tag_id IN (
    SELECT tag_id FROM signage_device_tag_map WHERE device_id = :device_id
  )
ORDER BY p.priority DESC, p.updated_at DESC
LIMIT 1;
```

**Indexes:** `signage_playlist_tag_map(tag_id)`, `signage_device_tag_map(device_id)`.

### Media Storage — Shared Named Volume (Read-Only)

```yaml
api:
  volumes:
    - ./backend:/app
    - directus_uploads:/directus/uploads:ro
```

FastAPI reads files directly from `/directus/uploads/<file_id>` using `filename_disk` from `directus_files`. No proxy hop.

**Player asset URLs:** `GET /api/signage/player/playlist` returns items with `url: "/assets/<file_id>"` (Directus built-in). Pi fetches directly from Directus; backend only needs read access for server-side PPTX conversion.

### PPTX Conversion — Separate Container, Postgres-Queued

**Rationale:** LibreOffice adds ~300MB to api container and significantly increases cold-start time.

**Queue mechanism:** `signage_media.conversion_status` enum (`pending | processing | done | failed`) + polling loop:
```sql
UPDATE signage_media SET conversion_status='processing', conversion_started_at=NOW()
WHERE id = (
  SELECT id FROM signage_media
  WHERE conversion_status='pending' AND media_type='pptx'
  ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING id;
```

`FOR UPDATE SKIP LOCKED` gives safe concurrency for free.

**Pipeline:** `.pptx` → `soffice --headless --convert-to pdf` → `pdf2image==1.17.0` → PNG per slide → Directus uploads → update `signage_media.slide_paths` JSONB → `notify_device` SSE event.

**New files:**
- `backend/app/services/pptx_converter.py`
- `backend/Dockerfile.worker` (libreoffice + poppler-utils)
- `backend/app/workers/pptx_worker.py`
- `docker-compose.yml` — new `pptx-worker` service

**Note:** STACK.md recommends keeping PPTX conversion in the api container via `BackgroundTasks` for scope simplicity. This is a trade-off to resolve during Conversion phase planning — both work for ≤5 devices.

### Player Offline Cache — Service Worker + Cache API

- **Playlist metadata** (JSON) → `localStorage`
- **Media files** → Cache API via Service Worker

**Why SW over IndexedDB:** Cache API designed for HTTP response caching; no blob serialization. SW intercepts `/assets/*` transparently.

**Strategy:** Stale-while-revalidate for playlist metadata (5min); cache-first-fallback-to-network for media. On network failure, player keeps playing cached playlist indefinitely.

**Eviction:** LRU capped at 500MB via `navigator.storage.estimate()`.

**Use `vite-plugin-pwa@1.x` scoped to `/signage/player` route** (per STACK.md recommendation).

### App Launcher Integration

**LauncherPage.tsx** (admin-only tile):
```tsx
{user?.role === "admin" && (
  <LauncherTile
    to="/signage"
    label={t("launcher.tiles.signage")}
    icon={<MonitorPlay />}
    adminOnly
  />
)}
```

**App.tsx** (wouter is first-match — order matters):
```tsx
<Route path="/signage/pair" component={SignagePairPage} />
<Route path="/signage" component={SignagePage} />
```

**NavBar chrome:** Player served outside Vite SPA, so no `isPlayer` branch needed.

**SignagePage shell:** Mirror `SensorsPage.tsx` with tabs (Media / Playlists / Devices) via shadcn `<Tabs>`. Wrap in `<AdminOnly>`.

## 2. Integration Points

| Existing file | Change |
|---|---|
| `backend/app/models.py` | Append 8 models: SignageMedia, SignagePlaylist, SignagePlaylistItem, SignageDevice, SignageDeviceTag, SignageDeviceTagMap, SignagePlaylistTagMap, SignagePairingSession |
| `backend/app/schemas.py` | Append Pydantic schemas + PairingRequest/Status/Claim, PlayerPlaylistResponse, DeviceHeartbeat |
| `backend/app/main.py` | Register 3 routers; mount `/static/player/*` |
| `backend/app/scheduler.py` | Add pairing cleanup job (reuse 03:00 UTC cron slot) |
| `backend/alembic/versions/` | New migration `v1_16_signage_schema.py` |
| `docker-compose.yml` | Add `pptx-worker`; mount `directus_uploads:/directus/uploads:ro`; adjust `DB_EXCLUDE_TABLES` |
| `frontend/src/App.tsx` | Add `/signage`, `/signage/pair` routes |
| `frontend/src/pages/LauncherPage.tsx` | Add admin-only signage tile |
| `frontend/src/locales/en.json`, `de.json` | Add `launcher.tiles.signage`, `signage.*` keys |
| `frontend/src/lib/api.ts` | Add signage fetchers via `apiClient<T>()` |
| `frontend/vite.config.ts` | Add second input for player bundle |

## 3. New Components

**Backend:**
```
backend/app/routers/signage_admin.py       — admin CRUD
backend/app/routers/signage_player.py      — device-authed playlist, heartbeat, SSE
backend/app/routers/signage_pair.py        — pair/request, /status, /claim
backend/app/security/device_auth.py
backend/app/services/signage_broadcast.py  — in-process asyncio.Queue fanout
backend/app/services/signage_resolver.py   — tag-to-playlist SQL + caching
backend/app/services/pptx_converter.py
backend/app/workers/pptx_worker.py
backend/Dockerfile.worker
backend/tests/test_signage_admin_gate.py
backend/tests/test_device_auth.py
backend/tests/test_pairing_flow.py
```

**Frontend admin (main bundle):**
```
frontend/src/pages/SignagePage.tsx              — tabs: Media | Playlists | Devices
frontend/src/pages/SignagePairPage.tsx          — 6-digit code entry
frontend/src/components/signage/MediaLibrary.tsx
frontend/src/components/signage/MediaUploadButton.tsx
frontend/src/components/signage/PlaylistEditor.tsx
frontend/src/components/signage/DeviceTable.tsx
frontend/src/components/signage/TagPicker.tsx
frontend/src/hooks/useSignageMedia.ts
frontend/src/hooks/useSignagePlaylists.ts
frontend/src/hooks/useSignageDevices.ts
```

**Frontend player (separate bundle):**
```
frontend/player.html
frontend/player/main.tsx
frontend/player/App.tsx                    — playlist loop orchestrator
frontend/player/auth.ts
frontend/player/sse.ts                     — EventSource + reconnect
frontend/player/poll.ts                    — 30s fallback polling
frontend/player/cache.ts                   — Cache API helpers
frontend/player/sw.ts                      — service worker
frontend/player/pair/PairScreen.tsx
frontend/player/players/ImagePlayer.tsx
frontend/player/players/VideoPlayer.tsx
frontend/player/players/PdfPlayer.tsx      — pdf.js with auto-page-flip
frontend/player/players/IframePlayer.tsx
frontend/player/players/HtmlPlayer.tsx
frontend/player/players/PptxPlayer.tsx     — image sequence
```

## 4. Data Flow — Admin Upload → Playback

```
1. Admin opens /signage → Media tab → clicks Upload
2. MediaUploadButton POSTs file to Directus /files (session cookie)
3. On success → frontend POSTs /api/signage/media { file_id, name, media_type }
4. IF media_type=='pptx':
      conversion_status='pending'
      → pptx-worker polls via FOR UPDATE SKIP LOCKED
      → soffice --headless --convert-to pdf → pdf2image → N PNGs
      → UPDATE slide_paths=[...], conversion_status='done'
      → notify_affected_playlists(media_id)
5. Admin drags media into PlaylistEditor → POST /api/signage/playlists/{id}/items
6. Admin assigns tags to playlist + device
7. On playlist save → resolve devices by tag overlap → notify_device(...)
8. Pi's SSE connection receives "playlist-changed" event
9. Pi calls GET /api/signage/player/playlist → items + asset URLs
10. Pi pre-fetches new media into Service Worker Cache
11. Pi renders items in sequence; heartbeat every 60s
12. Network loss: poll fails, SSE disconnects → cached media serves → loop continues
    On reconnect: poll resumes, SSE reconnects, missed changes pulled
```

## 5. Suggested Build Order (Dependency-Aware)

**Phase 41 — Schema & Models (foundational; blocks everything else)**
- Alembic migration for 8 signage tables + indexes
- SQLAlchemy models in `models.py`
- Pydantic schemas in `schemas.py`
- Update docker-compose `DB_EXCLUDE_TABLES`
- Unit tests for model constraints

**Phase 42 — Device auth + pairing flow**
- `device_auth.py` (token mint/hash/verify)
- `signage_pair` router (request, status, claim)
- Pairing session cleanup job in scheduler
- Admin-gate regression test (mirrors v1.15 dep-audit)
- Integration test: full pairing state machine

**Phase 43 — Media + playlist admin API (no SSE yet)**
- `signage_admin` router: CRUD for media, playlists, items, devices, tags
- Tag-to-playlist resolver
- `signage_player` router: `/playlist` + `/heartbeat` (polling-only works)
- apiClient fetchers in `frontend/src/lib/api.ts`

**Phase 44 — PPTX conversion worker (independent; parallelizable with Phase 45)**
- `Dockerfile.worker` + `pptx-worker` compose service
- `pptx_converter.py` + `pptx_worker.py`
- Directus uploads volume mount
- Integration test: upload .pptx → poll until `conversion_status='done'`

**Phase 45 — SSE broadcast (depends on Phase 43)**
- `signage_broadcast.py` with per-device asyncio.Queue
- `/api/signage/player/stream` SSE endpoint
- Admin mutations call `notify_device(...)`
- Load test: 5 concurrent Pi connections + admin edit → all receive event <1s

**Phase 46 — Admin UI (depends on Phases 42-45)**
- `/signage` page with Media/Playlists/Devices tabs
- `/signage/pair` page
- Launcher tile + routes in App.tsx
- AdminOnly wrap + role-aware launcher filter
- DE/EN i18n parity

**Phase 47 — Player bundle**
- Vite second entry + static mount in FastAPI
- Player orchestrator: fetch playlist → render loop
- Format handlers (image, video, pdf, iframe, html, pptx)
- Service Worker + Cache API
- SSE + 30s poll fallback

**Phase 48 — Verification + docs**
- E2E: fresh Pi → code → claim → playlist → play → network drop → cache loop → restore
- Bilingual admin guide
- Operator runbook: Pi image build, Chromium kiosk flags, systemd service

**Critical ordering:**
- Phase 41 blocks everything (shared schema).
- Phase 42 blocks Phases 43, 45, 47 (no device auth = no player API).
- Phase 45 (SSE) can ship after Phase 46 — polling-only is functionally complete.
- Phase 44 (PPTX) independent of 45-47.

## 6. Trade-offs Surfaced for Decision

| Decision point | Recommended | Alternative | When alternative wins |
|---|---|---|---|
| Player bundle | Separate Vite entry | One more wouter route in main SPA | Timeline pressure (~1 day saved) |
| Device auth | Opaque sha256-hashed token | JWT with long exp | Uniform debug tooling |
| Queue mechanism | Postgres FOR UPDATE SKIP LOCKED | Redis + RQ/ARQ | Already have Redis (we don't) |
| PPTX location | Separate pptx-worker container | LibreOffice in api via BackgroundTasks | Hard constraint against new services |
| SSE transport | asyncio.Queue per device (in-process) | Postgres LISTEN/NOTIFY | Multi-worker api deployment planned (not planned; `--workers 1` is invariant) |
| Media storage | Read-only volume mount from Directus uploads | Backend-owned media volume (PITFALLS preference) | UUID/path issues surface during integration |
