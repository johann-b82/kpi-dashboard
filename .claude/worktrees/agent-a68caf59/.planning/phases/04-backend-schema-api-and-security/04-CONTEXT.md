# Phase 4: Backend — Schema, API, and Security - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A curl-testable settings API with security enforced at the persistence boundary. Deliverables:

- `app_settings` singleton table (Alembic migration) with logo bytes co-located on the row
- `GET /api/settings` — returns all settings fields plus `logo_url` and `logo_updated_at`
- `PUT /api/settings` — Pydantic-validated updates; strict oklch regex; CSS injection blocked
- `POST /api/settings/logo` — PNG/SVG upload, 1 MB limit, nh3 sanitization gate
- `GET /api/settings/logo` — streams raw logo bytes with ETag and correct `Content-Type`
- `backend/app/defaults.py` — canonical defaults used by reset
- No frontend work — that's Phases 5–7

Out of scope: ThemeProvider, NavBar, Settings page UI, i18n wiring, live preview, toast integration.

</domain>

<decisions>
## Implementation Decisions

### Data model
- **D-01:** Singleton `app_settings` table with logo bytes as columns on the same row — no separate `app_logos` table. Columns include: `id` (CHECK constraint id=1 or equivalent singleton enforcement), 6 color fields (oklch strings), `app_name`, `default_language` (enum DE/EN), `logo_data` (bytea nullable), `logo_mime` (text nullable), `logo_updated_at` (timestamptz nullable).
- **D-02:** Singleton enforcement via primary-key constraint that only allows `id = 1` (CHECK or fixed PK). Downstream planner decides exact mechanism; the invariant is "exactly one row, ever".

### API surface
- **D-03:** `GET /api/settings` returns a JSON object including `logo_url` (string, e.g. `/api/settings/logo?v=<logo_updated_at epoch>`) and `logo_updated_at`. `logo_url` is `null` when no logo is set.
- **D-04:** `GET /api/settings/logo` is a separate endpoint that streams raw bytes with the stored `Content-Type` and an ETag derived from `logo_updated_at`. Browser caches the image; cache-busting happens via the query param in `logo_url`.
- **D-05:** `PUT /api/settings` accepts colors, app_name, default_language. It does NOT accept logo bytes (logo has its own endpoint).
- **D-06:** `POST /api/settings/logo` accepts `multipart/form-data`, validates extension + size + sanitizes, then writes `logo_data` / `logo_mime` / `logo_updated_at` on the singleton row.

### Reset semantics
- **D-07:** Reset = "full reset". `PUT /api/settings` with the canonical default payload from `defaults.py` clears the logo too (sets `logo_data`/`logo_mime`/`logo_updated_at` to `NULL`). One mental model: one button wipes everything. Canonical default is "no logo — fall back to app name text" (matches BRAND-03 fallback).
- **D-08:** No separate `DELETE /api/settings/logo` endpoint in v1.1. Reset handles it; re-upload overwrites.

### Color validation (BRAND-09)
- **D-09:** API accepts **oklch strings only** on the wire. Frontend (Phase 6) converts hex → oklch via `culori` before submit. Backend stays pure Python with a strict regex — no color parser dependency on the backend.
- **D-10:** Pydantic `@field_validator` uses a strict regex that:
  - Matches `oklch(L C H)` where L is 0–1 or percentage, C is numeric, H is numeric (degrees optional)
  - Rejects any string containing `;`, `{`, `}`, `url(`, `expression(`, `"`, `'`, backticks, `\`, `<`, `>`
  - Returns HTTP 422 on mismatch (FastAPI default behavior)
- **D-11:** All 6 semantic tokens (primary, accent, background, foreground, muted, destructive) share the same validator.

### SVG sanitization (BRAND-02)
- **D-12:** `nh3` with a strict SVG-safe allowlist: allow standard SVG structural/shape/path/gradient elements; disallow `<script>`, `<foreignObject>`, `on*` attributes, `javascript:` / `data:` URIs in `href`/`xlink:href`.
- **D-13:** **Reject on mutation.** If the sanitized bytes differ from the input bytes, respond with HTTP 422 and a clear error message ("SVG contained disallowed content and was rejected"). This makes success criterion #3 directly testable: malicious SVG → 422, never stored. Downstream planner decides exact diff strategy (byte-equality vs structural compare) — byte-equality is the simplest correct answer.
- **D-14:** PNG uploads skip nh3 (not an SVG). PNG is validated by magic-byte sniff + size check only. No image re-encoding in v1.1.

### File upload validation
- **D-15:** Extension allowlist: `.png`, `.svg` only. Case-insensitive. Reject with 422.
- **D-16:** Size limit: 1 MB hard cap — enforced on `UploadFile.read()` length, not just `Content-Length` header.
- **D-17:** MIME sniff is done by content (magic bytes for PNG, XML/SVG detection for SVG) — don't trust the client-provided `Content-Type`.

### Defaults seeding
- **D-18:** The Alembic migration that creates `app_settings` also `INSERT`s the default singleton row in the same `upgrade()` function. Defaults are duplicated from `backend/app/defaults.py` into the migration (migrations are snapshots; they shouldn't import live app code). A comment in the migration points at `defaults.py` as the source of truth for future drift.
- **D-19:** `backend/app/defaults.py` is a plain Python module exposing a single `DEFAULT_SETTINGS` dict (or Pydantic model) used by the reset endpoint and by tests. Frontend never reads it.
- **D-20:** No FastAPI startup event touches `app_settings` — the migrate service has already seeded it by the time the API starts (docker compose `depends_on: service_healthy` on migrate's completion).

### Caching
- **D-21:** `logo_updated_at` doubles as the cache-buster value and the ETag source. Monotonic per upload; no separate version counter.

### Claude's Discretion
- Exact singleton enforcement mechanism (CHECK constraint vs fixed PK sentinel vs partial unique index)
- Alembic migration filename and revision IDs
- Pydantic model layout (one model for GET/PUT vs separate request/response models) — downstream planner decides
- Whether the oklch regex allows percentage vs decimal L values, with/without `deg` suffix on H (err toward "accept both, reject anything else")
- Error message wording
- Whether to use a FastAPI `APIRouter(prefix="/api/settings")` sub-router or keep handlers in the existing `/api` router
- Test layout and fixture strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — v1.1 requirements (SET-02, SET-03, SET-04, BRAND-01, BRAND-02, BRAND-04, BRAND-09 all map to this phase)
- `.planning/ROADMAP.md` §Phase 4 — goal statement and 5 success criteria
- `.planning/PROJECT.md` — v1.1 milestone goal and constraints

### Existing backend patterns (to reuse / match)
- `backend/app/main.py` — FastAPI app setup, router inclusion, `/health` pattern
- `backend/app/routers/uploads.py` — Reference for `APIRouter(prefix="/api")`, `UploadFile` handling, `Depends(get_async_db_session)`, 422 error shape, `multipart/form-data` parsing
- `backend/app/models.py` — SQLAlchemy 2.0 `Mapped` / `mapped_column` style used throughout
- `backend/app/schemas.py` — Pydantic v2 pattern (`model_config = {"from_attributes": True}`)
- `backend/app/database.py` — `get_async_db_session` dependency
- `backend/alembic/versions/*.py` — Migration style (existing phase 1/2/3 migrations show naming and upgrade/downgrade conventions)
- `backend/alembic/env.py` — How migrations connect (sync engine from `alembic.ini`)
- `backend/requirements.txt` — Existing pins (FastAPI 0.135.3, SQLAlchemy 2.0.49, asyncpg 0.31.0, alembic 1.18.4) — `nh3` must be added

### Stack rules (project-level)
- `CLAUDE.md` §Technology Stack — version pins are load-bearing; Alembic uses sync engine; never call `create_all`
- `CLAUDE.md` §Docker Compose Pattern — migrate service runs before API, healthcheck-gated

No external ADRs or spec docs exist for this project — requirements are fully captured in REQUIREMENTS.md and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`APIRouter(prefix="/api")` pattern** — [backend/app/routers/uploads.py:13](backend/app/routers/uploads.py#L13) — match this for the new settings router
- **`UploadFile` + 422 validation** — [backend/app/routers/uploads.py:24-37](backend/app/routers/uploads.py#L24-L37) — same shape for logo extension/size rejection
- **`Depends(get_async_db_session)`** — [backend/app/routers/uploads.py:21](backend/app/routers/uploads.py#L21) — reuse for all settings endpoints
- **Pydantic v2 `BaseModel`** — [backend/app/schemas.py](backend/app/schemas.py) — add `SettingsRead`, `SettingsUpdate` here
- **Alembic migration layout** — `backend/alembic/versions/` — existing 3 migrations show the upgrade()/downgrade() idiom; singleton seed goes in upgrade()

### Established patterns
- **Async all the way** — every DB call uses `await db.execute(...)` / `await db.commit()`. No sync sessions.
- **HTTPException(422) for validation failures** — consistent error shape; don't invent a new error model
- **No Pydantic response_model for simple dicts** — `/health` uses a plain dict; new endpoints should use `response_model=SettingsRead` for the typed ones
- **Router prefix is `/api`**, not `/api/v1` — no versioning in v1.x

### Integration points
- **Register the new router** in [backend/app/main.py:10-11](backend/app/main.py#L10-L11)
- **Add `nh3` to** [backend/requirements.txt](backend/requirements.txt)
- **New files to create:**
  - `backend/app/routers/settings.py` — handlers
  - `backend/app/defaults.py` — canonical defaults
  - `backend/alembic/versions/<rev>_v1_1_app_settings.py` — migration + seed
  - Add `AppSettings` model to `backend/app/models.py`
  - Add `SettingsRead` / `SettingsUpdate` schemas to `backend/app/schemas.py`

</code_context>

<specifics>
## Specific Ideas

- Test matrix for success criteria is already effectively defined by the 5 roadmap criteria — planner should lift these directly into test names:
  1. `GET /api/settings` shape assertion (includes `logo_url`, `logo_updated_at`)
  2. `PUT` with `;` or `url(` in a color field → 422
  3. `POST /api/settings/logo` with `<script>`-containing SVG → 422 (reject on mutation), nothing stored
  4. `PUT` with canonical defaults → singleton reset, logo cleared, response matches `defaults.py`
  5. `docker compose up --build` → logo bytes persist (bytea in Postgres, not filesystem)
- Success criterion #5 is essentially a Docker-level integration test, not a unit test — planner should call it out explicitly so it's not forgotten

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated DELETE /api/settings/logo endpoint** — full reset covers the clear-logo case in v1.1. If users want "clear logo but keep my colors" later, add it in a future phase.
- **Backend color conversion (hex → oklch)** — frontend handles it. If we ever expose a third-party API client, revisit.
- **Admin-only gating on PUT / logo upload** — requires Authentik (v2). v1.1 is explicitly open-edit per PROJECT.md.
- **Optimistic concurrency on PUT** — REQUIREMENTS.md already defers this; last-write-wins is acceptable.
- **PNG re-encoding / image optimization** — pass-through in v1.1; add later if bandwidth becomes an issue.
- **Logo dimension constraints** — CSS constrains display to 60×60; original bytes preserved per BRAND-03.

</deferred>

---

*Phase: 04-backend-schema-api-and-security*
*Context gathered: 2026-04-11*
