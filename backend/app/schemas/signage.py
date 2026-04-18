"""Pydantic v2 schemas for the signage domain.

Mirrors the ORM models in `app.models.signage` on the DTO layer so FastAPI
routers in later phases (42, 43, 45, 46) can validate requests and serialize
responses without re-defining types.

Conventions (match existing `_base.py`):
- Every *Read schema ends with `model_config = {"from_attributes": True}`
- Literal types mirror DB CHECK constraints exactly
- Uses `uuid.UUID` and `datetime` directly
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# SignageMedia (D-06 / D-07 / D-08)
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# SignagePlaylist
# --------------------------------------------------------------------------


class SignagePlaylistBase(BaseModel):
    name: str = Field(..., max_length=128)
    description: str | None = None
    priority: int = 0
    enabled: bool = True
    # Populated by admin UI; resolved via signage_playlist_tag_map.
    tag_ids: list[int] | None = None


class SignagePlaylistCreate(SignagePlaylistBase):
    pass


class SignagePlaylistRead(SignagePlaylistBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------
# SignagePlaylistItem
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# SignageDevice — admin may set name + tags; other fields read-only from API
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# SignageDeviceTag
# --------------------------------------------------------------------------


class SignageDeviceTagBase(BaseModel):
    name: str = Field(..., max_length=64)


class SignageDeviceTagCreate(SignageDeviceTagBase):
    pass


class SignageDeviceTagRead(SignageDeviceTagBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------
# Pairing session schemas (used by Phase 42 pair router — defined here so
# Phase 42 does not re-declare). Decisions D-04 / D-05 will wire the
# alphabet in Phase 42; Phase 41 only defines schema width.
# --------------------------------------------------------------------------


class SignagePairingRequestResponse(BaseModel):
    # "XXX-XXX" display, 6 raw chars (7 incl. hyphen).
    pairing_code: str = Field(..., min_length=6, max_length=7)
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
