---
phase: 69-mig-sign-playlists
plan: 06
type: execute
wave: 2
depends_on: ["69-01", "69-02"]
files_modified:
  - backend/tests/signage/test_admin_directus_crud_smoke.py
  - backend/tests/signage/test_permission_field_allowlists.py
  - backend/tests/test_rbac.py
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "Admin Directus JWT can POST/PATCH/DELETE on signage_playlists via Directus REST (D-09 confirms admin_access: true bet for the new collection)"
    - "Admin Directus JWT can POST/DELETE on signage_playlist_tag_map (no PATCH — it's a join table, mutations are insert/delete only)"
    - "Comments in test_permission_field_allowlists.py refresh to mention Phase 69 / playlists migrated state (D-08)"
    - "READ_ROUTES in test_rbac.py contains no migrated playlist paths (D-07)"
  artifacts:
    - path: "backend/tests/signage/test_admin_directus_crud_smoke.py"
      provides: "Extended Admin CRUD smoke for signage_playlists + signage_playlist_tag_map"
      contains: "signage_playlists"
  key_links:
    - from: "Admin Directus JWT"
      to: "signage_playlists + signage_playlist_tag_map collections"
      via: "REST POST/PATCH/DELETE"
      pattern: "admin_access: true"
---

<objective>
Three test-tier hygiene tasks bundled per D-06/D-07/D-08/D-09:
1. Extend `test_admin_directus_crud_smoke.py` (Phase 68 Plan 08 file) with cases for `signage_playlists` + `signage_playlist_tag_map` per D-09 — confirm the Phase 68 admin_access bet still holds for the new collections.
2. Triage `test_rbac.py` READ_ROUTES per D-07 — remove any `GET /playlists` / `GET /playlists/{id}` / `GET /playlists/{id}/items` entries (verified by Read: none currently present, so this reduces to a no-op confirmation; document in SUMMARY).
3. Refresh comments in `test_permission_field_allowlists.py` per D-08 — update any docstring/comment referring to migrated FastAPI playlist routes.

Mirrors Phase 68 Plan 08 pattern.

Output: One extended test file (~80 LOC added) + comment refresh + rbac confirmation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/68-mig-sign-tags-schedules/68-08-admin-permission-smoke-PLAN.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@backend/tests/signage/test_admin_directus_crud_smoke.py
@backend/tests/signage/test_permission_field_allowlists.py
@backend/tests/test_rbac.py
@directus/bootstrap-roles.sh

<interfaces>
Existing `test_admin_directus_crud_smoke.py` (Phase 68 Plan 08) already contains:
- `directus_admin_token` session-scoped fixture
- `_hdr(t)` helper
- `test_admin_can_crud_signage_device_tags`
- `test_admin_can_crud_signage_schedules`

Add for Phase 69:
- `test_admin_can_crud_signage_playlists`: POST a playlist with `{name, priority, enabled}` → PATCH `{name}` → DELETE → GET returns 404. All steps return 2xx (200/201/204).
- `test_admin_can_crud_signage_playlist_tag_map`: requires existing playlist + tag. Reuse the helper to create a transient playlist + transient tag, then POST a map row, DELETE the map row by id (no PATCH on join table per typical Directus join patterns; if the collection accepts PATCH on a non-PK field, skip — there are no non-PK columns to patch on a 2-FK join table).

D-08 fallback (carry-over from Phase 68 Plan 08): if any 401/403 surfaces, document the gap and add explicit Admin permission rows in `directus/bootstrap-roles.sh §6`. The Phase 68 Plan 08 SUMMARY already confirmed admin_access: true CRUD works for tags + schedules; expectation is the bet holds for `signage_playlists` + `signage_playlist_tag_map` too.

D-07: `backend/tests/test_rbac.py` READ_ROUTES — verified by Read of lines 15-27: contains NO `/playlists` paths (`/api/kpis`, `/api/hr/kpis`, `/api/data/employees/overtime`, `/api/settings`, `/api/uploads`, `/api/sync/meta` only). The D-07 task therefore reduces to a documented no-op: confirm absence with grep and record in SUMMARY.

D-08: `test_permission_field_allowlists.py` — existing comments may reference the FastAPI playlist routes that no longer exist. Refresh to mention Phase 69 migration. Pure docstring/comment edit; no assertion change.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend test_admin_directus_crud_smoke.py with playlist + tag-map cases</name>
  <files>backend/tests/signage/test_admin_directus_crud_smoke.py</files>
  <read_first>
    - backend/tests/signage/test_admin_directus_crud_smoke.py (full file — confirm existing fixture/helper names)
    - .planning/phases/68-mig-sign-tags-schedules/68-08-admin-permission-smoke-PLAN.md (precedent)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-09)
    - directus/bootstrap-roles.sh (Admin role; verify admin_access: true unchanged)
  </read_first>
  <behavior>
    - `test_admin_can_crud_signage_playlists`: POST `{name, priority: 0, enabled: true}` → returns 200/201 with id; PATCH `{name: "renamed"}` → 200; DELETE → 204; subsequent GET → 404.
    - `test_admin_can_crud_signage_playlist_tag_map`: setup transient playlist + tag; POST map row `{playlist_id, tag_id}` → 200/201 with id; DELETE map row by id → 204; subsequent GET → 404; cleanup deletes playlist + tag.
    - All assertion messages reference "D-08 fallback?" so a 401/403 is unambiguous in CI logs.
  </behavior>
  <action>
    1. Append two new test functions to `backend/tests/signage/test_admin_directus_crud_smoke.py`. Reuse the existing `directus_admin_token` fixture, `_hdr` helper, and `DIRECTUS_BASE_URL` constant.
    2. Test 1:
       ```python
       def test_admin_can_crud_signage_playlists(directus_admin_token: str) -> None:
           """Phase 69 D-09: Admin can CRUD signage_playlists via Directus REST."""
           name_a = f"phase69-pl-{int(time.time() * 1000)}"
           name_b = f"{name_a}-renamed"
           with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               r = c.post(
                   "/items/signage_playlists",
                   headers=_hdr(directus_admin_token),
                   json={"name": name_a, "priority": 0, "enabled": True},
               )
               assert r.status_code in (200, 201), f"create failed (D-08 fallback?): {r.status_code} {r.text}"
               playlist_id = r.json()["data"]["id"]

               r = c.patch(
                   f"/items/signage_playlists/{playlist_id}",
                   headers=_hdr(directus_admin_token),
                   json={"name": name_b},
               )
               assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"

               r = c.delete(
                   f"/items/signage_playlists/{playlist_id}",
                   headers=_hdr(directus_admin_token),
               )
               assert r.status_code == 204, f"delete failed: {r.status_code} {r.text}"

               r = c.get(
                   f"/items/signage_playlists/{playlist_id}",
                   headers=_hdr(directus_admin_token),
               )
               assert r.status_code == 404, f"row should be gone: {r.status_code}"
       ```
    3. Test 2:
       ```python
       def test_admin_can_crud_signage_playlist_tag_map(directus_admin_token: str) -> None:
           """Phase 69 D-09: Admin can insert/delete signage_playlist_tag_map join rows via Directus REST."""
           with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               # Setup: transient playlist + transient tag.
               r = c.post(
                   "/items/signage_playlists",
                   headers=_hdr(directus_admin_token),
                   json={"name": f"phase69-tagmap-pl-{int(time.time()*1000)}", "priority": 0, "enabled": True},
               )
               assert r.status_code in (200, 201), f"setup playlist failed: {r.status_code} {r.text}"
               playlist_id = r.json()["data"]["id"]
               r = c.post(
                   "/items/signage_device_tags",
                   headers=_hdr(directus_admin_token),
                   json={"name": f"phase69-tagmap-tag-{int(time.time()*1000)}"},
               )
               assert r.status_code in (200, 201), f"setup tag failed: {r.status_code} {r.text}"
               tag_id = r.json()["data"]["id"]
               try:
                   # Insert map row.
                   r = c.post(
                       "/items/signage_playlist_tag_map",
                       headers=_hdr(directus_admin_token),
                       json={"playlist_id": playlist_id, "tag_id": tag_id},
                   )
                   assert r.status_code in (200, 201), f"map create failed (D-08 fallback?): {r.status_code} {r.text}"
                   map_row_id = r.json()["data"]["id"]
                   # Delete map row.
                   r = c.delete(
                       f"/items/signage_playlist_tag_map/{map_row_id}",
                       headers=_hdr(directus_admin_token),
                   )
                   assert r.status_code == 204, f"map delete failed: {r.status_code} {r.text}"
                   # Confirm gone.
                   r = c.get(
                       f"/items/signage_playlist_tag_map/{map_row_id}",
                       headers=_hdr(directus_admin_token),
                   )
                   assert r.status_code == 404, f"map row should be gone: {r.status_code}"
               finally:
                   c.delete(f"/items/signage_device_tags/{tag_id}", headers=_hdr(directus_admin_token))
                   c.delete(f"/items/signage_playlists/{playlist_id}", headers=_hdr(directus_admin_token))
       ```
    4. Run with stack up: `cd backend && pytest tests/signage/test_admin_directus_crud_smoke.py -v`. Both new tests must pass.
    5. If either returns 401/403 on POST/PATCH/DELETE, follow the D-08 fallback procedure from Phase 68 Plan 08: add explicit Admin permission rows for `signage_playlists` and `signage_playlist_tag_map` in `directus/bootstrap-roles.sh §6`. Commit those rows alongside this plan's changes.
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_admin_directus_crud_smoke.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "test_admin_can_crud_signage_playlists" backend/tests/signage/test_admin_directus_crud_smoke.py` exits 0.
    - `grep -n "test_admin_can_crud_signage_playlist_tag_map" backend/tests/signage/test_admin_directus_crud_smoke.py` exits 0.
    - With docker compose stack up, `pytest tests/signage/test_admin_directus_crud_smoke.py -v` exits 0 — all 4 tests (2 from Phase 68 + 2 new) PASSED.
    - Test output messages distinguish "D-08 fallback?" failures from generic transport failures.
    - If D-08 fallback was needed: `grep -n "Phase 69 D-09" directus/bootstrap-roles.sh` exits 0.
  </acceptance_criteria>
  <done>Admin can CRUD both new collections via Directus; smoke green; D-08 bet either confirmed or fallback rows committed.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh comments in test_permission_field_allowlists.py + verify test_rbac.py READ_ROUTES (D-06/D-07/D-08)</name>
  <files>backend/tests/signage/test_permission_field_allowlists.py, backend/tests/test_rbac.py</files>
  <read_first>
    - backend/tests/signage/test_permission_field_allowlists.py (full file — find any comment/docstring referencing migrated playlist routes)
    - backend/tests/test_rbac.py (full file — confirm READ_ROUTES contains no migrated playlist paths)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-06, D-07, D-08)
    - .planning/phases/68-mig-sign-tags-schedules/68-08-admin-permission-smoke-PLAN.md (precedent comment-refresh shape)
  </read_first>
  <action>
    1. In `backend/tests/signage/test_permission_field_allowlists.py`: `grep -n "playlist" backend/tests/signage/test_permission_field_allowlists.py`. For each result that is a comment or docstring referencing the now-deleted FastAPI playlist routes (e.g. `playlists.py`, `/api/signage/playlists`, "FastAPI playlist"), update the wording to reflect post-Phase-69 state: e.g., "Directus owns signage_playlists + signage_playlist_items + signage_playlist_tag_map CRUD; FastAPI surviving routes are DELETE /{id} (409 shape) and PUT /{id}/items (atomic bulk-replace) per Phase 69".
    2. Do NOT change any assertion. Pure docstring/comment edit.
    3. Run the parity test pre-stack: `cd backend && pytest tests/signage/test_permission_field_allowlists.py -v`. Must still pass <2s.
    4. In `backend/tests/test_rbac.py`: D-07 requires removing migrated playlist paths from READ_ROUTES. Verified by Read: READ_ROUTES contains NO `/playlists` paths today. Run `grep -nE "playlists|playlist_items" backend/tests/test_rbac.py` — must return 0 matches. If 0 matches, the D-07 task is a no-op confirmation (record in SUMMARY). If matches appear, remove those lines per Phase 68 D-10 pattern (precedent: `Phase 68 Plan 08`).
    5. Run `cd backend && pytest tests/test_rbac.py -v` — must still pass.
    6. D-06 test triage: `ls backend/tests/signage/ | grep -iE "playlist"` — confirm whether any `test_signage_playlist*.py` files exist. Verified by current Read of the directory: NONE exist (the dir contains only `__init__.py`, `test_admin_directus_crud_smoke.py`, `test_permission_field_allowlists.py`, `test_pg_listen_sse.py`, `test_signage_schedule_check.py`, `test_viewer_authz.py`). D-06 therefore reduces to a documented no-op — capture in SUMMARY. If during execution any new playlist-specific test files are discovered, triage per D-06 (port to Directus integration vs delete vs keep for surviving routes).
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_permission_field_allowlists.py tests/test_rbac.py -v && grep -nE "playlists|playlist_items" tests/test_rbac.py | (grep -v "^\s*#" || true) | { ! grep -E "/api/signage/playlists"; }</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend && pytest tests/signage/test_permission_field_allowlists.py -v` exits 0 in <2s.
    - `cd backend && pytest tests/test_rbac.py -v` exits 0.
    - `grep -nE "/api/signage/playlists" backend/tests/test_rbac.py` returns 0 matches (D-07 confirmed — READ_ROUTES has none).
    - `grep -nE "FastAPI.*playlist|playlists\.py|playlist_items\.py" backend/tests/signage/test_permission_field_allowlists.py` returns 0 matches OR every remaining match is in an updated comment that mentions Phase 69.
    - SUMMARY documents whether any D-06 triage was needed (expected: no — no `test_signage_playlist*.py` files exist).
  </acceptance_criteria>
  <done>Comments reflect post-Phase-69 state; rbac READ_ROUTES confirmed clean; D-06 documented as no-op (or triaged if files appear).</done>
</task>

</tasks>

<verification>
- All Admin smoke cases (4 total — 2 from Phase 68, 2 new) pass with stack up.
- Comment-refresh + rbac confirmation pass pre-stack in <2s.
- If D-08 fallback was triggered: `bootstrap-roles.sh §6` contains the Admin permission rows for the new collections.
</verification>

<success_criteria>
Admin CRUD path through Directus is proven for `signage_playlists` + `signage_playlist_tag_map`. Comment debt cleared. D-07 + D-06 documented (expected no-op). Phase 71 CLEAN inherits a tidy test surface.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-06-SUMMARY.md` capturing: smoke results, whether D-08 fallback was needed, comment-refresh scope, D-07 + D-06 outcomes (no-op or actual changes).
</output>
