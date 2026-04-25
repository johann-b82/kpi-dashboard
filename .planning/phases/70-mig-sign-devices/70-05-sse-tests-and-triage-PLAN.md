---
phase: 70-mig-sign-devices
plan: 05
type: execute
wave: 2
depends_on: ["70-01", "70-02"]
files_modified:
  - backend/tests/signage/test_pg_listen_sse.py
  - backend/tests/signage/test_admin_directus_crud_smoke.py
  - backend/tests/test_rbac.py
  - backend/tests/signage/test_permission_field_allowlists.py
autonomous: true
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "Directus updateItem('signage_devices', id, {name}) emits device-changed SSE within 500ms"
    - "Directus deleteItem('signage_devices', id) emits device-changed SSE within 500ms"
    - "signage_device_tag_map insert/delete emits device-changed SSE (NOT playlist-changed) within 1000ms"
    - "FastAPI calibration PATCH emits calibration-changed AND signage_devices LISTEN trigger does NOT fire"
    - "Admin Directus CRUD smoke for signage_devices passes (or xfail-strict-false if metadata gap)"
    - "Admin Directus CRUD smoke for signage_device_tag_map xfail(strict=False) per Phase 69 Plan 06 lesson"
    - "tests/test_rbac.py READ_ROUTES updated: migrated paths removed, /resolved/{id} added"
    - "test_permission_field_allowlists.py comments refreshed to reflect Phase 70 surface"
  artifacts:
    - path: "backend/tests/signage/test_pg_listen_sse.py"
      provides: "4 new device + tag-map + calibration regression cases"
      contains: "test_directus_device_name_update"
    - path: "backend/tests/signage/test_admin_directus_crud_smoke.py"
      provides: "Admin CRUD smoke for signage_devices + signage_device_tag_map"
      contains: "signage_device_tag_map"
    - path: "backend/tests/test_rbac.py"
      provides: "Updated READ_ROUTES per D-09"
      contains: "/api/signage/resolved/"
  key_links:
    - from: "backend/tests/signage/test_pg_listen_sse.py"
      to: "Phase 65 LISTEN bridge"
      via: "asyncpg notify subscription"
      pattern: "device-changed"
---

<objective>
Extend the SSE regression test harness with 4 device-related cases per D-07 (using the **research-corrected** event name `device-changed` for `signage_device_tag_map` per Pitfall 1, NOT CONTEXT D-03b's incorrect `playlist-changed`). Extend the admin Directus CRUD smoke test with `signage_devices` + `signage_device_tag_map` cases per D-11 (xfail-tolerant). Triage the existing route-level test surface: update RBAC `READ_ROUTES` per D-09, refresh comments in `test_permission_field_allowlists.py` per D-10. Existing device-route business tests (covered by `test_signage_device*.py` if any) get triaged per D-08.

Purpose: Locks SSE bridge regression for the migrated writers (ROADMAP success criterion #4) and updates the route-catalog tests so they reflect the post-Phase-70 surface.

Output: Test suite covers Directus-originated device + tag-map mutations, asserts no double-fire on calibration, updates RBAC catalog, and admin smoke marks composite-PK collection xfail-strict-false where needed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@backend/tests/signage/test_pg_listen_sse.py
@backend/tests/signage/test_admin_directus_crud_smoke.py
@backend/tests/test_rbac.py
@backend/tests/signage/test_permission_field_allowlists.py
@backend/app/services/signage_pg_listen.py

<interfaces>
<!-- LISTEN bridge event mapping (Pitfall 1 — research-corrected) -->
From backend/app/services/signage_pg_listen.py:82-88:
```python
elif table == "signage_devices":
    affected = [UUID(row_id)] if op != "DELETE" else []
    event = "device-changed"

elif table == "signage_device_tag_map":
    affected = await devices_affected_by_device_update(db, UUID(row_id))
    event = "device-changed"   # NOT playlist-changed (CONTEXT D-03b is wrong)
```

<!-- Existing test harness (Phase 65/68/69 pattern) -->
test_pg_listen_sse.py uses `open_sse_stream` + `next_frame` helpers (Phase 69 Plan 04 confirmed these are the canonical fixture API; do NOT invent wait_for_event/sse_subscription).

<!-- v1_22 trigger WHEN-gate (success criterion #4 infra) -->
backend/alembic/versions/v1_22_signage_notify_triggers.py line 128:
```sql
WHEN OLD.name IS DISTINCT FROM NEW.name
```
Calibration columns (rotation, hdmi_mode, audio_enabled, last_seen_at, revoked_at) are excluded from the trigger predicate — calibration-only updates do NOT fire signage_devices_update_notify.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: SSE regression tests for device + tag-map + calibration no-double-fire</name>
  <files>backend/tests/signage/test_pg_listen_sse.py</files>
  <read_first>
    - backend/tests/signage/test_pg_listen_sse.py (full current file — observe TABLE_EVENT_CASES table, open_sse_stream/next_frame fixture API, transient-row helpers, Phase 68/69 Directus-originated test patterns)
    - backend/app/services/signage_pg_listen.py (lines 82-90 — confirm device + tag-map event mapping)
    - backend/alembic/versions/v1_22_signage_notify_triggers.py (line 128 — WHEN-gate)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pitfall 1 — correct event name; Example 4 — test sketches)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-07 — five test cases)
  </read_first>
  <behavior>
    - Test 1 (device name update via Directus): create transient device → Directus updateItem name → assert `device-changed` event arrives within 500ms (test latency ceiling per D-07a)
    - Test 2 (device delete via Directus): create transient device → Directus deleteItem → assert `device-changed` event arrives within 500ms
    - Test 3 (device tag-map diff via Directus): create transient device + tag → insert tag-map row via Directus → assert AT LEAST ONE `device-changed` event arrives within 1000ms (D-03b multi-event tolerance — `device-changed`, NOT `playlist-changed`, per research Pitfall 1)
    - Test 4 (calibration no-double-fire): existing device → FastAPI PATCH /calibration → assert `calibration-changed` event arrives AND no `device-changed` event arrives within an extra 1500ms (proves the WHEN-gate excludes calibration columns; success criterion #4 infra-level invariant)
  </behavior>
  <action>
    Append four async test functions to `backend/tests/signage/test_pg_listen_sse.py`. Use the existing fixture API (`open_sse_stream`, `next_frame`, transient-row patterns from Phase 68/69 tests in the same file).

    **Test 1: `test_directus_device_name_update_emits_device_changed`**
    - Use the existing Directus admin client fixture (Phase 68/69 added one)
    - Create a transient device row via direct SQL fixture (or reuse `paired_device` fixture if applicable)
    - Open SSE stream for that device
    - Call `directus.request(updateItem('signage_devices', device_id, {'name': 'phase-70-rename-test'}))`
    - Assert next event with `event == 'device-changed'` within 500ms

    **Test 2: `test_directus_device_delete_emits_device_changed`**
    - Create a transient device with no FK references (no tag-map rows, no schedules pointing at any tag the device carries)
    - Open SSE stream
    - Call `directus.request(deleteItem('signage_devices', device_id))`
    - Assert next event with `event == 'device-changed'` within 500ms (op=DELETE branch)

    **Test 3: `test_directus_device_tag_map_emits_device_changed`** (NOT playlist-changed)
    - Create transient device + tag + bind device to a playlist via tag (so resolver fan-out finds the device)
    - Open SSE stream
    - Insert a row into signage_device_tag_map via Directus (createItem on the link table — note: Pitfall 5 / composite-PK; use createItems with body `{device_id, tag_id}`)
    - Assert AT LEAST ONE event arrives with `event == 'device-changed'` within 1000ms
    - Add a comment in the test body referencing research Pitfall 1: "CONTEXT D-03b incorrectly says playlist-changed; signage_pg_listen.py:86-88 maps signage_device_tag_map → device-changed."
    - If composite-PK Directus REST returns 403 (Pitfall 2 from Phase 69 Plan 06), mark `@pytest.mark.xfail(strict=False, reason="Phase 69 Plan 06 lesson: composite-PK collection metadata gap; deferred to Phase 71 CLEAN")`

    **Test 4: `test_calibration_patch_does_not_fire_device_changed`**
    - Create transient device
    - Open SSE stream
    - Call FastAPI PATCH `/api/signage/devices/{id}/calibration` with `{"rotation": 90}` using the admin auth fixture
    - Assert `event == 'calibration-changed'` arrives within 500ms
    - Assert NO subsequent `device-changed` event arrives within an additional 1500ms (use a timeout-with-default or `pytest.raises(asyncio.TimeoutError)` pattern from existing tests in the file)
    - Add a docstring referencing v1_22_signage_notify_triggers.py:128 WHEN-gate as the infra-level invariant

    Use the existing helper / fixture style from the Phase 68 + Phase 69 additions in the same file. Do NOT invent new fixtures — reuse `open_sse_stream`, `next_frame`, transient-row context managers, and the Directus admin client fixture as they exist.

    Where the existing file uses `pytestmark = pytest.mark.asyncio`, follow the same convention.

    All four new tests MUST run under pytest's default options without changing pytest.ini or conftest.py.
  </action>
  <acceptance_criteria>
    - `grep -c "test_directus_device_name_update_emits_device_changed" backend/tests/signage/test_pg_listen_sse.py` returns 1
    - `grep -c "test_directus_device_delete_emits_device_changed" backend/tests/signage/test_pg_listen_sse.py` returns 1
    - `grep -c "test_directus_device_tag_map_emits_device_changed" backend/tests/signage/test_pg_listen_sse.py` returns 1
    - `grep -c "test_calibration_patch_does_not_fire_device_changed" backend/tests/signage/test_pg_listen_sse.py` returns 1
    - `grep -c "playlist-changed" backend/tests/signage/test_pg_listen_sse.py` does NOT increase versus pre-edit count for the new tests (the new device-tag-map test asserts `device-changed`, not `playlist-changed`)
    - The four new tests pass (or test 3 marked xfail-strict-false): `cd backend && python -m pytest tests/signage/test_pg_listen_sse.py -k 'directus_device or calibration_patch_does_not_fire' -v` exits 0
    - File still passes its full suite: `cd backend && python -m pytest tests/signage/test_pg_listen_sse.py -v` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -m pytest tests/signage/test_pg_listen_sse.py -k 'directus_device or calibration_patch_does_not_fire' -v 2>&1 | tail -30</automated>
  </verify>
  <done>Four new SSE regression tests added; all use research-corrected device-changed event name for tag-map; calibration no-double-fire test pins success criterion #4; full SSE test file passes</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Admin Directus CRUD smoke for devices + device_tag_map</name>
  <files>backend/tests/signage/test_admin_directus_crud_smoke.py</files>
  <read_first>
    - backend/tests/signage/test_admin_directus_crud_smoke.py (full current file — Phase 68 Plan 08 + Phase 69 Plan 06 patterns)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-11 — extend smoke; xfail-strict-false on composite-PK)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pitfall 2 — composite-PK metadata gap)
  </read_first>
  <behavior>
    - Smoke 1 (signage_devices): admin token can readItems, updateItem, deleteItem on signage_devices via Directus REST. Asserts 200/204 status codes and post-write GET returns expected state.
    - Smoke 2 (signage_device_tag_map): admin token CRUD attempt on signage_device_tag_map. Marked xfail(strict=False) with reason "Phase 69 Plan 06 lesson: composite-PK collection metadata gap; deferred to Phase 71 CLEAN" — same root cause as Phase 69-06's signage_playlist_tag_map xfail.
  </behavior>
  <action>
    Append two test functions to `backend/tests/signage/test_admin_directus_crud_smoke.py` modeled on the Phase 69 Plan 06 additions (which extend the file with playlist + playlist_tag_map smokes).

    **Smoke 1: `test_admin_signage_devices_crud_smoke`**
    - Use the existing admin Directus client fixture
    - Read existing devices (or create a transient one if the test environment has none — match Phase 68 Plan 08's transient-playlist self-provisioning)
    - PATCH the device name via `updateItem('signage_devices', id, {name: 'smoke-test-rename'})`
    - GET the device and assert the new name
    - DELETE the device via `deleteItem('signage_devices', id)`
    - GET-after-DELETE: assert 403-or-404 (Directus avoids existence leak — Phase 68 Plan 08 pattern)

    **Smoke 2: `test_admin_signage_device_tag_map_crud_smoke`**
    - Mark with `@pytest.mark.xfail(strict=False, reason="Phase 69 Plan 06 lesson: composite-PK collection metadata-registration gap on signage_device_tag_map; deferred to Phase 71 CLEAN")`
    - Body: attempt readItems → createItems → deleteItems(filter form) on signage_device_tag_map using the admin client. If the metadata-registration gap is fixed in Directus 11.x.y at runtime, the test passes; otherwise it xfails silently.
    - Reference `signage_pg_listen.py:86-88` in a comment confirming that the LISTEN bridge fires `device-changed` (not playlist-changed) for tag-map mutations regardless of whether REST CRUD works through the metadata gap.
  </action>
  <acceptance_criteria>
    - `grep -c "test_admin_signage_devices_crud_smoke" backend/tests/signage/test_admin_directus_crud_smoke.py` returns 1
    - `grep -c "test_admin_signage_device_tag_map_crud_smoke" backend/tests/signage/test_admin_directus_crud_smoke.py` returns 1
    - `grep -c "xfail(strict=False" backend/tests/signage/test_admin_directus_crud_smoke.py` returns at least 2 (Phase 69 Plan 06's playlist_tag_map + this new device_tag_map)
    - `cd backend && python -m pytest tests/signage/test_admin_directus_crud_smoke.py -v` exits 0 (xfail tolerated)
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -m pytest tests/signage/test_admin_directus_crud_smoke.py -v 2>&1 | tail -20</automated>
  </verify>
  <done>Two admin smoke cases added; signage_devices passes, signage_device_tag_map xfails strict=False per documented composite-PK gap</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Update RBAC route catalog + permission allowlists comments</name>
  <files>backend/tests/test_rbac.py, backend/tests/signage/test_permission_field_allowlists.py</files>
  <read_first>
    - backend/tests/test_rbac.py (READ_ROUTES list — Phase 68 D-10 + Phase 69 D-07 pattern showed how to add/remove paths)
    - backend/tests/signage/test_permission_field_allowlists.py (Phase 68 + Phase 69 comment refresh pattern)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-09, D-10)
  </read_first>
  <action>
    **Step A — `backend/tests/test_rbac.py`:**

    Locate the `READ_ROUTES` list (or equivalent route catalog). Apply per D-09:
    1. REMOVE migrated read paths if present:
       - `GET /api/signage/devices` (list)
       - `GET /api/signage/devices/{id}` (by-id)
    2. ADD the new read path:
       - `GET /api/signage/resolved/{device_id}` (admin-gated; same RBAC class as the rest of signage_admin)

    Maintain the existing list ordering / format conventions of the file. If the catalog also tracks WRITE_ROUTES separately (PATCH/DELETE/PUT entries), remove the migrated PATCH /devices/{id} (name), DELETE /devices/{id}, PUT /devices/{id}/tags entries; keep PATCH /devices/{id}/calibration. Do NOT add resolved/{id} to write catalogs (it's read-only).

    **Step B — `backend/tests/signage/test_permission_field_allowlists.py`:**

    Refresh comments per D-10 (no behavioral change, no allowlist edits — Phase 65 AUTHZ rows untouched per D-00c). Add a one-line comment near the top of the file (after Phase 68 + Phase 69 comments):

    ```python
    # Phase 70 (MIG-SIGN-04) — devices CRUD migrated to Directus signage_devices
    # collection. PATCH /devices/{id}/calibration STAYS in FastAPI per D-00j.
    # No allowlist changes: admin uses admin_access:true bypass; Viewer has no
    # signage permissions per AUTHZ-02.
    ```

    If the file has a per-collection comment block, find the device section and append the same notice.
  </action>
  <acceptance_criteria>
    - `grep -c "/api/signage/resolved/" backend/tests/test_rbac.py` returns at least 1
    - `grep -E '"/api/signage/devices"' backend/tests/test_rbac.py | grep -v calibration | wc -l` shows the migrated paths removed (the only surviving `/api/signage/devices*` entry is the calibration PATCH and possibly analytics or other surviving routes)
    - `grep -c "Phase 70" backend/tests/signage/test_permission_field_allowlists.py` returns at least 1
    - `cd backend && python -m pytest tests/test_rbac.py -v` exits 0
    - `cd backend && python -m pytest tests/signage/test_permission_field_allowlists.py -v` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -m pytest tests/test_rbac.py tests/signage/test_permission_field_allowlists.py -v 2>&1 | tail -20</automated>
  </verify>
  <done>RBAC catalog reflects Phase 70 surface (migrated paths removed, /resolved/{id} added); allowlist comments refreshed; both test files pass</done>
</task>

</tasks>

<verification>
- All 4 SSE regression tests pass (or test 3 xfails-tolerant)
- Admin smoke for devices passes; device_tag_map xfails strict=False
- RBAC catalog updated (no migrated paths, /resolved/{id} added)
- Comment refresh in allowlists test
- Full backend test suite still green: `cd backend && python -m pytest tests/signage/ tests/test_rbac.py -v`
</verification>

<success_criteria>
- Calibration PATCH proven to NOT double-fire signage_devices LISTEN trigger (success criterion #4)
- Directus-originated device + tag-map mutations proven to fan out via SSE bridge (success criterion #4)
- Composite-PK metadata gap acknowledged via xfail(strict=False) per Phase 69 Plan 06 precedent
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-05-sse-tests-and-triage-SUMMARY.md`
</output>
