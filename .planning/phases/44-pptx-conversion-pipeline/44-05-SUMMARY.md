---
phase: 44-pptx-conversion-pipeline
plan: 05
subsystem: signage/tests
tags: [testing, integration, pptx, libreoffice, pdftoppm, ci-guards]
requires:
  - "Plan 44-01 Phase 44 Docker image with soffice + pdftoppm + fidelity fonts"
  - "Plan 44-02 app.services.signage_pptx.convert_pptx + _download_pptx_from_directus"
  - "Plan 44-02 app.services.directus_uploads module"
  - "Plan 44-04 app.scheduler._run_pptx_stuck_reset"
  - "Phase 43 backend/tests/test_signage_ci_guards.py baseline"
provides:
  - "End-to-end happy-path coverage for soffice -> pdftoppm conversion"
  - "End-to-end corrupt-input coverage (soffice_failed / invalid_pptx branch)"
  - "End-to-end coverage for the stuck-row startup reset hook"
  - "Skip-on-missing-binary contract for developer laptops"
  - "Phase 44-pinned CI grep guards (signage_pptx.py + directus_uploads.py)"
affects:
  - "backend/tests/test_signage_ci_guards.py (extended with 2 new tests)"
tech-stack:
  added: []
  patterns:
    - "shutil.which-gated pytest.mark.skipif for binary deps"
    - "monkeypatch.setattr('app.services.signage_pptx._download_pptx_from_directus', ...) to bypass Directus in integration tests"
    - "direct await convert_pptx(media_id) (bypasses BackgroundTasks) for deterministic integration assertions"
    - "asyncpg-seeded rows mirrored from test_signage_pptx_stuck_reset.py fixture style"
key-files:
  created:
    - "backend/tests/fixtures/signage/tiny-valid.pptx"
    - "backend/tests/fixtures/signage/corrupt.pptx"
    - "backend/tests/fixtures/signage/README.md"
    - "backend/tests/test_signage_pptx_pipeline_integration.py"
  modified:
    - "backend/tests/test_signage_ci_guards.py"
decisions:
  - "Fixture provenance: tiny-valid.pptx generated once via python-pptx locally — NOT added to requirements.txt/requirements-dev.txt (blob is committed, not the generator)"
  - "Integration tests monkeypatch _download_pptx_from_directus (the internal fetch helper in signage_pptx.py) to stage fixture bytes as tempdir/input.pptx, preserving _run_pipeline's exact on-disk contract"
  - "convert_pptx is awaited directly (not via BackgroundTasks) so assertions run after terminal state is written — BackgroundTasks would race the test"
  - "Skip-contract test is always collected (not gated); it pytest.skip()s when binaries ARE present so it only asserts on developer laptops — self-checking guard rather than a silent tautology"
  - "Stuck-row reset integration test intentionally has NO binary requirement so developer laptops can still exercise the startup hook end-to-end"
  - "CI guards: directus_uploads.py must be pinned BY NAME (no 'signage' substring in the filename, so the recursive _signage_modules scan would not cover it); signage_pptx.py is double-covered by recursive scan + explicit pin"
  - "CI guard for directus_uploads.py also bans 'import requests' / 'from requests' — HTTP-client equivalent of hazard #7 (forbid sync I/O in request handlers)"
requirements:
  - SGN-BE-07
  - SGN-BE-08
  - SGN-SCH-03
  - SGN-INF-01
metrics:
  duration: "~10 min"
  tasks: 3
  tests_added: 6
  files_created: 4
  files_modified: 1
  completed: "2026-04-19"
---

# Phase 44 Plan 05: Integration Tests Summary

Added end-to-end integration tests that exercise the real `soffice` +
`pdftoppm` binaries against a tiny valid PPTX fixture and a corrupt
fixture, verified the Plan 44-04 stuck-row startup reset end-to-end, and
extended the Phase 43 CI grep guards to pin the two new Phase 44 modules
(`signage_pptx.py`, `directus_uploads.py`).

## What Shipped

### Fixtures (`backend/tests/fixtures/signage/`)

| File              | Size   | Purpose                                                                 |
| ----------------- | ------ | ----------------------------------------------------------------------- |
| `tiny-valid.pptx` | 29,072 bytes | 2-slide valid PPTX (titles "Slide 1" / "Slide 2"). Generated once with `python-pptx` as a one-off dev-time script — `python-pptx` is NOT in `requirements.txt` or `requirements-dev.txt`. |
| `corrupt.pptx`    | 32 bytes   | Plain-text bytes with a `.pptx` extension. Exercises the `soffice_failed` / `invalid_pptx` failure branch. |
| `README.md`       | —          | Provenance + regeneration script for `tiny-valid.pptx`.                 |

ZIP magic confirmed: `open('tiny-valid.pptx','rb').read(2) == b'PK'`.

### Integration tests (`backend/tests/test_signage_pptx_pipeline_integration.py`)

Four tests, routed by binary availability:

| Test                                      | Requires soffice? | Requires DB? | Covers                                                                                        |
| ----------------------------------------- | ----------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `test_convert_pptx_happy_path`            | yes (skipif)      | yes          | SGN-BE-07 — `pending → processing → done`; `slide_paths` = `["slides/<uuid>/slide-001.png", ...]`; first slide exists on disk at `/app/media/slides/<id>/slide-001.png` |
| `test_convert_pptx_corrupt_pptx`          | yes (skipif)      | yes          | SGN-BE-07 failure branch — `pending → processing → failed` with `conversion_error in {soffice_failed, invalid_pptx}` |
| `test_convert_pptx_skipped_without_binaries` | inverse          | no           | Self-checking skip contract — `pytest.skip()` when binaries present, asserts absence otherwise |
| `test_pptx_stuck_reset_end_to_end`        | no                | yes          | SGN-SCH-03 — seeds a `processing` row with `conversion_started_at = now - 10m`; calls `_run_pptx_stuck_reset()`; asserts `failed / abandoned_on_restart` |

Monkeypatch target for the Directus fetch step:

```python
monkeypatch.setattr(
    "app.services.signage_pptx._download_pptx_from_directus",
    _fake_fetch,  # writes fixture bytes to tempdir/input.pptx
)
```

`convert_pptx(media_id)` is `await`-ed directly — BackgroundTasks is
bypassed so assertions run after terminal state is committed.

### Phase 44 CI guards added to `test_signage_ci_guards.py`

```python
def test_phase44_pptx_service_uses_async_subprocess_only():
    # no subprocess.{run,Popen,call,check_call,check_output}
    # asyncio.create_subprocess_exec present
    # both 'soffice' and 'pdftoppm' appear in the module

def test_phase44_directus_uploads_no_sync_http():
    # httpx import present
    # no 'import requests' / 'from requests'
    # no sync subprocess.{run,Popen,call} either
```

Rationale: the pre-existing `_signage_modules` scan picks up any file
whose path or name contains "signage" (so `signage_pptx.py` is covered
transitively). But `directus_uploads.py` has no such substring — it
must be pinned by name. Adding an explicit Phase 44 test for
`signage_pptx.py` is defence-in-depth and keeps the invariant anchored
to the module the phase goal depends on.

## D-14 Error Codes Accepted in Corrupt-Path Test

The corrupt fixture is plain text with a `.pptx` extension. The exact
exit behavior depends on the `soffice` version:

- Some versions exit non-zero immediately → `soffice_failed`.
- Some versions exit 0 but produce no PDF → `invalid_pptx` (via
  `next(tempdir.glob("*.pdf"))` → `StopIteration`).

Both are accepted by the test: `assert row["conversion_error"] in
{"soffice_failed", "invalid_pptx"}`. On the Phase 44 image
(LibreOffice 25.2.3.2) observed behavior during verification was
`soffice_failed`.

## Skip Semantics (When Tests Run vs. Skip)

| Host                                           | Happy path | Corrupt    | Skip-contract | Stuck-reset |
| ---------------------------------------------- | ---------- | ---------- | ------------- | ----------- |
| Docker CI with LibreOffice + poppler (44-01)   | PASS       | PASS       | SKIP (contract) | PASS      |
| Developer laptop without LibreOffice           | SKIP       | SKIP       | PASS          | PASS (if DB) |
| Any host without Postgres reachable            | SKIP (DB)  | SKIP (DB)  | PASS          | SKIP (DB)   |

Skip reasons are explicit strings surfaced via `pytest.skip(...)`
(`"soffice/pdftoppm not installed on PATH — Docker CI only"` and
`"POSTGRES_* not set — integration tests need a live DB"`), so a
developer running locally can distinguish an environmental skip from a
real failure.

## Verification

Phase 44 full suite run inside the Phase 44 image against the compose Postgres:

```
$ docker run --rm --network kpi-dashboard_default ... kpi-backend-phase44:latest \
    python -m pytest tests/test_signage_pptx_pipeline_integration.py \
                      tests/test_signage_ci_guards.py \
                      tests/test_signage_pptx_service.py \
                      tests/test_signage_pptx_upload.py \
                      tests/test_signage_pptx_reconvert.py \
                      tests/test_signage_pptx_stuck_reset.py -q
33 passed, 1 skipped in 3.50s
```

The single skip is `test_convert_pptx_skipped_without_binaries` — the
self-checking skip-contract test, which intentionally skips when
binaries ARE present.

On the live api container (no LibreOffice yet — Phase 44 image not yet
deployed to compose):

```
$ docker exec kpi-dashboard-api-1 python -m pytest \
    tests/test_signage_pptx_pipeline_integration.py -v
2 passed, 2 skipped in 0.16s
```

`test_convert_pptx_happy_path` and `test_convert_pptx_corrupt_pptx` skip
cleanly (no soffice), while the skip-contract test and the stuck-reset
test pass.

## Acceptance Criteria

| Check | Result |
| --- | --- |
| `test -f backend/tests/fixtures/signage/tiny-valid.pptx` | exists |
| `test -f backend/tests/fixtures/signage/corrupt.pptx` | exists |
| `test -f backend/tests/fixtures/signage/README.md` | exists |
| `read(2) == b'PK'` on tiny-valid.pptx | yes |
| `1024 <= size <= 51200` on tiny-valid.pptx | 29072 bytes |
| `grep -c python-pptx backend/requirements*.txt` | 0 + 0 |
| `grep -c "def test_convert_pptx_happy_path" backend/tests/test_signage_pptx_pipeline_integration.py` | 1 |
| `grep -c "def test_convert_pptx_corrupt_pptx" …` | 1 |
| `grep -c "def test_pptx_stuck_reset_end_to_end" …` | 1 |
| `grep -cE "shutil.which\(.soffice.\)\|shutil.which\(.pdftoppm.\)" …` | 2 |
| `grep -c "pytest.mark.skipif" …` | 1 |
| `grep -c "await _run_pptx_stuck_reset" …` | 1 |
| `grep -cE "await convert_pptx\|await signage_pptx.convert_pptx" …` | 2 |
| `grep -c "signage_pptx" backend/tests/test_signage_ci_guards.py` | 3 |
| `grep -c "directus_uploads" …` | 4 |
| `grep -c "asyncio.create_subprocess_exec" …` | 3 |
| `grep -cE "subprocess.run\|subprocess.Popen\|subprocess.call" …` | 7 |
| `pytest test_signage_pptx_pipeline_integration.py` (Phase 44 image) | 3 passed, 1 skipped |
| `pytest test_signage_ci_guards.py` + `test_snmp_poller_ci_guards.py` | 12 passed |
| Full phase-44 verification suite | 33 passed, 1 skipped |

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes, no auth gates,
no checkpoints. `python-pptx` was available locally (one-off dev-time
install) so the tiny-valid.pptx fixture was produced directly from the
plan's script with no adjustment.

## Known Stubs

None. All four Phase 44 requirements (SGN-BE-07, SGN-BE-08, SGN-SCH-03,
SGN-INF-01) are now backed by at least one passing integration assertion
on the Phase 44 image — the phase-wide verification layer is complete.

## Commits

- `4d8d8f0` chore(44-05): add PPTX integration-test fixtures (tiny-valid + corrupt)
- `c0557e6` test(44-05): add PPTX pipeline integration tests (happy/corrupt/stuck-reset)
- `2157f99` test(44-05): extend CI grep guards to pin Phase 44 modules

## Self-Check: PASSED

- FOUND: backend/tests/fixtures/signage/tiny-valid.pptx (29072 bytes, ZIP magic)
- FOUND: backend/tests/fixtures/signage/corrupt.pptx
- FOUND: backend/tests/fixtures/signage/README.md
- FOUND: backend/tests/test_signage_pptx_pipeline_integration.py
- FOUND: backend/tests/test_signage_ci_guards.py (modified, 12 tests total)
- FOUND: commit 4d8d8f0 (fixtures)
- FOUND: commit c0557e6 (integration tests)
- FOUND: commit 2157f99 (CI guard extension)
- Tests (Phase 44 image): 3 passed + 1 contract-skip for integration file; 6 passed for CI guards; 33 passed + 1 skip across the full Phase 44 suite.
- All plan acceptance greps match exactly.
