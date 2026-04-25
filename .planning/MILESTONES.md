# Milestones

## v1.22 Backend Consolidation — Directus-First CRUD (Shipped: 2026-04-25)

**Phases completed:** 7 phases (65–71), 39 plans. **33/33 requirements satisfied at code level.** Audit status: `tech_debt` (4 HUMAN-UAT walkthroughs + 2 partial-scoping integration findings carried forward).

**Audit:** [milestones/v1.22-MILESTONE-AUDIT.md](milestones/v1.22-MILESTONE-AUDIT.md)

**Goal achieved:** Moved ~25 pure-CRUD FastAPI endpoints (`me.py`, sales/employee row reads in `data.py`, signage admin tags/schedules/playlists/devices) to Directus collections on the shared Postgres, leaving FastAPI focused on compute (upload, KPIs, Personio sync, SSE, calibration, bulk playlist-item replace, PPTX, device-JWT minting, analytics).

**Key accomplishments:**

- **Phase 65 — Foundation.** Directus snapshot YAML (9 collections, schema:null) + idempotent `directus-schema-apply` compose service; `bootstrap-roles.sh` per-collection Viewer permission rows with explicit fields allowlists for `sales_records` / `personio_employees` / `directus_users` (no signage rows; secret fields excluded). Alembic migration `v1_22_signage_notify_triggers` ships shared `signage_notify()` PL/pgSQL function + 8 AFTER triggers on 6 signage tables emitting `pg_notify('signage_change', JSON)` with preflight assertion and clean downgrade. Asyncpg long-lived LISTEN connection on `signage_change` dispatches INSERT/UPDATE/DELETE events to affected player SSE streams via resolver + `notify_device()` with exponential-backoff reconnect. `--workers 1` invariant + 4 CI guards (DDL hash, snapshot diff, DB_EXCLUDE_TABLES superset, workers-one comment).
- **Phase 66 — Kill `me.py`.** `AuthContext.tsx` hydrates current user via `directus.request(readMe(...))` — no `/api/me` network call; FastAPI router + test deleted; Viewer role granted `directus_roles` read; `useCurrentUserProfile()` React Query hook added. Pre-stack grep CI guard fails the build in <1s if `"/api/me"` reappears in `frontend/src/`.
- **Phase 67 — Migrate `data.py`.** `fetchSalesRecords` + `fetchEmployees` migrated to Directus SDK `readItems` with `?filter[order_date]` date-range filtering; new compute-only `GET /api/data/employees/overtime` isolated in `backend/app/routers/hr_overtime.py`; `useEmployeesWithOvertime` composite hook merges Directus rows + overtime via `useMemo` with zero-fill; dedicated `test_hr_overtime_endpoint.py` (8 tests); CI grep guard blocks `/api/data/sales` + `/api/data/employees` literal reappearance in `backend/app/`.
- **Phase 68 — MIG-SIGN Tags + Schedules.** `signage_tags` + `signage_schedules` CRUD via Directus SDK; Alembic CHECK (`start_hhmm < end_hhmm`) + Directus validation hook returning `schedule_end_before_start` for friendly i18n error; FastAPI tags + schedules routers removed; SSE regression tests for Directus-originated schedule lifecycle + tag silent-on-CRUD.
- **Phase 69 — MIG-SIGN Playlists.** GET/POST/PATCH on `/playlists`, GET on `/{id}/items`, PUT on `/{id}/tags` migrated to Directus SDK; surviving FastAPI surface = `DELETE /playlists/{id}` (structured 409 `{detail, schedule_ids}` preserved) + bulk `PUT /playlists/{id}/items` (atomic DELETE+INSERT); `_notify_playlist_changed` retained on both surviving handlers; SSE `playlist-changed` regression tests for both Directus and FastAPI writers.
- **Phase 70 — MIG-SIGN Devices.** `signage_devices` trimmed to surviving `PATCH /{device_id}/calibration` only (calibration-changed SSE preserved); list/by-id/name/delete/tags-PUT migrated to Directus SDK; new compute-only `GET /api/signage/resolved/{device_id}` returns `{current_playlist_id, current_playlist_name, tag_ids}` per device; `DevicesPage.tsx` introduces project's first cross-source `useQueries` merge (Directus rows + per-row FastAPI resolved fan-out) preserving v1.21 column shape; SSE `device-changed` + tag-map + calibration no-double-fire regression tests.
- **Phase 71 — FE Polish + CLEAN.** Central `toApiError()` helper normalizes Directus SDK errors to `ApiErrorWithBody` across 30 `signageApi.ts` call sites; localStorage-gated one-shot `kpi.cache_purge_v22` purges legacy `['signage', ...]` TanStack cache keys in `bootstrap.ts`; 10 deterministic JSON contract fixtures + 344-line vitest suite freeze the FE adapter response shape; OpenAPI paths snapshot (`backend/tests/contracts/openapi_paths.json`, 44 paths) + DB_EXCLUDE_TABLES `isdisjoint` absent-from check; orphan signage Pydantic schemas swept (8 deleted, `SignageDeviceBase` retained as inheritance guard); ADR-0001 documents the Directus/FastAPI split with STAYS list + Settings deferral, linked from `docs/architecture.md` + `README.md`; v1.22 Rollback Procedure runbook section.

**Stats:** 155 commits, 186 files changed, +28,322 / -3,662 LOC. Timeline: 2026-04-23 → 2026-04-25 (3 days).

### Known Gaps (carried as tech debt)

- **HUMAN-UAT pending (4 walkthroughs):** Phase 65 live-stack verification (SSE latency, calibration no-double-fire, listener reconnect, AUTHZ live, fresh-volume idempotency); Phase 68 admin Directus CRUD smoke for tags + schedules; Phase 69 admin Directus CRUD smoke for playlists + tag-map; Phase 71 v1.22 rollback drill (CLEAN-03) per `docs/operator-runbook.md`.
- **INT-01 (medium):** `toApiError` adapter scoped to `signageApi.ts` only. Phase 66 (`AuthContext.tsx`, `useCurrentUserProfile.ts`) and Phase 67 (`fetchSalesRecords`, `fetchEmployees` in `lib/api.ts`) Directus call sites bypass error normalization — affects FE-01, FE-04, MIG-AUTH-01, MIG-DATA-01..03 (functional but error-shape leaks raw Directus plain-objects on failure).
- **INT-02 (low):** Cache namespace separation is one-shot eviction. Only DevicesPage migrated to `['directus', 'signage_devices']` in 70-04; ~23 admin call sites (tags, schedules, playlists, media, pair) still write the legacy `['signage', ...]` namespace post-purge. No collision (FE-02 invariant holds), but FE-03 spirit is partial.

---

## v1.21 Signage Calibration + Build Hygiene + Reverse Proxy (Shipped: 2026-04-24)

**Phases completed:** 3 phases (62–64), 6 plans. **24/25 requirements satisfied**, 1 waiver (CAL-PI-07).

**Audit:** [milestones/v1.21-MILESTONE-AUDIT.md](milestones/v1.21-MILESTONE-AUDIT.md) — passed with waiver; hardware-environment diagnostic on test Pi carries forward as a quick task.

**Key accomplishments:**

- **Per-device signage calibration** (Phase 62, 4 plans) — Operators set rotation (0/90/180/270), HDMI mode, and audio on/off per signage Pi from `/signage/devices` admin UI. Backend: Alembic `v1_21_signage_calibration` migration adds three columns to `signage_devices`; admin `PATCH /api/signage/devices/{id}/calibration`; device-auth `GET /api/signage/player/calibration`; SSE `calibration-changed` event. Pi sidecar: new `httpx-sse` subscriber on the existing `/api/signage/player/stream` reuses the device JWT; `wlr-randr --transform` / `--mode` for display, `wpctl set-mute` with `pactl` fallback for audio, all via `asyncio.create_subprocess_exec` (no sync subprocess). `/var/lib/signage/calibration.json` persistence + boot replay gated behind a 15 s `_wait_for_wayland_socket` bounded poll (belt-and-braces over `After=labwc.service`). Player app toggles `<video>` `muted` attribute on SSE event. Unit coverage: 17/17 sidecar tests + 12/12 backend tests + 3/3 player tests. **CAL-PI-07 hardware-timing walkthrough waived pending per-Pi environment diagnostic.**
- **Frontend build green** (Phase 63, 1 plan) — `docker compose build --no-cache frontend` exits 0 after adding `--legacy-peer-deps` to `frontend/Dockerfile` and a `frontend/.npmrc` carrying the same flag for host installs. Upstream `vite-plugin-pwa@1.2.0` caps vite at ^7 and no newer release exists; this is a documented workaround tracked in SUMMARY for revisit when the plugin adds vite@8 to peer-deps. Host `npm run dev` + `npm run build` unaffected.
- **Caddy 2 reverse proxy on :80** (Phase 64, 1 plan + 2 post-ship hotfixes) — New `caddy` compose service fronts `/` → frontend:5173, `/api/*` → api:8000 (with `flush_interval -1` + 24 h `read_timeout` for SSE survival), `/directus/*` → directus:8055 (with `handle_path` prefix-strip so Directus sees bare paths), `/player/*` → api:8000 (FastAPI serves the built player bundle; Vite dev doesn't). Directus `CORS_ORIGIN` / `CORS_ENABLED` / `CORS_CREDENTIALS` removed — SPA calls are same-origin now. Frontend Directus SDK default → `window.location.origin + "/directus"` (bare `/directus` would fail `new URL()` validation in the SDK). Pi kiosk URL `http://<host>:80/...` from `provision-pi.sh` finally works. Unblocked CAL-PI-07's hardware walkthrough from LAN-access dead-ends.
- **Authentik removed** (quick task, inline) — CLAUDE.md project description + constraint block + PROJECT.md overview updated to reflect Directus as the committed identity layer (shipped in v1.11-directus 2026-04-15); the "future Authentik pivot" phrasing is gone.

**Tech debt carried to v1.22:**

- **CAL-PI-07 hardware diagnostic** — specific to the paired test Pi; candidate for a post-ship `/gsd:quick` when sidecar-env isolation identifies the missing piece (likely `SIGNAGE_API_BASE`, device token path, or wayland env passthrough).
- **Admin UI calibration render-loop test** — Phase 62-02 pivoted from render+fireEvent to static coverage after jsdom render-loop on the base-ui Dialog + Toggle combo; runtime coverage should come from CAL-PI-07.
- **FastAPI cosmetic `/api/health`** — Phase 64 verify script referenced this path but only `/health` exists; not blocking, small future add.
- **Stale `api` image** needs one-time `docker compose build --no-cache api` to pick up v1_21 alembic revision (env refresh, not a code bug).

**Scope change mid-milestone:** v1.21 grew from 2 phases → 3 phases when Phase 62's hardware walkthrough exposed the dev compose stack had no reverse proxy and the Pi's `:80` URLs pointed at nothing. Phase 64 (Caddy) was added and shipped same-day. Two post-ship hotfixes on Phase 64 (Directus SDK URL + `/player/*` route).

---

## v1.20 HR Date-Range Filter + TS Cleanup (Shipped: 2026-04-22)

**Phases completed:** 2 phases (60–61), 5 plans.

**Audit:** [milestones/v1.20-MILESTONE-AUDIT.md](milestones/v1.20-MILESTONE-AUDIT.md) — both phases `passed`, no gaps, no blockers.

**Key accomplishments:**

- **HR date-range filter end-to-end** (Phase 60) — shared `DateRangeFilter` from SubHeader wired into `/hr`; backend `/api/hr/kpis`, `/api/hr/kpis/history`, `/api/data/employees` all accept `date_from`/`date_to` with pair-or-neither + inverted-range 400 validation; HR aggregation service computes all 5 KPIs over arbitrary windows with same-length prior-period and same-window prior-year baselines; fluctuation denominator switched from EOM-snapshot to avg-active-headcount across the range (D-03). Plans 60-01..60-04 complete including 13/13 pytest + user-approved human visual-parity checkpoint.
- **Personio attendance full backfill + incremental sync** (Phase 60 follow-up `4d1c5f0`) — `hr_sync` computes attendance window from DB state (earliest `hire_date` on first run, `max(stored_date) - 14d` incremental thereafter); `personio_client` gains exponential 429 backoff (3 attempts, delay = max(Retry-After, 2^attempt · 30s)); sync cadence default raised 1h → 168h (weekly) via Alembic migration.
- **HR delta-badge + chart parity with Sales** (Phase 60 follow-up) — `HrKpiCardGrid` swapped hardcoded `formatHrDeltaLabels` for shared `formatPrevPeriodDeltaLabels(preset, range)`; thisYear collapses to single "vs. prior year" badge via previous_year remap; HrKpiCharts x-axis labels now mirror Sales naming (`KW 17`, `Apr '26`, `Q1 '26`, `15. Apr`).
- **Navigation polish** (Phase 60 follow-up) — upload icon restricted to `/sales` (was on `/sales` + `/hr`); Bar/Line toggles unified to Balken-left/Linien-right with `variant="muted"` matching the DE/EN language toggle.
- **TS cleanup to green build** (Phase 61) — 31 pre-existing TypeScript errors (carry-forward from v1.17–v1.19) closed across 9 frontend files in 10 atomic `fix(61):` commits. `npm run build` now exits 0 with zero `error TS` lines. `useTableState.ts` kept untouched — SalesTable fixed via local `SalesRow & Record<string, unknown>` intersection (D-02). Suppression-directive audit verified zero `@ts-expect-error` / `@ts-ignore` / `as any` authored by Phase 61 (anti-cheat via `git blame`). `|| true` audit on build surfaces (package.json, Dockerfiles, compose, workflows, husky, smoke scripts) returned zero matches.

**Infrastructure hygiene noted (not blocking):** pre-existing `vite@8` vs `vite-plugin-pwa@1.2.0` peer-dep conflict prevents `docker compose build frontend`; bind-mount + HMR + host `npm run build` cover dev + CI; scheduled for a future cleanup.

---

## v1.19 UI Consistency Pass 2 (Shipped: 2026-04-22)

**Phases completed:** 6 phases (54–59), 32 plans, 23/23 requirements verified.

**Audit:** [milestones/v1.19-MILESTONE-AUDIT.md](milestones/v1.19-MILESTONE-AUDIT.md) — all phases `passed`, no gaps, no blockers.

**Key accomplishments:**

- **Pill `Toggle` primitive** (Phase 54) with radiogroup a11y, arrow-key wrap, animated sliding indicator, and `prefers-reduced-motion` fallback. Drove migrations of NavBar Sales/HR switch, chart-type toggles on `RevenueChart` + `HrKpiCharts`, `ThemeToggle` (sun/moon, preserving OS + localStorage), and `LanguageToggle` (DE/EN, preserving i18next) — retired all 2-segment `SegmentedControl` usages.
- **Consolidated form primitives** (Phase 55): `Input`, `Select`, `Button`, `Textarea`, `Dropdown` under `components/ui/` unified on the `h-8` height token with a single Path A focus-ring utility and shared disabled + `aria-invalid` states. 14 consumer migrations + 3 documented CTRL-02 exceptions (LauncherPage tiles, file-picker inputs, deferred SalesTable button).
- **Identity-only top header + breadcrumb navigation** (Phase 56): `NavBar` pared to 37 LOC; route-derived breadcrumb trail (14 routes, deeper-first matcher); `UserMenu` dropdown absorbs Docs/Settings/Sign-out; Sales/HR toggle + Upload icon relocated to `SubHeader`; legacy `lastDashboard` sessionStorage removed.
- **Section context + standardized trashcan** (Phase 57): `SectionHeader` primitive on every admin section; shared `DeleteButton` + `DeleteDialog` replace 5 ad-hoc feature-variant dialogs; zero `window.confirm` remain in `frontend/src`. 19 new DE/EN i18n keys at 498-key parity; CI guard `check:phase-57` enforces 4 eradication invariants.
- **Sensors layout parity** (Phase 58): `/sensors` body slimmed to 19 LOC (cards + chart) with `SensorTimeWindowPicker` + `PollNowButton` hoisted to `SubHeader` via the already-global `SensorTimeWindowProvider`.
- **A11y + parity sweep** (Phase 59): `check-locale-parity`, `check-i18n-du-tone`, and `check-phase-59-guards` (color-literal + icon-button aria-label) wired as persistent npm scripts; focus-ring invariant locked by `toggle.test.tsx` + static guards. 13 audited surfaces pass dark-mode review.

**Tech debt carried to v1.20:** pre-existing TS errors in ~9 files untouched by v1.19 (SalesTable, PersonioCard, SnmpWalkCard, legacy select, useSensorDraft, defaults, ScheduleEditDialog, SchedulesPage.test, HrKpiCharts) block `npm run build` in isolation — candidate for a dedicated TS-cleanup plan.

---

## v1.15 Sensor Monitor (Shipped: 2026-04-18)

**Phases completed:** 3 phases, 8 plans, 4 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- Wired the v1.15 sensor pipeline into the existing APScheduler singleton — new sensor_poll job (max_instances=1, coalesce=True, misfire_grace_time=30, outer asyncio.wait_for), daily 90-day retention cleanup on CronTrigger(03:00 UTC), shared SnmpEngine on app.state — pinned the uvicorn --workers 1 deployment invariant in docker-compose.yml with SEN-SCH-05/C-7 comment, exposed reschedule_sensor_poll(int) for Phase 40, and scaffolded both gating checkpoints (SEN-OPS-01 pre-flight + Plan 38-03 E2E) in 38-VERIFICATION.md for the operator to run on the deployment host.
- Interaction + differentiators (not in 39-01):
- Backend (Task 1):
- api.ts fetchers (Task 1):
- One-liner:

---

## v1.14 App Launcher (Shipped: 2026-04-17)

**Phases completed:** 1 phases, 2 plans, 5 tasks

**Key accomplishments:**

- iOS-style /home App Launcher with 4-tile grid, bilingual i18n, settings-driven heading, and post-login redirect from AuthGate
- 10-step browser walkthrough confirmed all App Launcher requirements PASSED: auth redirect, 4-tile grid, navigation, coming-soon inertness, roles, dark mode, i18n, settings-driven heading, and NavBar/SubHeader chrome

---

## v1.13 In-App Documentation (Shipped: 2026-04-17)

**Phases completed:** 4 phases, 8 plans
**Git range:** `02cd57d` → `beb7080` (82 files, +11,177/−1,538 LOC)
**Timeline:** 2026-04-16 (single day)

**Key accomplishments:**

- **Markdown rendering pipeline (Phase 33)** — react-markdown + rehype-highlight + rehype-slug + remark-gfm, dark-mode-aware prose styling via @tailwindcss/typography, extractToc with GithubSlugger alignment, lazy-loaded /docs route
- **TOC with scroll tracking (Phase 33)** — TableOfContents sidebar with Intersection Observer active-heading highlighting
- **Navigation shell (Phase 34)** — NavBar Library icon, DocsSidebar with AdminOnly role gating, three-column DocsPage layout, /docs/:section/:slug routing, role-aware default redirect, article registry, bilingual i18n chrome
- **User Guide content (Phase 35)** — 5 articles (intro, uploading data, sales dashboard, HR dashboard, filters, language/theme) in EN and DE (12 markdown files)
- **Admin Guide content (Phase 36)** — 4 articles (system-setup, architecture, personio, user-management) + intro replacement in EN and DE (10 markdown files), completing full bilingual documentation coverage

---

## v1.12 Chart Polish & Rebrand (Shipped: 2026-04-16)

**Phases completed:** 2 phases, 4 plans, 0 tasks

**Key accomplishments:**

- Shared `chartTimeUtils.ts` module (month spine, gap-fill merge, locale-aware formatter, year-boundary detector) with 12 unit tests (Phase 31)
- Year-aware tick labels (`Nov '25`), gap-filled axes, and dashed year boundary lines on both Sales and HR dashboards (Phase 31)
- Renamed "KPI Light" to "KPI Dashboard" across all 8 UI surfaces + added unauthenticated `GET /api/settings/logo/public` endpoint (Phase 32)
- Login page logo display from public endpoint with text-only fallback + card restyling matching app aesthetic (Phase 32)

---

## v1.11-directus Directus Pivot (Shipped: 2026-04-15)

**Phases completed:** 7 phases, 17 plans, 18 tasks

**Key accomplishments:**

- 1. Concrete prior-period labels on bottom row
- Task 1: Swap outer wrapper to dashboard container and restructure body into two-column grid
- SettingsPage outer wrappers upgraded from max-w-5xl to max-w-7xl dashboard-parity container with pb-32 ActionBar clearance and space-y-8 vertical rhythm
- Human UAT approved UC-10 — all four pages pass container parity, delta label survival (DE/EN, month/quarter/year), and zero dashboard regressions; UAT session also produced Settings card consolidation and NavBar contextual back button
- Clean `docker compose up` brings the full 6-service stack to terminal state, operator signs in at 127.0.0.1:8055, both custom roles (Admin, Viewer) render in the admin UI, and none of the 7 Alembic-managed app tables appear in Directus Data Model — Phase 26 closed.
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Shipped the Phase 29 user-visible deliverable: /login page, role-aware UI across 9 admin surfaces, NavBar sign-out, and full fetch→apiClient migration (17 call sites) — all 5 ROADMAP success criteria verified by the user.
- Section-order deviation:
- README.md edit location:

---

## v1.9 Dark Mode & Contrast (Shipped: 2026-04-14)

**Delivered:** Full dark mode across every surface with OS-preference-aware initial theme, localStorage override, and WCAG-AA-targeted contrast via deterministic token fixes.

**Phases completed:** 3 phases, 12 plans, 13 tasks

**Git range:** `0a382a1` → `ecb0832` (50 commits, 55 files, +6659/-151 LOC)
**Timeline:** 2026-04-13 → 2026-04-14 (~1 day)

**Key accomplishments:**

- Tailwind v4 class-strategy theme with `:root`/`.dark` CSS-variable tokens — single source of truth for both modes (Phase 21)
- `chartDefaults.ts` wires Recharts to the same token system; axes, grid, tooltip, legend adapt automatically (Phase 21)
- Hardcoded Tailwind colors migrated to tokens across UploadHistory, DropZone, ErrorList, EmployeeTable, PersonioCard (Phase 21)
- Sun/moon icon toggle in navbar (UAT-approved deviation from segmented control); OS `prefers-color-scheme` default with localStorage override; full DE/EN i18n parity (Phase 22)
- Pre-hydration IIFE sets theme class **and** splash CSS variables before first paint — eliminates theme flash and the Phase 22 UAT "white splash in dark mode" regression (Phases 22+23)
- Deterministic contrast fixes: `--color-success` darkened to `#15803d` (5.02:1 white PASS), EmployeeTable active badge → `text-foreground` (D-06 per-component override); grep-clean codebase with 0 unexpected hex literals (Phase 23)
- Semantic color invariance preserved: brand accent, amber warning, and status badges identical across modes

**Known Gaps:**

- **D-12 waiver** — automated axe DevTools audit (Plan 23-03) and manual WebAIM verification (Plan 23-04) skipped at operator request. DM-09/DM-10 acceptance rests on RESEARCH.md pre-computed ratios + grep cleanliness + Plan 23-02 splash fix. If real-world contrast feedback surfaces, run `/gsd:verify-work` against Phase 23 or open a follow-up contrast-regression phase.

---

## v1.6 Multi-Select HR Criteria (Shipped: 2026-04-12)

**Phases completed:** 2 phases, 4 plans, 8 tasks

**Key accomplishments:**

- **JSONB array migration (Phase 19)** — Alembic migration converts 3 Personio config columns from scalar to JSONB arrays with NULL-safe CASE expressions, preserving existing values as single-element arrays
- **Array API contract (Phase 19)** — Settings GET/PUT endpoints accept and return arrays; Pydantic schemas enforce `list[int]`/`list[str]` types; `or []` normalization in HR KPI aggregation
- **Multi-value HR KPI aggregation (Phase 19)** — Sick leave, revenue/employee, and skill development KPIs all use IN/OR filters instead of equality, supporting multiple selected values per field
- **CheckboxList UI (Phase 20)** — Reusable scrollable checkbox list component with loading/empty/disabled states, shadcn Checkbox primitive, PersonioCard rewired from `<select>` dropdowns to 3 checkbox lists with bilingual i18n labels

---

## v1.5 Segmented Controls (Shipped: 2026-04-12)

**Phases completed:** 1 phases, 2 plans, 4 tasks

**Key accomplishments:**

- Generic pill-shaped SegmentedControl with bg-foreground active pill, ARIA radiogroup semantics, and disabled state — foundation for all 5 consumer replacements in Phase 18
- All 5 toggle/tab controls replaced with pill-shaped SegmentedControl — NavBar nav tabs, language toggles (navbar + settings), date range presets, and chart type selector all unified to single component

---

## v1.4 Navbar & Layout Polish (Shipped: 2026-04-12)

**Phases completed:** 1 phases, 2 plans, 4 tasks

**Key accomplishments:**

- DateRangeContext extracted from DashboardPage, NavBar updated with 32px logo, upload icon action link, and upload tab removed
- SubHeader with route-aware freshness, DateRangeFilter on Sales tab, and sync button relocated to Settings

---

## v1.3 HR KPI Dashboard & Personio-Integration (Shipped: 2026-04-12)

**Phases completed:** 5 phases, 10 plans, 12 tasks

**Timeline:** 2026-04-12 (single day)
**Scope:** 27 files changed, +2,544 LOC, 20/20 requirements satisfied
**Audit:** Passed — 20/20 requirements, 4/4 cross-phase integrations, 4/4 E2E flows

**Key accomplishments:**

- **HR database schema + Personio client (Phase 12)** — 4 Personio HR tables (employees, attendance, absences, sync_meta) via Alembic migration, Fernet-encrypted credential columns, write-only Settings API, async PersonioClient with token caching and exception hierarchy
- **Sync service + Settings extension (Phase 13)** — APScheduler-based periodic sync, manual sync endpoint, raw data persistence (employees, attendances, absences), PersonioCard frontend with credential inputs, live-populated dropdowns for absence types and departments, connection test
- **Navigation + HR tab shell (Phase 14)** — Multi-tab navigation (Dashboard→Sales rename, HR tab), HR page shell with Personio sync freshness indicator and manual sync trigger
- **HR KPI cards + dashboard (Phase 15)** — Backend HR KPI aggregation service (5 KPIs × 3 calendar month windows), HrKpiCardGrid with 3+2 layout, dual delta badges, no-sync/error/unconfigured state handling
- **i18n polish (Phase 16)** — 24 new `settings.personio.*` keys in both locale files, PersonioCard.tsx wired with useTranslation, dead key removed, proper UTF-8 umlauts — 164 keys total with full DE/EN parity

---

## v1.2 Period-over-Period Deltas (Shipped: 2026-04-12)

**Phases completed:** 4 phases, 10 plans, 16 tasks

**Key accomplishments:**

- 08-02 (summary endpoint)
- Found during:
- `frontend/src/lib/api.ts`
- Dual-delta KPI card foundation: null-safe computeDelta, preset-aware computePrevBounds, Intl-based formatPrevPeriodLabel/formatPrevYearLabel, to-date getPresetRange migration, and extended KpiSummary / fetchKpiSummary / kpiKeys.summary carrying the Phase 8 prev_period / prev_year contract.
- Pure, prop-driven DeltaBadge + DeltaBadgeStack + KpiCard.delta slot + 6 EN delta locale keys — zero data coupling, ready for 09-03 dashboard wiring.
- DashboardPage now owns preset+range, KpiCardGrid wires the full prev-bounds → delta → contextual-label → DeltaBadgeStack pipeline, and the dashboard ships with right-side delta badges + a right-aligned preset bar (no custom range picker, no ZEITRAUM label).
- `selectComparisonMode`
- RevenueChart gains a full-opacity amber (#f59e0b) prior-period overlay series alongside a blue (#2563eb) current series, with a Recharts Legend showing contextual labels; preset+range threaded from DashboardPage drives lock-step refetch.
- DE locale reaches parity with EN at 119 keys; periodLabels.ts gains `getLocalizedMonthName` via Intl.DateTimeFormat + routes all custom/generic period-label branches through the injected t() function, eliminating every hardcoded EN/DE string.
- v1.2 milestone approved — 4×2 matrix (4 presets × 2 languages) passed with correct delta badges, chart overlay, contextual labels, and em-dash fallbacks

---

## v1.1 Branding & Settings (Shipped: 2026-04-11)

**Phases completed:** 4 phases (4–7), 19 plans, 30 tasks
**Timeline:** 2026-04-10 → 2026-04-11 (~2 days)
**Scope:** 105 files changed, +14,530 / −74 LOC, 86 commits
**Requirements:** 17/17 closed (SET, BRAND, I18N, UX)

**Key accomplishments:**

- **Settings API + security boundary (Phase 4)** — singleton `app_settings` table with `CHECK(id=1)`, inline BYTEA logo storage, `nh3`-sanitized SVG upload, Pydantic oklch/hex validators rejecting CSS injection (`;`, `}`, `{`, `url(`, `expression(`, quotes). Curl smoke script + docker-rebuild runbook landed with human sign-off.
- **ThemeProvider + live NavBar branding (Phase 5)** — CSS variable injection for 6 semantic tokens, `document.title` sync, logo/app-name rendered in NavBar with mutual-exclusion fallback. ThemeProvider gates render during initial `useSettings()` load, eliminating default-brand flash.
- **Settings page + draft state machine (Phase 6)** — hex/oklch draft/snapshot state via `useSettingsDraft`, three-listener unsaved-changes guard (`beforeunload` + document-capture click + `popstate`), ColorPicker + ContrastBadge (WCAG warn-only) + LogoUpload dropzone, ActionBar + Reset/UnsavedChanges dialogs. Two post-implementation hotfixes (hexToOklch precision, FastAPI 422 rendering) before human verification passed.
- **i18n async bootstrap (Phase 7 / I18N-02)** — single cold-start writer (`bootstrap.ts`) fetches `/api/settings` before React mounts, seeds TanStack `["settings"]` cache, calls `i18n.changeLanguage`. Eliminates duplicate round-trips and mis-language flash. CSS splash inside `#root` replaced atomically on first React commit.
- **Persisting DE/EN toggle + full locale parity (Phase 7 / I18N-01)** — NavBar `LanguageToggle` rewritten as pessimistic `useMutation` with full 8-field PUT; dirty-aware disable via `SettingsDraftContext`. Settings page `PreferencesCard` handles draft-preview language swaps. de.json brought to 109-key parity with en.json in informal "du" tone, loanwords (Dashboard, Upload, KPI, Logo) preserved per D-18.
- **SC4 rebuild-persistence harness (Phase 7)** — `scripts/smoke-rebuild.sh` orchestrates pytest seed/assert/cleanup + Playwright visual check + host-side locale parity, proving all 8 settings fields + logo bytes survive `docker compose down && up --build` with `postgres_data` preserved. Human verification approved.

---

## v1.0 MVP (Shipped: 2026-04-11)

**Phases completed:** 3 phases, 10 plans, 13 tasks

**Key accomplishments:**

- Initial Alembic migration creating upload_batches and sales_records tables, Docker Compose stack verified end-to-end with health endpoint, persistence across restarts confirmed.
- 38-column ERP tab-delimited parser with German locale handling, complete SQLAlchemy models with UNIQUE business key, and Pydantic API response schemas
- FastAPI upload router (POST /api/upload, GET /api/uploads, DELETE /api/uploads/{id}) wired into app with Alembic migration to full 38-column PostgreSQL schema including UNIQUE order_number and cascade delete
- React 19 + TypeScript + Vite 8 frontend scaffold with Tailwind v4, shadcn/ui components, DE/EN i18n, TanStack Query, and Dockerized dev server added to Compose stack
- Bilingual React upload page with drag-and-drop DropZone, scrollable ErrorList, UploadHistory table with status badges, and DeleteConfirmDialog — all wired to the FastAPI backend via TanStack Query
- Three async aggregation endpoints (summary, chart, latest-upload) backed by sales_records/upload_batches with a new order_date B-tree index.

---
