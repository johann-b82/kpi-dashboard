---
phase: 44-pptx-conversion-pipeline
verified: 2026-04-19T00:00:00Z
status: passed
score: 21/21 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 20/21
  gaps_closed:
    - "Integration-test fixtures (tiny-valid.pptx, corrupt.pptx, README.md) exist in backend/tests/fixtures/signage/"
  gaps_remaining: []
  regressions: []
---

# Phase 44: PPTX Conversion Pipeline Verification Report

**Phase Goal:** End-to-end upload + soffice/pdftoppm conversion + reconvert + stuck-row reset, covering SGN-BE-07, SGN-BE-08, SGN-SCH-03, SGN-INF-01.
**Verified:** 2026-04-19
**Status:** passed
**Re-verification:** Yes — after gap closure (`git restore --source=HEAD backend/tests/fixtures/signage/`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Dockerfile installs LibreOffice + poppler + Carlito/Caladea/Noto/DejaVu and creates /app/media/slides | ✓ VERIFIED | `backend/Dockerfile` lines 7–18: single apt layer with all seven required packages plus `mkdir -p /app/media/slides` on a dedicated RUN; `rm -rf /var/lib/apt/lists/*` preserved |
| 2 | signage_pptx.py has a module-level `asyncio.Semaphore(1)` gating all conversions | ✓ VERIFIED | `signage_pptx.py:46` — `_CONVERSION_SEMAPHORE: asyncio.Semaphore = asyncio.Semaphore(1)`; `async with _CONVERSION_SEMAPHORE` wraps the pipeline |
| 3 | convert_pptx wraps the pipeline in `asyncio.wait_for(..., 60)` and kills subprocesses on timeout | ✓ VERIFIED | `signage_pptx.py:190+` — `asyncio.wait_for` over the pipeline; `soffice_proc.kill()` on `CancelledError` inside the subprocess wait; `_set_failed(media_id, "timeout")` on TimeoutError |
| 4 | Per-invocation tempdir + `/tmp/lo_<uuid>` profile deleted in finally on all paths | ✓ VERIFIED | `signage_pptx.py` — `Path(f"/tmp/pptx_{uuid.uuid4()}")` and `/tmp/lo_{uuid}`; `shutil.rmtree(..., ignore_errors=True)` in finally |
| 5 | soffice invoked with `-env:UserInstallation=file:///tmp/lo_<uuid>` | ✓ VERIFIED | `signage_pptx.py:261` — `f"-env:UserInstallation=file://{lo_profile}"` |
| 6 | pdftoppm invoked with `-r 144 -scale-to-x 1920 -scale-to-y 1080 -png` | ✓ VERIFIED | `signage_pptx.py:296–304` — exact argv match |
| 7 | On success writes slide_paths `slides/<media_uuid>/slide-NNN.png` and conversion_status='done' | ✓ VERIFIED | `signage_pptx.py` — `_set_done` writes `conversion_status="done", slide_paths=..., conversion_error=None`; zero-padded 3-digit filenames |
| 8 | On error writes one of {timeout, soffice_failed, pdftoppm_failed, no_slides_produced, invalid_pptx} | ✓ VERIFIED | All five literals present in module (`grep` lines 163, 186, 200, 208, 282, 292, 321, 327) |
| 9 | Last 2KB of subprocess stderr is log.warning-ed but NOT written to conversion_error | ✓ VERIFIED | `_STDERR_TAIL_BYTES: int = 2048`; `_log_stderr_tail("soffice", soffice_stderr)` called before `_set_failed`; conversion_error receives only a taxonomy code |
| 10 | No sync subprocess anywhere in signage_pptx.py | ✓ VERIFIED | Zero `import subprocess` matches; two `asyncio.create_subprocess_exec` call sites (soffice + pdftoppm) |
| 11 | directus_uploads.py streams uploads with 50MB cap and raises HTTPException(413) | ✓ VERIFIED | `MAX_UPLOAD_BYTES`, `async def upload_pptx_to_directus`, `import httpx`, `status_code=413` all present; no `import subprocess` / `import requests` |
| 12 | POST /api/signage/media/pptx (multipart) exists, returns 201, schedules convert_pptx | ✓ VERIFIED | `media.py:174` — `@router.post("/pptx", response_model=SignageMediaRead, status_code=201)`; `background_tasks.add_task(convert_pptx, row.id)` at line 233 |
| 13 | Upload rejects non-PPTX with 400 | ✓ VERIFIED | `media.py:197` — `status_code=400` raised after MIME/extension check |
| 14 | POST /api/signage/media/{id}/reconvert exists, returns 202, deletes slides dir, re-schedules | ✓ VERIFIED | `media.py:237` — `@router.post("/{media_id}/reconvert", ..., status_code=202)`; delete_slides_dir + background_tasks.add_task wired |
| 15 | Admin gate inherited from parent router (no per-route require_admin) | ✓ VERIFIED | `grep require_admin` in media.py returns 0 |
| 16 | Scheduler calls `_run_pptx_stuck_reset()` once in lifespan() before `scheduler.start()` | ✓ VERIFIED | `scheduler.py:430` — `await _run_pptx_stuck_reset()` then line 433 `scheduler.start()` |
| 17 | Stuck-row reset is a single UPDATE flipping `processing` + older than 5 min to `failed/abandoned_on_restart` | ✓ VERIFIED | `scheduler.py:236–264` — `update(SignageMedia).where(conversion_status=="processing", conversion_started_at<cutoff).values(conversion_status="failed", conversion_error="abandoned_on_restart")` |
| 18 | Stuck-reset is NOT registered as a scheduled job (one-shot only) | ✓ VERIFIED | `grep add_job.*_run_pptx_stuck_reset` returns 0 |
| 19 | Integration test file exercises happy/corrupt/stuck-reset/skip-contract | ✓ VERIFIED | All four test functions present; `shutil.which` + `pytest.mark.skipif` guards; `await _run_pptx_stuck_reset` + `await convert_pptx` direct calls |
| 20 | CI grep guards extended for Phase 44 modules | ✓ VERIFIED | `signage_pptx`, `directus_uploads`, and `test_phase44_*` test functions present in `test_signage_ci_guards.py` |
| 21 | Integration test fixtures exist on disk | ✓ VERIFIED | `backend/tests/fixtures/signage/{tiny-valid.pptx (29072 bytes, OOXML/ZIP), corrupt.pptx (32 bytes, intentional non-ZIP), README.md (1057 bytes)}` all present; `git status` clean; `file(1)` confirms tiny-valid.pptx is Microsoft OOXML |

**Score:** 21/21 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/Dockerfile` | LibreOffice + poppler + fonts apt layer + mkdir | ✓ VERIFIED | Single apt layer, all 7 packages, mkdir, preserved rm -rf |
| `backend/app/services/signage_pptx.py` | Orchestrator + Semaphore(1) + async subprocess pipeline | ✓ VERIFIED | 330+ lines, substantive, wired into scheduler + router |
| `backend/app/services/directus_uploads.py` | Async Directus upload helper with 50MB cap | ✓ VERIFIED | Uses httpx.AsyncClient, 413 at cap, imported by router |
| `backend/app/routers/signage_admin/media.py` | POST /pptx + POST /{id}/reconvert | ✓ VERIFIED | Both endpoints present and wired |
| `backend/app/scheduler.py` | `_run_pptx_stuck_reset` + call in lifespan() | ✓ VERIFIED | Defined at line 236, awaited at line 430 before scheduler.start() at 433 |
| `backend/tests/test_signage_pptx_service.py` | Unit tests for service module | ✓ VERIFIED | File exists |
| `backend/tests/test_signage_pptx_upload.py` | Upload endpoint tests | ✓ VERIFIED | File exists |
| `backend/tests/test_signage_pptx_reconvert.py` | Reconvert endpoint tests | ✓ VERIFIED | File exists |
| `backend/tests/test_signage_pptx_stuck_reset.py` | Scheduler hook tests | ✓ VERIFIED | File exists |
| `backend/tests/test_signage_pptx_pipeline_integration.py` | End-to-end tests | ✓ VERIFIED | File exists, 4 tests |
| `backend/tests/test_signage_ci_guards.py` | Extended with Phase 44 guards | ✓ VERIFIED | `signage_pptx`, `directus_uploads`, `test_phase44_*` refs present |
| `backend/tests/fixtures/signage/tiny-valid.pptx` | 2-slide valid PPTX fixture | ✓ VERIFIED | Present on disk (29072 bytes, OOXML/ZIP magic), matches HEAD |
| `backend/tests/fixtures/signage/corrupt.pptx` | Corrupt fixture | ✓ VERIFIED | Present on disk (32 bytes, intentional ASCII/non-ZIP) |
| `backend/tests/fixtures/signage/README.md` | Fixture provenance doc | ✓ VERIFIED | Present on disk (1057 bytes) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Dockerfile apt layer | signage_pptx subprocess calls | binaries on $PATH | ✓ WIRED | libreoffice-impress + poppler-utils installed; soffice + pdftoppm on PATH in Phase 44 image per SUMMARY |
| convert_pptx | asyncio.create_subprocess_exec('soffice', ...) | wait_for(60) + semaphore | ✓ WIRED | soffice argv verified at signage_pptx.py:258-269 |
| convert_pptx | asyncio.create_subprocess_exec('pdftoppm', ...) | chained after soffice | ✓ WIRED | pdftoppm argv verified at signage_pptx.py:296-304 |
| convert_pptx success path | SignageMedia (UPDATE) | AsyncSessionLocal + update() | ✓ WIRED | `_set_done` and `_set_failed` use `update(SignageMedia)` |
| POST /media/pptx | upload_pptx_to_directus | async iter + 50MB cap | ✓ WIRED | media.py imports + calls; cap enforced inside helper |
| POST /media/pptx | convert_pptx | background_tasks.add_task | ✓ WIRED | Line 233 |
| POST /media/{id}/reconvert | delete_slides_dir + convert_pptx | inline delete + BackgroundTask | ✓ WIRED | Line 265 add_task; delete_slides_dir called inline |
| lifespan() | _run_pptx_stuck_reset() | await before scheduler.start() | ✓ WIRED | Line 430 await, line 433 scheduler.start() |
| _run_pptx_stuck_reset | SignageMedia (UPDATE) | update().where(processing AND started_at<cutoff) | ✓ WIRED | Lines 256-265 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 44 suite runs in Phase 44 image | docker run ... pytest tests/test_signage_pptx_* tests/test_signage_ci_guards.py | 33 passed, 1 skipped (per SUMMARY and user confirmation) | ✓ PASS |
| Module import: signage_pptx | grep module-level symbols | _CONVERSION_SEMAPHORE, CONVERSION_TIMEOUT_S, SLIDES_ROOT all present | ✓ PASS |
| Config exposes Directus URL + token | grep DIRECTUS_URL\|DIRECTUS_ADMIN_TOKEN backend/app/config.py | 2 matches | ✓ PASS |
| Working-tree has fixtures | ls backend/tests/fixtures/signage/ | 3 files present (README.md, corrupt.pptx, tiny-valid.pptx); `git status` clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SGN-BE-07 | 44-03, 44-05 | PPTX conversion pipeline (subprocess_exec + wait_for + Semaphore + tempdir + 50MB cap) | ✓ SATISFIED | signage_pptx.py pipeline + directus_uploads.py cap + /pptx endpoint; integration tests |
| SGN-BE-08 | 44-02, 44-05 | signage_media.conversion_status state machine + startup reset hook | ✓ SATISFIED | convert_pptx state writes (pending → processing → done/failed) + scheduler hook |
| SGN-SCH-03 | 44-04, 44-05 | Stuck-row reset on scheduler startup | ✓ SATISFIED | `_run_pptx_stuck_reset` single UPDATE; integration test; guaranteed before scheduler.start() |
| SGN-INF-01 | 44-01, 44-05 | Dockerfile with LibreOffice + poppler + fidelity fonts | ✓ SATISFIED | Dockerfile apt layer with Carlito/Caladea/Noto/DejaVu + libreoffice-impress/core + poppler-utils |

All four requirement IDs declared in plan frontmatters are accounted for. REQUIREMENTS.md maps exactly these four IDs to Phase 44 (no orphans).

### Anti-Patterns Found

None. No stubs, TODO/FIXME, hardcoded empty returns, or sync-subprocess anti-patterns found in Phase 44 source modules. CI grep guards actively enforce this going forward. The previously-flagged working-tree deletion of the signage fixtures has been reverted via `git restore --source=HEAD backend/tests/fixtures/signage/`; `git status` is clean.

### Human Verification Required

None. All truths are verifiable programmatically and all checks pass.

### Gaps Summary

None. The sole gap from the initial verification (workspace-only deletion of the three integration-test fixtures) has been resolved by restoring from HEAD. All three fixtures are present on disk with correct sizes and content types (tiny-valid.pptx = 29072-byte OOXML, corrupt.pptx = 32-byte intentional non-ZIP, README.md = 1057-byte provenance doc), the working tree is clean, and all 21 must-haves are now verified.

Regression-suite note (unchanged and environmental): the full backend test suite fails outside docker-compose due to postgres DNS; this is not a Phase 44 regression, and all Phase 44-specific tests pass in-container (33 passed / 1 skip-contract).

---

_Verified: 2026-04-19 (re-verification after fixture restoration)_
_Verifier: Claude (gsd-verifier)_
