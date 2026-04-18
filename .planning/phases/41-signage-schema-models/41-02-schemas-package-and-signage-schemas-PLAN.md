---
phase: 41-signage-schema-models
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/schemas/__init__.py
  - backend/app/schemas/_base.py
  - backend/app/schemas/signage.py
autonomous: true
requirements:
  - SGN-DB-01
must_haves:
  truths:
    - "`from app.schemas import <existing>` still works for every class currently exported by `schemas.py`"
    - "Pydantic schemas exist for every signage ORM class: SignageMedia, SignagePlaylist, SignagePlaylistItem, SignageDevice, SignageDeviceTag, SignagePairingSession"
    - "Every *Read schema uses `model_config = {\"from_attributes\": True}` (Pydantic v2 ORM-conversion)"
  artifacts:
    - path: backend/app/schemas/__init__.py
      provides: "Package entry point re-exporting all existing schemas + signage schemas"
      contains: "from app.schemas.signage import"
    - path: backend/app/schemas/_base.py
      provides: "Legacy Pydantic schemas (moved verbatim from old schemas.py)"
    - path: backend/app/schemas/signage.py
      provides: "Base/Create/Read Pydantic v2 models for each signage entity"
      contains: "class SignageMediaRead"
  key_links:
    - from: backend/app/schemas/__init__.py
      to: backend/app/schemas/_base.py
      via: "explicit re-export"
      pattern: "from app.schemas._base import"
    - from: backend/app/schemas/__init__.py
      to: backend/app/schemas/signage.py
      via: "explicit re-export"
      pattern: "from app.schemas.signage import"
---

<objective>
Convert `backend/app/schemas.py` into a package `backend/app/schemas/`, preserving all existing import paths, and add Pydantic v2 schemas for the signage domain under `backend/app/schemas/signage.py`. Downstream phases (42, 43, 45, 46) import signage schemas from this location.

Purpose: Mirror the ORM models (Plan 01) on the DTO layer so FastAPI routers in later phases can validate requests and serialize responses without re-defining types.

Output: Three Python files; zero behavior change for non-signage code; a Base/Create/Read trio per signage entity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-signage-schema-models/41-CONTEXT.md
@.planning/phases/41-signage-schema-models/41-RESEARCH.md
@backend/app/schemas.py

<interfaces>
Existing Pydantic v2 conventions (from backend/app/schemas.py):
- `from pydantic import BaseModel, Field`
- Read schemas end with: `model_config = {"from_attributes": True}`
- Datetime fields use `datetime`
- UUID fields use `uuid.UUID`
- Literal types are used for enum-like fields: `Literal["a", "b"]`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert schemas.py into a package; add signage schemas</name>
  <files>backend/app/schemas/__init__.py, backend/app/schemas/_base.py (new — holds legacy content), backend/app/schemas/signage.py, backend/app/schemas.py (deleted)</files>
  <read_first>
    - backend/app/schemas.py (enumerate all current classes; content must move verbatim)
    - .planning/phases/41-signage-schema-models/41-CONTEXT.md (decisions D-06, D-07, D-08, D-10)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md (section "Pydantic v2 Schema Scaffold")
  </read_first>
  <action>
    **Step 1: Package split (mirror Plan 01's models split, decision D-10).**
    1. Read `backend/app/schemas.py` and enumerate every top-level class.
    2. Create `backend/app/schemas/` directory.
    3. Move full content of `schemas.py` verbatim into `backend/app/schemas/_base.py`.
    4. Delete `backend/app/schemas.py` (Bash `rm backend/app/schemas.py`).
    5. Create `backend/app/schemas/__init__.py`:
```
"""Schemas package — re-exports every Pydantic v2 class.

Keeps `from app.schemas import X` stable for all existing callers.
"""
from app.schemas._base import *  # noqa: F401,F403 — re-export legacy classes
from app.schemas.signage import (  # noqa: F401
    SignageMediaBase, SignageMediaCreate, SignageMediaRead,
    SignagePlaylistBase, SignagePlaylistCreate, SignagePlaylistRead,
    SignagePlaylistItemBase, SignagePlaylistItemCreate, SignagePlaylistItemRead,
    SignageDeviceBase, SignageDeviceUpdate, SignageDeviceRead,
    SignageDeviceTagBase, SignageDeviceTagCreate, SignageDeviceTagRead,
    SignagePairingRequestResponse, SignagePairingStatusResponse,
    SignagePairingClaimRequest, SignagePairingSessionRead,
)
```
    If `_base.py` does not already have an `__all__`, add `__all__ = [...]` to `_base.py` listing every class actually present so that `from app.schemas._base import *` behaves predictably. Enumerate the list from Step 1's inventory — do not guess.

    **Step 2: Signage schemas (`backend/app/schemas/signage.py`).**

    Top of file:
```
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
```

    Define the following Pydantic v2 classes. Every *Read class ends with `model_config = {"from_attributes": True}`.

    **SignageMedia trio** (per D-06, D-07, D-08):
```
class SignageMediaBase(BaseModel):
    kind: Literal["image", "video", "pdf", "pptx", "url", "html"]
    title: str = Field(..., max_length=255)
    mime_type: str | None = Field(default=None, max_length=127)
    size_bytes: int | None = None
    uri: str | None = None
    duration_ms: int | None = None
    html_content: str | None = None

class SignageMediaCreate(SignageMediaBase):
    pass

class SignageMediaRead(SignageMediaBase):
    id: uuid.UUID
    conversion_status: Literal["pending", "processing", "done", "failed"] | None = None
    slide_paths: list[str] | None = None
    conversion_error: str | None = None
    conversion_started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    **SignagePlaylist trio:**
```
class SignagePlaylistBase(BaseModel):
    name: str = Field(..., max_length=128)
    description: str | None = None
    priority: int = 0
    enabled: bool = True
    tag_ids: list[int] | None = None  # populated by admin UI; resolved via signage_playlist_tag_map

class SignagePlaylistCreate(SignagePlaylistBase):
    pass

class SignagePlaylistRead(SignagePlaylistBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    **SignagePlaylistItem trio:**
```
class SignagePlaylistItemBase(BaseModel):
    media_id: uuid.UUID
    position: int
    duration_s: int = 10
    transition: str | None = Field(default=None, max_length=32)

class SignagePlaylistItemCreate(SignagePlaylistItemBase):
    pass

class SignagePlaylistItemRead(SignagePlaylistItemBase):
    id: uuid.UUID
    playlist_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    **SignageDevice** (read-only from API perspective for most fields; admin may set name + tags):
```
class SignageDeviceBase(BaseModel):
    name: str = Field(..., max_length=128)
    tag_ids: list[int] | None = None

class SignageDeviceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    tag_ids: list[int] | None = None

class SignageDeviceRead(SignageDeviceBase):
    id: uuid.UUID
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None
    current_item_id: uuid.UUID | None = None
    status: Literal["online", "offline", "pending"]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    **SignageDeviceTag trio:**
```
class SignageDeviceTagBase(BaseModel):
    name: str = Field(..., max_length=64)

class SignageDeviceTagCreate(SignageDeviceTagBase):
    pass

class SignageDeviceTagRead(SignageDeviceTagBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    **Pairing session schemas** (used by Phase 42 pair router — defined here so Phase 42 does not re-declare):
```
class SignagePairingRequestResponse(BaseModel):
    pairing_code: str = Field(..., min_length=6, max_length=7)  # "XXX-XXX" display, 6 raw chars
    pairing_session_id: uuid.UUID
    expires_in: int  # seconds

class SignagePairingStatusResponse(BaseModel):
    status: Literal["pending", "claimed", "expired"]
    device_token: str | None = None  # set only on the first status poll after claim

class SignagePairingClaimRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=7)
    device_name: str = Field(..., max_length=128)
    tag_ids: list[int] | None = None

class SignagePairingSessionRead(BaseModel):
    id: uuid.UUID
    code: str
    device_id: uuid.UUID | None = None
    expires_at: datetime
    claimed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

    This implements D-10 (package split), D-06/D-07/D-08 (SignageMedia shape with PPTX + HTML fields), and scaffolds for Phase 42 pairing (decisions D-04/D-05 will wire the alphabet in Phase 42 — Phase 41 only defines schema width).
  </action>
  <verify>
    <automated>cd backend && python -c "
from app.schemas import (
    SignageMediaBase, SignageMediaCreate, SignageMediaRead,
    SignagePlaylistBase, SignagePlaylistCreate, SignagePlaylistRead,
    SignagePlaylistItemBase, SignagePlaylistItemCreate, SignagePlaylistItemRead,
    SignageDeviceBase, SignageDeviceUpdate, SignageDeviceRead,
    SignageDeviceTagBase, SignageDeviceTagCreate, SignageDeviceTagRead,
    SignagePairingRequestResponse, SignagePairingStatusResponse,
    SignagePairingClaimRequest, SignagePairingSessionRead,
)
# Verify Read schemas have from_attributes=True
for cls in [SignageMediaRead, SignagePlaylistRead, SignagePlaylistItemRead, SignageDeviceRead, SignageDeviceTagRead, SignagePairingSessionRead]:
    assert cls.model_config.get('from_attributes') is True, f'{cls.__name__} missing from_attributes'
# Verify Literal enforcement on kind
try:
    SignageMediaCreate(kind='bogus', title='t')
    raise AssertionError('bogus kind should fail')
except Exception:
    pass
print('OK')
" 2>&amp;1 | tee /tmp/41-02.log &amp;&amp; grep -q "^OK$" /tmp/41-02.log</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/schemas.py` no longer exists: `test ! -f backend/app/schemas.py`
    - Package exists: `test -f backend/app/schemas/__init__.py && test -f backend/app/schemas/_base.py && test -f backend/app/schemas/signage.py`
    - Signage module contains all required classes: `for c in SignageMediaBase SignageMediaCreate SignageMediaRead SignagePlaylistBase SignagePlaylistCreate SignagePlaylistRead SignagePlaylistItemBase SignagePlaylistItemCreate SignagePlaylistItemRead SignageDeviceBase SignageDeviceUpdate SignageDeviceRead SignageDeviceTagBase SignageDeviceTagCreate SignageDeviceTagRead SignagePairingRequestResponse SignagePairingStatusResponse SignagePairingClaimRequest SignagePairingSessionRead; do grep -q "^class $c(" backend/app/schemas/signage.py || exit 1; done`
    - All Read schemas have from_attributes: `grep -c 'model_config = {"from_attributes": True}' backend/app/schemas/signage.py` >= 6
    - Literal on kind: `grep -q 'Literal\["image", "video", "pdf", "pptx", "url", "html"\]' backend/app/schemas/signage.py`
    - Literal on conversion_status: `grep -q 'Literal\["pending", "processing", "done", "failed"\]' backend/app/schemas/signage.py`
    - The automated verify command above outputs `OK`
  </acceptance_criteria>
  <done>Package split complete; signage Pydantic schemas importable via `from app.schemas import SignageMediaRead` (and every class listed); all Read schemas ORM-convertible via `from_attributes=True`.</done>
</task>

</tasks>

<verification>
```
cd backend && python -c "
import app.schemas as s
import inspect
classes = [n for n,o in inspect.getmembers(s, inspect.isclass) if n.startswith('Signage')]
print('signage schemas exported:', sorted(classes))
assert len(classes) >= 19, f'expected >=19 signage schemas, got {len(classes)}'
"
```
</verification>

<success_criteria>
- `backend/app/schemas/` is a package; `schemas.py` file removed
- All 19 signage schema classes (6 *Read + 6 *Create + 4 *Base + SignageDeviceUpdate + 3 pairing request/response classes) exist and are importable
- Literal types mirror DB CHECK values exactly (kind, conversion_status, status)
- Every *Read has `model_config = {"from_attributes": True}`
- Legacy schemas still import via old paths
</success_criteria>

<output>
After completion, create `.planning/phases/41-signage-schema-models/41-02-SUMMARY.md` recording: legacy class list found, exact final class inventory, any renaming required for `_base.py` `__all__`, and the verification script output.
</output>
