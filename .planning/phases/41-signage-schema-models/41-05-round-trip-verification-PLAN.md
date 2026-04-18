---
phase: 41-signage-schema-models
plan: 05
type: execute
wave: 3
depends_on:
  - 41-01
  - 41-03
  - 41-04
files_modified:
  - backend/tests/test_signage_schema_roundtrip.py
autonomous: true
requirements:
  - SGN-DB-05
  - SGN-DB-01
  - SGN-DB-02
  - SGN-DB-03
  - SGN-INF-02
must_haves:
  truths:
    - "A pytest (or shell-driven) check runs `alembic upgrade head` on a fresh DB and finds all 8 signage_* tables"
    - "The check verifies the partial-unique index exists on signage_pairing_sessions.code WHERE expires_at > now() AND claimed_at IS NULL"
    - "The check verifies ON DELETE RESTRICT is enforced on signage_playlist_items.media_id (attempting to delete referenced media row fails)"
    - "`alembic downgrade -1` followed by schema inspection shows 0 signage_* tables and 0 residual signage indexes"
    - "A second `alembic upgrade head` restores the identical schema"
  artifacts:
    - path: backend/tests/test_signage_schema_roundtrip.py
      provides: "Automated round-trip test validating SGN-DB-01..05"
      contains: "def test_round_trip_clean"
      min_lines: 80
  key_links:
    - from: backend/tests/test_signage_schema_roundtrip.py
      to: alembic (via subprocess) and Postgres (via psycopg/asyncpg or SQLAlchemy inspection)
      via: "runs subprocess `alembic upgrade head` / `alembic downgrade -1` and queries pg_indexes + information_schema.table_constraints"
      pattern: "alembic upgrade head"
---

<objective>
Create an automated round-trip test that proves Phase 41's migration is correct. The test runs `alembic upgrade head`, inspects the resulting schema (table count, partial index, RESTRICT FK), runs `alembic downgrade -1`, confirms zero residual signage objects, then re-runs `alembic upgrade head` and confirms identity. This is the executable proof of SGN-DB-05.

Purpose: Convert the "success criteria" sentences in ROADMAP.md Phase 41 into a single pytest invocation that any subsequent phase can rerun (e.g., Phase 42 can validate that its additive migration does not break the round-trip).

Output: One pytest file; exits 0 when all assertions pass; exits non-zero with a clear failure message otherwise.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-signage-schema-models/41-CONTEXT.md
@.planning/phases/41-signage-schema-models/41-RESEARCH.md
@backend/alembic/env.py
@backend/alembic/versions/v1_16_signage_schema.py

<interfaces>
Existing test layout (check before writing):
- `backend/tests/` may or may not exist; if missing, create it with an `__init__.py`.
- Existing pattern for DB-touching tests in this codebase: connect via sync psycopg or async SQLAlchemy session reading from `.env` `DATABASE_URL`.
- Alembic must be invoked via subprocess (`alembic` CLI) rather than `command.upgrade` programmatic API — this keeps the test environment-parity with `docker compose run --rm migrate alembic upgrade head`.

Environment requirements at test time:
- Postgres reachable at the URL Alembic `env.py` resolves (same behavior as `docker compose up migrate`).
- Running inside the `api` container OR locally with the same `DATABASE_URL` env var that Alembic resolves.
- For a truly fresh-DB test, the test fixture may need to drop the signage_* tables before starting, OR the test may first run `alembic downgrade <down_revision_of_v1_16>` and then upgrade to head. Use whichever approach is simpler given the existing test harness.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write a round-trip test for the signage migration</name>
  <files>backend/tests/test_signage_schema_roundtrip.py, backend/tests/__init__.py (only if missing)</files>
  <read_first>
    - backend/alembic/env.py (to understand how DATABASE_URL is resolved)
    - backend/alembic/versions/v1_16_signage_schema.py (for the exact revision id `v1_16_signage`)
    - backend/alembic/versions/v1_15_sensor_schema.py (to find the prior head revision id — used as the downgrade target)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md section "Round-Trip Migration Testing" — the verification checklist this test encodes
    - backend/tests/ if it exists — follow existing fixture patterns
  </read_first>
  <action>
    Create `backend/tests/test_signage_schema_roundtrip.py`. The test uses `subprocess` to drive Alembic (mirrors how operators run migrations) and `psycopg` or `sqlalchemy.create_engine` with a sync URL to inspect pg_catalog for assertions.

    **Required assertions (one test function per assertion or a single `test_round_trip_clean` test — planner picks; prefer one function for atomicity):**

    1. **Fresh upgrade creates 8 tables.** After `alembic upgrade head`:
```python
expected = {
    "signage_media", "signage_playlists", "signage_playlist_items",
    "signage_devices", "signage_device_tags", "signage_device_tag_map",
    "signage_playlist_tag_map", "signage_pairing_sessions",
}
rows = conn.execute(text(
    "SELECT tablename FROM pg_tables WHERE tablename LIKE 'signage_%'"
)).all()
found = {r[0] for r in rows}
assert found == expected, f"expected 8 signage tables, found: {found}"
```

    2. **Partial unique index present on signage_pairing_sessions.code.**
```python
rows = conn.execute(text("""
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'signage_pairing_sessions'
      AND indexname = 'uix_signage_pairing_sessions_code_active'
""")).all()
assert rows, "partial unique index missing"
indexdef = rows[0][1]
assert "UNIQUE" in indexdef.upper(), f"index not unique: {indexdef}"
assert "expires_at > now()" in indexdef.lower() or "expires_at > now()" in indexdef, \
    f"partial predicate missing: {indexdef}"
assert "claimed_at IS NULL" in indexdef or "claimed_at is null" in indexdef.lower(), \
    f"claimed_at predicate missing: {indexdef}"
```

    3. **ON DELETE RESTRICT on signage_playlist_items.media_id.**
```python
rows = conn.execute(text("""
    SELECT rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'signage_playlist_items'
      AND kcu.column_name = 'media_id'
""")).all()
assert rows, "FK on media_id missing"
assert rows[0][0] == "RESTRICT", f"media_id ondelete is {rows[0][0]}, expected RESTRICT"
```
    Also a behavioral assertion: insert a media row, insert a playlist, insert a playlist_item referencing the media, then attempt to `DELETE FROM signage_media WHERE id = ...` and assert an `IntegrityError` / `ForeignKeyViolation` is raised.

    4. **alembic_version row is v1_16_signage after upgrade.**
```python
rows = conn.execute(text("SELECT version_num FROM alembic_version")).all()
assert rows[0][0] == "v1_16_signage"
```

    5. **Downgrade removes all signage_* tables and indexes.**
```python
subprocess.run(["alembic", "downgrade", "-1"], cwd=BACKEND_DIR, check=True)
rows = conn.execute(text(
    "SELECT tablename FROM pg_tables WHERE tablename LIKE 'signage_%'"
)).all()
assert rows == [], f"residual signage tables after downgrade: {rows}"
rows = conn.execute(text(
    "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%signage%'"
)).all()
assert rows == [], f"residual signage indexes after downgrade: {rows}"
```

    6. **Second upgrade restores the schema.**
```python
subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND_DIR, check=True)
# re-run assertion 1
```

    **Test scaffolding (put at module top):**
```python
import os
import subprocess
from pathlib import Path
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/

def _sync_db_url() -> str:
    # Alembic uses the same DATABASE_URL the rest of the app uses.
    # Convert asyncpg URL to psycopg (sync) form if needed.
    url = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL not set — round-trip test requires a live DB")
    # Normalize: postgresql+asyncpg:// -> postgresql:// for sync engine
    return url.replace("postgresql+asyncpg://", "postgresql://").replace("+asyncpg", "")

@pytest.fixture
def engine():
    return create_engine(_sync_db_url())

def _run_alembic(*args: str) -> None:
    subprocess.run(["alembic", *args], cwd=BACKEND_DIR, check=True)

def test_round_trip_clean(engine):
    # Ensure a known starting state: upgrade to head
    _run_alembic("upgrade", "head")

    with engine.connect() as conn:
        # ... assertions 1-4 above ...
        pass

    # Downgrade one step (unwinds v1_16_signage)
    _run_alembic("downgrade", "-1")

    with engine.connect() as conn:
        # ... assertion 5 ...
        pass

    # Re-upgrade
    _run_alembic("upgrade", "head")

    with engine.connect() as conn:
        # ... re-run assertion 1 ...
        pass
```

    **Integrity behavioral sub-test (inside the same function or a separate test):**
```python
def test_playlist_items_media_restrict(engine):
    _run_alembic("upgrade", "head")
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO signage_media (id, kind, title) VALUES
              ('11111111-1111-1111-1111-111111111111', 'image', 'test-media')
        """))
        conn.execute(text("""
            INSERT INTO signage_playlists (id, name) VALUES
              ('22222222-2222-2222-2222-222222222222', 'test-playlist')
        """))
        conn.execute(text("""
            INSERT INTO signage_playlist_items (id, playlist_id, media_id, position) VALUES
              ('33333333-3333-3333-3333-333333333333',
               '22222222-2222-2222-2222-222222222222',
               '11111111-1111-1111-1111-111111111111', 0)
        """))
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text(
                "DELETE FROM signage_media WHERE id = '11111111-1111-1111-1111-111111111111'"
            ))
    # Cleanup
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM signage_playlist_items WHERE id = '33333333-3333-3333-3333-333333333333'"))
        conn.execute(text("DELETE FROM signage_playlists WHERE id = '22222222-2222-2222-2222-222222222222'"))
        conn.execute(text("DELETE FROM signage_media WHERE id = '11111111-1111-1111-1111-111111111111'"))
```

    If `backend/tests/__init__.py` does not exist, create it (empty file) so pytest collects properly.

    **Running convention:** Document at the top of the file that this test is intended to be run via `docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -v` (or equivalent inside the api container). It skips cleanly when `DATABASE_URL` is not set (e.g., CI lint-only runs).

    This implements SGN-DB-05 and provides executable regression coverage for SGN-DB-01..03.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -c "import ast; ast.parse(open('tests/test_signage_schema_roundtrip.py').read()); print('parses ok')" &amp;&amp; docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -v 2>&amp;1 | tee /tmp/41-05.log &amp;&amp; grep -q "passed" /tmp/41-05.log &amp;&amp; ! grep -q "failed" /tmp/41-05.log</automated>
  </verify>
  <acceptance_criteria>
    - File exists and parses as Python: `python -c "import ast; ast.parse(open('backend/tests/test_signage_schema_roundtrip.py').read())"` exits 0
    - Test function `test_round_trip_clean` present: `grep -q 'def test_round_trip_clean' backend/tests/test_signage_schema_roundtrip.py`
    - RESTRICT behavioral test present: `grep -q 'def test_playlist_items_media_restrict' backend/tests/test_signage_schema_roundtrip.py`
    - Uses subprocess for Alembic (not programmatic API): `grep -q 'subprocess.run(\["alembic"' backend/tests/test_signage_schema_roundtrip.py`
    - Inspects pg_tables: `grep -q "pg_tables" backend/tests/test_signage_schema_roundtrip.py`
    - Inspects pg_indexes for the partial index: `grep -q "uix_signage_pairing_sessions_code_active" backend/tests/test_signage_schema_roundtrip.py && grep -q "pg_indexes" backend/tests/test_signage_schema_roundtrip.py`
    - Inspects referential_constraints for RESTRICT: `grep -q "referential_constraints" backend/tests/test_signage_schema_roundtrip.py && grep -q '"RESTRICT"' backend/tests/test_signage_schema_roundtrip.py`
    - Verifies downgrade removes all signage_* tables: `grep -q "residual signage tables after downgrade" backend/tests/test_signage_schema_roundtrip.py`
    - Full test run (in the api container with DB up): `docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -v` exits 0 and shows "passed" for both test functions
  </acceptance_criteria>
  <done>A pytest file that executes the 6 assertions above, uses subprocess to drive Alembic, queries pg_catalog for structural checks, performs an integrity-constraint behavioral test, and passes against a live dev DB.</done>
</task>

</tasks>

<verification>
Full phase-level sanity check (run after this plan completes):
```
# Round-trip test passes
docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -v

# Directus UI shows expected tables (manual spot-check per success criterion 4)
# - After `docker compose up -d`, open Directus Data Model
# - Confirm signage_media, signage_playlists, signage_playlist_items, signage_device_tags, signage_device_tag_map, signage_playlist_tag_map are visible
# - Confirm signage_devices and signage_pairing_sessions are NOT visible

# The round-trip test plus the Directus spot-check together prove all 4 ROADMAP.md Phase 41 success criteria.
```
</verification>

<success_criteria>
- `backend/tests/test_signage_schema_roundtrip.py` exists and parses as Python
- Test runs `alembic upgrade head`, asserts 8 signage_* tables present, asserts partial unique index with WHERE clause present, asserts RESTRICT FK enforced (behavioral + structural), asserts `alembic_version = v1_16_signage`
- Test runs `alembic downgrade -1`, asserts 0 signage tables, 0 signage indexes remain
- Test re-runs `alembic upgrade head` and re-asserts the 8-table state
- `docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -v` passes with all tests reported green
</success_criteria>

<output>
After completion, create `.planning/phases/41-signage-schema-models/41-05-SUMMARY.md` recording: the exact pytest output from the final run, any test scaffolding that had to be added (tests/__init__.py, conftest.py changes, etc.), the DATABASE_URL format used, and a closing statement of which Phase 41 ROADMAP success criteria are now executable (SGN-DB-01..05) vs. which remain manual (SGN-DB-04 Directus UI spot-check, SGN-INF-02 compose ordering).
</output>
