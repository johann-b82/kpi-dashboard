# KPI Dashboard

## What This Is

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files (38-column sales data) into PostgreSQL for Sales KPIs, and syncs Personio HR data (employees, attendances, absences) for 5 HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use, secured behind a self-hosted Directus 11 identity provider (email/password, Admin + Viewer roles; shipped v1.11-directus).

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current State

**Shipped:** v1.22 Backend Consolidation — Directus-First CRUD — 2026-04-25 (tag `v1.22`). Seven-phase milestone (65–71) moving ~25 pure-CRUD FastAPI endpoints (`me.py`, sales/employee row reads in `data.py`, signage admin tags/schedules/playlists/devices) to Directus collections on the shared Postgres, leaving FastAPI focused on compute. New Postgres LISTEN/NOTIFY → asyncpg → SSE bridge fans out Directus-originated mutations to Pi players within 500 ms across 5 signage tables; new compute-only endpoints `/api/data/employees/overtime` and `/api/signage/resolved/{device_id}`; surviving FastAPI signage surface = `DELETE /playlists/{id}` (structured 409 preserved), bulk `PUT /playlists/{id}/items` (atomic), `PATCH /devices/{id}/calibration` (calibration-changed SSE). Frontend `signageApi.ts` adapter normalizes Directus errors to `ApiErrorWithBody`; 10 contract-snapshot fixtures lock the wire shape; OpenAPI paths snapshot + DB_EXCLUDE_TABLES guard freeze the surface; ADR-0001 documents the Directus = shape / FastAPI = compute split. 33/33 requirements satisfied at code level; audit `tech_debt`: 4 HUMAN-UAT walkthroughs (live-stack SSE/AUTHZ, admin CRUD smokes, v1.22 rollback drill) + 2 partial-scope findings (toApiError adapter scoped to signage only; cache namespace migration partial) carried forward.

**Previously shipped:** v1.21 Signage Calibration + Build Hygiene + Reverse Proxy — 2026-04-24 (tag `v1.21`). Three-phase brownfield milestone shipped same-day as the v1.19 + v1.20 bundle from 2026-04-22. **Phase 62** delivered per-device runtime calibration of signage Pis — rotation / HDMI mode / audio on-off editable from `/signage/devices` admin UI, applied live by the Pi sidecar via `wlr-randr` + WirePlumber (fallback PulseAudio), `/var/lib/signage/calibration.json` persistence + bounded wayland-wait boot replay. CAL-PI-07 real-Pi hardware walkthrough waived pending per-device diagnostic; unit coverage strong (17/17 sidecar + 12/12 backend + 3/3 player tests). **Phase 63** closed the `vite@8` / `vite-plugin-pwa@1.2.0` peer-dep conflict via `--legacy-peer-deps`. **Phase 64** added a Caddy 2 reverse proxy on port 80 fronting `/` → frontend, `/api/*` → FastAPI (SSE-safe), `/directus/*` → Directus (prefix-stripped, no CORS needed), `/player/*` → FastAPI-served player bundle — the same-origin architecture the Pi provisioning assumed all along. Two same-day hotfixes on Phase 64: Directus SDK URL (bare `/directus` failed `new URL()` validation → `window.location.origin + "/directus"`) and `/player/*` route (Vite dev doesn't serve the player entry → route to api:8000). 24/25 requirements satisfied, 1 waiver.
**In progress:** v1.22 Backend Consolidation. **Phase 66** complete (2026-04-24) — FastAPI `/api/me` retired: `AuthContext.tsx` hydrates via `directus.request(readMe(...))`, `backend/app/routers/me.py` + test deleted, Viewer role granted `directus_roles` read, `useCurrentUserProfile()` React Query hook added, CI grep guard blocks `"/api/me"` reappearing in `frontend/src/`. MIG-AUTH-01/02/03 satisfied. **Phase 67** complete (2026-04-25) — `data.py` retired: `fetchSalesRecords` + `fetchEmployees` migrated to Directus SDK `readItems`, new compute-only `GET /api/data/employees/overtime` isolated in `backend/app/routers/hr_overtime.py`, `useEmployeesWithOvertime` composite hook merges Directus rows + overtime via `useMemo` with zero-fill, dedicated `test_hr_overtime_endpoint.py` (8 tests), CI grep guard blocks `/api/data/sales` + `/api/data/employees` literal reappearance in `backend/app/`. MIG-DATA-01/02/03/04 satisfied. **Phase 69** complete (2026-04-25) — `signage_admin/playlists` + `signage_admin/playlist_items` trimmed: GET/POST/PATCH on `/playlists`, GET on `/{id}/items`, PUT on `/{id}/tags` migrated to Directus SDK in `frontend/src/signage/lib/signageApi.ts`; surviving FastAPI surface = `DELETE /playlists/{id}` (structured 409 `{detail, schedule_ids}` preserved) + bulk `PUT /playlists/{id}/items` (atomic DELETE+INSERT). `_notify_playlist_changed` retained on both surviving handlers; SSE `playlist-changed` regression tests added for both Directus and FastAPI writers; CI grep guard scoped to `playlists.py`/`playlist_items.py` blocks migrated routes from reappearing. MIG-SIGN-03 satisfied. **Phase 70** complete (2026-04-25) — `signage_admin/devices` trimmed to surviving `PATCH /{device_id}/calibration` only (calibration-changed SSE preserved); list/by-id/name/delete/tags-PUT migrated to Directus SDK in `signageApi.ts`; new compute-only `GET /api/signage/resolved/{id}` returns `{current_playlist_id, current_playlist_name, tag_ids}` per device; `DevicesPage.tsx` introduces project's first cross-source `useQueries` merge (Directus rows + per-row FastAPI resolved fan-out) preserving v1.21 column shape; SSE regression tests + admin Directus CRUD smoke + RBAC catalog updates; CI grep guard blocks reintroduction of the five migrated device routes. MIG-SIGN-04 satisfied. **Phase 71** complete (2026-04-25) — FE polish + CLEAN closeout: central `toApiError()` helper normalizes Directus SDK errors to `ApiErrorWithBody` across 30 `signageApi.ts` call sites (FE-01/04); localStorage-gated one-shot `kpi.cache_purge_v22` purges legacy `['signage', ...]` TanStack cache keys in `bootstrap.ts` (FE-02/03); 10 deterministic JSON contract fixtures + 344-line vitest suite freeze the FE adapter response shape (FE-05); two backend pytest guards land — OpenAPI paths snapshot (`backend/tests/contracts/openapi_paths.json`, 44 paths) and DB_EXCLUDE_TABLES `isdisjoint` absent-from check (CLEAN-02/04); orphan signage Pydantic schemas swept (8 deleted, `SignageDeviceBase` retained as inheritance guard; CLEAN-01); two new "Phase 71 guard" CI steps (D-08 + `--workers 1` rationale-comment preservation) and v1.22 Rollback Procedure runbook section (CLEAN-03); ADR-0001 documents the Directus/FastAPI split with STAYS list + Settings deferral, linked from `docs/architecture.md` + `README.md` (CLEAN-05). All 10 requirement IDs (FE-01..05, CLEAN-01..05) verified by code/doc artifacts; manual rollback drill tracked as a HUMAN-UAT pending operator walkthrough.
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8 + Directus 11, all Dockerized via compose. Signage on top: bundle-isolated Vite player at `/player/` (75 KB gz entry + lazy `PdfPlayer`/`pdf` chunks, PWA-precached, EventSource + 45s watchdog + 30s polling fallback, 6 format handlers), in-process SSE broadcast, tag-to-playlist resolver, scoped device JWT (HS256 24h), PPTX async-subprocess pipeline with LibreOffice + Carlito/Caladea/Noto/DejaVu fonts, Pi-side Python FastAPI sidecar (127.0.0.1:8080) proxy-caching envelope + media to `/var/lib/signage/`. Pi ships via `scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit (single path) using the shared installer library (`scripts/lib/signage-install.sh`) and systemd unit templates. Proven end-to-end on real Pi 4 (E2E Scenarios 1–5 PASS).
**Codebase:** ~14 100 LOC baseline + v1.15 sensor + v1.16 signage (backend + player + admin UI + docs + runbook) + v1.17 installer-library consolidation. 17 versions shipped (v1.0–v1.17). The v1.17 custom-image pipeline (`pi-image/`, `.github/workflows/pi-image.yml`) was removed in v1.18 — installer library + shared unit templates remain.
**Audit status:** All v1.0–v1.6, v1.11-directus, v1.12–v1.21 requirements satisfied. v1.21 Signage Calibration + Build Hygiene + Reverse Proxy shipped with **3/3 phases passed** and 24/25 requirements satisfied — see [milestones/v1.21-MILESTONE-AUDIT.md](milestones/v1.21-MILESTONE-AUDIT.md). One waiver carried: **CAL-PI-07** real-Pi hardware walkthrough deferred — sidecar has complete unit coverage and the blocker is a per-device environment diagnostic (SSE reachability / wayland env / device-token path) rather than a shipped-code defect; candidate for a post-ship `/gsd:quick`. v1.20 HR Date-Range Filter + TS Cleanup shipped with 2/2 phases passed ([audit](milestones/v1.20-MILESTONE-AUDIT.md)). v1.19 UI Consistency Pass 2 shipped with 23/23 requirements verified across 6 phases ([audit](milestones/v1.19-MILESTONE-AUDIT.md)). v1.9 D-12 waiver still carried. SGN-POL-04 closed via operator walkthrough with thresholds verified but exact numerical timings not recorded.

## Current Milestone

None active. Run `/gsd:new-milestone` to scope the next cycle. Carry-forward items from v1.22:

- **HUMAN-UAT (4):** Phase 65 live-stack verification (SSE 500 ms latency, calibration no-double-fire, listener reconnect, AUTHZ live, fresh-volume idempotency); Phase 68 admin Directus CRUD smoke for tags + schedules; Phase 69 admin Directus CRUD smoke for playlists + tag-map; Phase 71 v1.22 rollback drill (CLEAN-03) per `docs/operator-runbook.md`.
- **INT-01 (medium):** Extend `toApiError()` to `AuthContext.tsx`, `useCurrentUserProfile.ts`, `fetchSalesRecords`, `fetchEmployees` so the single-error-contract guarantee covers Phase 66 + 67 Directus call sites, not just signage.
- **INT-02 (low):** Migrate the remaining ~23 signage admin call sites (tags, schedules, playlists, media, pair) from `['signage', ...]` to `['directus', <collection>, ...]` query keys so the bootstrap purge isn't immediately undone.
- **CAL-PI-07** Pi hardware-timing diagnostic (carry-forward from v1.21) — remains a `/gsd:quick` candidate.

## Next Milestone Candidates (post-v1.22)

- **Settings → Directus** — defer until oklch/hex validators + SVG sanitization can be ported as Directus hooks without losing guarantees.
- **Fleet Ops** — Ansible reimage, fleet-wide config push, remote restart, OTA update channel. Justified at 5+ devices.
- **iCal RRULE / date-specific overrides** — reopen if the weekday_mask + HH:MM window model proves too narrow.
- **Rich Analytics** — per-item playtime (`signage_item_plays`), heatmaps, export-to-CSV.

## Shipped: v1.20 HR Date-Range Filter + TS Cleanup (2026-04-22)

Two-phase brownfield milestone closing the last HR dashboard filter gap + the v1.19 TS-debt carry-forward.

**Phase 60 — HR Date-Range Filter.** Shared `DateRangeFilter` mounted on `/hr`; every HR surface (KPI cards, charts, employee table) consumes `useDateRange()` and refetches on range change. Backend: `/api/hr/kpis`, `/api/hr/kpis/history`, `/api/data/employees` accept `date_from`/`date_to` with pair-or-neither + inverted-range HTTP 400. HR aggregation service (`hr_kpi_aggregation.py`) computes all 5 KPIs over arbitrary windows with `prior_window_same_length` and `same_window_prior_year` baselines driving card deltas; fluctuation denominator switched from EOM-snapshot to avg-active-headcount across the range (D-03). `HrKpiCharts` uses server-bucketed data (`_bucket_windows` — daily ≤31d / weekly ≤91d / monthly ≤731d / quarterly) with client-side label formatter matching Sales naming (`KW 17`, `Apr '26`, `Q1 '26`, `15. Apr`). Sales ↔ HR preset preservation retained via shared `DateRangeContext`. 13/13 pytest coverage (`test_hr_kpi_range.py`) with explicit D-03 arithmetic (`45/104`-style fluctuation assertion) and D-05 sick-leave whole-range mirror. User-approved visual-parity checkpoint on the default `thisYear` landing + 45-day custom range + Sales ↔ HR state preservation (2026-04-22).

**Phase 60 follow-up** (`4d1c5f0`): Personio attendance fetch window now derived from DB state — earliest employee `hire_date` on first run (full backfill), `max(stored_date) - 14d` incremental thereafter. New `_get_with_backoff` helper in `personio_client` provides exponential 429 retry (3 attempts, delay = max(Retry-After, 2^attempt · 30s)). `personio_sync_interval_h` default raised 1h → 168h (weekly) via Alembic migration `v1_19_personio_weekly_default` — existing customized values preserved. HR delta-badge labels now use shared `formatPrevPeriodDeltaLabels(preset, range)` (thisYear collapses to single "vs. prior year" badge); HR chart axis naming mirrors Sales; `/sales`-only upload icon (removed from `/hr`); Bar/Line toggles flipped to Balken-left/Linien-right with `variant="muted"` matching the DE/EN toggle.

**Phase 61 — TS Cleanup.** Closed all 31 pre-existing TypeScript errors across 9 files carried forward from v1.17–v1.19. 10 atomic `fix(61):` commits (one per file): `SchedulesPage.test.tsx` hygiene, `ScheduleEditDialog.test.tsx` ES-import (no `@types/node` needed), `ScheduleEditDialog.tsx` + `PersonioCard.tsx` + `SnmpWalkCard.tsx` implicit-any annotations, `defaults.ts` sensor fields, `useSensorDraft.ts` parameter-property rewrite + duplicate spread-key collapse, `ui/select.tsx` `Root.Props<Value>` generic + unused React import, `HrKpiCharts.tsx` Recharts 3.8.1 Tooltip signature wraps, `SalesTable.tsx` local `SalesRow & Record<string, unknown>` intersection. `npm run build` now exits 0 with zero `error TS`. Anti-cheat gates verified: zero `@ts-expect-error`/`@ts-ignore`/`as any`/`as unknown as` authored by Phase 61 (`git blame` check); zero `|| true` on canonical build surfaces. `useTableState.ts` untouched (D-02 preserved — fix was local).

**Infrastructure hygiene noted** (not blocking): `frontend/Dockerfile` `npm install` peer-dep conflict (`vite@8` vs `vite-plugin-pwa@1.2.0`) prevents `docker compose build frontend`. Bind-mount + HMR + host `npm run build` cover dev + CI paths; scheduled for a future cleanup milestone.

## Shipped: v1.21 Signage Calibration + Build Hygiene + Reverse Proxy (2026-04-24)

Three-phase brownfield milestone capping the signage ops debt and LAN-access dead-ends that had accumulated since v1.16.

**Phase 62 — Signage Calibration.** `signage_devices` gained `rotation` (0/90/180/270 CHECK) / `hdmi_mode` (VARCHAR) / `audio_enabled` (BOOL) via Alembic `v1_21_signage_calibration`, admin-only `PATCH /api/signage/devices/{id}/calibration` with Pydantic `Literal[0,90,180,270]` validation (422 on invalid), device-auth `GET /api/signage/player/calibration`, SSE `calibration-changed` fanout on the existing Phase 45 per-device EventSource queue. Admin UI on `DeviceEditDialog` with rotation + HDMI-mode dropdowns + audio toggle, partial PATCH on dirty fields, 8 new DE/EN i18n keys. Pi sidecar (`sidecar.py`, `pi-sidecar/requirements.txt`) adopted `httpx-sse==0.4.1` for its new `_calibration_sse_loop` subscriber (reuses the device JWT the player already holds), `_apply_calibration` runs `wlr-randr --output <name> --transform <N>` + `--mode <WxH@Hz>` + `wpctl set-mute` (PulseAudio `pactl` fallback pinned at startup), all via `asyncio.create_subprocess_exec` (zero sync-subprocess). `/var/lib/signage/calibration.json` at mode `0600` persists last-applied state; boot replay is gated behind a 15 s `_wait_for_wayland_socket` bounded poll (belt-and-braces for systemd `After=labwc.service` + `Requires=labwc.service`). `scripts/systemd/signage-sidecar.service` gained `XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__` + `WAYLAND_DISPLAY=wayland-0` env. Three apt packages added to the SSOT installer list: `wlr-randr`, `wireplumber`, `pulseaudio-utils`. Player toggles `<video>` `muted` on `calibration-changed`. Test coverage: 17/17 sidecar unit tests asserting argv shape + replay ordering + wayland-wait 3 cases, 12/12 backend pytest, 3/3 player vitest. **CAL-PI-07 hardware-timing walkthrough waived** pending per-Pi diagnostic.

**Phase 63 — Frontend Build Fix.** `docker compose build --no-cache frontend` now exits 0. Root cause: `vite-plugin-pwa@1.2.0` is the latest release and caps `vite` at `^7.0.0` — no upstream fix exists for `vite@8`. Solution: `--legacy-peer-deps` on the Dockerfile `RUN npm install` + `frontend/.npmrc` (`legacy-peer-deps=true` + tracking comment) so host installs match container behaviour. Host `npm run dev` + `npm run build` unaffected.

**Phase 64 — Reverse Proxy.** New `caddy` compose service on `caddy:2-alpine`, binding `0.0.0.0:80:80`. Caddyfile routes: `/` → `frontend:5173`, `/api/*` → `api:8000` (with `flush_interval -1` + `read_timeout 24h` so SSE `text/event-stream` survives the proxy indefinitely), `/directus/*` → `directus:8055` via `handle_path` (prefix-strip so Directus sees bare `/auth`, `/items`, `/assets`), `/player/*` → `api:8000` (FastAPI mounts the built `frontend/dist/player/` bundle; Vite single-instance dev doesn't serve the player entry). Directus CORS env (`CORS_ENABLED` / `CORS_ORIGIN` / `CORS_CREDENTIALS`) removed — SPA calls are same-origin now. Frontend `directusClient.ts` default moved from `http://localhost:8055` to `window.location.origin + "/directus"` (bare `/directus` fails `new URL()` in the SDK). Two post-ship hotfixes: `fix(64): 092fc92` — Directus SDK URL; `fix(64): 07fe54d` — `/player/*` route to api not frontend:5173 (Pi was booting into admin login instead of the pairing screen). `docker compose ps` now shows caddy healthy on `:80`, and `http://<lan-ip>/login` finally works from any LAN host.

**Quick task — Authentik removal.** CLAUDE.md project description + constraint block + PROJECT.md overview now reflect Directus 11 as the committed identity layer (shipped v1.11-directus 2026-04-15); the "future Authentik pivot" phrasing is gone.

**Scope change:** v1.21 grew mid-milestone from 2 phases → 3 phases when Phase 62's hardware walkthrough exposed that the dev compose stack had no reverse proxy and the Pi's `:80` URLs from `scripts/provision-pi.sh` pointed at nothing. Phase 64 was added and shipped same-day.

## Shipped: v1.19 UI Consistency Pass 2 (2026-04-22)

Six-phase frontend consistency milestone — zero backend schema changes, all surface-level. New pill `Toggle` primitive (`components/ui/toggle.tsx`) with radiogroup a11y, arrow-key wrap, animated sliding indicator, and `prefers-reduced-motion` fallback; drove migrations of the NavBar Sales/HR switch, chart-type toggles on `RevenueChart` + `HrKpiCharts`, `ThemeToggle` (sun/moon, preserving `localStorage` + `matchMedia`), and `LanguageToggle` (DE/EN, preserving i18next persistence) — all 2-segment `SegmentedControl` usages retired. Consolidated form primitives under `components/ui/` (`Input`, `Select`, `Textarea`, `Dropdown`, `Button` cleanup) on the `h-8` height token with a single Path A focus-ring utility (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`) + shared disabled + aria-invalid chain; 14 consumer migrations + 3 documented CTRL-02 exceptions (LauncherPage tiles, file-picker inputs). Top chrome refactor: `NavBar.tsx` stripped to 37 LOC (brand + `Breadcrumb` + `ThemeToggle` + `LanguageToggle` + `UserMenu`); route-derived breadcrumb trail with wouter `<Link>`s (14 routes, deeper-first matcher); Docs/Settings/Sign-out absorbed into the `UserMenu` dropdown; Sales/HR Toggle + Upload icon relocated to `SubHeader` gated on dashboard routes; `lastDashboard` sessionStorage hack removed. `SectionHeader` primitive on every admin section (Media/Playlists/Schedules/Devices/SensorsSettings); shared `DeleteButton` + `DeleteDialog` replace 5 ad-hoc feature-variant dialogs and zero `window.confirm` remain in `frontend/src`; 19 new i18n keys in DE/EN at 498-key parity. `/sensors` body slimmed to 19 LOC (cards + chart) with `SensorTimeWindowPicker` + `PollNowButton` hoisted to the SubHeader via the already-global `SensorTimeWindowProvider`. A11y sweep across 13 audited surfaces: `check-locale-parity`, `check-i18n-du-tone`, and `check-phase-59-guards` (color-literal + missing aria-label) wired as persistent npm scripts; `toggle.test.tsx` + static guards lock the focus-ring invariant; dark-mode clean across all migrated surfaces. **23/23 requirements verified (TOGGLE-01..05, CTRL-01..04, HDR-01..04, SECTION-01..04, SENSORS-01..03, A11Y-01..03); full audit at [milestones/v1.19-MILESTONE-AUDIT.md](milestones/v1.19-MILESTONE-AUDIT.md).**

## Shipped: v1.18 Pi Polish + Scheduling (2026-04-21)

Closed v1.17 operator carry-forwards (Scenarios 4 + 5 hardware E2E PASS on `provision-pi.sh`-provisioned Pi with `50-E2E-RESULTS.md` evidence; player bundle back under 200 KB gz via lazy-imported `PdfPlayer` + `react-pdf` behind a LAZY_PREFIXES allowlist) and added time-based playlist scheduling. Alembic migration adds `signage_schedules` (7-bit weekday_mask + `start_hhmm < end_hhmm` + priority + enabled) and `app_settings.timezone` (default `Europe/Berlin`). Resolver gains time-window awareness — picks highest `(priority DESC, updated_at DESC)` matching (weekday, time-of-day, tag overlap), falls back to always-on tag resolution; `_build_envelope_for_playlist` helper keeps scheduled and tag-based envelopes byte-identical (ETag invariant preserved). 4th `/signage/schedules` admin tab under `<AdminOnly>` with `SchedulesPage`, `ScheduleEditDialog` (D-07/11/12 validation tree, 5 i18n error keys), `ScheduleDeleteDialog`, cross-tab 409 deep-link from `PlaylistsPage`. SSE `schedule-changed` fanout via new `useAdminSignageEvents` hook. Analytics-lite: append-only `signage_heartbeat_event` log (composite PK, 25 h retention pruned by the existing heartbeat sweeper), read-only `/api/signage/analytics/devices` endpoint, UptimeBadge (green ≥ 95 / yellow 80–95 / red < 80), two new Devices-table columns. Bilingual admin guide gained §Schedules/§Zeitpläne + §Analytics/§Analyse; EN 55 == DE 55 signage keys, DE du-tone enforced. Scope change 2026-04-21: custom `.img.xz` pipeline retired (SGN-POL-01/02/03/06 dropped; `pi-image/` and `.github/workflows/pi-image.yml` removed); Pi provisioning single-path via `scripts/provision-pi.sh`. 11 / 11 active requirements landed across 4 phases, 9 plans, 83 commits, 120 files, +16,729/−925 in a single-day brownfield speedrun.

## Shipped: v1.17 Pi Image Release (2026-04-21)

> **Scope change 2026-04-21:** The custom image-build pipeline (`pi-gen` submodule at `pi-image/`, `.github/workflows/pi-image.yml`, minisign signing, RELEASE_TEMPLATE) was retired in v1.18. The operator carry-forwards around signing and the signed-image release are cancelled; Pi provisioning is now single-path via `scripts/provision-pi.sh`.

Pre-baked Raspberry Pi OS Bookworm Lite 64-bit image pipeline + thin-GUI kiosk stack. `pi-gen` fork at `pi-image/` (as git submodule on arm64 branch) baked: the Phase 48 signage stack, signage user, three systemd user units (labwc + sidecar + player), Python FastAPI sidecar venv, first-boot oneshot that reads `/boot/firmware/signage.conf` and configures the device. Installer library `scripts/lib/signage-install.sh` (7 shared functions + SSOT packages list + CI drift-check) shared between runtime path (`provision-pi.sh`) and image-build path. GitHub Actions workflow at `.github/workflows/pi-image.yml` + minisign signing scaffold + RELEASE_TEMPLATE. Runtime path proven on real Pi 4 hardware 2026-04-21 (E2E Scenarios 1–3 PASS: flash → boot → pair → play → 5-min offline loop); three systemd-unit defects fixed in-flight and propagated to both runtime and image-build paths via shared templates. Operator carry-forwards that remain in v1.18: Scenarios 4 + 5 hardware E2E on a `provision-pi.sh`-provisioned Pi, and player-bundle shrink back under 200 KB gz. 11 / 11 requirements coded, 7 fully verified + 4 carry-forwards — of which the 2 image-distribution carry-forwards were cancelled alongside the image pipeline.

## Shipped: v1.16 Digital Signage (2026-04-20)

Directus-backed digital signage CMS on the existing monorepo. Admin `/signage` page (Media/Playlists/Devices tabs, DE "du" tone, drag-reorder editor, WYSIWYG preview). Bundle-isolated Chromium-kiosk player at `/player/*` (210KB gz, PWA-precached shell, 6-digit pairing code, EventSource + 45s watchdog + 30s polling fallback). Backend: 8-table Alembic migration, scoped device JWT (HS256 24h), SSE fan-out via in-process `asyncio.Queue`, tag-to-playlist resolver, APScheduler singleton for pairing-cleanup cron + PPTX stuck-reset + heartbeat sweeper, `asyncio.subprocess_exec` PPTX pipeline on `libreoffice-impress` + Carlito/Caladea/Noto/DejaVu fonts. Pi side: one-script `scripts/provision-pi.sh` Bookworm Lite bootstrap, dedicated non-root `signage` user, labwc + Chromium wayland kiosk systemd user services, Python FastAPI sidecar on 127.0.0.1:8080 proxy-caching playlist envelope and media to `/var/lib/signage/` for 5-minute Wi-Fi drops + 30s auto-reconnect. Bilingual admin guide + operator runbook. 47/47 requirements landed (real-hardware E2E walkthrough deferred as carry-forward, scaffold ready).

## Shipped: v1.15 Sensor Monitor (2026-04-18)

Live SNMP temperature/humidity monitoring integrated into the KPI Dashboard. PostgreSQL schema (`sensors`, `sensor_readings`, `sensor_poll_log`) via Alembic, pysnmp polling service on the existing APScheduler singleton (`--workers 1` invariant, `max_instances=1`, daily 90-day retention cleanup). Admin-gated `/api/sensors/*` routes with Fernet-encrypted community strings (write-only secret). Admin-only `/sensors` dashboard with KPI cards (threshold-aware badges, DIFF-01 delta badges vs. 1h/24h, DIFF-10 health chip from poll-log), stacked Recharts time-series with reference lines, SegmentedControl time-window (1h/6h/24h/7d/30d), Poll-now button with TanStack Query invalidation. Admin settings sub-page `/settings/sensors` with CRUD form, SNMP-Walk OID-finder with click-to-assign, per-row Probe button, polling-interval live-reschedule, global thresholds, unsaved-changes guard. Bilingual (EN/DE) admin guide article with host-mode fallback runbook. 58/58 requirements satisfied.

## Shipped: v1.14 App Launcher (2026-04-17)

iOS-style `/home` App Launcher as the post-login entry point. 4-tile CSS auto-fill grid (1 active KPI Dashboard tile navigating to `/`, 3 greyed coming-soon tiles with `opacity-40 pointer-events-none`). AuthGate post-login redirect changed from `/` to `/home`. Heading driven by `settings.app_name` via `useSettings()`. Bilingual `launcher.*` i18n keys (EN/DE) added. Role-aware admin scaffold wired (`user?.role === "admin"`) for future admin-only tiles. Tailwind token-only classes — dark mode works automatically. All 10 requirements (LAUNCH-01..05, AUTH-01, AUTH-02, BRAND-01..03) verified via 10-step browser walkthrough.

## Shipped: v1.13 In-App Documentation (2026-04-17)

Role-aware in-app documentation site: Markdown rendering pipeline (react-markdown + rehype-highlight + rehype-slug + remark-gfm), dark-mode prose styling, syntax highlighting, heading anchors, TOC sidebar with Intersection Observer scroll tracking, lazy-loaded /docs route. NavBar Library icon entry point, DocsSidebar with AdminOnly role gating, three-column DocsPage layout with /docs/:section/:slug routing, role-aware default redirect. 22 Markdown articles (9 user guide + 4 admin guide, each in EN and DE) covering uploading data, Sales/HR dashboards, filters, language/theme, system setup, architecture, Personio integration, and user management. 19/19 requirements satisfied.

## Shipped: v1.12 Chart Polish & Rebrand (2026-04-16)

Year-aware chart x-axis labels (`Nov '25`) with year boundary separators and gap-filled month spines across Sales and HR dashboards. Shared `chartTimeUtils.ts` utility module with 12 unit tests. Rebranded from "KPI Light" to "KPI Dashboard" across all 8 UI surfaces, added unauthenticated `GET /api/settings/logo/public` endpoint, and restyled login page with logo display and card aesthetic matching the rest of the app.

## Shipped: v1.11-directus Directus Pivot (2026-04-15)

Added multi-user auth + RBAC on top of the existing Postgres by dropping in a single `directus/directus:11` container instead of the abandoned Dex/oauth2-proxy / Supabase paths. Directus reuses the app's `db` and hides `public.*` tables from its Data Model UI so Alembic remains the schema source of truth. Two roles (`Admin`, `Viewer`) bootstrapped reproducibly from `snapshot.yml`. FastAPI verifies Directus JWTs via `current_user` dep; every mutation route gates on `role == 'Admin'` (`{"detail": "admin role required"}` for Viewer). Frontend `/login` via `@directus/sdk` with cookie-mode refresh; all 17 fetch call sites migrated to a shared `apiClient` that attaches the bearer and handles 401-refresh-retry; 9 admin-only UI surfaces hidden from Viewers. Operator docs (`docs/setup.md`) cover end-to-end bring-up, promote-Viewer-to-Admin click-path, and the nightly `pg_dump` sidecar with 14-day retention + `scripts/restore.sh` (round-trip exercised). Baseline was reset to v1.10 from the archived v1.12/Dex attempt (`archive/v1.12-phase32-abandoned`).

## Shipped: v1.10 UI Consistency Pass (2026-04-14)

Unified delta-badge labeling and page layout conventions across Sales, HR, Upload, and Settings. Phase 24 retired `periodLabels.ts` delta formatters in favor of `kpi.delta.{vsMonth,vsQuarter,vsYear}` i18n namespace with concrete period names; thisYear collapsed to single YTD-vs-YTD row. Phase 25 adopted the dashboard container across all pages; `/upload` restructured into responsive DropZone + UploadHistory grid; `/settings` gained merged Appearance card, HR wrapper with Personio + Sollwerte subsections, 6-column logo row, contextual back button with sessionStorage-tracked last dashboard.

## Shipped: v1.9 Dark Mode & Contrast (2026-04-14)

Full dark mode across every surface — Tailwind v4 class-strategy theme with `:root`/`.dark` CSS-variable tokens, Recharts chart defaults driven by the same tokens, brand accent + amber warning color invariant across modes (semantic consistency). Sun/moon icon toggle in navbar (simplified from segmented control during UAT), OS `prefers-color-scheme` default with localStorage override, pre-hydration IIFE that sets theme class *and* splash CSS variables before first paint (no white flash on reload). WCAG AA via deterministic token fixes: `--color-success` darkened to `#15803d` (5.02:1 white PASS), EmployeeTable active badge moved to `text-foreground` to escape same-color-on-tinted-self contrast ceiling, grep-verified zero hardcoded color literals outside documented exceptions.

<details>
<summary>v1.6 Multi-Select HR Criteria (2026-04-12)</summary>

All 3 Personio config fields converted from single-select dropdowns to multi-select checkbox lists. Database columns migrated to JSONB arrays via Alembic. HR KPI aggregation uses IN/OR filters. Reusable CheckboxList component with scrollable container, loading/empty/disabled states. Language preference moved from database to localStorage.

</details>

<details>
<summary>v1.5 Segmented Controls (2026-04-12)</summary>

Unified all toggle/tab controls into pill-shaped SegmentedControl — Sales/HR nav tabs, DE/EN language toggle, date range presets, chart type selector. Primary color active segment with white container and primary outline. Reusable generic component with ARIA radiogroup semantics.

</details>

<details>
<summary>v1.4 Navbar & Layout Polish (2026-04-12)</summary>

Refined navbar — 32px logo, underline-style active tabs, upload icon in action area. New SubHeader with route-aware freshness (HR sync on /hr, upload timestamp on Sales). DateRangeContext shared state. Sync button relocated from HR page to Settings. Layout spacing balanced.

</details>

<details>
<summary>v1.3 HR KPI Dashboard & Personio-Integration (2026-04-12)</summary>

Multi-domain KPI platform — Sales tab (renamed from Dashboard) + new HR tab with 5 KPI cards (overtime ratio, sick leave ratio, fluctuation, skill development, revenue/employee), dual delta badges, Personio API integration with Fernet-encrypted credentials, configurable auto-sync (APScheduler), Settings UI with live-populated dropdowns for absence types and departments, full DE/EN i18n parity (164 keys).

</details>

<details>
<summary>v1.2 Period-over-Period Deltas (2026-04-12)</summary>

At-a-glance growth signals on the dashboard — dual delta badges on every KPI card (vs. Vorperiode + vs. Vorjahr), ghosted amber chart overlay for prior-period comparison, contextual period labels via Intl.DateTimeFormat, full DE/EN i18n parity (119 keys), em-dash fallback for no-baseline cases.

</details>

## Deferred to Later Milestones

- SSO / SAML / OIDC external providers (Google, M365) — revisit post-v1.11 if HR asks
- Email verification / password reset flows — enable when SMTP provisioned
- Row-Level Security policies — API-layer authz covers v1.11; add RLS when any feature bypasses FastAPI
- Export filtered data as CSV (DASH-07)
- Duplicate upload detection (UPLD-07)
- Per-upload drill-down view (DASH-08)

## Requirements

### Validated in v1.0

- ✓ Application runs fully Dockerized (app + Postgres via docker compose) — Phase 1
- ✓ User can upload CSV and TXT (tab-delimited) ERP export files — Phase 2
- ✓ Uploaded data parsed and stored in PostgreSQL with fixed 38-column schema — Phase 2
- ✓ Bilingual DE/EN UI with inline error reporting for bad rows — Phase 2
- ✓ Upload history visible (filename, timestamp, row count, status) — Phase 2
- ✓ Dashboard summary cards (total revenue, avg order value, total orders) — Phase 3
- ✓ Dashboard time-series revenue chart (monthly granularity, bar/line toggle) — Phase 3
- ✓ Date range filter updates cards and chart — Phase 3
- ✓ Freshness indicator shows timestamp of latest upload — Phase 3
- ✓ Auto-refresh after upload via TanStack Query invalidation — Phase 3

### Validated in v1.1

- ✓ Settings page with semantic color tokens, logo upload, app name — v1.1
- ✓ ThemeProvider live-preview + branding persistence across rebuilds — v1.1
- ✓ NavBar LanguageToggle persists language choice — v1.1
- ✓ Full DE/EN locale parity in informal "du" tone — v1.1

### Validated in v1.2

- ✓ Summary + chart endpoints return previous_period + previous_year baselines (DELTA-01..05, CHART-01..03) — v1.2
- ✓ Dual delta badges on all 3 KPI cards with locale-correct formatting (CARD-01..05) — v1.2
- ✓ Chart prior-period overlay with contextual legend (CHART-04..06) — v1.2
- ✓ Full DE/EN parity for all v1.2 strings + Intl.DateTimeFormat period labels (I18N-DELTA-01..02) — v1.2

### Validated in v1.3

- ✓ NAV-01/02/03: Sales tab rename, HR tab with sync freshness indicator — v1.3
- ✓ PERS-01..06: Personio credentials (write-only), manual/auto sync, raw data storage, absence types + departments auto-discovery — v1.3
- ✓ HRKPI-01..06: 5 HR KPI cards with dual delta badges, error state handling — v1.3
- ✓ SET-01..04: Sick leave type, production department, skill attribute key, sync interval config — v1.3
- ✓ I18N-01: Full DE/EN parity for all v1.3 strings (164 keys total) — v1.3

### Validated in v1.4

- ✓ NAV-01: Logo reduced to 32px in navbar — v1.4
- ✓ NAV-02: Active tab blue underline, inactive plain text — v1.4
- ✓ NAV-03: Upload tab removed from nav — v1.4
- ✓ NAV-04: Upload icon in action area between DE/EN toggle and gear — v1.4
- ✓ LAY-01: Sub-header positioned below navbar (user-approved: no border separator) — v1.4
- ✓ LAY-02: Sub-header with date presets (left) + route-aware freshness (right) — v1.4
- ✓ I18N-01: Full DE/EN parity maintained — v1.4

### Validated in v1.5

- ✓ SEG-01: Reusable SegmentedControl component with pill-shaped container, ARIA radiogroup semantics, disabled state — v1.5
- ✓ SEG-02: Sales/HR tab navigation rendered as segmented control — v1.5
- ✓ SEG-03: Date range presets rendered as segmented control — v1.5
- ✓ SEG-04: Chart type toggle rendered as segmented control — v1.5
- ✓ SEG-05: DE/EN language toggle rendered as segmented control with disabled-when-dirty guard — v1.5
- ✓ SEG-06: Full DE/EN i18n parity maintained — v1.5

### Validated in v1.9

- ✓ DM-01..04: Dark theme with adapted surface tokens, shadcn components, Recharts colors, brand-accent invariance — Phase 21
- ✓ DM-05: Dark mode toggle visible in navbar — Phase 22 (shipped as single sun/moon icon button, deviation from segmented control approved during UAT)
- ✓ DM-06: OS prefers-color-scheme drives initial theme + live-tracks until first user click — Phase 22
- ✓ DM-07: localStorage.theme persists user choice across reloads and overrides OS preference — Phase 22
- ✓ DM-08: DE/EN i18n keys for theme toggle (aria-label Theme/Farbschema) — Phase 22
- ✓ DM-09: WCAG AA contrast via deterministic token fixes (`--color-success` darkened, grep-clean codebase) — Phase 23 (D-12 waiver on automated/manual verification)
- ✓ DM-10: Delta/status badges legible in both modes via EmployeeTable `text-foreground` override + token shade adjustment — Phase 23 (D-12 waiver on WebAIM spot-check)

### Validated in v1.12

- ✓ CHART-01: All chart x-axes display year alongside month (e.g., `Nov '25`) — v1.12 Phase 31
- ✓ CHART-02: Year grouping/separator on multi-year chart data — v1.12 Phase 31
- ✓ CHART-03: Gap-filled month spines on x-axis — v1.12 Phase 31
- ✓ BRAND-01: App name reads "KPI Dashboard" everywhere — v1.12 Phase 32
- ✓ BRAND-02: Login page shows uploaded logo — v1.12 Phase 32
- ✓ BRAND-03: Login page card styling matches app aesthetic — v1.12 Phase 32

### Validated in v1.13

- ✓ NAV-01..04: Docs navbar icon, role-filtered sidebar, role-aware default article, lazy-loaded route — v1.13
- ✓ RENDER-01..04: Markdown prose with dark mode, syntax highlighting, heading anchors, generated TOC — v1.13
- ✓ UGUIDE-01..05: 5 user guide articles (uploading, Sales dashboard, HR dashboard, filters, language/theme) — v1.13
- ✓ AGUIDE-01..04: 4 admin guide articles (system setup, architecture, Personio, user management) — v1.13
- ✓ I18N-01..02: Full bilingual DE/EN content and UI chrome — v1.13

### Validated in v1.14

- ✓ LAUNCH-01..05: `/home` route, 4-tile iOS-style grid, KPI Dashboard active tile (→`/`), coming-soon tiles greyed + inert, admin-only tile scaffold — v1.14 Phase 37
- ✓ AUTH-01: Post-login AuthGate redirect → `/home` — v1.14 Phase 37
- ✓ AUTH-02: Unauthenticated access to `/home` redirects to `/login` via existing guard — v1.14 Phase 37
- ✓ BRAND-01..03: Tailwind token-only classes (no `dark:` variants), bilingual `launcher.*` i18n keys (EN/DE), `settings.app_name` heading — v1.14 Phase 37

### Validated in v1.6

- ✓ MIG-01: Database migration converts 3 Personio config columns to JSON array columns — v1.6
- ✓ API-01: Settings GET/PUT endpoints accept and return arrays — v1.6
- ✓ API-02: Personio options endpoint returns absence types, departments, and skill attributes — v1.6
- ✓ KPI-01..04: HR KPI aggregation uses IN/OR filters for multi-value support — v1.6
- ✓ UI-01: PersonioCard renders checkbox lists instead of select dropdowns — v1.6
- ✓ UI-02: Checkbox state persists correctly through save/reload cycle — v1.6
- ✓ UI-03: All checkbox list labels display correctly in both DE and EN — v1.6

### Validated in v1.20

- ✓ D-01..D-05, D-11, D-13 (Phase 60): Backend `date_from`/`date_to` on all HR endpoints; avg-active-headcount fluctuation denominator; same-length prior-period + same-window prior-year baselines — v1.20
- ✓ D-06..D-10, D-12 (Phase 60): Client-side adaptive bucketing, Sales↔HR preset preservation, thisYear-landing visual parity — v1.20 (user-approved)
- ✓ Phase 61 locked decisions D-01..D-08: `npm run build` exits 0 with zero TS errors, atomic per-file commits, no suppression-directive shortcuts authored — v1.20

### Validated in v1.19

- ✓ TOGGLE-01..05: Pill `Toggle` primitive (animated indicator, radiogroup a11y, arrow-key nav, reduced-motion fallback, 2-segment constraint) — v1.19
- ✓ CTRL-01..04: Single canonical `Input`/`Select`/`Button`/`Textarea`/`Dropdown` under `components/ui/` on the `h-8` height token with shared focus/disabled/invalid states — v1.19
- ✓ HDR-01..04: Identity-only top header with route-derived breadcrumb and `UserMenu` dropdown (Docs/Settings/Sign-out); page controls relocated to SubHeader — v1.19
- ✓ SECTION-01..04: `SectionHeader` + shared `DeleteButton` + `DeleteDialog` across every admin surface; zero `window.confirm` remain — v1.19
- ✓ SENSORS-01..03: `/sensors` picker + Jetzt-messen hoisted to SubHeader; page body slimmed to cards + chart — v1.19
- ✓ A11Y-01..03: DE/EN key parity + du-tone CI guards; Path A focus-ring utility across shipped primitives; dark-mode sweep across 13 surfaces — v1.19

### Validated in v1.21

- ✓ CAL-BE-01..05: Signage calibration backend — migration, admin PATCH, device-auth GET, SSE `calibration-changed` fanout — v1.21
- ✓ CAL-UI-01..04: Admin UI calibration section on `DeviceEditDialog` with DE/EN parity — v1.21
- ✓ CAL-PI-01..06: Pi sidecar SSE listener + `wlr-randr` apply + `wpctl`/`pactl` audio + persistence/replay + player `<video muted>` toggle — v1.21 (unit coverage)
- ⚠ CAL-PI-07: real-Pi hardware walkthrough — **waived** pending per-Pi environment diagnostic (see [milestones/v1.21-MILESTONE-AUDIT.md](milestones/v1.21-MILESTONE-AUDIT.md))
- ✓ BUILD-01..03: `docker compose build frontend` green via `--legacy-peer-deps` — v1.21
- ✓ PROXY-01..05: Caddy 2 reverse proxy on `:80` fronting admin/api/directus/player; SSE survives; same-origin Directus cookies — v1.21

### Out of Scope

- Outline wiki — dropped in the v1.11-directus pivot
- Dex + oauth2-proxy silent-SSO layer — abandoned after Phase 32; preserved on `archive/v1.12-phase32-abandoned`
- Active Directory integration — not planned in v1.11
- Multi-tenant / multi-app user management — not planned in v1.11
- Scheduled ingestion from shared folder — deferred to v2
- Automated data pipelines or ETL beyond file upload — future scope
- Mobile-specific UI — web-first (v1.0 desktop 1080p+ confirmed sufficient)
- Dynamic schema detection — fixed 38-column schema is deliberate
- Excel (.xlsx/.xls) ingestion — v1.0 ships CSV/TXT only; Excel deferred (openpyxl stays in requirements for future re-enable)

## Context

- **Deployment:** Docker Compose stack (db, migrate, api, frontend containers with healthchecks)
- **Data format:** Fixed 38-column ERP tab-delimited export; German locale (decimal comma, DD.MM.YYYY dates) handled during parse
- **Users:** Internal team, small group, no external access in v1
- **Identity (v1.11-directus):** Self-hosted Directus (single container) on existing Postgres — email/password, two roles (Admin | Viewer) managed in Directus admin UI, FastAPI validates Directus JWT via shared HS256 secret
- **Tech debt carried forward:**
  - 5 Phase 2 human-UAT visual items (drag-drop spinner, toast render, inline error list) — tracked in `02-HUMAN-UAT.md`
  - DASH-02 shipped monthly-only (granularity toggle removed by user request post-verification)

## Constraints

- **Containerization**: Must run via Docker Compose — no bare-metal dependencies
- **Database**: Existing PostgreSQL container; Alembic owns app tables in `public`, Directus owns `directus_*` tables in the same DB
- **Identity**: Self-hosted Directus (single container) — email/password, two roles (Admin | Viewer), JWT HS256 shared secret, FastAPI gates mutations on role
- **File schema**: Fixed/known columns — simplifies parsing, no schema inference needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `/home` as post-login entry point instead of direct `/` redirect (v1.14) | iOS-style launcher scales to multiple apps; single `/` shortcut was fine for v1 but doesn't accommodate future tiles | ✓ Good — clean entry point with role-aware scaffold for future admin tiles |
| Active tile navigates to `/` not `/sales` (v1.14) | No `/sales` route exists; D-10 locks root to DashboardPage; documented in plan + summary to prevent future confusion | ✓ Good — tile correctly lands on Sales Dashboard |
| `<button>` for active tile over `<div onClick>` (v1.14) | Keyboard accessibility and ARIA semantics; `pointer-events-none` on coming-soon divs already suppresses pointer style | ✓ Good |
| Bundled Markdown docs over external CMS (v1.13) | Git-managed static content; no new service dependency; < 20 articles navigable via sidebar | ✓ Good — 22 articles shipped, zero infra overhead |
| react-markdown + rehype plugin pipeline (v1.13) | Mature ecosystem; rehype-highlight for syntax, rehype-slug for anchors, remark-gfm for tables; composable | ✓ Good — clean pipeline, dark mode prose via @tailwindcss/typography |
| GithubSlugger for TOC slug alignment (v1.13) | Guarantees extractToc slugs match rehype-slug output — no drift between TOC links and heading IDs | ✓ Good |
| Registry pattern for docs content (v1.13) | O(1) lookup by lang/section/slug; easy to add articles without touching routing | ✓ Good |
| Directus for auth + admin UI (v1.11) | Single container; reuses existing Postgres; built-in user/role admin UI; mature (7+ years); lower host complexity than Supabase's 5-service stack | — Pending v1.11 |
| Pivot from Authentik/Dex to Directus | Phase 32 silent-SSO flow (Dex + oauth2-proxy + NPM auth_request) hit cascading cookie/CSRF/config-gen failures; single-app scope doesn't justify a multi-service identity stack; Supabase briefly considered but ruled out in favor of Directus's simpler single-container footprint | ✓ Adopted 2026-04-15 |
| Keep existing Postgres container | Directus connects to our `db` service; no migration needed; Alembic owns `public.*`, Directus owns `directus_*` in the same DB | — v1.11 Phase 26 |
| Two Directus roles (Admin, Viewer) managed in Directus UI | Directus's role/permission model is UI-first; no hand-rolled `profiles.role` enum; role change is a click | — v1.11 Phase 26 |
| FastAPI gates mutations on Directus JWT role claim | Server-side authz is authoritative; frontend hiding is UX polish; 403 with `{"detail": "admin role required"}` for Viewer | — v1.11 Phase 28 |
| Fixed 38-column schema | User confirmed ERP export columns are consistent; removes need for schema inference | ✓ Good (Phase 2 parser simpler than alternatives) |
| Docker Compose deployment | Entire stack containerized for portability and reproducibility | ✓ Phase 1 |
| FastAPI + asyncpg + SQLAlchemy 2.0 async | Async end-to-end matches I/O-bound workload; 10x Pydantic v2 validation | ✓ v1.0 |
| wouter over react-router | Smaller footprint, simpler API; only two routes in v1 | ✓ Phase 3 |
| shadcn wraps @base-ui/react (not Radix) | Project's shadcn registry uses base-ui primitives — use `render` prop, not `asChild` | ✓ Phase 3 |
| JSONB arrays for multi-select config | Alembic CASE-WHEN migration preserves existing values; `or []` normalization at read time | ✓ v1.6 Phase 19 |
| Language in localStorage (not DB) | Language is a per-browser preference, not shared state; eliminates API round-trip on switch | ✓ v1.6 Phase 20 |
| Reusable CheckboxList component | Single component serves all 3 Personio config fields with consistent UX | ✓ v1.6 Phase 20 |
| Tailwind v4 class strategy for dark mode | CSS-first config (no `tailwind.config.js`); `:root`/`.dark` blocks define token values; single source of truth | ✓ v1.9 Phase 21 |
| Chart tokens via `var(--color-*)` in chartDefaults.ts | Recharts consumes same tokens as rest of UI — mode switches automatically without per-component overrides | ✓ v1.9 Phase 21 |
| Semantic color invariance (brand accent + amber + status badges identical across modes) | Meaning stays stable (green=good, red=bad); only surface lightness changes between modes | ✓ v1.9 Phase 21/23 |
| Pre-hydration IIFE sets theme class + splash CSS variables before first paint | Eliminates theme flash and white-splash flash on reload in dark mode | ✓ v1.9 Phase 22/23 |
| D-12 waiver on axe + WebAIM verification for v1.9 | Operator accepted deterministic fix evidence (RESEARCH.md pre-computed ratios + grep cleanliness) in lieu of automated/manual audit | ⚠️ Revisit if real-world contrast feedback surfaces |
| Sun/moon icon button over segmented control for theme toggle | Simpler affordance next to DE/EN toggle; UAT approval reshaped scope mid-phase | ✓ v1.9 Phase 22 (UAT-approved deviation) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-25 — v1.22 Backend Consolidation — Directus-First CRUD shipped (tag `v1.22`). 7 phases / 39 plans / 33 requirements. Audit `tech_debt`: 4 HUMAN-UAT walkthroughs + 2 partial-scope integration findings (INT-01 toApiError adapter, INT-02 cache namespace) + CAL-PI-07 carried forward. Awaiting `/gsd:new-milestone`.*
