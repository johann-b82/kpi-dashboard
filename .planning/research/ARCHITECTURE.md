# Architecture Patterns

**Domain:** Internal KPI dashboard with file upload and PostgreSQL
**Researched:** 2026-04-10

---

## Recommended Architecture

Three-tier: browser frontend → backend API → PostgreSQL. All services in a single Docker Compose stack. No message queue, no background workers — keep it synchronous for v1.

```
┌─────────────────────────────────────────────────────┐
│                   Browser                           │
│  Upload form │ Dashboard (charts, cards) │ History  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (REST / multipart)
┌─────────────────────▼───────────────────────────────┐
│               Backend API (app container)           │
│                                                     │
│  POST /upload    ──► File parser                    │
│                       (pandas + openpyxl)           │
│                       Row validation                │
│                       DB batch insert               │
│                                                     │
│  GET /kpis       ──► Aggregation queries            │
│  GET /uploads    ──► Upload history query           │
└─────────────────────┬───────────────────────────────┘
                      │ TCP 5432
┌─────────────────────▼───────────────────────────────┐
│            PostgreSQL (postgres container)          │
│                                                     │
│  sales_records   — parsed row data                  │
│  upload_batches  — upload history / audit log       │
└─────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Frontend UI** | Upload form, dashboard rendering, history list. No business logic. | Backend API over HTTP |
| **API Layer** | Route definitions, request validation, response shaping. Thin. | File parser, DB layer |
| **File Parser** | Accept UploadFile bytes → pandas DataFrame. Handles CSV, TXT (delimited), Excel (.xlsx/.xls). Returns clean rows + validation errors. | API Layer (called inline) |
| **DB Layer / ORM** | Schema definitions, queries, migrations. Wraps PostgreSQL. | PostgreSQL container |
| **PostgreSQL** | Durable storage of sales records and upload history. | API via ORM |
| **Docker Compose** | Orchestrates app + postgres containers, shared network, volume for Postgres data persistence. | N/A (infrastructure) |

### What the frontend does NOT own
- Parsing logic
- Validation rules
- KPI calculations (done in SQL or in API layer, not JS)

### What the backend does NOT own
- Rendering / chart generation (charts live in the browser using a charting lib)
- File storage (files are parsed in-memory and discarded; only rows persist)

---

## Data Flow

### Upload Path

```
1. User selects file in browser
2. Browser POSTs multipart/form-data to POST /upload
3. API receives UploadFile (in-memory bytes via FastAPI / equivalent)
4. File Parser detects type → reads with pandas (csv) or openpyxl (xlsx/xls)
5. Parser validates rows against known schema (column presence, types)
6. Valid rows bulk-inserted into sales_records
7. Upload metadata (filename, timestamp, row count, status) written to upload_batches
8. API returns {upload_id, rows_inserted, errors[]} to browser
9. Browser shows success/failure summary, refreshes upload history
```

### Dashboard Path

```
1. Browser loads dashboard page
2. Frontend requests GET /kpis?from=...&to=... (optional date filter)
3. API runs aggregation query against sales_records
   - Total revenue (SUM)
   - Avg order value (AVG)
   - Revenue by period (GROUP BY date trunc)
4. API returns structured JSON: { summary_cards: {...}, time_series: [...] }
5. Frontend renders summary cards + charts (no further computation client-side)
```

### History Path

```
1. Browser requests GET /uploads
2. API queries upload_batches ordered by uploaded_at DESC
3. Returns list: [{id, filename, uploaded_at, rows_inserted, status}]
4. Frontend renders history table
```

---

## Database Schema (Sketch)

### `upload_batches` — upload audit log

```sql
id            SERIAL PRIMARY KEY
filename      TEXT NOT NULL
uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
rows_inserted INTEGER NOT NULL
status        TEXT NOT NULL  -- 'success' | 'partial' | 'failed'
error_detail  TEXT           -- nullable, first N validation errors
```

### `sales_records` — the parsed data

```sql
id            SERIAL PRIMARY KEY
upload_id     INTEGER REFERENCES upload_batches(id)
-- known sales/revenue columns (exact names TBD from data spec):
order_date    DATE
revenue       NUMERIC(12,2)
-- ... other fixed-schema columns
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

Key index: `(order_date)` on `sales_records` for time-range aggregation queries.

The `upload_id` foreign key on every sales row enables:
- Tracing which upload produced which rows
- Future "undo upload" feature without schema changes

---

## Patterns to Follow

### Pattern 1: Parse in Memory, Discard File
Receive file bytes, parse to DataFrame, insert rows, drop the bytes. No file storage (S3, disk) needed. Keeps the system simple. Valid for files up to ~50MB in RAM — well above any internal sales report.

### Pattern 2: Bulk Insert via COPY or executemany
Do not insert rows one-at-a-time in a loop. Use batch insert (SQLAlchemy `bulk_insert_mappings`, `psycopg2 copy_from`, or equivalent). For typical sales file sizes (hundreds to low thousands of rows), executemany is fine; COPY is worth it above ~10k rows.

### Pattern 3: Upload Batch Record Written First
Write the `upload_batches` row before inserting sales records. On failure mid-insert, update status to 'failed'. This gives an honest audit trail even for partial/failed uploads and avoids orphan data.

### Pattern 4: KPI Aggregation in SQL
Run `SUM`, `AVG`, `GROUP BY` in PostgreSQL — not in Python and not in JavaScript. PostgreSQL handles this efficiently and the query stays close to the data. The API layer shapes the result into the JSON contract the frontend expects.

### Pattern 5: Date-Range Filtering via Query Parameters
`GET /kpis?from=2024-01-01&to=2024-12-31` — simple, stateless, easy to cache. Avoids complex frontend state management.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Raw Files in PostgreSQL
**What:** Saving file bytes as a BYTEA/LargeObject column.
**Why bad:** Balloons database size, makes backup/restore slow, provides no query value.
**Instead:** Parse immediately, store rows only.

### Anti-Pattern 2: Computing KPIs in JavaScript
**What:** Fetching all raw rows to the browser and aggregating in JS.
**Why bad:** Slow for any non-trivial dataset, poor UX, wastes bandwidth.
**Instead:** Aggregate in PostgreSQL, send summary JSON to browser.

### Anti-Pattern 3: Single Table for Everything
**What:** Storing parsed rows without an `upload_id` link or separate history table.
**Why bad:** No audit trail, no ability to trace data provenance, history feature requires extra work later.
**Instead:** `upload_batches` + `sales_records` from day one.

### Anti-Pattern 4: Synchronous Row-by-Row Insert in a Loop
**What:** `for row in df.iterrows(): db.execute(insert, row)`
**Why bad:** Hundreds of round-trips to Postgres for typical file. Slow, blocks the request.
**Instead:** Bulk insert (executemany or COPY).

---

## Build Order (Phase Dependencies)

The components have hard dependencies that dictate build order:

```
1. Infrastructure (Docker Compose + Postgres schema + migrations)
   └─ Everything else depends on the database being reachable

2. File Parser (pandas/openpyxl, schema validation, DataFrame → dicts)
   └─ Can be built and unit-tested without a running DB or HTTP server

3. Backend API — Upload endpoint
   └─ Depends on: Parser + DB layer

4. Backend API — KPI query endpoints
   └─ Depends on: DB with real data (need upload working first)

5. Frontend — Upload UI
   └─ Depends on: Upload API endpoint (or mock)

6. Frontend — Dashboard (summary cards + charts)
   └─ Depends on: KPI query API endpoints

7. Frontend — Upload History
   └─ Depends on: History query API endpoint
```

Build the parser and DB layer before the API routes. Build API routes before the frontend. The parser is the highest-risk component (file format edge cases) and should be built and validated early with real sample data.

---

## Docker Compose Structure

```yaml
services:
  app:
    build: .
    ports: ["8000:8000"]   # or 3000 for a Next.js fullstack approach
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://...

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ...

volumes:
  pgdata:
```

Single network (default Compose bridge). App connects to `db:5432`. No external port exposure for Postgres — internal only.

---

## Scalability Notes (for context, not v1 concern)

| Concern | v1 (internal, small team) | If scale needed later |
|---------|--------------------------|----------------------|
| Concurrent uploads | Single-threaded sync is fine | Add async processing + job queue |
| Large files (>100MB) | Not expected; in-memory parse works | Stream-parse, chunked insert |
| Many dashboard users | Single Postgres handles it | Add read replica |
| Auth | Out of scope v1 | Authentik OIDC in v2 |

---

## Sources

- FastAPI + PostgreSQL + Docker Compose pattern: https://www.travisluong.com/how-to-develop-a-full-stack-next-js-fastapi-postgresql-app-using-docker/
- FastAPI file upload (UploadFile + openpyxl): https://asiones.hashnode.dev/fastapi-receive-a-xlsx-file-and-read-it
- FastAPI + pandas CSV/Excel export/import: https://medium.com/@liamwr17/supercharge-your-apis-with-csv-and-excel-exports-fastapi-pandas-a371b2c8f030
- Audit log / upload history schema pattern: https://martinfowler.com/eaaDev/AuditLog.html
- File upload best practices (multipart, size, validation): https://oneuptime.com/blog/post/2026-02-02-rest-file-uploads/view
- ETL/ingestion best practices (staging, validation, lineage): https://www.integrate.io/blog/how-to-automate-csv-data-quality-in-real-time-2025/
- Docker Compose full-stack with Postgres: https://dev.to/whoffagents/docker-compose-for-full-stack-development-nextjs-postgres-redis-and-production-builds-57m8
