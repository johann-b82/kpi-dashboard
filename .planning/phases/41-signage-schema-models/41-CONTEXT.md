# Phase 41: Signage Schema & Models - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Alembic owns the signage schema end-to-end. This phase delivers:
1. A single Alembic migration that creates all 8 signage tables (`signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_devices`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlist_tag_map`, `signage_pairing_sessions`) with the right indexes and FK semantics.
2. SQLAlchemy 2.0 async models mirroring the schema (split into `backend/app/models/signage.py`).
3. Pydantic schemas mirroring the models (split into `backend/app/schemas/signage.py`).
4. `DB_EXCLUDE_TABLES` updated in `docker-compose.yml` — `signage_devices` + `signage_pairing_sessions` hidden from Directus; the other 4 public tables exposed.
5. Migrate → Directus startup ordering enforced via `depends_on.migrate.condition: service_completed_successfully`.

NOT in this phase: routers, services, admin UI, player bundle, PPTX conversion, SSE, pairing logic. Those are Phases 42–48.

</domain>

<decisions>
## Implementation Decisions

### Media Storage (Decision 2 — binds Phases 43+44)
- **D-01:** Directus file storage is the primary media store for user uploads. The existing `directus_uploads:/directus/uploads:ro` RO mount into the `api` container (SGN-INF-02) is how FastAPI reads media.
- **D-02:** PPTX-derived slide PNGs are backend-owned artifacts, not Directus files. Path convention: `/app/media/slides/<media_uuid>/slide-NNN.png`. Referenced from `signage_media.slide_paths` (JSONB array of relative paths). Two storage roots is intentional: user uploads vs. derived artifacts.
- **D-03:** `signage_media.uri` stores the Directus asset UUID for Directus-sourced media, or the external URL for `kind=url`, or the inline HTML reference for `kind=html` (see D-07).

### Pairing Code Format
- **D-04:** 6-character Crockford-style base32, alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no `0`, `O`, `1`, `I`, `L`). Displayed as `XXX-XXX`.
- **D-05:** Code generation must reject any generated string that would render ambiguously; the alphabet above is the single source of truth — encode as a module-level constant in `backend/app/security/` (Phase 42 will wire usage; Phase 41 only defines the column width: `CHAR(6)` or `VARCHAR(6)`).

### signage_media Column Shape
- **D-06:** Core columns on `signage_media`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `kind` — Postgres ENUM or `VARCHAR(16) CHECK` — values: `image | video | pdf | pptx | url | html`
  - `title VARCHAR(255) NOT NULL`
  - `mime_type VARCHAR(127)` (nullable for `url`/`html`)
  - `size_bytes BIGINT` (nullable for `url`/`html`)
  - `uri TEXT` (Directus asset UUID, external URL, or NULL for `html`)
  - `duration_ms INTEGER` (nullable — set only for `video`)
  - `created_at`, `updated_at` with `DateTime(timezone=True)` + `onupdate=func.now()`
- **D-07:** PPTX-specific columns: `conversion_status` (ENUM/CHECK: `pending|processing|done|failed`), `slide_paths JSONB` nullable, `conversion_error TEXT` nullable, `conversion_started_at TIMESTAMPTZ` nullable (feeds the stuck-row sweeper in Phase 44).
- **D-08:** HTML-specific: `html_content TEXT` nullable — HTML snippets are stored inline in the DB, not on the filesystem. Keeps backup/restore atomic and sandbox/sanitize logic (Phase 47) sees the same source every read.

### Model / Schema File Organization
- **D-09:** Split signage models into `backend/app/models/signage.py`. Convert the existing `backend/app/models.py` into a package: `backend/app/models/__init__.py` re-exports all existing classes (keep import paths stable — `from app.models import Foo` must still work) plus the new signage models.
- **D-10:** Same split for Pydantic: `backend/app/schemas/signage.py` with `backend/app/schemas/__init__.py` preserving existing import paths.
- **D-11:** This conversion is additive; no changes to existing model class names or field names. If the split is non-trivial to do atomically, the planner may choose to keep `models.py` flat for this phase and revisit in a follow-up — but the preferred path is split now while we're touching the file anyway.

### Audit Timestamps
- **D-12:** Every signage table gets `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` with SQLAlchemy `onupdate=func.now()`. Includes the join tables (`signage_device_tag_map`, `signage_playlist_tag_map`) — cheap, and useful for debugging who-tagged-what-when.
- **D-13:** `signage_playlists.updated_at` specifically feeds the resolver's `ORDER BY priority DESC, updated_at DESC` (SGN-BE-06) — confirm the column is indexed if needed during planning (likely unnecessary at ≤5 devices scale, but flag it).

### Migration Shape
- **D-14:** Single Alembic revision file named `v1_16_signage_schema.py` (mirrors v1.15's `v1_15_sensor_schema.py` convention). All 8 tables + partial-unique index + ENUM types + FK constraints in one migration. Required for SGN-DB-05 round-trip guarantee.
- **D-15:** Partial-unique index on `signage_pairing_sessions (code) WHERE expires_at > now() AND claimed_at IS NULL` — SGN-DB-02. Use `postgresql_where=` on the SQLAlchemy `Index` in the migration.
- **D-16:** `ON DELETE RESTRICT` on `signage_playlist_items.media_id → signage_media.id` — SGN-DB-03. All other FKs default to the sensible choice per relationship (e.g., `signage_playlist_items.playlist_id → signage_playlists.id ON DELETE CASCADE`; tag-map tables CASCADE on parent delete).

### Directus Exposure
- **D-17:** `DB_EXCLUDE_TABLES` in `docker-compose.yml` gets these 2 additions: `signage_devices`, `signage_pairing_sessions`. The other 4 signage tables (`signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`) are exposed for Directus UX convenience. Join tables (`signage_device_tag_map`, `signage_playlist_tag_map`) — planner decides: default to exposed unless there's a concrete reason to hide.
- **D-18:** `migrate → directus` startup ordering stays via existing `depends_on.migrate.condition: service_completed_successfully`. Verify the clause is already wired on the `directus` service; if not, add it. SGN-INF-02.

### Claude's Discretion
- Exact Postgres ENUM vs. `CHECK` constraint choice for `kind` and `conversion_status` — Alembic round-trip (SGN-DB-05) is the constraint; pick whichever round-trips cleanly. If ENUMs are used, ensure downgrade drops them.
- Exact column widths for `title`, tag `name`, device `name`, playlist `name` — sensible defaults (e.g., 255, 64, 128, 128). Planner picks.
- Whether join tables get synthetic `id` PKs or composite `(parent_a, parent_b)` PKs — composite is fine, matches v1.11/v1.15 precedent if present.
- `gen_random_uuid()` requires `pgcrypto` — if not already enabled, the migration adds `CREATE EXTENSION IF NOT EXISTS pgcrypto`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SGN-DB-01..05, §SGN-INF-02 — the 6 requirements this phase closes
- `.planning/ROADMAP.md` §"Phase 41: Signage Schema & Models" — goal, success criteria, open decisions
- `.planning/STATE.md` §"Decisions", §"Open decisions deferred to phase planning" — rolling project decisions

### Research (v1.16)
- `.planning/research/SUMMARY.md` §"Architecture Approach" item 6 + §"Open Decisions" row 2 — media storage trade-off resolved in D-01..03
- `.planning/research/ARCHITECTURE.md` — 8-table schema shape; Directus exposure model
- `.planning/research/PITFALLS.md` — Pitfall on Alembic/Directus startup race (SGN-INF-02); Pitfall on font rendering (irrelevant here, Phase 44)
- `.planning/research/STACK.md` — confirms no new backend libs needed for this phase (no `sse-starlette`, no `pdf2image` yet — those are 44/45)

### Existing Code (patterns to mirror)
- `backend/app/models.py` — flat model file, `DateTime(timezone=True)` convention, `Mapped[...] = mapped_column(...)` SQLAlchemy 2.0 idiom; Phase 41 converts this file into a package (see D-09)
- `backend/app/schemas.py` — Pydantic conventions; Phase 41 converts into a package (see D-10)
- `backend/alembic/versions/v1_15_sensor_schema.py` — naming convention + single-migration-per-milestone precedent; also shows how `DB_EXCLUDE_TABLES` was updated alongside the migration
- `docker-compose.yml` — existing `DB_EXCLUDE_TABLES` env var, `depends_on.migrate.condition: service_completed_successfully` pattern, `directus_uploads:/directus/uploads:ro` mount already in place

### Cross-cutting Hazards (ROADMAP.md §"v1.16 Cross-Cutting Hazards")
- Hazard 6 (no `sqlite3`/`psycopg2`) — Phase 41 must not regress; async SQLAlchemy 2.0 + asyncpg only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/models.py` — 600+ lines of existing tables (sales, HR, Personio, app_settings, sensors). Conventions: UTC timestamps via `DateTime(timezone=True)`; `Mapped[...]` typed column declarations; `relationship(...)` for associations; cascade behaviors spelled out explicitly.
- `backend/alembic/env.py` — already configured for sync engine + `Base.metadata` autogenerate baseline.
- `backend/alembic/versions/v1_15_sensor_schema.py` — template for "big single migration + DB_EXCLUDE_TABLES update + service ordering" pattern. Copy structure, adapt content.
- `docker-compose.yml` `DB_EXCLUDE_TABLES` env var — already lists 10 tables including v1.15's `sensors,sensor_readings,sensor_poll_log`. Additive update for Phase 41.

### Established Patterns
- Flat `models.py` / `schemas.py` — historical convention. D-09/D-10 changes this to packages; re-exports keep callers stable.
- Alembic round-trip (`upgrade → downgrade → upgrade`) is part of success criteria on schema phases (SGN-DB-05). Every new object in `upgrade()` gets a corresponding drop in `downgrade()` — including extensions, ENUM types, and partial indexes.
- `gen_random_uuid()` requires `pgcrypto`. Check existing migrations first — if already enabled, don't re-enable; if not, add to Phase 41 migration.

### Integration Points
- `backend/app/models/__init__.py` (new) — re-exports all classes from `_legacy.py` (or whatever the old flat content becomes) + `signage.py`.
- `backend/app/schemas/__init__.py` (new) — same treatment.
- `docker-compose.yml` — one-line edit to `DB_EXCLUDE_TABLES` value.
- Possibly `docker-compose.yml` `directus` service — verify `depends_on.migrate.condition: service_completed_successfully` is present; add if missing.
- No changes to `main.py`, routers, services, or frontend in this phase.

</code_context>

<specifics>
## Specific Ideas

- Pairing code alphabet is the Crockford base32 no-confusables set. Not negotiable for consistency with industry signage platforms and kiosk-readability.
- PPTX slide paths live on backend-owned disk (`/app/media/slides/<uuid>/`) because they are derived artifacts, not user uploads. This separation is load-bearing for Phase 44 (converter writes) and Phase 47 (player reads via backend endpoint, not Directus asset URL).
- `html_content` stored inline in the DB (not filesystem) so backup/restore stays atomic and nh3 sanitization in Phase 47 sees a single source.

</specifics>

<deferred>
## Deferred Ideas

- PPTX worker location (Decision 1) — Phase 44.
- Device token format (Decision 4) — Phase 42.
- Player offline cache mechanism (Decision 3) — Phase 47.
- Any runtime behavior (pairing request/claim, heartbeat, SSE fanout, admin UI, player rendering) — their respective phases.
- Index tuning on `signage_playlists.updated_at` — defer to Phase 43 when the resolver query is actually written; ≤5 devices scale makes this almost certainly unnecessary.

</deferred>

---

*Phase: 41-signage-schema-models*
*Context gathered: 2026-04-18*
