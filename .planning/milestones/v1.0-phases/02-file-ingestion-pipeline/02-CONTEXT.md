# Phase 2: File Ingestion Pipeline - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete file upload pipeline: a FastAPI endpoint that accepts tab-delimited ERP export files (.csv/.txt), parses all 38 columns with German locale handling, validates rows, stores them in PostgreSQL, and tracks upload history. Includes a React frontend with drag-and-drop upload, inline error display, upload history with delete capability, and a bilingual (DE/EN) UI. Adds the frontend Docker container to the Compose stack.

</domain>

<decisions>
## Implementation Decisions

### Data Schema
- **D-01:** Store all 38 columns from the ERP export — full mirror, no column filtering. This preserves future flexibility for new KPIs without re-uploading.
- **D-02:** Column names in DB are English snake_case (e.g., `order_number`, `order_date`, `customer_id`, `customer_name`, `city`, `remaining_value`, `total_value`, `delivery_date`). A mapping layer translates German headers to English DB columns.
- **D-03:** `order_number` (Auftrag) is the UNIQUE business key. Use `INSERT ... ON CONFLICT (order_number) DO NOTHING` for idempotent re-uploads.
- **D-04:** Monetary columns (`remaining_value`/Restwert, `total_value`/Gesamtwert) stored as `NUMERIC` — exact decimal, no floating-point rounding.
- **D-05:** Store all rows including zero-value orders (Gesamtwert = 0). Filtering for KPI calculations deferred to Phase 3 dashboard.
- **D-06:** German number format parsing: strip thousands separator (`.`), replace decimal comma (`,`) with period. E.g., `2.230,43` -> `2230.43`.

### File Format
- **D-07:** Only .csv and .txt files accepted. No Excel (.xlsx/.xls) support needed — the ERP always exports tab-delimited. Drop openpyxl from dependencies.
- **D-08:** Tab-delimited with `="value"` quoting pattern. Strip `="..."` wrapper universally from all cells before type casting.
- **D-09:** Header row is always present and always identical. Use it for validation (column count and names) but don't rely on column order changing.
- **D-10:** German date format DD.MM.YYYY for date columns (Datum, Lieferdatum, Wunschdatum, Eintreffdatum).

### Validation
- **D-11:** Partial imports allowed. Valid rows are stored; invalid rows are skipped. Upload status = 'partial' when some rows fail, 'success' when all pass, 'failed' when all fail or file-level validation fails.
- **D-12:** Four validation checks: (1) wrong column count per row, (2) unparseable dates, (3) unparseable German decimal numbers, (4) missing/non-numeric Auftrag (order number).
- **D-13:** Validation errors displayed as inline scrollable list below upload zone. Each error shows row number, column name, and what went wrong. E.g., "Row 15, Datum: unparseable date '32.13.2026'".

### Upload UX
- **D-14:** Standalone `/upload` page with centered drag-and-drop zone + browse button. Upload history list below the drop zone on the same page.
- **D-15:** Single file upload only (one file per upload action).
- **D-16:** Indeterminate spinner during upload/parsing (no percentage progress bar). Synchronous in-memory parsing — files are small enough.
- **D-17:** On success: toast notification with filename and row count, upload history list refreshes automatically.
- **D-18:** Bilingual UI with language toggle (German + English). Requires a simple i18n setup for UI labels, buttons, messages. Data content stays as-is (German).

### Upload History
- **D-19:** History table shows: filename, uploaded_at timestamp, row count, status (success/partial/failed), error count (number of skipped rows).
- **D-20:** Delete functionality: delete button per upload entry, confirmation dialog ("Delete upload X and its N rows?"), removes batch record and all associated sales_record rows from DB.

### Infrastructure
- **D-21:** Add frontend (Vite + React) Docker container to docker-compose.yml in this phase. Phase 3 builds on an already-working frontend container.
- **D-22:** Alembic migration replaces Phase 1 placeholder columns with actual 38-column schema based on the sample data file.

### Claude's Discretion
- Exact i18n library choice (react-i18next, custom context, etc.)
- Toast notification library/implementation
- Drag-and-drop library choice (native HTML5 vs. react-dropzone)
- Upload history table pagination (if needed) or infinite scroll
- Exact mapping of all 38 German column names to English snake_case
- Error count storage (column on upload_batches vs. computed from skipped rows)
- Frontend project scaffold details (Vite template, folder structure)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Documentation
- `.planning/PROJECT.md` -- Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` -- UPLD-01 through UPLD-05 (file upload), MGMT-01 (upload history)
- `.planning/ROADMAP.md` -- Phase 2 success criteria (4 criteria)
- `CLAUDE.md` -- Technology stack with exact versions, Docker Compose patterns, async patterns

### Phase 1 Artifacts
- `.planning/phases/01-infrastructure-and-schema/01-CONTEXT.md` -- Phase 1 decisions (Docker topology, project structure, migration patterns)
- `backend/app/models.py` -- Current placeholder schema (SalesRecord with col_a/col_b/col_c to be replaced)
- `backend/app/database.py` -- Async engine setup, session factory
- `backend/app/main.py` -- FastAPI app with health endpoint
- `docker-compose.yml` -- Current 3-service setup (db, migrate, api)

### Sample Data
- The sample data file provided during this discussion defines the 38-column schema. Key format details: tab-delimited, `="..."` quoting, German dates (DD.MM.YYYY), German decimals (1.234,56), 38 columns per row.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/database.py`: AsyncSession factory + engine — reuse for upload endpoint DB operations
- `backend/app/models.py`: UploadBatch model already has filename, uploaded_at, row_count, status columns — extend with error_count
- `docker-compose.yml`: Three-service pattern (db -> migrate -> api) — extend with frontend service

### Established Patterns
- SQLAlchemy 2.0 async with asyncpg — all new queries must use AsyncSession
- Alembic for all schema changes — never use create_all()
- Migration service container pattern — new migration for schema change runs before API starts
- Volume mount for backend live reload — same pattern for frontend dev server

### Integration Points
- `backend/app/main.py`: New `/api/upload` POST endpoint and `/api/uploads` GET endpoint (history) added here or in a router
- `docker-compose.yml`: Frontend service added with Vite dev server, port mapping, volume mount
- `backend/requirements.txt`: Add pandas (for parsing) — openpyxl NOT needed
- Frontend connects to API at `http://api:8000` (Docker internal) or via proxy config

</code_context>

<specifics>
## Specific Ideas

- The `="..."` quoting pattern is common in German ERP exports (SAP-style) — parser must handle this as the primary format, not as an edge case
- Some rows have empty Lieferdatum/Wunschdatum/Eintreffdatum — date columns must be nullable
- Some rows have different Restwert vs Gesamtwert (e.g., row 1024725: Restwert=884.05, Gesamtwert=3616.04) — both are stored independently
- Verantwortlich column contains person names (ZETTLER, GOMES, SCHMIDT) — useful for future filtering
- Projekt column contains rich order references (e.g., "4501124676/A350/CCRC/MSN821/8-Bett") — store as text, potential for future parsing
- The second column (unnamed, contains "isign_warning" or empty) appears to be a status flag from the ERP

</specifics>

<deferred>
## Deferred Ideas

- **Upload deletion/rollback** is listed as UPLD-08 in v2, but user chose to include basic delete in v1 Phase 2. UPLD-08 may still cover more advanced rollback features.
- No other scope creep occurred during discussion.

</deferred>

---

*Phase: 02-file-ingestion-pipeline*
*Context gathered: 2026-04-10*
