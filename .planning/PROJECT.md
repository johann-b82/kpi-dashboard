# KPI Dashboard

## What This Is

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files (38-column sales data) into PostgreSQL for Sales KPIs, and syncs Personio HR data (employees, attendances, absences) for 5 HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current State

**Shipped:** v1.15 Sensor Monitor — 2026-04-18
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8 + Directus 11, all Dockerized via compose with Alembic migration service and nightly `pg_dump` backup sidecar. Recharts chart overlay, react-i18next with full DE/EN parity, Intl.DateTimeFormat for locale-aware month names, APScheduler for periodic Personio sync and SNMP sensor polling. Dark mode via Tailwind v4 class strategy with CSS-variable tokens and a pre-hydration IIFE that eliminates theme-flash on reload. Auth via Directus-issued JWT (HS256 shared secret verified in FastAPI); `Admin` / `Viewer` roles enforced on every route; frontend login page via `@directus/sdk`; cookie-mode refresh. Year-aware chart x-axes with gap-filled month spines and year boundary separators. App branded as "KPI Dashboard" with CI-aligned login page. In-app documentation via react-markdown + rehype pipeline with role-gated sidebar, TOC with scroll tracking, and bilingual Markdown articles covering user guide and admin guide. iOS-style `/` App Launcher (role-aware tiles, bilingual labels) as authenticated entry point. pysnmp-based SNMP temperature/humidity monitoring with Fernet-encrypted community strings, admin-only dashboard + settings sub-page + SNMP walk/probe tooling.
**Codebase:** ~14,100 LOC + v1.15 sensor additions (Python + TypeScript), 15 versions shipped (v1.0–v1.15).
**Audit status:** All v1.0–v1.6, v1.11-directus, v1.12, v1.13, v1.14, and v1.15 requirements satisfied. v1.9 shipped with documented D-12 waiver (automated axe + manual WebAIM verification skipped at operator request; deterministic token fixes and grep cleanliness accepted as substitute).

## Current Milestone: v1.16 Digital Signage

**Goal:** Ship a Directus-backed digital signage CMS within the existing monorepo — admin UI for managing Media/Playlists/Devices, a Chromium-kiosk player for Raspberry Pi, and tag-based playlist-to-device routing. Small-fleet scope (≤5 devices), single-site, cache-and-loop offline mode.

**Target features (admin side):**
- Media library — Images (PNG/JPG/WebP), Videos (MP4/WebM), PowerPoint (PPTX → server-side converted to image slides), PDF with page-flip playback, Web URLs, HTML snippets — stored in Directus file storage
- Playlists — ordered list of media items with per-item duration/transition, targeting device tags
- Devices — CRUD + tag assignment, pairing-code onboarding for fresh Pis, health/status (last-seen, current playlist)
- Tag-based routing — Devices carry tags (lobby, production, cafeteria); playlists target tag groups
- Admin-only launcher tile — new `/signage` route wrapped in `AdminOnly`

**Target features (player side):**
- Chromium kiosk player — web page served by backend, auto-refreshes on playlist/media change
- Hybrid sync — polling baseline (30s) + Server-Sent Events for instant updates
- Pairing flow — fresh Pi boots → displays 6-digit code → admin enters code in UI → device is claimed and tagged
- Offline cache-and-loop — when network drops, player keeps looping last-cached playlist until connectivity returns
- Format handlers — image display with fade, video autoplay, iframe for URLs, PDF page-flip via pdf.js, HTML snippet rendering, PPTX slides as converted images

**Target features (infrastructure):**
- Directus collections (Alembic-managed schema, hidden from Directus Data Model UI): `media`, `playlists`, `playlist_items`, `devices`, `device_tags`
- FastAPI `/api/signage/*` endpoints — playlist resolution per device, pairing, device heartbeat, SSE stream
- PPTX conversion service — backend worker (LibreOffice headless + pdf2image) running async on upload
- Bilingual admin UI (DE/EN parity, "du" tone for German)
- Bilingual admin guide article — Pi setup, pairing workflow, playlist management, offline behavior

**Deferred:** Time-based schedules (one-playlist-per-tag for now), per-device calibration, medium/large fleet features (20+ devices), SSO for devices, per-device analytics.

---

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
*Last updated: 2026-04-18 — Phase 43 (Media + Playlist + Device Admin API, polling) complete — admin CRUD router, tag-to-playlist resolver, player polling + heartbeat endpoints, and 1-min APScheduler heartbeat sweeper all landed and verified (5/5 must-haves, 41/41 phase tests green)*
