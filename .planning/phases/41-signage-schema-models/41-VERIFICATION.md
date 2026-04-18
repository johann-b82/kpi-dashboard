---
phase: 41-signage-schema-models
verified: 2026-04-18T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
amendments:
  - requirement: SGN-DB-02
    type: semantic
    when: during plan 41-05 execution (commit 0f7ae65)
    original: "Partial-unique index on signage_pairing_sessions.code WHERE expires_at > now() AND claimed_at IS NULL"
    amended: "Partial-unique index on signage_pairing_sessions.code WHERE claimed_at IS NULL"
    reason: "Postgres rejects non-IMMUTABLE functions in partial-index predicates (errcode 42P17). now() is STABLE, not IMMUTABLE, so the original predicate caused `alembic upgrade head` to fail outright."
    compensating_control: "Expiration invariant now carried by the Phase 42 03:00 UTC pairing-cleanup cron, which transitions expired rows out of the unclaimed state. Safe in practice: pairing codes live minutes, cron runs daily, 6-digit-code collisions in any operational window are vanishingly rare."
    note: "REQUIREMENTS.md line 18 still describes the original predicate; should be reconciled when REQUIREMENTS.md is next touched, or left as the declared requirement with this amendment noted here as the implementation reality."
---

# Phase 41: Signage Schema & Models — Verification Report

**Phase Goal:** Alembic owns the signage schema end-to-end — 8 tables with the right indexes and FK semantics exist in Postgres, SQLAlchemy/Pydantic mirror them, and Directus introspects only the non-sensitive subset.

**Verified:** 2026-04-18
**Status:** passed
**Re-verification:** No — initial verification.

## Goal Achievement

Must-haves are derived from ROADMAP.md Phase 41 Success Criteria (the contract). Each criterion maps 1:1 to a truth.

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
|---|---------------------------------------|--------|----------|
| 1 | `alembic upgrade head` on a fresh DB creates exactly 8 `signage_*` tables | VERIFIED | Live test `test_round_trip_clean` PASSED; `Base.metadata` contains all 8 tables; round-trip test asserts `found == expected` |
| 2 | Partial-unique index on `signage_pairing_sessions.code` (amended to `WHERE claimed_at IS NULL`) AND deleting a referenced media row fails with RESTRICT FK | VERIFIED (amended) | Index `uix_signage_pairing_sessions_code_active` exists, UNIQUE, predicate `claimed_at IS NULL` (verified in Base.metadata + test); `test_playlist_items_media_restrict` PASSED proving IntegrityError on referenced delete; `information_schema.referential_constraints.delete_rule = 'RESTRICT'` |
| 3 | `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` round-trips cleanly with no residuals | VERIFIED | `test_round_trip_clean` PASSED — asserts 8 tables → 0 residual tables + 0 residual indexes after downgrade → 8 tables restored |
| 4 | After `docker compose up`, Directus exposes the 4 (really 6) relational tables but hides `signage_devices` + `signage_pairing_sessions`; migrate completes before directus starts | VERIFIED (structural) + NEEDS HUMAN (UI spot-check) | `DB_EXCLUDE_TABLES` line 87 of docker-compose.yml contains `,signage_devices,signage_pairing_sessions`; the other 6 tables are absent from the list (verified by grep); `directus.depends_on.migrate.condition: service_completed_successfully` at line 70-71; `docker compose config` resolves the value identically. UI spot-check is Directus runtime behavior and routed to human verification. |

**Score:** 4/4 truths verified (with (4) having a human spot-check component for the Directus UI itself).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/__init__.py` | Package entry — re-exports Base + 10 legacy + 8 signage classes | VERIFIED | 47 lines; `from app.database import Base`, `from app.models._base import …`, `from app.models.signage import …` — all 8 signage classes imported and listed in `__all__` |
| `backend/app/models/_base.py` | Legacy models moved verbatim | VERIFIED | Present; renamed from `models.py` in commit 6a9089c |
| `backend/app/models/signage.py` | 8 ORM classes, SQLAlchemy 2.0 style, partial index + RESTRICT FK + CHECK constraints + timestamps | VERIFIED | 324 lines; all 8 `class Signage*(Base)` definitions; partial index `uix_signage_pairing_sessions_code_active` with `postgresql_where=text("claimed_at IS NULL")` (amended); `ondelete="RESTRICT"` on `signage_playlist_items.media_id`; `ck_signage_media_kind`, `ck_signage_media_conversion_status`, `ck_signage_devices_status` constraints all present |
| `backend/app/schemas/__init__.py` | Re-exports legacy + 19 signage schemas | VERIFIED | 27 lines; `from app.schemas._base import *`, `from app.schemas.signage import` (all 19 names enumerated) |
| `backend/app/schemas/_base.py` | Legacy Pydantic schemas | VERIFIED | Present; moved from `schemas.py` with explicit `__all__` enumerating all 29 public names |
| `backend/app/schemas/signage.py` | 19 Pydantic v2 classes (Base/Create/Read trios + device update + pairing DTOs), Literal enums, `from_attributes=True` on Reads | VERIFIED | 178 lines; in-container import of all 19 classes succeeded; `SignageMediaRead.model_config.get('from_attributes') is True` confirmed live |
| `backend/alembic/versions/v1_16_signage_schema.py` | Single migration: upgrade()+downgrade(), 8 tables, partial index, RESTRICT FK, CHECK constraints, named FKs/indexes, composite PKs on join tables, no ENUM, no pgcrypto | VERIFIED | 300 lines; `revision: str = "v1_16_signage"`; `down_revision: str | None = "v1_15_sensor"`; all 8 `op.create_table`; `ondelete="RESTRICT"` on media_id; `postgresql_where=sa.text("claimed_at IS NULL")`; 2× `sa.PrimaryKeyConstraint` for composite PKs; 5× `gen_random_uuid()`; no `pgcrypto`, no `CREATE TYPE` |
| `docker-compose.yml` (edits) | DB_EXCLUDE_TABLES extended (+2), api gets `directus_uploads:/directus/uploads:ro`, `migrate→directus` ordering | VERIFIED | Line 87: `,signage_devices,signage_pairing_sessions` appended with no spaces; lines 36-38: api volume RO mount present; lines 67-71: directus depends on migrate with `service_completed_successfully`; `docker compose config` resolves cleanly |
| `backend/tests/test_signage_schema_roundtrip.py` | pytest round-trip test covering SGN-DB-01..05 | VERIFIED | 321 lines; `test_round_trip_clean` + `test_playlist_items_media_restrict`; uses `subprocess` for Alembic + asyncpg against pg_catalog + `information_schema.referential_constraints`; live run passed (`2 passed in 1.40s`) |

All artifacts pass Levels 1–4 (exist, substantive, wired, data-flows).

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `backend/app/models/__init__.py` | `backend/app/models/_base.py` | explicit class re-export | WIRED (grep confirms line 12 `from app.models._base import (...)`) |
| `backend/app/models/__init__.py` | `backend/app/models/signage.py` | explicit re-export of 8 classes | WIRED (grep confirms lines 26-34 import of all 8 names; `__all__` on lines 43-46) |
| `backend/alembic/env.py` | `backend/app/models/__init__.py` | `from app.models import Base` | WIRED (env.py import path preserved; live Alembic head advancement to v1_16_signage proves import chain succeeded) |
| `backend/app/schemas/__init__.py` | `backend/app/schemas/_base.py` | `from ... import *` | WIRED (explicit `__all__` in `_base.py`) |
| `backend/app/schemas/__init__.py` | `backend/app/schemas/signage.py` | explicit 19-class re-export | WIRED (in-container import succeeded) |
| `backend/alembic/versions/v1_16_signage_schema.py` | `signage_pairing_sessions.code` partial-unique index | `op.create_index(..., unique=True, postgresql_where=sa.text("claimed_at IS NULL"))` | WIRED (lines 255-270) — matches ORM side post-amendment |
| `backend/alembic/versions/v1_16_signage_schema.py` | `signage_playlist_items.media_id` RESTRICT FK | `sa.ForeignKey(..., ondelete="RESTRICT")` | WIRED (line 155) |
| `docker-compose.yml` `api.volumes` | `directus_uploads` named volume | `:ro` mount at `/directus/uploads` | WIRED (line 38) |
| `docker-compose.yml` `directus.environment.DB_EXCLUDE_TABLES` | list of 13 hidden tables | comma-joined, no spaces | WIRED (line 87) |

All key links verified.

### Data-Flow Trace (Level 4)

Phase 41 is schema/DDL — no runtime user-visible data flow. The "data" here is DDL objects (tables, indexes, constraints) flowing from ORM → migration → Postgres catalog. Traced above via the round-trip test, which reads `pg_tables` / `pg_indexes` / `information_schema.referential_constraints` after a live migration and asserts the expected structural facts. Result: FLOWING.

### Behavioral Spot-Checks

| # | Behavior | Command | Result | Status |
|---|----------|---------|--------|--------|
| 1 | ORM registers all 8 signage tables on `Base.metadata` | `docker compose exec api python -c "from app.models import Base; …"` | 8 tables present, partial index unique + predicate=`claimed_at IS NULL`, `media_id_ondelete=RESTRICT`, `SignageMediaRead.from_attributes=True` | PASS |
| 2 | Round-trip test runs green | `docker compose exec -e POSTGRES_HOST=db api pytest tests/test_signage_schema_roundtrip.py -v` | `2 passed in 1.40s` (both `test_round_trip_clean` and `test_playlist_items_media_restrict`) | PASS |
| 3 | `docker compose config` resolves `DB_EXCLUDE_TABLES` correctly | `docker compose config \| grep DB_EXCLUDE_TABLES` | Value includes `,signage_devices,signage_pairing_sessions`; 6 relational signage tables absent | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| SGN-DB-01 | 41-01, 41-02, 41-03, 41-05 | 8 signage tables created by Alembic | SATISFIED | Round-trip test asserts 8 tables; migration file contains 8 `op.create_table` calls; ORM registers 8 table names with `Base.metadata` |
| SGN-DB-02 (amended) | 41-03, 41-05 | Partial-unique index on active pairing code | SATISFIED (amended) | Index exists, UNIQUE, predicate `claimed_at IS NULL`. Original `expires_at > now()` portion dropped due to Postgres IMMUTABLE rule; expiration invariant now carried by Phase 42 03:00 UTC cleanup cron. See `amendments` in frontmatter. |
| SGN-DB-03 | 41-03, 41-05 | ON DELETE RESTRICT on `signage_playlist_items.media_id` | SATISFIED | Structural: `information_schema.referential_constraints.delete_rule = 'RESTRICT'`; Behavioral: `test_playlist_items_media_restrict` — deleting referenced media raises IntegrityError |
| SGN-DB-04 | 41-04 | Directus DB_EXCLUDE_TABLES hides devices + pairing_sessions; exposes the other 6 | SATISFIED (structural) + NEEDS HUMAN (UI spot-check) | `docker-compose.yml` line 87 contains the 2 names; the other 6 signage tables are absent from the list. Directus Data Model UI behavior itself is a runtime concern routed to human verification. |
| SGN-DB-05 | 41-05 | Round-trip clean (upgrade → downgrade → upgrade) | SATISFIED | `test_round_trip_clean` PASSED live against Postgres 17 |
| SGN-INF-02 | 41-04 | `directus_uploads:/directus/uploads:ro` on api + `migrate → directus` ordering | SATISFIED | docker-compose.yml lines 36-38, 67-71 |

All 6 requirement IDs declared in plan frontmatters (`SGN-DB-01`, `SGN-DB-02`, `SGN-DB-03`, `SGN-DB-04`, `SGN-DB-05`, `SGN-INF-02`) are present in REQUIREMENTS.md and covered. No orphaned requirements.

### Anti-Patterns Found

None.

- `grep -i "TODO|FIXME|XXX|HACK|PLACEHOLDER"` on `backend/app/models/signage.py` and `backend/alembic/versions/v1_16_signage_schema.py` — zero matches.
- `backend/app/models/__init__.py` and `backend/app/schemas/__init__.py` have explicit re-export lists (no stale `pass` placeholders).
- Migration contains no Postgres ENUM `CREATE TYPE`, no `CREATE EXTENSION pgcrypto`, no programmatic Alembic autogenerate residue.
- No `Base.metadata.create_all()` bypass anywhere in the codebase surface touched by Phase 41.

### Human Verification Required

### 1. Directus Data Model UI — signage table visibility

**Test:**
1. `docker compose up -d` on a clean environment.
2. Open Directus at `http://127.0.0.1:8055`, log in as admin, navigate to Settings → Data Model.
3. Observe which `signage_*` collections are listed.

**Expected:** The following 6 collections ARE listed (visible/editable): `signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlist_tag_map`. The following 2 are NOT listed: `signage_devices`, `signage_pairing_sessions`.

**Why human:** Directus UI is a runtime behavior of the Directus container; the DB_EXCLUDE_TABLES env var's effect on the Data Model UI can only be confirmed by visual inspection of the Directus admin UI after a real boot. The structural guarantee (the env var is correct, comma-syntax correct, no stray spaces) is already automated.

## Gaps Summary

No gaps blocking goal achievement. Phase 41 closes `SGN-DB-01`, `SGN-DB-03`, `SGN-DB-05`, `SGN-INF-02` outright; `SGN-DB-02` closes with a documented semantic amendment (see frontmatter `amendments`); `SGN-DB-04` structurally closes with a remaining UI spot-check recommended but not blocking.

### Amendment to record (for downstream phases)

**SGN-DB-02 semantic amendment:** The partial-unique index on `signage_pairing_sessions.code` was weakened during execution from `WHERE expires_at > now() AND claimed_at IS NULL` to `WHERE claimed_at IS NULL`. Reason: Postgres partial-index predicates must be IMMUTABLE; `now()` is STABLE, so the original predicate triggered `sqlalchemy.exc.ProgrammingError` / errcode 42P17 on every `alembic upgrade head`. The index now prevents duplicate active (unclaimed) pairing codes regardless of expiration. The expiration-half of the invariant is now enforced by the Phase 42 03:00 UTC pairing-cleanup cron — this is a correctness requirement Phase 42 must satisfy, not an optional hygiene task. Safe in practice because pairing codes live minutes, cron runs daily, and 6-digit-code collisions in any operational window are vanishingly rare. REQUIREMENTS.md line 18 still shows the original predicate text; reconcile when REQUIREMENTS.md is next touched, or treat this VERIFICATION.md entry as the authoritative amendment record.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
