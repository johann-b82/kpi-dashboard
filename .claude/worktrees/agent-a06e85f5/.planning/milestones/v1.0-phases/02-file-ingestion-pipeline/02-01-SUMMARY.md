---
phase: 02-file-ingestion-pipeline
plan: 01
subsystem: database
tags: [pandas, sqlalchemy, pydantic, postgresql, parsing, german-locale]

# Dependency graph
requires:
  - phase: 01-infrastructure-and-schema
    provides: Base, database.py, UploadBatch/SalesRecord stubs, Alembic migrations
provides:
  - ERP tab-delimited parser with German locale handling (erp_parser.py)
  - 38-column German-to-English column mapping (column_mapping.py)
  - Complete 38-column SalesRecord SQLAlchemy model with UNIQUE constraint on order_number
  - UploadBatch with error_count field and CASCADE relationship to SalesRecord
  - Pydantic response schemas: ValidationErrorDetail, UploadResponse, UploadBatchSummary
affects:
  - 02-02 (upload API endpoint — imports parse_erp_file, SalesRecord, UploadBatch, schemas)
  - 02-03 (Alembic migration — uses SalesRecord model columns)
  - 03 (dashboard frontend — uses UploadBatchSummary schema)

# Tech tracking
tech-stack:
  added:
    - pandas==3.0.2 (tab-delimited parsing, German locale handling)
  patterns:
    - German="..." quoting stripped via df.map(strip_eq_quotes) — NOT applymap (pandas 3.x breaking change)
    - parse_german_decimal: remove . then replace , with . (Decimal for exactness)
    - parse_german_date: strptime with %d.%m.%Y
    - Row validation returns partial results: (valid_rows, errors) tuple
    - INSERT ON CONFLICT DO NOTHING via UNIQUE order_number (D-03)
    - ForeignKey with ondelete=CASCADE + ORM cascade=all,delete-orphan (D-20)

key-files:
  created:
    - backend/app/parsing/__init__.py
    - backend/app/parsing/column_mapping.py
    - backend/app/parsing/erp_parser.py
    - backend/app/schemas.py
  modified:
    - backend/app/models.py
    - backend/requirements.txt

key-decisions:
  - "GERMAN_TO_ENGLISH uses empty string key for column 2 (no German header) -> erp_status_flag"
  - "Tech Pruf and Kauf Pruf stored as unicode literals (\\u00fc) to handle encoding-agnostic matching"
  - "business_area, manual_status, customer_lock, status_code stored as Integer in ORM (INTEGER columns)"
  - "df.map not df.applymap for pandas 3.x compatibility when stripping =\"...\" quoting"

patterns-established:
  - "Parsing pattern: pd.read_csv(BytesIO, sep=\\t, dtype=str, keep_default_na=False) -> df.map strip -> rename -> iterate"
  - "Validation returns (valid_rows, errors) tuple — partial success per D-11"
  - "Row numbers are idx+2 (1-indexed + header row offset)"

requirements-completed: [UPLD-05, UPLD-04, UPLD-02]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 2 Plan 01: Data Layer and ERP Parser Summary

**38-column ERP tab-delimited parser with German locale handling, complete SQLAlchemy models with UNIQUE business key, and Pydantic API response schemas**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-10T19:38:00Z
- **Completed:** 2026-04-10T19:42:54Z
- **Tasks:** 2 (Task 0 skipped — pre-resolved via checkpoint)
- **Files modified:** 6

## Accomplishments

- Created `erp_parser.py` with `parse_erp_file` that reads tab-delimited ERP bytes, strips `="..."` quoting via `df.map`, handles German dates (DD.MM.YYYY) and decimals (2.230,43 -> 2230.43), validates rows per D-12, and returns `(valid_rows, errors)` for partial import support
- Created `column_mapping.py` with complete 38-entry `GERMAN_TO_ENGLISH` dict mapping all ERP German headers to English snake_case DB column names, plus `DATE_COLUMNS`, `DECIMAL_COLUMNS`, `REQUIRED_COLUMNS` sets
- Updated `models.py`: SalesRecord replaced from 3 placeholder columns to 38-column schema with `order_number` UNIQUE, `Date` and `Numeric(15,2)` types, `ForeignKey` cascade; UploadBatch gains `error_count` and ORM relationship
- Added `schemas.py` with `ValidationErrorDetail`, `UploadResponse`, `UploadBatchSummary` Pydantic v2 models
- Added `pandas==3.0.2` to `requirements.txt`; confirmed openpyxl absent (D-07)

## Task Commits

1. **Task 1: Create column mapping, parser module, and Pydantic schemas** - `c7db121` (feat)
2. **Task 2: Update SQLAlchemy models with 38-column schema and error_count** - `8d7abdd` (feat)

## Files Created/Modified

- `backend/app/parsing/__init__.py` - Empty package init
- `backend/app/parsing/column_mapping.py` - 38-entry GERMAN_TO_ENGLISH mapping, DATE/DECIMAL/REQUIRED_COLUMNS sets
- `backend/app/parsing/erp_parser.py` - Main parser: strip_eq_quotes, parse_german_decimal, parse_german_date, validate_row, row_to_dict, parse_erp_file
- `backend/app/schemas.py` - ValidationErrorDetail, UploadResponse, UploadBatchSummary Pydantic v2 models
- `backend/app/models.py` - SalesRecord with 38 data columns, UploadBatch with error_count and CASCADE relationship
- `backend/requirements.txt` - Added pandas==3.0.2

## Decisions Made

- Empty string key (`""`) used in `GERMAN_TO_ENGLISH` for column 2 which has no German header label in the ERP export — maps to `erp_status_flag`
- `Tech Prüf` and `Kauf Prüf` stored as unicode literals (`\u00fc`) in column_mapping.py to ensure the mapping works regardless of how the file is read — the `="..."` stripping and encoding happen before the lookup
- `business_area`, `manual_status`, `customer_lock`, `status_code` stored as `Integer` in the ORM based on sample data showing integer values (0, 1) — these are integer-typed columns in the ERP
- Used `df.map` (not deprecated `df.applymap`) to strip `="..."` quoting — required for pandas 3.x compatibility

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `parse_erp_file` is ready for import by the upload API router (Plan 02)
- `SalesRecord` and `UploadBatch` models are ready; Alembic migration (Plan 03) will generate the actual schema change from placeholder to 38-column
- `UploadBatchSummary` schema is ready for the history endpoint
- `UploadResponse` schema is ready for the upload endpoint response

---
*Phase: 02-file-ingestion-pipeline*
*Completed: 2026-04-10*

## Self-Check: PASSED

- `backend/app/parsing/__init__.py` EXISTS
- `backend/app/parsing/column_mapping.py` EXISTS
- `backend/app/parsing/erp_parser.py` EXISTS
- `backend/app/schemas.py` EXISTS
- `backend/app/models.py` EXISTS (modified)
- `backend/requirements.txt` EXISTS (modified)
- Commit `c7db121` EXISTS (Task 1)
- Commit `8d7abdd` EXISTS (Task 2)
