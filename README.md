# KPI

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files into PostgreSQL for Sales KPIs, and syncs Personio HR data for HR KPIs -- all visualized on a bilingual (DE/EN) interactive dashboard. Built for internal team use.

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard -- zero friction from raw data to insight.

---

## Features

### Sales Dashboard
- **KPI Cards** -- Total revenue, average order value, total orders with dual delta badges (vs. prev month + vs. prev year)
- **Revenue Chart** -- Monthly bar or area chart with prior-period overlay; X-axis shows month names or calendar weeks depending on selected date range
- **Sales Data Table** -- Sortable columns (order #, customer, project, date, total, remaining) with global search
- **Date Range Filter** -- This month, this quarter, this year, all time (fixed SubHeader below navbar)

### HR Dashboard
- **5 HR KPI Cards** -- Overtime ratio, sick leave ratio, fluctuation, skill development, revenue per production employee; each with dual delta badges
- **12-Month Trend Charts** -- Area or bar charts (toggle) for overtime, sick leave, fluctuation, revenue/employee with configurable target reference lines (Sollwerte)
- **Employee Table** -- Filtered by departments selected in Personio settings; shows total worked hours, overtime hours, and overtime ratio per employee for the current month
- **Employee Filters** -- Segmented toggle: with overtime / active / all

### Settings
- **Branding** -- 6 semantic color tokens (oklch), logo upload (SVG/PNG/JPG/WebP), app name
- **Personio Integration** -- Fernet-encrypted API credentials, configurable sync interval (manual/1h/6h/24h), auto-sync via APScheduler
- **Multi-Select Config** -- Checkbox lists for sick leave absence types, production departments, and skill attribute keys
- **HR KPI Targets** -- Set target values (Sollwerte) displayed as dashed reference lines on HR trend charts
- **Language** -- DE/EN toggle stored in localStorage (no server round-trip)

### General
- **Bilingual** -- Full DE/EN i18n parity with informal "du" tone for German
- **Theming** -- Settings-driven color palette applied via CSS custom properties; chart colors follow primary/muted tokens
- **Context-Aware Navigation** -- Sales/HR segmented toggle on dashboard pages, back arrow on Settings and Upload pages
- **Auto-Refresh** -- Dashboard re-fetches all queries after successful upload via TanStack Query prefix invalidation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 17 (Alpine) |
| Backend | FastAPI, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2 |
| Migrations | Alembic |
| Parsing | pandas 3.0 with German locale handling |
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4, shadcn/ui (base-ui primitives) |
| Routing | wouter |
| Charts | Recharts |
| State | TanStack Query v5 |
| i18n | react-i18next (flat dotted keys, `keySeparator: false`) |
| Scheduler | APScheduler (in-process) |
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
│   │   │   └── sync.py          # Personio sync trigger + meta
│   │   └── services/
│   │       ├── kpi_aggregation.py
│   │       └── hr_kpi_aggregation.py
│   ├── alembic/                 # Migration chain
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/               # DashboardPage, HRPage, UploadPage, SettingsPage
│       ├── components/
│       │   ├── dashboard/       # KpiCard, RevenueChart, HrKpiCharts, SalesTable, EmployeeTable
│       │   ├── settings/        # PersonioCard, CheckboxList, HrTargetsCard, ColorPicker
│       │   └── ui/              # shadcn primitives (checkbox, segmented-control, etc.)
│       ├── hooks/               # useSettings, useSettingsDraft, useTableState
│       ├── lib/                 # api.ts, queryKeys.ts, dateUtils.ts, defaults.ts
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

---

## Database Migrations

Migrations run automatically via the `migrate` compose service on `docker compose up`. To generate a new migration:

```bash
docker compose exec api alembic revision --autogenerate -m "describe change"
docker compose build migrate
docker compose up migrate
```

> **Important:** Never call `Base.metadata.create_all()` -- always go through Alembic.

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

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v1.8 | 2026-04-12 | Employee table: worked hours, overtime ratio, department filter, active/all toggle |
| v1.7 | 2026-04-12 | Data tables, HR KPI 12-month trend charts, chart colors from settings, area charts, UI polish |
| v1.6 | 2026-04-12 | Multi-select checkbox lists for Personio config, JSONB array migration, language moved to localStorage |
| v1.5 | 2026-04-12 | Unified pill-shaped segmented controls across all toggles |
| v1.4 | 2026-04-12 | Navbar polish, SubHeader with route-aware freshness indicator |
| v1.3 | 2026-04-12 | HR KPI dashboard, Personio integration with encrypted credentials, auto-sync |
| v1.2 | 2026-04-12 | Period-over-period delta badges, chart prior-period overlay |
| v1.1 | 2026-04-11 | Branding, settings page, ThemeProvider, i18n bootstrap |
| v1.0 | 2026-04-11 | MVP -- Docker stack, ERP file upload, sales dashboard |

---

## License

Internal tool -- not currently licensed for external distribution.
