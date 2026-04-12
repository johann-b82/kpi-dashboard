# KPI Light

## What This Is

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files (38-column sales data) into PostgreSQL for Sales KPIs, and syncs Personio HR data (employees, attendances, absences) for 5 HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current State

**Shipped:** v1.3 HR KPI Dashboard & Personio-Integration — 2026-04-12
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8, all Dockerized via compose with Alembic migration service. Recharts chart overlay, react-i18next with full DE/EN parity (164 keys), Intl.DateTimeFormat for locale-aware month names, APScheduler for periodic Personio sync.
**Codebase:** ~9,700 LOC (Python + TypeScript), 27 source files added/modified in v1.3, 4 milestones shipped (v1.0–v1.3).
**Audit status:** 13/13 v1.0 + 17/17 v1.1 + v1.2 requirements + 20/20 v1.3 requirements satisfied. v1.3 milestone audit passed (20/20 requirements, 4/4 cross-phase integrations, 4/4 E2E flows).

## Shipped: v1.3 HR KPI Dashboard & Personio-Integration (2026-04-12)

Multi-domain KPI platform — Sales tab (renamed from Dashboard) + new HR tab with 5 KPI cards (overtime ratio, sick leave ratio, fluctuation, skill development, revenue/employee), dual delta badges, Personio API integration with Fernet-encrypted credentials, configurable auto-sync (APScheduler), Settings UI with live-populated dropdowns for absence types and departments, full DE/EN i18n parity (164 keys).

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
*Last updated: 2026-04-12 — v1.3 HR KPI Dashboard & Personio-Integration milestone shipped*
