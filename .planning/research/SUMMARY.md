# Project Research Summary

**Project:** ACM KPI Light — Dockerized KPI Dashboard with File Upload to PostgreSQL
**Domain:** Internal sales/revenue KPI dashboard with CSV/Excel ingestion
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

ACM KPI Light is a fixed-schema internal dashboard for visualizing sales/revenue KPIs from uploaded CSV, TXT, and Excel files. Research across all four areas (stack, features, architecture, pitfalls) converges on a well-established pattern: a three-tier architecture (React SPA → FastAPI → PostgreSQL), all running in a single Docker Compose stack with no background workers, message queues, or external storage. The correct build order — infrastructure first, file parser second, API third, frontend last — is dictated by hard component dependencies and is reinforced by where the highest-risk logic lives (the file parser, which must handle Excel quirks, encoding edge cases, and date corruption).

The recommended approach is synchronous in-memory file parsing (pandas + openpyxl), bulk insert into PostgreSQL, and SQL-side aggregation for KPI queries. The frontend does no computation — it consumes structured JSON from the API and renders with Recharts. This keeps each layer testable in isolation. The fixed schema (known columns) is a significant simplifier: it eliminates column-mapping UI, reduces validation complexity to checking column presence and type, and makes error messages actionable. Do not introduce dynamic schema detection; it undermines every simplification the fixed schema provides.

The three highest-impact risks are: (1) Docker Compose startup race condition — the API container crashes before PostgreSQL is ready unless a healthcheck with `condition: service_healthy` is used; (2) duplicate row ingestion on re-upload — without a natural unique key and `INSERT ... ON CONFLICT DO NOTHING`, re-uploading the same file silently doubles all revenue totals; and (3) datetime/timezone corruption from Excel and CSV sources — using bare `TIMESTAMP` instead of `TIMESTAMPTZ`, or not explicitly parsing date columns with pandas, produces silent NULL rows and wrong trend charts. All three must be addressed at the schema design stage, not patched later.

---

## Key Findings

### Recommended Stack

The stack is fully async Python on the backend with a static React SPA on the frontend — no server-side rendering, no background workers. All versions verified against PyPI and npm registries as of 2026-04-10.

**Core technologies:**

- **FastAPI 0.135.3** — REST API and file upload endpoint; native async; built-in UploadFile for multipart forms; automatic OpenAPI docs
- **SQLAlchemy 2.0.49 + asyncpg 0.31.0** — async ORM + PostgreSQL driver; use AsyncSession + create_async_engine; do NOT mix 1.x sync patterns
- **Alembic 1.18.4** — schema migrations; requires a separate sync engine config in alembic.ini; never use Base.metadata.create_all()
- **pandas 3.0.2 + openpyxl 3.1.5** — unified file parsing for CSV, TXT, and Excel; both are runtime (not dev) dependencies
- **PostgreSQL 17-alpine** — use this exact tag; do not use latest
- **React 19.2.5 + TypeScript + Vite 8.0.8** — SPA with HMR; no Next.js (no SSR requirement, adds complexity with zero benefit)
- **Recharts 3.8.1** — SVG-based, React-native charting; more control than Tremor, better React integration than Chart.js
- **TanStack Query 5.97.0** — server state management for API calls; replaces useEffect + useState boilerplate; do NOT use Redux for server state
- **Tailwind CSS 4.2.2** — note v4 uses CSS-first config (no tailwind.config.js); breaking change from v3 docs
- **shadcn/ui** — copy-paste component primitives for KPI cards, upload form, history table; no package version to manage

Critical: python-multipart==0.0.26 is a hard runtime requirement for FastAPI file uploads — not optional.

### Expected Features

**Must have (table stakes):**
- Drag-and-drop upload zone with "Browse" button fallback
- Client-side format enforcement (CSV, TXT, XLSX, XLS only) with immediate rejection
- Upload progress indicator (progress bar, not just a spinner)
- Actionable parse error messages specifying row/column and reason
- Upload success confirmation showing rows inserted, filename, timestamp
- Summary metric cards: total revenue, average order value, total orders, date range covered
- Time-series line/bar chart: revenue over time (minimum one chart)
- Upload history list: filename, timestamp, row count, status
- Data freshness indicator on dashboard header
- Responsive desktop-first layout (1280px+ viewport)

**Should have (recommended for v1):**
- Chart type toggle (line vs bar) — 1 hour of effort, visible polish signal
- Date range filter — transforms dashboard from static report to interactive tool

**Defer to v2+:**
- Per-upload drill-down, duplicate upload detection, inline parse preview
- Export filtered data as CSV, upload deletion/rollback
- Metric cards with period-over-period delta
- Authentication and RBAC (Authentik/OIDC planned for v2)
- Scheduled auto-ingestion, mobile layout, multi-tenant views

**Anti-features — do not build in v1:**
- Dynamic schema detection or column mapping UI
- Authentication (no-op middleware stub only)
- AI/NL query interface, custom chart builder, notifications, mobile-optimized layout

### Architecture Approach

Three-tier: React SPA → FastAPI backend → PostgreSQL, all in one Docker Compose stack. Files are parsed in-memory (bytes → DataFrame → DB rows), never stored on disk or in the database as blobs. KPI aggregation happens in SQL (SUM, AVG, GROUP BY with date truncation), not in Python or JavaScript. Two tables from day one: upload_batches (audit log with file hash, row count, status) and sales_records (parsed rows linked to their upload via upload_id foreign key). The upload_id linkage enables future rollback without a schema migration.

**Major components:**

1. **Frontend UI (React + Vite)** — upload form, dashboard rendering, history table; no business logic, no computation
2. **API Layer (FastAPI)** — thin routing, request validation, response shaping; delegates to parser and DB layer
3. **File Parser (pandas + openpyxl)** — accepts UploadFile bytes, returns validated DataFrame or structured error list; unit-testable without DB or HTTP server
4. **DB Layer (SQLAlchemy 2.0 async + Alembic)** — schema, migrations, queries; bulk insert via executemany; aggregation queries shaped for API response
5. **PostgreSQL 17-alpine** — durable storage; upload_batches + sales_records; index on order_date for range queries
6. **Docker Compose** — orchestrates three services; named volume for Postgres persistence; healthcheck-gated startup order

### Critical Pitfalls

1. **Docker Compose startup race condition** — add a pg_isready healthcheck to the db service and use condition: service_healthy on the API's depends_on. Do this before writing any application code.

2. **Duplicate rows on re-upload** — define a natural business key, add a UNIQUE constraint, and use INSERT ... ON CONFLICT DO NOTHING. Design idempotency before the first row hits the database.

3. **Datetime/timezone corruption** — use TIMESTAMPTZ (never bare TIMESTAMP) for all date columns; explicitly parse date columns with pd.to_datetime() at ingest; normalize to UTC; reject files where date parsing fails. Choose correctly on day one — cannot change without a migration.

4. **PostgreSQL data loss on docker compose down** — use a named volume mounted to exactly /var/lib/postgresql/data (not the parent directory); declare in top-level volumes:; never run docker compose down -v in production.

5. **Stale dashboard data after upload** — after a successful upload, explicitly trigger TanStack Query invalidateQueries for dashboard data. Design the upload-success → dashboard-refresh flow together.

**Moderate pitfalls (Phase 2):**
- Windows CSV UTF-8 BOM: use encoding='utf-8-sig'; auto-detect TXT delimiters with sep=None, engine='python'
- Excel engine mismatch: use openpyxl explicitly for .xlsx; install xlrd for .xls or accept .xlsx only
- No file size limit causes OOM: enforce 50MB hard limit before parsing

**Minor pitfalls (stub now):**
- No auth middleware hook — add no-op middleware and nullable uploaded_by column so Authentik can wire in v2 without a cross-cutting rewrite
- No audit linkage — upload_id FK on sales_records required from day one; retrofitting requires migration and backfill

---

## Implications for Roadmap

Research is unambiguous about build order: infrastructure and schema must be solid before any application logic, the file parser is the highest-risk component and should be validated early, API routes before frontend, upload flow before dashboard display.

### Phase 1: Infrastructure and Schema Foundation

**Rationale:** Everything depends on the database being reachable and the schema being correct. Pitfalls 1, 2, 4, 9, and 11 all require decisions at this stage — they cannot be patched later without migrations or rewrites.

**Delivers:** Running Docker Compose stack (db + api + frontend services); Postgres with upload_batches and sales_records tables via Alembic migration; named volume; healthcheck startup ordering; no-op auth middleware stub; nullable uploaded_by column; TIMESTAMPTZ on all date fields; UNIQUE constraint on natural business key.

**Avoids:** Pitfall 1 (startup race), Pitfall 2 (data loss), Pitfall 4 (wrong timestamp type), Pitfall 9 (missing audit linkage), Pitfall 11 (auth retrofit).

**Research flag:** Standard patterns — no additional research needed. Official Docker and Alembic docs are sufficient.

### Phase 2: File Ingestion Pipeline

**Rationale:** The file parser is the highest-risk component. It must be built and validated with real sample data before API routes and frontend are connected. Edge cases are easier to catch with unit tests than through the full HTTP stack.

**Delivers:** FastAPI POST /upload endpoint; pandas/openpyxl parser supporting CSV, TXT (delimiter auto-detected), XLSX, XLS; schema validation (column presence and types); explicit date parsing with pd.to_datetime(), UTC normalization; utf-8-sig encoding with latin-1 fallback; INSERT ... ON CONFLICT DO NOTHING bulk insert; hard 50MB file size limit; upload_batches record written before rows, status updated on failure; structured error response; formula/injection stripping from cell values.

**Uses:** FastAPI UploadFile, pandas 3.0.2, openpyxl 3.1.5, asyncpg, SQLAlchemy 2.0 AsyncSession.

**Avoids:** Pitfall 3 (duplicates), Pitfall 4 (datetime), Pitfall 5 (encoding), Pitfall 6 (Excel engine), Pitfall 7 (OOM), Pitfall 10 (formula injection).

**Research flag:** Needs phase research — Excel datetime parsing edge cases, composite UNIQUE key design for the specific data schema, and pandas behavior with mixed date formats. Real sample files are essential inputs before implementation.

### Phase 3: KPI Query API

**Rationale:** Dashboard query endpoints depend on real data existing in the database (upload pipeline must work first). These are low-risk — SQL aggregation patterns are well-understood — but must be designed to match the frontend's data contract before the frontend is built.

**Delivers:** GET /kpis?from=&to= returning {summary_cards: {total_revenue, avg_order_value, total_orders, date_range}, time_series: [{date, revenue}]}; GET /uploads returning history ordered by timestamp DESC; date-range filtering via query params; all aggregation in PostgreSQL (SUM, AVG, GROUP BY DATE_TRUNC); index on order_date confirmed active.

**Research flag:** Standard patterns — PostgreSQL aggregation and date truncation are well-documented. No additional research needed.

### Phase 4: Upload UI and Dashboard Frontend

**Rationale:** Frontend is built last because it depends on stable API contracts. Upload UI and dashboard are built together because they share the upload-success → dashboard-refresh concern (Pitfall 8) and must be designed as a single flow.

**Delivers:** React SPA with Vite; drag-and-drop upload zone with Browse fallback; client-side format and size validation; progress indicator; success/error state with row count; upload history table (shadcn/ui); summary KPI cards; time-series Recharts chart with line/bar toggle; date range filter controls; data freshness indicator; TanStack Query invalidateQueries after successful upload to force dashboard refresh.

**Addresses:** All table-stakes features from FEATURES.md; Pitfall 8 (stale data) via explicit refetch.

**Research flag:** Standard patterns. Tailwind v4 CSS-first config is the one area to verify against v4 docs specifically — v3 docs are misleading.

### Phase Ordering Rationale

- Schema before data: TIMESTAMPTZ, UNIQUE constraints, and upload_id FK cannot be added without migrations after data exists. Phase 1 locks these in.
- Parser before API routes: The parser is the highest-risk component and benefits from isolated unit testing. Connecting through HTTP before it is validated adds debugging noise.
- API before frontend: The frontend must consume real JSON shapes. Building against a mock risks divergence that requires frontend rewrites.
- Upload before dashboard: Dashboard KPI endpoints need real data to test; the upload pipeline must be end-to-end first.
- No background workers in any phase: Synchronous in-memory parsing is sufficient for internal sales file sizes (< 50MB); async job infrastructure is overengineering for v1.

### Research Flags

Needs deeper research during planning:
- **Phase 2 (File Parser):** Excel datetime parsing edge cases, composite UNIQUE key design for the specific schema, pandas behavior with mixed date formats. Real sample files are essential inputs before implementation.

Standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Docker Compose healthcheck, Alembic migrations, named volumes — official documentation is sufficient.
- **Phase 3 (KPI Query API):** PostgreSQL aggregation and date truncation are standard SQL with official documentation.
- **Phase 4 (Frontend):** React + Recharts + TanStack Query + shadcn/ui are well-documented. Verify Tailwind v4 CSS config against v4 docs specifically.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against PyPI and npm registries. Async pattern verified via official FastAPI + SQLAlchemy 2.0 docs. |
| Features | HIGH (table stakes), MEDIUM (differentiators) | Table stakes from well-established file-upload and dashboard UX research. Differentiator prioritization is domain-specific judgment. |
| Architecture | HIGH | Three-tier pattern is standard and verified. Exact column names depend on actual data spec (not yet confirmed). |
| Pitfalls | HIGH | All critical pitfalls verified via official docs (PostgreSQL wiki, Docker docs, GitHub pandas issues). |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact sales data schema (column names and types):** Research assumes order_date, revenue, order_id — but the actual file format from the ACM system is unknown. Must be confirmed with real sample data before Phase 2 begins. The UNIQUE constraint design and date parsing configuration both depend on this.
- **Expected file sizes and upload frequency:** Research assumes < 50MB, low frequency (manual on-demand upload). If files are larger or more frequent, bulk insert strategy and size limits need revisiting.
- **Recharts vs Tremor:** MEDIUM confidence — no single authoritative benchmark. Recommendation stands but can be revisited if Recharts styling proves cumbersome at this project size.
- **XLS support scope:** If the team only produces .xlsx files, xlrd and .xls handling can be dropped, simplifying Phase 2. Confirm with stakeholders before building .xls support.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official docs — UploadFile, request files: https://fastapi.tiangolo.com/tutorial/request-files/
- SQLAlchemy 2.0 async I/O docs: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- PostgreSQL wiki — TIMESTAMP vs TIMESTAMPTZ: https://wiki.postgresql.org/wiki/Don't_Do_This
- Docker Compose startup order official docs: https://docs.docker.com/compose/how-tos/startup-order/
- Docker Hub — postgres:17-alpine tag verified: https://hub.docker.com/_/postgres
- PyPI — all Python package versions verified: https://pypi.org
- npm registry — all frontend package versions verified: https://www.npmjs.com

### Secondary (MEDIUM confidence)
- Best React Chart Libraries 2025 — LogRocket: https://blog.logrocket.com/best-react-chart-libraries-2025/
- Vite vs Next.js 2025 — Strapi: https://strapi.io/blog/vite-vs-nextjs-2025-developer-framework-comparison
- File upload UX best practices — Uploadcare: https://uploadcare.com/blog/file-uploader-ux-best-practices/
- Sales dashboard KPI metrics — SimplekPI, Klipfolio, Improvado: https://www.simplekpi.com/Blog/best-kpi-dashboards-2026
- Authentik Docker Compose guide 2025: https://www.simplehomelab.com/authentik-docker-compose-guide-2025/
- CSV encoding / UTF-8 BOM handling: https://www.elysiate.com/blog/csv-encoding-problems-utf8-bom-character-issues
- Idempotent database inserts: https://dev.to/dnnsthnnr/idempotent-database-inserts-getting-it-right-2777
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

### Tertiary (for reference)
- GitHub pandas issues #39001, #47269, #59882 — openpyxl datetime and XML edge cases
- Martin Fowler — Audit Log pattern: https://martinfowler.com/eaaDev/AuditLog.html
- Fastest way to load data into PostgreSQL with Python: https://hakibenita.com/fast-load-data-python-postgresql

---

*Research completed: 2026-04-10*
*Ready for roadmap: yes*
