---
phase: 70-mig-sign-devices
plan: 06
type: execute
wave: 2
depends_on: ["70-02"]
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "CI fails if any of GET/PATCH/DELETE on /api/signage/devices (root or by-id) is reintroduced in devices.py"
    - "CI fails if PUT /api/signage/devices/{id}/tags is reintroduced in devices.py"
    - "CI does NOT match the surviving PATCH /{device_id}/calibration route"
    - "CI does NOT match the new GET /api/signage/resolved/{device_id} (lives in resolved.py, different file)"
    - "Guard runs as a pre-stack step (no DB / docker compose dependency)"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Phase 70 method-anchored grep guard"
      contains: "Phase 70"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "backend/app/routers/signage_admin/devices.py"
      via: "grep -E pattern scoped to single file (D-06b)"
      pattern: "devices.py"
---

<objective>
Add a method-anchored CI grep guard immediately after the Phase 69 guard in `.github/workflows/ci.yml` that blocks reintroduction of the five migrated FastAPI device routes (list, by-id, name PATCH, DELETE, tags PUT) while explicitly allowing the surviving calibration PATCH (lives in the same file) and the new resolved.py GET (lives in a different file).

Purpose: Defense-in-depth against accidental rollback of the Phase 70 migration. Pattern is the Phase 69 D-04 method-anchored, file-scoped lesson re-applied to devices.py.

Output: One new step in ci.yml that runs pre-stack, no DB needed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@.github/workflows/ci.yml
@backend/app/routers/signage_admin/devices.py

<interfaces>
<!-- Existing CI guards to model after (Phase 67/68/69) -->
The Phase 69 guard step (already in ci.yml) is the closest template:
- File-scoped to specific .py file(s) (D-06b lesson — avoids cross-file false positives)
- Method-anchored regex via grep -E
- Runs early in the pipeline (no docker compose dependency)
- Fails the job if any matching line is found

<!-- Phase 70 patterns to BLOCK (D-06) -->
Block patterns scoped to backend/app/routers/signage_admin/devices.py:
1. `@router\.(get|patch|delete)\b[^@]*"/api/signage/devices/?\{?[^}]*\}?"?$` — list + by-id GET, name PATCH, DELETE
2. `@router\.put\b[^@]*"/api/signage/devices/\{[^}]+\}/tags"` — tags PUT

<!-- Phase 70 patterns to ALLOW -->
Allow (do NOT match):
- `@router.patch` on `"/{device_id}/calibration"` (suffix anchor — calibration is the surviving route in devices.py per D-00j)
- The new GET in `signage_admin/resolved.py` (different file — file-scoped grep won't see it)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add Phase 70 method-anchored guard step to ci.yml</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .github/workflows/ci.yml (find the Phase 69 guard step — the new Phase 70 step goes IMMEDIATELY AFTER it; observe job structure, indentation, runs-on / steps array conventions)
    - backend/app/routers/signage_admin/devices.py (current state from Plan 70-02 — confirm only `@router.patch("/{device_id}/calibration", ...)` remains)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-06, D-06a, D-06b, D-06c)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pitfall 3 — calibration false-positive)
  </read_first>
  <behavior>
    - Step runs early in the workflow (before any docker compose / DB-dependent step), in the same job as existing Phase 67/68/69 guards
    - Step fails (exit non-zero) if any of the five blocked patterns appear in `backend/app/routers/signage_admin/devices.py` ONLY (not other files)
    - Step does NOT match the surviving calibration PATCH line: `@router.patch("/{device_id}/calibration", response_model=SignageDeviceRead)`
    - Step does NOT match the new resolved.py route: `@router.get("/{device_id}", ...)` in `signage_admin/resolved.py` (file scope keeps that out of view)
    - Failure message instructs the developer to migrate the writer to Directus (link Phase 70 plan)
  </behavior>
  <action>
    Locate the Phase 69 guard step in `.github/workflows/ci.yml` (search for `Phase 69` or `signage_admin/playlists`). Insert a new step immediately after it with the same shape, syntax, and indentation:

    ```yaml
          - name: Phase 70 — block reintroduced device CRUD routes (MIG-SIGN-04)
            run: |
              set -euo pipefail
              FILE="backend/app/routers/signage_admin/devices.py"
              if [ ! -f "$FILE" ]; then
                echo "ERROR: $FILE not found — Phase 70 trim must have left calibration route in place"
                exit 1
              fi
              # Block: GET (list + by-id), PATCH name, DELETE on /api/signage/devices
              # The regex captures `@router.<method>("/...")` decorators where the
              # path starts with "" or "/{device_id}" — i.e. the package router's
              # /devices prefix lands them under /api/signage/devices.
              # ALLOWS: @router.patch("/{device_id}/calibration", ...) — suffix-anchored exclusion below.
              # File-scoped per D-06b (Phase 69 D-04 lesson).
              if grep -nE '@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]' "$FILE" \
                | grep -v '/calibration"' ; then
                echo "ERROR: Phase 70 (MIG-SIGN-04): forbidden FastAPI device route in $FILE."
                echo "       List/get/patch-name/delete moved to Directus signage_devices collection."
                echo "       Only PATCH /{device_id}/calibration is allowed to remain."
                echo "       See .planning/phases/70-mig-sign-devices/70-02-backend-devices-router-trim-PLAN.md"
                exit 1
              fi
              # Block: PUT /{device_id}/tags
              if grep -nE '@router\.put\(\s*"/\{device_id\}/tags"' "$FILE" ; then
                echo "ERROR: Phase 70 (MIG-SIGN-04): forbidden PUT /tags in $FILE."
                echo "       Tag-map writes moved to Directus signage_device_tag_map via FE-driven diff."
                echo "       See signageApi.replaceDeviceTags."
                exit 1
              fi
              echo "Phase 70 device-route guard: clean"
    ```

    Match the YAML indentation of the surrounding steps exactly (typically 6 spaces for `- name:` under `steps:`, 12 spaces for `run: |` body lines). Confirm the existing Phase 69 step's indentation before writing.

    The negative `| grep -v '/calibration"'` is the explicit allow-list for the surviving calibration PATCH on the same line. This is the Pitfall 3 fix from research.

    The regex `@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]` matches:
    - `@router.get("", ...)` — list route
    - `@router.get("/{device_id}", ...)` — by-id GET
    - `@router.patch("/{device_id}", ...)` — name PATCH
    - `@router.delete("/{device_id}", ...)` — DELETE
    - But NOT `@router.patch("/{device_id}/calibration", ...)` (suffix doesn't match the anchored `"\s*[,)]` because of the `/calibration` text — the `grep -v '/calibration"'` is the belt-and-suspenders second filter)
    - And NOT `@router.get("/{device_id}", ...)` in resolved.py (file scope excludes it)

    Per D-06c, do NOT add a guard against `_notify_device_self` — the helper is intentionally retained.
  </action>
  <acceptance_criteria>
    - `grep -c "Phase 70" .github/workflows/ci.yml` returns at least 1 (the new step's name)
    - `grep -c "MIG-SIGN-04" .github/workflows/ci.yml` returns at least 1
    - `grep -c "signage_admin/devices.py" .github/workflows/ci.yml` returns at least 1 (file scope)
    - The step is positioned between the Phase 69 guard step and the next un-related step (verify by reading the diff)
    - Local dry-run passes against current `devices.py` (which only contains calibration PATCH after Plan 70-02): `grep -nE '@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]' backend/app/routers/signage_admin/devices.py | grep -v '/calibration"' | wc -l` returns 0
    - Local dry-run also passes second guard: `grep -nE '@router\.put\(\s*"/\{device_id\}/tags"' backend/app/routers/signage_admin/devices.py | wc -l` returns 0
    - YAML is valid: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0
  </acceptance_criteria>
  <verify>
    <automated>python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && grep -nE '@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]' backend/app/routers/signage_admin/devices.py | grep -v '/calibration"' | wc -l | grep -qx 0 && grep -nE '@router\.put\(\s*"/\{device_id\}/tags"' backend/app/routers/signage_admin/devices.py | wc -l | grep -qx 0 && echo OK</automated>
  </verify>
  <done>Phase 70 method-anchored, file-scoped guard added; YAML valid; dry-run against current devices.py passes (only calibration PATCH remains, which is correctly allowed)</done>
</task>

</tasks>

<verification>
- ci.yml YAML is valid
- New guard step is positioned after Phase 69 guard
- Dry-run against post-Plan-70-02 devices.py passes (calibration PATCH ignored)
- Adversarial test (mentally — DO NOT commit): adding `@router.patch("/{device_id}", ...)` back to devices.py would trigger the guard
</verification>

<success_criteria>
- Guard prevents accidental reintroduction of all 5 migrated routes
- Calibration PATCH explicitly allowed via suffix-based negative filter
- resolved.py route unaffected (file scope)
- _notify_device_self helper unaffected (intentional retention per D-06c)
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-06-ci-grep-guard-SUMMARY.md`
</output>
