# Roadmap: ACM KPI Light

**Created:** 2026-04-10
**Milestone:** v1
**Granularity:** Coarse
**Coverage:** 13/13 requirements mapped

---

## Phases

- [ ] **Phase 1: Infrastructure and Schema** - Running Docker Compose stack with correct schema, migrations, and startup ordering
- [ ] **Phase 2: File Ingestion Pipeline** - End-to-end file upload, parsing, validation, and database storage with history
- [ ] **Phase 3: Dashboard Frontend** - KPI query API and interactive React dashboard with all visualizations

---

## Phase Details

### Phase 1: Infrastructure and Schema
**Goal**: The full Docker Compose stack runs reliably with a correct, future-proof database schema
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts both containers (db + api) without error, in the correct order
  2. The database is accessible from the API container and persists data across restarts
  3. Alembic migrations run cleanly and produce the upload_batches and sales_records tables with TIMESTAMPTZ date columns and the UNIQUE constraint on the natural business key
  4. Stopping and restarting the stack does not destroy data (named volume confirmed working)
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Create project scaffold, Docker infrastructure, FastAPI app, models, and Alembic setup
- [ ] 01-02-PLAN.md — Bring up Docker stack, generate initial migration, verify end-to-end

### Phase 2: File Ingestion Pipeline
**Goal**: Users can upload CSV, TXT, and Excel files and see them parsed, stored, and listed in upload history
**Depends on**: Phase 1
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, MGMT-01
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or browse to select a CSV, TXT, or Excel file and see a progress indicator during upload
  2. A valid file is parsed and its rows appear in the database; the upload history list shows filename, timestamp, row count, and status
  3. An invalid file type is immediately rejected with a clear error message naming the unsupported format
  4. A file with malformed data produces an actionable error message identifying the specific row and column that failed
**Plans**: TBD

### Phase 3: Dashboard Frontend
**Goal**: Users can view interactive KPI visualizations of all uploaded data and filter by date range
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, INFR-03
**Success Criteria** (what must be TRUE):
  1. Dashboard displays summary metric cards for total revenue, average order value, and total orders, populated from real database data
  2. Dashboard displays a time-series chart showing revenue over time
  3. User can filter the dashboard by a date range and the cards and chart update to reflect the selected period
  4. Dashboard shows a data freshness indicator with the timestamp of the most recent upload
  5. After a successful upload, the dashboard automatically refreshes to reflect the new data without a manual page reload
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure and Schema | 0/2 | Planning complete | - |
| 2. File Ingestion Pipeline | 0/? | Not started | - |
| 3. Dashboard Frontend | 0/? | Not started | - |
