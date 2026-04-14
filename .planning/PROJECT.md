# KPI Light

## What This Is

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files (38-column sales data) into PostgreSQL for Sales KPIs, and syncs Personio HR data (employees, attendances, absences) for 5 HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight. **Validated in v1.0:** real ERP export (93 orders, €793k) → dashboard in under a minute, auto-refreshing on upload.

## Current Milestone: v1.9 Dark Mode & Contrast

**Goal:** Add dark mode with navbar toggle and optimize contrast across all UI surfaces.

**Target features:**
- Dark mode theme with proper background, text, card, and border colors
- Two-way segmented control (Light/Dark) in navbar next to DE/EN toggle
- System preference detection — defaults to OS setting, user can override
- User preference persisted in localStorage (same pattern as language)
- Contrast optimization — verify WCAG AA on all text/background combos
- Brand accent color stays the same in both modes, only surface colors change
- Charts (Recharts) and all shadcn/ui components adapt to dark mode

## Current State

**Shipped:** v1.8 — 2026-04-12
**In progress:** v1.9 — Dark Mode & Contrast
**Stack:** PostgreSQL 17 + FastAPI (async SQLAlchemy 2.0 + asyncpg) + React 19/Vite 8, all Dockerized via compose with Alembic migration service. Recharts chart overlay, react-i18next with full DE/EN parity, Intl.DateTimeFormat for locale-aware month names, APScheduler for periodic Personio sync.
**Codebase:** ~10,000 LOC (Python + TypeScript), 8 versions shipped (v1.0–v1.8).
**Audit status:** All v1.0–v1.6 requirements satisfied.

## Shipped: v1.6 Multi-Select HR Criteria (2026-04-12)

All 3 Personio config fields converted from single-select dropdowns to multi-select checkbox lists. Database columns migrated to JSONB arrays via Alembic. HR KPI aggregation uses IN/OR filters. Reusable CheckboxList component with scrollable container, loading/empty/disabled states. Language preference moved from database to localStorage.

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

### Validated in v1.9 (in progress)

- ✓ DM-05: Dark mode toggle visible in navbar — Phase 22 (shipped as single sun/moon icon button, deviation from segmented control approved during UAT)
- ✓ DM-06: OS prefers-color-scheme drives initial theme + live-tracks until first user click — Phase 22
- ✓ DM-07: localStorage.theme persists user choice across reloads and overrides OS preference — Phase 22
- ✓ DM-08: DE/EN i18n keys for theme toggle (aria-label Theme/Farbschema) — Phase 22

### Validated in v1.6

- ✓ MIG-01: Database migration converts 3 Personio config columns to JSON array columns — v1.6
- ✓ API-01: Settings GET/PUT endpoints accept and return arrays — v1.6
- ✓ API-02: Personio options endpoint returns absence types, departments, and skill attributes — v1.6
- ✓ KPI-01..04: HR KPI aggregation uses IN/OR filters for multi-value support — v1.6
- ✓ UI-01: PersonioCard renders checkbox lists instead of select dropdowns — v1.6
- ✓ UI-02: Checkbox state persists correctly through save/reload cycle — v1.6
- ✓ UI-03: All checkbox list labels display correctly in both DE and EN — v1.6

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
| shadcn wraps @base-ui/react (not Radix) | Project's shadcn registry uses base-ui primitives — use `render` prop, not `asChild` | ✓ Phase 3 |
| JSONB arrays for multi-select config | Alembic CASE-WHEN migration preserves existing values; `or []` normalization at read time | ✓ v1.6 Phase 19 |
| Language in localStorage (not DB) | Language is a per-browser preference, not shared state; eliminates API round-trip on switch | ✓ v1.6 Phase 20 |
| Reusable CheckboxList component | Single component serves all 3 Personio config fields with consistent UX | ✓ v1.6 Phase 20 |

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
*Last updated: 2026-04-14 after Phase 22 (dark mode toggle) completion*
