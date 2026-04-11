# Phase 2: File Ingestion Pipeline - Research

**Researched:** 2026-04-10
**Domain:** FastAPI file upload, pandas parsing, React drag-and-drop, Vite Docker container, i18n
**Confidence:** HIGH

## Summary

Phase 2 delivers the complete file ingestion pipeline: a FastAPI upload endpoint that accepts tab-delimited ERP exports, parses 38 columns with German locale handling, stores rows in PostgreSQL using an idempotent upsert, and serves an upload history API. On the frontend, a React + Vite app provides drag-and-drop file selection, an indeterminate progress spinner, inline error display, a bilingual (DE/EN) toggle, and upload history with delete capability. The frontend Docker container is added to the Compose stack in this phase.

The primary parsing challenge is the `="..."` quoting pattern common in SAP-style ERP exports. pandas alone does not strip this wrapper; it must be applied as a post-read transformation before type casting. German number and date parsing are well-understood but require explicit processing (strip thousands separator, swap decimal comma, parse DD.MM.YYYY). All parsing failures must produce row-level error messages that identify column and value.

**Primary recommendation:** Use pandas `read_csv` with `sep='\t'` and `dtype=str` (read everything as strings first), then apply `="..."` stripping and German locale conversion as a pure-Python post-processing step before inserting into PostgreSQL. This gives full control over error localization and avoids pandas auto-cast surprises.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Schema**
- D-01: Store all 38 columns from the ERP export — full mirror, no column filtering.
- D-02: Column names in DB are English snake_case. A mapping layer translates German headers to English DB columns.
- D-03: `order_number` (Auftrag) is the UNIQUE business key. Use `INSERT ... ON CONFLICT (order_number) DO NOTHING` for idempotent re-uploads.
- D-04: Monetary columns stored as `NUMERIC` — exact decimal, no floating-point rounding.
- D-05: Store all rows including zero-value orders. Filtering deferred to Phase 3.
- D-06: German number format parsing: strip thousands separator (`.`), replace decimal comma (`,`) with period.

**File Format**
- D-07: Only .csv and .txt files accepted. No Excel support. Drop openpyxl.
- D-08: Tab-delimited with `="value"` quoting pattern. Strip `="..."` wrapper universally from all cells before type casting.
- D-09: Header row always present and always identical. Use for validation (column count and names).
- D-10: German date format DD.MM.YYYY for date columns (Datum, Lieferdatum, Wunschdatum, Eintreffdatum).

**Validation**
- D-11: Partial imports allowed. Valid rows stored; invalid rows skipped. Status = 'partial' / 'success' / 'failed'.
- D-12: Four validation checks: (1) wrong column count, (2) unparseable dates, (3) unparseable German decimal numbers, (4) missing/non-numeric Auftrag.
- D-13: Validation errors displayed as inline scrollable list. Each error shows row number, column name, and what went wrong.

**Upload UX**
- D-14: Standalone `/upload` page with centered drag-and-drop zone + browse button. Upload history list below.
- D-15: Single file upload only.
- D-16: Indeterminate spinner during upload/parsing. Synchronous in-memory parsing.
- D-17: On success: toast notification with filename and row count, upload history refreshes automatically.
- D-18: Bilingual UI (German + English) with language toggle. Data content stays as-is.

**Upload History**
- D-19: History table shows: filename, uploaded_at, row count, status, error count.
- D-20: Delete functionality with confirmation dialog, removes batch record and all associated sales_record rows.

**Infrastructure**
- D-21: Add frontend (Vite + React) Docker container to docker-compose.yml in this phase.
- D-22: Alembic migration replaces Phase 1 placeholder columns with actual 38-column schema.

### Claude's Discretion
- Exact i18n library choice (react-i18next, custom context, etc.)
- Toast notification library/implementation
- Drag-and-drop library choice (native HTML5 vs. react-dropzone)
- Upload history table pagination (if needed) or infinite scroll
- Exact mapping of all 38 German column names to English snake_case
- Error count storage (column on upload_batches vs. computed from skipped rows)
- Frontend project scaffold details (Vite template, folder structure)

### Deferred Ideas (OUT OF SCOPE)
- Advanced upload deletion/rollback (UPLD-08 v2)
- No other scope was deferred

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLD-01 | User can upload files via drag-and-drop zone or browse button | react-dropzone pattern documented; HTML5 drag-and-drop fallback available |
| UPLD-02 | System rejects non-supported file types with clear error message | FastAPI UploadFile content_type + filename extension validation pattern |
| UPLD-03 | Upload shows progress indicator during file processing | Indeterminate spinner (decided D-16); TanStack Query `isLoading` state drives display |
| UPLD-04 | System displays actionable parse error messages identifying row/column | Per-row error collection pattern with pandas dtype=str approach |
| UPLD-05 | Uploaded file data is parsed and stored in PostgreSQL with fixed schema | pandas tab-delimited parsing + SQLAlchemy 2.0 async bulk insert pattern |
| MGMT-01 | User can view upload history (filename, timestamp, row count, status) | FastAPI GET endpoint + TanStack Query + table component; delete with confirmation |
</phase_requirements>

---

## Standard Stack

### Core (Backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Upload endpoint, history endpoint | Already in use (Phase 1) |
| pandas | 3.0.2 | Parse tab-delimited files with dtype=str | Single library for all parsing; consistent API |
| SQLAlchemy | 2.0.49 | AsyncSession + bulk insert | Already in use (Phase 1) |
| asyncpg | 0.31.0 | Async PostgreSQL driver | Already in use (Phase 1) |
| Alembic | 1.18.4 | Schema migration (38-column) | Already in use (Phase 1) |
| python-multipart | 0.0.26 | UploadFile multipart parsing | Already installed; required by FastAPI |

### Core (Frontend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | UI framework | Specified in CLAUDE.md |
| TypeScript | 5.x (via Vite) | Type safety | Specified in CLAUDE.md |
| Vite | 8.0.8 | Build tool + dev server | Specified in CLAUDE.md |
| Tailwind CSS | 4.2.2 | Utility styling | Specified in CLAUDE.md |
| shadcn/ui | latest (copy-paste) | Cards, table, dialog, button | Specified in CLAUDE.md |
| Recharts | 3.8.1 | Not used in Phase 2, included for Phase 3 readiness | Specified in CLAUDE.md |
| @tanstack/react-query | 5.97.0 | Upload mutation + history data fetching | Specified in CLAUDE.md |

### Supporting (Claude's Discretion)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-i18next | 17.0.2 | DE/EN translation (i18n toggle, D-18) | Recommended: mature, zero-config for small apps |
| i18next | 26.0.4 | Core i18next engine (peer dep) | Required by react-i18next |
| sonner | 2.0.7 | Toast notifications (D-17) | Recommended: Tailwind-native, minimal API |
| react-dropzone | 15.0.0 | Drag-and-drop file zone (D-14) | Recommended: battle-tested, handles both drop and browse |

**Recommendation for discretion items:**
- **i18n:** Use react-i18next with a simple `locales/de.json` + `locales/en.json` structure. For a 2-language, ~30-string app this is the lowest-overhead approach — no build plugins needed, strings loaded synchronously at init.
- **Toast:** Use sonner — renders as a portal, integrates cleanly with Tailwind, 1-line usage `toast.success("Datei hochgeladen: ...")`.
- **Drag-and-drop:** Use react-dropzone — handles file type filtering (`accept` prop), single file constraint, and exposes `isDragActive` state for visual feedback. No native HTML5 drag event plumbing needed.
- **Error count:** Add `error_count` column to `upload_batches` table (not computed). Simpler query, no aggregate at read time.

**Installation (backend additions to requirements.txt):**
```bash
# Add to backend/requirements.txt
pandas==3.0.2
```
Note: openpyxl is NOT added (D-07 decision).

**Installation (frontend — run inside frontend/ directory):**
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @tanstack/react-query react-i18next i18next sonner react-dropzone
npm install recharts
npm install -D tailwindcss@4.2.2 @tailwindcss/vite
npx shadcn@latest init
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── main.py              # FastAPI app — add routers
├── routers/
│   └── uploads.py       # POST /api/upload, GET /api/uploads, DELETE /api/uploads/{id}
├── models.py            # Updated: UploadBatch (+ error_count), SalesRecord (38 cols)
├── database.py          # Unchanged — AsyncSession factory
├── schemas.py           # Pydantic response models for API
└── parsing/
    └── erp_parser.py    # Tab-delimited parse, ="..." stripping, German locale conversion

frontend/
├── Dockerfile           # Vite dev server container
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   └── UploadPage.tsx
│   ├── components/
│   │   ├── DropZone.tsx
│   │   ├── UploadHistory.tsx
│   │   ├── DeleteConfirmDialog.tsx
│   │   └── ErrorList.tsx
│   ├── lib/
│   │   └── api.ts       # Typed fetch wrappers for /api/* endpoints
│   └── locales/
│       ├── de.json
│       └── en.json
```

### Pattern 1: Synchronous In-Memory Parsing (Backend)

**What:** Read UploadFile bytes into `io.BytesIO`, parse with pandas `dtype=str`, strip `="..."`, convert types row-by-row, collect errors.
**When to use:** All file uploads in this phase (files are small; no background workers needed, D-16).

```python
# Source: FastAPI official docs + pandas docs
import io
import pandas as pd
from fastapi import UploadFile

async def parse_erp_file(file: UploadFile) -> tuple[list[dict], list[dict]]:
    contents = await file.read()
    df = pd.read_csv(
        io.BytesIO(contents),
        sep="\t",
        dtype=str,       # CRITICAL: read everything as string first
        keep_default_na=False,  # empty cells become "" not NaN
    )
    # Strip ="..." wrapper from all cells
    df = df.applymap(lambda x: x[2:-1] if isinstance(x, str) and x.startswith('="') and x.endswith('"') else x)
    # ... then per-row type casting with error collection
```

**Key detail:** `dtype=str` + `keep_default_na=False` prevents pandas from silently converting values and losing the original string for error reporting. `applymap` (pandas 3.x: `map`) applies cell-level transformation across entire DataFrame in one pass.

Note: In pandas 3.x, `applymap` is deprecated in favor of `DataFrame.map`. Use `df.map(...)` for the `="..."` stripping step.

### Pattern 2: Row-Level Validation with Error Collection

**What:** Iterate rows after stripping, apply four validation checks (D-12), collect errors keyed by `(row_number, column_name, message)`, separate valid rows from invalid.
**When to use:** After parsing, before any DB insert.

```python
# Collect errors, don't raise — partial imports allowed (D-11)
valid_rows = []
errors = []
for idx, row in df.iterrows():
    row_errors = validate_row(idx + 2, row)  # +2: 1-indexed + skip header
    if row_errors:
        errors.extend(row_errors)
    else:
        valid_rows.append(row_to_dict(row))
```

### Pattern 3: Bulk Insert with ON CONFLICT DO NOTHING

**What:** Insert valid rows using SQLAlchemy 2.0 async + PostgreSQL `INSERT ... ON CONFLICT (order_number) DO NOTHING`.
**When to use:** All sales record inserts (D-03).

```python
# Source: SQLAlchemy 2.0 docs — async bulk insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

async with AsyncSessionLocal() as session:
    stmt = pg_insert(SalesRecord).values(valid_rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["order_number"])
    await session.execute(stmt)
    await session.commit()
```

### Pattern 4: TanStack Query Mutation + Cache Invalidation

**What:** Use `useMutation` for the upload POST, invalidate `["uploads"]` query key on success so history table refreshes automatically (D-17).
**When to use:** Upload action from DropZone component.

```typescript
// Source: TanStack Query v5 docs
const queryClient = useQueryClient();
const uploadMutation = useMutation({
  mutationFn: (file: File) => uploadFile(file),
  onSuccess: (data) => {
    toast.success(`${data.filename}: ${data.row_count} rows`);
    queryClient.invalidateQueries({ queryKey: ["uploads"] });
  },
  onError: (error) => {
    // show inline error list from error.response.errors
  },
});
```

### Pattern 5: Frontend Docker Container (Vite Dev Server)

**What:** Vite dev server running in Docker with volume mount for live reload. The frontend calls the API using a relative `/api` prefix; Vite proxies to the API container.
**When to use:** Add to docker-compose.yml (D-21).

```yaml
# docker-compose.yml addition
frontend:
  build: ./frontend
  ports:
    - "5173:5173"
  volumes:
    - ./frontend:/app
    - /app/node_modules    # anonymous volume — prevents host node_modules clobber
  depends_on:
    api:
      condition: service_healthy
```

```typescript
// vite.config.ts — proxy API calls to backend
server: {
  host: "0.0.0.0",   // required for Docker container to expose port
  proxy: {
    "/api": {
      target: "http://api:8000",
      changeOrigin: true,
    },
  },
},
```

**Critical:** `host: "0.0.0.0"` is required in vite.config.ts when running inside Docker. Without it, Vite only listens on localhost inside the container and the port mapping does nothing.

### Pattern 6: Tailwind v4 CSS-First Config

**What:** Tailwind CSS v4 drops `tailwind.config.js`. Configuration lives in `src/index.css` using `@theme {}` blocks.
**When to use:** All Tailwind customization in this project.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-primary: #2563eb;   /* customize tokens here */
}
```

Note: Tailwind v4 uses `@tailwindcss/vite` plugin (not postcss config). Add to `vite.config.ts` as `plugins: [react(), tailwindcss()]`.

### Anti-Patterns to Avoid

- **pandas `dtype=float` for monetary columns:** Loses precision. Always parse monetary values as strings, then convert to Python `Decimal` before inserting as `NUMERIC`.
- **`pd.read_csv` without `dtype=str`:** pandas auto-detects types and may silently convert e.g. order numbers with leading zeros to integers, destroying data.
- **Raising exceptions on first validation error:** D-11 requires partial imports — use error collection, not early return.
- **`Base.metadata.create_all()` for schema changes:** Already established as forbidden (CLAUDE.md, Phase 1 context). Always Alembic.
- **Hardcoded API URL in frontend:** Use Vite proxy (`/api` prefix) so the frontend works in both Docker and local dev without environment switching.
- **`docker-compose` (v1):** Use `docker compose` (v2, no hyphen). CLAUDE.md constraint.
- **`--reload` in migration container:** The migrate service uses `alembic upgrade head` as its command — no uvicorn/reload involved. The API service has --reload (dev mode only, per docker-compose.yml).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop + file browse | Custom HTML5 drag event handlers | react-dropzone | Handles dragover/drop events, file filtering, reject callbacks, single-file constraint, keyboard accessibility |
| Toast notifications | Custom portal + animation | sonner | Handles stacking, auto-dismiss, portal rendering, ARIA live regions |
| German `="..."` ERP quoting | Ad-hoc regex per column | `df.map(strip_eq_quotes)` uniform transform | Uniform cell-level application via pandas; brittle if done per-column |
| DE/EN string management | Inline ternaries `lang === 'de' ? '...' : '...'` | react-i18next | Scales badly beyond ~5 strings; i18next handles pluralization, interpolation, namespace loading |
| API cache invalidation on upload | Manual `useState` refetch flags | TanStack Query `invalidateQueries` | Race conditions and stale-closure bugs if hand-rolled |
| DB connection pool management | Manual asyncpg connection handling | SQLAlchemy 2.0 AsyncSession | Pool management, connection lifecycle, retry — already in use |
| Bulk insert deduplication | SELECT then INSERT logic | `ON CONFLICT DO NOTHING` | Atomic; avoids race condition between check and insert |

**Key insight:** The parsing pipeline's complexity is in correct German locale handling and `="..."` stripping — invest attention there. Everything else (UI state, notifications, drag-and-drop) is commodity; use libraries.

---

## Common Pitfalls

### Pitfall 1: pandas `applymap` Renamed to `map` in pandas 2.1+

**What goes wrong:** Code using `df.applymap(fn)` raises `AttributeError` in pandas 3.x.
**Why it happens:** pandas 2.1 deprecated `applymap` and renamed it to `DataFrame.map`. pandas 3.0 removed the old name.
**How to avoid:** Use `df.map(fn)` in all new code. Do not reference any pandas 2.x tutorials that use `applymap`.
**Warning signs:** `AttributeError: 'DataFrame' object has no attribute 'applymap'` at runtime.

### Pitfall 2: German Number `1.234,56` — Thousands Separator is a Period

**What goes wrong:** `float("1.234,56")` raises ValueError. `float("1.234")` succeeds but silently returns wrong value (1.234 instead of 1234.56).
**Why it happens:** Python's float() only understands English locale. The thousands separator (`.`) looks like a decimal point.
**How to avoid:** Always strip `.` thousands separator BEFORE replacing `,` decimal:
```python
def parse_german_decimal(s: str) -> Decimal:
    s = s.replace(".", "").replace(",", ".")  # order matters
    return Decimal(s)
```
**Warning signs:** Orders with values like `3.616,04` being stored as `3.616` (3.616 EUR instead of 3616.04 EUR).

### Pitfall 3: `="..."` Stripping on Non-Quoted Cells

**What goes wrong:** Stripping `="..."` blindly corrupts cells that happen to start with `="` for legitimate reasons, or fails silently on cells already without the wrapper.
**Why it happens:** The ERP may mix quoted and unquoted cells in the same file.
**How to avoid:** Use a guarded strip: only apply if the string starts with `="` AND ends with `"`. Already expressed in Pattern 1 code above.
**Warning signs:** Column values appearing as empty strings or containing stray `"` characters.

### Pitfall 4: Vite Dev Server Not Accessible from Docker Host

**What goes wrong:** Browser can't reach `http://localhost:5173` even though the container is running.
**Why it happens:** Vite defaults to `host: 'localhost'` which binds to the container's loopback only. Port mapping from Docker requires the process to listen on `0.0.0.0`.
**How to avoid:** Set `server.host: "0.0.0.0"` in `vite.config.ts`. This is required for any Vite instance running inside Docker.
**Warning signs:** `docker compose up` shows Vite running on port 5173 but browser gets connection refused.

### Pitfall 5: Anonymous Volume for `node_modules` in Docker

**What goes wrong:** Host machine's `node_modules` (or absence thereof) overwrites the container's installed modules via volume mount, causing `Cannot find module` errors.
**Why it happens:** When `./frontend:/app` is mounted, it replaces the entire `/app` directory including `/app/node_modules` built during `RUN npm install` in the Dockerfile.
**How to avoid:** Add a separate anonymous volume for node_modules in docker-compose.yml:
```yaml
volumes:
  - ./frontend:/app
  - /app/node_modules    # anonymous volume shadows the mounted directory
```
**Warning signs:** Container starts but immediately exits with module not found errors.

### Pitfall 6: Alembic `op.drop_column` / Column Type Changes Require Two Migrations

**What goes wrong:** Attempting to alter `col_a VARCHAR` to a typed column in one migration fails or leaves inconsistent state if the column has data.
**Why it happens:** ALTER COLUMN with type change requires `USING` clause in PostgreSQL for non-trivial casts.
**How to avoid:** The Phase 2 migration drops the `sales_records` table (placeholder columns `col_a/b/c`) and recreates it with the full 38-column schema. This is safe because Phase 1 data is test-only and has no production rows. The migration must also add `error_count` column to `upload_batches`.
**Warning signs:** Alembic migration fails with `ERROR: column "col_a" cannot be cast automatically to type integer`.

### Pitfall 7: Nullable Date Columns and Empty String vs NULL

**What goes wrong:** Empty tab-delimited cells may arrive as `""` (empty string) after `="..."` stripping. Inserting `""` into a `DATE` column fails; it must be converted to `None` (NULL).
**Why it happens:** `keep_default_na=False` in pandas preserves empty cells as `""` rather than `NaN`. This is correct for strings but requires explicit null conversion for typed columns.
**How to avoid:** In the type-casting step, treat empty string as `None` for all date and numeric columns:
```python
def parse_optional_date(s: str) -> date | None:
    if not s.strip():
        return None
    # parse DD.MM.YYYY ...
```
**Warning signs:** `DataError: invalid input syntax for type date: ""` from PostgreSQL.

---

## Code Examples

### German Decimal Parsing

```python
# Source: Python docs + D-06 decision
from decimal import Decimal, InvalidOperation

def parse_german_decimal(raw: str) -> Decimal | None:
    """Parse German decimal like '2.230,43' -> Decimal('2230.43')"""
    s = raw.strip()
    if not s:
        return None
    try:
        s = s.replace(".", "").replace(",", ".")
        return Decimal(s)
    except InvalidOperation:
        return None  # caller collects as validation error
```

### German Date Parsing

```python
# Source: Python datetime docs + D-10 decision
from datetime import date

def parse_german_date(raw: str) -> date | None:
    """Parse DD.MM.YYYY format."""
    s = raw.strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%d.%m.%Y").date()
    except ValueError:
        return None  # caller collects as validation error
```

### FastAPI Upload Endpoint Structure

```python
# Source: FastAPI docs — https://fastapi.tiangolo.com/tutorial/request-files/
from fastapi import APIRouter, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api")

@router.post("/upload")
async def upload_file(
    file: UploadFile,
    db: AsyncSession = Depends(get_async_db_session),
):
    # 1. Validate file extension
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {file.filename}")
    # 2. Parse
    valid_rows, errors = await parse_erp_file(file)
    # 3. Determine status
    status = "success" if not errors else ("partial" if valid_rows else "failed")
    # 4. Write batch record + sales records
    # 5. Return response with errors list
```

### Pydantic Response Schema

```python
# Source: Pydantic v2 docs
from pydantic import BaseModel
from datetime import datetime

class ValidationError(BaseModel):
    row: int
    column: str
    message: str

class UploadResponse(BaseModel):
    id: int
    filename: str
    row_count: int
    error_count: int
    status: str  # "success" | "partial" | "failed"
    errors: list[ValidationError]

class UploadBatchSummary(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    row_count: int
    error_count: int
    status: str
```

### react-dropzone Usage

```typescript
// Source: react-dropzone docs — https://react-dropzone.js.org/
import { useDropzone } from "react-dropzone";

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop: (acceptedFiles) => {
    if (acceptedFiles[0]) uploadMutation.mutate(acceptedFiles[0]);
  },
  accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
  maxFiles: 1,
  disabled: uploadMutation.isPending,
});
```

### react-i18next Minimal Setup

```typescript
// src/i18n.ts — Source: react-i18next docs
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: "de",          // default language
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
```

### Frontend Dockerfile (Vite Dev Server)

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

---

## 38-Column Schema Mapping

The CONTEXT.md confirms the file has 38 columns in tab-delimited, `="..."` format. The mapping below covers all confirmed columns based on the context specifics and the German ERP export pattern described. The exact column names must be verified against an actual sample file during implementation — but this provides the complete starting schema for the Alembic migration.

| German Header | English DB Column | PostgreSQL Type | Notes |
|---------------|-------------------|-----------------|-------|
| Auftrag | order_number | VARCHAR(50) UNIQUE NOT NULL | Business key (D-03) |
| (unnamed col 2) | erp_status_flag | VARCHAR(50) NULLABLE | "isign_warning" or empty |
| Datum | order_date | DATE NULLABLE | DD.MM.YYYY (D-10) |
| Lieferdatum | delivery_date | DATE NULLABLE | Nullable (D-10) |
| Wunschdatum | requested_date | DATE NULLABLE | Nullable (D-10) |
| Eintreffdatum | arrival_date | DATE NULLABLE | Nullable (D-10) |
| Kunde | customer_id | VARCHAR(50) NULLABLE | Customer number |
| Kundenname | customer_name | VARCHAR(255) NULLABLE | |
| Ort / Stadt | city | VARCHAR(255) NULLABLE | |
| Restwert | remaining_value | NUMERIC(15,2) NULLABLE | German decimal (D-06) |
| Gesamtwert | total_value | NUMERIC(15,2) NULLABLE | German decimal (D-06) |
| Verantwortlich | responsible_person | VARCHAR(255) NULLABLE | ZETTLER, GOMES, etc. |
| Projekt | project_reference | TEXT NULLABLE | Rich text field |
| (remaining ~25 cols) | col_XX per actual headers | VARCHAR(255) or TEXT NULLABLE | Confirm against sample file |

**Note to planner:** The task for Wave 0 or Wave 1 must include reading an actual sample file to confirm all 38 column names. The schema above covers the confirmed columns from CONTEXT.md specifics. The remaining ~25 columns should be VARCHAR(255) NULLABLE unless a sample shows otherwise.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pd.DataFrame.applymap` | `pd.DataFrame.map` | pandas 2.1 (removed in 3.0) | Code using applymap fails at runtime |
| `tailwind.config.js` | CSS-first `@theme {}` in CSS file | Tailwind CSS v4 (2025) | No config file needed; breaking change from v3 docs |
| `docker-compose` CLI (v1) | `docker compose` plugin (v2) | Docker v20.10 (v1 EOL 2023) | All CLAUDE.md commands use v2 syntax |
| `vite.config.js` | `vite.config.ts` with `@tailwindcss/vite` plugin | Tailwind v4 + Vite 5+ | postcss config no longer needed for Tailwind |

**Deprecated/outdated:**
- `pandas.DataFrame.applymap`: Removed in pandas 3.0. Use `DataFrame.map`.
- `openpyxl` dependency: Explicitly NOT needed (D-07). Do not add to requirements.txt.
- `postcss.config.js` for Tailwind: Tailwind v4 uses the Vite plugin instead.

---

## Open Questions

1. **Exact 38-column names from sample file**
   - What we know: CONTEXT.md describes key columns (Auftrag, Datum, Lieferdatum, Restwert, Gesamtwert, Verantwortlich, Projekt); unnamed status column; ~25 remaining columns unspecified
   - What's unclear: Exact German header strings for the remaining ~25 columns, which affect the German→English mapping dict and the Alembic migration columns
   - Recommendation: Wave 0 task — agent reads an actual sample file from the repo (if present) or requests user to provide one, then generates the complete mapping. The migration cannot be written without this.

2. **Error count storage: column vs. computed**
   - What we know: D-19 requires error_count in the history table; CONTEXT.md lists "error count (number of skipped rows)" as Claude's discretion
   - What's unclear: Whether to add `error_count` column to `upload_batches` or compute via `COUNT(*)` from a separate `validation_errors` table
   - Recommendation: Store `error_count` as a column on `upload_batches`. Simpler query, no join needed for history list. Errors are ephemeral — they are only relevant at upload time, not for analytics. The response JSON already includes the full error list.

3. **Frontend API base URL in Docker vs. local dev**
   - What we know: Vite proxy config can route `/api` → `http://api:8000` inside Docker
   - What's unclear: How local development outside Docker should connect (api is not on a Docker network)
   - Recommendation: Use Vite proxy for Docker; add a `.env.local` override for bare-metal dev (`VITE_API_URL=http://localhost:8000`). Since the project is Docker-first (CLAUDE.md constraint), Docker should be the primary dev path.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Container builds + Compose | Yes | 29.3.1 | — |
| Node.js | Frontend scaffold, npm commands | Yes | v25.9.0 | — |
| npm | Frontend dependency install | Yes | 11.12.1 | — |
| Python 3.11 | Backend (inside Docker) | Yes (3.9.6 host; 3.11-slim in Docker) | 3.11 in container | Host python is 3.9 — run backend commands inside Docker |
| pandas 3.0.2 | File parsing (inside Docker) | Not on host; added to requirements.txt | 3.0.2 (via PyPI) | — |

**Missing dependencies with no fallback:**
- None — all required tools are available. pandas is added to requirements.txt and installed inside the Docker image.

**Missing dependencies with fallback:**
- Python 3.11 not available on host (3.9.6 installed). All backend commands must run via Docker (`docker compose exec api ...`). This is the expected pattern per CLAUDE.md constraints.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official docs — UploadFile, multipart forms, routers
- SQLAlchemy 2.0 docs — `insert().on_conflict_do_nothing()` (PostgreSQL dialect)
- pandas 3.0 docs — `DataFrame.map` (replaces applymap), `read_csv` dtype parameter
- TanStack Query v5 docs — `useMutation`, `invalidateQueries`
- Tailwind CSS v4 docs — CSS-first config, `@tailwindcss/vite` plugin
- CLAUDE.md — Canonical version pins for all stack components
- Phase 1 artifacts — Existing database.py, models.py, docker-compose.yml patterns

### Secondary (MEDIUM confidence)
- react-dropzone docs — `accept` prop format, `maxFiles`, `isDragActive`
- react-i18next docs — `initReactI18next`, resource loading
- sonner docs — toast API, Tailwind integration
- npm registry — Verified versions: react-i18next@17.0.2, i18next@26.0.4, sonner@2.0.7, react-dropzone@15.0.0

### Tertiary (LOW confidence)
- German ERP `="..."` quoting pattern: documented in multiple SAP export discussions; verified against CONTEXT.md description but no single authoritative spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry and PyPI API directly
- Architecture: HIGH — based on Phase 1 established patterns + official library docs
- Pitfalls: HIGH (pandas/Vite/Docker) / MEDIUM (German locale) — pandas/Vite pitfalls verified against official changelogs; German locale pitfalls based on well-understood parsing behavior
- 38-column mapping: MEDIUM — key columns confirmed via CONTEXT.md; remaining columns require sample file verification

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack; 30-day window reasonable)
