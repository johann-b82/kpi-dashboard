---
phase: 44-pptx-conversion-pipeline
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/signage_pptx.py
  - backend/app/services/directus_uploads.py
autonomous: true
requirements:
  - SGN-BE-08

must_haves:
  truths:
    - "A single module-level asyncio.Semaphore(1) serialises all PPTX conversions"
    - "convert_pptx() wraps the full pipeline in asyncio.wait_for(..., timeout=60) and kills any live subprocess on timeout"
    - "A per-invocation tempdir (/tmp/pptx_<uuid>/) is created and deleted in a finally block on every code path (success, failure, timeout)"
    - "soffice is invoked with `-env:UserInstallation=file:///tmp/lo_<uuid>` to avoid the shared-profile deadlock"
    - "pdftoppm is invoked with `-r 144 -scale-to-x 1920 -scale-to-y 1080 -png` to produce deterministic 1920x1080 PNGs"
    - "Output slides are written to /app/media/slides/<media_uuid>/slide-001.png, slide-002.png, ... (zero-padded 3 digits)"
    - "On success the service writes slide_paths = ['slides/<media_uuid>/slide-001.png', ...] (relative to /app/media/) and flips conversion_status='done'"
    - "On error conversion_status='failed' and conversion_error carries one of the D-14 taxonomy codes"
    - "Last 2KB of each subprocess stderr is log.warning()-ed but NEVER written into conversion_error (D-15)"
    - "No sync subprocess.run/Popen/call anywhere in the module (cross-cutting hazard #7)"
  artifacts:
    - path: "backend/app/services/signage_pptx.py"
      provides: "convert_pptx(media_id) orchestrator + module-level asyncio.Semaphore(1)"
      contains: "asyncio.Semaphore(1)"
    - path: "backend/app/services/directus_uploads.py"
      provides: "async upload_to_directus(filename, content_type, body_iter) helper returning the Directus file UUID"
      contains: "httpx.AsyncClient"
  key_links:
    - from: "convert_pptx"
      to: "asyncio.subprocess_exec('soffice', ...)"
      via: "asyncio.wait_for(..., timeout=60) inside 'async with _CONVERSION_SEMAPHORE'"
      pattern: "asyncio\\.subprocess_exec.*soffice"
    - from: "convert_pptx"
      to: "asyncio.subprocess_exec('pdftoppm', ...)"
      via: "chained after soffice, same wait_for budget"
      pattern: "asyncio\\.subprocess_exec.*pdftoppm"
    - from: "convert_pptx success path"
      to: "SignageMedia row (conversion_status/slide_paths/conversion_error)"
      via: "AsyncSessionLocal() -> update(SignageMedia)"
      pattern: "update\\(SignageMedia\\)"
---

<objective>
Create the conversion service module that owns the whole soffice→pdftoppm pipeline, the concurrency gate, timeout enforcement, and the state-machine writes to `signage_media`. Also create a thin async Directus file-upload helper consumed by plan 44-03's upload endpoint.

Purpose: implements SGN-BE-08 (state-machine writes + timeout + semaphore) per CONTEXT D-02..D-07, D-14, D-15. This module is the single point where the PPTX pipeline actually runs; plan 44-03 only schedules it.

Output:
- `backend/app/services/signage_pptx.py` — new module with `_CONVERSION_SEMAPHORE`, `convert_pptx(media_id: uuid.UUID) -> None` (the BackgroundTask entry point), `delete_slides_dir(media_uuid)` helper, and the subprocess helpers.
- `backend/app/services/directus_uploads.py` — new async helper module (`upload_pptx_to_directus(filename, content_type, stream) -> str`) returning the Directus file UUID; consumed by plan 44-03.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md
@backend/app/models/signage.py
@backend/app/scheduler.py
@backend/app/config.py
@backend/app/database.py
@backend/app/routers/signage_admin/media.py

<interfaces>
<!-- Contracts downstream plans will consume. -->

From backend/app/models/signage.py (existing — do NOT modify):
```python
class SignageMedia(Base):
    id: Mapped[uuid.UUID]
    kind: Mapped[str]                     # values include 'pptx'
    conversion_status: Mapped[str | None] # 'pending' | 'processing' | 'done' | 'failed'
    slide_paths: Mapped[list | None]      # JSONB list of relative paths
    conversion_error: Mapped[str | None]  # short machine code per D-14
    conversion_started_at: Mapped[datetime | None]
    uri: Mapped[str | None]               # Directus file UUID (D-11)
    mime_type: Mapped[str | None]
    size_bytes: Mapped[int | None]
```

From backend/app/database.py (existing):
```python
AsyncSessionLocal: async_sessionmaker[AsyncSession]   # open own session inside background tasks
```

New public interfaces this plan creates (consumed by plan 44-03 and plan 44-04):
```python
# backend/app/services/signage_pptx.py
_CONVERSION_SEMAPHORE: asyncio.Semaphore   # module-level, Semaphore(1); imported by tests only
CONVERSION_TIMEOUT_S: int = 60             # module constant, referenced by tests
SLIDES_ROOT: str = "/app/media/slides"     # module constant

async def convert_pptx(media_id: uuid.UUID) -> None: ...
# BackgroundTask entry: opens own AsyncSessionLocal, acquires semaphore,
# runs pipeline inside asyncio.wait_for, writes terminal status+error OR
# slide_paths, always deletes tempdir. Never raises to caller.

def delete_slides_dir(media_uuid: uuid.UUID) -> None: ...
# Best-effort shutil.rmtree of /app/media/slides/<media_uuid>/.
# Used by plan 44-03 reconvert endpoint to clear the old derived dir.

# backend/app/services/directus_uploads.py
async def upload_pptx_to_directus(
    filename: str,
    content_type: str,
    body_stream: AsyncIterator[bytes],
) -> tuple[str, int]: ...
# Returns (directus_file_uuid, total_bytes_streamed).
# Raises HTTPException(413) once cumulative bytes exceed 50*1024*1024.
# Used by plan 44-03 POST /api/signage/media/pptx.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write directus_uploads helper with 50MB streaming cap</name>
  <read_first>
    - backend/app/config.py (existing DIRECTUS_* settings)
    - backend/app/routers/uploads.py (existing upload endpoint for reference — may or may not contain a pattern worth mirroring)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-11, D-13
  </read_first>
  <files>backend/app/services/directus_uploads.py</files>
  <action>
Create a NEW module `backend/app/services/directus_uploads.py`.

Required exports:

```python
MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024  # D-13: 50MB hard cap

async def upload_pptx_to_directus(
    filename: str,
    content_type: str,
    body_stream: AsyncIterator[bytes],
) -> tuple[str, int]:
    """Stream `body_stream` into Directus /files; return (directus_file_uuid, total_bytes).

    Enforces the 50MB cap by tallying bytes as they arrive and raising
    HTTPException(413) the moment the running total exceeds MAX_UPLOAD_BYTES.
    NEVER reads the whole body into memory first.
    """
```

Implementation rules:
- Use `httpx.AsyncClient` (already a backend dep — confirm by grepping requirements.txt; if somehow missing, add it). Do NOT use `requests` (sync) or `aiohttp`.
- Directus base URL and admin token: read from the existing `Settings` class in `backend/app/config.py`. If the settings needed (e.g. `DIRECTUS_URL`, `DIRECTUS_ADMIN_TOKEN`) do not yet exist, add them as required `Field(...)` entries with env-var defaults matching the rest of the `DIRECTUS_*` settings pattern. Do NOT invent a new config module.
- Upload uses Directus' multipart `POST /files` endpoint with header `Authorization: Bearer <DIRECTUS_ADMIN_TOKEN>`.
- Wrap the body stream in an inner async generator that yields chunks while accumulating `total_bytes`; before yielding a chunk that would exceed `MAX_UPLOAD_BYTES`, raise `HTTPException(status_code=413, detail="pptx upload exceeds 50MB cap")`.
- Parse response JSON, pull `data.id` (Directus file UUID). On non-2xx from Directus raise `HTTPException(status_code=502, detail="directus upload failed")` with a `log.warning` including status + body snippet.
- Return `(directus_file_uuid, total_bytes)`.

Do NOT:
- Use `subprocess` of any kind.
- Persist the uploaded file to local disk before sending it onward — the whole point is streaming.
- Swallow `HTTPException` — it must bubble to the FastAPI route handler.

If `DIRECTUS_URL` / `DIRECTUS_ADMIN_TOKEN` (or equivalent names already in this codebase) are not present in `backend/app/config.py`, add them in the same file alongside `DIRECTUS_SECRET`; annotate them with `description=` strings. CONTEXT D-11 leaves naming to Claude's discretion — pick names consistent with the rest of the `DIRECTUS_*` settings already in config.py.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.services.directus_uploads import upload_pptx_to_directus, MAX_UPLOAD_BYTES; assert MAX_UPLOAD_BYTES == 50*1024*1024; print('ok')"</automated>
  </verify>
  <done>
    - `backend/app/services/directus_uploads.py` exists.
    - `MAX_UPLOAD_BYTES` constant equals 52428800.
    - `upload_pptx_to_directus` is an `async def` coroutine.
    - Module imports `httpx`.
    - No `import subprocess`, no `import requests` in the module.
    - Python import works (`python -c "from app.services.directus_uploads import upload_pptx_to_directus"` exits 0 inside the backend container).
  </done>
  <acceptance_criteria>
    - File backend/app/services/directus_uploads.py exists.
    - `grep -c "MAX_UPLOAD_BYTES: int = 50 \* 1024 \* 1024" backend/app/services/directus_uploads.py` returns 1.
    - `grep -c "async def upload_pptx_to_directus" backend/app/services/directus_uploads.py` returns 1.
    - `grep -c "import httpx" backend/app/services/directus_uploads.py` returns 1.
    - `grep -c "status_code=413" backend/app/services/directus_uploads.py` returns ≥1.
    - `grep -cE "^import subprocess|^from subprocess" backend/app/services/directus_uploads.py` returns 0.
    - `grep -cE "^import requests|^from requests" backend/app/services/directus_uploads.py` returns 0.
    - Config module contains DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN (or the equivalent chosen names) as Settings fields — `grep -cE "DIRECTUS_URL|DIRECTUS_ADMIN_TOKEN|DIRECTUS_TOKEN" backend/app/config.py` returns ≥2.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write signage_pptx conversion service (semaphore + wait_for + subprocess pipeline + state writes)</name>
  <read_first>
    - backend/app/services/signage_pairing.py (for existing async-service module style)
    - backend/app/services/signage_resolver.py (for existing async SQLAlchemy 2.0 usage)
    - backend/app/scheduler.py (for AsyncSessionLocal usage + logging idiom)
    - backend/app/models/signage.py (SignageMedia columns touched: conversion_status, conversion_started_at, slide_paths, conversion_error)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-02 through D-07, D-14, D-15
    - .planning/ROADMAP.md §"Phase 44" success criterion 1, 2
  </read_first>
  <files>backend/app/services/signage_pptx.py</files>
  <behavior>
    - Module exposes `_CONVERSION_SEMAPHORE = asyncio.Semaphore(1)` at module level.
    - Module exposes `CONVERSION_TIMEOUT_S = 60` and `SLIDES_ROOT = "/app/media/slides"` constants.
    - `convert_pptx(media_id)` ALWAYS acquires `_CONVERSION_SEMAPHORE` before doing any work.
    - `convert_pptx(media_id)` sets `conversion_status='processing'` and `conversion_started_at=now()` after acquiring the semaphore and before starting subprocesses.
    - `convert_pptx(media_id)` runs the soffice→pdftoppm pipeline inside ONE outer `asyncio.wait_for(..., timeout=CONVERSION_TIMEOUT_S)` wrapper.
    - On `asyncio.TimeoutError`: both subprocess handles (if still running) are `proc.kill()`ed; row is updated to `conversion_status='failed', conversion_error='timeout'`.
    - On `soffice` non-zero rc: row is updated to `conversion_status='failed', conversion_error='soffice_failed'`; last 2KB of stderr is log.warning-ed (NOT written to the row).
    - On `pdftoppm` non-zero rc: row is updated to `conversion_status='failed', conversion_error='pdftoppm_failed'`; last 2KB of stderr is log.warning-ed.
    - On 0 PNGs produced: row is updated to `conversion_status='failed', conversion_error='no_slides_produced'`.
    - On success: row is updated to `conversion_status='done', slide_paths=[relative slide paths in lexical order], conversion_error=None`.
    - The per-invocation tempdir (`/tmp/pptx_<uuid>/`) is deleted in a `finally` block regardless of outcome.
    - soffice is invoked with `-env:UserInstallation=file:///tmp/lo_<uuid>` and `--headless --convert-to pdf --outdir <tempdir>`; the `lo_<uuid>` profile dir is also cleaned in the same `finally`.
    - pdftoppm is invoked with args `-r`, `144`, `-scale-to-x`, `1920`, `-scale-to-y`, `1080`, `-png`, `<pdf>`, `<tempdir>/slide` (pdftoppm adds its own numeric suffix; we rename/copy to `slide-NNN.png` zero-padded 3 digits per D-06).
    - `delete_slides_dir(media_uuid)` best-effort removes `/app/media/slides/<media_uuid>/` and never raises.
    - convert_pptx NEVER raises to the caller (BackgroundTasks swallows exceptions silently; we must log and persist instead).
    - Module contains ZERO sync subprocess calls (`subprocess.run`, `subprocess.Popen`, `subprocess.call` are all banned per cross-cutting hazard #7 and CI grep guards from Phase 43).
  </behavior>
  <action>
Create a NEW module `backend/app/services/signage_pptx.py`.

Required top of file (imports + module-level state):
```python
"""PPTX conversion pipeline (SGN-BE-07/08 — Phase 44).

soffice --headless --convert-to pdf  →  pdftoppm -r 144 -scale-to-x 1920 -scale-to-y 1080 -png.
One-at-a-time across the container via module-level asyncio.Semaphore(1);
60s total-pipeline budget via outer asyncio.wait_for; per-invocation LO profile
dir and tempdir always cleaned in finally. All terminal status writes go
through a single AsyncSessionLocal() block per invocation.
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import update

from app.database import AsyncSessionLocal
from app.models import SignageMedia

log = logging.getLogger(__name__)

# D-04: serialise all conversions across the single-worker api container.
_CONVERSION_SEMAPHORE: asyncio.Semaphore = asyncio.Semaphore(1)
# D-03: 60s total pipeline budget.
CONVERSION_TIMEOUT_S: int = 60
# D-06: derived slides live on backend disk (not Directus).
SLIDES_ROOT: str = "/app/media/slides"
# Max stderr tail persisted to log (D-15 keeps it out of the DB).
_STDERR_TAIL_BYTES: int = 2048
```

Implement `convert_pptx(media_id: _uuid.UUID) -> None`:
1. Open `AsyncSessionLocal()`, re-load the `SignageMedia` row, confirm `kind == 'pptx'` and `uri` is not empty. If the row is gone or not pptx, log.warning and return (do not raise).
2. `async with _CONVERSION_SEMAPHORE:` — all real work happens inside this block.
3. Inside: set `conversion_status='processing', conversion_started_at=datetime.now(timezone.utc), conversion_error=None` via an `update(SignageMedia).where(id==media_id).values(...)` and `session.commit()`. Re-fetch the `uri` (the Directus file UUID).
4. Create per-invocation paths:
   - `tempdir = Path("/tmp/pptx_") ++ uuid4()` (use `Path(f"/tmp/pptx_{uuid.uuid4()}")`).
   - `lo_profile = f"/tmp/lo_{uuid.uuid4()}"` (D-05).
   - Fetch the PPTX bytes from Directus (use the same `httpx.AsyncClient` + settings as plan 44-02 Task 1's uploader, via a small helper in this module or by depending on `directus_uploads.py` — Claude's discretion). Write to `tempdir / "input.pptx"`.
5. Wrap the actual pipeline in `try: await asyncio.wait_for(_run_pipeline(...), timeout=CONVERSION_TIMEOUT_S)`. On `asyncio.TimeoutError`: call `.kill()` on any still-live subprocess handles passed back via a shared dict / closure, then `_set_failed(media_id, 'timeout')` and return.
6. `_run_pipeline(tempdir, lo_profile, media_id)`:
   a. `soffice_proc = await asyncio.create_subprocess_exec("soffice", "--headless", f"-env:UserInstallation=file://{lo_profile}", "--convert-to", "pdf", "--outdir", str(tempdir), str(tempdir / "input.pptx"), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)`. NOTE: MUST use `asyncio.create_subprocess_exec` (the SGN-BE-10 grep guards forbid `subprocess.run`; `create_subprocess_exec` is the async-native API and is what CONTEXT D-02/D-04 calls `asyncio.subprocess_exec`).
   b. `stdout, stderr = await soffice_proc.communicate()`. If `soffice_proc.returncode != 0`: log last 2KB of stderr at warning, `_set_failed(media_id, 'soffice_failed')`, return.
   c. Locate the produced PDF (`next(tempdir.glob("*.pdf"))`). If none: `_set_failed(media_id, 'invalid_pptx')`, return.
   d. `pdftoppm_proc = await asyncio.create_subprocess_exec("pdftoppm", "-r", "144", "-scale-to-x", "1920", "-scale-to-y", "1080", "-png", str(pdf_path), str(tempdir / "slide"), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)`.
   e. Wait, check rc; on non-zero → `_set_failed(media_id, 'pdftoppm_failed')`, return.
   f. Collect produced PNGs (`sorted(tempdir.glob("slide-*.png"))`). If empty → `_set_failed(media_id, 'no_slides_produced')`, return.
   g. Prepare output dir `out_dir = Path(SLIDES_ROOT) / str(media_id)`; `out_dir.mkdir(parents=True, exist_ok=True)`. Rename/copy each PNG to `slide-001.png`, `slide-002.png`, … (zero-padded 3 digits, D-06). Build `slide_paths = [f"slides/{media_id}/slide-{i:03d}.png" for i in range(1, N+1)]`.
   h. `_set_done(media_id, slide_paths)`.
7. `finally:` `shutil.rmtree(tempdir, ignore_errors=True)` and `shutil.rmtree(lo_profile, ignore_errors=True)`.
8. All exceptions inside `convert_pptx` that escape the pipeline branches (unexpected): `log.exception` + `_set_failed(media_id, 'soffice_failed')` as a conservative fallback. NEVER re-raise.

Helpers:
```python
async def _set_failed(media_id: _uuid.UUID, code: str) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(SignageMedia)
            .where(SignageMedia.id == media_id)
            .values(conversion_status="failed", conversion_error=code)
        )
        await session.commit()

async def _set_done(media_id: _uuid.UUID, slide_paths: list[str]) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(SignageMedia)
            .where(SignageMedia.id == media_id)
            .values(conversion_status="done", slide_paths=slide_paths, conversion_error=None)
        )
        await session.commit()

def delete_slides_dir(media_uuid: _uuid.UUID) -> None:
    """Best-effort slide dir cleanup used by the reconvert endpoint (plan 44-03)."""
    try:
        shutil.rmtree(Path(SLIDES_ROOT) / str(media_uuid), ignore_errors=True)
    except Exception:
        log.warning("delete_slides_dir failed for %s", media_uuid, exc_info=True)
```

Code taxonomy (D-14) must use EXACTLY these strings for `conversion_error`:
- `timeout`
- `soffice_failed`
- `pdftoppm_failed`
- `no_slides_produced`
- `invalid_pptx`
(The `abandoned_on_restart` code is set by plan 44-04, NOT here.)

Also: write tests to `backend/tests/test_signage_pptx_service.py` exercising:
- Module constants (`CONVERSION_TIMEOUT_S == 60`, `SLIDES_ROOT == "/app/media/slides"`, semaphore is `asyncio.Semaphore` with `_value == 1` initially).
- `_set_failed` writes `conversion_status='failed'` + the supplied code (use a transient SQLite-in-memory OR mock — the project already uses async sqlite for tests? Inspect `backend/tests/conftest.py` before deciding; reuse whatever fixture pattern `test_signage_resolver.py` and `test_signage_heartbeat_sweeper.py` already use).
- `convert_pptx` short-circuits cleanly when the row is missing (does not raise).
- `convert_pptx` short-circuits cleanly when `kind != 'pptx'`.
- Timeout path: monkeypatch `_run_pipeline` to `await asyncio.sleep(999)`, call `convert_pptx` with `CONVERSION_TIMEOUT_S` monkeypatched down to e.g. 0.1 via `monkeypatch.setattr`, assert the row lands in `conversion_status='failed'`, `conversion_error='timeout'`.
- Subprocess-failure path (soffice rc≠0): monkeypatch `asyncio.create_subprocess_exec` to return a fake proc with `returncode=1`, assert `conversion_error='soffice_failed'`.

Do NOT:
- Import `subprocess`. At all. The CI grep guard from Phase 43 will fail the build.
- Use `Base.metadata.create_all()` or any sync engine.
- Put filesystem paths or raw stderr into `conversion_error` (D-15).
- Introduce a second semaphore or a queue — single `asyncio.Semaphore(1)` is the entire concurrency model.
  </behavior>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_pptx_service.py -x -q</automated>
  </verify>
  <done>
    - `backend/app/services/signage_pptx.py` exists.
    - Module-level `_CONVERSION_SEMAPHORE` is an `asyncio.Semaphore(1)`.
    - `convert_pptx` uses `async with _CONVERSION_SEMAPHORE` and `asyncio.wait_for(..., timeout=CONVERSION_TIMEOUT_S)`.
    - Module uses `asyncio.create_subprocess_exec` (not `subprocess.run`).
    - `backend/tests/test_signage_pptx_service.py` tests all pass (`python -m pytest tests/test_signage_pptx_service.py -x -q` exits 0).
    - Existing CI grep guards still pass: `python -m pytest tests/test_signage_ci_guards.py -x -q` still exits 0.
  </done>
  <acceptance_criteria>
    - File backend/app/services/signage_pptx.py exists.
    - `grep -c "asyncio.Semaphore(1)" backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c "CONVERSION_TIMEOUT_S" backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c 'SLIDES_ROOT: str = "/app/media/slides"' backend/app/services/signage_pptx.py` returns 1.
    - `grep -c "asyncio.wait_for" backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c "asyncio.create_subprocess_exec" backend/app/services/signage_pptx.py` returns ≥2  (one for soffice, one for pdftoppm).
    - `grep -c '"soffice"' backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c '"pdftoppm"' backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c -- "-env:UserInstallation=file://" backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -c -- '"--headless"' backend/app/services/signage_pptx.py` returns ≥1.
    - `grep -cE '"-scale-to-x".*"1920"|"1920".*"-scale-to-x"' backend/app/services/signage_pptx.py` returns ≥1  (OR the two args are on adjacent lines: `grep -A1 '"-scale-to-x"' | grep '"1920"'` matches).
    - `grep -cE '^import subprocess|^from subprocess' backend/app/services/signage_pptx.py` returns 0.
    - `grep -cE '"timeout"|"soffice_failed"|"pdftoppm_failed"|"no_slides_produced"|"invalid_pptx"' backend/app/services/signage_pptx.py` returns ≥5  (all five D-14 codes appear).
    - `grep -c "def delete_slides_dir" backend/app/services/signage_pptx.py` returns 1.
    - `grep -c "async def convert_pptx" backend/app/services/signage_pptx.py` returns 1.
    - File backend/tests/test_signage_pptx_service.py exists.
    - `cd backend && python -m pytest tests/test_signage_pptx_service.py -x -q` exits 0.
    - `cd backend && python -m pytest tests/test_signage_ci_guards.py -x -q` still exits 0 (no regression).
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd backend && python -c "from app.services import signage_pptx; import asyncio; assert isinstance(signage_pptx._CONVERSION_SEMAPHORE, asyncio.Semaphore); assert signage_pptx.CONVERSION_TIMEOUT_S == 60"` exits 0.
- `cd backend && python -m pytest tests/test_signage_pptx_service.py tests/test_signage_ci_guards.py -x -q` exits 0.
</verification>

<success_criteria>
- Conversion service module exists with semaphore, timeout wrapper, subprocess pipeline, and state-machine writes.
- Directus upload helper exists with 50MB streaming cap.
- All D-14 error codes are emitted on the appropriate branches.
- CI grep guards from Phase 43 still green (no sync subprocess, no psycopg2/sqlite3).
- Tests cover the row-missing, timeout, and subprocess-failure branches.
</success_criteria>

<output>
After completion, create `.planning/phases/44-pptx-conversion-pipeline/44-02-SUMMARY.md` capturing: module layout, subprocess argv used for soffice+pdftoppm (verbatim), the D-14 error codes emitted and on which branch, and any Settings fields added to config.py.
</output>
