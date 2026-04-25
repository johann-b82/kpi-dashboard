---
phase: 68-mig-sign-tags-schedules
plan: 06
type: execute
wave: 2
depends_on: ["68-03"]
files_modified:
  - backend/tests/signage/test_pg_listen_sse.py
autonomous: true
requirements: [MIG-SIGN-01, MIG-SIGN-02]

must_haves:
  truths:
    - "A Directus REST mutation on signage_schedules (create / update / delete) delivers a schedule-changed SSE event to a connected device within 500 ms"
    - "Existing tag-map mutation cases (signage_playlist_tag_map → playlist-changed; signage_device_tag_map → device-changed) still pass — no regression introduced by the tag CRUD swap"
    - "signage_device_tags CRUD does NOT fire SSE (no trigger on this table per Phase 65 SSE-01) — documented as expected, not a bug"
  artifacts:
    - path: "backend/tests/signage/test_pg_listen_sse.py"
      provides: "Directus-originated schedule + tag-map SSE regression cases"
      contains: "schedule-changed"
  key_links:
    - from: "Directus REST POST /items/signage_schedules"
      to: "Pi player schedule-changed SSE event"
      via: "Phase 65 trigger → pg_notify → asyncpg listener → notify_device"
      pattern: "schedule-changed.*<500ms"
    - from: "Directus REST POST /items/signage_playlist_tag_map"
      to: "Pi player playlist-changed SSE"
      via: "Phase 65 bridge"
      pattern: "playlist-changed"
---

<objective>
Extend `backend/tests/signage/test_pg_listen_sse.py` with regression cases ensuring the Phase-65 LISTEN/NOTIFY bridge fires the correct SSE events on Directus-originated mutations against `signage_schedules` (create/update/delete) and the tag-map tables (per D-09). This is the safety net that proves Plan 03's deletion of `_fanout_schedule_changed` did not break SSE delivery.

Purpose: MIG-SIGN-01 + MIG-SIGN-02 success criterion 3 — Directus mutations fan out within 500 ms.

Output: Extended test file with 3 new test cases (schedule create / update / delete via Directus) plus tag-map regression assertions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@backend/tests/signage/test_pg_listen_sse.py
@backend/app/services/signage_pg_listen.py

<interfaces>
Existing test file already has the harness:
- `TABLE_EVENT_CASES` (line 50) — parametrized list of `(table, expected_event)` pairs. Already includes `("signage_schedules", "schedule-changed")` and `("signage_playlist_tag_map", "playlist-changed")` and `("signage_device_tag_map", "device-changed")`. The existing parametrized SSE-04 test uses these, so the schedule + tag-map regression is ALREADY WIRED via Phase 65 — confirm by reading the test that consumes `TABLE_EVENT_CASES`.
- `directus_admin_token` fixture (line 79) provides Admin REST access.
- Existing tag mutation helpers at lines 122-124, 248 use `signage_device_tags` (not `signage_tags`).

Per D-09 the regression coverage required is:
1. Schedule create/update/delete via Directus → schedule-changed SSE — already covered by the existing parametrized SSE-04 test for `signage_schedules`. ADD an explicit test that exercises all three operations sequentially against a single device, asserting each delivers within 500 ms.
2. Tag-map mutations via Directus → playlist-changed / device-changed — covered by parametrized SSE-04. ADD a "no regression after FastAPI tag/schedule routes deleted" sanity case that confirms the listener still resolves devices correctly.
3. signage_device_tags CRUD itself fires NO SSE (Phase 65 has no trigger on this table) — add a negative-assertion test: create + update + delete a tag via Directus, verify NO event arrives within a 1-second window.

Phase 65 D-17 locked the latency budget at <500 ms hard ceiling.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Directus-originated schedule mutation regression test</name>
  <files>backend/tests/signage/test_pg_listen_sse.py</files>
  <read_first>
    - backend/tests/signage/test_pg_listen_sse.py (full file — focus on `TABLE_EVENT_CASES`, fixture pattern, existing SSE-04 test)
    - backend/app/services/signage_pg_listen.py
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-09)
    - backend/alembic/versions/v1_22_signage_notify_triggers.py
  </read_first>
  <behavior>
    - Test `test_directus_schedule_create_fires_sse_within_500ms`: POST a new schedule via Directus REST `/items/signage_schedules` (Admin token); assert the connected device receives a `schedule-changed` SSE event within 500 ms.
    - Test `test_directus_schedule_update_fires_sse_within_500ms`: PATCH the schedule's `priority`; assert the same event class arrives within 500 ms.
    - Test `test_directus_schedule_delete_fires_sse_within_500ms`: DELETE the schedule; assert event arrives.
    - Test `test_directus_tag_map_mutation_still_fires_sse_after_phase68`: POST/DELETE a `signage_playlist_tag_map` row via Directus; assert `playlist-changed` arrives — confirming Plan 01/03 deletions did not break the bridge.
    - Test `test_directus_signage_device_tags_fires_no_sse`: create / update / delete a tag in `signage_device_tags`; assert NO SSE arrives in a 1-second window (negative — Phase 65 has no trigger on this table per D-05).
  </behavior>
  <action>
    1. Open `backend/tests/signage/test_pg_listen_sse.py`. Identify the existing parametrized SSE-04 test that consumes `TABLE_EVENT_CASES` and the SSE subscription helper / device fixture. Reuse them.
    2. Add a new module-level test function that creates a fresh schedule via Directus, then PATCHes it, then DELETEs it — measuring SSE latency for each:
       ```python
       async def test_directus_schedule_lifecycle_fires_sse_each_step(
           directus_admin_token, paired_device, sse_subscription,
       ):
           """Phase 68 D-09: schedule create/update/delete via Directus each fire schedule-changed within 500 ms."""
           # 1. CREATE
           t0 = time.monotonic()
           async with httpx.AsyncClient(...) as c:
               r = await c.post(
                   f"{DIRECTUS_BASE_URL}/items/signage_schedules",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={
                       "playlist_id": paired_device.playlist_id,
                       "weekday_mask": 127,
                       "start_hhmm": 540,
                       "end_hhmm": 1080,
                       "priority": 50,
                       "enabled": True,
                   },
               )
               assert r.status_code in (200, 201), r.text
               schedule_id = r.json()["data"]["id"]
           ev = await wait_for_event(sse_subscription, "schedule-changed", timeout=SSE_TIMEOUT_S)
           latency_ms = (time.monotonic() - t0) * 1000
           assert latency_ms < SSE_TIMEOUT_MS, f"create latency {latency_ms:.0f}ms > {SSE_TIMEOUT_MS}ms"

           # 2. UPDATE (priority change)
           t0 = time.monotonic()
           async with httpx.AsyncClient(...) as c:
               r = await c.patch(
                   f"{DIRECTUS_BASE_URL}/items/signage_schedules/{schedule_id}",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"priority": 80},
               )
               assert r.status_code == 200, r.text
           ev = await wait_for_event(sse_subscription, "schedule-changed", timeout=SSE_TIMEOUT_S)
           assert (time.monotonic() - t0) * 1000 < SSE_TIMEOUT_MS

           # 3. DELETE
           t0 = time.monotonic()
           async with httpx.AsyncClient(...) as c:
               r = await c.delete(
                   f"{DIRECTUS_BASE_URL}/items/signage_schedules/{schedule_id}",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
               )
               assert r.status_code == 204, r.text
           ev = await wait_for_event(sse_subscription, "schedule-changed", timeout=SSE_TIMEOUT_S)
           assert (time.monotonic() - t0) * 1000 < SSE_TIMEOUT_MS
       ```
       Adapt to the existing fixture and helper names in the file (read it first; do not rename).
    3. Add the device-tags negative test:
       ```python
       async def test_directus_signage_device_tags_fires_no_sse(
           directus_admin_token, paired_device, sse_subscription,
       ):
           """Phase 68 D-05: signage_device_tags has no LISTEN trigger; CRUD must NOT emit SSE."""
           tag_id = 999_001
           async with httpx.AsyncClient(...) as c:
               # CREATE
               r = await c.post(
                   f"{DIRECTUS_BASE_URL}/items/signage_device_tags",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"id": tag_id, "name": f"phase68-noevent-{int(time.time())}"},
               )
               assert r.status_code in (200, 201), r.text
               # UPDATE
               await c.patch(
                   f"{DIRECTUS_BASE_URL}/items/signage_device_tags/{tag_id}",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"name": f"phase68-renamed-{int(time.time())}"},
               )
               # DELETE
               await c.delete(
                   f"{DIRECTUS_BASE_URL}/items/signage_device_tags/{tag_id}",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
               )
           # Wait the negative window — assert NOTHING arrives.
           with pytest.raises(asyncio.TimeoutError):
               await wait_for_any_event(sse_subscription, timeout=1.0)
       ```
       If `wait_for_any_event` does not exist, add a small helper that returns the next event or raises TimeoutError. Mirror the existing helper signatures in this file.
    4. Run the test (requires `docker compose up -d` per the file's docstring): `cd backend && pytest tests/signage/test_pg_listen_sse.py::test_directus_schedule_lifecycle_fires_sse_each_step tests/signage/test_pg_listen_sse.py::test_directus_signage_device_tags_fires_no_sse -v`.
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_pg_listen_sse.py -v -k "schedule_lifecycle or signage_device_tags_fires_no_sse"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "test_directus_schedule_lifecycle_fires_sse_each_step" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - `grep -n "test_directus_signage_device_tags_fires_no_sse" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - With docker compose stack up, `pytest tests/signage/test_pg_listen_sse.py -v` exits 0; the new tests pass with measured latency lines printed.
    - The negative test for `signage_device_tags` confirms NO SSE within 1 s — no false-positive trigger leak.
  </acceptance_criteria>
  <done>Three Directus-originated schedule lifecycle steps + tag-CRUD negative test pass under <500 ms.</done>
</task>

</tasks>

<verification>
- `cd backend && pytest tests/signage/test_pg_listen_sse.py -v` exits 0 (all existing + new cases).
- All three schedule mutation steps clear the 500 ms ceiling per D-17.
- Negative test confirms `signage_device_tags` CRUD is silent.
</verification>

<success_criteria>
Phase 65 LISTEN bridge proven still correct after Plan 03 helper deletion. Tag CRUD silence is documented as expected (D-05). Schedule fan-out works for all three Directus operations.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-06-SUMMARY.md` capturing: new tests added, measured latencies, confirmation that the parametrized SSE-04 cases for `signage_schedules`, `signage_playlist_tag_map`, `signage_device_tag_map` still pass.
</output>
