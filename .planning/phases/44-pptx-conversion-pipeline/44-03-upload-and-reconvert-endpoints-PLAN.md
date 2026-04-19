---
phase: 44-pptx-conversion-pipeline
plan: 03
type: execute
wave: 2
depends_on:
  - 44-02
files_modified:
  - backend/app/routers/signage_admin/media.py
autonomous: true
requirements:
  - SGN-BE-07

must_haves:
  truths:
    - "POST /api/signage/media/pptx accepts multipart/form-data with `file` (UploadFile) + `title` (str)"
    - "Upload stream is aborted with 413 the moment cumulative bytes exceed 50MB (before full body is read into memory)"
    - "Upload rejects files whose content_type is not application/vnd.openxmlformats-officedocument.presentationml.presentation AND whose filename does not end .pptx, returning 400"
    - "On success: a new SignageMedia row is inserted with kind='pptx', conversion_status='pending', uri=<directus_file_uuid>, mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation', size_bytes=<streamed bytes>, slide_paths=NULL, conversion_error=NULL, conversion_started_at=NULL; 201 is returned immediately; BackgroundTasks schedules convert_pptx(row.id)"
    - "POST /api/signage/media/{media_id}/reconvert returns 404 if not found, 409 if kind != 'pptx', 409 if conversion_status == 'processing'"
    - "On reconvert success: row flipped to conversion_status='pending' with slide_paths=NULL + conversion_error=NULL + conversion_started_at=NULL; /app/media/slides/<id>/ is deleted; convert_pptx(id) re-scheduled; 202 returned"
    - "Both new endpoints inherit the parent signage_admin router's admin gate — no per-route require_admin"
  artifacts:
    - path: "backend/app/routers/signage_admin/media.py"
      provides: "POST /media/pptx (multipart upload) + POST /media/{id}/reconvert"
      contains: '@router.post("/pptx"'
  key_links:
    - from: "POST /media/pptx"
      to: "upload_pptx_to_directus"
      via: "async iter over UploadFile.read() chunks, 50MB cap"
      pattern: "upload_pptx_to_directus"
    - from: "POST /media/pptx"
      to: "convert_pptx"
      via: "background_tasks.add_task(convert_pptx, row.id)"
      pattern: "background_tasks\\.add_task\\(convert_pptx"
    - from: "POST /media/{id}/reconvert"
      to: "delete_slides_dir + convert_pptx"
      via: "background_tasks.add_task"
      pattern: "delete_slides_dir.*convert_pptx|convert_pptx.*delete_slides_dir"
---

<objective>
Extend `backend/app/routers/signage_admin/media.py` with two new endpoints — the initial PPTX upload (multipart + 50MB streaming cap + Directus write + row insert + BackgroundTask schedule) and the reconvert endpoint (state-machine reset + /app/media/slides cleanup + re-schedule).

Purpose: implements SGN-BE-07 per CONTEXT D-08, D-10, D-11, D-12, D-13. This is the public admin surface for PPTX ingestion; plan 44-02 owns the actual conversion work.

Output: updated `backend/app/routers/signage_admin/media.py` with two new route handlers, import of `convert_pptx` + `delete_slides_dir` + `upload_pptx_to_directus`, and test coverage for both endpoints.
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
@.planning/phases/44-pptx-conversion-pipeline/44-02-pptx-conversion-service-PLAN.md
@backend/app/routers/signage_admin/__init__.py
@backend/app/routers/signage_admin/media.py
@backend/app/models/signage.py
@backend/app/schemas/signage.py

<interfaces>
<!-- Contracts consumed from plan 44-02 (see 44-02-PLAN.md <interfaces>). -->

From backend/app/services/signage_pptx.py (created by plan 44-02):
```python
async def convert_pptx(media_id: uuid.UUID) -> None
def delete_slides_dir(media_uuid: uuid.UUID) -> None
```

From backend/app/services/directus_uploads.py (created by plan 44-02):
```python
MAX_UPLOAD_BYTES: int  # 50 * 1024 * 1024
async def upload_pptx_to_directus(
    filename: str,
    content_type: str,
    body_stream: AsyncIterator[bytes],
) -> tuple[str, int]  # (directus_file_uuid, total_bytes); raises HTTPException(413) on cap breach
```

From backend/app/routers/signage_admin/__init__.py (existing — parent router):
```python
router = APIRouter(
    prefix="/api/signage",
    tags=["signage-admin"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
router.include_router(media.router)  # media.router has prefix="/media"
```
So the full paths we add are: POST /api/signage/media/pptx and POST /api/signage/media/{media_id}/reconvert.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add POST /media/pptx multipart upload endpoint with 50MB streaming cap</name>
  <read_first>
    - backend/app/routers/signage_admin/media.py (existing — the new endpoint is a sibling of `create_media`)
    - backend/app/routers/signage_admin/__init__.py (confirm NO per-route admin dep is needed)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-08, D-10, D-11, D-13
    - .planning/phases/44-pptx-conversion-pipeline/44-02-pptx-conversion-service-PLAN.md §interfaces (for convert_pptx + upload_pptx_to_directus signatures)
  </read_first>
  <files>backend/app/routers/signage_admin/media.py, backend/tests/test_signage_pptx_upload.py</files>
  <behavior>
    - Multipart request with file.content_type == application/vnd.openxmlformats-officedocument.presentationml.presentation returns 201.
    - Multipart request with file.filename ending ".pptx" but content_type "application/octet-stream" also returns 201 (browsers often send octet-stream for .pptx).
    - Multipart request with file.content_type "image/png" and filename "foo.png" returns 400.
    - Multipart request whose body exceeds 50MB returns 413 (verified with a fake stream > 50MB in the test; row must NOT be inserted).
    - Response body on 201 matches SignageMediaRead shape; kind='pptx', conversion_status='pending', slide_paths is None, uri == the directus_file_uuid returned by the mocked upload helper.
    - background_tasks.add_task(convert_pptx, row.id) is invoked exactly once on success (assert via monkeypatch / mock).
    - On 400 or 413, background_tasks.add_task is NOT invoked and no row is inserted.
  </behavior>
  <action>
Edit `backend/app/routers/signage_admin/media.py`.

1. Add imports near the top (preserve existing style):

```python
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.services.directus_uploads import MAX_UPLOAD_BYTES, upload_pptx_to_directus
from app.services.signage_pptx import convert_pptx, delete_slides_dir
```

`File`, `Form`, `UploadFile`, `BackgroundTasks` may already exist in some form — re-use existing import lines if they do; otherwise extend them.

2. Add these constants above the routes:

```python
PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
_PPTX_FALLBACK_MIMES = {"application/octet-stream", "application/zip"}
```

3. Add endpoint:

```python
@router.post("/pptx", response_model=SignageMediaRead, status_code=201)
async def upload_pptx_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(..., max_length=255),
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageMedia:
    """D-10: multipart PPTX upload.

    Streams the uploaded bytes into Directus, inserts a pending SignageMedia
    row, schedules conversion via BackgroundTasks, and returns 201 immediately.
    Enforces the 50MB cap (D-13) inside the stream iterator — HTTPException(413)
    is raised by upload_pptx_to_directus the moment the running total exceeds
    MAX_UPLOAD_BYTES, BEFORE the whole body is read into memory.
    """
    # D-10: validate MIME / extension first (cheap rejection).
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    is_pptx_mime = content_type == PPTX_MIME
    is_pptx_ext = filename.endswith(".pptx")
    is_fallback = content_type in _PPTX_FALLBACK_MIMES and is_pptx_ext
    if not (is_pptx_mime or is_fallback):
        raise HTTPException(
            status_code=400,
            detail="file must be a .pptx presentation",
        )

    # Stream body -> Directus. The helper raises HTTPException(413) on cap breach.
    async def _body_iter():
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            yield chunk

    directus_uuid, total_bytes = await upload_pptx_to_directus(
        filename=file.filename or "upload.pptx",
        content_type=PPTX_MIME,  # normalise — Directus stores the canonical MIME
        body_stream=_body_iter(),
    )

    row = SignageMedia(
        kind="pptx",
        title=title,
        mime_type=PPTX_MIME,
        size_bytes=total_bytes,
        uri=directus_uuid,
        conversion_status="pending",
        slide_paths=None,
        conversion_error=None,
        conversion_started_at=None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # D-08: schedule the actual conversion AFTER the row is committed so the
    # background task can re-fetch it via its own session.
    background_tasks.add_task(convert_pptx, row.id)
    return row
```

4. Write tests in `backend/tests/test_signage_pptx_upload.py`:
   - Use whatever AsyncClient / httpx_asgi / fastapi TestClient fixture `test_signage_admin_router.py` already uses — mirror that exact pattern (admin-role JWT, async db). Do not invent a new fixture strategy.
   - Monkeypatch `app.routers.signage_admin.media.upload_pptx_to_directus` to an `async` stub that returns `("fake-directus-uuid", N_bytes)`.
   - Monkeypatch `app.routers.signage_admin.media.convert_pptx` to a `MagicMock` so we can assert it was scheduled but never actually runs LibreOffice.
   - Test happy path (PPTX content-type, small body) → 201 + row exists with kind='pptx', conversion_status='pending', uri='fake-directus-uuid', size_bytes==len(body); the mocked convert_pptx was scheduled.
   - Test extension-fallback path (filename "deck.pptx", content_type "application/octet-stream") → 201.
   - Test rejected MIME (content_type "image/png", filename "foo.png") → 400, no row inserted, convert_pptx NOT scheduled.
   - Test 413 path: monkeypatch `upload_pptx_to_directus` to raise `HTTPException(status_code=413, detail="pptx upload exceeds 50MB cap")` → 413, no row, convert_pptx NOT scheduled.

Do NOT:
- Add `Depends(require_admin)` to this endpoint — the parent router already gates it; a second gate is a smell (cross-cutting hazard #5).
- Read `await file.read()` without the streaming cap (defeats D-13).
- Invoke `convert_pptx` inline with `await` — it must go through `background_tasks.add_task` so the HTTP response returns immediately (D-08).
- Insert the row with `conversion_status='processing'` — pending is the correct initial state per the D-07 state machine.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_pptx_upload.py -x -q</automated>
  </verify>
  <done>
    - `grep -c '@router.post("/pptx"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "background_tasks.add_task(convert_pptx" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c "upload_pptx_to_directus" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `cd backend && python -m pytest tests/test_signage_pptx_upload.py -x -q` exits 0.
    - Existing `test_signage_admin_router.py` still passes (no regression to the existing JSON POST /media path).
  </done>
  <acceptance_criteria>
    - `grep -c '@router.post("/pptx"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "async def upload_pptx_media" backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -cE "status_code=413" backend/app/routers/signage_admin/media.py` returns ≥0  (the 413 is raised inside upload_pptx_to_directus; the handler need not reference 413 directly — `grep -c "upload_pptx_to_directus" backend/app/routers/signage_admin/media.py` returns ≥1 instead).
    - `grep -c "upload_pptx_to_directus" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c "PPTX_MIME" backend/app/routers/signage_admin/media.py` returns ≥2.
    - `grep -c 'application/vnd.openxmlformats-officedocument.presentationml.presentation' backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -cE 'status_code=400|HTTPException\(400' backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c "background_tasks.add_task(convert_pptx" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c 'kind="pptx"' backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c 'conversion_status="pending"' backend/app/routers/signage_admin/media.py` returns ≥1.
    - File backend/tests/test_signage_pptx_upload.py exists.
    - `cd backend && python -m pytest tests/test_signage_pptx_upload.py -x -q` exits 0.
    - `cd backend && python -m pytest tests/test_signage_admin_router.py -x -q` still exits 0.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add POST /media/{id}/reconvert endpoint with state machine + slide dir cleanup</name>
  <read_first>
    - backend/app/routers/signage_admin/media.py (after Task 1 — the new endpoint is another sibling)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-12
    - .planning/phases/44-pptx-conversion-pipeline/44-02-pptx-conversion-service-PLAN.md §interfaces (for delete_slides_dir signature)
  </read_first>
  <files>backend/app/routers/signage_admin/media.py, backend/tests/test_signage_pptx_reconvert.py</files>
  <behavior>
    - 404 when media_id does not exist.
    - 409 with detail "media is not a PPTX" when kind != 'pptx'.
    - 409 with detail "conversion already in progress" when conversion_status == 'processing'.
    - 202 on success; response body is SignageMediaRead with conversion_status='pending', slide_paths=None, conversion_error=None, conversion_started_at=None.
    - delete_slides_dir(media_id) is invoked exactly once on success (before scheduling the task OR as the first step of the scheduled task — per D-12, the CONTEXT says "at the start of the new conversion"; simpler & safer is to delete inline in the endpoint since delete_slides_dir is already best-effort and non-blocking — Claude's discretion, but inline call from the endpoint is the recommended path).
    - background_tasks.add_task(convert_pptx, row.id) is invoked exactly once on success.
    - On all error paths (404/409), no slide dir deletion and no conversion scheduled.
  </behavior>
  <action>
Append to `backend/app/routers/signage_admin/media.py`:

```python
@router.post("/{media_id}/reconvert", response_model=SignageMediaRead, status_code=202)
async def reconvert_pptx_media(
    media_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageMedia:
    """D-12: reset a PPTX row to pending, clear derived slides, re-schedule conversion."""
    row = (
        await db.execute(select(SignageMedia).where(SignageMedia.id == media_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="media not found")
    if row.kind != "pptx":
        raise HTTPException(status_code=409, detail="media is not a PPTX")
    if row.conversion_status == "processing":
        raise HTTPException(status_code=409, detail="conversion already in progress")

    row.conversion_status = "pending"
    row.slide_paths = None
    row.conversion_error = None
    row.conversion_started_at = None
    await db.commit()
    await db.refresh(row)

    # D-12: wipe the old derived slides dir BEFORE the new conversion starts.
    # delete_slides_dir is best-effort and non-raising (see plan 44-02).
    delete_slides_dir(media_id)

    background_tasks.add_task(convert_pptx, row.id)
    return row
```

Write tests in `backend/tests/test_signage_pptx_reconvert.py` (mirror the fixture pattern used by Task 1's tests):
- 404 when the id is random.
- 409 for a non-PPTX media row (kind='image').
- 409 for a PPTX row currently in `processing`.
- 202 happy path: row is PPTX with `conversion_status='failed'` + `conversion_error='soffice_failed'` + `slide_paths=[...]` pre-existing. After call: status flipped to `pending`, `slide_paths` is None, `conversion_error` is None, `delete_slides_dir` was called with `media_id`, and `convert_pptx` was scheduled. (Monkeypatch `convert_pptx` and `delete_slides_dir` in the router module's namespace.)
- 202 happy path from `conversion_status='done'` also flips cleanly.

Do NOT:
- Return 200 on success — per D-12 the contract is 202 (task accepted, not yet complete).
- Call `convert_pptx` inline — it must be scheduled via background_tasks.
- Trust the client to send an empty JSON body — this endpoint has NO body at all (per D-12 "no body").
- Delete the SignageMedia row — reconvert is a reset, not a delete.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_pptx_reconvert.py -x -q</automated>
  </verify>
  <done>
    - `grep -c '@router.post("/{media_id}/reconvert"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "status_code=202" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c "delete_slides_dir(media_id)" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `cd backend && python -m pytest tests/test_signage_pptx_reconvert.py -x -q` exits 0.
  </done>
  <acceptance_criteria>
    - `grep -c '@router.post("/{media_id}/reconvert"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "async def reconvert_pptx_media" backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "status_code=202" backend/app/routers/signage_admin/media.py` returns ≥1.
    - `grep -c 'detail="media is not a PPTX"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c 'detail="conversion already in progress"' backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c 'detail="media not found"' backend/app/routers/signage_admin/media.py` returns ≥1 (may already exist from earlier endpoints).
    - `grep -c "delete_slides_dir(media_id)" backend/app/routers/signage_admin/media.py` returns 1.
    - `grep -c "background_tasks.add_task(convert_pptx, row.id)" backend/app/routers/signage_admin/media.py` returns ≥2 (upload + reconvert).
    - File backend/tests/test_signage_pptx_reconvert.py exists.
    - `cd backend && python -m pytest tests/test_signage_pptx_reconvert.py -x -q` exits 0.
    - Dep-audit test still green: `cd backend && python -m pytest tests/test_signage_router_deps.py -x -q` exits 0  (admin gate via parent router is preserved — no per-endpoint require_admin is needed because the parent already supplies it).
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/test_signage_pptx_upload.py tests/test_signage_pptx_reconvert.py tests/test_signage_admin_router.py tests/test_signage_router_deps.py -x -q` exits 0.
- `grep -c "require_admin" backend/app/routers/signage_admin/media.py` returns 0 (cross-cutting hazard #5: admin gate lives ONLY on the parent router).
</verification>

<success_criteria>
- Both endpoints land under the parent `signage_admin` router (paths POST /api/signage/media/pptx and POST /api/signage/media/{id}/reconvert).
- Upload path writes raw PPTX bytes into Directus, inserts the row with conversion_status='pending', schedules the BackgroundTask, and returns 201 immediately.
- Reconvert path flips state back to pending, deletes the old slides dir, schedules a fresh BackgroundTask, and returns 202.
- 413 enforced at the stream boundary; 400 on MIME/extension mismatch; 404/409 on the documented reconvert failure modes.
- No per-route `require_admin` introduced; admin gate inherited from the parent.
</success_criteria>

<output>
After completion, create `.planning/phases/44-pptx-conversion-pipeline/44-03-SUMMARY.md` capturing: exact endpoint paths, status-code table (200/201/202/400/404/409/413), MIME validation rules, and how BackgroundTasks is wired.
</output>
