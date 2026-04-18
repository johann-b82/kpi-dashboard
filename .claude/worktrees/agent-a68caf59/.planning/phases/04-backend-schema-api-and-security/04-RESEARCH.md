# Phase 4: Backend — Schema, API, and Security - Research

**Researched:** 2026-04-11
**Domain:** FastAPI + SQLAlchemy async backend; HTML/SVG sanitization; CSS color validation; Alembic singleton seeding
**Confidence:** HIGH (stack verified against installed code; nh3/SVG behavior verified against ammonia docs; versions verified against PyPI)

## Summary

Phase 4 is a pure-backend phase adding one table (`app_settings`, singleton), one router (`/api/settings/*`), one new dependency (`nh3`), one Alembic migration, and a `defaults.py` module. All locked decisions in CONTEXT.md fix the architecture; what remains is choosing concrete patterns that match the existing v1.0 backend idiom.

The v1.0 backend is uncompromisingly async (asyncpg + `AsyncSession` + `await` everywhere), has **no `backend/tests/` directory yet**, uses the `APIRouter(prefix="/api")` idiom, and already uses `HTTPException(422)` for validation failures. Alembic runs on an **async** engine in this project (`env.py` uses `async_engine_from_config`), which differs from the "Alembic is sync" line in CLAUDE.md — but migration functions themselves are still written against `op.*` and look identical to a sync Alembic migration. Planners should not rewrite `env.py`.

The two security gates are the load-bearing work: (1) `nh3` with an **explicit SVG allowlist** — nh3/ammonia's default `ALLOWED_TAGS` contain **zero SVG elements**, so the handler MUST pass a custom `tags=` set, and (2) a strict Pydantic regex for oklch that rejects every character in the BRAND-09 charset. Both are implementable in ~40 lines each with no extra dependencies beyond `nh3`.

**Primary recommendation:** Use the module-level constants + Pydantic `Annotated[str, AfterValidator(...)]` pattern for color fields, byte-equality `nh3.clean(raw) == raw` for reject-on-mutation, a CHECK constraint `id = 1` for singleton enforcement (simpler than a partial unique index), a plain `Response(content=bytes, media_type=..., headers={"ETag": ...})` for the logo endpoint (no StreamingResponse needed for 1 MB), and a brand new test harness in Wave 0 (`pytest` + `httpx.AsyncClient` + `asgi-lifespan`) because none exists yet.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data model**
- **D-01:** Singleton `app_settings` table with logo bytes as columns on the same row — no separate `app_logos` table. Columns: `id` (CHECK constraint id=1 or equivalent), 6 color fields (oklch strings), `app_name`, `default_language` (enum DE/EN), `logo_data` (bytea nullable), `logo_mime` (text nullable), `logo_updated_at` (timestamptz nullable).
- **D-02:** Singleton enforcement via primary-key constraint that only allows `id = 1`. Exact mechanism is Claude's discretion; invariant is "exactly one row, ever."

**API surface**
- **D-03:** `GET /api/settings` returns JSON including `logo_url` (e.g. `/api/settings/logo?v=<logo_updated_at epoch>`) and `logo_updated_at`. `logo_url` is `null` when no logo set.
- **D-04:** `GET /api/settings/logo` is a separate endpoint that streams raw bytes with stored `Content-Type` and an ETag derived from `logo_updated_at`. Browser caches the image; cache-busting via query param in `logo_url`.
- **D-05:** `PUT /api/settings` accepts colors, app_name, default_language. Does NOT accept logo bytes.
- **D-06:** `POST /api/settings/logo` accepts `multipart/form-data`, validates extension + size + sanitizes, then writes `logo_data`/`logo_mime`/`logo_updated_at` on the singleton row.

**Reset semantics**
- **D-07:** Reset = "full reset". `PUT /api/settings` with the canonical default payload from `defaults.py` clears the logo too (sets `logo_data`/`logo_mime`/`logo_updated_at` to `NULL`). Canonical default = "no logo — fall back to app name text".
- **D-08:** No separate `DELETE /api/settings/logo` endpoint in v1.1.

**Color validation (BRAND-09)**
- **D-09:** API accepts **oklch strings only** on the wire. Frontend converts hex → oklch via `culori`. Backend uses a strict regex — no color parser dependency.
- **D-10:** Pydantic `@field_validator` with strict regex matching `oklch(L C H)` (L is 0–1 or percentage, C numeric, H numeric with optional deg). Rejects any string containing `;`, `{`, `}`, `url(`, `expression(`, `"`, `'`, backticks, `\`, `<`, `>`. Returns HTTP 422 on mismatch.
- **D-11:** All 6 semantic tokens (primary, accent, background, foreground, muted, destructive) share the same validator.

**SVG sanitization (BRAND-02)**
- **D-12:** `nh3` with strict SVG-safe allowlist; disallow `<script>`, `<foreignObject>`, `on*` attrs, `javascript:` / `data:` URIs in `href`/`xlink:href`.
- **D-13:** **Reject on mutation.** If sanitized bytes differ from input, respond HTTP 422 — "SVG contained disallowed content and was rejected". Byte-equality is the simplest correct diff.
- **D-14:** PNG uploads skip nh3. PNG validated by magic-byte sniff + size check only. No image re-encoding in v1.1.

**File upload validation**
- **D-15:** Extension allowlist: `.png`, `.svg` only. Case-insensitive. Reject with 422.
- **D-16:** Size limit: 1 MB hard cap — enforced on `UploadFile.read()` length, not just `Content-Length`.
- **D-17:** MIME sniff by content (magic bytes for PNG, XML/SVG detection for SVG) — don't trust client-provided `Content-Type`.

**Defaults seeding**
- **D-18:** Alembic migration that creates `app_settings` also `INSERT`s the default singleton row in the same `upgrade()`. Defaults duplicated from `backend/app/defaults.py` into the migration (migrations shouldn't import live app code). Comment points at `defaults.py` as source of truth for future drift.
- **D-19:** `backend/app/defaults.py` is a plain Python module exposing `DEFAULT_SETTINGS` dict, used by reset endpoint and tests. Frontend never reads it.
- **D-20:** No FastAPI startup event touches `app_settings`. Migrate service has already seeded it by the time API starts.

**Caching**
- **D-21:** `logo_updated_at` doubles as cache-buster and ETag source. Monotonic per upload; no separate version counter.

### Claude's Discretion

- Exact singleton enforcement mechanism (CHECK constraint vs fixed PK sentinel vs partial unique index)
- Alembic migration filename and revision IDs
- Pydantic model layout (one model vs separate request/response)
- Whether oklch regex allows percentage vs decimal L, with/without `deg` on H (err "accept both, reject anything else")
- Error message wording
- Whether to use a sub-router or keep handlers in existing `/api` router
- Test layout and fixture strategy

### Deferred Ideas (OUT OF SCOPE)

- Dedicated `DELETE /api/settings/logo` endpoint — full reset covers it in v1.1
- Backend color conversion (hex → oklch) — frontend handles it
- Admin-only gating on PUT / logo upload — requires Authentik (v2)
- Optimistic concurrency on PUT — last-write-wins acceptable
- PNG re-encoding / image optimization — pass-through in v1.1
- Logo dimension constraints — CSS constrains display to 60×60; bytes preserved

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-02 | `app_settings` singleton table via Alembic migration | Singleton pattern (CHECK constraint `id=1`); migration seed via `op.bulk_insert` — see Code Examples |
| SET-03 | `GET`/`PUT /api/settings` with Pydantic validation | FastAPI router pattern matches `routers/uploads.py`; Pydantic v2 `Annotated` validator pattern |
| SET-04 | Reset to canonical defaults from `defaults.py` | No special endpoint — `PUT` with defaults payload. Reset = null out logo columns too (D-07) |
| BRAND-01 | Logo upload (PNG/SVG, 1 MB) | Magic-byte sniffing, `UploadFile.read()` length cap, extension allowlist |
| BRAND-02 | `nh3` SVG sanitization — server-side | `nh3.clean(html, tags=..., attributes=..., url_schemes=...)` with explicit SVG allowlist (defaults have ZERO SVG tags) |
| BRAND-04 | `logo_updated_at` column + ETag + cache-busting query param | Plain `Response` with `ETag: W/"<ts>"` header + manual `If-None-Match` check → 304 |
| BRAND-09 | Pydantic strict regex rejecting CSS injection charset | Strict oklch regex; `AfterValidator` for character-blacklist pass |

</phase_requirements>

## Standard Stack

### Core (already pinned in the project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Router, `UploadFile`, Response | Already in `requirements.txt`; matches `routers/uploads.py` pattern |
| SQLAlchemy | 2.0.49 (async) | ORM for `AppSettings` model | Already used with `Mapped`/`mapped_column` in `models.py` |
| asyncpg | 0.31.0 | Async PG driver | Already configured in `database.py` — handles `bytea` round-tripping transparently via Python `bytes` |
| Alembic | 1.18.4 | Migration + singleton seed | Project uses `async_engine_from_config` in `env.py` — migrations themselves still use normal `op.*` calls |
| Pydantic v2 | ≥2.9 (via FastAPI) | `SettingsRead`/`SettingsUpdate` validation | Already used in `schemas.py` with `model_config = {"from_attributes": True}` |

### New dependency (must add to `requirements.txt`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **nh3** | **0.3.4** (latest) | HTML/SVG allowlist sanitizer | Rust-backed (ammonia crate), pre-built wheels, no compiler in Docker. STATE.md decided `0.3.3`; **0.3.4 released 2026-03-25** is newer and should be used unless the planner has a reason to stick. Both are post RUSTSEC-2021-0074. |

Verification: `curl https://pypi.org/pypi/nh3/json` → 0.3.4, 2026-03-25. 0.3.3 released 2026-02-14.

### Test stack (NEW — no tests exist yet)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | 9.0.3 | Test runner | De-facto Python test runner |
| pytest-asyncio | 1.3.0 | Async fixture/test support | Required for async DB sessions and `httpx.AsyncClient` |
| httpx | 0.28.1 | In-process ASGI test client | **Replaces** FastAPI's deprecated `TestClient` for async apps; supported by FastAPI docs |
| asgi-lifespan | 2.1.0 | Lifespan events in tests | Required so `httpx.AsyncClient` triggers FastAPI startup (even empty lifespans) — safe default even if not strictly needed now |

Add to `backend/requirements-dev.txt`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nh3 | bleach | Pure Python, slower, less maintained. nh3 has already been decided. |
| Byte-equality mutation detection | Structural XML compare | Byte-equality over-rejects (whitespace changes → 422), but success criterion #3 requires "no script in retrieved bytes" — over-rejection is safer and D-13 explicitly endorses "byte-equality is the simplest correct answer". |
| `Response(bytes)` for logo | `StreamingResponse` | StreamingResponse is for chunked large files; 1 MB fits trivially in a single Response. Simpler, fewer footguns with Content-Length. |
| CHECK constraint `id=1` | Fixed PK only (no autoincrement, always `id=1`) | CHECK is declarative and fails loudly. Fixed-PK without CHECK lets a future dev accidentally insert `id=2`. Partial unique index is more complex for no gain. |
| `op.bulk_insert` in migration | `op.execute("INSERT ...")` | `op.bulk_insert` is type-safe and Alembic-idiomatic; see Code Examples. |
| New `APIRouter(prefix="/api/settings")` sub-router | Add handlers to existing `/api` router | Sub-router is cleaner for a bundled feature and matches FastAPI best practice. `backend/app/routers/kpis.py` and `routers/uploads.py` already use separate routers — follow the pattern. |

**Installation:**
```bash
# Production — add to backend/requirements.txt
nh3==0.3.4

# Dev — add to backend/requirements-dev.txt
pytest==9.0.3
pytest-asyncio==1.3.0
httpx==0.28.1
asgi-lifespan==2.1.0
```

## Architecture Patterns

### File Layout
```
backend/
├── app/
│   ├── main.py                  # add: app.include_router(settings_router)
│   ├── models.py                # add: class AppSettings
│   ├── schemas.py               # add: SettingsRead, SettingsUpdate
│   ├── defaults.py              # NEW — DEFAULT_SETTINGS dict
│   ├── routers/
│   │   └── settings.py          # NEW — handlers, validators, security gates
│   └── security/                # OPTIONAL — if planner wants separation
│       └── svg_sanitize.py      # nh3 allowlist + reject-on-mutation
├── alembic/
│   └── versions/
│       └── <rev>_v1_1_app_settings.py   # NEW — creates table + seeds singleton
├── tests/                                # NEW — does not exist yet
│   ├── __init__.py
│   ├── conftest.py                       # async client fixture, db reset
│   └── test_settings.py                  # 5 success-criteria tests + edge cases
└── requirements.txt            # add nh3==0.3.4
└── requirements-dev.txt        # add pytest, pytest-asyncio, httpx, asgi-lifespan
```

### Pattern 1: Singleton table with CHECK constraint
**What:** SQLAlchemy 2.0 `Mapped` model with `__table_args__` containing a CHECK constraint, no autoincrement.
**When to use:** Always, for project-wide singleton config rows.
**Example:**
```python
# backend/app/models.py
from sqlalchemy import CheckConstraint, LargeBinary, String, Text, DateTime
from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.orm import Mapped, mapped_column

class AppSettings(Base):
    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_app_settings_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)

    # Colors — oklch strings validated at Pydantic layer
    color_primary: Mapped[str] = mapped_column(String(64), nullable=False)
    color_accent: Mapped[str] = mapped_column(String(64), nullable=False)
    color_background: Mapped[str] = mapped_column(String(64), nullable=False)
    color_foreground: Mapped[str] = mapped_column(String(64), nullable=False)
    color_muted: Mapped[str] = mapped_column(String(64), nullable=False)
    color_destructive: Mapped[str] = mapped_column(String(64), nullable=False)

    # App identity
    app_name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_language: Mapped[str] = mapped_column(String(2), nullable=False)  # 'DE' | 'EN'

    # Logo (nullable = "no logo")
    logo_data: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)
    logo_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    logo_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

Note: `BYTEA` import is `from sqlalchemy.dialects.postgresql import BYTEA` — `LargeBinary` also works and is dialect-agnostic, but since the project is postgres-only and the CLAUDE.md references PG directly, `BYTEA` is more explicit.

### Pattern 2: Pydantic v2 reusable color validator via `Annotated`
**What:** Type alias carrying the validator; all 6 color fields use the alias.
**When to use:** Any time N fields share validation logic.
**Example:**
```python
# backend/app/schemas.py
from typing import Annotated, Literal
import re
from pydantic import AfterValidator, BaseModel

# D-10: accept oklch(L C H) where L is 0-1 or 0-100%, C numeric, H numeric with optional 'deg'
# Reject any CSS-injection character.
_OKLCH_RE = re.compile(
    r"^oklch\(\s*"
    r"(?:0|1|0?\.\d+|100%?|\d{1,2}(?:\.\d+)?%?)"      # L: 0..1 decimal OR 0..100 percentage
    r"\s+"
    r"(?:\d+(?:\.\d+)?)"                               # C: numeric (0..0.5-ish)
    r"\s+"
    r"(?:-?\d+(?:\.\d+)?)(?:deg)?"                     # H: numeric with optional 'deg'
    r"\s*\)$"
)
_FORBIDDEN = set(";{}\"'`\\<>")
_FORBIDDEN_TOKENS = ("url(", "expression(", "/*", "*/")

def _validate_oklch(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("color must be a string")
    if any(ch in _FORBIDDEN for ch in value):
        raise ValueError("color contains forbidden character")
    lowered = value.lower()
    if any(tok in lowered for tok in _FORBIDDEN_TOKENS):
        raise ValueError("color contains forbidden token")
    if not _OKLCH_RE.match(value):
        raise ValueError("color must be a valid oklch(L C H) string")
    return value

OklchColor = Annotated[str, AfterValidator(_validate_oklch)]

class SettingsUpdate(BaseModel):
    color_primary: OklchColor
    color_accent: OklchColor
    color_background: OklchColor
    color_foreground: OklchColor
    color_muted: OklchColor
    color_destructive: OklchColor
    app_name: Annotated[str, Field(min_length=1, max_length=100)]
    default_language: Literal["DE", "EN"]

class SettingsRead(BaseModel):
    color_primary: str
    color_accent: str
    color_background: str
    color_foreground: str
    color_muted: str
    color_destructive: str
    app_name: str
    default_language: Literal["DE", "EN"]
    logo_url: str | None
    logo_updated_at: datetime | None

    model_config = {"from_attributes": True}
```

Note the belt-and-braces approach: character blacklist runs BEFORE the regex, so even if the regex has a flaw it can never accept `;` or `url(`.

### Pattern 3: SVG sanitization with reject-on-mutation
**What:** Call `nh3.clean()` with an explicit SVG allowlist, then compare bytes.
**Why this matters:** **nh3's default `ALLOWED_TAGS` contains zero SVG elements** — passing a raw SVG through `nh3.clean(raw)` with defaults strips everything. You MUST pass a custom `tags=` set.
**Example:**
```python
# backend/app/security/svg_sanitize.py  (or inline in routers/settings.py)
import nh3

SVG_ALLOWED_TAGS = {
    "svg", "g", "defs", "symbol", "use",
    "title", "desc",
    "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan",
    "linearGradient", "radialGradient", "stop",
    "clipPath", "mask",
}
# Map of tag -> set of allowed attributes. nh3 accepts a dict[str, set[str]].
SVG_ALLOWED_ATTRIBUTES: dict[str, set[str]] = {
    "svg": {"xmlns", "viewBox", "width", "height", "fill", "stroke", "preserveAspectRatio", "version"},
    "g":   {"transform", "fill", "stroke", "opacity", "clip-path", "mask"},
    "path": {"d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "transform", "opacity"},
    "rect": {"x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width", "transform", "opacity"},
    "circle": {"cx", "cy", "r", "fill", "stroke", "stroke-width", "transform", "opacity"},
    "ellipse": {"cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width", "transform", "opacity"},
    "line": {"x1", "y1", "x2", "y2", "stroke", "stroke-width", "transform"},
    "polyline": {"points", "fill", "stroke", "stroke-width", "transform"},
    "polygon": {"points", "fill", "stroke", "stroke-width", "transform"},
    "text": {"x", "y", "dx", "dy", "font-family", "font-size", "fill", "text-anchor", "transform"},
    "tspan": {"x", "y", "dx", "dy", "font-family", "font-size", "fill"},
    "linearGradient": {"id", "x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform"},
    "radialGradient": {"id", "cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform"},
    "stop": {"offset", "stop-color", "stop-opacity"},
    "clipPath": {"id", "clipPathUnits"},
    "mask": {"id", "maskUnits", "x", "y", "width", "height"},
    "use": {"href", "x", "y", "width", "height", "transform"},  # href only; NO xlink:href
    "symbol": {"id", "viewBox"},
    "title": set(),
    "desc": set(),
}
SVG_ALLOWED_URL_SCHEMES = {"https"}  # NO javascript:, NO data:

class SvgRejected(Exception):
    """Raised when nh3 mutated the input bytes (reject-on-mutation)."""

def sanitize_svg(raw_bytes: bytes) -> bytes:
    """Return the input bytes unchanged IFF nh3 did not modify them; else raise."""
    try:
        raw_text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SvgRejected("SVG must be valid UTF-8") from exc

    cleaned = nh3.clean(
        raw_text,
        tags=SVG_ALLOWED_TAGS,
        attributes=SVG_ALLOWED_ATTRIBUTES,
        url_schemes=SVG_ALLOWED_URL_SCHEMES,
        strip_comments=True,
    )
    if cleaned != raw_text:
        raise SvgRejected("SVG contained disallowed content and was rejected")
    return raw_bytes
```

**Critical notes:**
1. `nh3.ALLOWED_TAGS` default set is HTML (`a`, `p`, `div`, `img`, ...) — **no SVG**. This means a *permissive*-looking handler that just calls `nh3.clean(raw)` will reject every legitimate SVG. Must use explicit allowlist.
2. Pass `tags=SVG_ALLOWED_TAGS` (not `tags=nh3.ALLOWED_TAGS | SVG_ALLOWED_TAGS`). We want an SVG-only document; HTML elements in a logo file are suspicious.
3. `url_schemes={"https"}` bans `javascript:` and `data:` URIs in `href`. `xlink:href` is not in the allowed attributes list — modern SVG uses `href`.
4. `strip_comments=True` means any `<!-- -->` in the SVG will cause byte-equality to fail. That's fine — users uploading logos can re-export without comments. Document this in the 422 error message.
5. nh3 takes input as `str`, not `bytes`. Decode UTF-8 first.
6. No `attribute_filter` callback is needed — the static allowlist covers the threat model.

### Pattern 4: Magic-byte sniffing
**What:** Read the first bytes of the uploaded file and verify they match the claimed extension. Don't trust `Content-Type`.
**Example:**
```python
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"  # 8 bytes

def sniff_mime(raw: bytes, ext: str) -> str:
    """Return the canonical MIME type for the bytes, or raise HTTPException(422)."""
    if ext == ".png":
        if not raw.startswith(PNG_SIGNATURE):
            raise HTTPException(422, "File is not a valid PNG")
        return "image/png"
    if ext == ".svg":
        # SVG is XML — optional <?xml?> declaration, then <svg ...>
        stripped = raw.lstrip()  # allow BOM / leading whitespace
        if stripped.startswith(b"\xef\xbb\xbf"):  # UTF-8 BOM
            stripped = stripped[3:].lstrip()
        if not (stripped.startswith(b"<?xml") or stripped.startswith(b"<svg")):
            raise HTTPException(422, "File is not a valid SVG")
        return "image/svg+xml"
    raise HTTPException(422, f"Unsupported extension: {ext}")
```

PNG signature reference: `89 50 4E 47 0D 0A 1A 0A` — the canonical 8-byte header. Stopping at the signature check is sufficient; no need to parse IHDR chunks for v1.1 (locked decision: "no re-encoding in v1.1" implies minimal parsing).

### Pattern 5: Logo upload handler (full flow)
```python
# backend/app/routers/settings.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import AppSettings
from app.schemas import SettingsRead, SettingsUpdate
from app.defaults import DEFAULT_SETTINGS
from app.security.svg_sanitize import sanitize_svg, SvgRejected

router = APIRouter(prefix="/api/settings")

ALLOWED_EXTENSIONS = {".png", ".svg"}
MAX_LOGO_BYTES = 1 * 1024 * 1024  # 1 MB

async def _get_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        # Migration should have seeded this — but defensive fallback
        raise HTTPException(500, "app_settings singleton missing — run migrations")
    return row

def _build_read(row: AppSettings) -> SettingsRead:
    logo_url = None
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

@router.get("", response_model=SettingsRead)
async def get_settings(db: AsyncSession = Depends(get_async_db_session)):
    row = await _get_settings(db)
    return _build_read(row)

@router.put("", response_model=SettingsRead)
async def put_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_async_db_session),
):
    row = await _get_settings(db)
    # Full reset semantics: if payload == DEFAULT_SETTINGS, wipe logo too (D-07).
    # (Simpler: always allow caller to overwrite non-logo fields; detect "is defaults"
    # and then clear logo columns. The planner may instead always clear-logo-on-PUT
    # if the semantic is "PUT replaces the whole settings document". Talk it over.)
    row.color_primary = payload.color_primary
    row.color_accent = payload.color_accent
    # ... etc
    row.app_name = payload.app_name
    row.default_language = payload.default_language

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
):
    filename = file.filename or ""
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(422, f"Unsupported file type: {filename}. Only .png and .svg allowed.")

    # Enforce size AT READ TIME — don't trust Content-Length header
    raw = await file.read(MAX_LOGO_BYTES + 1)
    if len(raw) > MAX_LOGO_BYTES:
        raise HTTPException(422, "Logo exceeds 1 MB size limit")

    mime = sniff_mime(raw, ext)  # magic-byte check

    if ext == ".svg":
        try:
            raw = sanitize_svg(raw)
        except SvgRejected as exc:
            raise HTTPException(422, str(exc)) from exc
        # raw is unchanged iff nh3 did not mutate — store as-is

    row = await _get_settings(db)
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
):
    row = await _get_settings(db)
    if row.logo_data is None:
        raise HTTPException(404, "No logo set")

    etag = f'W/"{int(row.logo_updated_at.timestamp())}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    return Response(
        content=row.logo_data,
        media_type=row.logo_mime or "application/octet-stream",
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=31536000",  # browser caches; ?v= busts it
        },
    )
```

**Notes on `file.read(MAX+1)`:** FastAPI's `UploadFile` wraps starlette's spooled file. `await file.read(n)` reads up to `n` bytes. By asking for `MAX_LOGO_BYTES + 1` we can distinguish "exactly at limit" from "over limit" in one call. The request body may still be larger on the wire; for a tighter guard, a `Content-Length` pre-check is fine but not strictly required since starlette does spool to disk.

### Anti-Patterns to Avoid
- **Importing from `app.*` inside an Alembic migration.** Migrations run with a different `sys.path` at times, and they are snapshots — importing `DEFAULT_SETTINGS` from `app.defaults` couples the migration to current code that may change. **Duplicate the values literally in the migration file** and add a `# source of truth: backend/app/defaults.py` comment.
- **Using `Base.metadata.create_all()` in `main.py` or a startup event.** CLAUDE.md explicitly forbids this. Migrations-only.
- **FastAPI startup event that UPSERTs the singleton row.** D-20 forbids this. Migration seeds; API assumes seeding already happened.
- **Adding SVG tags to nh3's default set by union.** `tags=nh3.ALLOWED_TAGS | SVG_ALLOWED_TAGS` lets `<a>`, `<img>`, `<p>` slip through — legitimate SVGs don't need those. Use `tags=SVG_ALLOWED_TAGS` only.
- **Trusting `file.content_type`.** Clients can lie. Always magic-byte sniff.
- **Re-reading `file.read()` multiple times.** `UploadFile` is a spooled file; once read it must be seeked (`await file.seek(0)`) to re-read. Read once, pass bytes around.
- **Using StreamingResponse for the logo.** For 1 MB, plain `Response(bytes)` is simpler and FastAPI sets `Content-Length` for you.
- **Weak ETag mismatch.** Use `W/"<ts>"` consistently on response and comparison, or use strong `"<ts>"` consistently. Mixing them breaks `If-None-Match`.
- **Forgetting `expire_on_commit=False` side effects.** `database.py` sets `expire_on_commit=False`, so `await db.refresh(row)` is required after commit if you want the latest DB state — though in this case we already hold the values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG XSS sanitization | Custom regex stripper of `<script>` / `on*` | `nh3` with explicit allowlist | Mutation XSS attacks (see RUSTSEC-2021-0074 history) defeat naive regex; only a proper parser is safe |
| CSS color validation | Parse oklch with a color library on the backend | Regex + character blacklist | Backend only needs to *validate* — conversion is frontend's job. Keeps backend dependency-free. |
| Multipart parsing | Manual bytes parsing | FastAPI `UploadFile` (needs `python-multipart`, already installed) | Standard pattern; already used in `routers/uploads.py` |
| MIME detection | `python-magic` / libmagic bindings | 8-byte PNG signature + `<svg`/`<?xml` prefix check | Two file types only; trivial to implement; avoids C dependency in Docker |
| ETag library | `fastapi-etag` third-party dep | Manual `If-None-Match` check + `Response` header | Single endpoint; adding a library for 4 lines of code is overkill |
| Singleton enforcement | Application-level "if exists update, else insert" | PostgreSQL CHECK constraint | DB-level invariant survives bugs in app code and parallel writes |

**Key insight:** The whole phase is ~300 lines of code. Every dependency temptation (color parser, MIME sniffer, ETag library) adds maintenance surface for no security or velocity gain. Keep it boring.

## Runtime State Inventory

**Skipped — this phase is purely additive.** No rename/refactor. New table, new module, new router, new dependency. Existing v1.0 tables (`upload_batches`, `sales_records`) are untouched. Existing v1.0 endpoints (`/api/upload`, `/api/uploads`, `/api/kpis/*`) are untouched.

Verified categories:
- **Stored data:** None to migrate (new table).
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None — no new secrets.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: nh3 default allowlist has zero SVG support
**What goes wrong:** Handler calls `nh3.clean(svg_text)` with no `tags=` kwarg. Every SVG gets stripped to empty string. Every upload returns 422 "SVG was rejected" regardless of content.
**Why it happens:** nh3 is HTML-oriented; ammonia's default `ALLOWED_TAGS` are `a, abbr, blockquote, ..., p, div, span, ...` — no `svg`, `path`, etc.
**How to avoid:** Always pass `tags=SVG_ALLOWED_TAGS` and `attributes=SVG_ALLOWED_ATTRIBUTES` explicitly. See Pattern 3.
**Warning signs:** Unit test for "legitimate minimal SVG passes" fails with 422.

### Pitfall 2: Alembic migration imports from `app.defaults`
**What goes wrong:** Migration imports `DEFAULT_SETTINGS` from `app.defaults`; six months later someone changes defaults, re-runs the migration on a fresh DB, and gets different seed values than the original production seed. Migration history diverges from intent.
**Why it happens:** Migrations are *snapshots*; they should never depend on live code.
**How to avoid:** Duplicate values literally in the migration. Add `# Source of truth: backend/app/defaults.py` comment for discoverability.
**Warning signs:** Migration file has `from app.defaults import ...`.

### Pitfall 3: `UploadFile.size` is not enforced automatically
**What goes wrong:** Handler checks `file.size > MAX` and proceeds on the False branch. But `file.size` may be `None` before the first read, or may be trusted from a lying `Content-Length` header.
**Why it happens:** Starlette's `UploadFile.size` is populated opportunistically. Clients can lie.
**How to avoid:** Always enforce on `len(await file.read(MAX + 1))`. See Pattern 5.
**Warning signs:** Test with a truthful `Content-Length: 100` but 10 MB of actual body would bypass a header-only check.

### Pitfall 4: Weak vs strong ETag mismatch
**What goes wrong:** Server sends `ETag: W/"12345"`, test client compares against `"12345"` (no `W/` prefix), 304 never fires. Or vice versa.
**Why it happens:** Weak/strong ETag distinction is subtle.
**How to avoid:** Define one `_etag_for(row)` helper and use it in both the response and the `If-None-Match` comparison. Test uses the server's exact header in the client request.

### Pitfall 5: Forgetting `python-multipart` for the logo endpoint
**What goes wrong:** First `POST /api/settings/logo` attempt returns a cryptic startup error.
**Why it happens:** FastAPI's `UploadFile` requires `python-multipart` at runtime.
**How to avoid:** Already installed (`python-multipart==0.0.26` in requirements.txt). Verified.

### Pitfall 6: SQLAlchemy async `select().where().scalar_one_or_none()` pattern
**What goes wrong:** Using `db.query(AppSettings).filter_by(id=1).first()` (1.x-style) silently works but is deprecated and breaks under some async conditions.
**Why it happens:** Mixing legacy 1.x API with 2.0 async.
**How to avoid:** Always use `select()` + `db.execute()` + `.scalar_one_or_none()`. Matches `routers/uploads.py` style.

### Pitfall 7: Comment stripping in nh3 breaks byte-equality for SVGs with comments
**What goes wrong:** Users upload a logo exported by Illustrator that includes `<!-- Generator: Adobe Illustrator ... -->`. nh3 strips the comment (`strip_comments=True`). Byte-equality fails. Upload returns 422.
**Why it happens:** Reject-on-mutation is strict.
**How to avoid:** This is actually *correct* behavior — the 422 message should say "remove comments and re-export". Alternative: `strip_comments=False`, but then a hostile comment becomes a hiding place. Keep strict; document in the 422 error.
**Warning signs:** Real-world user reports "Illustrator SVG upload rejected."

### Pitfall 8: asyncpg bytea round-trip
**Verified no issue.** asyncpg maps PG `bytea` ↔ Python `bytes` natively. No special codec. Just use `Mapped[bytes | None]` with `BYTEA`.

### Pitfall 9: `condition: service_healthy` on migrate service
**What goes wrong:** API container starts before migration finishes; first `GET /api/settings` returns 500 "singleton missing".
**How to avoid:** Not in scope for this phase — Phase 1 already set up the Docker compose topology. Verify the existing `docker-compose.yml` has a migrate service and `depends_on: condition: service_completed_successfully` for the API service. If it doesn't, flag as a related issue to the planner.

## Code Examples

### Alembic migration with seed via `op.bulk_insert`
```python
# backend/alembic/versions/<rev>_v1_1_app_settings.py
"""v1.1 app_settings singleton

Revision ID: <rev>
Revises: a1b2c3d4e5f6
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import BYTEA

revision = "<rev>"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

# Source of truth: backend/app/defaults.py
# These values are duplicated intentionally (migrations are snapshots).
_DEFAULT_ROW = {
    "id": 1,
    "color_primary":     "oklch(0.55 0.15 250)",
    "color_accent":      "oklch(0.70 0.18 150)",
    "color_background":  "oklch(1.00 0 0)",
    "color_foreground":  "oklch(0.15 0 0)",
    "color_muted":       "oklch(0.90 0 0)",
    "color_destructive": "oklch(0.55 0.22 25)",
    "app_name": "KPI Light",
    "default_language": "EN",
    "logo_data": None,
    "logo_mime": None,
    "logo_updated_at": None,
}

def upgrade() -> None:
    settings = op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("color_primary",     sa.String(64), nullable=False),
        sa.Column("color_accent",      sa.String(64), nullable=False),
        sa.Column("color_background",  sa.String(64), nullable=False),
        sa.Column("color_foreground",  sa.String(64), nullable=False),
        sa.Column("color_muted",       sa.String(64), nullable=False),
        sa.Column("color_destructive", sa.String(64), nullable=False),
        sa.Column("app_name", sa.String(100), nullable=False),
        sa.Column("default_language", sa.String(2), nullable=False),
        sa.Column("logo_data", BYTEA(), nullable=True),
        sa.Column("logo_mime", sa.String(64), nullable=True),
        sa.Column("logo_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_app_settings_singleton"),
    )
    op.bulk_insert(settings, [_DEFAULT_ROW])

def downgrade() -> None:
    op.drop_table("app_settings")
```

**Why `op.bulk_insert(settings, [...])`:** it uses the table reference returned by `op.create_table()`, so types are validated. Alternative `op.execute("INSERT INTO ...")` works but is unsafer.

### `backend/app/defaults.py`
```python
"""Canonical default settings — source of truth for reset.

The Alembic migration that creates `app_settings` also seeds a row with
these same values, duplicated intentionally (migrations are snapshots;
they must not import live app code).
"""
from typing import Final

DEFAULT_SETTINGS: Final[dict] = {
    "color_primary":     "oklch(0.55 0.15 250)",
    "color_accent":      "oklch(0.70 0.18 150)",
    "color_background":  "oklch(1.00 0 0)",
    "color_foreground":  "oklch(0.15 0 0)",
    "color_muted":       "oklch(0.90 0 0)",
    "color_destructive": "oklch(0.55 0.22 25)",
    "app_name": "KPI Light",
    "default_language": "EN",
}
```

### Test harness (since `backend/tests/` does not exist yet)
```python
# backend/tests/conftest.py
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from asgi_lifespan import LifespanManager

from app.main import app
from app.database import AsyncSessionLocal, engine

@pytest_asyncio.fixture
async def client():
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

@pytest_asyncio.fixture(autouse=True)
async def reset_settings():
    """Reset app_settings row to canonical defaults before each test."""
    from sqlalchemy import update
    from app.models import AppSettings
    from app.defaults import DEFAULT_SETTINGS
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(AppSettings)
            .where(AppSettings.id == 1)
            .values(logo_data=None, logo_mime=None, logo_updated_at=None, **DEFAULT_SETTINGS)
        )
        await db.commit()
    yield
```

```python
# backend/tests/test_settings.py — the 5 success-criteria tests
import pytest

pytestmark = pytest.mark.asyncio

async def test_get_settings_returns_shape(client):
    r = await client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    for key in ("color_primary", "color_accent", "color_background",
                "color_foreground", "color_muted", "color_destructive",
                "app_name", "default_language", "logo_url", "logo_updated_at"):
        assert key in body
    assert body["logo_url"] is None  # fresh DB has no logo

async def test_put_rejects_css_injection_semicolon(client):
    payload = {
        "color_primary": "oklch(0.5 0.15 250); background: url(//evil)",
        "color_accent": "oklch(0.70 0.18 150)",
        "color_background": "oklch(1 0 0)",
        "color_foreground": "oklch(0.15 0 0)",
        "color_muted": "oklch(0.90 0 0)",
        "color_destructive": "oklch(0.55 0.22 25)",
        "app_name": "X",
        "default_language": "EN",
    }
    r = await client.put("/api/settings", json=payload)
    assert r.status_code == 422

async def test_put_rejects_url_function(client):
    payload = {
        "color_primary": "oklch(0.5 0.15 url(javascript:alert(1)))",
        # ... rest canonical
    }
    # ...
    r = await client.put("/api/settings", json=payload)
    assert r.status_code == 422

async def test_logo_svg_with_script_rejected(client):
    evil = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>'
    files = {"file": ("evil.svg", evil, "image/svg+xml")}
    r = await client.post("/api/settings/logo", files=files)
    assert r.status_code == 422
    # Now fetch and confirm no logo was stored
    r2 = await client.get("/api/settings")
    assert r2.json()["logo_url"] is None

async def test_put_defaults_resets_logo(client):
    # 1. Upload a valid logo first
    minimal = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="blue"/></svg>'
    await client.post("/api/settings/logo", files={"file": ("logo.svg", minimal, "image/svg+xml")})
    # 2. PUT defaults
    from app.defaults import DEFAULT_SETTINGS
    r = await client.put("/api/settings", json=DEFAULT_SETTINGS)
    assert r.status_code == 200
    assert r.json()["logo_url"] is None  # logo cleared
    assert r.json()["app_name"] == DEFAULT_SETTINGS["app_name"]
```

**Success criterion #5 (docker compose up --build persistence)** is a manual/integration check — planner should create a `HUMAN-UAT.md` item, not a pytest. The existing Docker compose PG volume makes it pass trivially if the column is `bytea`, not a filesystem path.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bleach` for HTML sanitization | `nh3` (Rust-backed) | nh3 stable since 2023 | 10-50× faster; bleach is in maintenance mode |
| `TestClient` (starlette) | `httpx.AsyncClient` + `ASGITransport` | FastAPI docs updated 2024+ | Async-first, avoids `requests` sync quirks |
| `@validator` (Pydantic v1) | `@field_validator` / `Annotated[..., AfterValidator]` (v2) | Pydantic 2.0 (2023) | Type-native, composable, ~10× faster |
| `create_engine` + sync `Session` | `create_async_engine` + `AsyncSession` | SQLAlchemy 2.0 stable | Required for FastAPI async; already in this project |
| Storing logos on filesystem volumes | Postgres `bytea` column | Project decision (STATE.md) | Survives container rebuild; pg_dump captures it |

**Deprecated/outdated:**
- **Starlette `TestClient` in async apps** — still works, but `httpx.AsyncClient` + `ASGITransport` is the modern pattern FastAPI docs recommend.
- **`@validator` in Pydantic v2** — still supported with deprecation warning; use `@field_validator` or `Annotated`.

## Environment Availability

Skipped — phase has no new external tools. All dependencies install via `pip` inside the existing Docker image. PostgreSQL is already provided by the v1.0 Docker compose stack.

## Open Questions

1. **Should the test suite spin up its own ephemeral Postgres, or use the dev compose PG?**
   - What we know: No `backend/tests/` exists. Project runs entirely in Docker.
   - What's unclear: Whether tests run via `docker compose exec api pytest` (uses live PG) or standalone (needs testcontainers or sqlite).
   - Recommendation: Run tests inside the existing `api` container via `docker compose exec api pytest -q`. The `autouse=True` fixture that resets the singleton row gives test isolation without needing per-test transactions. Phase plan should add a `Makefile` target or document the command.

2. **Should `PUT /api/settings` always clear the logo, or only when the payload equals defaults?**
   - What we know: D-07 says "PUT with canonical defaults clears logo". Unclear whether a non-default PUT preserves the logo.
   - What's unclear: The semantic of a `PUT` that sets `app_name="NewName"` but doesn't touch colors — does it zero the logo?
   - Recommendation: **Preserve the logo on a non-default PUT.** Detect "is defaults" via dict equality against `DEFAULT_SETTINGS`, and only in that branch clear logo columns. This matches the user mental model "Reset to defaults = one button wipes everything" (D-07) while allowing users to change only the app name without losing their logo. Planner should confirm with the user in plan-check.

3. **Is `oklch(L C H / alpha)` accepted or rejected?**
   - What we know: D-10 says the regex matches `oklch(L C H)` — alpha not mentioned.
   - Recommendation: **Reject alpha in v1.1.** Frontend culori will emit plain `oklch(L C H)`. Rejecting alpha is stricter and easy to relax later.

4. **Does `nh3.clean()` preserve the `<?xml ?>` declaration at the start of an SVG?**
   - What we know: nh3 is HTML-focused; passing an XML document is borderline.
   - Recommendation: **Strip `<?xml ?>` from input before `nh3.clean()`** and compare only the body. Or: require users to upload SVGs without the XML prolog. Simplest: include `<?xml ?>` stripping in the `sanitize_svg` helper and compare after normalization. Planner should include a test case for "SVG with XML prolog is accepted".

## Sources

### Primary (HIGH confidence)
- [PyPI nh3](https://pypi.org/project/nh3/) — verified 0.3.4 released 2026-03-25, 0.3.3 released 2026-02-14
- [PyPI pytest / pytest-asyncio / httpx / asgi-lifespan](https://pypi.org/) — verified latest versions
- [nh3 GitHub docs](https://github.com/messense/nh3/blob/main/docs/index.rst) — `clean()` signature, ALLOWED_TAGS behavior
- [ammonia Rust Builder docs](https://docs.rs/ammonia/latest/ammonia/struct.Builder.html) — default tag list confirms SVG elements not present
- [MDN oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch) — L/C/H parameter syntax
- [W3C CSS Color Module Level 4](https://www.w3.org/TR/css-color-4/) — oklch normative spec
- [Pydantic Validators](https://docs.pydantic.dev/latest/concepts/validators/) — `@field_validator` and `Annotated[..., AfterValidator]` patterns
- [SQLAlchemy 2.0 Constraints](https://docs.sqlalchemy.org/en/20/core/constraints.html) — CheckConstraint
- Existing project code: `backend/app/routers/uploads.py`, `backend/app/models.py`, `backend/app/database.py`, `backend/alembic/env.py` — verified async patterns

### Secondary (MEDIUM confidence)
- [Adam Johnson: Django + nh3](https://adamj.eu/tech/2023/12/13/django-sanitize-incoming-html-nh3/) — confirms allowlist pattern
- [BugFactory: ETag + If-None-Match in FastAPI](https://bugfactory.io/articles/http-caching-with-etag-and-if-none-match-headers/) — 304 handling pattern
- [List of file signatures (Wikipedia)](https://en.wikipedia.org/wiki/List_of_file_signatures) — PNG 8-byte header

### Tertiary (LOW confidence)
- [RUSTSEC-2021-0074](https://rustsec.org/advisories/RUSTSEC-2021-0074.html) — historical ammonia SVG mutation XSS, fixed in ammonia 3.1.2+; nh3 0.3.x uses current ammonia — confirming we're on a safe version is prudent but low-risk.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against PyPI and existing `requirements.txt`
- Architecture: HIGH — patterns match existing v1.0 code in `routers/uploads.py` and `models.py`
- nh3 SVG specifics: MEDIUM-HIGH — ammonia default set confirmed to exclude SVG; exact attribute handling verified against docs; the specific allowlist set above is my judgment call (planner may tune)
- Pitfalls: HIGH — derived from code inspection and verified docs

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stack is stable; nh3 may get 0.3.5+ but API surface is stable)
