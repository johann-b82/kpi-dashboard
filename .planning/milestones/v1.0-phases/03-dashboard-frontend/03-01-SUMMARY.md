---
phase: 03-dashboard-frontend
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, postgres, alembic, kpi, aggregation]

requires:
  - phase: 02-file-ingestion-pipeline
    provides: "sales_records and upload_batches tables populated via ERP upload pipeline"
provides:
  - "GET /api/kpis (total_revenue, avg_order_value, total_orders) with date range filters"
  - "GET /api/kpis/chart bucketed revenue points (daily/weekly/monthly) with date range filters"
  - "GET /api/kpis/latest-upload max(upload_batches.uploaded_at) or null"
  - "ix_sales_records_order_date B-tree index for date range query performance"
  - "KpiSummary, ChartPoint, LatestUploadResponse pydantic response models"
affects: [03-02-dashboard-frontend, 03-03-dashboard-frontend, 03-04-dashboard-frontend]

tech-stack:
  added: []
  patterns:
    - "FastAPI APIRouter with prefix=/api/kpis and tags=[kpis]"
    - "SQLAlchemy 2.0 async aggregation via func.sum/func.avg/func.count/func.date_trunc"
    - "Decimal|None coalescing to Decimal('0') for empty result sets"
    - "Literal['daily','weekly','monthly'] query enum + trunc_map to date_trunc string"

key-files:
  created:
    - backend/app/routers/kpis.py
    - backend/alembic/versions/phase3_order_date_index.py
  modified:
    - backend/app/schemas.py
    - backend/app/main.py

key-decisions:
  - "Zero-value orders excluded at the SQL level (WHERE total_value > 0) on both summary and chart endpoints — matches D-06/D-07/D-10 contract"
  - "order_date IS NOT NULL filter on chart endpoint prevents date_trunc(NULL) producing a null bucket group"
  - "LatestUploadResponse.uploaded_at is datetime | None; empty DB returns {uploaded_at: null} (no 404)"
  - "func.date_trunc first arg is a plain string ('day'|'week'|'month'); PostgreSQL casts Date input internally"
  - "Alembic migration a1b2c3d4e5f6 chained from d7547428d885 (phase 2 full sales schema) is the sole schema mutation path"

patterns-established:
  - "Aggregation router pattern: prefix+tags APIRouter with AsyncSession dependency, func.* aggregations, Decimal coalescing"
  - "Query-enum pattern: Literal[...] + Query(default) + local lookup dict to map to SQL function argument"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

duration: 93s
completed: 2026-04-11
---

# Phase 3 Plan 01: Backend KPI Query API Summary

**Three async aggregation endpoints (summary, chart, latest-upload) backed by sales_records/upload_batches with a new order_date B-tree index.**

## Performance

- **Duration:** 93s
- **Started:** 2026-04-11T06:30:21Z
- **Completed:** 2026-04-11T06:31:54Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Three new KPI read endpoints available under `/api/kpis` prefix, all returning HTTP 200 against live data
- Verified against the existing Phase 2 dataset: `/api/kpis` returns 93 orders totaling 793,913.75 with avg 8,536.71; `/api/kpis/chart?granularity=monthly` returns 7 non-empty monthly buckets
- `ix_sales_records_order_date` B-tree index created in PostgreSQL via Alembic migration `a1b2c3d4e5f6`
- Pydantic v2 response contracts (KpiSummary, ChartPoint, LatestUploadResponse) added and importable
- FastAPI app wires the new router without regressions to existing `/api/upload` and `/api/uploads` endpoints

## Task Commits

1. **Task 1: KPI schemas + order_date index migration** — `15927d2` (feat)
2. **Task 2: KPI router with three endpoints + main.py wiring** — `d3a1bf3` (feat)

## Files Created/Modified

- `backend/app/schemas.py` (modified) — added `Decimal` import and `KpiSummary`, `ChartPoint`, `LatestUploadResponse` models
- `backend/alembic/versions/phase3_order_date_index.py` (created) — revision `a1b2c3d4e5f6`, down_revision `d7547428d885`; upgrade creates `ix_sales_records_order_date`, downgrade drops it
- `backend/app/routers/kpis.py` (created) — APIRouter(prefix="/api/kpis"); `GET ""`, `GET "/chart"`, `GET "/latest-upload"`
- `backend/app/main.py` (modified) — imports `kpis_router` and calls `app.include_router(kpis_router)` after the uploads include

## Endpoint Contracts

```
GET /api/kpis?start_date=&end_date=
→ 200 { total_revenue: Decimal, avg_order_value: Decimal, total_orders: int }

GET /api/kpis/chart?start_date=&end_date=&granularity=daily|weekly|monthly
→ 200 [ { date: "YYYY-MM-DD", revenue: Decimal }, ... ]

GET /api/kpis/latest-upload
→ 200 { uploaded_at: datetime | null }
```

All SQL paths apply `WHERE total_value > 0`. Chart endpoint additionally filters `order_date IS NOT NULL`. Date range filters are applied only when provided (`None` = unbounded).

## Curl Verification (live)

```
$ curl -s http://localhost:8000/api/kpis
{"total_revenue":"793913.75","avg_order_value":"8536.7069892473118280","total_orders":93}   HTTP 200

$ curl -s 'http://localhost:8000/api/kpis/chart?granularity=monthly'
[{"date":"2026-01-01","revenue":"168038.06"},
 {"date":"2026-02-01","revenue":"418349.87"},
 {"date":"2026-03-01","revenue":"178069.28"},
 {"date":"2026-04-01","revenue":"88.50"},
 {"date":"2026-10-01","revenue":"850.22"},
 {"date":"2026-11-01","revenue":"6946.27"},
 {"date":"2026-12-01","revenue":"21571.55"}]   HTTP 200

$ curl -s http://localhost:8000/api/kpis/latest-upload
{"uploaded_at":"2026-04-10T20:40:21.817126Z"}   HTTP 200
```

Database index check:

```
$ docker compose exec db psql -U kpi_user -d kpi_db -c "\di ix_sales_records_order_date"
 Schema |            Name             | Type  |  Owner   |     Table
--------+-----------------------------+-------+----------+---------------
 public | ix_sales_records_order_date | index | kpi_user | sales_records
```

Alembic upgrade log:
```
INFO  [alembic.runtime.migration] Running upgrade d7547428d885 -> a1b2c3d4e5f6, phase3 order_date index
```

No tracebacks in `docker compose logs api`; existing `/health`, `/api/upload`, `/api/uploads` endpoints unaffected.

## Decisions Made

None beyond the plan — all Key Decisions in frontmatter were pre-specified in the PLAN. The implementation matched the plan byte-for-byte.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Parallel agent (plan 03-02) began hitting `/api/kpis/latest-upload` as soon as the api service restarted, which confirmed end-to-end reachability from the `frontend` container over the Docker network (no CORS/proxy issues).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frontend plans 03-02/03/04 can immediately consume the three endpoints via the `/api` Vite proxy
- Response contracts are stable and documented; Decimal is serialized as JSON string per Pydantic v2 default (frontend must parse with Number/BigDecimal as appropriate)
- Index in place for production scan performance on date-range queries

## Self-Check: PASSED

- Found: `backend/app/routers/kpis.py`
- Found: `backend/alembic/versions/phase3_order_date_index.py`
- Found: `backend/app/schemas.py` (modified with KpiSummary/ChartPoint/LatestUploadResponse)
- Found: `backend/app/main.py` (include_router(kpis_router) wired)
- Found commit: `15927d2` (Task 1)
- Found commit: `d3a1bf3` (Task 2)
- Live endpoints return HTTP 200 (verified via curl)
- DB index `ix_sales_records_order_date` exists (verified via psql)

---
*Phase: 03-dashboard-frontend*
*Completed: 2026-04-11*
