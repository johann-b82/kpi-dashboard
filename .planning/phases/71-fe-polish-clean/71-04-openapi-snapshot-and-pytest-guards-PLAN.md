---
phase: 71-fe-polish-clean
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/tests/contracts/openapi_paths.json
  - backend/tests/test_openapi_paths_snapshot.py
  - backend/tests/test_db_exclude_tables_directus_collections.py
autonomous: true
requirements: [CLEAN-02, CLEAN-04]

must_haves:
  truths:
    - "OpenAPI paths snapshot test passes against a baseline JSON containing the surviving FastAPI surface only"
    - "DB_EXCLUDE_TABLES pytest asserts (absent-from semantics per D-08) that no migrated Directus collection appears in DB_EXCLUDE_TABLES"
    - "UPDATE_SNAPSHOTS=1 regenerates openapi_paths.json (regen convention same as FE-05)"
  artifacts:
    - path: "backend/tests/test_openapi_paths_snapshot.py"
      provides: "FastAPI surface lock test"
      contains: "app.openapi"
    - path: "backend/tests/contracts/openapi_paths.json"
      provides: "Sorted baseline of FastAPI route paths (post-v1.22)"
    - path: "backend/tests/test_db_exclude_tables_directus_collections.py"
      provides: "Pytest asserting migrated collections NOT in DB_EXCLUDE_TABLES (D-08 absent-from)"
  key_links:
    - from: "test_openapi_paths_snapshot.py"
      to: "app.openapi()['paths']"
      via: "from app.main import app; sorted(app.openapi()['paths'].keys())"
      pattern: "app\\.openapi\\(\\)\\[.paths.\\]"
    - from: "test_db_exclude_tables_directus_collections.py"
      to: "DB_EXCLUDE_TABLES (docker-compose.yml line 106)"
      via: "regex parse of docker-compose.yml"
      pattern: "DB_EXCLUDE_TABLES"
---

<objective>
Land two backend pytest guards: (1) the OpenAPI paths snapshot (D-07 / CLEAN-02) that locks the FastAPI surface, and (2) the DB_EXCLUDE_TABLES "absent-from" assertion (D-08 / CLEAN-04) that prevents accidental hiding of any migrated Directus collection.

Purpose: Catch accidental router re-registration AND accidental DB_EXCLUDE_TABLES regression that would hide a migrated collection from Directus.
Output: 2 new pytest files + 1 baseline JSON, all runnable via `pytest backend/tests/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@backend/app/main.py
@backend/tests/conftest.py

<interfaces>
RESEARCH.md "Surviving FastAPI surface" enumerates the exact post-v1.22 routes (lines 670-693). Examples:
- `/api/upload`, `/api/uploads`, `/api/uploads/{id}`
- `/api/kpis*`, `/api/settings*`, `/api/sync*`, `/api/sensors*`
- `/api/hr/kpis*`
- `/api/data/employees/overtime`
- `/api/signage/pair*`, `/api/signage/player/*`, `/api/signage/analytics/devices`
- `/api/signage/media*`
- `/api/signage/playlists/{id}` (DELETE)
- `/api/signage/playlists/{id}/items` (PUT bulk)
- `/api/signage/devices/{id}/calibration` (PATCH)
- `/api/signage/resolved/{id}` (GET)
- `/health`

DB_EXCLUDE_TABLES is in docker-compose.yml line 106 as an env var (NOT in app/config.py — RESEARCH.md confirms). Format is comma-separated.

D-08 user-locked semantics (per planning_context preamble): pytest MUST use ABSENT-FROM check phrased as `assert migrated_collections.isdisjoint(set(DB_EXCLUDE_TABLES))`. NOT a superset check.

Migrated Directus collections (must NOT be in DB_EXCLUDE_TABLES):
sales_records, personio_employees, signage_devices, signage_playlists, signage_playlist_items, signage_device_tags, signage_playlist_tag_map, signage_device_tag_map, signage_schedules, signage_playlists (dedupe at use site).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create OpenAPI paths snapshot test + baseline</name>
  <files>backend/tests/test_openapi_paths_snapshot.py, backend/tests/contracts/openapi_paths.json</files>
  <read_first>
    - backend/app/main.py (entire — current router registrations)
    - backend/tests/conftest.py (test harness + app fixture pattern)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pattern 4 verbatim, Pitfall 5 — paths only, sorted)
  </read_first>
  <action>
    Create `backend/tests/test_openapi_paths_snapshot.py` per RESEARCH.md Pattern 4 verbatim:

    ```python
    import json
    import os
    from pathlib import Path

    from app.main import app

    CONTRACT_PATH = Path(__file__).parent / "contracts" / "openapi_paths.json"


    def test_openapi_paths_match_snapshot():
        """CLEAN-02 / D-07: lock the FastAPI surface.

        Asserts the sorted set of OpenAPI paths matches the committed baseline.
        Catches accidental re-registration of a deleted router (e.g. me_router,
        data_router) and accidental new-route additions that bypass the planning
        workflow.

        Regenerate with:
            UPDATE_SNAPSHOTS=1 pytest backend/tests/test_openapi_paths_snapshot.py
        """
        actual = sorted(app.openapi()["paths"].keys())
        if os.environ.get("UPDATE_SNAPSHOTS") == "1":
            CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
            CONTRACT_PATH.write_text(json.dumps(actual, indent=2) + "\n")
            return
        expected = json.loads(CONTRACT_PATH.read_text())
        assert actual == expected, (
            f"OpenAPI paths drift detected.\n"
            f"  added:   {sorted(set(actual) - set(expected))}\n"
            f"  removed: {sorted(set(expected) - set(actual))}\n"
            f"  Regenerate with UPDATE_SNAPSHOTS=1 if intentional."
        )
    ```

    CRITICAL — paths only, sorted, NOT the full openapi() dict (Pitfall 5).

    Generate baseline by running:
    ```bash
    cd backend && UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py -x
    ```
    This creates `backend/tests/contracts/openapi_paths.json`. Then re-run WITHOUT the env var to verify the baseline locks correctly.

    Inspect the generated baseline against RESEARCH.md "Surviving FastAPI surface" (lines 670-693) — if any DELETED route still appears (e.g., `/api/me`, `/api/data/sales`, `/api/data/employees`, `/api/signage/tags*`, `/api/signage/schedules*`, `/api/signage/playlists` POST/PATCH, `/api/signage/devices` PATCH), the deletion sweep in plan 71-05 hasn't run yet OR a router got re-registered — flag this in the plan SUMMARY and proceed (the snapshot will be re-baselined after 71-05 lands).
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_openapi_paths_snapshot.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/tests/test_openapi_paths_snapshot.py` exists
    - File `backend/tests/contracts/openapi_paths.json` exists, valid JSON array of strings (paths)
    - Test contains literal string `app.openapi()["paths"]` (paths-only projection — Pitfall 5)
    - Test contains literal string `UPDATE_SNAPSHOTS` for regen convention
    - `pytest tests/test_openapi_paths_snapshot.py -x` returns exit 0
    - JSON file size < 5 KB (Pitfall 5 — paths only, not full spec)
  </acceptance_criteria>
  <done>OpenAPI paths snapshot test green; baseline committed; regen convention documented.</done>
</task>

<task type="auto">
  <name>Task 2: Create DB_EXCLUDE_TABLES absent-from pytest (D-08)</name>
  <files>backend/tests/test_db_exclude_tables_directus_collections.py</files>
  <read_first>
    - docker-compose.yml (find DB_EXCLUDE_TABLES literal — line 106 per RESEARCH.md)
    - scripts/ci/check_db_exclude_tables_superset.sh (existing complementary guard — keep both, don't break)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pattern 5 + RESEARCH.md Open Question 2 inversion finding)
  </read_first>
  <action>
    Create `backend/tests/test_db_exclude_tables_directus_collections.py` implementing the user-locked D-08 ABSENT-FROM semantics (per planning_context preamble — NOT a superset check).

    ```python
    """Phase 71 CLEAN-04 / D-08: absent-from check on DB_EXCLUDE_TABLES.

    The v1.22 migration moved a set of collections from FastAPI CRUD to
    Directus. For Directus to serve them, they must NOT appear in the
    DB_EXCLUDE_TABLES env var (which is the deny-list Directus consults
    when auto-introspecting Postgres tables).

    This test enforces the user-locked semantics from D-08:
        assert migrated_collections.isdisjoint(set(DB_EXCLUDE_TABLES))

    A complementary superset check (never-expose tables MUST appear in
    DB_EXCLUDE_TABLES) lives in scripts/ci/check_db_exclude_tables_superset.sh
    and is intentionally separate.
    """
    import re
    from pathlib import Path


    MIGRATED_COLLECTIONS = {
        "sales_records",
        "personio_employees",
        "signage_devices",
        "signage_playlists",
        "signage_playlist_items",
        "signage_device_tags",
        "signage_playlist_tag_map",
        "signage_device_tag_map",
        "signage_schedules",
    }

    COMPOSE = Path(__file__).resolve().parents[2] / "docker-compose.yml"


    def _read_db_exclude_tables() -> set[str]:
        text = COMPOSE.read_text()
        m = re.search(r"^\s+DB_EXCLUDE_TABLES:\s*(.+)$", text, re.MULTILINE)
        assert m, "DB_EXCLUDE_TABLES not found in docker-compose.yml"
        raw = m.group(1).strip().strip('"').strip("'")
        return {t.strip() for t in raw.split(",") if t.strip()}


    def test_migrated_collections_absent_from_db_exclude_tables():
        excluded = _read_db_exclude_tables()
        # User decision D-08 (planning context): absent-from semantics
        assert MIGRATED_COLLECTIONS.isdisjoint(excluded), (
            "DB_EXCLUDE_TABLES would HIDE migrated Directus collections from "
            "Directus introspection. The following migrated collections must be "
            f"removed from DB_EXCLUDE_TABLES: {sorted(MIGRATED_COLLECTIONS & excluded)}"
        )
    ```

    The test must use the literal `MIGRATED_COLLECTIONS.isdisjoint(excluded)` form per the planning_context preamble. Do NOT use a superset check.

    Verify the test passes against the current `docker-compose.yml` (the v1.22 setup should already have the correct DB_EXCLUDE_TABLES — Phase 65 set this up).
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_db_exclude_tables_directus_collections.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/tests/test_db_exclude_tables_directus_collections.py` exists
    - File contains the literal substring `MIGRATED_COLLECTIONS.isdisjoint(excluded)` (D-08 user-locked semantics)
    - File does NOT contain `.issuperset(` (NOT a superset check — would invert D-08)
    - File defines `MIGRATED_COLLECTIONS` containing all 9 collection names listed above
    - `pytest tests/test_db_exclude_tables_directus_collections.py -x` returns exit 0
    - Existing shell guard at `scripts/ci/check_db_exclude_tables_superset.sh` is NOT modified or deleted
  </acceptance_criteria>
  <done>DB_EXCLUDE_TABLES absent-from pytest green; complementary shell superset guard untouched.</done>
</task>

</tasks>

<verification>
- Both pytest files green
- OpenAPI baseline JSON < 5 KB (paths only)
- D-08 absent-from semantics literally present (planning_context preamble lock)
</verification>

<success_criteria>
CLEAN-02 (OpenAPI paths snapshot locks surface) and CLEAN-04 partial (DB_EXCLUDE_TABLES guard) both mechanized.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-04-SUMMARY.md`.
</output>
