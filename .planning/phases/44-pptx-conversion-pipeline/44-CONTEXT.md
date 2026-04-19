# Phase 44: PPTX Conversion Pipeline - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A PPTX upload produces an ordered sequence of 1920×1080 PNG slides server-side without wedging the event loop, OOMing the container, or silently rendering with wrong fonts. Covers: Dockerfile apt layer (LibreOffice + poppler-utils + fonts), multipart upload endpoint (`POST /api/signage/media/pptx`), recovery endpoint (`POST /api/signage/media/{id}/reconvert`), async conversion pipeline (`soffice → pdf → pdftoppm`), `signage_media.conversion_status` state machine, scheduler-startup stuck-row reset.

**NOT in this phase:** SSE broadcast (Phase 45), admin upload UI (Phase 46), player-side slide playback (Phase 47), Pi provisioning / E2E (Phase 48), PPTX re-conversion on font-package updates, conversion queues beyond `Semaphore(1)`, retry counters.

</domain>

<decisions>
## Implementation Decisions

### Worker Location (roadmap Decision 1 — resolved)
- **D-01:** LibreOffice runs **in the `api` container** via FastAPI `BackgroundTasks`. No dedicated `pptx-worker` service for this phase. Rationale: small-fleet, admin-only upload surface; the event-loop / OOM / font-fallback risks called out in the Goal are fully addressed by `asyncio.subprocess_exec` + `asyncio.wait_for(60)` + `asyncio.Semaphore(1)` + per-invocation `UserInstallation` tempdir. Pitfall 22 isolation is noted as a deferred hardening option (future phase if upload surface widens or fleet scales).

### Conversion Pipeline
- **D-02:** **Two-step conversion**: `asyncio.subprocess_exec("soffice", "--headless", "--convert-to", "pdf", "--outdir", <tmp>, <pptx>)` → `asyncio.subprocess_exec("pdftoppm", "-r", "144", "-scale-to-x", "1920", "-scale-to-y", "1080", "-png", <pdf>, "slide")`. Poppler's `pdftoppm` gives deterministic 1920×1080 PNG output and is already required by SGN-INF-01. Single-step `soffice --convert-to png` rejected: multi-slide output naming/order is historically quirky and direct-to-PNG uses LO's screen renderer, which doesn't honor an explicit slide resolution the way PDF→pdftoppm does.
- **D-03:** **60s total budget** enforced at the orchestrator level via a single `asyncio.wait_for(convert_pptx(...), timeout=60)` wrapper. On timeout: kill any live subprocess (`proc.kill()`), remove the per-invocation tempdir, write `conversion_status='failed'` + `conversion_error='timeout'`.
- **D-04:** **Concurrency gate**: module-level `asyncio.Semaphore(1)` owned by the conversion service (`backend/app/services/signage_pptx.py`). Only one conversion runs at a time across the single-worker `api` container. Matches the `--workers 1` invariant (SGN-INF-03).
- **D-05:** **Per-invocation tempdir** under `/tmp/pptx_<uuid>/` with `-env:UserInstallation=file:///tmp/lo_<uuid>` passed to soffice. Always deleted in a `finally` block — success or failure.
- **D-06:** **Output layout**: converted slides written to `/app/media/slides/<media_uuid>/slide-001.png`, `slide-002.png`, … (zero-padded, 3 digits). Matches Phase 41 D-02 convention. `signage_media.slide_paths` is set to the JSONB array `["slides/<media_uuid>/slide-001.png", ...]` (relative to `/app/media/`).

### State Machine
- **D-07:** States: `pending → processing → done` on success; `pending → processing → failed` on error. Only applies to `kind='pptx'` rows — non-PPTX rows keep `conversion_status = NULL`.
- **D-08:** **On upload (POST .../pptx)**: insert row with `conversion_status='pending'`, `conversion_started_at=NULL`. Return 201 immediately with the row. BackgroundTask then flips to `processing` + sets `conversion_started_at = now()`, runs pipeline, flips to `done` (with `slide_paths` populated) or `failed` (with `conversion_error` populated).
- **D-09:** **Stuck-row recovery** (SGN-SCH-03): scheduler startup query flips any row where `conversion_status='processing' AND conversion_started_at < now() - interval '5 minutes'` → `conversion_status='failed'`, `conversion_error='abandoned_on_restart'`. **Fail-forward only** — no re-queue, no retry counter. Admin must call `/reconvert` explicitly. Logged at WARNING.

### Upload API
- **D-10:** **`POST /api/signage/media/pptx`** — multipart/form-data:
  - `file: UploadFile` (required, content-type must be `application/vnd.openxmlformats-officedocument.presentationml.presentation` OR extension `.pptx`)
  - `title: str` (required, ≤255)
  - Returns 201 `SignageMediaRead` with `kind=pptx, conversion_status=pending, slide_paths=null`
  - Inherits the parent `signage_admin` router admin gate (no per-route `require_admin`).
  - Errors: 413 if upload > 50MB (enforced via streaming check before Directus write); 400 on mimetype/extension mismatch.
- **D-11:** **Directus is the binary store for the raw PPTX**. Upload flow: stream multipart body → write to Directus files via internal Directus admin token → take returned Directus UUID → insert `signage_media` row with `uri=<directus_uuid>, mime_type='application/vnd...presentation', size_bytes=<streamed bytes>`. Rationale: matches Phase 41 D-01 ("Directus is the primary media store for user uploads") and keeps raw PPTX bytes off the `api` filesystem. The *derived* slide PNGs stay on backend disk per D-06 / Phase 41 D-02.
- **D-12:** **`POST /api/signage/media/{id}/reconvert`** — no body. 404 if id not found, 409 if `kind != 'pptx'`, 409 if `conversion_status = 'processing'`. On success: flips row to `pending` (clears `slide_paths`, `conversion_error`, `conversion_started_at`) and enqueues a fresh BackgroundTask. Returns 202 with the row. Deletes the old `/app/media/slides/<uuid>/` directory at the start of the new conversion (same media_uuid is reused).
- **D-13:** **50MB cap** enforced at the POST boundary via a streaming size check (abort + 413 once cumulative bytes exceed `50 * 1024 * 1024`). Do not read full body into memory before checking.

### Failure Surface
- **D-14:** `conversion_error` stores a **short machine code + human message**, exposed as-is on admin `GET /api/signage/media/{id}`. Code taxonomy (initial set — can grow):
  - `timeout` — "soffice+pdftoppm pipeline exceeded 60s budget"
  - `soffice_failed` — "soffice exited non-zero (rc=N)"
  - `pdftoppm_failed` — "pdftoppm exited non-zero (rc=N)"
  - `no_slides_produced` — "conversion succeeded but output dir contains 0 PNGs"
  - `invalid_pptx` — "soffice rejected file (likely corrupt or not a real .pptx)"
  - `abandoned_on_restart` — "row was `processing` at scheduler startup and exceeded 5 min; reset to failed"
- **D-15:** **Full stderr tail** (last 2KB of each subprocess stderr) is logged at `log.warning()` only — NOT written to `conversion_error`. Keeps filesystem paths, LO internals, and version-specific noise out of the admin API.

### Dockerfile / Infrastructure (SGN-INF-01)
- **D-16:** Backend `Dockerfile` adds in a single `apt-get install` layer: `libreoffice-impress`, `libreoffice-core`, `poppler-utils`, `fonts-crosextra-carlito` (Calibri metric-compat), `fonts-crosextra-caladea` (Cambria metric-compat), `fonts-noto-core`, `fonts-dejavu-core`. Verified post-build by `fc-list | grep -E 'Carlito|Caladea'` returning ≥1 hit each.
- **D-17:** `/app/media/slides/` created with `mkdir -p` at image build time; owned by the non-root app user. No volume mount for slides — they are ephemeral/re-derivable (Phase 43 D-16 cleanup hook already deletes them on media DELETE).

### Scheduler Integration (SGN-SCH-03)
- **D-18:** Add `_run_pptx_stuck_reset()` to `backend/app/scheduler.py` as a **one-shot startup hook** (not a recurring job). Executes synchronously during scheduler init, before the cron/interval jobs are registered. Logs count of reset rows at INFO. If zero rows to reset: log at DEBUG. Idempotent — rerunning on clean state is a no-op.

### Claude's Discretion
- Exact name of the conversion service module (e.g., `signage_pptx.py` vs `pptx_converter.py`) — pick per existing naming style.
- Whether `conversion_started_at` is updated via `func.now()` or application-side `datetime.now(UTC)` — pick per existing convention.
- Test strategy around soffice — planner may choose real invocation in CI (slow but honest) vs mocked subprocess + separate tiny-PPTX fixture for integration.
- Precise log message formats (INFO/WARNING payloads).
- Directus upload token handling (env var name, how it's injected into the api container) — follow existing Directus integration conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 44: PPTX Conversion Pipeline" — phase goal, success criteria, Decision 1 (resolved here as D-01)
- `.planning/REQUIREMENTS.md` — SGN-BE-07, SGN-BE-08, SGN-SCH-03, SGN-INF-01, SGN-INF-03
- `.planning/PROJECT.md` §"Current Milestone: v1.16 Digital Signage" — target features, small-fleet scope, deferred items

### Prior Phase Context (locked decisions)
- `.planning/phases/41-signage-schema-models/41-CONTEXT.md` §Decisions D-01, D-02, D-07 — Directus vs backend-disk split, slide path convention, `signage_media` PPTX columns
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` §D-16 — media DELETE post-commit cleanup hook that removes `/app/media/slides/<uuid>/`

### Prior Phase Artifacts (code to read before planning)
- `backend/app/models/signage.py` — `SignageMedia` ORM class (existing `conversion_status`, `slide_paths`, `conversion_error`, `conversion_started_at` columns)
- `backend/app/routers/signage_admin/media.py` — existing `POST /api/signage/media` (JSON, Directus UUID via D-21 option b) that Phase 44 extends with a sibling multipart endpoint
- `backend/app/routers/signage_admin/__init__.py` — parent router admin gate pattern (do NOT re-add `require_admin` on new media endpoints)
- `backend/app/scheduler.py` — existing startup-registration pattern for `signage_pairing_cleanup` + `signage_heartbeat_sweeper`; stuck-row reset hook (D-18) follows same shape
- `backend/Dockerfile` — apt layer that D-16 extends

### External (operational)
- LibreOffice `soffice --headless` CLI — standard `--convert-to pdf --outdir` invocation
- `pdftoppm` from `poppler-utils` — `-r 144 -scale-to-x 1920 -scale-to-y 1080 -png` flags produce deterministic 1920×1080 output

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SignageMedia` ORM model — PPTX columns already landed in Phase 41; no schema migration needed.
- `signage_admin` parent router — new endpoints mount under existing admin-gated prefix; no new auth plumbing.
- `scheduler.py` startup registration pattern — `_run_pptx_stuck_reset()` slots into the same init block as pairing-cleanup and heartbeat-sweeper registrations.
- Phase 43 D-16 post-commit cleanup already deletes `/app/media/slides/<uuid>/` on media DELETE — Phase 44 needs to align its reconvert cleanup with the same directory convention, nothing more.

### Established Patterns
- Async SQLAlchemy 2.0 (`AsyncSession` + `selectinload`) — D-09 stuck-row reset and D-12 reconvert status transitions must use the same.
- `asyncio.subprocess_exec` (already mandated by SGN-BE-10 grep guards — no `subprocess.run` allowed in `backend/app/signage*`).
- Router-level `Depends(require_admin)` on the parent — never per-endpoint.
- APScheduler singleton with `--workers 1` invariant documented inline (mirror the existing comment block pattern).

### Integration Points
- `backend/Dockerfile` — D-16 apt layer extension.
- `backend/app/routers/signage_admin/media.py` — sibling endpoints `/pptx` (multipart) and `/{id}/reconvert` added here.
- `backend/app/services/signage_pptx.py` — NEW module owning the subprocess orchestration + `asyncio.Semaphore(1)`.
- `backend/app/scheduler.py` — NEW one-shot startup hook `_run_pptx_stuck_reset()`.
- Directus upload helper — either an existing utility (if one was introduced in an earlier milestone) or a NEW thin wrapper around the Directus files API using the admin token already in the container env.

</code_context>

<specifics>
## Specific Ideas

- Carlito = Calibri metric-compatible font (crucial for PPTX fidelity — most corporate PPTXs use Calibri).
- Caladea = Cambria metric-compatible. Together with Noto + DejaVu they cover the vast majority of "default" PPTX fonts without licensing issues.
- Slide naming zero-padded to 3 digits (`slide-001.png`) so lexical sort matches slide order — this matters because `slide_paths` ordering is load-bearing for the player bundle (Phase 47).
- `/reconvert` deliberately returns 409 (not 202) if `conversion_status='processing'` — prevents an admin from double-triggering while a conversion is in flight.
- 50MB is a hard product cap; the number comes from the Goal's success criterion #2.

</specifics>

<deferred>
## Deferred Ideas

- **Isolated `pptx-worker` container** (Pitfall 22 hardening) — revisit if upload surface widens beyond admin-only or fleet grows past ~20 devices.
- **Retry counter / auto-retry policy** (SGN-SCH-03 option B/C) — would need additive schema; revisit only if real transient failures are observed in production.
- **PPTX re-conversion on font-package updates** (e.g., new Carlito version changes metrics) — out of scope; admin can `/reconvert` manually.
- **Conversion progress / slide-count streaming** (SSE "slide 3 of 20 ready") — UX nicety for Phase 46 admin UI if 60s feels long in practice.
- **Polling queue beyond `Semaphore(1)`** — fleet is ≤5 devices and PPTX uploads are rare; queueing complexity is not justified.
- **GPU-accelerated rasterization** (pdfium, Ghostscript) — unnecessary at this scale.

</deferred>

---

*Phase: 44-pptx-conversion-pipeline*
*Context gathered: 2026-04-19*
