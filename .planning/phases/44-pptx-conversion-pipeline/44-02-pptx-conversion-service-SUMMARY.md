---
phase: 44-pptx-conversion-pipeline
plan: 02
subsystem: signage
tags: [backend, pptx, subprocess, asyncio, directus]
requires:
  - "Phase 41 SignageMedia ORM columns (conversion_status, slide_paths, conversion_error, conversion_started_at, uri)"
  - "Phase 43 CI grep guards (test_signage_ci_guards.py — no sync subprocess in signage modules)"
provides:
  - "app.services.signage_pptx.convert_pptx(media_id) — BackgroundTask entry point"
  - "app.services.signage_pptx.delete_slides_dir(media_uuid) — cleanup helper (consumed by plan 44-03 reconvert)"
  - "app.services.signage_pptx._CONVERSION_SEMAPHORE — module-level asyncio.Semaphore(1) (consumed by tests + ops invariants)"
  - "app.services.signage_pptx.CONVERSION_TIMEOUT_S + SLIDES_ROOT constants"
  - "app.services.directus_uploads.upload_pptx_to_directus(filename, content_type, body_stream) — streaming uploader with 50MB cap (consumed by plan 44-03)"
  - "app.services.directus_uploads.MAX_UPLOAD_BYTES constant (52428800)"
affects:
  - "backend/app/config.py — new DIRECTUS_URL + DIRECTUS_ADMIN_TOKEN Settings fields"
tech-stack:
  added:
    - "httpx streaming client for Directus file I/O (already a dep)"
  patterns:
    - "asyncio.create_subprocess_exec instead of subprocess.run (hazard #7)"
    - "module-level asyncio.Semaphore(1) for --workers 1 serialisation"
    - "asyncio.wait_for(..., timeout=CONVERSION_TIMEOUT_S) outer budget"
    - "per-invocation LibreOffice UserInstallation dir (avoids shared-profile deadlock)"
key-files:
  created:
    - "backend/app/services/signage_pptx.py"
    - "backend/app/services/directus_uploads.py"
    - "backend/tests/test_signage_pptx_service.py"
  modified:
    - "backend/app/config.py"
decisions:
  - "Directus download path uses a second (separate) httpx.AsyncClient in signage_pptx rather than importing directus_uploads — upload and download are distinct HTTP shapes (multipart POST vs. streamed GET /assets) and coupling them through one module would complicate the upload-helper's signature for plan 44-03"
  - "Missing Directus uri on a pptx row is treated as invalid_pptx (D-14), not a new error code — keeps the taxonomy closed per CONTEXT"
  - "_set_failed / _set_done wrap their own try/except around the DB write — BackgroundTasks silently swallows exceptions, so a raise inside a state-machine write would leave the row stuck in 'processing'"
  - "DIRECTUS_ADMIN_TOKEN defaults to empty string (not Field(...)) — allows tests/local dev to import the module without failing settings validation; any real Directus call will 401 loudly"
metrics:
  duration: "212s (~3.5m)"
  tasks_completed: 2
  tests_added: 7
  files_created: 3
  files_modified: 1
  completed: "2026-04-19T14:59:13Z"
---

# Phase 44 Plan 02: PPTX Conversion Service Summary

Built the full PPTX→PDF→PNG conversion pipeline with an `asyncio.Semaphore(1)` concurrency gate, a 60s `asyncio.wait_for` budget, per-invocation LibreOffice profile dirs, and a streaming Directus uploader capped at 50MB — all as pure async code with zero sync `subprocess` calls.

## Module Layout

### `backend/app/services/signage_pptx.py` (new)
- **Module state:** `_CONVERSION_SEMAPHORE = asyncio.Semaphore(1)` (D-04), `CONVERSION_TIMEOUT_S = 60` (D-03), `SLIDES_ROOT = "/app/media/slides"` (D-06), `_STDERR_TAIL_BYTES = 2048` (D-15), `_DIRECTUS_FETCH_TIMEOUT_S = 30.0`.
- **Public entry points:**
  - `async convert_pptx(media_id: UUID) -> None` — BackgroundTask coroutine. Pre-flights the row, opens the semaphore, flips to `processing`, downloads the PPTX from Directus into a per-invocation tempdir, runs the pipeline under `asyncio.wait_for`, and always cleans up the tempdir + LO profile in `finally`. Never raises.
  - `delete_slides_dir(media_uuid: UUID) -> None` — best-effort `shutil.rmtree` of `/app/media/slides/<uuid>/`, used by plan 44-03's reconvert endpoint.
- **Private helpers:** `_set_failed`, `_set_done`, `_set_processing`, `_load_media` (SQLAlchemy 2.0 async), `_download_pptx_from_directus` (streaming GET), `_run_pipeline` (subprocess orchestration), `_log_stderr_tail`.

### `backend/app/services/directus_uploads.py` (new)
- `MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024` (D-13).
- `async upload_pptx_to_directus(filename, content_type, body_stream) -> tuple[str, int]` — wraps the incoming async generator in a capped inner generator that tallies bytes and raises `HTTPException(413)` the moment the running total exceeds the cap; streams through `httpx.AsyncClient.post(url, files={"file": (filename, stream, content_type)})`; returns `(directus_file_uuid, total_bytes)`. Non-2xx from Directus logs the first 2KB of the response body and raises `HTTPException(502)`.

### `backend/app/config.py` (modified)
- Added `DIRECTUS_URL: str = Field(default="http://directus:8055", ...)` and `DIRECTUS_ADMIN_TOKEN: str = Field(default="", ...)` alongside the existing Directus settings.

## Subprocess argv (verbatim)

### soffice (PPTX → PDF)
```
soffice --headless -env:UserInstallation=file://<lo_profile> --convert-to pdf --outdir <tempdir> <tempdir>/input.pptx
```
Run via `asyncio.create_subprocess_exec` with `stdout=PIPE, stderr=PIPE`. On cancellation (outer `wait_for` timeout) the handle is `.kill()`-ed and the `CancelledError` is re-raised so `wait_for` surfaces `TimeoutError`.

### pdftoppm (PDF → PNG slides)
```
pdftoppm -r 144 -scale-to-x 1920 -scale-to-y 1080 -png <tempdir>/*.pdf <tempdir>/slide
```
Same exec shape. Produced PNGs (`slide-1.png`, `slide-2.png`, …) are enumerated with `sorted(tempdir.glob("slide-*.png"))` and renamed to zero-padded 3-digit form while being moved to `/app/media/slides/<media_id>/slide-NNN.png` (D-06).

## D-14 Error Codes Emitted

| Code                   | Branch                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| `timeout`              | Outer `asyncio.wait_for` raises `TimeoutError`                     |
| `soffice_failed`       | soffice `returncode != 0` (also: unknown exception fallback inside wait_for) |
| `pdftoppm_failed`      | pdftoppm `returncode != 0`                                         |
| `no_slides_produced`   | pdftoppm rc=0 but `tempdir.glob("slide-*.png")` empty              |
| `invalid_pptx`         | Row has empty `uri`; Directus download raises; soffice rc=0 but no PDF found |

The `abandoned_on_restart` code is NOT emitted here — it is reserved for the scheduler startup hook in plan 44-04.

## Settings Fields Added

| Field                  | Default                  | Purpose                                              |
| ---------------------- | ------------------------ | ---------------------------------------------------- |
| `DIRECTUS_URL`         | `http://directus:8055`   | Base URL of the Directus service in the compose net  |
| `DIRECTUS_ADMIN_TOKEN` | `""` (empty)             | Static admin token for backend→Directus file I/O     |

Both consumed by `app.services.directus_uploads` and `app.services.signage_pptx._download_pptx_from_directus`.

## Tests (7 new)

`backend/tests/test_signage_pptx_service.py`:
- `test_module_constants` — semaphore/timeout/slides-root shape.
- `test_delete_slides_dir_missing_is_noop` / `test_delete_slides_dir_existing_removes_tree` — best-effort cleanup.
- `test_convert_pptx_row_missing_does_not_raise` — short-circuits for unknown media_id.
- `test_convert_pptx_non_pptx_kind_does_not_raise` — leaves non-pptx rows untouched.
- `test_convert_pptx_timeout_sets_failed_timeout` — monkeypatches `_run_pipeline` to sleep, verifies row lands in `failed` / `timeout`.
- `test_convert_pptx_soffice_failure_sets_soffice_failed` — monkeypatches `create_subprocess_exec` to return `returncode=1`, verifies `soffice_failed` is persisted.

All 7 pass, and `test_signage_ci_guards.py` still green after fixing an initial regression (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Module docstring tripped CI grep guard**
- **Found during:** Task 2 (running `test_signage_ci_guards.py` after GREEN)
- **Issue:** The initial docstring listed the forbidden sync APIs inline as `"subprocess.run / subprocess.Popen / subprocess.call are forbidden"`. The CI guard (`test_no_sync_subprocess_in_signage_modules`) does a plain substring match against these exact strings and fires on any occurrence — including prose.
- **Fix:** Rewrote the docstring to describe the ban without reproducing the forbidden substrings verbatim (`"the sync subprocess APIs (run/Popen/call) are all forbidden"`).
- **Files modified:** `backend/app/services/signage_pptx.py`
- **Commit:** folded into `97b80a7` before the GREEN commit.

## Known Stubs

None. `convert_pptx` is fully wired: real Directus download, real subprocess exec, real state-machine writes. Plan 44-03 will connect the upload endpoint to it; plan 44-04 will connect the startup reset hook.

## Self-Check: PASSED

- FOUND: backend/app/services/signage_pptx.py
- FOUND: backend/app/services/directus_uploads.py
- FOUND: backend/tests/test_signage_pptx_service.py
- FOUND: commit c48d93e (directus_uploads helper)
- FOUND: commit 954a79d (test RED)
- FOUND: commit 97b80a7 (signage_pptx GREEN)
- Tests: 7/7 signage_pptx + 4/4 ci_guards green.
