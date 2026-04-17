# Milestones

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
