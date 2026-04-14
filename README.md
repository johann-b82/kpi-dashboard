# KPI Light

A Dockerized multi-domain KPI platform with Sales and HR dashboards. Uploads tab-delimited ERP export files into PostgreSQL for Sales KPIs, and syncs Personio HR data for HR KPIs — all visualized on a bilingual (DE/EN) interactive dashboard with dark mode. Built for internal team use.

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

---

## Quickstart

```bash
# One-time (per machine)
brew install mkcert nss          # macOS — or: apt install libnss3-tools + mkcert binary
mkcert -install
echo "127.0.0.1 kpi.internal wiki.internal auth.internal" | sudo tee -a /etc/hosts

# Per checkout
cp .env.example .env
./scripts/generate-certs.sh
docker compose up --build -d
```

Then open <http://localhost:81> to finish the one-time NPM proxy-host setup. Full walkthrough — including SSL cert upload, proxy-host field values, and troubleshooting — lives in [docs/setup.md](docs/setup.md).

### Prerequisites

- Docker and Docker Compose v2
- [mkcert](https://github.com/FiloSottile/mkcert) (locally-trusted dev CA for the green padlock on `https://kpi.internal`)
- A modern browser

Details: [docs/setup.md](docs/setup.md).

### Hostnames

| Hostname                 | Serves                                     | Since     |
| ------------------------ | ------------------------------------------ | --------- |
| `https://kpi.internal`   | KPI Light frontend + `/api/*`              | Phase 26  |
| `https://wiki.internal`  | Outline wiki (placeholder until Phase 29)  | Phase 29  |
| `https://auth.internal`  | Dex OIDC (placeholder until Phase 27)      | Phase 27  |

### Documentation

Setup runbook: [docs/setup.md](docs/setup.md). Architecture and planning history live in `.planning/`.

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

## Detailed Setup

For a first-run walkthrough including mkcert, `/etc/hosts`, and NPM proxy-host bootstrap, see [docs/setup.md](docs/setup.md).

Once the stack is up and NPM is configured, the app is reached at:

- **Dashboard:** https://kpi.internal
- **API:** https://kpi.internal/api/* (single origin, proxied by NPM)
- **OpenAPI docs:** https://kpi.internal/api/docs
- **NPM admin UI:** http://localhost:81 (proxy-host configuration, not for day-to-day use)

The direct `:5173` and `:8000` host ports are commented-out debug hatches in `docker-compose.yml` — uncomment a single line to bypass NPM if needed during debugging.

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
  +-- db       (postgres:17-alpine)                 --> internal :5432
  +-- migrate  (alembic upgrade head)               --> exits after migration
  +-- api      (uvicorn + FastAPI)                  --> internal :8000
  +-- frontend (vite dev server)                    --> internal :5173
  +-- npm      (jc21/nginx-proxy-manager:2.11.3)    --> host :80/:443/:81
                  |
                  +-- https://kpi.internal   --> frontend:5173 (+ /api --> api:8000)
                  +-- https://wiki.internal  --> placeholder (Outline in Phase 29)
                  +-- https://auth.internal  --> placeholder (Dex in Phase 27)
```

Boot order is healthcheck-gated: `db → migrate → api → frontend → npm`. Each service waits for the previous one to be healthy before starting, which closes the 502 window on cold boot.

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
│       │   ├── settings/        # PersonioCard, CheckboxList, HrTargetsCard, ColorPicker, LogoUpload, ActionBar
│       │   ├── NavBar.tsx, ThemeProvider.tsx, DropZone.tsx
│       │   └── ui/              # shadcn primitives (checkbox, segmented-control, etc.)
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

| Version | Date | Description |
|---------|------|-------------|
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
