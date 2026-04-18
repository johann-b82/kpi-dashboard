---
phase: 41-signage-schema-models
plan: 02
subsystem: backend/schemas
tags: [schemas, pydantic, signage, dto]
requires:
  - Pydantic v2 (>=2.9.0, via FastAPI)
provides:
  - "backend/app/schemas/ package (import path preserved)"
  - "19 signage Pydantic v2 schemas (Base/Create/Read + pairing flow DTOs)"
affects:
  - "downstream phases 42, 43, 45, 46 (import signage schemas from app.schemas)"
tech-stack:
  added: []
  patterns:
    - "Pydantic v2 ORM mode (`model_config = {\"from_attributes\": True}`)"
    - "Literal types mirror DB CHECK constraints"
    - "Package split with explicit `__all__` in `_base.py` to keep re-exports predictable"
key-files:
  created:
    - backend/app/schemas/__init__.py
    - backend/app/schemas/_base.py
    - backend/app/schemas/signage.py
  modified: []
  deleted:
    - backend/app/schemas.py
decisions:
  - "D-06/D-07/D-08 applied: SignageMedia schema carries PPTX conversion fields (conversion_status Literal, slide_paths list, conversion_error, conversion_started_at) and html_content for kind=html"
  - "D-10 applied: schemas.py split into package the same way models was split in Plan 01"
  - "Used explicit `__all__` list in `_base.py` enumerating every legacy class (29 names including OklchColor type alias) so `from app.schemas._base import *` stays predictable"
metrics:
  duration_seconds: 156
  tasks_completed: 1
  files_changed: 4
  completed_at: "2026-04-18"
---

# Phase 41 Plan 02: Schemas Package and Signage Schemas Summary

One-liner: Converted `backend/app/schemas.py` into a package and added 19 Pydantic v2 signage DTOs (Base/Create/Read trios + pairing flow schemas) so downstream phases can validate/serialize without re-declaring types.

## Tasks Completed

| Task | Name                                                    | Commit  | Files                                                         |
| ---- | ------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| 1    | Convert schemas.py into a package; add signage schemas | 12a854e | schemas/__init__.py, schemas/_base.py (moved), schemas/signage.py |

## Legacy Class Inventory (moved to `_base.py`)

Enumerated from the old `backend/app/schemas.py`:

- ValidationErrorDetail, UploadResponse, UploadBatchSummary
- KpiSummaryComparison, KpiSummary, ChartPoint, ChartResponse, LatestUploadResponse
- `OklchColor` (Annotated type alias — included in `__all__`)
- SettingsUpdate, SettingsRead
- SyncResult, SyncTestResult, AbsenceTypeOption, PersonioOptions
- SyncMetaRead
- HrKpiValue, HrKpiResponse
- SalesRecordRead, HrKpiHistoryPoint, EmployeeRead
- CurrentUser
- SensorRead, SensorCreate, SensorUpdate, SensorReadingRead, PollNowResult, SnmpProbeRequest, SnmpWalkRequest

Underscore helpers (`_OKLCH_RE`, `_FORBIDDEN_CHARS`, `_FORBIDDEN_TOKENS`, `_validate_oklch`) intentionally omitted from `__all__` — they remain module-private to `_base.py`.

## Signage Schema Inventory (`signage.py`)

19 classes, matching the plan's expected count:

| Group        | Base                     | Create                         | Read / Update                             |
| ------------ | ------------------------ | ------------------------------ | ----------------------------------------- |
| Media        | SignageMediaBase         | SignageMediaCreate             | SignageMediaRead                          |
| Playlist     | SignagePlaylistBase      | SignagePlaylistCreate          | SignagePlaylistRead                       |
| PlaylistItem | SignagePlaylistItemBase  | SignagePlaylistItemCreate      | SignagePlaylistItemRead                   |
| Device       | SignageDeviceBase        | — (created via pairing claim)  | SignageDeviceRead, SignageDeviceUpdate    |
| Device Tag   | SignageDeviceTagBase     | SignageDeviceTagCreate         | SignageDeviceTagRead                      |
| Pairing      | —                        | SignagePairingClaimRequest     | SignagePairingRequestResponse, SignagePairingStatusResponse, SignagePairingSessionRead |

All six `*Read` classes (SignageMediaRead, SignagePlaylistRead, SignagePlaylistItemRead, SignageDeviceRead, SignageDeviceTagRead, SignagePairingSessionRead) carry `model_config = {"from_attributes": True}`.

## Deviations from Plan

None — plan executed exactly as written. `_base.py` did not previously declare `__all__`, so one was added listing every top-level class (per the plan's instruction in Step 1, final paragraph).

## Verification

Ran inside `kpi-dashboard-api-1` container (Python 3.12, Pydantic 2.x):

```
$ docker exec kpi-dashboard-api-1 python -c "
  from app.schemas import ( ...all 19 signage classes... )
  for cls in [SignageMediaRead, SignagePlaylistRead, SignagePlaylistItemRead,
              SignageDeviceRead, SignageDeviceTagRead, SignagePairingSessionRead]:
      assert cls.model_config.get('from_attributes') is True
  try: SignageMediaCreate(kind='bogus', title='t'); raise AssertionError
  except Exception: pass
  print('OK')"
OK

$ docker exec kpi-dashboard-api-1 python -c "
  import app.schemas as s, inspect
  classes = [n for n,o in inspect.getmembers(s, inspect.isclass) if n.startswith('Signage')]
  assert len(classes) >= 19
  print(sorted(classes))"
['SignageDeviceBase', 'SignageDeviceRead', 'SignageDeviceTagBase',
 'SignageDeviceTagCreate', 'SignageDeviceTagRead', 'SignageDeviceUpdate',
 'SignageMediaBase', 'SignageMediaCreate', 'SignageMediaRead',
 'SignagePairingClaimRequest', 'SignagePairingRequestResponse',
 'SignagePairingSessionRead', 'SignagePairingStatusResponse',
 'SignagePlaylistBase', 'SignagePlaylistCreate', 'SignagePlaylistItemBase',
 'SignagePlaylistItemCreate', 'SignagePlaylistItemRead', 'SignagePlaylistRead']
```

Also confirmed the running FastAPI app still imports cleanly:

```
$ docker exec kpi-dashboard-api-1 python -c "from app.main import app; print('app loads OK')"
app loads OK
```

## Acceptance Criteria

- [x] `backend/app/schemas.py` removed (replaced by package directory)
- [x] `backend/app/schemas/{__init__.py,_base.py,signage.py}` all exist
- [x] All 19 signage schema class definitions present in `signage.py`
- [x] Read schemas have `from_attributes=True` (6 occurrences confirmed in `signage.py`)
- [x] Literal on `kind`: `Literal["image", "video", "pdf", "pptx", "url", "html"]`
- [x] Literal on `conversion_status`: `Literal["pending", "processing", "done", "failed"]`
- [x] Verification script prints `OK`
- [x] Legacy imports (`from app.schemas import X`) still work for every existing class
- [x] FastAPI app (`app.main`) still imports without error

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/app/schemas/__init__.py
- FOUND: backend/app/schemas/_base.py
- FOUND: backend/app/schemas/signage.py
- FOUND: commit 12a854e
