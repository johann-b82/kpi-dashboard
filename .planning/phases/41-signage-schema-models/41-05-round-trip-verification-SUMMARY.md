---
phase: 41-signage-schema-models
plan: 05
subsystem: database
tags: [alembic, postgres, asyncpg, pytest, partial-index, migration-testing, signage]

# Dependency graph
requires:
  - phase: 41-01
    provides: SignagePairingSession ORM with partial-unique index Index() declaration
  - phase: 41-03
    provides: v1_16_signage Alembic migration (upgrade/downgrade)
  - phase: 41-04
    provides: Docker Compose migrate service wired to db healthcheck
provides:
  - "Automated round-trip test (pytest + asyncpg + pg_catalog) proving SGN-DB-01/02/03/05"
  - "Executable regression harness any later v1.16 phase can rerun to prove its migration does not break the signage round-trip"
  - "SGN-DB-02 amendment: partial-index predicate is `claimed_at IS NULL` only (expiration invariant now cron-backed, not index-backed)"
  - "Fix to the v1_16_signage migration so `alembic upgrade head` actually succeeds against Postgres 17"
affects: [42-signage-auth-pairing, 44-pptx-conversion, 45-sse, 48-pi-e2e]

# Tech tracking
tech-stack:
  added: []  # asyncpg + pytest already present in api image
  patterns:
    - "Migration round-trip test pattern: subprocess alembic CLI + asyncpg pg_catalog inspection + FK-violation behavioral probe"
    - "Partial-index predicates must be IMMUTABLE-only in Postgres; time-based expiration must be enforced out-of-band (cron, scheduled task)"

key-files:
  created:
    - backend/tests/test_signage_schema_roundtrip.py
    - .planning/phases/41-signage-schema-models/41-05-round-trip-verification-SUMMARY.md
  modified:
    - backend/alembic/versions/v1_16_signage_schema.py  # dropped now() from partial-index predicate
    - backend/app/models/signage.py                     # mirrored predicate change + docstring amendment

key-decisions:
  - "SGN-DB-02 amended: partial-unique index on signage_pairing_sessions.code uses WHERE claimed_at IS NULL (not `expires_at > now() AND claimed_at IS NULL`). Postgres rejects non-IMMUTABLE functions (now() is STABLE) in partial-index predicates (errcode 42P17). Expiration invariant is now enforced by the Phase 42 03:00 UTC pairing-cleanup cron, not by the index."
  - "Round-trip test drives Alembic via `subprocess.run([\"alembic\", …])` rather than Alembic's programmatic API — keeps the test environment-parity with how operators actually invoke migrations (`docker compose run --rm migrate alembic upgrade head`)."
  - "Test inspects schema via raw asyncpg + pg_catalog/information_schema queries (not SQLAlchemy reflection) — pg_catalog is the source of truth and cannot be fooled by stale ORM metadata."
  - "Behavioral RESTRICT probe (INSERT media→playlist→item, then DELETE media, expect FK violation) complements the structural `referential_constraints.delete_rule = 'RESTRICT'` check — together they prove both the schema declaration and runtime enforcement."

patterns-established:
  - "Migration tests run inside the api container with POSTGRES_HOST=db explicit override so conftest.py's localhost default does not shadow the docker hostname"
  - "When migration changes, `docker compose build migrate` is required — migrate service has no bind-mount; image must be rebuilt to pick up alembic/versions/* edits"
  - "All partial-index predicates in this codebase must use only IMMUTABLE expressions; time-window invariants belong in scheduled cleanup jobs"

requirements-completed: [SGN-DB-05, SGN-DB-01, SGN-DB-02, SGN-DB-03, SGN-INF-02]

# Metrics
duration: ~35min (including the IMMUTABLE-predicate fix cycle)
completed: 2026-04-18
---

# Phase 41 Plan 05: Round-Trip Verification Summary

**Automated pytest + asyncpg round-trip test for the v1.16 signage migration, plus in-flight fix of a Postgres IMMUTABLE-predicate violation caught by the test itself.**

## Performance

- **Duration:** ~35 min (prior agent: test authored; this agent: bug fix + verification + commits)
- **Started:** 2026-04-18T15:15Z (plan 41-03 completion) — continuation after checkpoint decision
- **Completed:** 2026-04-18
- **Tasks:** 1 (plus Rule-1 auto-fix)
- **Files modified:** 3 (1 new test, 1 migration, 1 model)

## Accomplishments

- `backend/tests/test_signage_schema_roundtrip.py` — 321 lines, 2 pytest functions, SGN-DB-01/02/03/05 covered (structural + behavioral)
- Caught and fixed a real migration bug: `now()` in partial-index predicate is rejected by Postgres (errcode 42P17, "functions in index predicate must be marked IMMUTABLE")
- SGN-DB-02 semantic amendment recorded: index predicate weakened to `claimed_at IS NULL`, expiration now cron-backed
- Live round-trip verified against dev DB: `v1_15_sensor → v1_16_signage → v1_15_sensor → v1_16_signage`, 8 signage tables appear/disappear cleanly, `alembic_version` rewinds correctly, no residual indexes after downgrade

## Task Commits

1. **Migration + model fix (Rule-1 auto-fix)** — `0f7ae65` (fix)
2. **Round-trip test file** — `398eacd` (test)
3. **Plan metadata (this SUMMARY + STATE + ROADMAP)** — final docs commit

## Files Created/Modified

- `backend/tests/test_signage_schema_roundtrip.py` — round-trip test: upgrade head → assert 8 tables + partial index + RESTRICT FK + alembic_version → downgrade -1 → assert zero residuals → re-upgrade → re-assert identity. Plus a behavioral RESTRICT probe.
- `backend/alembic/versions/v1_16_signage_schema.py` — `postgresql_where=sa.text("claimed_at IS NULL")` (was `expires_at > now() AND claimed_at IS NULL`); added comment citing errcode 42P17 and the cron-backed invariant.
- `backend/app/models/signage.py` — matching ORM Index predicate change + docstring amendment on `SignagePairingSession`.

## Decisions Made

- **SGN-DB-02 amendment (semantic):** predicate is `claimed_at IS NULL` only. Rationale: Postgres partial-index predicates must be IMMUTABLE; `now()` is STABLE. Expiration invariant ("only one *unexpired, unclaimed* code per value") will be enforced by the Phase 42 03:00 UTC pairing-cleanup cron, which transitions expired rows out of the unclaimed state. This is a safe weakening in practice because pairing codes live for minutes, cron runs daily, and collisions on a randomly-generated 6-digit code within any operational window are vanishingly rare.
- **Subprocess-driven Alembic (not programmatic API):** keeps test identical to operator invocation (`docker compose run --rm migrate alembic upgrade head`); catches CLI-layer regressions (env vars, `alembic.ini` wiring) that `command.upgrade()` would paper over.
- **asyncpg + pg_catalog for inspection:** api image only ships the async driver; SQLAlchemy sync engine would require adding psycopg. asyncpg + raw SQL against `pg_tables`, `pg_indexes`, `information_schema.referential_constraints` is the source of truth anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Partial-index predicate violated Postgres IMMUTABLE rule**

- **Found during:** Task 1 (first `alembic upgrade head` run against live Postgres 17 inside the migrate container).
- **Issue:** The v1_16_signage migration declared
  `postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL")` on
  `uix_signage_pairing_sessions_code_active`. Postgres raised
  `sqlalchemy.exc.ProgrammingError: functions in index predicate must be marked IMMUTABLE` (asyncpg `InvalidObjectDefinitionError`, errcode 42P17). `now()` is STABLE, not IMMUTABLE, and cannot appear in a partial-index predicate. This would have blocked every `alembic upgrade head` — full migration failure, not a degraded mode.
- **Root cause of the planning error:** `.planning/phases/41-signage-schema-models/41-RESEARCH.md` (around lines 165-167, "Partial unique index with WHERE predicate" section) was factually wrong — it showed `WHERE expires_at > now() AND claimed_at IS NULL` as a working pattern without noting the IMMUTABLE requirement. Subsequent phases' research notes should be re-reviewed for similar STABLE-function-in-predicate claims.
- **User decision (Option 1) selected at checkpoint:** drop `expires_at > now()` from the predicate; keep `claimed_at IS NULL`; rely on the Phase 42 03:00 UTC cron cleanup for the expiration side of the invariant. SGN-DB-02 semantically amended.
- **Fix:**
  - `backend/alembic/versions/v1_16_signage_schema.py`: predicate changed to `claimed_at IS NULL`; inline comment added documenting errcode 42P17 and the cron-backed invariant.
  - `backend/app/models/signage.py`: ORM-side `Index(...)` `postgresql_where` changed to match; class docstring amended with the SGN-DB-02 amendment note.
  - `backend/tests/test_signage_schema_roundtrip.py`: assertion changed to require `CLAIMED_AT IS NULL` in the index def and to explicitly forbid `NOW()` (so any future regression to the broken pattern is caught before it hits DB).
- **Verification:**
  - Rebuilt `kpi-dashboard-migrate` image (migrate service has no bind-mount; image must be rebuilt).
  - `docker compose run --rm migrate alembic upgrade head` → SUCCESS, 8 tables created, index `CREATE UNIQUE INDEX ... USING btree (code) WHERE (claimed_at IS NULL)` confirmed via `pg_indexes`.
  - `docker compose run --rm migrate alembic downgrade -1` → 0 signage_* tables, 0 signage indexes.
  - `docker compose run --rm migrate alembic upgrade head` → 8 tables back, `alembic_version = v1_16_signage`.
  - `docker compose exec -e POSTGRES_HOST=db api pytest tests/test_signage_schema_roundtrip.py -v` → `2 passed in 1.33s`.
- **Committed in:** `0f7ae65` (migration + model) and `398eacd` (test).

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug; in-flight, user-approved semantic amendment to SGN-DB-02)
**Impact on plan:** Correct fix; no scope creep. The plan as written would have shipped a migration that physically could not run. The round-trip test not only covers SGN-DB-01..05 going forward — it caught and blocked a real bug on its very first execution, exactly as intended.

## Issues Encountered

- **migrate service has no bind-mount** — editing `backend/alembic/versions/*.py` on the host does not propagate to the migrate container. `docker compose build migrate` was required before the re-run. Documented in "patterns-established" so future phases don't chase the same ghost.
- **conftest.py localhost default** — `backend/tests/conftest.py` sets `POSTGRES_HOST=localhost` for unit tests, which shadows the docker hostname `db`. The test's `_pg_dsn()` helper treats "localhost" as "fall back to the docker hostname 'db'"; invoking pytest with explicit `-e POSTGRES_HOST=db` is the cleanest path. Documented in the test module docstring.

## Final Test Output

```
============================= test session starts ==============================
platform linux -- Python 3.11.15, pytest-9.0.3, pluggy-1.6.0
rootdir: /app
configfile: pytest.ini
plugins: anyio-4.13.0, asyncio-1.3.0
collected 2 items

tests/test_signage_schema_roundtrip.py::test_round_trip_clean PASSED     [ 50%]
tests/test_signage_schema_roundtrip.py::test_playlist_items_media_restrict PASSED [100%]

============================== 2 passed in 1.33s ===============================
```

Invocation: `docker compose exec -e POSTGRES_HOST=db api pytest tests/test_signage_schema_roundtrip.py -v`
DATABASE_URL resolution: `postgresql://acm_user:changeme@db:5432/acm_kpi` (built from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_HOST=db`).

## User Setup Required

None — this plan adds test coverage and fixes a migration bug. No external services touched.

## Phase 41 ROADMAP Success Criteria — Status

| Criterion | Mechanism | Status |
|---|---|---|
| SGN-DB-01: 8 signage tables after migrate | `test_round_trip_clean` asserts `_signage_tables() == EXPECTED_TABLES` | **Executable** |
| SGN-DB-02: partial-unique index on pairing code (amended) | `test_round_trip_clean` asserts index exists, is UNIQUE, predicate is `claimed_at IS NULL`, and rejects `now()` | **Executable** |
| SGN-DB-03: ON DELETE RESTRICT on playlist_items.media_id | Structural via `referential_constraints` + behavioral via FK-violation probe | **Executable** |
| SGN-DB-04: Directus hides devices + pairing_sessions | Manual Directus UI spot-check post `docker compose up -d` | **Manual** (by design — Directus behavior, not schema) |
| SGN-DB-05: round-trip clean | `test_round_trip_clean` runs upgrade → downgrade → upgrade and asserts empty + identity | **Executable** |
| SGN-INF-02: migrate → directus ordering | Docker Compose `service_completed_successfully` (set in plan 41-04) | **Executable via compose** |

## Next Phase Readiness

- Phase 41 is ready to close; all DB-layer requirements met and covered by tests.
- Phase 42 (auth/pairing) can now assume:
  - 8 signage tables exist (partial-index on `claimed_at IS NULL` only).
  - Must implement the 03:00 UTC pairing-cleanup cron (now a correctness requirement, not just a nicety — it carries the expiration invariant that used to live in the partial-index predicate).
- Future migrations should re-run `pytest tests/test_signage_schema_roundtrip.py` to prove they don't regress the v1.16 round-trip.
- **Research-note follow-up:** someone should sweep the v1.16 RESEARCH.md files for other `now()`-in-predicate patterns before plans building on them lock in.

## Self-Check

- [x] `backend/tests/test_signage_schema_roundtrip.py` exists
- [x] `backend/alembic/versions/v1_16_signage_schema.py` predicate = `claimed_at IS NULL`
- [x] `backend/app/models/signage.py` predicate matches
- [x] Commit `0f7ae65` (fix) exists
- [x] Commit `398eacd` (test) exists
- [x] Round-trip test green (2 passed)
- [x] Live `alembic upgrade head → downgrade -1 → upgrade head` verified against dev Postgres

## Self-Check: PASSED

---
*Phase: 41-signage-schema-models*
*Completed: 2026-04-18*
