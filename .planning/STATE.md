---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: UI Consistency Pass 2
status: roadmap
stopped_at: Roadmap drafted — awaiting phase 54 planning
last_updated: "2026-04-21T22:00:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: KPI Dashboard

**Last updated:** 2026-04-21
**Session:** v1.19 UI Consistency Pass 2 — roadmap drafted

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 54 — toggle primitive + migrations (TOGGLE-01..05)

Previous milestone v1.18 Pi Polish + Scheduling shipped 2026-04-21 (tag `v1.18`).
Previous milestone v1.17 Pi Image Release shipped 2026-04-21 (tag `v1.17`).
Previous milestone v1.16 Digital Signage shipped 2026-04-20 (tag `v1.16`).

---

## Current Position

Milestone: v1.19 UI Consistency Pass 2 — roadmap drafted
Phase: 54 (not started)
Plan: —
Status: Roadmap drafted — awaiting phase 54 planning
Last activity: 2026-04-21 — v1.19 roadmap created (6 phases, 23/23 requirements mapped)

Progress: 0/6 phases complete, 0 plans

Next action: Run `/gsd:plan-phase 54` to break Toggle primitive + migrations into plans.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260421-r4b | Fix admin Devices tab: list_devices returns tags and investigate stale heartbeat/uptime | 2026-04-21 | eff6e52 | [260421-r4b-fix-admin-devices-tab-list-devices-retur](./quick/260421-r4b-fix-admin-devices-tab-list-devices-retur/) |

---

## Performance Metrics

**Velocity (v1.15):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 38 P01 | 228s | 2 tasks | 6 files |
| Phase 38 P02 | 374s | 2 tasks | 6 files |
| Phase 38 P03 | 4m 17s | 4 tasks | 4 files |
| Phase 39 P01 | 3 min | 3 tasks | 12 files |
| Phase 39 P02 | 377s | 2 tasks | 12 files |
| Phase 40 P01 | 35m | 3 tasks | 18 files |
| Phase 40 P03 | 15m | 1 task | 5 files |

*Updated after each plan completion*

---
| Phase 41 P04 | 2min | 1 tasks | 1 files |
| Phase 41 P02 | 156 | 1 tasks | 4 files |
| Phase 41 P01 | 12m | 2 tasks | 2 files |
| Phase 41 P03 | 152s | 2 tasks | 1 files |
| Phase 41 P05 | 35m | 1 tasks | 3 files |
| Phase 42 P01 | 12m | 3 tasks | 10 files |
| Phase 42 P02 | 3m | 1 tasks | 3 files |
| Phase 42 P03 | 278s | 2 tasks | 5 files |
| Phase 43 P01 | 6m | 2 tasks | 3 files |
| Phase 43 P02 | 3m | 2 tasks | 3 files |
| Phase 43 P04 | 8m | 3 tasks | 5 files |
| Phase 43 P03 | 3m 28s | 2 tasks | 8 files |
| Phase 43 P05 | 4m | 2 tasks | 2 files |
| Phase 44 P01 | 102s | 1 tasks | 1 files |
| Phase 44 P04 | 2m | 1 tasks | 2 files |
| Phase 44 P02 | 3.5m | 2 tasks | 4 files |
| Phase 44 P03 | 4m | 2 tasks | 3 files |
| Phase 44 P05 | 10m | 3 tasks | 5 files |
| Phase 45 P01 | 15m | 3 tasks | 5 files |
| Phase 45 P02 | 40m | 3 tasks | 6 files |
| Phase 45 P03 | 15m | 2 tasks | 2 files |
| Phase 46 P03 | 152 | 2 tasks | 8 files |
| Phase 46 P01 | 5m | 3 tasks | 13 files |
| Phase 46 P02 | 4m | 3 tasks | 6 files |
| Phase 46 P04 | 271s | 3 tasks | 5 files |
| Phase 46 P06 | 4m | 3 tasks | 6 files |
| Phase 46 P05 | 9m | 3 tasks | 8 files |
| Phase 47-player-bundle P01 | 6m | 5 tasks | 10 files |
| Phase 47-player-bundle P02 | 2m | 3 tasks | 3 files |
| Phase 47-player-bundle P03 | 8m | 5 tasks | 8 files |
| Phase 47-player-bundle P04 | 6m | 3 tasks | 4 files |
| Phase 47-player-bundle P05 | 180m | 5 plan tasks + 11 defect fixes | 20 files |
| Phase 48 P01 | 263 | 3 tasks | 6 files |
| Phase 48 P02 | 211s | 3 tasks | 5 files |
| Phase 48 P03 | 7m | 3 tasks | 4 files |
| Phase 48 P04 | 540s | 2 tasks | 6 files |
| Phase 49-pi-image-build P01 | 303s | 3 tasks | 15 files |
| Phase 50-pi-polish P01 | 4m | 3 tasks | 2 files |
| Phase 51 P01 | 9m 5s | 3 tasks | 12 files |
| Phase 51 P02 | 7m | 2 tasks | 4 files |
| Phase 52 P03 | 2m | 2 tasks | 2 files |
| Phase 52 P01 | 146s | 3 tasks | 6 files |
| Phase 52 P02 | 644s | 4 tasks | 16 files |
| Phase 53 P01 | 7m 53s | 3 tasks | 13 files |
| Phase 53 P02 | 15m | 4 tasks | 12 files |

## Accumulated Context

### Decisions

- **v1.16 scope:** 8 phases (41–48), 47 requirements across DB/BE/SCH/ADM/PLY/DIFF/OPS/INF
- **Phase structure:** Schema → Auth/Pair → Admin/Player API (polling) → PPTX → SSE → Admin UI → Player Bundle → Pi/E2E/Docs. Polling ships first, SSE grafts on top (belt-and-braces).
- **Phase 41:** 8-table Alembic migration, partial-unique index on pairing codes, `ON DELETE RESTRICT` on playlist_items.media_id, Directus `DB_EXCLUDE_TABLES` for devices + pairing_sessions, migrate→directus startup ordering via `service_completed_successfully`.
- **Phase 42:** Device auth dep, pair/request/status/claim flow, pairing cleanup in 03:00 UTC cron slot. Token format decision (opaque vs. JWT scoped) deferred to phase planning.
- **Phase 43:** Admin router with `APIRouter(dependencies=[Depends(get_current_user), Depends(require_admin)])`, tag-to-playlist resolver (priority DESC, updated_at DESC, LIMIT 1), polling /playlist + /heartbeat, heartbeat sweeper, CI grep guards + dep-audit test.
- **Phase 44:** PPTX conversion — `asyncio.subprocess_exec` + `asyncio.wait_for(60)` + `Semaphore(1)`, per-conv tempdir, 50MB cap, state machine, startup reset. Worker location (api container vs. dedicated pptx-worker) deferred to phase planning.
- **Phase 45:** SSE via `sse-starlette==3.2.0`, per-device `asyncio.Queue(maxsize=32)`, 15s server pings, admin-mutation notify fanout, explicit `--workers 1` invariant comment block.
- **Phase 46:** `/signage` tabs (Media/Playlists/Devices), `/signage/pair`, launcher tile (MonitorPlay icon), WYSIWYG preview via `react-pdf` admin-side, apiClient-only, no `dark:` variants, DE/EN parity CI.
- **Phase 47:** Separate Vite entry (<200KB gz target), EventSource + 45s watchdog + 30s polling fallback, pdf.js worker via `?url` import pinned to `pdfjs-dist@5.6.205`, format handlers (img/video muted-autoplay-playsinline/pdf-crossfade/iframe sandbox+HEAD preflight/nh3-sanitized HTML srcdoc/PPTX as image sequence). Offline cache architecture (SW vs. Pi sidecar) deferred to phase planning.
- **Phase 48:** Pi provisioning as dedicated `signage` user (NOT root), systemd user service with `After=graphical.target`, Chromium kiosk flag set, bilingual admin guide article + docs-index entries, full E2E walkthrough (fresh Pi → pair → play → net drop → loop → restore).
- [Phase 41]: Plan 41-02: converted schemas.py into package and added 19 Pydantic v2 signage schemas (Base/Create/Read trios + pairing DTOs)
- [Phase 41]: Plan 41-03: handwritten v1_16_signage Alembic revision creating 8 signage tables, partial-unique pairing-code index, RESTRICT FK on playlist_items.media_id; no pgcrypto (PG17 gen_random_uuid builtin); no ENUM types (CHECK constraints for clean round-trip)
- [Phase 41]: Plan 41-05: SGN-DB-02 amended — partial-index predicate on signage_pairing_sessions.code is claimed_at IS NULL only. now() rejected by Postgres (errcode 42P17, non-IMMUTABLE). Expiration invariant now carried by the Phase 42 03:00 UTC pairing-cleanup cron. Round-trip test authored (test_signage_schema_roundtrip.py) catches the regression.
- [Phase 42]: SIGNAGE_DEVICE_JWT_SECRET required, no default (D-04); revoked device → 401 not 403 (D-14); in-process rate limit viable under --workers 1 invariant
- [Phase 42]: Plan 42-02: /api/signage/pair router delivers SGN-BE-03; Q1 resolved (unknown id → 200 expired, not 404); delete-on-deliver inside transaction; intentional exception to router-level admin-gate documented inline for Phase 43 dep-audit
- [Phase 42]: Plan 42-03: signage_pairing_cleanup 03:00 UTC cron carries SGN-DB-02 expiration invariant (D-13); device revoke endpoint lives on pair router (not new /devices router) to avoid preempting Phase 43 CRUD; idempotent revoke preserves original revoked_at for audit
- [Phase 43]: Plan 43-02: resolver duration_s->duration_ms conversion centralized at envelope boundary; compute_playlist_etag uses sha256('empty') sentinel for unmatched polls; resolver is pure-read (D-10)
- [Phase 43]: Plan 43-04: player router uses router-level Depends(get_current_device); /playlist is pure-read (D-10); heartbeat sweeper runs 1-min interval and excludes already-offline + revoked devices (D-15 idempotency)
- [Phase 43]: Plan 43-03: signage_admin router package with single router-level admin gate (D-01); 409-with-playlist_ids via JSONResponse on media FK RESTRICT (Pitfall 6); bulk-replace items + device/playlist tags in single-tx; D-21 (b) via directus_file_id -> uri mapping (no schema change)
- [Phase 43]: Plan 43-05: dep-audit PUBLIC_SIGNAGE_ROUTES locks pair/request + pair/status as the only public signage endpoints; CI grep guards enforce no sqlite3/psycopg2 anywhere in backend/app and no sync subprocess in signage modules
- [Phase 44]: Plan 44-01: Single apt layer adds libreoffice-impress+core, poppler-utils, Carlito/Caladea/Noto/DejaVu fonts; mkdir /app/media/slides at build time; CMD untouched (--reload preserved per plan)
- [Phase 44]: Plan 44-02: signage_pptx uses own httpx stream for Directus download (separate from directus_uploads.py upload helper) — upload and download have distinct HTTP shapes
- [Phase 44]: Plan 44-02: DIRECTUS_ADMIN_TOKEN defaults to empty string so module imports don't require a live token; real calls will 401 loudly
- [Phase 44]: Plan 44-03: PPTX upload endpoint streams via async iter over UploadFile.read(64KB) — HTTPException(413) fires inside uploader's inner generator BEFORE the full body enters memory (D-13); delete_slides_dir is called inline in /reconvert (not deferred into convert_pptx) so cleanup is deterministic
- [Phase 44]: Plan 44-05: fixtures committed as static blobs (python-pptx used one-off locally, NOT added to requirements); integration tests monkeypatch _download_pptx_from_directus and await convert_pptx directly; skip-without-binaries contract via shutil.which; stuck-reset integration has no binary dep
- [Phase 45]: Plan 45-01: signage_broadcast uses _warned_full attr stashed on asyncio.Queue instance (not a module-level set) — new queue from subscribe() has no attr so warn-once naturally resets per connection (Pitfall 7)
- [Phase 45]: Plan 45-01: devices_affected_by_playlist lives in signage_resolver.py (not a new module) per RESEARCH Q1 recommendation; devices_affected_by_device_update wrapper returning [device_id] gives admin notify hooks a uniform call shape for Plan 45-02
- [Phase 45]: Plan 45-02: SSE /stream uses sse-starlette EventSourceResponse(ping=15); generator re-raises CancelledError and pops _device_queues with None default (Pitfall 1). Admin mutations fire notify_device AFTER db.commit; playlist DELETE captures affected devices pre-commit (FK cascade); playlist tag-PUT unions prev+new affected sets; devices tag-PUT notifies self unconditionally; PPTX _set_done notify wrapped in try/except (broadcast failure must not roll back state).
- [Phase 45]: Plan 45-02: playlist_id serialized as str(uuid) in SSE payloads (actual schema uses UUIDs despite ROADMAP/CONTEXT <int> wording); disconnect cleanup test exercises the generator body directly rather than httpx.stream() over ASGITransport (infinite SSE generators cannot be cancelled deterministically through the test client).
- [Phase 45]: Plan 45-03: CI grep guards lock signage_broadcast hygiene (8 new guards including SGN-INF-03 triple-substring invariant assertion); /health (not /api/health) used as latency probe — it's the cheapest real route touching the async DB pool. 5-client benchmark drives generator shape directly (per Plan 02 pattern) rather than httpx.stream to avoid ASGI infinite-generator pitfall; observed p95=0.52ms vs 100ms threshold.
- [Phase 46]: 46-03: PlayerRenderer is pure presentational (D-10) — items[] in, auto-advance via per-item duration_s, fade-or-cut on next.transition, key={current.id} forces iframe/pdf state reset between items
- [Phase 46]: 46-03: PdfPlayer uses react-pdf default worker config (NO GlobalWorkerOptions override) per D-11 — Phase 47 owns the pdfjs-dist worker pin
- [Phase 46]: Plan 46-02: ApiErrorWithBody is signage-local variant of apiClient (single CI grep guard exemption); status colors light/dark invariant by design (semantic > theming); refetchInterval as terminal-aware function returning false on done/failed
- [Phase 46]: Plan 46-01: signage locale keys added as flat-dotted top-level entries to match parity script's Object.keys contract; launcher.tiles.signage (plural) is new sibling per D-16 — existing launcher.tile.* (singular) untouched
- [Phase 46]: Plan 46-01: AdminOnly wraps every /signage/* route at App.tsx level (not inside SignagePage) so viewer roles never instantiate the page; custom button-group sub-nav (NOT shadcn <Tabs>) keeps URL as source of truth
- [Phase 46]: 46-04: SignageMediaCreate Pydantic v2 default extra='ignore' silently drops unknown fields (tags, metadata, url from plan bodies) — upload + register + delete flows succeed end-to-end while URL/HTML content storage stays a backend follow-up. Frontend signageTypes.ts (from 46-02) also diverges from backend Read shape (directus_file_id/tags vs uri); deferred as cross-cutting reconciliation.
- [Phase 46]: 46-06: Device PATCH body is name-only; tag updates flow through PUT /devices/{id}/tags. updateDevice signageApi accepts {name, tag_ids} for ergonomics, internally only forwards {name}; DeviceEditDialog sequences PATCH then PUT
- [Phase 46]: 46-06: Revoke endpoint lives at /api/signage/pair/devices/{id}/revoke (not /api/signage/devices/{id}/revoke) per Phase 42 P03 placement; backend collapses pairing-claim 404 errors into one detail string — substring-match for inline UX
- [Phase 46]: Plan 46-05: backend update_playlist is PATCH (not PUT) and excludes tag_ids; tag mutations route through PUT /playlists/{id}/tags. createPlaylist server-side ignores tag_ids; PlaylistNewDialog collects name only and editor handles tags after.
- [Phase 46]: Plan 46-05: PlayerRenderer preview is fed by useWatch over react-hook-form items state (Pitfall 9); items not present in mediaLookup are silently skipped.
- [Phase 46]: Plan 46-05: useUnsavedGuard scopePath = '/signage/playlists/${id}'; '__back__' sentinel triggers history.go(-2) on confirm-discard. Parallel coalesce with 46-06 attributed App.tsx/signageApi.ts/UnsavedChangesDialog edits to commit 5780c41.
- [Phase 47-player-bundle]: OQ1 i18n Path B locked — hard-coded EN+DE strings.ts for bundle-size budget (Pitfall P9)
- [Phase 47-player-bundle]: OQ4 /stream ?token= query auth FAIL — backend dep only reads Authorization header; Plan 47-03 owns the 6-line backend tweak
- [Phase 47-player-bundle]: Plan 47-01: multi-entry vite + mode branching + manualChunks vendor-react + post-build player.html→index.html rename; react-is added as direct dep to unblock admin build after overrides reshuffle
- [Phase 47-player-bundle]: Plan 47-02: PairingScreen.tsx uses raw fetch() for /pair/request and /pair/status (unauthenticated per Phase 42 D-15); Plan 47-05 check-player-isolation must exempt as second file alongside playerApi.ts
- [Phase 47-player-bundle]: Plan 47-02: App.tsx (47-04) must register BOTH /player/:token and /player/ routes — useDeviceToken + clearToken rely on the no-token route for fall-through to PairingScreen
- [Phase 47-player-bundle]: OQ4 resolved: get_current_device accepts Authorization header OR ?token= query param
- [Phase 47-player-bundle]: VideoPlayer loop default stays true (backward compat); player wrapper passes loop={false}
- [Phase 47-player-bundle]: Plan 47-04: wouter Router base="/player" aligns with Vite base; FastAPI SPA fallback guards with PLAYER_DIST.exists() so pytest stays no-op; direct-serve with parent-equality path-traversal check keeps sw.js/manifest MIME types correct (Pitfall P6)
- [Phase 47-player-bundle]: Plan 47-05: SGN-PLY-01 bundle cap at 204,456 gz / 200,000 cap (2.2% over) — orchestrator decision pending at UAT checkpoint
- [Phase 47-player-bundle]: Plan 47-05: autonomous UAT (chrome-devtools MCP) surfaced 12 defects; 11 auto-fixed in 3334869 + 45f287c (tailwind missing, wouter double-base in 2 paths, localStorage-resume, media passthrough route, PLAYER_DIST container path, schema gap html/slide_paths, absolute-URL routing, devices tags shape). Open: D-7 SW scope cannot intercept /api/signage/player/* (D2-D4 fail), D-8 player fetch cache: no-store missing. Scenarios A/B1/C/E/F1/F3/F4/F5/G1/G3/G4 PASS; B2/B3/F2/F6 not exercised.
- [Phase 48]: Module-level state (not class) for single-device sidecar — simplest correct design for a process serving exactly one kiosk
- [Phase 48]: lifespan context manager (not deprecated @app.on_event) for background task lifecycle in Pi sidecar
- [Phase 48]: Token overwritten on each POST /token; os.chmod(0o600) called after every write to preserve permissions
- [Phase 48]: Static systemd units with __SIGNAGE_API_URL__/__SIGNAGE_UID__ token substitution over template units (%i) — simpler provision script, cleaner journalctl names
- [Phase 48]: Plan 48-03: postSidecarToken is fire-and-forget (void) in both PairingScreen + useSidecarStatus — sidecar absence must not delay pairing UX; prevStatusRef (useRef) tracks previous sidecar status for restart recovery without extra re-render
- [Phase 48]: Plan 48-04: toc.ts is heading-extraction utility only; digital-signage registered in registry.ts which owns both sections[] and registry content maps
- [Phase 48]: Plan 48-04: Operator runbook at docs/operator-runbook.md (repo root) per D-5 and RESEARCH §12 OQ5 resolution
- [Phase 49-pi-image-build]: Package SSOT: scripts/lib/signage-packages.txt is canonical (was originally mirrored to 00-packages-nr for the image-build path — that path and its CI drift-check were retired 2026-04-21)
- [v1.18 scope change 2026-04-21]: Custom Pi image pipeline retired — `pi-image/` directory, `.github/workflows/pi-image.yml`, minisign signing, arm64 self-hosted runner, and the `signage-packages.txt`↔`00-packages-nr` drift-check removed. Pi provisioning is now single-path via `scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit. SGN-POL-01/02/03/06 dropped from v1.18.
- [Phase 50-pi-polish]: Lazy chunks (PdfPlayer-*/pdf-*) excluded from player entry cap via LAZY_PREFIXES allowlist
- [Phase 50-pi-polish]: SGN-POL-04 closed via operator hardware walkthrough on 2026-04-21: Scenarios 4+5 both PASS on v1.18 Pi (Bookworm Lite 64-bit, provisioned via scripts/provision-pi.sh). Thresholds (reconnect→admin-mutation ≤30s; sidecar restart visual continuity + /health ≤15s) verified by direct observation; exact numerical timings not captured — documented as 'not recorded' in 50-E2E-RESULTS.md.
- [Phase 51]: Plan 51-01: Extracted _build_envelope_for_playlist helper so schedule-matched and tag-matched envelopes are byte-identical (ETag invariant preserved, D-08/D-09)
- [Phase 51]: Plan 51-01: Weekday bit test uses SQLAlchemy bindparam ((weekday_mask >> :wd) & 1 = 1), never f-string interpolation — SQL parameterization hygiene enforced via CI grep guard
- [Phase 51]: Plan 51-01: app_settings.timezone server_default='Europe/Berlin' backfills singleton row atomically — no op.execute() needed
- [Phase 51]: Plan 51-02: schedule-changed SSE events emitted per (device, playlist_id) pair — PATCH union case sends one event per playlist so player can correlate re-resolves
- [Phase 51]: Plan 51-02: Playlist DELETE 409 body {detail, schedule_ids} via JSONResponse mirrors media 409 {detail, playlist_ids} convention (RESEARCH Q2 closed)
- [Phase 51]: Plan 51-02: asyncpg raises FK RESTRICT at db.execute(delete), not only at db.commit — try/except must wrap both
- [Phase 52]: Plan 52-03: Appended bilingual Schedules/Zeitpläne admin-guide sections verbatim per plan; DE du-tone enforced (0 Sie/Ihre/Ihr); added 33 lines per file (plan's prose block shorter than >=40 acceptance threshold).
- [Phase 52]: Flat-dotted i18n key style (matches Phase 46 parity contract)
- [Phase 52]: Plan 52-02: useAdminSignageEvents hook is best-effort (no backend admin SSE channel exists yet); admin correctness preserved via own-mutation invalidation
- [Phase 52]: Plan 52-02: error.start_after_end reserved for backend-error surfacing only — client validator never emits it (D-07 consolidation)
- [Phase 52]: Plan 52-02: added testing-library + jsdom + vitest.config.ts (jsdom env) to unblock component tests; pre-existing pure-logic tests kept on node env via environmentMatchGlobs
- [Phase 53]: Plan 53-01: signage_heartbeat_event composite PK (device_id, ts); COUNT(DISTINCT date_trunc('minute', ts)) SQL; 1-decimal uptime precision; zero-heartbeat devices INCLUDED with uptime_24h_pct=null (not omitted); 25h retention for 1h sweeper-vs-analytics buffer
- **[v1.19 roadmap 2026-04-21]:** 6 phases (54–59), 23 requirements. Phase sequencing: Toggle (54) → Form Controls (55) → Breadcrumb Header (56) ∥ Section Context (57) → Sensors Parity (58) → A11y Sweep (59). Build primitives first so later phases consume them; A11y sweep runs last over everything touched.

### Cross-cutting hazards (hard gates, see ROADMAP.md)

1. DE/EN i18n parity (CI script) — EN count == DE count on every new/renamed key
2. apiClient-only in admin frontend (no direct `fetch()`)
3. No `dark:` Tailwind variants (tokens only) — dark-mode sweep enforces in Phase 59
4. `--workers 1` invariant preserved
5. Router-level admin gate via `APIRouter(dependencies=[…])`
6. No `import sqlite3` / no `import psycopg2`
7. No sync `subprocess.run` in signage services
8. **v1.19 new:** `prefers-reduced-motion` fallback on Toggle (instant indicator swap)
9. **v1.19 new:** Keyboard navigability + visible focus ring on every migrated control
10. **v1.19 new:** Pure frontend — no backend schema or API changes

### Open decisions deferred to phase planning

- **Decision 1 (Phase 54):** Toggle component API — should it extend `SegmentedControl` internally with a 2-option specialization, or be an independent primitive? Binds migration surface in 54 + 55.
- **Decision 2 (Phase 55):** Canonical primitive source — adopt shadcn/ui wrappers wholesale vs. hand-rolled at `h-8`? Binds CTRL-01..04 scope.
- **Decision 3 (Phase 56):** Breadcrumb label source — derive from route tree config vs. per-page registration hook? Binds HDR-02/03 i18n pattern.
- **Decision 4 (Phase 57):** `DeleteDialog` shape — keep the existing signage `DeleteDialog` component, or promote a new generic one? Binds SECTION-03/04 migration sweep.

### Pending Todos

- Kick off Phase 54 via `/gsd:discuss-phase 54` (Toggle primitive + migrations)
- Resolve Phase 47 open defects D-7 (SW scope) and D-8 (player fetch cache: no-store) as polish or in a future phase
- Orchestrator decision: raise player bundle gz cap to 210 000 or keep lazy-chunk discipline (v1.17 polish)

### Open Blockers

None.

### Carry-forward Tech Debt

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request
- v1.9 D-12 waiver: axe + WebAIM skipped at operator request

---

## Session Continuity

**Last session:** 2026-04-21T22:00:00.000Z
**Stopped at:** v1.19 roadmap drafted — 6 phases, 23/23 requirements mapped
**Resume file:** None
