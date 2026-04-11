"""Settings API — SET-02, SET-03, SET-04, BRAND-01, BRAND-02, BRAND-04, BRAND-09.

Endpoints:
  GET  /api/settings        -> SettingsRead
  PUT  /api/settings        -> SettingsRead (422 on invalid colors per BRAND-09)
  POST /api/settings/logo   -> SettingsRead (422 on bad/oversize/malicious upload)
  GET  /api/settings/logo   -> raw bytes with ETag + Cache-Control (304 on If-None-Match)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.defaults import DEFAULT_SETTINGS
from app.models import AppSettings
from app.schemas import SettingsRead, SettingsUpdate
from app.security.logo_validation import SvgRejected, sanitize_svg, sniff_mime

router = APIRouter(prefix="/api/settings")

ALLOWED_LOGO_EXTENSIONS = {".png", ".svg"}
MAX_LOGO_BYTES = 1 * 1024 * 1024  # 1 MB — D-16


# --- Helpers -------------------------------------------------------------

async def _get_singleton(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        # D-20: migrate service should have seeded this — defensive fallback.
        raise HTTPException(
            status_code=500,
            detail="app_settings singleton missing — run migrations",
        )
    return row


def _build_read(row: AppSettings) -> SettingsRead:
    logo_url: str | None = None
    if row.logo_data is not None and row.logo_updated_at is not None:
        ts = int(row.logo_updated_at.timestamp())
        logo_url = f"/api/settings/logo?v={ts}"
    return SettingsRead(
        color_primary=row.color_primary,
        color_accent=row.color_accent,
        color_background=row.color_background,
        color_foreground=row.color_foreground,
        color_muted=row.color_muted,
        color_destructive=row.color_destructive,
        app_name=row.app_name,
        default_language=row.default_language,
        logo_url=logo_url,
        logo_updated_at=row.logo_updated_at,
    )


def _etag_for(row: AppSettings) -> str:
    # Per Pitfall 4: one helper so response and comparison can't drift.
    assert row.logo_updated_at is not None
    return f'W/"{int(row.logo_updated_at.timestamp())}"'


# --- Handlers ------------------------------------------------------------

@router.get("", response_model=SettingsRead)
async def get_settings(db: AsyncSession = Depends(get_async_db_session)) -> SettingsRead:
    row = await _get_singleton(db)
    return _build_read(row)


@router.put("", response_model=SettingsRead)
async def put_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SettingsRead:
    row = await _get_singleton(db)

    row.color_primary = payload.color_primary
    row.color_accent = payload.color_accent
    row.color_background = payload.color_background
    row.color_foreground = payload.color_foreground
    row.color_muted = payload.color_muted
    row.color_destructive = payload.color_destructive
    row.app_name = payload.app_name
    row.default_language = payload.default_language

    # D-07: if the payload exactly matches canonical defaults, this is a
    # "reset to defaults" — also wipe the logo trio. A non-default PUT
    # (e.g. changing only app_name) preserves the logo.
    if payload.model_dump() == DEFAULT_SETTINGS:
        row.logo_data = None
        row.logo_mime = None
        row.logo_updated_at = None

    await db.commit()
    await db.refresh(row)
    return _build_read(row)


@router.post("/logo", response_model=SettingsRead)
async def post_logo(
    file: UploadFile,
    db: AsyncSession = Depends(get_async_db_session),
) -> SettingsRead:
    # 1. Extension allowlist (D-15) — case-insensitive
    filename = file.filename or ""
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in ALLOWED_LOGO_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {filename}. Only .png and .svg allowed.",
        )

    # 2. Size enforcement (D-16) — don't trust Content-Length; read MAX+1
    raw = await file.read(MAX_LOGO_BYTES + 1)
    if len(raw) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=422, detail="Logo exceeds 1 MB size limit")

    # 3. MIME sniff (D-17) — never trust client-declared Content-Type
    try:
        mime = sniff_mime(raw, ext)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # 4. SVG sanitization (D-12, D-13) — PNG skips nh3 (D-14)
    if ext == ".svg":
        try:
            raw = sanitize_svg(raw)
        except SvgRejected as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    # 5. Persist to singleton row
    row = await _get_singleton(db)
    row.logo_data = raw
    row.logo_mime = mime
    row.logo_updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return _build_read(row)


@router.get("/logo")
async def get_logo(
    request: Request,
    db: AsyncSession = Depends(get_async_db_session),
) -> Response:
    row = await _get_singleton(db)
    if row.logo_data is None or row.logo_updated_at is None:
        raise HTTPException(status_code=404, detail="No logo set")

    etag = _etag_for(row)
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    return Response(
        content=row.logo_data,
        media_type=row.logo_mime or "application/octet-stream",
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=31536000",  # ?v= query param busts it
        },
    )
