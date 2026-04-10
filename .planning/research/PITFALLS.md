# Domain Pitfalls

**Domain:** Dockerized KPI Dashboard with File Upload to PostgreSQL
**Project:** ACM KPI Light
**Researched:** 2026-04-10
**Confidence:** HIGH (architecture/infra pitfalls verified via official docs and community; file parsing pitfalls verified via GitHub issues and official pandas/PostgreSQL docs)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or total system failure.

---

### Pitfall 1: Docker Compose — App Starts Before PostgreSQL is Ready

**What goes wrong:** The app container starts, attempts a DB connection immediately, gets "connection refused" or "role does not exist", and crashes or goes into a broken state. `depends_on: db` only waits for the container to _start_, not for PostgreSQL to be _accepting connections_.

**Why it happens:** PostgreSQL takes several seconds to initialize its data directory, run init scripts, and begin accepting connections. The default `depends_on` in Docker Compose only checks container start state, not service readiness.

**Consequences:** App fails on first deploy. Developers assume the stack is broken and waste time debugging a race condition. Intermittent failures in CI.

**Prevention:**
- Add a `healthcheck` to the `db` service using `pg_isready`:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
  ```
- Use `condition: service_healthy` in the app's `depends_on`:
  ```yaml
  depends_on:
    db:
      condition: service_healthy
  ```

**Warning signs:** App crashes on `docker compose up` with connection errors; works fine after a `docker compose restart app`.

**Phase:** Infrastructure setup (Phase 1 / foundation). Get this right before writing any application code.

---

### Pitfall 2: PostgreSQL Data Loss on `docker compose down`

**What goes wrong:** Running `docker compose down` (without `-v`) or using an anonymous volume deletes all database data. Even with a named volume, pointing to the wrong internal path means data is never persisted in the first place.

**Why it happens:** The official postgres image stores data at `/var/lib/postgresql/data`. Mounting to `/var/lib/postgresql` (the parent) is a common typo. Anonymous volumes disappear silently. Named volumes must be declared in the top-level `volumes:` section of the compose file.

**Consequences:** All uploaded data and upload history vanishes. In production use by an internal team, this is catastrophic.

**Prevention:**
- Always use a **named volume** (not a bind mount or anonymous volume):
  ```yaml
  volumes:
    postgres_data:
  
  services:
    db:
      volumes:
        - postgres_data:/var/lib/postgresql/data  # exact path matters
  ```
- Add `volumes:` declaration at the top level of `docker-compose.yml`.
- Never run `docker compose down -v` in production — document this for the team.

**Warning signs:** Host-side volume directory is empty after first run; `docker volume ls` shows no named volume for this project.

**Phase:** Infrastructure setup (Phase 1). Validate persistence before building any upload logic.

---

### Pitfall 3: Re-Uploading the Same File Inserts Duplicate Rows

**What goes wrong:** A user uploads the same CSV twice (or uploads an updated file containing all previous rows plus new ones). All rows are inserted again, doubling or corrupting metrics. KPI totals become meaningless.

**Why it happens:** A naive `INSERT` approach has no concept of "have I seen this row before?". Without an idempotency strategy, every upload is additive.

**Consequences:** Revenue totals double, trend charts spike, users lose trust in the dashboard. Fixing data corruption requires knowing which rows are duplicates — non-trivial after the fact.

**Prevention:**
- Define a **natural business key** (e.g., `order_id`, or a composite of `date + product + region`) and add a `UNIQUE` constraint in PostgreSQL.
- Use `INSERT ... ON CONFLICT DO NOTHING` (or `DO UPDATE`) for idempotent ingestion:
  ```sql
  INSERT INTO sales_data (order_id, date, revenue, ...)
  VALUES (...)
  ON CONFLICT (order_id) DO NOTHING;
  ```
- Or: on each upload, clear the rows from that upload batch (keyed by upload_id) before re-inserting, making each upload a replace-not-append.
- Store a hash of each uploaded file and reject re-uploads of the same file with a clear user message.

**Warning signs:** After a second upload the total revenue doubles; upload history shows same filename uploaded multiple times.

**Phase:** File ingestion pipeline (Phase 2 / core upload logic). Design idempotency before first row hits the database.

---

### Pitfall 4: Excel/CSV Datetime and Timezone Corruption

**What goes wrong:** Dates parsed from Excel appear shifted by hours, or aggregate to the wrong day in charts. PostgreSQL stores timestamps but the dashboard shows data for "yesterday" when the sales were today.

**Why it happens (multiple causes):**
1. **Excel serial dates**: Excel stores dates as floating-point day counts from 1900-01-01. Without `openpyxl`'s `data_only=True` or proper date parsing, you get raw floats (e.g., `44927` instead of `2023-01-01`).
2. **TIMESTAMP vs TIMESTAMPTZ**: Storing in `TIMESTAMP` (no timezone) then aggregating in PostgreSQL uses the database server's timezone, which may differ from the user's local time, shifting daily buckets.
3. **Mixed formats in the same column**: If some rows have `2024-01-15` and others have `15.01.2024` or `Jan 15, 2024`, pandas silently coerces or drops values.

**Consequences:** Charts show wrong trends, daily revenue bars are off by one day, some rows have `NULL` dates and disappear from aggregations.

**Prevention:**
- Use `TIMESTAMPTZ` (timestamp with time zone) in PostgreSQL for all date/time columns. This is the PostgreSQL wiki's official recommendation — never use bare `TIMESTAMP` for business data.
- At parse time, explicitly parse dates with `pd.to_datetime(df['date_col'], dayfirst=True/False)` and validate results before inserting.
- Since the file schema is fixed and known, document the expected date format and validate against it — reject files where date parsing fails rather than silently inserting `NULL`.
- Normalize all timestamps to UTC on ingest; convert to display timezone only in queries.

**Warning signs:** Some rows have `NULL` in the date column after insert; chart bars don't align with the dates in the raw file; total revenue differs from sum in the source Excel file.

**Phase:** File ingestion pipeline (Phase 2). Catch during schema design — choose `TIMESTAMPTZ` from day one, it cannot be changed without a migration.

---

## Moderate Pitfalls

Mistakes that cause bugs, poor UX, or technical debt — but not rewrites.

---

### Pitfall 5: UTF-8 BOM and Encoding Failures for Windows-Exported Files

**What goes wrong:** A CSV exported from Excel on Windows opens fine in Excel but fails to parse in Python with `UnicodeDecodeError`, or the first column header appears as `ï»¿column_name` (garbled BOM prefix). TXT files with semicolon delimiters are read as single-column files.

**Why it happens:** Excel on Windows defaults to saving CSV files with a UTF-8 BOM (byte order mark) and sometimes uses CP1252/Latin-1 encoding. European locale Excel exports use `;` as the delimiter, not `,`. Python's default `open()` and `csv.reader` do not handle the BOM.

**Consequences:** Import fails with a cryptic error the user cannot diagnose; or worse, the first column is silently mis-named and data is stored under the wrong key.

**Prevention:**
- Use `encoding='utf-8-sig'` when opening CSV files in Python — this handles both UTF-8 with and without BOM transparently.
- For `.txt` files, auto-detect delimiter using `csv.Sniffer` or `pandas` `sep=None, engine='python'` before falling back to comma.
- As a safety net, try encodings in order: `utf-8-sig` → `latin-1` → `cp1252`. Accept the first that succeeds without error.
- Provide clear user-facing error messages: "File could not be parsed. Ensure it is saved as UTF-8 CSV." rather than a 500 error.

**Warning signs:** First column name in uploaded data starts with strange characters; `KeyError` on a column that visually looks correct in the raw file.

**Phase:** File ingestion pipeline (Phase 2).

---

### Pitfall 6: Excel XML Corruption and Engine Mismatch (.xls vs .xlsx)

**What goes wrong:** `pd.read_excel()` raises `ValueError`, `BadZipFile`, or returns an empty DataFrame for files that open fine in Excel. Trying to read an `.xls` file with the `openpyxl` engine (which only handles `.xlsx`) silently fails or errors.

**Why it happens:** `.xlsx` is a ZIP-compressed XML format. Files produced by some tools (macros, third-party exporters) embed invalid XML or non-standard styling that `openpyxl` rejects. `.xls` (Excel 97-2003 format) requires `xlrd`, which stopped supporting `.xlsx` in v2.0.

**Consequences:** Users cannot upload their files; support burden increases; engineering time spent chasing library version incompatibilities.

**Prevention:**
- Install both engines: `openpyxl` for `.xlsx`, `xlrd` for `.xls` (pin `xlrd<2.0` or accept only `.xlsx`).
- Use `pd.read_excel(file, engine='openpyxl')` explicitly — don't rely on auto-detection.
- If XML errors occur, fall back to reading cell-by-cell with `openpyxl.load_workbook(data_only=True)`.
- Since the project has a **fixed known schema**, validate column names immediately after parse and surface schema validation errors to the user — this catches silent parsing failures before they reach the DB.

**Warning signs:** Empty DataFrame returned despite non-empty file; `zipfile.BadZipFile` exception; `KeyError` on expected columns.

**Phase:** File ingestion pipeline (Phase 2).

---

### Pitfall 7: No File Size Limit Causes OOM or Disk Exhaustion

**What goes wrong:** A user uploads a 200MB Excel file. The server buffers it entirely in memory, exhausts RAM, and the container crashes. Or: uploaded files accumulate on the container's filesystem, filling the container's disk layer.

**Why it happens:** Default multipart/form-data handling buffers the entire file in memory before the handler runs. There is no cleanup of temp files in the default case. Files stored in the container filesystem (not a volume) are lost on container restart and accumulate until restart.

**Consequences:** Server OOM crash; degraded service for all users; potential disk exhaustion.

**Prevention:**
- Set a **hard file size limit** at the framework level (e.g., 50MB for this project's use case of sales/revenue CSVs — multi-MB Excel files are unusual for tabular data).
- Stream files to a temp directory or process them in chunks rather than buffering in memory.
- Do not store uploaded files permanently — parse, insert to DB, then delete the temp file.
- If files must be retained for audit, mount a named Docker volume for the upload temp directory.

**Warning signs:** Container memory usage spikes during upload; container restarts after large file upload; `df -h` inside the container shows high disk usage.

**Phase:** File ingestion pipeline (Phase 2). Set limits before deployment.

---

### Pitfall 8: Dashboard Shows Stale Data After Upload (No Cache Invalidation)

**What goes wrong:** User uploads a file, sees the success confirmation, navigates to the dashboard — but the KPI numbers haven't updated. They must hard-refresh or wait. They assume the upload failed and upload again (triggering Pitfall 3).

**Why it happens:** Dashboard data is fetched once and cached (browser cache, frontend state, or a server-side query cache). The upload endpoint writes to the DB but does not invalidate any cached dashboard queries.

**Consequences:** User confusion, duplicate uploads, loss of trust in the system.

**Prevention:**
- After a successful upload, either: (a) redirect the user to the dashboard with a cache-busting query param, or (b) have the frontend explicitly refetch dashboard data after upload completion.
- Do not implement a separate server-side query cache in v1 — PostgreSQL query speed is sufficient for small internal teams. Premature caching creates invalidation complexity.
- Show a "Data last updated: [timestamp]" indicator on the dashboard so users know they're seeing fresh data.

**Warning signs:** User reports "numbers didn't change after upload"; upload history shows the same file multiple times.

**Phase:** Dashboard UI (Phase 3) and upload flow (Phase 2). Design the upload → refresh flow together.

---

### Pitfall 9: Upload History Loses Context (No Audit Trail)

**What goes wrong:** An upload was done two weeks ago. Nobody remembers what file was uploaded, whether it was a full reload or an incremental, or whether the numbers were correct at the time. A wrong file was uploaded and nobody can identify which records came from it.

**Why it happens:** Upload history is implemented as just a filename + timestamp log, without row counts, file hashes, or error summaries. There is no link between an upload event and the rows it produced.

**Consequences:** Inability to roll back a bad import; no audit trail for internal accountability; debugging data quality issues becomes manual and time-consuming.

**Prevention:**
- Store per-upload metadata: filename, upload timestamp, row count inserted, row count rejected, file hash (SHA-256), status (success/partial/failed).
- Link ingested rows to their upload event via an `upload_id` foreign key — this enables "delete rows from upload X" if a bad file was imported.
- Show row count and error summary in the upload confirmation UI.

**Warning signs:** Upload history table has only filename and timestamp columns; no way to identify which DB rows came from which upload.

**Phase:** Database schema design (Phase 1/2). Adding `upload_id` linkage after the fact requires a migration.

---

## Minor Pitfalls

Small issues that cause developer friction or minor UX problems.

---

### Pitfall 10: MIME Type Validation Alone is Insufficient

**What goes wrong:** File validation trusts the `Content-Type` header sent by the browser. A malicious or malformed file with `Content-Type: text/csv` but actually containing executable content, SQL injection payloads embedded in cell values, or formula injection (CSV injection / formula injection attack) bypasses validation.

**Why it happens:** The browser Content-Type is user-controlled and trivially spoofed. Excel files can contain macros. CSV cells starting with `=`, `+`, `-`, or `@` are interpreted as formulas by Excel if the file is ever re-opened.

**Consequences:** For this project (internal-only, no external users in v1), the risk is low but not zero. CSV injection can affect anyone who opens the exported data in Excel.

**Prevention:**
- Validate file extension AND content (magic bytes for `.xlsx` is `PK\x03\x04`; CSV can be sniffed by attempting to parse the first few lines).
- Strip leading `=`, `+`, `-`, `@` from cell values before inserting (or prefix with a single quote if exporting back to CSV/Excel).
- Since this is internal-only, this is a LOW priority for v1 but should be documented for v2 (when Authentik auth is added and access might broaden).

**Warning signs:** Uploaded CSV contains cells like `=HYPERLINK(...)` or `+cmd|' /C calc'!A0`.

**Phase:** File ingestion pipeline (Phase 2). Sanitize at parse time.

---

### Pitfall 11: Authentik Integration Added After App Architecture is Baked In

**What goes wrong:** Auth is deferred to v2 (correctly), but the application is built with no concept of identity — no `user_id` on any table, no session concept, no middleware hook point. Adding Authentik OIDC in v2 requires retrofitting user context throughout the entire codebase.

**Why it happens:** "We'll add auth later" leads to building the entire data model and API without any user concept. When OIDC token validation is added, every endpoint and every table needs to be updated.

**Consequences:** v2 auth milestone becomes a large cross-cutting rewrite rather than an additive feature.

**Prevention:**
- In v1, build a thin **no-op auth middleware** that always passes through — the hook point exists, it just does nothing yet.
- Add an optional `uploaded_by` column to the upload history table (nullable in v1, populated in v2).
- Keep Authentik's Docker Compose service definition commented out in the compose file as a reminder — it runs on its own PostgreSQL instance, not shared with the app DB.
- Note: As of 2025.10, Authentik no longer requires Redis — it runs on PostgreSQL only, which simplifies its Docker Compose setup.

**Warning signs:** No middleware/interceptor concept in the app; upload table has no user reference; OIDC callback URL not reserved in routing.

**Phase:** v1 design (Phase 1). Retrofit is expensive; stub is cheap.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Docker Compose / DB setup | App starts before DB ready (Pitfall 1) | Healthcheck + `condition: service_healthy` |
| Docker Compose / DB setup | Data loss on `down` (Pitfall 2) | Named volume at exact `/var/lib/postgresql/data` |
| Database schema design | Wrong timestamp type (Pitfall 4) | Use `TIMESTAMPTZ` everywhere from day one |
| Database schema design | No upload audit linkage (Pitfall 9) | Add `upload_id` FK to data rows in initial schema |
| Database schema design | No auth stub (Pitfall 11) | Add nullable `uploaded_by`, no-op middleware |
| File parsing (CSV/TXT) | Encoding / BOM errors (Pitfall 5) | `utf-8-sig` encoding, delimiter sniffing |
| File parsing (Excel) | Engine mismatch / XML corruption (Pitfall 6) | Explicit `openpyxl` engine, fallback cell-by-cell |
| File ingestion logic | Duplicate rows on re-upload (Pitfall 3) | `ON CONFLICT DO NOTHING` + natural unique key |
| File ingestion logic | OOM on large files (Pitfall 7) | Hard size limit + temp file streaming |
| File ingestion logic | Formula/injection in cells (Pitfall 10) | Strip leading `=+−@` from cell values |
| Dashboard UI | Stale data after upload (Pitfall 8) | Explicit refetch or redirect after upload |
| Dashboard UI | Wrong date aggregation (Pitfall 4) | `TIMESTAMPTZ` + UTC normalization + explicit GROUP BY |

---

## Sources

- PostgreSQL "Don't Do This" wiki (TIMESTAMP vs TIMESTAMPTZ): https://wiki.postgresql.org/wiki/Don't_Do_This
- Docker Compose healthcheck + startup order official docs: https://docs.docker.com/compose/how-tos/startup-order/
- Docker Postgres volume path pitfall: https://openillumi.com/en/en-fix-docker-postgres-volume-path/
- Idempotent database inserts (dev.to): https://dev.to/dnnsthnnr/idempotent-database-inserts-getting-it-right-2777
- Pandas openpyxl bugs (datetime, XML, empty DataFrame): GitHub pandas issues #39001, #47269, #59882
- CSV encoding UTF-8 BOM complete guide: https://www.elysiate.com/blog/csv-encoding-problems-utf8-bom-character-issues
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Authentik Docker Compose guide 2025: https://www.simplehomelab.com/authentik-docker-compose-guide-2025/
- Authentik 2025.10 release (Redis removal): https://docs.goauthentik.io/releases/2025.2/
- Metabase timezone troubleshooting (dashboard timezone pitfall illustration): https://www.metabase.com/docs/latest/troubleshooting-guide/timezones
- Idempotency in data pipelines (Airbyte): https://airbyte.com/data-engineering-resources/idempotency-in-data-pipelines
- Prevent duplicate records during spreadsheet uploads (CSVBox): https://blog.csvbox.io/prevent-duplicate-records-spreadsheet-uploads/
