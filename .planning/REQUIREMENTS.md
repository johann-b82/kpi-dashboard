# Requirements: v1.16 Digital Signage

**Milestone:** v1.16
**Status:** Active
**Created:** 2026-04-18
**Core Value:** Directus-backed digital signage CMS within the existing monorepo — admin UI for managing Media/Playlists/Devices, a Chromium-kiosk player for Raspberry Pi, and tag-based playlist-to-device routing. Small-fleet scope (≤5 devices), single-site, cache-and-loop offline mode.

**Research:** [SUMMARY.md](research/SUMMARY.md) (consolidates STACK, FEATURES, ARCHITECTURE, PITFALLS)
**Locked defaults (2026-04-18):** new app in same monorepo, all media types (Image/Video/PPTX/PDF with page-flip/URL/HTML), hybrid pull+SSE sync, tag-based playlist routing, Chromium kiosk on Raspberry Pi, 6-digit pairing-code flow, Directus file storage, ≤5 devices cache-and-loop offline.

---

## Active Requirements

### Database & Schema (SGN-DB-*)

- [x] **SGN-DB-01**: Alembic migration creates `signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_devices`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlist_tag_map`, `signage_pairing_sessions` (8 tables)
- [x] **SGN-DB-02**: Partial-unique index on `signage_pairing_sessions.code WHERE expires_at > now() AND claimed_at IS NULL` (prevents active-code collision while allowing reuse after expiry)
- [x] **SGN-DB-03**: `ON DELETE RESTRICT` on `signage_playlist_items.media_id` (prevents deleting media currently referenced by any playlist)
- [x] **SGN-DB-04**: `DB_EXCLUDE_TABLES` in `docker-compose.yml` excludes `signage_devices` + `signage_pairing_sessions` (sensitive); exposes `signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags` to Directus CMS UI for admin UX
- [x] **SGN-DB-05**: Migration round-trips cleanly — `upgrade → downgrade → upgrade` on fresh DB drops and recreates all tables + indexes cleanly

### Backend API (SGN-BE-*)

- [x] **SGN-BE-01**: `backend/app/routers/signage_admin.py` with `APIRouter(prefix="/api/signage", dependencies=[Depends(get_current_user), Depends(require_admin)])` — full CRUD for media, playlists, playlist_items, devices, tags
- [x] **SGN-BE-02**: `backend/app/routers/signage_player.py` with device-token dep — `GET /playlist`, `POST /heartbeat`, `GET /stream` (SSE via `sse-starlette==3.2.0`)
- [x] **SGN-BE-03**: `backend/app/routers/signage_pair.py` (unauthenticated) — `POST /request`, `GET /status`; admin-gated `POST /claim`
- [x] **SGN-BE-04**: `backend/app/security/device_auth.py` — `get_current_device` dep resolving `Authorization: Bearer <device_token>` (token format decided in Phase 42: opaque sha256-hashed OR scoped JWT)
- [x] **SGN-BE-05**: `backend/app/services/signage_broadcast.py` — in-process `asyncio.Queue` per device with `QueueFull` drop + reconnect (compatible with `max_instances=1`/`--workers 1` invariant)
- [x] **SGN-BE-06**: `backend/app/services/signage_resolver.py` — tag-to-playlist query with `priority DESC, updated_at DESC` tiebreak; LIMIT 1 per device
- [x] **SGN-BE-07**: PPTX conversion pipeline — `asyncio.subprocess_exec(soffice)` + `asyncio.wait_for(60)` + `asyncio.Semaphore(1)` + per-conversion tempdir with `-env:UserInstallation=file:///tmp/lo_<uuid>` + 50MB upload cap
- [x] **SGN-BE-08**: `signage_media.conversion_status` state machine (`pending | processing | done | failed`) + startup reset of stuck `processing` rows > 5 min old
- [x] **SGN-BE-09**: Router dep-audit test — every `/api/signage/*` admin route contains `require_admin`; every `/api/signage/player/*` route contains `get_current_device`
- [x] **SGN-BE-10**: CI grep guards — no `import sqlite3`, no `import psycopg2` in `backend/app/`; no sync `subprocess.run` in signage services (must use `asyncio.subprocess_exec`)

### Scheduler (SGN-SCH-*)

- [x] **SGN-SCH-01**: APScheduler heartbeat sweeper (1-min cadence) marks devices offline when `last_seen_at > 5 min`; `max_instances=1`, `coalesce=True`
- [x] **SGN-SCH-02**: Daily pairing session cleanup (reuse 03:00 UTC cron slot from v1.15 retention job) — deletes expired `signage_pairing_sessions` rows
- [x] **SGN-SCH-03**: PPTX stuck-row reset on scheduler startup — rows in `processing` > 5 min → `failed` (or re-queue to `pending` per Phase 44 decision)

### Admin Frontend (SGN-ADM-*)

- [x] **SGN-ADM-01**: `/signage` route registered in `frontend/src/App.tsx`, wrapped in `<AdminOnly>`
- [x] **SGN-ADM-02**: Admin-only launcher tile using `MonitorPlay` icon from lucide-react; i18n key `launcher.tiles.signage` (EN: "Digital Signage", DE: "Digital Signage")
- [x] **SGN-ADM-03**: `SignagePage.tsx` with tabs (Media / Playlists / Devices) via shadcn `<Tabs>`; mirrors `SensorsPage.tsx` shell pattern
- [ ] **SGN-ADM-04**: Media library — upload via Directus `/files` endpoint, list with thumbnail/type/size/tags, delete with "in use by N playlists" confirm dialog
- [ ] **SGN-ADM-05**: Playlist editor — name, tags, ordered item list with drag-reorder, per-item `duration_s` + transition + media picker
- [ ] **SGN-ADM-06**: Device table — name, tags, status chip (green/amber/red from `last_seen_at`), current playlist, edit + remove + revoke-token actions
- [ ] **SGN-ADM-07**: `/signage/pair` page — admin enters 6-digit code + device name + tags → `POST /api/signage/pair/claim`
- [x] **SGN-ADM-08**: Tag picker component shared across playlists + devices (autocomplete + create-on-submit)
- [ ] **SGN-ADM-09**: Dirty-guard + unsaved-changes dialog (reuse `UnsavedGuard` pattern from v1.15 settings sub-pages)
- [x] **SGN-ADM-10**: Full DE/EN i18n parity for all `signage.admin.*` keys ("du" tone for German); missing-key CI gate

### Player Frontend (SGN-PLY-*)

- [ ] **SGN-PLY-01**: Separate Vite entry — `frontend/player.html` + `rollupOptions.input.player`; served at `GET /player/:device_token` with target bundle size <200KB gzipped
- [ ] **SGN-PLY-02**: Player auth — reads `:device_token` from URL path, stores in `localStorage`, uses `Authorization: Bearer <token>` in API calls
- [ ] **SGN-PLY-03**: Pairing screen — if no token, Pi calls `POST /api/signage/pair/request`, displays 6-digit code `XXX-XXX` format, polls `/pair/status` every 3s with UUID `pairing_session_id`
- [ ] **SGN-PLY-04**: Playlist fetch — `GET /api/signage/player/playlist` on boot + on SSE event; 30s polling fallback when SSE disconnected
- [ ] **SGN-PLY-05**: Heartbeat — `POST /api/signage/player/heartbeat` every 60s with `current_item_id`
- [ ] **SGN-PLY-06**: SSE subscription — `GET /api/signage/player/stream` with 45s client watchdog (close + recreate on silence); `sse-starlette` server-side emits 15s heartbeat pings
- [ ] **SGN-PLY-07**: Format handlers — ImagePlayer (fade transition), VideoPlayer (`<video muted autoplay playsinline>`), PdfPlayer (pdf.js with auto-page-flip + crossfade), IframePlayer (sandboxed `<iframe>` with HEAD pre-flight), HtmlPlayer (nh3-sanitized content + sandboxed `<iframe srcdoc>`), PptxPlayer (renders image sequence from converted slides)
- [ ] **SGN-PLY-08**: Service Worker + Cache API for media (stale-while-revalidate for playlist metadata, cache-first for media assets); `localStorage` for playlist manifest
- [ ] **SGN-PLY-09**: Offline cache-and-loop — when network drops, keep looping last-cached playlist until reconnect; service worker serves cached media for SSG-PLY-07 handlers
- [ ] **SGN-PLY-10**: pdf.js worker URL configured via `?url` import: `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` → `GlobalWorkerOptions.workerSrc` (exact version match with `pdfjs-dist@5.6.205`)

### Differentiators (SGN-DIFF-*)

- [x] **SGN-DIFF-01**: Real-time SSE push (covered by SGN-BE-02 + SGN-PLY-06; reserved ID for audit / ticket tracing)
- [x] **SGN-DIFF-02**: WYSIWYG admin preview panel — embeds player component in admin UI for playlist preview before publishing changes; uses `react-pdf` (admin-only) for PDF preview
- [ ] **SGN-DIFF-03**: PDF crossfade transition between pages (smooth opacity fade vs. hard cut); 200ms default, admin-configurable per playlist

### Operations & Docs (SGN-OPS-*)

- [ ] **SGN-OPS-01**: Bilingual admin guide — `frontend/src/docs/admin/digital-signage.en.md` + `frontend/src/docs/admin/digital-signage.de.md` — covers onboarding a Pi (image → boot → pair → tag), uploading media, building playlists, troubleshooting (offline behavior, Wi-Fi flakiness, font rendering), PPTX best practices (embed fonts)
- [ ] **SGN-OPS-02**: Docs index updated (both locales) to list the new admin-guide article
- [ ] **SGN-OPS-03**: Operator runbook — Pi image build (Bookworm Lite 64-bit + Chromium 136+ + unclutter + systemd user service), Chromium kiosk flag set (`--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland --app=<url>`), systemd unit with `After=graphical.target` + DISPLAY gate + `loginctl enable-linger`, dedicated `signage` user (NOT root — keeps Chromium sandbox enabled), fallback to image-only playlist if PPTX/PDF fail on Pi hardware

### Infrastructure (SGN-INF-*)

- [x] **SGN-INF-01**: Backend Dockerfile adds LibreOffice (`libreoffice-impress` + `libreoffice-core` 24.x), `poppler-utils`, Carlito/Caladea/Noto/DejaVu fonts to apt layer (font metrics match Calibri/Cambria for PPTX fidelity)
- [x] **SGN-INF-02**: `docker-compose.yml` adds `directus_uploads:/directus/uploads:ro` mount into `api`; `migrate → directus` startup ordering enforced via `depends_on.migrate.condition: service_completed_successfully` (prevents Directus introspection race on fresh tables)
- [x] **SGN-INF-03**: `--workers 1` invariant preserved and documented inline — SSE + APScheduler singleton + in-process asyncio.Queue fanout all depend on it; comment block added to `signage_broadcast.py` mirroring existing comment in `docker-compose.yml` + `scheduler.py`

---

## Future Requirements (v1.17+ or later)

- **SGN-FUTURE-01**: Dayparting / time-based schedules per device (different playlists at different times of day/week)
- **SGN-FUTURE-02**: Email / Slack alerts on device offline (blocked on SMTP provisioning — same blocker as v1.15 DIFF-02/03)
- **SGN-FUTURE-03**: Proof-of-play analytics / reporting (per-device play counts, duration reports)
- **SGN-FUTURE-04**: Fleet-scale features (20+ devices, grouping, bulk actions)
- **SGN-FUTURE-05**: Per-device calibration (resolution override, color profile, rotation)
- **SGN-FUTURE-06**: Per-item transition picker (fade / slide / zoom / cut configurable)
- **SGN-FUTURE-07**: Media expiration dates + auto-archive
- **SGN-FUTURE-08**: External REST API for third-party CMS / DAM integration
- **SGN-FUTURE-09**: Multi-site federation (central CMS, regional device groups)
- **SGN-FUTURE-10**: Mobile admin app or responsive admin UI optimized for phone/tablet
- **SGN-FUTURE-11**: Native browser PPTX rendering (skip server-side conversion) — only if browser capabilities change
- **SGN-FUTURE-12**: Server-side video transcoding on upload (target device bitrate / codec)
- **SGN-FUTURE-13**: Xibo-style region/layout engine (multiple zones per screen)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dayparting schedules in v1.16 | Adds significant state-machine complexity; simple one-playlist-per-tag resolves 80% of use cases for ≤5 devices |
| Email/Slack alerting on device offline in v1.16 | No SMTP infrastructure; deferred until provisioned (same blocker as v1.15 sensor alerts) |
| Fleet-scale features (20+ devices) | Small-fleet scope chosen; re-evaluate if fleet grows |
| Cloud/SaaS deployment | Internal tool, self-hosted only |
| Native mobile player app | Chromium kiosk on Pi is the chosen player; no iOS/Android build |
| SNMP traps / external monitoring integration | Out of scope for signage; separate from v1.15 sensor monitoring |
| Content scheduling via external calendar integrations (Google Calendar, Outlook) | Over-engineering for internal signage use |
| Video live-streaming (RTSP, HLS) | Static content only; live streams deferred |
| Touch interaction / kiosk interactivity | Display-only; no touch UX |
| Content approval workflows | Admin-only app; no author/approver role split |
| AI-generated media / dynamic content | Out of scope — pure CMS-driven display |
| Proof-of-play analytics in v1.16 | Requires timeseries + per-device reporting; v1.17+ |

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SGN-DB-01 | Phase 41 | Complete |
| SGN-DB-02 | Phase 41 | Complete |
| SGN-DB-03 | Phase 41 | Complete |
| SGN-DB-04 | Phase 41 | Complete |
| SGN-DB-05 | Phase 41 | Complete |
| SGN-INF-02 | Phase 41 | Complete |
| SGN-BE-03 | Phase 42 | Complete |
| SGN-BE-04 | Phase 42 | Complete |
| SGN-SCH-02 | Phase 42 | Complete |
| SGN-BE-01 | Phase 43 | Complete |
| SGN-BE-02 | Phase 43 | Complete |
| SGN-BE-06 | Phase 43 | Complete |
| SGN-BE-09 | Phase 43 | Complete |
| SGN-BE-10 | Phase 43 | Complete |
| SGN-SCH-01 | Phase 43 | Complete |
| SGN-BE-07 | Phase 44 | Complete |
| SGN-BE-08 | Phase 44 | Complete |
| SGN-SCH-03 | Phase 44 | Complete |
| SGN-INF-01 | Phase 44 | Complete |
| SGN-BE-05 | Phase 45 | Complete |
| SGN-DIFF-01 | Phase 45 | Complete |
| SGN-INF-03 | Phase 45 | Complete |
| SGN-ADM-01 | Phase 46 | Complete |
| SGN-ADM-02 | Phase 46 | Complete |
| SGN-ADM-03 | Phase 46 | Complete |
| SGN-ADM-04 | Phase 46 | Pending |
| SGN-ADM-05 | Phase 46 | Pending |
| SGN-ADM-06 | Phase 46 | Pending |
| SGN-ADM-07 | Phase 46 | Pending |
| SGN-ADM-08 | Phase 46 | Complete |
| SGN-ADM-09 | Phase 46 | Pending |
| SGN-ADM-10 | Phase 46 | Complete |
| SGN-DIFF-02 | Phase 46 | Complete |
| SGN-PLY-01 | Phase 47 | Pending |
| SGN-PLY-02 | Phase 47 | Pending |
| SGN-PLY-03 | Phase 47 | Pending |
| SGN-PLY-04 | Phase 47 | Pending |
| SGN-PLY-05 | Phase 47 | Pending |
| SGN-PLY-06 | Phase 47 | Pending |
| SGN-PLY-07 | Phase 47 | Pending |
| SGN-PLY-08 | Phase 47 | Pending |
| SGN-PLY-09 | Phase 47 | Pending |
| SGN-PLY-10 | Phase 47 | Pending |
| SGN-DIFF-03 | Phase 47 | Pending |
| SGN-OPS-01 | Phase 48 | Pending |
| SGN-OPS-02 | Phase 48 | Pending |
| SGN-OPS-03 | Phase 48 | Pending |

**Coverage:**
- Active requirements: 47 total
- Mapped to phases: 47 ✓
- Unmapped: 0

---

*Requirements defined: 2026-04-18*
*Last updated: 2026-04-18 — traceability filled per v1.16 roadmap (Phases 41–48)*
