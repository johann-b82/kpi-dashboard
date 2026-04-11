# ACM KPI Light

A Dockerized web application for uploading sales/revenue data files into PostgreSQL and visualizing KPIs on an interactive dashboard. Built for internal team use.

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

---

## Features

- **File upload** — drag-and-drop CSV / TXT tab-delimited ERP exports, with row/column-level validation and actionable error messages
- **Bilingual UI** — German and English (DE/EN) across the whole app
- **Upload history** — filename, timestamp, row count, status badges, and safe delete with confirmation
- **Interactive dashboard**
  - KPI summary cards: total revenue, average order value, total orders
  - Time-series revenue chart with bar/line toggle (Recharts)
  - Date-range filter with presets (this month / quarter / year / all time) and a custom calendar popover
  - Data freshness indicator showing the timestamp of the latest upload
- **Auto-refresh** — after a successful upload, the dashboard re-fetches all queries via TanStack Query prefix invalidation

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI 0.135, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2, Alembic |
| **Database** | PostgreSQL 17 (alpine) |
| **Parsing** | pandas 3.0 with German locale handling |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui (base-ui), wouter |
| **Data fetching** | TanStack Query v5 |
| **Charts** | Recharts 3.8 |
| **i18n** | react-i18next (flat dotted keys, `keySeparator: false`) |
| **Infrastructure** | Docker Compose (db → migrate → api → frontend) |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- That's it — everything else runs in containers

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/johann-b82/kpi-dashboard.git
cd kpi-dashboard

# 2. Create your .env file from the template
cp .env.example .env
# (optional) edit .env and change POSTGRES_PASSWORD

# 3. Bring the stack up
docker compose up --build
```

Once containers are healthy:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **OpenAPI docs:** http://localhost:8000/docs

To stop the stack:

```bash
docker compose down
```

To stop and wipe the database volume:

```bash
docker compose down -v
```

---

## Project Structure

```
acm-kpi-light/
├── backend/                 # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── models.py        # SQLAlchemy models (upload_batches, sales_records)
│   │   ├── routers/         # /api/upload, /api/uploads, /api/kpis
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── alembic/             # Migration chain
│   └── requirements.txt
│
├── frontend/                # React 19 + Vite + Tailwind
│   └── src/
│       ├── pages/           # DashboardPage, UploadPage
│       ├── components/
│       │   ├── dashboard/   # KpiCard, RevenueChart, DateRangeFilter, FreshnessIndicator
│       │   ├── DropZone.tsx
│       │   └── ui/          # shadcn primitives
│       ├── lib/             # api.ts, queryKeys.ts, dateUtils.ts
│       └── locales/         # en.json, de.json
│
├── docker-compose.yml       # db → migrate → api → frontend
├── .env.example
└── .planning/               # GSD planning history, retrospective, milestone archives
```

---

## Usage

1. Open http://localhost:5173
2. Navigate to the **Upload** page
3. Drag a CSV or TXT tab-delimited ERP export onto the drop zone (or click to browse)
4. Wait for parsing to complete — successes appear in the Upload History; malformed rows get an inline row/column error list
5. Switch to the **Dashboard** page
6. Pick a date range preset (or use the custom calendar popover) — KPI cards and the revenue chart update instantly
7. Upload another file — the dashboard auto-refreshes without a manual reload

---

## Database Migrations

Migrations run automatically via the `migrate` compose service on `docker compose up`. To generate a new migration during development:

```bash
docker compose exec api alembic revision --autogenerate -m "describe change"
docker compose build migrate     # rebuild so migrate picks up the new file
docker compose up migrate        # apply it
```

> **Important:** Never call `Base.metadata.create_all()` — always go through Alembic so migration history stays consistent.

---

## Development

The compose stack mounts `./backend` and `./frontend` as volumes, so:

- **Backend:** `uvicorn --reload` picks up Python changes automatically
- **Frontend:** Vite HMR picks up React/TypeScript changes automatically

To run a one-off command inside a container:

```bash
docker compose exec api python -c "..."           # backend shell commands
docker compose exec frontend npx tsc --noEmit      # type-check frontend
docker compose exec db psql -U acm_user -d acm_kpi # database shell
```

---

## Roadmap

- **v1.0 MVP** ✅ — shipped 2026-04-11 (Docker stack, ingestion pipeline, dashboard)
- **v1.1** 📋 — not yet scoped. Candidates: Authentik OIDC integration, period-over-period deltas, CSV export, duplicate upload detection, per-upload drill-down

See [.planning/ROADMAP.md](.planning/ROADMAP.md) and [.planning/milestones/](.planning/milestones/) for full milestone history, and [.planning/RETROSPECTIVE.md](.planning/RETROSPECTIVE.md) for lessons learned.

---

## License

Internal tool — not currently licensed for external distribution.
