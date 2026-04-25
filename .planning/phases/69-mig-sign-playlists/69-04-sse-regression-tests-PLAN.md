---
phase: 69-mig-sign-playlists
plan: 04
type: execute
wave: 2
depends_on: ["69-01", "69-02"]
files_modified:
  - backend/tests/signage/test_pg_listen_sse.py
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "Directus createItem/updateItem on signage_playlists fires playlist-changed SSE within 500 ms (D-05)"
    - "Directus diff path on signage_playlist_tag_map (deleteItems + createItems per D-02) delivers at least one playlist-changed SSE within 500 ms (D-05 — at-least-once, NOT exactly-once per D-02b)"
    - "FastAPI DELETE /api/signage/playlists/{id} still fires playlist-changed SSE — regression-only assertion confirms _notify_playlist_changed helper is still wired"
    - "FastAPI bulk PUT /api/signage/playlists/{id}/items still fires playlist-changed SSE — regression-only assertion"
  artifacts:
    - path: "backend/tests/signage/test_pg_listen_sse.py"
      provides: "Directus + FastAPI playlist SSE regression cases"
      contains: "test_directus_playlist_lifecycle_fires_sse"
  key_links:
    - from: "Directus REST POST/PATCH /items/signage_playlists"
      to: "Pi player playlist-changed SSE"
      via: "Phase 65 trigger → pg_notify → asyncpg listener → notify_device"
      pattern: "playlist-changed.*<500ms"
    - from: "Directus tag-map diff (delete+create)"
      to: "Pi player playlist-changed SSE"
      via: "Phase 65 trigger on signage_playlist_tag_map"
      pattern: "at_least_once"
---

<objective>
Extend `backend/tests/signage/test_pg_listen_sse.py` with regression cases proving the Phase-65 LISTEN/NOTIFY bridge fires `playlist-changed` SSE on Directus-originated mutations to `signage_playlists` (create/update) and `signage_playlist_tag_map` (the D-02 diff path), AND that the surviving FastAPI DELETE + bulk-PUT-items routes still fire `playlist-changed` after the Plan 69-01/02 trims.

Per D-02b + D-05, the tag-map diff produces multiple events; assert at-least-once, NOT exactly-once. Mirrors Phase 68 Plan 06 pattern.

Output: Extended test file with 3 new tests (Directus playlist lifecycle, Directus tag-map diff, FastAPI DELETE + bulk-PUT regression).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-06-sse-regression-tests-PLAN.md
@backend/tests/signage/test_pg_listen_sse.py
@backend/app/services/signage_pg_listen.py

<interfaces>
Existing test file already provides:
- `TABLE_EVENT_CASES` parametrized list (Phase 68 Plan 06) — already includes `("signage_playlists", "playlist-changed")` and `("signage_playlist_items", "playlist-changed")` and `("signage_playlist_tag_map", "playlist-changed")`. The parametrized SSE-04 test covers the bridge wiring per-table. This plan adds *operation-specific* regression tests on top of that baseline.
- `directus_admin_token` fixture (Phase 68 Plan 06 line 79).
- `paired_device` fixture and `sse_subscription` fixture used by existing schedule lifecycle tests (Phase 68 Plan 06).
- `wait_for_event(sub, event_name, timeout)` and `wait_for_any_event(sub, timeout)` helpers (added Phase 68 Plan 06).
- `SSE_TIMEOUT_S` / `SSE_TIMEOUT_MS` constants — Phase 65 D-17 hard ceiling 500 ms.

D-05 cases to add:
1. `test_directus_playlist_create_fires_sse_within_500ms` — POST `/items/signage_playlists` body `{name, priority: 0, enabled: true}` → assert `playlist-changed` arrives within 500 ms.
2. `test_directus_playlist_update_fires_sse_within_500ms` — PATCH `/items/signage_playlists/{id}` body `{name: "renamed"}` → assert event within 500 ms.
3. `test_directus_playlist_tag_map_diff_fires_sse_at_least_once` — exercise the D-02 diff: DELETE one map row + CREATE one map row via Directus REST (using `deleteItems` and `createItems` semantics — REST is `/items/signage_playlist_tag_map?filter=...` for delete or `/items/signage_playlist_tag_map` POST array for create) → assert at least one `playlist-changed` arrives within 1 s. Do NOT assert exactly-once (per D-02b).
4. `test_fastapi_playlist_delete_still_fires_sse` — issue `DELETE /api/signage/playlists/{id}` via the existing FastAPI test client (Admin JWT) on a transient playlist → assert `playlist-changed` arrives within 500 ms (proves `_notify_playlist_changed` helper retention from Plan 69-01).
5. `test_fastapi_bulk_replace_items_still_fires_sse` — issue `PUT /api/signage/playlists/{id}/items` body `{items: [...]}` via FastAPI test client on a transient playlist → assert `playlist-changed` arrives within 500 ms (proves Plan 69-02 helper retention).

Schedule fixture pattern: tests POST a playlist via Directus to set up state (avoids depending on data lifecycle elsewhere), then exercise mutations, then clean up.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Directus-originated playlist + tag-map SSE regression tests</name>
  <files>backend/tests/signage/test_pg_listen_sse.py</files>
  <read_first>
    - backend/tests/signage/test_pg_listen_sse.py (full file — confirm fixture names, helpers, constants)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-02b, D-05)
    - .planning/phases/68-mig-sign-tags-schedules/68-06-sse-regression-tests-PLAN.md (precedent code shape)
  </read_first>
  <behavior>
    - Three new Directus-originated tests pass with measured latency < 500 ms (create + update; tag-map diff allows up to 1 s for at-least-once delivery).
    - Tag-map diff test uses Directus REST endpoints: delete via `DELETE /items/signage_playlist_tag_map?filter[id][_in]=...` (or per-id loop) and create via `POST /items/signage_playlist_tag_map` body array.
    - All new tests clean up created rows in a `try/finally` so re-runs are idempotent.
  </behavior>
  <action>
    1. Open `backend/tests/signage/test_pg_listen_sse.py`. Confirm by reading: fixture names (`directus_admin_token`, `paired_device`, `sse_subscription`), helper signatures (`wait_for_event`, `wait_for_any_event`), and timeout constants (`SSE_TIMEOUT_S`, `SSE_TIMEOUT_MS`). Match these names exactly in new code.
    2. Add `test_directus_playlist_lifecycle_fires_sse_each_step` (modelled on Phase 68 Plan 06 schedule lifecycle test):
       ```python
       async def test_directus_playlist_lifecycle_fires_sse_each_step(
           directus_admin_token, paired_device, sse_subscription,
       ):
           """Phase 69 D-05: Directus create + update on signage_playlists each fire playlist-changed within 500 ms."""
           async with httpx.AsyncClient(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               # 1. CREATE
               t0 = time.monotonic()
               r = await c.post(
                   "/items/signage_playlists",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={
                       "name": f"phase69-sse-{int(time.time() * 1000)}",
                       "description": None,
                       "priority": 0,
                       "enabled": True,
                   },
               )
               assert r.status_code in (200, 201), r.text
               playlist_id = r.json()["data"]["id"]
               try:
                   await wait_for_event(sse_subscription, "playlist-changed", timeout=SSE_TIMEOUT_S)
                   assert (time.monotonic() - t0) * 1000 < SSE_TIMEOUT_MS

                   # 2. UPDATE (name change)
                   t0 = time.monotonic()
                   r = await c.patch(
                       f"/items/signage_playlists/{playlist_id}",
                       headers={"Authorization": f"Bearer {directus_admin_token}"},
                       json={"name": f"phase69-sse-renamed-{int(time.time() * 1000)}"},
                   )
                   assert r.status_code == 200, r.text
                   await wait_for_event(sse_subscription, "playlist-changed", timeout=SSE_TIMEOUT_S)
                   assert (time.monotonic() - t0) * 1000 < SSE_TIMEOUT_MS
               finally:
                   await c.delete(
                       f"/items/signage_playlists/{playlist_id}",
                       headers={"Authorization": f"Bearer {directus_admin_token}"},
                   )
       ```
    3. Add `test_directus_playlist_tag_map_diff_fires_sse_at_least_once`:
       ```python
       async def test_directus_playlist_tag_map_diff_fires_sse_at_least_once(
           directus_admin_token, paired_device, sse_subscription,
       ):
           """Phase 69 D-02b/D-05: tag-map diff (delete + create) fires >=1 playlist-changed within 1 s; multi-event tolerated."""
           async with httpx.AsyncClient(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               # Setup: create transient playlist + one transient tag.
               r = await c.post(
                   "/items/signage_playlists",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"name": f"phase69-tagdiff-{int(time.time()*1000)}", "priority": 0, "enabled": True},
               )
               assert r.status_code in (200, 201), r.text
               playlist_id = r.json()["data"]["id"]
               r = await c.post(
                   "/items/signage_device_tags",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"name": f"phase69-tag-{int(time.time()*1000)}"},
               )
               assert r.status_code in (200, 201), r.text
               tag_id = r.json()["data"]["id"]
               # Insert initial map row so the diff has something to delete.
               r = await c.post(
                   "/items/signage_playlist_tag_map",
                   headers={"Authorization": f"Bearer {directus_admin_token}"},
                   json={"playlist_id": playlist_id, "tag_id": tag_id},
               )
               assert r.status_code in (200, 201), r.text
               map_row_id = r.json()["data"]["id"]
               # Drain any pending events from setup before measuring the diff.
               await drain_events(sse_subscription, settle_ms=200)

               try:
                   t0 = time.monotonic()
                   # Diff: delete the existing map row + create a new one.
                   await asyncio.gather(
                       c.delete(
                           f"/items/signage_playlist_tag_map/{map_row_id}",
                           headers={"Authorization": f"Bearer {directus_admin_token}"},
                       ),
                       # Re-add by creating a fresh row referencing the same tag.
                       c.post(
                           "/items/signage_playlist_tag_map",
                           headers={"Authorization": f"Bearer {directus_admin_token}"},
                           json={"playlist_id": playlist_id, "tag_id": tag_id},
                       ),
                   )
                   ev = await wait_for_event(sse_subscription, "playlist-changed", timeout=1.0)
                   assert ev is not None
                   # Multi-event tolerated; assert latency on first event only.
                   assert (time.monotonic() - t0) * 1000 < 1000
               finally:
                   # Clean up: delete remaining map rows, tag, playlist.
                   await c.delete(
                       f"/items/signage_playlist_tag_map?filter[playlist_id][_eq]={playlist_id}",
                       headers={"Authorization": f"Bearer {directus_admin_token}"},
                   )
                   await c.delete(f"/items/signage_device_tags/{tag_id}", headers={"Authorization": f"Bearer {directus_admin_token}"})
                   await c.delete(f"/items/signage_playlists/{playlist_id}", headers={"Authorization": f"Bearer {directus_admin_token}"})
       ```
       If `drain_events` does not exist as a helper, add a small one:
       ```python
       async def drain_events(sub, settle_ms: int = 200) -> None:
           """Consume any queued SSE events until the stream is quiet for `settle_ms`."""
           import asyncio
           while True:
               try:
                   await asyncio.wait_for(sub.next_event(), timeout=settle_ms / 1000)
               except asyncio.TimeoutError:
                   return
       ```
       Adapt to whatever helper API the existing test file uses (read it; do not invent a different API).
    4. Add `test_fastapi_playlist_delete_still_fires_sse` and `test_fastapi_bulk_replace_items_still_fires_sse` — use the existing FastAPI test client pattern (Admin JWT, `httpx.AsyncClient` against ASGI app) already present in the file. Each test:
       - Creates a transient playlist via Directus REST.
       - For DELETE: issues `DELETE /api/signage/playlists/{id}` with Admin JWT; asserts `playlist-changed` within 500 ms.
       - For bulk-PUT: issues `PUT /api/signage/playlists/{id}/items` with Admin JWT, body `{"items": []}` (empty replace is a valid atomic operation per Plan 69-02); asserts `playlist-changed` within 500 ms.
       Both tests clean up in `try/finally`.
    5. Run: `cd backend && pytest tests/signage/test_pg_listen_sse.py -v -k "playlist_lifecycle or playlist_tag_map_diff or fastapi_playlist_delete or fastapi_bulk_replace_items"`.
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_pg_listen_sse.py -v -k "playlist_lifecycle or playlist_tag_map_diff or fastapi_playlist_delete or fastapi_bulk_replace_items"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "test_directus_playlist_lifecycle_fires_sse_each_step" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - `grep -n "test_directus_playlist_tag_map_diff_fires_sse_at_least_once" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - `grep -n "test_fastapi_playlist_delete_still_fires_sse" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - `grep -n "test_fastapi_bulk_replace_items_still_fires_sse" backend/tests/signage/test_pg_listen_sse.py` exits 0.
    - With docker compose stack up, the 4 new tests pass; latencies for create/update/delete/bulk-PUT print < 500 ms; tag-map diff prints < 1000 ms.
    - The full file `pytest tests/signage/test_pg_listen_sse.py -v` exits 0 — no regression of existing Phase 65/68 cases.
  </acceptance_criteria>
  <done>4 new SSE regression tests added covering Directus playlist + tag-map diff and FastAPI DELETE + bulk-PUT regression; all pass with measured latencies inside D-17 ceiling.</done>
</task>

</tasks>

<verification>
- `cd backend && pytest tests/signage/test_pg_listen_sse.py -v` exits 0 (all existing + new cases).
- Directus playlist create/update each clear 500 ms; tag-map diff delivers at least one event inside 1 s.
- FastAPI DELETE + bulk-PUT regressions confirm helper retention from Plans 69-01/02 is wired.
</verification>

<success_criteria>
Phase 65 LISTEN bridge proven still correct after Plan 69-01/02 trims. Tag-map diff D-02b at-least-once contract documented as test. Both writers (Directus + FastAPI) deliver SSE end-to-end.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-04-SUMMARY.md` capturing: new tests added, measured latencies, and confirmation that existing parametrized SSE-04 cases for `signage_playlists` / `signage_playlist_items` / `signage_playlist_tag_map` still pass.
</output>
