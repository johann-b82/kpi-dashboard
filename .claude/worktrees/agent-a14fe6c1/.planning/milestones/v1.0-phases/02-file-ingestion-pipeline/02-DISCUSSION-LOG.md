# Phase 2: File Ingestion Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-file-ingestion-pipeline
**Areas discussed:** Data schema, Upload UX flow, Validation & errors, Upload history

---

## Data Schema

### Column Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 38 columns (Recommended) | Store every column from the export. Parsing is simpler, future flexibility. | ✓ |
| KPI-relevant subset only | Store ~10-12 columns. Cleaner schema but locks out future use. | |
| Let me pick the columns | User specifies exact columns to keep. | |

**User's choice:** All 38 columns
**Notes:** User provided a sample data file — tab-delimited German ERP export with ="..." quoting, 38 columns.

### Business Key

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Auftrag is unique | Each order number appears exactly once per file. | ✓ |
| No, it can repeat | Same Auftrag can appear in multiple uploads. | |
| Not sure | Needs team check. | |

**User's choice:** Yes, Auftrag is unique

### File Types

| Option | Description | Selected |
|--------|-------------|----------|
| Always this tab-delimited format | ERP always exports this format, just different extensions. | ✓ |
| Also real Excel files | Sometimes .xlsx from ERP or colleagues. | |
| Multiple formats possible | Could be any of CSV, TXT, or Excel. | |

**User's choice:** Always this tab-delimited format

### File Extensions

| Option | Description | Selected |
|--------|-------------|----------|
| Only .csv and .txt | ERP exports as .csv or .txt, never .xlsx. | ✓ |
| Could also be .xlsx | Sometimes people save/rename as .xlsx. | |
| You decide | Accept common extensions, parse content regardless. | |

**User's choice:** Only .csv and .txt

### Money Storage Type

| Option | Description | Selected |
|--------|-------------|----------|
| NUMERIC (Recommended) | Exact decimal storage, no rounding errors. | ✓ |
| FLOAT | Approximate, faster but can introduce rounding. | |
| You decide | Claude picks. | |

**User's choice:** NUMERIC

### Zero-Value Orders

| Option | Description | Selected |
|--------|-------------|----------|
| Store all, filter in dashboard | Keep every row, dashboard decides on KPI inclusion. | ✓ |
| Skip zero-value rows on import | Don't store rows where Gesamtwert is 0. | |
| You decide | Claude picks. | |

**User's choice:** Store all, filter in dashboard

### Parsing Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Strip universally (Recommended) | Apply ="..." stripping to every cell, then cast. | ✓ |
| Per-column type handling | Define expected types per column, strip/cast as needed. | |
| You decide | Claude picks. | |

**User's choice:** Strip universally

### Column Names

| Option | Description | Selected |
|--------|-------------|----------|
| Keep German names | DB columns match file headers exactly. | |
| Translate to English | DB columns are English snake_case with mapping layer. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Translate to English

### Header Row

| Option | Description | Selected |
|--------|-------------|----------|
| Always present, always same | ERP export always includes exact header row. | ✓ |
| Sometimes missing | Occasionally no header, just data rows. | |
| Not sure | Needs checking. | |

**User's choice:** Always present, always same

---

## Upload UX Flow

### Upload Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone upload page | Dedicated /upload route with centered drop zone and history below. | ✓ |
| Upload as sidebar/modal | Upload in slide-out panel/modal, dashboard as main page. | |
| You decide | Claude picks layout. | |

**User's choice:** Standalone upload page

### Post-Upload Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Success toast + update history | Brief notification, history list refreshes. | ✓ |
| Summary screen | Navigate to summary with row count, date range, warnings. | |
| You decide | Claude picks. | |

**User's choice:** Success toast + update history

### Frontend Docker Container

| Option | Description | Selected |
|--------|-------------|----------|
| Add in Phase 2 (Recommended) | Add Vite dev server container now. | ✓ |
| Wait for Phase 3 | Frontend container added in Phase 3. | |

**User's choice:** Add in Phase 2

### Progress Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Indeterminate spinner | Simple loading spinner during upload/parse. | ✓ |
| Progress bar with percentage | Shows 0-100% upload progress. | |
| You decide | Claude picks based on file sizes. | |

**User's choice:** Indeterminate spinner

### Multi-File Upload

| Option | Description | Selected |
|--------|-------------|----------|
| Single file only (Recommended) | One file per upload action. | ✓ |
| Multiple files | Drag multiple files at once. | |
| You decide | Claude picks. | |

**User's choice:** Single file only

### UI Language

| Option | Description | Selected |
|--------|-------------|----------|
| German | All UI labels in German. | |
| English | All UI labels in English. | |
| You decide | Claude picks. | |

**User's choice:** Both — bilingual UI with language toggle (DE/EN)
**Notes:** User wants both German and English with a toggle to switch. Requires i18n setup.

---

## Validation & Errors

### Partial File Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Reject entire file (Recommended) | Any row failure rejects the whole upload. | |
| Import valid rows, skip bad ones | Store valid rows, skip invalid. Status = 'partial'. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Import valid rows, skip bad ones

### Validation Checks (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Wrong column count | Row has != 38 tab-separated values. | ✓ |
| Unparseable dates | Date columns not in DD.MM.YYYY format. | ✓ |
| Unparseable numbers | Monetary columns can't parse as German decimal. | ✓ |
| Missing required fields | Auftrag empty or non-numeric. | ✓ |

**User's choice:** All four checks selected

### Error Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error list | Scrollable list below upload zone with row/column detail. | ✓ |
| Downloadable error report | Generate error summary file for download. | |
| You decide | Claude picks. | |

**User's choice:** Inline error list

---

## Upload History

### History Location

| Option | Description | Selected |
|--------|-------------|----------|
| Below the upload zone (Recommended) | Same page, scroll down to see history. | ✓ |
| Separate /history page | Dedicated route for history. | |
| You decide | Claude picks. | |

**User's choice:** Below the upload zone

### Entry Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum (MGMT-01) | Filename, timestamp, row count, status. | |
| Add error count | Also show skipped row count for partial uploads. | ✓ |
| Add date range of data | Also show min/max date from parsed rows. | |

**User's choice:** Add error count

### Delete Capability

| Option | Description | Selected |
|--------|-------------|----------|
| No delete in v1 | Append-only, deletion deferred to v2 (UPLD-08). | |
| Allow delete | Delete button per upload, removes batch + rows. | ✓ |

**User's choice:** Allow delete
**Notes:** UPLD-08 is v2 scope but user chose to include basic delete now since it's tightly coupled to upload history.

### Delete UX

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog (Recommended) | Click delete -> confirm dialog -> delete. | ✓ |
| Direct delete | One click deletes immediately. | |
| You decide | Claude picks. | |

**User's choice:** Confirmation dialog

---

## Claude's Discretion

- i18n library choice
- Toast notification implementation
- Drag-and-drop library choice
- Upload history pagination approach
- Exact German-to-English column name mapping for all 38 columns
- Error count storage approach
- Frontend project scaffold details

## Deferred Ideas

- Advanced upload rollback features (UPLD-08 v2 scope beyond basic delete)
