# KPI Light

## What This Is

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files (38-column sales data) into PostgreSQL for Sales KPIs, and syncs Personio HR data (employees, attendances, absences) for 5 HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current Milestone: v1.6 Multi-Select HR Criteria

**Goal:** Convert all 3 Personio config fields (Krankheitstyp, Produktions-Abteilung, Qualifikations-Schluessel) from single-select dropdowns to multi-select checklists, and update HR KPI calculations to consider all selected values.

**Target features:**
- Database schema migration: single values → JSON arrays for all 3 fields
- Backend API: accept/return arrays instead of single values
- HR KPI aggregation: filter with `IN` clauses instead of `==`
- Frontend: replace `<select>` dropdowns with checkbox list UI in PersonioCard
- Backward compatibility: migrate existing single values to single-element arrays

## Current State

**Shipped:** v1.5 Segmented Controls — 2026-04-12
**Active:** v1.6 Multi-Select HR Criteria — Phase 20 complete (all phases done, human UAT pending)
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8, all Dockerized via compose with Alembic migration service. Recharts chart overlay, react-i18next with full DE/EN parity (164 keys), Intl.DateTimeFormat for locale-aware month names, APScheduler for periodic Personio sync.
**Codebase:** ~9,800 LOC (Python + TypeScript), 6 milestones shipped (v1.0–v1.5).
**Audit status:** All v1.0–v1.5 requirements satisfied.
**Phase 19 complete:** Backend array migration done — all 3 Personio config columns are JSONB arrays, Settings API accepts/returns arrays, HR KPI aggregation uses IN/OR filters.
**Phase 20 complete:** Frontend checkbox list UI — PersonioCard shows scrollable checkbox lists for all 3 config fields, array-typed state management, bilingual i18n labels. Human UAT pending for visual rendering and persistence.

## Shipped: v1.5 Segmented Controls (2026-04-12)

Unified all toggle/tab controls into pill-shaped SegmentedControl — Sales/HR nav tabs, DE/EN language toggle (navbar + settings), date range presets, chart type selector. Primary color active segment with white container and primary outline. Reusable generic component with ARIA radiogroup semantics.

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

At-a-glance growth signals on the dashboard — dual delta badges on every KPI card (vs. Vorperiode + vs. Vorjahr), ghosted amber chart overlay for prior-period comparison, contextual period labels via Intl.DateTimeFormat, full DE/EN i18n parity (119 keys), em-dash fallback for no-baseline cases. Human-verified across 4 presets × 2 languages.

</details>

## Deferred to Later Milestones

- Authentik integration (AUTH-01, OIDC/OAuth2) — unblocks multi-app identity reuse and per-user scoping
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

### Out of Scope

- Authentication/login — deferred to v2 (Authentik OIDC/OAuth2)
- Role-based access control — deferred to v2 (admin vs viewer)
- Scheduled ingestion from shared folder — deferred to v2
- Active Directory integration — deferred to v2 (via Authentik LDAP/AD connector)
- Multi-tenant / multi-app user management — deferred to v2+
- Automated data pipelines or ETL beyond file upload — future scope
- Mobile-specific UI — web-first (v1.0 desktop 1080p+ confirmed sufficient)
- Dynamic schema detection — fixed 38-column schema is deliberate
- Excel (.xlsx/.xls) ingestion — v1.0 ships CSV/TXT only; Excel deferred (openpyxl stays in requirements for future re-enable)

## Context

- **Deployment:** Docker Compose stack (db, migrate, api, frontend containers with healthchecks)
- **Data format:** Fixed 38-column ERP tab-delimited export; German locale (decimal comma, DD.MM.YYYY dates) handled during parse
- **Users:** Internal team, small group, no external access in v1
- **Future architecture:** Authentik as centralized identity provider shared across multiple apps — this KPI app is the first in a planned suite
- **Tech debt carried forward:**
  - 5 Phase 2 human-UAT visual items (drag-drop spinner, toast render, inline error list) — tracked in `02-HUMAN-UAT.md`
  - DASH-02 shipped monthly-only (granularity toggle removed by user request post-verification)

## Constraints

- **Containerization**: Must run via Docker Compose — no bare-metal dependencies
- **Database**: PostgreSQL — chosen for reliability and ecosystem
- **Identity (future)**: Authentik — self-hosted, Docker-native, supports OIDC/OAuth2/LDAP/AD
- **File schema**: Fixed/known columns — simplifies parsing, no schema inference needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Authentik for identity (v2) | Self-hosted, Docker-native, supports AD/LDAP/OIDC, reusable across apps | — Pending v2 |
| Auth deferred to v2 | v1 focus is core data pipeline + dashboard; internal-only use doesn't need auth yet | ✓ Good (v1.0 shipped without auth friction) |
| Fixed 38-column schema | User confirmed ERP export columns are consistent; removes need for schema inference | ✓ Good (Phase 2 parser simpler than alternatives) |
| Docker Compose deployment | Entire stack containerized for portability and reproducibility | ✓ Phase 1 |
| FastAPI + asyncpg + SQLAlchemy 2.0 async | Async end-to-end matches I/O-bound workload; 10x Pydantic v2 validation | ✓ v1.0 |
| wouter over react-router | Smaller footprint, simpler API; only two routes in v1 | ✓ Phase 3 |
| shadcn wraps @base-ui/react (not Radix) | Project's shadcn registry uses base-ui primitives — use `render` prop, not `asChild` | ✓ Phase 3 (caught during 03-03 execution) |
| TanStack Query `kpiKeys.all` prefix invalidation | Single `invalidateQueries({queryKey: ["kpis"]})` covers all dashboard queries; no per-query plumbing | ✓ Phase 3 (CF-02 auto-refresh flow) |
| i18n flat keys with `keySeparator:false` | Dotted keys like `dashboard.filter.thisYear` stay literal (not nested) — simpler JSON, no collision risk | ✓ Phase 2 |
| DASH-02 shipped monthly-only (granularity toggle removed) | User-directed post-verification UX cleanup — chart simplicity valued over granularity control | ⚠️ Revisit (backend still supports daily/weekly/monthly — cheap to re-add) |
| Recharts over Tremor/Chart.js | SVG-native, React-composable, directly styleable with Tailwind/CSS vars | ✓ Phase 3 |
| CSV/TXT only for v1.0 (Excel deferred) | openpyxl dependency kept; v1.0 scope focused on ERP tab-delimited export the user actually has | ✓ v1.0 |
| SQL-computed comparison windows | `previous_period` + `previous_year` via interval math in SQL, not Python — timezone-safe against UTC Postgres | ✓ v1.2 Phase 8 |
| Dual delta badges (not inline sparklines) | Two compact badges per card — simpler than sparklines, covers the "at-a-glance growth" use case | ✓ v1.2 Phase 9 |
| Intl.DateTimeFormat over date-fns/luxon | Zero new dependencies for locale-aware month names; `getLocalizedMonthName` with year-2000 seed | ✓ v1.2 Phase 11 |
| "vs." as locale-invariant loanword | German keeps "vs." prefix (not "ggü.") — matches informal tone, consistent with existing DE strings | ✓ v1.2 Phase 11 |
| No manual comparison mode toggle | Default driven by filter scope (short→prev-period, year→prev-year); manual toggle deferred to v1.3+ | ✓ v1.2 (deliberate scope cut) |
| Fernet encryption for Personio credentials | Write-only API pattern — credentials encrypted at rest, never returned in GET responses | ✓ v1.3 Phase 12 |
| APScheduler in-process (not persistent) | In-memory scheduler under FastAPI lifespan; restart recovery sufficient for internal use | ✓ v1.3 Phase 13 |
| No time filter on HR tab | HR KPIs use rolling calendar month windows; user decided no preset bar needed | ✓ v1.3 Phase 15 (deliberate scope cut) |
| INTERVAL_OPTIONS inside component body | Must be inside function body so `t()` re-evaluates on language change | ✓ v1.3 Phase 16 |
| DateRangeContext for shared filter state | Lifts preset/range state from DashboardPage so SubHeader can read it; mirrors SettingsDraftContext pattern | ✓ v1.4 Phase 17 |
| Route-aware SubHeader freshness | HR tab shows sync freshness (last_synced_at), all others show upload freshness — users see domain-relevant timestamp | ✓ v1.4 Phase 17 |
| Sync button in Settings (not HR page) | User preference — HR page is for viewing KPIs, sync control belongs with Personio configuration | ✓ v1.4 Phase 17 |
| No SubHeader border (LAY-01 deviation) | User explicitly removed border-b for clean look; bg-card matches page background so border was nearly invisible anyway | ✓ v1.4 Phase 17 |
| SegmentedControl with primary color + outline | User changed active from bg-foreground to bg-primary, container from bg-muted to bg-background+border-primary during visual verification | ✓ v1.5 Phase 18 |
| Generic SegmentedControl<T extends string> | Single component serves all 5 consumers with type-safe value/onChange — no per-consumer variants needed | ✓ v1.5 Phase 18 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

Last updated: 2026-04-12

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
*Last updated: 2026-04-12 after v1.6 milestone started*
