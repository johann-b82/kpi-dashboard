---
phase: 68-mig-sign-tags-schedules
plan: 08
type: execute
wave: 2
depends_on: ["68-01", "68-03"]
files_modified:
  - backend/tests/signage/test_admin_directus_crud_smoke.py
  - backend/tests/signage/test_permission_field_allowlists.py
autonomous: true
requirements: [MIG-SIGN-01, MIG-SIGN-02]

must_haves:
  truths:
    - "An Admin Directus JWT can POST/PATCH/DELETE on signage_device_tags and signage_schedules via the Directus REST API"
    - "If smoke fails, planner adds explicit Admin permission rows in bootstrap-roles.sh; expected to pass without change per D-08"
  artifacts:
    - path: "backend/tests/signage/test_admin_directus_crud_smoke.py"
      provides: "Admin CRUD smoke for both collections"
      contains: "signage_device_tags"
  key_links:
    - from: "Admin Directus JWT"
      to: "Directus collections (signage_device_tags + signage_schedules)"
      via: "REST POST/PATCH/DELETE"
      pattern: "admin_access: true"
---

<objective>
Add a backend integration smoke test asserting that the Directus Administrator role (via its `admin_access: true` policy — D-08) can fully CRUD `signage_device_tags` and `signage_schedules` via REST. Refresh comments in `test_permission_field_allowlists.py` to reflect the post-Phase-68 state (FastAPI tag/schedule routes deleted, Directus is sole owner).

Per D-08 the bet is that Admin works without any change to `bootstrap-roles.sh` because Administrator is `admin_access: true`. If the smoke fails, document the gap and add a section 6 to `bootstrap-roles.sh` with explicit Admin permission rows.

Purpose: Lock in MIG-SIGN-01 + MIG-SIGN-02 — admin can do CRUD through Directus end-to-end.

Output: One new test file (~80 LOC), comment refresh in the existing allowlists test.
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
@backend/tests/signage/test_permission_field_allowlists.py
@backend/tests/signage/test_viewer_authz.py
@directus/bootstrap-roles.sh

<interfaces>
Existing fixtures available in `backend/tests/signage/`:
- `directus_admin_token` (in `test_pg_listen_sse.py`) — Admin REST login. Promote to a shared fixture in `conftest.py` if the new file needs it; OR reuse via session-scoped import.
- `test_viewer_authz.py` — pattern for asserting permission outcomes via REST calls.

Directus REST endpoints exercised:
- `POST /items/signage_device_tags` body `{name}`
- `PATCH /items/signage_device_tags/{id}` body `{name}`
- `DELETE /items/signage_device_tags/{id}`
- `POST /items/signage_schedules` body `{playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled}`
- `PATCH /items/signage_schedules/{id}` body `{priority}`
- `DELETE /items/signage_schedules/{id}`

For schedules, planner needs an existing `playlist_id` — reuse the paired_device fixture's playlist or create a temporary playlist via Directus first.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Admin Directus CRUD smoke test for tags + schedules</name>
  <files>backend/tests/signage/test_admin_directus_crud_smoke.py</files>
  <read_first>
    - backend/tests/signage/test_pg_listen_sse.py (fixture pattern + REST helpers)
    - backend/tests/signage/test_viewer_authz.py
    - directus/bootstrap-roles.sh (Admin role definition; confirm `admin_access: true`)
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-08)
  </read_first>
  <behavior>
    - `test_admin_can_crud_signage_device_tags`: Admin POSTs a tag, PATCHes its name, then DELETEs it. All steps return 2xx. The created row exists between POST and DELETE; after DELETE, GET returns 404.
    - `test_admin_can_crud_signage_schedules`: Admin POSTs a schedule (using a transient playlist), PATCHes priority, then DELETEs it. All steps return 2xx.
    - If any step returns 401 / 403, the test fails with a descriptive message that signals D-08 fallback (add Admin permission rows in `bootstrap-roles.sh`).
  </behavior>
  <action>
    1. Create `backend/tests/signage/test_admin_directus_crud_smoke.py`:
       ```python
       """Phase 68 MIG-SIGN-01/02 D-08: Admin Directus CRUD smoke.

       Asserts Admin (admin_access: true) can fully CRUD signage_device_tags
       and signage_schedules via Directus REST. If a 401/403 surfaces,
       add explicit Admin permission rows in directus/bootstrap-roles.sh §6.

       Requires `docker compose up -d` (full stack with Plan 01/03 routers
       removed and snapshot applied).
       """
       from __future__ import annotations
       import os
       import time
       import uuid

       import httpx
       import pytest

       DIRECTUS_BASE_URL = os.environ.get("DIRECTUS_BASE_URL", "http://localhost:8055")
       DIRECTUS_ADMIN_EMAIL = os.environ.get("DIRECTUS_ADMIN_EMAIL", "admin@example.com")
       DIRECTUS_ADMIN_PASSWORD = os.environ.get("DIRECTUS_ADMIN_PASSWORD", "admin_test_pw")


       @pytest.fixture(scope="session")
       def directus_admin_token() -> str:
           with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               r = c.post("/auth/login", json={
                   "email": DIRECTUS_ADMIN_EMAIL,
                   "password": DIRECTUS_ADMIN_PASSWORD,
               })
               r.raise_for_status()
               return r.json()["data"]["access_token"]


       def _hdr(t: str) -> dict[str, str]:
           return {"Authorization": f"Bearer {t}"}


       def test_admin_can_crud_signage_device_tags(directus_admin_token: str) -> None:
           name_a = f"phase68-smoke-{int(time.time() * 1000)}"
           name_b = f"{name_a}-renamed"
           with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               r = c.post("/items/signage_device_tags",
                          headers=_hdr(directus_admin_token),
                          json={"name": name_a})
               assert r.status_code in (200, 201), f"create failed (D-08 fallback?): {r.status_code} {r.text}"
               tag_id = r.json()["data"]["id"]

               r = c.patch(f"/items/signage_device_tags/{tag_id}",
                           headers=_hdr(directus_admin_token),
                           json={"name": name_b})
               assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"

               r = c.delete(f"/items/signage_device_tags/{tag_id}",
                            headers=_hdr(directus_admin_token))
               assert r.status_code == 204, f"delete failed: {r.status_code} {r.text}"

               r = c.get(f"/items/signage_device_tags/{tag_id}",
                         headers=_hdr(directus_admin_token))
               assert r.status_code == 404, f"row should be gone: {r.status_code}"


       def test_admin_can_crud_signage_schedules(directus_admin_token: str) -> None:
           # Resolve any existing playlist_id via Directus to avoid creating one.
           with httpx.Client(base_url=DIRECTUS_BASE_URL, timeout=10.0) as c:
               r = c.get("/items/signage_playlists?limit=1&fields=id",
                         headers=_hdr(directus_admin_token))
               r.raise_for_status()
               rows = r.json()["data"]
               if not rows:
                   pytest.skip("No signage_playlists row available; create one in fixture")
               playlist_id = rows[0]["id"]

               r = c.post("/items/signage_schedules",
                          headers=_hdr(directus_admin_token),
                          json={
                              "playlist_id": playlist_id,
                              "weekday_mask": 127,
                              "start_hhmm": 600,
                              "end_hhmm": 720,
                              "priority": 10,
                              "enabled": True,
                          })
               assert r.status_code in (200, 201), f"create failed (D-08 fallback?): {r.status_code} {r.text}"
               sched_id = r.json()["data"]["id"]

               r = c.patch(f"/items/signage_schedules/{sched_id}",
                           headers=_hdr(directus_admin_token),
                           json={"priority": 20})
               assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"

               r = c.delete(f"/items/signage_schedules/{sched_id}",
                            headers=_hdr(directus_admin_token))
               assert r.status_code == 204, f"delete failed: {r.status_code} {r.text}"
       ```
    2. Run the smoke: `cd backend && pytest tests/signage/test_admin_directus_crud_smoke.py -v`. With `docker compose up -d` running, both tests must pass. If either returns 401/403, follow the D-08 fallback: add explicit Admin permission rows to `directus/bootstrap-roles.sh §6` (POSTs to `/permissions` with `policy=<admin_policy_id>` and `collection=<each>` for action `create`/`update`/`delete`/`read` with `fields: ["*"]`). Commit those rows alongside this plan's changes if needed.
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_admin_directus_crud_smoke.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `test -f backend/tests/signage/test_admin_directus_crud_smoke.py` exits 0.
    - With docker compose stack up, `pytest tests/signage/test_admin_directus_crud_smoke.py -v` exits 0 with both tests reported "PASSED".
    - Test output messages distinguish a "D-08 fallback" failure from a generic transport failure (assertion messages reference "D-08 fallback?").
    - If D-08 fallback was needed: `grep -n "Phase 68 D-08" directus/bootstrap-roles.sh` exits 0 documenting the new section.
  </acceptance_criteria>
  <done>Admin can CRUD both Directus collections; smoke green; if fallback was needed it's committed.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh comments in test_permission_field_allowlists.py</name>
  <files>backend/tests/signage/test_permission_field_allowlists.py</files>
  <read_first>
    - backend/tests/signage/test_permission_field_allowlists.py (full file — find any comment / docstring referencing FastAPI tag or schedule routes)
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-04, D-08)
  </read_first>
  <action>
    1. `grep -n "tags\.py\|schedules\.py\|/api/signage/tags\|/api/signage/schedules\|FastAPI.*tag\|FastAPI.*schedule" backend/tests/signage/test_permission_field_allowlists.py` — for each result that is a comment or docstring referring to the (now deleted) FastAPI routers, update the wording to reflect the post-Phase-68 state ("Directus owns signage_device_tags + signage_schedules CRUD; FastAPI router removed in Phase 68 Plan 01/03").
    2. Do NOT change any assertion. The Pydantic-vs-shell parity test is logic-stable — only docstrings and inline comments change.
    3. Run the parity test pre-stack: `cd backend && pytest tests/signage/test_permission_field_allowlists.py -v`. Must still pass <1s.
  </action>
  <verify>
    <automated>cd backend && pytest tests/signage/test_permission_field_allowlists.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "tags\.py|schedules\.py|FastAPI tag|FastAPI schedule" backend/tests/signage/test_permission_field_allowlists.py` returns 0 matches OR every remaining match is in an updated comment that explicitly mentions Phase 68.
    - `cd backend && pytest tests/signage/test_permission_field_allowlists.py -v` exits 0 in <2s.
  </acceptance_criteria>
  <done>Comments reflect post-Phase-68 state; parity test still green.</done>
</task>

</tasks>

<verification>
- Both smoke cases pass with stack up.
- Parity test pre-stack still green.
- If D-08 fallback was triggered: bootstrap-roles.sh §6 contains the Admin permission rows (idempotent GET-before-POST).
</verification>

<success_criteria>
Admin CRUD path through Directus is proven for both new collections; comment debt cleared; D-08 bet either confirmed (no change) or documented (fallback rows added).
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-08-SUMMARY.md` capturing: smoke results, whether D-08 fallback was needed, comment-refresh scope.
</output>
