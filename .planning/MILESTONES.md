# Milestones

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
