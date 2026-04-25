# Research Summary — v1.16 Digital Signage

**Domain:** Digital signage CMS (admin) + Chromium-kiosk player (Raspberry Pi, ≤5 devices) added to existing FastAPI + Directus + React monorepo
**Researched:** 2026-04-18
**Confidence:** HIGH for version pins + integration patterns; MEDIUM for Pi/Chromium boot ordering and PPTX worker location (both with defensible recommendations + surfaced trade-offs)

> Scope: extends validated v1.15 stack (FastAPI 0.135, SQLAlchemy 2.0 async, asyncpg, Alembic, Directus 11, React 19, Vite 8, Tailwind v4, shadcn/ui, TanStack Query 5, APScheduler single-worker, Fernet, @directus/sdk). Reuses router-level admin gate via `APIRouter(dependencies=)`, flat models.py/schemas.py, shared `apiClient<T>()`, full DE/EN i18n parity, `--workers 1` + `max_instances=1` invariant.

## Executive Summary

Digital signage is a well-established category. Four reference platforms (Xibo, Screenly OSE, Yodeck, Rise Vision) converge on a universal floor: **Media + Playlist + Device + Tag routing + 6-digit Pairing + Offline cache + format handlers** (image/video/URL/PDF/PPTX/HTML). For ≤5 devices on a single site, the target is "Screenly-OSE floor + three Yodeck-tier niceties" (SSE push, WYSIWYG admin preview, PDF crossfade) — skipping Xibo layout engines, dayparting, and proof-of-play.

Recommended stack additions: `sse-starlette` for server-push, `pdf2image` + LibreOffice headless for PPTX→PDF→PNG, raw `pdfjs-dist` for player-side page-flip, `vite-plugin-pwa` for offline caching, Raspberry Pi OS Bookworm Lite + Chromium kiosk + systemd user service. No new runtime services (no Redis, no Celery) — in-process `asyncio.Queue` fanout + FastAPI `BackgroundTasks` + `--workers 1` are correct-sized.

Three highest-impact risks: (1) PPTX pipeline wedging event loop on corrupt decks (async subprocess + timeout + semaphore); (2) Chromium EventSource zombie-reconnect after Pi Wi-Fi drops (server pings + client watchdog + polling fallback); (3) device-token over-scoping letting a stolen Pi hit admin routes (scope claim + rotation + admin-revoke).

## Key Findings

### New Stack Additions

**Backend (requirements.txt):**
- `sse-starlette==3.2.0` — EventSourceResponse with heartbeat/disconnect
- `pdf2image==1.17.0` — `pdftoppm` wrapper; PDF → per-slide PNGs
- (transitive) Pillow — downscale to 1920×1080

**Backend Dockerfile apt layer:**
- `libreoffice-impress` + `libreoffice-core` (24.x) — only mature FOSS PPTX→PDF
- `poppler-utils` — for pdf2image
- `fonts-crosextra-carlito`, `fonts-crosextra-caladea`, `fonts-noto-core`, `fonts-dejavu` — **critical**: without Carlito/Caladea (metric-compatible Calibri/Cambria), output drifts visibly from PowerPoint source

**Frontend (npm):**
- `pdfjs-dist@5.6.205` — raw PDF.js for player page-flip (lower-level than react-pdf; exact control)
- `react-pdf@10.4.1` — admin-UI preview only (keeps player bundle small)
- `vite-plugin-pwa@1.x` — scoped SW for `/signage/player`
- `@directus/sdk@21.2.2` — verify pin; bump before feature work if behind

**Pi host:**
- Raspberry Pi OS Bookworm Lite 64-bit; Chromium 136+ via apt; systemd user service (NOT `/etc/xdg/autostart` — Bookworm dropped LXDE autostart path); `unclutter` for cursor-hide
- Mandatory Chromium flags: `--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland --check-for-update-interval=31536000 --app=<url>`

**Do NOT add:** Celery/RQ/ARQ, Redis, react-player/video.js, framer-motion/embla-carousel, unoconv.

### Expected Features

**Must-have table stakes (20 items, all P1):**
- **HIGH complexity:** SGN-14 PPTX handler (longest pole)
- **MEDIUM:** SGN-01 Media library, SGN-03 Playlist CRUD, SGN-04 Device CRUD, SGN-05 Tag routing, SGN-06 6-digit pairing, SGN-07 Offline cache, SGN-13 PDF handler, SGN-17 Kiosk player route, SGN-19 Alembic schema
- **LOW:** SGN-02 tagging, SGN-08 polling+heartbeat, SGN-09 status chips, SGN-10/11/12 image/video/URL, SGN-15 HTML snippet, SGN-16 launcher tile, SGN-18 DE/EN UI+docs, SGN-20 APScheduler sweeper

**Should-have differentiators (ship 3 cheap wins):**
- DIFF-01 SSE real-time push
- DIFF-02 WYSIWYG admin preview
- DIFF-03 PDF crossfade

**Deferred:** per-item transition picker, health alerts (needs SMTP), expiration dates, thumbnails, "healthy since X"

**Anti-features (explicit NOT in v1.16):** dayparting schedules, proof-of-play analytics, native browser PPTX rendering, multi-site federation, mobile control app, external API, Xibo-style regions, on-the-fly video transcoding, per-device resolution adaptation, 20+-device fleet tooling.

### Architecture Approach

v1.16 adds a second first-class launcher app (admin-only `/signage`) plus a separate player surface served outside the main SPA. Admin CRUD flows through a new `/api/signage/*` FastAPI router (Alembic-owned schema per v1.11 convention), Directus SDK retained for auth only. Player is a separate Vite bundle targeting <200KB gzipped vs. ~600KB main SPA.

**Major new components:**
1. Backend routers (3): admin (admin-gated), player (device-token-gated), pair (unauthenticated pre-auth)
2. Device auth module — opaque token OR scoped JWT (decision flagged)
3. Pairing state machine — 6-digit base32 code (confusing-char-free alphabet), `signage_pairing_sessions` table, Pi polls by UUID session_id, partial-unique index on active rows
4. SSE broadcast service — in-process `asyncio.Queue` per device, fanout on admin mutations
5. PPTX conversion — `asyncio.subprocess_exec(soffice)` + `asyncio.wait_for(60s)` + `asyncio.Semaphore(1)` + per-invocation tempdir with `-env:UserInstallation=file:///tmp/lo_<uuid>`
6. Alembic migration — 8 tables + partial-unique index on active pairing codes + `ON DELETE RESTRICT` on `playlist_items.media_id`
7. Player bundle — second Vite entry, SSE EventSource + 45s watchdog + 30s polling fallback + offline cache
8. Admin UI — `SignagePage.tsx` with Media|Playlists|Devices tabs (mirrors SensorsPage.tsx), `SignagePairPage.tsx`, launcher tile, WYSIWYG preview
9. APScheduler heartbeat sweeper — 1-min cadence, respects `max_instances=1`

**Integration points:** `models.py` (+8), `schemas.py` (+Pydantic), `main.py` (+3 routers, +player static mount), `scheduler.py` (+sweeper + pairing cleanup), `docker-compose.yml` (+volume mount, +optional pptx-worker), `LauncherPage.tsx`, `App.tsx` routes, `vite.config.ts` (+second input), `en.json`/`de.json` (+`signage.*`), `lib/api.ts` (+apiClient fetchers).

### Top 7 Pitfalls (drive roadmap decisions)

1. **LibreOffice hangs on corrupt PPTX → wedges `--workers 1` event loop.** `asyncio.subprocess_exec` only (never sync `subprocess.run`), `asyncio.wait_for(60s)` → `proc.kill()`, `asyncio.Semaphore(1)`, 50MB upload cap, per-conversion tempdir + `-env:UserInstallation`, startup reset of stuck `converting` rows. **Phase 44.**

2. **Chromium EventSource zombie after Wi-Fi drops.** sse-starlette 15s ping, player 45s watchdog `.close()` + recreate, 30s polling coexists. Reverse proxy needs `proxy_buffering off` + `proxy_read_timeout` ≥ heartbeat. **Phases 45+47+48.**

3. **Device token over-scoped → stolen Pi hits admin API.** JWT with `scope: "device"` enforced per-route, rotate on heartbeat within 2h of expiry (1h grace), admin "Revoke" flips `revoked_at`. **Phases 42+46+47.**

4. **PPTX CVE via LibreOffice → RCE with DB reach.** Isolated conversion container: minimal base, `read_only: true`, tmpfs, `cap_drop: [ALL]`, `security_opt: no-new-privileges`, no DB network. **Phase 44.**

5. **Font rendering drift dev laptop vs. container.** Carlito/Caladea/Noto/DejaVu in Dockerfile; document "Embed fonts in PPTX" workflow; CI visual-regression on reference deck. **Phase 44 + Docs.**

6. **pdf.js worker missing under Vite → main-thread render.** `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` → `GlobalWorkerOptions.workerSrc`; exact version-match. **Phase 47.**

7. **Browser cache is not reliable offline store on Pi.** HTTP cache evicts; nightly reboot → empty → black screen. STACK recommends vite-plugin-pwa SW + Cache API scoped to `/signage/player`; PITFALLS warns SW requires HTTPS on non-localhost and proposes Pi-side sidecar writing manifest + media to `/var/lib/signage/`. **Open Decision 3.** **Phases 47+48.**

**Honorable mentions:** Chromium boot ordering (systemd `After=graphical.target`), exact Chromium flag set, 4K → server-side downscale, pairing collision/race, Alembic/Directus startup race (`service_completed_successfully` on `migrate`), DE i18n parity CI gate (v1.15 lesson), HTML snippet XSS (nh3 + sandboxed iframe).

## Implications for Roadmap

Research supports an 8-phase structure matching ARCHITECTURE.md §5. Phase 44 (PPTX) and Phase 47 (Player) are the two longest poles.

- **Phase 41 — Signage Schema & Models.** Foundational; blocks all downstream. 8 tables + partial-unique index + RESTRICT FK + SQLAlchemy models + Pydantic schemas + `DB_EXCLUDE_TABLES` updates. Research: LIGHT.
- **Phase 42 — Device Auth + Pairing Flow.** Required before any player endpoint. `device_auth.py`, `signage_pair` router (request/status/claim with UUID session_id), cleanup job, admin-gate regression test. Research: MEDIUM (opaque vs. JWT).
- **Phase 43 — Media + Playlist + Device Admin API (polling-only).** Trunk functionality. `signage_admin` full CRUD, tag-to-playlist resolver, `signage_player` `/playlist` + `/heartbeat`, apiClient fetchers. Research: LIGHT (mirror v1.15 sensors).
- **Phase 44 — PPTX Conversion Pipeline.** Independent; parallelize with 45. Dockerfile apt layer, async subprocess + timeout + semaphore, upload cap, status state machine, startup reset, downscale, visual-regression CI gate. Research: **HEAVY**.
- **Phase 45 — SSE Broadcast.** Depends on 43. `signage_broadcast.py` with asyncio.Queue per device, `/events` via sse-starlette, 15s pings, 5-connection cap, `--workers 1` invariant comment. Research: MEDIUM (watchdog tuning on real Pi).
- **Phase 46 — Admin UI.** Depends on 42+43 (optionally 45). `/signage` tabbed page, `/signage/pair`, launcher tile, App.tsx routes, DE/EN parity with CI, WYSIWYG preview, iframe HEAD pre-flight, nh3 sanitization. Research: LIGHT.
- **Phase 47 — Player Bundle.** Depends on 42/43/45. `player.html` Vite entry, static mount, format handlers (image, video muted/playsinline/autoplay, pdf.js with worker URL + crossfade, sandboxed iframe, sandboxed HTML, PPTX-as-image-sequence), EventSource + watchdog, polling fallback, offline cache, persistent pairing state. Research: **HEAVY**.
- **Phase 48 — Pi Provisioning + E2E + Docs.** systemd user service, Chromium kiosk flag set, dedicated `signage` user, unclutter, offline sidecar if chosen, E2E (fresh Pi → code → claim → playlist → play → net drop → loop → restore), bilingual admin guide, operator runbook. Research: MEDIUM.

**Ordering rationale:** 41 gates everything; 42 gates 43/45/47; 44 independent (start early); 45 ships after 46 is tolerable; 47 needs 42+43+45; 48 last.

**Needs `/gsd:research-phase` during planning:** Phase 44 (HEAVY — worker location, failure UX, visual-regression baseline), Phase 47 (HEAVY — offline cache architecture, pdf.js Vite integration, Pi 4 memory), Phase 42 (MEDIUM — token format), Phase 45 (MEDIUM — watchdog tuning), Phase 48 (MEDIUM — hardware validation).

**Standard patterns (skip research):** Phase 41 (Alembic), Phase 43 (mirror v1.15 sensor API), Phase 46 (mirror v1.15 admin UI).

## Open Decisions (STACK ↔ ARCHITECTURE ↔ PITFALLS diverge — roadmap must resolve)

| # | Decision | Option A (STACK-leaning) | Option B (ARCH/PITFALLS-leaning) | Resolve in |
|---|----------|--------------------------|-----------------------------------|------------|
| 1 | PPTX worker location | LibreOffice in api container + BackgroundTasks (simpler) | Dedicated pptx-worker container, read_only + cap_drop + no DB net; Postgres `FOR UPDATE SKIP LOCKED` queue (CVE blast-radius) | Phase 44 plan |
| 2 | Media storage | Directus file storage + read-only volume mount; player fetches `/assets/<uuid>` | Backend-owned `/app/media/<uuid>.<ext>`; Directus metadata only; stable `/api/signage/media/:id/file` URL | Phase 41 plan (binds 43+44) |
| 3 | Player offline cache | `vite-plugin-pwa` Service Worker + Cache API scoped to `/signage/player` | Pi-side sidecar (systemd before Chromium) writing manifest + media to `/var/lib/signage/` (SW needs HTTPS, nightly-reboot eviction) | Phase 47 plan (binds 48) |
| 4 | Device token format | Opaque `secrets.token_urlsafe(32)` sha256-hashed; lives until admin revokes | Short-lived JWT HS256, `scope: "device"`, 24h exp, rotate on heartbeat within 2h + 1h grace | Phase 42 plan |

**Recommendation:** Default to Option B on 1/3/4 (security-first, resilience-first); Option A on 2 (simplicity-first). Each phase plan runs ≤1-day spike to confirm.

## MVP Definition

**Admin:** `/signage` admin-only launcher tile; Media library (upload image/video/PDF/PPTX/URL/HTML, preview, tag, delete with "in use by N"); Playlist CRUD (reorder + per-item duration + target-tag picker); Device list with green/amber/red status + edit + delete + issue pairing code; Pair flow (admin enters 6-digit code + name + tags); WYSIWYG preview panel; Full DE/EN parity + bilingual admin-guide article.

**Player (Chromium kiosk at `/player/:device_token`):** Boot-time pairing-code display; polling resolve + 30s heartbeat; SSE push with pings + watchdog (DIFF-01); offline cache-and-loop; format handlers (image, video muted/playsinline/autoplay, sandboxed iframe URL with pre-flight warning, pdf.js with crossfade + 50-page cap + image fallback, sanitized+sandboxed HTML snippet, PPTX as image sequence).

**Infra:** Alembic migration (8 tables + partial-unique index + RESTRICT FK); FastAPI `/api/signage/*` (3 sub-routers); PPTX pipeline with 60s timeout + semaphore(1) + 50MB cap + state machine + startup reset; APScheduler heartbeat sweeper + pairing cleanup (`max_instances=1`); updated docker-compose.

**NOT in MVP:** dayparting, email/toast alerts, transition picker, expiration dates, thumbnail rows, analytics, 20+ device fleet tools, multi-site, mobile app, external API, regions/zones, video transcoding.

## Open Questions for Phase-Level Research

1. **PPTX failure UX** — hard "Upload failed" with no row, or persistent `failed` row with retry button? (Phase 44)
2. **Offline cache eviction policy** — 500MB LRU? "Never evict current playlist"? 7-day grace after removed from manifest? (Phase 47)
3. **Device-token scope enforcement model** — `Depends(require_scope("device"))` vs. middleware? Composition with existing admin-gate `APIRouter(dependencies=)` pattern. (Phase 42)
4. **Pairing TTL + rate-limit tuning** — 10 vs. 5 min; `/pair/request` rate (5/min? 10/hour?). (Phase 42)
5. **Watchdog tuning** on real Pi Wi-Fi — validate 45s silence → reconnect. (Phase 45 verification)
6. **Visual-regression CI gate baseline** — which reference PPTX, diff threshold, CI env with LibreOffice. (Phase 44)
7. **Directus SDK version bump** — is current pin ≥21.2.2 or does Phase 41 need a clean-migration pre-commit? (Phase 41 pre-work)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack versions | HIGH | All npm/PyPI/Docker verified directly; Pi/Chromium/systemd cross-verified ≥4 independent 2025-2026 sources |
| Feature taxonomy | HIGH | Four reference platforms converge; anti-features explicit |
| Architecture patterns | HIGH on reuse of v1.11/v1.15; MEDIUM on PPTX worker location + media storage + bundle split |
| Pitfalls + prevention | HIGH | Upstream + community docs; all 24 pitfalls have mitigation |
| Complexity labels | MEDIUM | PPTX + player hours could swing ±50% on edge-case UX |

**Overall:** HIGH for scope/approach/risk; MEDIUM for exact phase sizing.

### Gaps Needing Runtime Validation
- Real Pi hardware for Wayland + systemd linger + EventSource reconnect — book Pi access early (Phase 42/44), not just Phase 48
- Visual-regression PPTX baseline needs representative German-office deck
- Reverse-proxy topology (if any Nginx/Caddy/Traefik in front of FastAPI): `proxy_buffering off` + `proxy_read_timeout` settings
- pdf.js + video + crossfade memory ceiling on actual Pi 4
