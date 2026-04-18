# KPI

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files into PostgreSQL for Sales KPIs, and syncs Personio HR data for HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard with dark mode. Built for internal team use.

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

---

## Features

### Sales Dashboard
- **KPI Cards** — Total revenue, average order value, total orders with concrete period-over-period delta badges (e.g. `vs. March 2025`, `vs. Q1 2025`, `vs. 2024`)
- **Revenue Chart** — Monthly bar or area chart with prior-period overlay; X-axis shows month names or calendar weeks depending on selected date range
- **Sales Data Table** — Sortable columns (order #, customer, project, date, total, remaining) with global search
- **Date Range Filter** — This month, this quarter, this year, all time (fixed SubHeader below navbar)

### HR Dashboard
- **5 HR KPI Cards** — Overtime ratio, sick leave ratio, fluctuation, skill development, revenue per production employee; each with concrete delta badges matching the Sales ramp
- **12-Month Trend Charts** — Area or bar charts (toggle) for overtime, sick leave, fluctuation, revenue/employee with configurable target reference lines (Sollwerte)
- **Employee Table** — Filtered by departments selected in Personio settings; shows total worked hours, overtime hours, and overtime ratio per employee for the current month
- **Employee Filters** — Segmented toggle: with overtime / active / all

### Settings
- **Appearance** — App name, logo upload (SVG/PNG/JPG/WebP), 6 semantic color tokens (oklch) with live WCAG contrast badges
- **Personio Integration** — Fernet-encrypted API credentials, configurable sync interval (manual/1h/6h/24h), auto-sync via APScheduler, credential test, on-demand refresh
- **Multi-Select Config** — Checkbox lists for sick leave absence types, production departments, and skill attribute keys
- **HR KPI Targets** — Set target values (Sollwerte) displayed as dashed reference lines on HR trend charts
- **Language** — DE/EN toggle stored in localStorage (no server round-trip)
- **Dark Mode** — Sun/moon toggle in navbar; OS `prefers-color-scheme` default + localStorage override; pre-hydration IIFE avoids flash-of-unstyled-content

### App Launcher
- **iOS-style entry point at `/`** — After login, users land on a grid of app icons rather than directly in a dashboard; dashboards live at `/sales`, `/hr`, and `/sensors`
- **Active KPI Dashboard tile** — Rounded-corner 120×120px card with icon only; label sits below the tile (iOS-style); click navigates to `/sales`
- **Sensors tile** — Admin-only environmental monitoring dashboard with live temperature/humidity readings from SNMP devices
- **Coming-soon placeholders** — Greyed tiles (40% opacity, non-clickable) for future apps
- **Role-aware scaffold** — Admin-only tiles can be added without structural changes; Viewer-role users see only tiles without the `admin` flag
- **Minimal launcher chrome** — Header on `/` shows brand (clickable → launcher), theme toggle, language toggle, settings gear, and sign-out; dashboard-scoped controls (SALES/HR toggle, docs, upload) appear only on dashboard routes

### Sensor Monitoring (v1.15+)
- **Live Sensor Dashboard** — KPI cards per sensor with current temperature/humidity, threshold-aware badges, stacked time-series charts with reference lines
- **Time-Window Selector** — View 1h, 6h, 24h, 7d, or 30d windows on sensor readings with gap-aware rendering
- **Poll-Now Button** — Trigger immediate sensor poll with live refresh of cards and charts; includes delta badges vs. 1h and 24h ago
- **Health Status Chip** — Per-sensor "OK since Xh" or "Offline since X min" indicator computed from SNMP poll log
- **Admin Settings Sub-Page** — `/settings/sensors` for CRUD operations on sensors, polling interval tuning, global temperature/humidity thresholds
- **SNMP Walk Tool** — OID discovery utility for network sensor enumeration; click-to-assign discovered OIDs to sensor fields
- **SNMP Probe Button** — Per-sensor connectivity validation with live temperature/humidity test result
- **Encrypted Community Strings** — Fernet-encrypted at rest, write-only secrets (never displayed post-save, shown as `••••••`)
- **Bilingual Admin Guide** — Complete operational runbook (DE/EN) with onboarding workflows, threshold configuration, polling interval tuning, and Docker network troubleshooting

### In-App Documentation
- **Role-Aware Docs** — Library icon in navbar opens /docs; Admins see User Guide + Admin Guide sections, Viewers see User Guide only
- **User Guide** — 5 articles: uploading data, Sales dashboard, HR dashboard, filters & controls, language & dark mode
- **Admin Guide** — 4 articles: system setup (Docker Compose), architecture overview, Personio integration, user management (Directus roles)
- **Bilingual Content** — All 22 articles available in DE and EN, switching with the app's language setting
- **Markdown Rendering** — react-markdown + rehype plugins for syntax-highlighted code blocks, clickable heading anchors, and dark-mode-aware prose
- **Table of Contents** — Auto-generated from article headings with Intersection Observer scroll tracking

### General
- **Bilingual** — Full DE/EN i18n parity with informal "du" tone for German
- **Theming** — Settings-driven color palette applied via CSS custom properties; chart colors follow primary/muted tokens; class-strategy dark mode via Tailwind v4
- **Unified Layout** — Sales, HR, Upload, and Settings share the same `max-w-7xl` page container; contextual back button remembers the last visited dashboard (Sales or HR)
- **Context-Aware Navigation** — Sales/HR segmented toggle on dashboard pages; labeled back button on Settings and Upload
- **Auto-Refresh** — Dashboard re-fetches all queries after successful upload or Personio sync via TanStack Query prefix invalidation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 17 (Alpine) |
| Backend | FastAPI, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2 |
| Migrations | Alembic |
| Parsing | pandas 3.0 with German locale handling |
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4 (class-strategy dark mode), shadcn/ui (base-ui primitives) |
| Routing | wouter |
| Charts | Recharts |
| State | TanStack Query v5 |
| i18n | react-i18next (flat dotted keys, `keySeparator: false`) |
| Scheduler | APScheduler (in-process) |
| External | Personio API (employees, attendances, absences) |
| Infrastructure | Docker Compose v2 |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/johann-b82/kpi-dashboard.git
cd kpi-dashboard

# 2. Create your .env file from the template
cp .env.example .env
# Edit .env with your credentials

# 3. Bring the stack up
docker compose up --build
```

Once containers are healthy:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **OpenAPI docs:** http://localhost:8000/docs

### Prerequisites

- Docker and Docker Compose v2
- Personio API credentials (optional, for HR features)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | Database name |
| `FERNET_KEY` | Encryption key for Personio credentials |

---

## Architecture

```
docker compose up
  |
  +-- db       (postgres:17-alpine)           --> internal :5432
  +-- migrate  (alembic upgrade head)         --> exits after migration
  +-- api      (uvicorn + FastAPI)            --> :8000
  +-- frontend (vite dev server)              --> :5173 (proxies /api to :8000)
```

### Project Structure

```
kpi-light/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── defaults.py          # Canonical default settings
│   │   ├── routers/
│   │   │   ├── uploads.py       # File upload, upload history
│   │   │   ├── kpis.py          # Sales KPI aggregation + chart
│   │   │   ├── hr_kpis.py       # HR KPI current + 12-month history
│   │   │   ├── data.py          # Raw data listing (sales records, employees)
│   │   │   ├── settings.py      # App settings + Personio options
│   │   │   ├── sync.py          # Personio sync trigger + meta
│   │   │   └── sensors.py       # Sensor CRUD, SNMP probe/walk, polling endpoints
│   │   └── services/
│   │       ├── kpi_aggregation.py
│   │       ├── hr_kpi_aggregation.py
│   │       └── snmp_poller.py   # SNMP polling, walk, probe utilities
│   ├── alembic/                 # Migration chain
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/               # LauncherPage, DashboardPage, HRPage, SensorsPage, UploadPage, SettingsPage, SensorsSettingsPage, DocsPage
│       ├── components/
│       │   ├── dashboard/       # KpiCard, RevenueChart, HrKpiCharts, SalesTable, EmployeeTable
│       │   ├── sensors/         # SensorStatusCards, SensorTimeSeriesChart, PollNowButton
│       │   ├── docs/            # MarkdownRenderer, DocsSidebar, TableOfContents
│       │   ├── settings/        # PersonioCard, CheckboxList, HrTargetsCard, ColorPicker, LogoUpload, ActionBar, SensorRowForm, PollIntervalCard, ThresholdCard, SnmpWalkCard, SensorProbeButton
│       │   ├── NavBar.tsx, ThemeProvider.tsx, DropZone.tsx
│       │   └── ui/              # shadcn primitives (checkbox, segmented-control, etc.)
│       ├── docs/                # Markdown articles (en/ and de/ subdirectories)
│       ├── hooks/               # useSettings, useSettingsDraft, useTableState, useUnsavedGuard
│       ├── lib/                 # api.ts, queryKeys.ts, color.ts, dateUtils.ts, defaults.ts
│       └── locales/             # en.json, de.json
│
├── docker-compose.yml
├── .env.example
└── .planning/                   # GSD planning artifacts and milestone archives
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | App settings (colors, branding, Personio config, KPI targets) |
| PUT | `/api/settings` | Update settings |
| POST | `/api/settings/logo` | Upload logo |
| GET | `/api/settings/personio-options` | Available absence types, departments, skill attributes |
| POST | `/api/upload` | Upload ERP sales file |
| GET | `/api/uploads` | List upload batches |
| DELETE | `/api/uploads/{id}` | Delete upload batch |
| GET | `/api/kpis` | Sales KPI summary with comparison periods |
| GET | `/api/kpis/chart` | Sales chart data (monthly, with prior-period overlay) |
| GET | `/api/kpis/latest-upload` | Latest upload timestamp |
| GET | `/api/hr/kpis` | HR KPI values (current month + comparisons) |
| GET | `/api/hr/kpis/history` | HR KPI 12-month history for trend charts |
| GET | `/api/data/sales` | Sales records listing (filterable by date, customer, search) |
| GET | `/api/data/employees` | Employee listing with overtime hours for current month |
| POST | `/api/sync` | Trigger Personio data sync |
| POST | `/api/sync/test` | Test Personio credential validity |
| GET | `/api/sync/meta` | Last sync status and counts |
| GET | `/api/sensors` | List all sensors (admin-only) |
| POST | `/api/sensors` | Create a new sensor (admin-only) |
| PATCH | `/api/sensors/{id}` | Update sensor config (admin-only) |
| DELETE | `/api/sensors/{id}` | Delete sensor (admin-only) |
| GET | `/api/sensors/{id}/readings` | Sensor reading history (filterable by hours window) |
| GET | `/api/sensors/status` | Sensor health status from poll log (admin-only) |
| POST | `/api/sensors/poll-now` | Trigger immediate poll of all sensors (admin-only) |
| POST | `/api/sensors/snmp-probe` | Test SNMP connectivity with config (admin-only) |
| POST | `/api/sensors/snmp-walk` | Discover OIDs on network with SNMP walk (admin-only) |

---

## Database Migrations

Migrations run automatically via the `migrate` compose service on `docker compose up`. To generate a new migration:

```bash
docker compose exec api alembic revision --autogenerate -m "describe change"
docker compose build migrate
docker compose up migrate
```

> **Important:** Never call `Base.metadata.create_all()` — always go through Alembic.

---

## Development

The compose stack mounts `./backend` and `./frontend` as volumes:

- **Backend:** `uvicorn --reload` picks up Python changes automatically
- **Frontend:** Vite HMR picks up React/TypeScript changes automatically

```bash
docker compose exec api python -c "..."            # backend commands
docker compose exec frontend npx tsc --noEmit       # type-check frontend
docker compose exec db psql -U kpi_user -d kpi_db   # database shell
```

---

## Testing

### Backend unit/integration tests

```bash
docker compose exec api pytest
```

### End-to-end rebuild persistence smoke test

Prereq (one-shot, after any `@playwright/test` version bump):
```bash
cd frontend && npx playwright install chromium
```

Run the full rebuild persistence harness (seeds settings, rebuilds the stack, asserts persistence, visual check via Playwright):
```bash
./scripts/smoke-rebuild.sh
```

Exits 0 on success; non-zero and prints the failing step on failure. The harness preserves `postgres_data` (it uses `docker compose down`, NOT `down -v`).

---

## Version History

<details>
<summary><strong>v1.11-directus</strong> — 2026-04-15 — Auth + RBAC via self-hosted Directus</summary>

### What changed

- **Added: Directus 11 container.** A single `directus/directus:11` service runs alongside the existing Postgres, providing email/password login, two built-in roles (`Admin`, `Viewer`), and an admin UI at `http://localhost:8055` for user management. FastAPI verifies the Directus-issued JWT (HS256 shared secret) on every `/api/*` request; mutation routes require `Admin`, read routes are open to both roles.
- **Added: nightly `pg_dump` backup sidecar.** A `backup` service in `docker-compose.yml` dumps the database nightly at 02:00 local time to `./backups/kpi-YYYY-MM-DD.sql.gz`, with 14-day rolling retention. A positional-arg `./scripts/restore.sh <dump-file>` streams a dump back into the running `db` container.
- **Added: `docs/setup.md`.** A linear bring-up tutorial for first-time operators, including the Viewer→Admin promote click-path and the backup/restore procedure.

### What was rejected

- **Dex + oauth2-proxy + NPM auth_request** (Phase 32, previous attempt) — abandoned. Three moving parts to configure (Dex provider, oauth2-proxy sidecar, NGINX Proxy Manager auth_request directive) to get one sign-in page. Preserved on branch `archive/v1.12-phase32-abandoned` for reference only.
- **Supabase** — evaluated, rejected. Full Supabase is a 5-service stack (Postgres, Auth, PostgREST, Realtime, Studio) when the project only needs sign-in and role assignment. Directus delivers the same outcome in one container on the existing database.

### What was dropped

- **Outline wiki** — removed from the stack entirely. The earlier v1.11/v1.12 plan was to share SSO between KPI Light and Outline via Dex. With Dex gone, the Outline use case is out of scope for this milestone. Existing Outline content (if any was deployed) is unaffected at the data level but no longer managed by this repo.

### Impact for users

- First-time login: browse to `/login`, enter email + password.
- Viewer users see the dashboards but no upload/sync/save controls — those are admin-only and are hidden from the DOM entirely, not just disabled.
- Administrators manage users via Directus at `http://localhost:8055`.

</details>

| Version | Date | Description |
|---------|------|-------------|
| v1.15 | 2026-04-18 | Sensor Monitor — Live SNMP temperature/humidity readings with KPI cards, time-series charts, admin settings sub-page, SNMP walk/probe tools, encrypted community strings, bilingual admin guide |
| v1.14 | 2026-04-17 | App Launcher — iOS-style `/` entry point with 4-tile grid, role-aware scaffold, bilingual labels, AuthGate post-login redirect |
| v1.13 | 2026-04-17 | In-App Documentation — role-aware docs with Markdown rendering, 22 bilingual articles, TOC with scroll tracking |
| v1.12 | 2026-04-16 | Chart Polish & Rebrand — year-aware x-axis labels, gap-filled month spines, "KPI Dashboard" rebrand, login page restyling |
| v1.11-directus | 2026-04-15 | Auth + RBAC via self-hosted Directus; nightly pg_dump backups; Outline wiki and Dex/oauth2-proxy path dropped |
| v1.10 | 2026-04-14 | UI Consistency Pass — unified delta labeling (concrete period names, DE/EN parity) + page layout parity across Sales/HR/Upload/Settings; merged Appearance card; contextual back button |
| v1.9 | 2026-04-14 | Dark Mode & Contrast — Tailwind v4 class-strategy dark mode, CSS-variable tokens, WCAG AA audit, no theme-flash pre-hydration IIFE |
| v1.8 | 2026-04-12 | Employee table: worked hours, overtime ratio, department filter, active/all toggle |
| v1.7 | 2026-04-12 | Data tables, HR KPI 12-month trend charts, chart colors from settings, area charts, UI polish |
| v1.6 | 2026-04-12 | Multi-select checkbox lists for Personio config, JSONB array migration, language moved to localStorage |
| v1.5 | 2026-04-12 | Unified pill-shaped segmented controls across all toggles |
| v1.4 | 2026-04-12 | Navbar polish, SubHeader with route-aware freshness indicator |
| v1.3 | 2026-04-12 | HR KPI dashboard, Personio integration with encrypted credentials, auto-sync |
| v1.2 | 2026-04-12 | Period-over-period delta badges, chart prior-period overlay |
| v1.1 | 2026-04-11 | Branding, settings page, ThemeProvider, i18n bootstrap |
| v1.0 | 2026-04-11 | MVP — Docker stack, ERP file upload, sales dashboard |

---

## License

Internal tool — not currently licensed for external distribution.
