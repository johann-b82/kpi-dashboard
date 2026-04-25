---
phase: 68-mig-sign-tags-schedules
plan: 07
type: execute
wave: 2
depends_on: ["68-01", "68-03"]
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [MIG-SIGN-01, MIG-SIGN-02]

must_haves:
  truths:
    - "CI fails fast (pre-stack) if any backend/app/ file references the literal '/api/signage/tags' or '/api/signage/schedules' path"
    - "Guard runs in <1s per the Phase 66/67 fast-fail pattern"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Pre-stack grep guard step"
      contains: "/api/signage/tags"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "backend/app/ tree"
      via: "grep -rn pattern, exit 1 on match"
      pattern: "/api/signage/(tags|schedules)"
---

<objective>
Add a pre-stack CI grep guard that fails the build if any file under `backend/app/` reintroduces the literal `/api/signage/tags` or `/api/signage/schedules` route prefixes (which were deleted in Plans 01 and 03). Pattern modeled on the existing Phase 66 (`/api/me`) and Phase 67 (`/api/data/sales`) guards already present in this workflow file.

Purpose: Lock in MIG-SIGN-01 + MIG-SIGN-02 — once Directus owns these collections, regression to FastAPI endpoints must be impossible.

Output: One new step appended near the existing guards in `.github/workflows/ci.yml`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/66-kill-me-py/66-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@.github/workflows/ci.yml

<interfaces>
Existing guards in ci.yml (verified by Read):
- Phase 66 step "Guard — no /api/me in frontend (MIG-AUTH-03)" using `grep -rn '"/api/me"' frontend/src/`.
- Phase 67 step "Guard — no /api/data/sales or /api/data/employees in backend (MIG-DATA-04)" using extended regex `grep -rnE '"/api/data/sales"|"/api/data/employees"|"/api/data/employees[^/"]'`.

Both guards run before the docker compose stack comes up so regression fails in <1s.

For Phase 68 the prefixes to block under `backend/app/` are the literals `/api/signage/tags` and `/api/signage/schedules`. Per D-12, exclude any future hybrid tag-map subpaths defensively — but since `tag_map` writes (Phase 69/70) will live at `/api/signage/playlists/{id}/tags` and `/api/signage/devices/{id}/tags` (NOT `/api/signage/tags/...`), the literal-prefix block is safe. Refine regex if needed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CI grep guard for /api/signage/tags + /api/signage/schedules</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .github/workflows/ci.yml (lines 1-110 — find the existing Phase 67 guard step to anchor the new step right after it)
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-12)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-12 pattern)
  </read_first>
  <action>
    1. Locate the Phase 67 guard step ("Guard — no /api/data/sales or /api/data/employees in backend (MIG-DATA-04)") in `.github/workflows/ci.yml`. Insert the new step IMMEDIATELY AFTER it (so all pre-stack guards cluster together):
       ```yaml
       # -----------------------------------------------------------------------
       # Phase 68 MIG-SIGN-01 + MIG-SIGN-02: CI guard — fail on any literal
       # `/api/signage/tags` or `/api/signage/schedules` reappearing under
       # backend/app/. Both routers were deleted in Phase 68; tags + schedules
       # CRUD now go through the Directus collections `signage_device_tags`
       # and `signage_schedules`. Tag-map writes for playlists / devices use
       # `/api/signage/playlists/{id}/tags` and `/api/signage/devices/{id}/tags`
       # (different prefix); they remain in FastAPI per Phase 69 / 70 scope.
       # Pre-stack grep — fails in <1s on regression.
       # -----------------------------------------------------------------------
       - name: "Guard — no /api/signage/tags or /api/signage/schedules in backend (MIG-SIGN-01/02)"
         run: |
           if grep -rnE '"/api/signage/tags"|"/api/signage/tags/|"/api/signage/schedules"|"/api/signage/schedules/' backend/app/; then
             echo "ERROR: /api/signage/tags or /api/signage/schedules reference found in backend/app/ (Phase 68 — these routers were deleted; CRUD goes through Directus collections signage_device_tags + signage_schedules)."
             exit 1
           fi
           echo "OK: no /api/signage/tags or /api/signage/schedules references in backend/app/"
       ```
    2. Confirm the regex DOES NOT match the playlist/device tag-map subpaths (Phase 69/70 scope) — those use `/api/signage/playlists/{id}/tags` and `/api/signage/devices/{id}/tags`, which the literal anchored regex (`"/api/signage/tags"` or `"/api/signage/tags/`) cannot match because both require the next character to be tag-related, not playlist/device-specific.
       Verify with a manual test:
       ```bash
       echo '"/api/signage/playlists/abc/tags"' | grep -E '"/api/signage/tags"|"/api/signage/tags/'
       # Must exit 1 (no match)
       echo '"/api/signage/tags"' | grep -E '"/api/signage/tags"|"/api/signage/tags/'
       # Must exit 0 (match)
       echo '"/api/signage/tags/123"' | grep -E '"/api/signage/tags"|"/api/signage/tags/'
       # Must exit 0 (match)
       ```
    3. Validate yaml syntax: `cd .github/workflows && python -c "import yaml; yaml.safe_load(open('ci.yml'))"`. Must exit 0.
    4. Run the guard locally before pushing: `if grep -rnE '"/api/signage/tags"|"/api/signage/tags/|"/api/signage/schedules"|"/api/signage/schedules/' backend/app/; then exit 1; fi; echo OK`. Must exit 0 (Plans 01 + 03 already removed the references).
  </action>
  <verify>
    <automated>python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && grep -nE "Guard — no /api/signage/(tags|schedules)" .github/workflows/ci.yml && bash -c 'if grep -rnE "\"/api/signage/tags\"|\"/api/signage/tags/|\"/api/signage/schedules\"|\"/api/signage/schedules/" backend/app/; then exit 1; fi'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Guard — no /api/signage/tags or /api/signage/schedules" .github/workflows/ci.yml` exits 0.
    - `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0 (valid YAML).
    - The literal local-equivalent grep on `backend/app/` exits 1 (no match) — guard would currently pass.
    - The regex test (in action step 2) shows it matches `"/api/signage/tags"` and `"/api/signage/tags/123"` but NOT `"/api/signage/playlists/abc/tags"`.
  </acceptance_criteria>
  <done>Pre-stack guard appended to ci.yml; YAML still valid; matches the documented regression-blocking spec without false positives on Phase 69/70 paths.</done>
</task>

</tasks>

<verification>
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
- Local execution of the guard's grep command exits 1 on the current tree (no matches).
- Adding a sentinel line `"/api/signage/tags"` somewhere under `backend/app/` and re-running the guard exits with code 1 (sentinel removed before commit).
</verification>

<success_criteria>
CI step in place; valid YAML; verified to block regression while allowing Phase 69/70 tag-map subpaths.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-07-SUMMARY.md` capturing: the exact regex used, the false-positive guard test results, and whether anything in `backend/app/` failed the guard (must be nothing).
</output>
