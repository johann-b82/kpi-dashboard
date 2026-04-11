# Stack Research

**Domain:** Branding & Settings — runtime theming, logo upload/storage/serving, settings persistence, language default
**Milestone:** KPI Light v1.1
**Researched:** 2026-04-11
**Confidence:** HIGH (all decisions grounded in existing codebase inspection + verified sources)

---

## What This Document Covers

This is milestone-scoped research for v1.1. It documents only the **additions and changes** needed on top of the validated v1.0 stack. Existing libraries (FastAPI, SQLAlchemy, asyncpg, Alembic, React, TanStack Query, Tailwind v4, shadcn/ui, i18next, wouter) are NOT re-researched — they ship unchanged.

---

## New Backend Dependency

### SVG Sanitization

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| nh3 | 0.3.3 | SVG XSS sanitization before storing user-uploaded SVG files | Rust-backed Ammonia HTML/SVG sanitizer; Python binding. ~20x faster than bleach; bleach is deprecated (Mozilla). defusedxml is deprecated for lxml use. lxml's `html.clean` module has a documented CVE for SVG/math context-switching bypass. nh3 applies an allowlist-based strategy and is actively maintained. Single pip install, no C compiler needed (pre-built wheels). |

No other new backend packages are needed. All other v1.1 features reuse existing dependencies.

---

## No New Frontend Dependencies

All v1.1 frontend features (runtime theming, live preview, logo display, language switch) are achievable with the libraries already installed: React state, `document.documentElement.style.setProperty`, TanStack Query, i18next `changeLanguage()`, and existing shadcn/ui components.

---

## Technical Decisions by Feature Area

### 1. Settings Persistence in PostgreSQL (SQLAlchemy 2.0 async + Alembic)

**Pattern: singleton-row `app_settings` table with an upsert on `id = 1`.**

Use a dedicated `AppSettings` model with a fixed primary key of `1`. This is the standard pattern for global, instance-scoped configuration — it avoids key-value EAV tables (which require schema knowledge at query time) and avoids a separate config file that would break Docker immutability.

```python
# models.py addition
from sqlalchemy import LargeBinary, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    app_name: Mapped[str] = mapped_column(String(100), nullable=False, default="KPI Light")
    default_language: Mapped[str] = mapped_column(String(10), nullable=False, default="de")
    # Semantic color tokens (oklch strings, matching existing CSS variable format)
    color_primary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color_accent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color_background: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color_foreground: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color_muted: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color_destructive: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Logo stored inline as bytea
    logo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    logo_content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "image/png" | "image/svg+xml"
```

**Alembic migration:** Add a new migration script via `alembic revision --autogenerate -m "add_app_settings"`. The `LargeBinary` type maps to PostgreSQL `BYTEA` — this is the correct SQLAlchemy 2.0 type for binary data. No `openpyxl`-style separate engine needed; the existing async engine handles `BYTEA` correctly via asyncpg.

**Known issue to avoid:** SQLAlchemy issue #9739 documents a DBAPIError when committing multiple objects with `LargeBinary` columns in the same flush. Since this is a singleton row, a single `session.merge()` or `session.execute(insert(...).on_conflict_do_update(...))` avoids this entirely.

**Logo storage — bytea vs filesystem:**

Store logo as `BYTEA` in the `app_settings` table. Do NOT use filesystem storage in a Docker Compose setup — filesystem writes inside a container are lost on container restart unless a named volume is mapped. Adding a volume mount for a single logo file creates operational complexity (permissions, backup, Docker Compose coupling) disproportionate to the benefit. The logo is bounded at 1 MB, which is well within PostgreSQL's per-row storage capability. The `logo_content_type` column is required to correctly set the HTTP `Content-Type` response header.

### 2. Runtime Theming with Tailwind v4 CSS Variables

The existing `index.css` already uses `oklch(...)` CSS custom properties on `:root` for all semantic tokens (`--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--destructive`). The `@theme inline` block maps them to Tailwind utilities via `--color-*` aliases.

**Runtime injection approach:** Use `document.documentElement.style.setProperty()` to override CSS custom properties at runtime. This works because the `@theme inline` variables reference the `:root` custom properties via `var(--primary)` — when the `:root` value changes, all Tailwind utilities that consume it update immediately without a page reload or style sheet regeneration.

```typescript
// Apply saved theme to :root — call on app boot and on Settings save
function applyTheme(settings: AppSettings) {
  const el = document.documentElement;
  if (settings.color_primary)    el.style.setProperty('--primary', settings.color_primary);
  if (settings.color_accent)     el.style.setProperty('--accent', settings.color_accent);
  if (settings.color_background) el.style.setProperty('--background', settings.color_background);
  if (settings.color_foreground) el.style.setProperty('--foreground', settings.color_foreground);
  if (settings.color_muted)      el.style.setProperty('--muted', settings.color_muted);
  if (settings.color_destructive) el.style.setProperty('--destructive', settings.color_destructive);
}
```

**Live preview:** Hold pending edits in local React state (`useState`). In the Settings page, call `applyTheme(pendingState)` on each color change to provide instant visual feedback. On "Save", persist to backend via TanStack Query mutation; on "Cancel", re-apply the server-fetched values. This requires no additional state library — TanStack Query already handles server state, and `useState` handles the unsaved preview state.

**Color value format:** Store and accept oklch strings (e.g., `oklch(0.205 0 0)`) to match the existing CSS variable format in `index.css`. Do NOT convert to hex on the backend — the browser renders oklch natively and it is the format already used by shadcn/ui's Tailwind v4 integration.

**Boot hydration:** In `main.tsx` (or a top-level React component), fetch `/api/settings` on mount and call `applyTheme()` before the first meaningful render. Use TanStack Query's `suspense` option or an initializing state to prevent a flash of default theme.

### 3. Serving Logo from FastAPI

Use `Response` (not `StreamingResponse`) for in-memory bytes read from the database. `StreamingResponse` is for large files or generators; a 1 MB BYTEA blob read entirely into memory is better served as a plain `Response`.

```python
from fastapi import Response
import hashlib

@router.get("/api/settings/logo")
async def get_logo(db: AsyncSession = Depends(get_db)):
    settings = await db.get(AppSettings, 1)
    if not settings or not settings.logo_data:
        raise HTTPException(status_code=404)

    etag = hashlib.sha256(settings.logo_data).hexdigest()[:16]
    return Response(
        content=settings.logo_data,
        media_type=settings.logo_content_type,
        headers={
            "ETag": f'"{etag}"',
            "Cache-Control": "public, max-age=3600, must-revalidate",
        },
    )
```

**ETag strategy:** SHA-256 of the raw bytes (truncated to 16 hex chars). This is correct and sufficient — logo changes are infrequent and the hash is computed in-memory on each request, avoiding any stale-cache risk. Do NOT use `Last-Modified` / `mtime` because the data comes from a database row, not a file. Check the `If-None-Match` request header and return `304 Not Modified` if it matches to avoid re-sending 1 MB on every logo fetch.

**Content-Type:** Read from `logo_content_type` column (set at upload time). Hardcoding `image/png` would break SVG logos displayed in `<img>` tags.

### 4. Image Validation and SVG Sanitization

**PNG validation (no new library):** Read the first 8 bytes of the upload and check for the PNG magic number (`b'\x89PNG\r\n\x1a\n'`). FastAPI's `UploadFile` exposes `.read()` returning bytes — slice and compare. Reject anything that doesn't match before further processing.

**SVG validation (no new library):** Check `content_type == "image/svg+xml"` AND confirm the raw bytes contain `<svg` as a basic structural check.

**SVG sanitization (NEW: nh3 0.3.3):** After format validation, sanitize SVG content through nh3's allowlist before storing:

```python
import nh3

SAFE_SVG_TAGS = {"svg", "path", "circle", "rect", "ellipse", "line", "polyline",
                 "polygon", "g", "defs", "use", "symbol", "title", "desc",
                 "linearGradient", "radialGradient", "stop", "clipPath", "mask",
                 "text", "tspan", "image"}

SAFE_SVG_ATTRS = {"id", "class", "style", "viewBox", "width", "height",
                  "xmlns", "fill", "stroke", "stroke-width", "opacity",
                  "transform", "d", "cx", "cy", "r", "rx", "ry",
                  "x", "y", "x1", "y1", "x2", "y2", "points",
                  "gradientUnits", "gradientTransform", "offset",
                  "stop-color", "stop-opacity"}

def sanitize_svg(raw_svg: bytes) -> bytes:
    clean = nh3.clean(
        raw_svg.decode("utf-8", errors="replace"),
        tags=SAFE_SVG_TAGS,
        attributes={tag: SAFE_SVG_ATTRS for tag in SAFE_SVG_TAGS},
        strip_comments=True,
    )
    return clean.encode("utf-8")
```

This removes `<script>`, all `on*` event handlers, `javascript:` URIs in `href`/`src`, and XML entity declarations. nh3 is chosen over:
- bleach: deprecated by Mozilla, unmaintained
- lxml `html.clean`: has a documented CVE for SVG/math context-switching bypass (GHSA-5jfw-gq64-q45f)
- defusedxml.lxml: explicitly deprecated and removed in newer versions
- lxml bare XPath: requires writing your own walk + allowlist, reinventing what nh3 provides

**Size limit:** Check `len(file_bytes) > 1_048_576` (1 MiB = 1,048,576 bytes) before sanitization. Reject with HTTP 422.

**MIME type allowlist:** Accept only `image/png` and `image/svg+xml`. Reject all other MIME types with HTTP 422.

### 5. Language Default — Server-Persisted, Client-Respected

**Current state:** `i18n.ts` hardcodes `lng: "de"`. There is no `i18next-browser-languageDetector` installed — language detection is manual.

**v1.1 approach — no new library needed:**

1. Expose `default_language` in the `/api/settings` response (already on the `AppSettings` model).
2. On app boot, fetch settings, then call `i18n.changeLanguage(settings.default_language)` before mounting the app (or in a top-level `useEffect` with a loading gate).
3. On the Settings page, the language dropdown saves to the backend via mutation. The client then calls `i18n.changeLanguage(newLang)` immediately after a successful save.
4. If the user manually toggles language via the existing `LanguageToggle` component, that in-session override persists in memory for the session. On next reload, the server default applies again (which is the correct behavior for a global instance-wide default).

**Why NOT localStorage-first:** `i18next-browser-languageDetector` + localStorage would make the per-browser cached value override the admin-set server default after first visit — defeating the purpose of a server-persisted default. For a single-instance internal tool, server value wins; don't add the detector plugin.

**Why NOT cookies:** Adds server-side session complexity. The app has no auth and no server-rendered HTML. A fetch on boot is simpler and sufficient.

---

## What NOT to Add

| Avoid | Why | What to Use Instead |
|-------|-----|---------------------|
| bleach | Deprecated by Mozilla; unmaintained | nh3 0.3.3 |
| defusedxml | lxml module deprecated and removed in next version | nh3 for sanitization; plain XML parse not needed here |
| lxml `html.clean` / `Cleaner` | CVE for SVG/math context bypass (GHSA-5jfw-gq64-q45f) | nh3 |
| fastapi-cache / fastapi-cache2 | Adds Redis/Memcached dependency for a 1 MB logo; overkill | Compute ETag hash inline; 304 handling is sufficient |
| Zustand / Redux | Wrong tool for server state | TanStack Query (already installed) |
| i18next-browser-languageDetector | localStorage cache overrides server default after first visit | Fetch server settings on boot, call `i18n.changeLanguage()` |
| Filesystem logo storage (volume mount) | Breaks container restart without persistent volume; operational overhead | BYTEA in `app_settings` table |
| Separate `logo` table | Unnecessary join for a single global logo | `logo_data` + `logo_content_type` columns on `app_settings` |

---

## Installation

### Backend addition to `requirements.txt`

```
nh3==0.3.3
```

### Frontend — no new packages

All v1.1 frontend work uses already-installed libraries.

---

## Version Compatibility Notes

| Package | Version | Compatibility Note |
|---------|---------|-------------------|
| nh3 | 0.3.3 | Python >=3.8; pre-built wheels for Linux/macOS/Windows; no C compiler needed in Docker |
| SQLAlchemy `LargeBinary` | 2.0.49 (existing) | Maps to `BYTEA` on PostgreSQL; asyncpg handles bytes natively |
| Alembic | 1.18.4 (existing) | `LargeBinary` renders as `BYTEA` in autogenerated PostgreSQL migration — no custom type needed |
| nh3 in Docker | 0.3.3 | Uses manylinux wheels; works on `python:3.12-slim` base without extra apt packages |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| BYTEA / `LargeBinary` + asyncpg | HIGH | SQLAlchemy 2.0 docs + GitHub issue #9739 confirming singleton-row avoids the multi-object bug |
| `document.documentElement.style.setProperty` for Tailwind v4 runtime theming | HIGH | Confirmed by reading `index.css` — `@theme inline` uses `var(--primary)` references that respond to `:root` overrides |
| oklch as color storage format | HIGH | Codebase inspection — all existing CSS variables use `oklch(...)` |
| `Response` (not `StreamingResponse`) for in-memory logo bytes | HIGH | FastAPI official docs: StreamingResponse is for generators/large files; Response for in-memory content |
| ETag via SHA-256 hash of bytes | HIGH | Standard HTTP caching pattern; confirmed in FastAPI community references |
| nh3 for SVG sanitization | HIGH | PyPI verified (0.3.3, Feb 2026); lxml html.clean CVE confirmed (GHSA-5jfw-gq64-q45f); bleach deprecation confirmed |
| i18next `changeLanguage()` on boot (no detector plugin) | MEDIUM | Pattern confirmed in i18next docs and community; specific ordering (fetch → changeLanguage → mount) requires careful implementation |
| Logo size limit check pre-sanitization | HIGH | Standard practice; nh3 processes decoded text so byte check must happen on raw bytes first |

---

## Sources

- [SQLAlchemy 2.0 LargeBinary / BYTEA PostgreSQL](https://docs.sqlalchemy.org/en/20/core/type_basics.html#sqlalchemy.types.LargeBinary) — type mapping
- [SQLAlchemy issue #9739 — LargeBinary multi-object commit bug](https://github.com/sqlalchemy/sqlalchemy/issues/9739) — singleton-row rationale
- [lxml html.clean SVG/math context bypass CVE](https://github.com/fedora-python/lxml_html_clean/security/advisories/GHSA-5jfw-gq64-q45f) — why NOT lxml Cleaner
- [nh3 PyPI](https://pypi.org/project/nh3/) — version 0.3.3, Feb 2026
- [nh3 GitHub (messense/nh3)](https://github.com/messense/nh3) — allowlist API and SVG support
- [defusedxml deprecation status](https://discuss.python.org/t/status-of-defusedxml-and-recommendation-in-docs/34762) — lxml module removed
- [FastAPI Custom Response docs](https://fastapi.tiangolo.com/advanced/custom-response/) — Response vs StreamingResponse
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, runtime CSS variable approach
- [shadcn/ui Tailwind v4 theming](https://ui.shadcn.com/docs/tailwind-v4) — CSS variable names and format
- [i18next API — changeLanguage](https://www.i18next.com/overview/api) — programmatic language switching
- [Existing codebase: frontend/src/index.css] — confirmed oklch format, @theme inline structure, CSS variable names
- [Existing codebase: frontend/src/i18n.ts] — confirmed no language detector installed, hardcoded `lng: "de"`
- [Existing codebase: backend/app/models.py] — confirmed existing model patterns (Mapped, mapped_column)

---

*Stack research for: KPI Light v1.1 Branding & Settings*
*Researched: 2026-04-11*
