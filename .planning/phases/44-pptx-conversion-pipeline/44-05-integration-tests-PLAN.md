---
phase: 44-pptx-conversion-pipeline
plan: 05
type: execute
wave: 3
depends_on:
  - 44-01
  - 44-02
  - 44-03
  - 44-04
files_modified:
  - backend/tests/fixtures/signage/tiny-valid.pptx
  - backend/tests/fixtures/signage/corrupt.pptx
  - backend/tests/fixtures/signage/README.md
  - backend/tests/test_signage_pptx_pipeline_integration.py
  - backend/tests/test_signage_ci_guards.py
autonomous: true
requirements:
  - SGN-BE-07
  - SGN-BE-08
  - SGN-SCH-03
  - SGN-INF-01

must_haves:
  truths:
    - "An integration test exists that, when the test environment has soffice+pdftoppm installed, converts a real tiny PPTX and asserts slide_paths is populated"
    - "An integration test exists that feeds a known-corrupt .pptx and asserts conversion_status transitions to 'failed' with conversion_error in {'soffice_failed','invalid_pptx'}"
    - "An integration test exists that drives the stuck-row reset hook end-to-end (seed stuck row → run hook → assert 'failed'/'abandoned_on_restart')"
    - "Integration tests are skipped cleanly (pytest.skip) on machines without soffice or pdftoppm on PATH — CI in Docker has them; local dev may not"
    - "The CI grep guards added in Phase 43 are extended (or re-asserted) to also cover backend/app/services/signage_pptx.py (no sync subprocess, no sqlite3, no psycopg2)"
  artifacts:
    - path: "backend/tests/fixtures/signage/tiny-valid.pptx"
      provides: "2-slide valid PPTX fixture (~10KB) for happy-path integration test"
    - path: "backend/tests/fixtures/signage/corrupt.pptx"
      provides: "Non-PPTX bytes with .pptx extension — triggers invalid_pptx/soffice_failed branch"
    - path: "backend/tests/test_signage_pptx_pipeline_integration.py"
      provides: "Integration tests for success, corrupt, and stuck-row-reset paths"
      contains: "pytest.importorskip|shutil.which"
  key_links:
    - from: "integration test"
      to: "app.services.signage_pptx.convert_pptx"
      via: "direct await call in test (bypasses BackgroundTasks scheduling)"
      pattern: "await convert_pptx"
    - from: "integration test"
      to: "real soffice + pdftoppm binaries"
      via: "shutil.which guard + pytest.skip"
      pattern: "shutil.which.*soffice|shutil.which.*pdftoppm"
---

<objective>
Create integration tests that actually exercise the full soffice→pdftoppm pipeline on a real tiny PPTX (when the binaries are present) and verify all four phase requirements end-to-end. Also extend the existing Phase 43 CI grep guards to assert the new `signage_pptx.py` and `directus_uploads.py` modules respect cross-cutting hazards #6 and #7.

Purpose: this is the phase-wide verification layer. The phase goal — "PPTX upload produces an ordered sequence of 1920×1080 PNG slides without wedging the event loop, OOMing the container, or silently rendering with wrong fonts" — is only provable via an end-to-end test that includes real binaries.

Output:
- Two binary test fixtures under `backend/tests/fixtures/signage/`.
- A new integration test file covering success, corrupt, and stuck-row-reset paths.
- Additional assertions in `test_signage_ci_guards.py` extending the existing grep checks.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md
@.planning/phases/44-pptx-conversion-pipeline/44-01-dockerfile-libreoffice-fonts-PLAN.md
@.planning/phases/44-pptx-conversion-pipeline/44-02-pptx-conversion-service-PLAN.md
@.planning/phases/44-pptx-conversion-pipeline/44-03-upload-and-reconvert-endpoints-PLAN.md
@.planning/phases/44-pptx-conversion-pipeline/44-04-scheduler-stuck-row-reset-PLAN.md
@backend/tests/test_signage_ci_guards.py
@backend/tests/conftest.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create tiny-valid.pptx + corrupt.pptx test fixtures</name>
  <read_first>
    - backend/tests/conftest.py (to understand the fixture dir conventions — mirror whatever `tests/fixtures/` pattern already exists)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-02, D-14
  </read_first>
  <files>backend/tests/fixtures/signage/tiny-valid.pptx, backend/tests/fixtures/signage/corrupt.pptx, backend/tests/fixtures/signage/README.md</files>
  <action>
Create a `backend/tests/fixtures/signage/` directory with two binary fixtures and a README.

**tiny-valid.pptx** — generate programmatically at fixture-creation time via a one-shot script (NOT checked in as a Python helper — the script runs once to produce the blob, then the blob is committed; this keeps the test suite independent of `python-pptx`). Use the `python-pptx` library once locally (it's already ok to have a one-time dev-time dep; do not add it to requirements.txt):

```python
# One-off creation script (NOT committed — run once):
#   pip install python-pptx
#   python -c "
# from pptx import Presentation
# from pptx.util import Inches
# p = Presentation()
# layout = p.slide_layouts[0]
# for i in range(2):
#     s = p.slides.add_slide(layout)
#     s.shapes.title.text = f'Slide {i+1}'
# p.save('backend/tests/fixtures/signage/tiny-valid.pptx')
# "
```

Alternative: if python-pptx is awkward to run, use any real 2-slide .pptx you have handy and copy it in. Target size < 50KB. Acceptance only cares that soffice successfully converts it to a 2-page PDF.

**corrupt.pptx** — literally a text file with ".pptx" extension. Simplest way:

```
echo "not a real pptx just some bytes" > backend/tests/fixtures/signage/corrupt.pptx
```

(use the Write tool; since the content is tiny, not actually binary.)

**README.md** inside the fixtures dir — short explanation of what each fixture is and how it was generated:

```markdown
# Phase 44 PPTX fixtures

- `tiny-valid.pptx` — 2-slide valid PPTX generated with python-pptx 1.x (one-off, not a CI dep).
  Used by integration tests to exercise the full soffice→pdftoppm happy path.
- `corrupt.pptx` — plain-text bytes with a `.pptx` extension. Used to exercise the
  `soffice_failed` / `invalid_pptx` branch in convert_pptx.
```

Do NOT:
- Add python-pptx to requirements.txt or requirements-dev.txt. The fixture is a static artifact.
- Commit gigantic sample PPTXs (> 1MB). tiny-valid.pptx should be well under 50KB.
  </action>
  <verify>
    <automated>test -f backend/tests/fixtures/signage/tiny-valid.pptx && test -f backend/tests/fixtures/signage/corrupt.pptx && test -f backend/tests/fixtures/signage/README.md && python -c "import os; assert os.path.getsize('backend/tests/fixtures/signage/tiny-valid.pptx') > 1024 and os.path.getsize('backend/tests/fixtures/signage/tiny-valid.pptx') < 51200"</automated>
  </verify>
  <done>
    - `backend/tests/fixtures/signage/tiny-valid.pptx` exists and is between 1KB and 50KB.
    - `backend/tests/fixtures/signage/corrupt.pptx` exists.
    - `backend/tests/fixtures/signage/README.md` explains both.
  </done>
  <acceptance_criteria>
    - `test -f backend/tests/fixtures/signage/tiny-valid.pptx && echo yes` prints yes.
    - `test -f backend/tests/fixtures/signage/corrupt.pptx && echo yes` prints yes.
    - `test -f backend/tests/fixtures/signage/README.md && echo yes` prints yes.
    - `python -c "print(open('backend/tests/fixtures/signage/tiny-valid.pptx','rb').read()[:2])"` prints `b'PK'` (ZIP magic — confirms it's actually a .pptx/OOXML, not plain text).
    - `wc -c backend/tests/fixtures/signage/tiny-valid.pptx` reports ≥1024 AND ≤51200.
    - requirements.txt and requirements-dev.txt contain NO `python-pptx` line (grep -c returns 0 in each).
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write end-to-end integration tests (success / corrupt / stuck-row reset)</name>
  <read_first>
    - backend/app/services/signage_pptx.py (created by plan 44-02)
    - backend/app/scheduler.py (after plan 44-04)
    - backend/tests/conftest.py (async DB fixture used by other signage tests)
    - backend/tests/test_signage_heartbeat_sweeper.py (async-row-seeding pattern to mirror)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §"Goal" success criteria 1, 2, 4
  </read_first>
  <files>backend/tests/test_signage_pptx_pipeline_integration.py</files>
  <behavior>
    - `test_convert_pptx_happy_path` — when soffice + pdftoppm are present and a tiny-valid.pptx is fed through, the row transitions `pending → processing → done` and `slide_paths` is a non-empty list of strings of the form `slides/<uuid>/slide-001.png`.
    - `test_convert_pptx_corrupt_pptx` — when corrupt.pptx is fed through, the row transitions to `conversion_status='failed'` with `conversion_error in {'soffice_failed', 'invalid_pptx'}` (either is acceptable — soffice's behavior on junk varies by version).
    - `test_convert_pptx_skipped_without_binaries` — if `shutil.which('soffice')` or `shutil.which('pdftoppm')` is None, `pytest.skip("soffice/pdftoppm not installed")` — so developer laptops without LibreOffice don't fail CI locally. Docker CI WILL have them installed (plan 44-01).
    - `test_pptx_stuck_reset_end_to_end` — seed a PPTX row with `conversion_status='processing'` and `conversion_started_at = now - 10 min`. Invoke `await _run_pptx_stuck_reset()` directly. Reload row; assert `conversion_status='failed'` and `conversion_error='abandoned_on_restart'`. Does NOT require soffice.
    - All tests clean up `/tmp/pptx_*` and `/app/media/slides/<uuid>/` dirs they create (conftest fixture with yield + rmtree).
  </behavior>
  <action>
Create `backend/tests/test_signage_pptx_pipeline_integration.py`.

Top of file:

```python
"""Phase 44 end-to-end integration tests.

These exercise the real soffice + pdftoppm binaries; they are skipped
automatically on hosts without LibreOffice on PATH (developer laptops),
and run in Docker CI where plan 44-01's apt layer supplies them.
"""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models import SignageMedia
from app.services import signage_pptx
from app.scheduler import _run_pptx_stuck_reset

pytestmark = pytest.mark.asyncio

_HAS_BINS = shutil.which("soffice") is not None and shutil.which("pdftoppm") is not None
_SKIP_BINS = pytest.mark.skipif(
    not _HAS_BINS, reason="soffice/pdftoppm not installed on PATH — Docker CI only"
)

FIXTURES = Path(__file__).parent / "fixtures" / "signage"
```

Implement the four test functions. For the two that exercise the real pipeline (happy path + corrupt), the test must:
1. Create a `SignageMedia` row with `kind='pptx', conversion_status='pending', uri='<some placeholder>'` via the async DB fixture.
2. Monkeypatch the fetch-from-Directus step in `signage_pptx` so it reads the PPTX bytes directly from the fixture file instead of hitting Directus. (Plan 44-02 left the exact shape of that fetch helper to Claude's discretion; the test monkeypatches whichever function does it — use `monkeypatch.setattr("app.services.signage_pptx.<fetch_fn>", fake_fetch)` and have `fake_fetch(uri)` return `FIXTURES / 'tiny-valid.pptx'`.read_bytes()`.)
3. `await signage_pptx.convert_pptx(row.id)` directly (not via BackgroundTasks).
4. Re-select the row via the async session and assert terminal state.
5. Fixture-scoped teardown deletes `/app/media/slides/<row.id>/` with `shutil.rmtree(..., ignore_errors=True)`.

For `test_pptx_stuck_reset_end_to_end`: no binary dep. Seed the row with `conversion_started_at=datetime.now(timezone.utc) - timedelta(minutes=10)`, run the hook, assert.

Do NOT:
- Mock `asyncio.create_subprocess_exec` in these integration tests — they are the ONLY tests that intentionally exercise the real binaries. (Unit tests in plan 44-02 already cover mocked branches.)
- Leave stale tempdirs or slides on disk after a test run.
- Skip the stuck-reset test under `_SKIP_BINS` — it has no binary requirement.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_pptx_pipeline_integration.py -x -q</automated>
  </verify>
  <done>
    - File exists with the four documented tests.
    - On a host WITHOUT soffice: the two binary-dependent tests report SKIPPED; the stuck-reset test passes.
    - On a host WITH soffice (Docker CI image from plan 44-01): all four tests pass.
    - `docker run --rm --entrypoint sh kpi-backend-phase44 -c "cd /app && python -m pytest tests/test_signage_pptx_pipeline_integration.py -x -q"` exits 0 (manual step — not scripted in CI yet).
  </done>
  <acceptance_criteria>
    - File backend/tests/test_signage_pptx_pipeline_integration.py exists.
    - `grep -c "def test_convert_pptx_happy_path" backend/tests/test_signage_pptx_pipeline_integration.py` returns 1.
    - `grep -c "def test_convert_pptx_corrupt_pptx" backend/tests/test_signage_pptx_pipeline_integration.py` returns 1.
    - `grep -c "def test_pptx_stuck_reset_end_to_end" backend/tests/test_signage_pptx_pipeline_integration.py` returns 1.
    - `grep -cE "shutil.which\\(.soffice.\\)|shutil.which\\(.pdftoppm.\\)" backend/tests/test_signage_pptx_pipeline_integration.py` returns ≥2.
    - `grep -c "pytest.mark.skipif" backend/tests/test_signage_pptx_pipeline_integration.py` returns ≥1.
    - `grep -c "await _run_pptx_stuck_reset" backend/tests/test_signage_pptx_pipeline_integration.py` returns ≥1.
    - `grep -c "await convert_pptx\\|await signage_pptx.convert_pptx" backend/tests/test_signage_pptx_pipeline_integration.py` returns ≥1.
    - `cd backend && python -m pytest tests/test_signage_pptx_pipeline_integration.py -x -q` exits 0 (tests either pass or skip; nothing fails).
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Extend Phase 43 CI grep guards to cover new Phase 44 modules</name>
  <read_first>
    - backend/tests/test_signage_ci_guards.py (existing — Phase 43 Plan 05 — defines the grep patterns to extend)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-05-SUMMARY.md (if present — documents the guard scheme)
    - .planning/ROADMAP.md §v1.16 cross-cutting hazards #6, #7
  </read_first>
  <files>backend/tests/test_signage_ci_guards.py</files>
  <action>
Open `backend/tests/test_signage_ci_guards.py` and extend the existing scan set (file-list or path-pattern — however Phase 43 structured it) to EXPLICITLY include:

- `backend/app/services/signage_pptx.py`
- `backend/app/services/directus_uploads.py`

Assertions to add (or confirm are already covered if the Phase 43 guards scan all of `backend/app/` broadly):

1. No `import sqlite3` (or `from sqlite3`) anywhere in `backend/app/`.
2. No `import psycopg2` (or `from psycopg2`) anywhere in `backend/app/`.
3. No `subprocess.run`, no `subprocess.Popen`, no `subprocess.call`, no `subprocess.check_call`, no `subprocess.check_output` in any file matching `backend/app/**/signage*.py` OR `backend/app/services/signage_pptx.py` OR `backend/app/services/directus_uploads.py`.
4. `backend/app/services/signage_pptx.py` contains BOTH `asyncio.create_subprocess_exec` (or `asyncio.subprocess_exec` — the latter is what CONTEXT names it; accept either, prefer `create_subprocess_exec` which is the real API symbol) used for `soffice` AND for `pdftoppm`. The test asserts both binary names appear as args to `asyncio.create_subprocess_exec` calls (a simple `'soffice' in content and 'pdftoppm' in content` check is sufficient — the grep for `asyncio.create_subprocess_exec` is the key assertion).

If Phase 43 already uses a recursive walk under `backend/app/`, you may only need a tiny addition or no change at all — in that case, add a dedicated new test `test_phase44_pptx_service_uses_async_subprocess_only` that pins the Phase 44 modules specifically:

```python
def test_phase44_pptx_service_uses_async_subprocess_only():
    p = Path("backend/app/services/signage_pptx.py")
    content = p.read_text()
    # Hazard #7: no sync subprocess in signage services.
    for banned in ("subprocess.run", "subprocess.Popen", "subprocess.call",
                   "subprocess.check_call", "subprocess.check_output"):
        assert banned not in content, f"{banned} present in {p}"
    # Must use the async subprocess API for both binaries.
    assert "asyncio.create_subprocess_exec" in content
    assert "soffice" in content
    assert "pdftoppm" in content


def test_phase44_directus_uploads_no_sync_http():
    p = Path("backend/app/services/directus_uploads.py")
    content = p.read_text()
    # Must be async (httpx.AsyncClient), not requests/sync.
    assert "import httpx" in content or "from httpx" in content
    for banned in ("import requests", "from requests"):
        assert banned not in content, f"{banned} present in {p}"
```

Do NOT:
- Remove or weaken any existing Phase 43 assertion.
- Duplicate assertions that Phase 43 already makes (keep the file DRY; if the recursive walk already catches Phase 44 modules, just add the two narrow Phase 44-specific tests above).
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_ci_guards.py -x -q</automated>
  </verify>
  <done>
    - `backend/tests/test_signage_ci_guards.py` now explicitly references `signage_pptx.py` and/or `directus_uploads.py` OR its existing recursive walk already picks them up AND two new targeted tests `test_phase44_*` exist.
    - `cd backend && python -m pytest tests/test_signage_ci_guards.py -x -q` exits 0.
  </done>
  <acceptance_criteria>
    - `grep -c "signage_pptx" backend/tests/test_signage_ci_guards.py` returns ≥1.
    - `grep -c "directus_uploads" backend/tests/test_signage_ci_guards.py` returns ≥1.
    - `grep -c "asyncio.create_subprocess_exec" backend/tests/test_signage_ci_guards.py` returns ≥1.
    - `grep -cE "subprocess\.run|subprocess\.Popen|subprocess\.call" backend/tests/test_signage_ci_guards.py` returns ≥3 (the banned list).
    - `cd backend && python -m pytest tests/test_signage_ci_guards.py -x -q` exits 0.
    - `cd backend && python -m pytest tests/test_snmp_poller_ci_guards.py -x -q` still exits 0 (no regression).
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/test_signage_pptx_pipeline_integration.py tests/test_signage_ci_guards.py tests/test_signage_pptx_service.py tests/test_signage_pptx_upload.py tests/test_signage_pptx_reconvert.py tests/test_signage_pptx_stuck_reset.py -x -q` exits 0.
- On Docker CI with `soffice` + `pdftoppm`: all integration tests PASS (not skipped).
- On developer laptop without soffice: the two binary-dependent integration tests SKIP; everything else still passes.
</verification>

<success_criteria>
- Two fixtures exist (tiny-valid.pptx, corrupt.pptx).
- Integration test file covers: happy path (conversion_status done, slide_paths populated with slides/<uuid>/slide-001.png and friends), corrupt path (conversion_status failed with an expected D-14 code), and stuck-row reset path (scheduler hook behavior end-to-end).
- CI grep guards explicitly cover Phase 44 modules.
- All four Phase 44 requirements (SGN-BE-07, SGN-BE-08, SGN-SCH-03, SGN-INF-01) have at least one passing integration assertion at this point.
</success_criteria>

<output>
After completion, create `.planning/phases/44-pptx-conversion-pipeline/44-05-SUMMARY.md` capturing: fixture provenance, skip semantics (when tests run vs. skip), the exact error codes the corrupt-path test accepts, and any findings (e.g. real soffice exit-code behavior on the corrupt fixture).
</output>
