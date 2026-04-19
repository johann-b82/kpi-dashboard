---
phase: 44-pptx-conversion-pipeline
plan: 03
subsystem: signage
tags: [backend, pptx, fastapi, multipart, background-tasks]
requires:
  - "Plan 44-02 app.services.signage_pptx.convert_pptx(media_id)"
  - "Plan 44-02 app.services.signage_pptx.delete_slides_dir(media_uuid)"
  - "Plan 44-02 app.services.directus_uploads.upload_pptx_to_directus + MAX_UPLOAD_BYTES"
  - "Phase 43 signage_admin router with router-level admin gate"
  - "Phase 41 SignageMedia ORM (conversion_status/slide_paths/conversion_error/conversion_started_at)"
provides:
  - "POST /api/signage/media/pptx — multipart upload endpoint (consumes the service from 44-02)"
  - "POST /api/signage/media/{id}/reconvert — state-machine reset endpoint"
affects:
  - "backend/app/routers/signage_admin/media.py"
tech-stack:
  added: []
  patterns:
    - "FastAPI UploadFile + File/Form multipart pattern"
    - "async chunked iterator over UploadFile.read(64KB) for streaming upload"
    - "BackgroundTasks scheduled after await db.commit() so the task re-fetches with its own session"
    - "Admin gate inherited from parent router only (no per-route require_admin)"
key-files:
  created:
    - "backend/tests/test_signage_pptx_upload.py"
    - "backend/tests/test_signage_pptx_reconvert.py"
  modified:
    - "backend/app/routers/signage_admin/media.py"
decisions:
  - "Fallback MIMEs for PPTX: application/octet-stream AND application/zip when filename ends .pptx (browsers send both)"
  - "Uploader stub in tests drains body_stream before returning to mirror the real helper's streaming contract"
  - "delete_slides_dir called inline in the endpoint (not inside convert_pptx) so the wipe happens before the BackgroundTask even starts — simpler and safer than deferring to the task body"
  - "async def _body_iter() yields the chunks so HTTPException(413) inside the helper's inner generator aborts the upstream request BEFORE the full body enters memory (D-13)"
requirements:
  - SGN-BE-07
metrics:
  duration: "4m (~240s)"
  tasks_completed: 2
  tests_added: 9
  files_created: 2
  files_modified: 1
  completed: "2026-04-19T15:05:26Z"
---

# Phase 44 Plan 03: Upload & Reconvert Endpoints Summary

Added two PPTX admin endpoints that bolt the Plan 44-02 conversion service onto the signage admin surface — a streaming multipart upload that pushes raw bytes into Directus with a 50MB inline cap, and a reconvert endpoint that resets the state machine and wipes derived slides before re-scheduling conversion.

## Endpoint Paths

Full paths (parent router prefix `/api/signage` from `signage_admin/__init__.py` + local prefix `/media`):

| Path | Method | Success status | Body type |
| --- | --- | --- | --- |
| `/api/signage/media/pptx` | POST | 201 | `multipart/form-data` (file + title) |
| `/api/signage/media/{media_id}/reconvert` | POST | 202 | *none* |

Both inherit `Depends(get_current_user), Depends(require_admin)` from the parent router — zero per-route admin decoration (hazard #5 preserved).

## Status-Code Table

| Code | When |
| ---- | ---- |
| `201` | `/pptx` happy path — row inserted with `conversion_status='pending'`, convert_pptx scheduled |
| `202` | `/{id}/reconvert` happy path — row flipped to pending, slides wiped, convert_pptx re-scheduled |
| `400` | `/pptx` MIME/extension mismatch (not PPTX MIME and filename does not end `.pptx`) |
| `404` | `/{id}/reconvert` — media_id not found |
| `409` | `/{id}/reconvert` — `{"detail": "media is not a PPTX"}` (kind != pptx) |
| `409` | `/{id}/reconvert` — `{"detail": "conversion already in progress"}` (status == processing) |
| `413` | `/pptx` — upload body exceeds 50MB (raised by `upload_pptx_to_directus` inside the stream iterator, BEFORE the full body enters memory) |
| `502` | `/pptx` — upstream Directus rejects (propagated from `upload_pptx_to_directus`) |

## MIME Validation Rules

Canonical accept:
- `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` → accept regardless of filename.

Fallback accept (D-10 — browsers often mis-MIME .pptx):
- Filename ends `.pptx` AND content-type in `{application/octet-stream, application/zip}` → accept.

Everything else → `400 file must be a .pptx presentation`. Row is NOT inserted and `convert_pptx` is NOT scheduled.

## BackgroundTasks Wiring

```python
background_tasks.add_task(convert_pptx, row.id)
```

- Scheduled **after** `await db.commit()` so the background coroutine can re-fetch with its own `AsyncSessionLocal()` session (D-08).
- The BackgroundTasks instance is injected as a function parameter (FastAPI native DI) — no module-level task queue.
- `convert_pptx` is imported once in the router module's namespace, so monkeypatching in tests (`monkeypatch.setattr(media_mod, "convert_pptx", MagicMock())`) intercepts the scheduled callable cleanly.

The reconvert endpoint calls `delete_slides_dir(media_id)` **inline** (synchronous `shutil.rmtree(..., ignore_errors=True)` from Plan 44-02) BEFORE scheduling `convert_pptx`. Rationale: cleanup is best-effort and non-blocking; doing it inline keeps the state-machine write + filesystem cleanup + re-schedule as three linear steps in a single request handler.

## Streaming Cap (D-13)

```python
async def _body_iter():
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        yield chunk

directus_uuid, total_bytes = await upload_pptx_to_directus(
    filename=file.filename or "upload.pptx",
    content_type=PPTX_MIME,
    body_stream=_body_iter(),
)
```

Inside `upload_pptx_to_directus` (Plan 44-02), an inner async generator tallies bytes as they arrive and raises `HTTPException(status_code=413)` the moment `total_bytes > MAX_UPLOAD_BYTES` (52428800). That exception propagates up through the FastAPI handler, so no `SignageMedia` row is ever persisted for an over-cap upload. Tests verify this by monkeypatching the helper to raise 413 directly and asserting `count(*) == 0` + `convert_pptx.call_count == 0`.

## Tests (9 new)

`backend/tests/test_signage_pptx_upload.py` (4):
- `test_upload_pptx_happy_path_canonical_mime` — 201 + row pending + convert_pptx scheduled with `row.id`.
- `test_upload_pptx_accepts_octet_stream_with_pptx_extension` — fallback MIME path.
- `test_upload_pptx_rejects_non_pptx` — 400 + no row + no schedule.
- `test_upload_pptx_returns_413_when_uploader_raises` — cap enforcement propagates.

`backend/tests/test_signage_pptx_reconvert.py` (5):
- `test_reconvert_404_when_not_found` — missing id → 404, no side effects.
- `test_reconvert_409_when_kind_not_pptx` — image row → 409 "media is not a PPTX".
- `test_reconvert_409_when_already_processing` — 409 "conversion already in progress".
- `test_reconvert_202_from_failed_resets_row` — full reset + delete_slides_dir + convert_pptx scheduled.
- `test_reconvert_202_from_done_also_resets` — done → pending reset also clean.

Full verification suite (4 files, 25 tests):
```
tests/test_signage_pptx_upload.py  .... [4]
tests/test_signage_pptx_reconvert.py ..... [5]
tests/test_signage_admin_router.py ............ [12]
tests/test_signage_router_deps.py ... [3]
tests/test_signage_ci_guards.py .... [4 — unchanged from 44-02]
25 passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] asyncpg DataError when seeding JSONB slide_paths**
- **Found during:** Task 2 GREEN (first full verification run)
- **Issue:** `INSERT INTO signage_media (..., slide_paths) VALUES ($6, ...)` with a Python list `['slides/x/slide-001.png']` → `asyncpg.exceptions.DataError: invalid input for query argument $6: ['slides/x/slide-001.png'] (expected str, got list)`. asyncpg does not auto-serialise Python lists into JSONB — the column expects a JSON string.
- **Fix:** Encode with `json.dumps(slide_paths)` on insert; decode with `json.loads(row["slide_paths"])` on fetch. Kept localised to the reconvert test module's fixture helpers.
- **Files modified:** `backend/tests/test_signage_pptx_reconvert.py`
- **Commit:** folded into `b19c373` (Task 2 GREEN commit).

## Known Stubs

None. Both endpoints are fully wired:
- `/pptx` writes the real row, invokes the real Directus uploader (mocked only in tests), schedules the real convert_pptx via real BackgroundTasks.
- `/{id}/reconvert` performs the real state-machine write, calls the real delete_slides_dir, schedules the real convert_pptx.

Plan 44-04 adds the scheduler stuck-row reset on startup; plan 44-05 adds the end-to-end integration test against a real LibreOffice + pdftoppm binary.

## Self-Check: PASSED

- FOUND: backend/app/routers/signage_admin/media.py (modified)
- FOUND: backend/tests/test_signage_pptx_upload.py
- FOUND: backend/tests/test_signage_pptx_reconvert.py
- FOUND: commit 787731d (test RED — upload)
- FOUND: commit 52ff5db (feat GREEN — upload)
- FOUND: commit 955949f (test RED — reconvert)
- FOUND: commit b19c373 (feat GREEN — reconvert)
- Tests: 25/25 green across upload + reconvert + admin router + dep audit + CI guards.
- Acceptance greps all match (1× @router.post("/pptx"), 1× @router.post("/{media_id}/reconvert"), 2× background_tasks.add_task(convert_pptx, row.id), 0× require_admin, 4× PPTX_MIME).
