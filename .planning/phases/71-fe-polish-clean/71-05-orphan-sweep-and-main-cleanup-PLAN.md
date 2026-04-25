---
phase: 71-fe-polish-clean
plan: 05
type: execute
wave: 2
depends_on: [71-04]
files_modified:
  - backend/app/main.py
  - backend/app/schemas/signage.py
  - backend/tests/contracts/openapi_paths.json
autonomous: true
requirements: [CLEAN-01, CLEAN-02]

must_haves:
  truths:
    - "All schemas in backend/app/schemas/signage.py with zero callers in surviving routers/tests are deleted"
    - "Orphan test files (test_signage_hhmm.py if dead, etc.) hitting deleted FastAPI routes are deleted or migrated"
    - "main.py has no router registrations for deleted modules; imports are clean"
    - "OpenAPI paths snapshot regenerated (UPDATE_SNAPSHOTS=1) and reflects only the surviving FastAPI surface (RESEARCH.md lines 670-693)"
    - "Surviving helpers (_notify_playlist_changed, _notify_device_self, etc.) are PRESERVED if any surviving code calls them (Pitfall 7)"
  artifacts:
    - path: "backend/app/main.py"
      provides: "Router registrations for surviving routers only"
    - path: "backend/app/schemas/signage.py"
      provides: "Schemas used by surviving routers/tests only"
    - path: "backend/tests/contracts/openapi_paths.json"
      provides: "Updated baseline reflecting post-sweep surface"
  key_links:
    - from: "main.py"
      to: "surviving routers (uploads, kpis, settings, sync, sensors, hr_kpis, hr_overtime, signage_pair, signage_player, signage_admin/{analytics,media,playlists,playlist_items,devices,resolved})"
      via: "app.include_router(...)"
      pattern: "include_router"
---

<objective>
Catch-all sweep of FastAPI router/schema/test orphans surviving from Phases 66-70 incremental deletions, plus regenerate the OpenAPI baseline created in plan 71-04 to reflect the final post-v1.22 surface.

Purpose: Lock CLEAN-01 (no orphaned imports) and CLEAN-02 (main.py registrations clean; surface assertion green).
Output: Modified main.py + schemas/signage.py + regenerated openapi_paths.json baseline.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@backend/app/main.py
@backend/app/schemas/signage.py
@backend/app/routers/signage_admin/__init__.py

<interfaces>
RESEARCH.md "Deletion Inventory" (lines 627-694) explicitly identifies:

**Already-deleted modules (verify gone)** — me.py, data.py, signage_admin/tags.py, signage_admin/schedules.py.

**Surviving routers (KEEP):** hr_overtime.py, signage_admin/{playlists.py (DELETE only), playlist_items.py (bulk PUT only), devices.py (calibration only), resolved.py, analytics.py, media.py}, signage_pair.py, signage_player.py, uploads.py, kpis.py, hr_kpis.py, sensors.py, settings.py, sync.py.

**Schema orphan candidates** (RESEARCH.md lines 651-661):
- LIKELY ORPHANS (delete if no callers): SignageDeviceTagBase/Create/Read, ScheduleCreate/Update/Read, SignagePlaylistCreate, SignageDeviceUpdate/Base
- KEEP (still used): SignagePlaylistRead (player envelope), SignagePlaylistItemRead (bulk PUT response_model line 50), SignageMediaCreate/Read (media.py), SignageDeviceRead (calibration PATCH response_model line 55 + Phase 70 inlined logic lines 94-103)

**Test orphan candidates:** test_signage_hhmm.py (likely orphan), test_signage_admin_router.py (check refs), test_signage_router_deps.py (verify reflects current sub-router list), test_playlists_router_surface.py (verify DELETE-only state).

**Pitfall 7 (CRITICAL):** Do NOT delete `_notify_playlist_changed`, `_notify_device_self`, or any helper without first grep-confirming zero callers in surviving routers (playlists.py, playlist_items.py, devices.py, resolved.py, analytics.py, media.py, signage_pair.py, signage_player.py).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inventory + delete orphan schemas and tests; clean main.py registrations</name>
  <files>backend/app/main.py, backend/app/schemas/signage.py</files>
  <read_first>
    - backend/app/main.py (entire — verify only surviving routers registered)
    - backend/app/schemas/signage.py (entire 356 lines — schema-by-schema audit)
    - backend/app/routers/signage_admin/__init__.py (sub-router list)
    - backend/app/routers/signage_admin/playlists.py (verify response_model usage)
    - backend/app/routers/signage_admin/playlist_items.py (verify response_model usage)
    - backend/app/routers/signage_admin/devices.py (verify response_model usage)
    - backend/app/routers/signage_admin/media.py (verify response_model usage)
    - backend/app/routers/signage_player.py (verify SignagePlaylistRead usage in envelope)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Deletion Inventory lines 627-694, Pitfall 7)
  </read_first>
  <action>
    **Step 1 — Verify already-deleted modules are truly gone.** Run:
    ```bash
    ls backend/app/routers/me.py backend/app/routers/data.py \
       backend/app/routers/signage_admin/tags.py backend/app/routers/signage_admin/schedules.py 2>&1
    ```
    Expected: all return "No such file or directory". If any exist, delete them now: `rm <file>`.

    **Step 2 — Audit main.py for stale router imports/registrations.**

    Read `backend/app/main.py`. Check every `from app.routers ... import` and every `app.include_router(...)` call. The COMPLETE allowed set after sweep:

    Imports/registrations that MUST stay:
    - uploads, kpis, hr_kpis, settings, sync, sensors → core
    - hr_overtime → Phase 67 compute
    - signage_pair, signage_player → pairing + player SSE
    - signage_admin (the package router) → wraps analytics, media, playlists, playlist_items, devices, resolved

    Any `import` or `include_router` referring to `me`, `data`, `tags`, `schedules` (top-level signage admin tags/schedules) MUST be deleted. Also remove dead variables (e.g., `me_router = ...` lines).

    **Step 3 — Schema orphan audit in `backend/app/schemas/signage.py`.**

    For EACH schema class, run a usage grep across surviving code:
    ```bash
    grep -rln "<ClassName>" backend/app/routers backend/app/services backend/tests | grep -v __pycache__
    ```

    Decision rule for each schema:
    - 0 callers in surviving code → DELETE the class definition
    - >= 1 caller → KEEP

    Per RESEARCH.md flagged orphans, expected DELETE list (verify each via grep first):
    - `SignageDeviceTagBase`, `SignageDeviceTagCreate`, `SignageDeviceTagRead` (Phase 68 migrated tags)
    - `ScheduleCreate`, `ScheduleUpdate`, `ScheduleRead` (Phase 68 migrated schedules — but check Pydantic model registry first; if other modules `from app.schemas.signage import ScheduleRead`, fix or keep)
    - `SignagePlaylistCreate` (Phase 69 deleted POST)
    - `SignageDeviceUpdate`, `SignageDeviceBase` (Phase 70 deleted PATCH name)

    Per RESEARCH.md flagged KEEPS (do NOT delete; verify a caller exists):
    - `SignagePlaylistRead` — used by `signage_player.py` envelope
    - `SignagePlaylistItemRead` — used by `playlist_items.py` bulk PUT `response_model` (line 50)
    - `SignageMediaCreate`, `SignageMediaRead` — `media.py`
    - `SignageDeviceRead` — `devices.py` calibration PATCH `response_model` (line 55) + inlined Phase 70 logic (lines 94-103)

    For each schema deletion, also remove its import in any `__init__.py` re-export and update `from app.schemas.signage import (...)` blocks in remaining files (the IDE / TS compiler equivalent: `pytest --collect-only` will fail loudly on broken imports — use this as the safety net).

    **Step 4 — Test orphan audit.**

    For each test file flagged in RESEARCH.md (test_signage_hhmm.py, test_signage_admin_router.py, test_signage_router_deps.py, test_playlists_router_surface.py):

    1. Read the file
    2. Grep for the route paths it tests
    3. If ALL tested routes are deleted → `git rm <file>`
    4. If SOME tests target deleted routes but others target surviving routes → delete only the dead test cases (keep file)
    5. If tests need migration (e.g., a HHMM validator now lives only in Directus + Alembic CHECK), delete the FastAPI test (Directus validation hook test from Phase 68 covers it)

    **Step 5 — Helper preservation (Pitfall 7).**

    Do NOT delete `_notify_playlist_changed` (used by surviving DELETE in playlists.py per Phase 69-01 D-04b/D-05a) or `_notify_device_self` (Phase 70-02 D-03c — retained even without in-file caller; CONTEXT D-06c flags this for catch-all consideration but Phase 70 explicitly preserved it).

    For any other `_notify_*` or helper: grep for callers across `backend/app/routers/`, `backend/app/services/`, `backend/tests/`. If callers > 0 → KEEP. If callers == 0 → DELETE.

    **Step 6 — Run tests + collect to verify clean state.**
    ```bash
    cd backend && pytest --collect-only 2>&1 | tail -30
    cd backend && pytest -x 2>&1 | tail -30
    ```
    Both must succeed. Any ImportError or collection error means a deletion broke a survivor — restore the symbol or fix the caller.
  </action>
  <verify>
    <automated>cd backend && pytest --collect-only 2>&1 | grep -E "error|ERROR" | head -5; cd backend && pytest tests/ -x --ignore=tests/signage/test_pg_listen_sse.py 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `ls backend/app/routers/me.py backend/app/routers/data.py backend/app/routers/signage_admin/tags.py backend/app/routers/signage_admin/schedules.py 2>&1 | grep -c "No such file"` returns 4
    - `grep -E "^from app\\.routers.*import.*\\b(me|data|tags|schedules)\\b" backend/app/main.py` returns no matches (no orphan imports)
    - `grep -E "include_router.*\\b(me_router|data_router)\\b" backend/app/main.py` returns no matches
    - `grep -c "_notify_playlist_changed" backend/app/routers/signage_admin/playlists.py` returns >= 1 (Pitfall 7 preserved)
    - `grep -c "SignageDeviceTagRead\\|ScheduleRead\\|SignagePlaylistCreate\\|SignageDeviceUpdate" backend/app/schemas/signage.py` returns 0 (orphan schemas deleted) — OR if any KEEP, document why in plan SUMMARY
    - `grep -c "SignagePlaylistRead\\|SignagePlaylistItemRead\\|SignageMediaRead\\|SignageDeviceRead" backend/app/schemas/signage.py` returns >= 4 (RESEARCH.md flagged keeps preserved)
    - `cd backend && pytest --collect-only` exits 0 with no ImportError
    - `cd backend && pytest tests/ -x --ignore=tests/signage/test_pg_listen_sse.py` passes (excluding tests requiring docker stack)
  </acceptance_criteria>
  <done>main.py imports/includes only surviving routers; orphan schemas deleted; orphan test files removed; protected helpers (_notify_*) preserved; pytest collect clean.</done>
</task>

<task type="auto">
  <name>Task 2: Regenerate openapi_paths.json baseline post-sweep</name>
  <files>backend/tests/contracts/openapi_paths.json</files>
  <read_first>
    - backend/tests/contracts/openapi_paths.json (the baseline created in plan 71-04)
    - backend/tests/test_openapi_paths_snapshot.py (the regen mechanism)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (lines 670-693 — exact post-v1.22 surface)
  </read_first>
  <action>
    After Task 1 lands, the OpenAPI surface has shrunk further (any orphans removed). Regenerate the baseline:

    ```bash
    cd backend && UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py -x
    cd backend && pytest tests/test_openapi_paths_snapshot.py -x
    ```

    Inspect the regenerated `backend/tests/contracts/openapi_paths.json`. It MUST contain (sample — surface MUST match RESEARCH.md lines 670-693):
    - `/api/upload`, `/api/uploads`, `/api/uploads/{id}`
    - `/api/kpis*`, `/api/settings*`, `/api/sync*`, `/api/sensors*`
    - `/api/hr/kpis*`, `/api/data/employees/overtime`
    - `/api/signage/pair*`, `/api/signage/player/*`
    - `/api/signage/analytics/devices`, `/api/signage/media*`
    - `/api/signage/playlists/{id}` (DELETE only)
    - `/api/signage/playlists/{id}/items` (PUT only)
    - `/api/signage/devices/{id}/calibration` (PATCH only)
    - `/api/signage/resolved/{id}` (GET only)
    - `/health`

    It MUST NOT contain:
    - `/api/me`, `/api/data/sales`, `/api/data/employees` (without /overtime suffix)
    - `/api/signage/tags*`
    - `/api/signage/schedules*`
    - `/api/signage/playlists` (POST or PATCH /{id})
    - `/api/signage/devices` (PATCH /{id} non-calibration, DELETE /{id}, PUT /{id}/tags)

    If the baseline contains any of the MUST-NOT items, a deleted router is still being imported somewhere — go back to Task 1 step 2 and find the stray `include_router`.

    Verify via grep:
    ```bash
    grep -E "/api/(me|data/sales|data/employees\")|signage/(tags|schedules)|/api/signage/playlists\"|signage/devices/\\{[^}]+\\}\"" backend/tests/contracts/openapi_paths.json
    ```
    Expected: zero matches.
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_openapi_paths_snapshot.py -x -v && ! grep -E '"/api/me"|"/api/data/sales"|"/api/signage/tags"|"/api/signage/schedules"' tests/contracts/openapi_paths.json</automated>
  </verify>
  <acceptance_criteria>
    - `pytest tests/test_openapi_paths_snapshot.py -x` returns exit 0 (baseline matches actual surface)
    - `grep '"/api/me"' backend/tests/contracts/openapi_paths.json` returns no matches
    - `grep '"/api/data/sales"' backend/tests/contracts/openapi_paths.json` returns no matches
    - `grep '"/api/signage/tags"' backend/tests/contracts/openapi_paths.json` returns no matches
    - `grep '"/api/signage/schedules"' backend/tests/contracts/openapi_paths.json` returns no matches
    - `grep '"/api/signage/resolved/{device_id}"' backend/tests/contracts/openapi_paths.json` returns 1 match (Phase 70 NEW endpoint)
    - `grep '"/api/data/employees/overtime"' backend/tests/contracts/openapi_paths.json` returns 1 match (Phase 67 NEW endpoint)
    - `grep '"/api/signage/devices/{device_id}/calibration"' backend/tests/contracts/openapi_paths.json` returns 1 match
    - JSON file size < 5 KB
  </acceptance_criteria>
  <done>openapi_paths.json baseline accurately reflects post-sweep FastAPI surface; no deleted routes leak through; D-07 snapshot test green.</done>
</task>

</tasks>

<verification>
- pytest collect clean (no ImportError)
- Backend tests still pass (excluding docker-dependent SSE tests)
- OpenAPI baseline reflects only surviving surface
- Pitfall 7 helpers preserved
</verification>

<success_criteria>
CLEAN-01 (no orphaned imports) and CLEAN-02 (main.py clean + surface assertion green) both fully satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-05-SUMMARY.md`.
</output>
