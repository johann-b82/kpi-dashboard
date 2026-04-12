# KPI Light

## What This Is

A Dockerized web application for uploading tab-delimited ERP export files (38-column sales data) into PostgreSQL and visualizing revenue KPIs on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current State

**Shipped:** v1.2 Period-over-Period Deltas — 2026-04-12 (v1.1 shipped 2026-04-11, v1.0 same day)
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8, all Dockerized via compose with Alembic migration service. Recharts chart overlay, react-i18next with full DE/EN parity (119 keys), Intl.DateTimeFormat for locale-aware month names.
**Scope delivered in v1.2:** dual delta badges on all 3 KPI cards (vs. Vorperiode + vs. Vorjahr), ghosted amber prior-period chart overlay, contextual period labels via Intl.DateTimeFormat (month names, quarter tags), full DE/EN i18n parity for all v1.2 strings, persistent locale parity check script, em-dash fallback for no-baseline cases (allTime, thisYear prev-period), live language switch re-renders without refresh.
**Audit status:** 13/13 v1.0 + 17/17 v1.1 + v1.2 requirements I18N-DELTA-01/02 satisfied. v1.2 human walkthrough (4 presets × 2 languages) approved.

## Current Milestone: v1.2 Period-over-Period Deltas

**Goal:** Show at-a-glance growth signals on the dashboard — each summary card gains two delta badges (vs. previous period + vs. prior year), and the chart gains a ghosted prior-period overlay.

**Target features:**
- Backend `summary` + `chart` endpoints return current values plus *two* baselines: same-length window immediately before + calendar-matched prior year. Null-safe.
- All 3 summary cards (revenue, AOV, orders) render dual delta badges — `▲ +12,4 %` (vs. Vorperiode) and `▲ +8,1 %` (vs. Vorjahr) below the value, colored via existing semantic tokens (green positive, destructive negative, grayscale em-dash for no-baseline).
- Delta labels are contextual to the selected date range: "vs. März" for "Dieses Jahr", "vs. Q1" for "Dieses Quartal", etc.
- Chart gains a ghosted (low-opacity) prior-period series — second `Line`/`Bar` layer, legend updates, default baseline is "vs. Vorperiode".
- Zero-baseline / first-month-of-data / "Gesamter Zeitraum" all show `—` (no bogus ∞% or +100%).
- Full DE/EN i18n for new strings, informal "du" tone continued.

**Key context:**
- Extends v1.0 dashboard (Phases 2–3) — existing async aggregation endpoints (`summary`, `chart`, `latest-upload`) expand in-place; not a rewrite.
- "Gesamter Zeitraum" is a graceful-degradation case: no prior window exists, so deltas render `—`.
- Two deltas per card adds ~1 vertical line — card layout needs absorb spacing without breaking responsive grid.
- "vs. Vorjahr" needs ≥12 months of data; fresh installs display `—` until data ages in. Expected, not a bug.
- Chart overlay is a second data series, not a recolor — TanStack Query response shape changes, Recharts composition updates.
- Still pre-auth — deltas are global, matching v1.0/v1.1 model.

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
*Last updated: 2026-04-12 — Phase 11 (i18n Contextual Labels & Polish) complete — v1.2 milestone approved*
