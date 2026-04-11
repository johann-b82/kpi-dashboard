# KPI Light

## What This Is

A Dockerized web application for uploading tab-delimited ERP export files (38-column sales data) into PostgreSQL and visualizing revenue KPIs on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current State

**Shipped:** v1.0 MVP — 2026-04-11
**In progress:** v1.1 Branding & Settings — Phase 06 complete (Settings page: color pickers, logo upload, live preview, save flow, unsaved-changes guard, WCAG contrast badges)
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8, all Dockerized via compose with Alembic migration service.
**Scale:** ~2,575 LOC across Python and TypeScript.
**Audit:** 13/13 v1.0 requirements satisfied; v1.1 backend SET-02/03/04 and BRAND-01/02/04/09 validated in Phase 4.

## Current Milestone: v1.1 Branding & Settings

**Goal:** Make the app's corporate identity (logo, colors, app name, default language) editable via a new Settings page so teams can brand KPI Light without touching code.

**Target features:**
- Settings page reachable from top-nav
- Full semantic color palette editable (primary, accent, background, foreground, muted, destructive) — maps to existing shadcn/Tailwind CSS variables
- Logo upload (PNG/SVG only, max 1 MB) — displayed 60×60 top-left, CSS-constrained
- Live preview + Save (theme applied instantly while editing; explicit Save persists)
- Editable app name/title (replaces "KPI Light" in header)
- Default UI language (DE/EN) — app-wide override of browser detection
- Postgres-backed settings (new table via Alembic; logo stored as bytea or file path)

**Key context:**
- Global single CI for the whole instance (no per-user scoping; matches v1.0 pre-auth model)
- Any user can edit (no admin gating — would pull forward Authentik work)

## Deferred to Later Milestones

- Authentik integration (AUTH-01, OIDC/OAuth2) — unblocks multi-app identity reuse
- Period-over-period deltas on KPI cards (DASH-06)
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

### Active (v1.1)

_(to be populated by REQUIREMENTS.md during this milestone)_

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
*Last updated: 2026-04-11 — Phase 4 (Backend Schema, API, Security) complete*
