---
phase: 43-media-playlist-device-admin-api-polling
plan: 05
type: execute
wave: 3
depends_on:
  - 43-03
  - 43-04
files_modified:
  - backend/tests/test_signage_router_deps.py
  - backend/tests/test_signage_ci_guards.py
autonomous: true
requirements:
  - SGN-BE-09
  - SGN-BE-10
must_haves:
  truths:
    - "For every app route under /api/signage NOT in the public allow-list and NOT under /api/signage/player/, require_admin is in the dependant tree"
    - "For every app route under /api/signage/player/, get_current_device is in the dependant tree"
    - "Allow-list contains exactly {/api/signage/pair/request, /api/signage/pair/status}"
    - "grep finds no `import sqlite3` in backend/app/"
    - "grep finds no `import psycopg2` in backend/app/"
    - "grep finds no sync `subprocess.run`, `subprocess.Popen`, `subprocess.call` in any signage module under backend/app/"
  artifacts:
    - path: backend/tests/test_signage_router_deps.py
      provides: "Dep-audit test walking app.routes dependant trees"
      contains: "PUBLIC_SIGNAGE_ROUTES"
    - path: backend/tests/test_signage_ci_guards.py
      provides: "Grep-in-test guards for sqlite3/psycopg2/sync-subprocess"
      contains: "subprocess"
  key_links:
    - from: backend/tests/test_signage_router_deps.py
      to: backend/app/main.py
      via: "app.routes dependant walk"
      pattern: "_walk_deps"
    - from: backend/tests/test_signage_ci_guards.py
      to: backend/app/ (entire tree)
      via: "subprocess.run grep -r"
      pattern: "grep"
---

<objective>
Lock in the two cross-cutting contract tests for Phase 43: the router dep-audit (SGN-BE-09) and the CI grep guards (SGN-BE-10). These tests live in `backend/tests/` and depend on Plan 03 (admin router) + Plan 04 (player router) being wired into `main.py`.

Purpose: Make it structurally impossible to add a new admin signage route without `require_admin`, a new player route without `get_current_device`, or a sqlite3/psycopg2/sync-subprocess import anywhere in `backend/app/`. The tests are the enforcement mechanism and surface violations at CI time, not runtime.

Output: Two new test files. No production code touched.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md
@backend/tests/test_sensors_admin_gate.py
@backend/tests/test_snmp_poller_ci_guards.py
@backend/app/main.py
@backend/app/security/directus_auth.py
@backend/app/security/device_auth.py

<interfaces>
From backend/tests/test_sensors_admin_gate.py — `_walk_deps` pattern (verified):
```python
def _walk_deps(deps):
    out = []
    for d in deps:
        out.append(d.call)
        out.extend(_walk_deps(d.dependencies))
    return out
```

From backend/tests/test_snmp_poller_ci_guards.py — grep-via-subprocess pattern (verified):
```python
subprocess.run(["grep", "-r", "--include=*.py", "-l", pattern, str(path)], capture_output=True, text=True)
```

Allow-list (D-04/D-05 — INTENTIONAL EXCEPTIONS from Phase 42 Plan 02):
- /api/signage/pair/request (public — unpaired kiosk has no token)
- /api/signage/pair/status (public — unpaired kiosk polls for claim)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create dep-audit test (SGN-BE-09)</name>
  <files>backend/tests/test_signage_router_deps.py</files>
  <read_first>
    - backend/tests/test_sensors_admin_gate.py (copy `_walk_deps` verbatim)
    - backend/app/main.py (confirm all three signage routers are included)
    - backend/app/security/directus_auth.py (import path for require_admin)
    - backend/app/security/device_auth.py (import path for get_current_device)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-04, D-05
  </read_first>
  <action>
    Create `backend/tests/test_signage_router_deps.py`:

    ```python
    """SGN-BE-09 (Phase 43): router dep-audit.

    Walks every route under /api/signage and asserts the correct router-level
    gate is present in the dependant tree.

    INTENTIONAL EXCEPTIONS: PUBLIC_SIGNAGE_ROUTES are the two public pair
    endpoints (/request, /status) — documented in Phase 42 Plan 02 SUMMARY
    (.planning/phases/42-device-auth-pairing-flow/42-02-signage-pair-router-SUMMARY.md).
    Adding any new public signage route requires an explicit entry here — no
    silent gate leaks.
    """
    from fastapi.routing import APIRoute

    from app.main import app
    from app.security.device_auth import get_current_device
    from app.security.directus_auth import require_admin

    PUBLIC_SIGNAGE_ROUTES = {
        "/api/signage/pair/request",
        "/api/signage/pair/status",
    }


    def _walk_deps(deps):
        out = []
        for d in deps:
            out.append(d.call)
            out.extend(_walk_deps(d.dependencies))
        return out


    def test_signage_admin_routes_have_require_admin():
        found = []
        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            if not route.path.startswith("/api/signage"):
                continue
            if route.path in PUBLIC_SIGNAGE_ROUTES:
                continue
            if route.path.startswith("/api/signage/player/"):
                continue
            found.append(route.path)
            all_calls = _walk_deps(route.dependant.dependencies)
            assert require_admin in all_calls, (
                f"admin route {route.path} (method={list(route.methods)}) "
                f"missing require_admin in dependant tree"
            )
        # Sanity: we actually walked some admin routes (not vacuously true)
        assert len(found) > 0, "no /api/signage admin routes found — wiring broken?"


    def test_signage_player_routes_have_get_current_device():
        found = []
        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            if not route.path.startswith("/api/signage/player/"):
                continue
            found.append(route.path)
            all_calls = _walk_deps(route.dependant.dependencies)
            assert get_current_device in all_calls, (
                f"player route {route.path} (method={list(route.methods)}) "
                f"missing get_current_device in dependant tree"
            )
        assert len(found) >= 2, (
            f"expected ≥2 player routes (/playlist, /heartbeat), found {found}"
        )


    def test_public_signage_routes_are_explicitly_allowed():
        """Guard against adding a public signage route without updating the allow-list."""
        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            if not route.path.startswith("/api/signage"):
                continue
            if route.path.startswith("/api/signage/player/"):
                continue
            if route.path in PUBLIC_SIGNAGE_ROUTES:
                continue
            all_calls = _walk_deps(route.dependant.dependencies)
            # All remaining signage routes MUST have require_admin (covered by test above);
            # this test exists so changes to PUBLIC_SIGNAGE_ROUTES surface in review.
            assert require_admin in all_calls
    ```

    Keep the allow-list comment BLOCK pointing explicitly at the Phase 42 Plan 02 SUMMARY path (D-05).
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_router_deps.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File backend/tests/test_signage_router_deps.py exists
    - grep -q "PUBLIC_SIGNAGE_ROUTES" backend/tests/test_signage_router_deps.py
    - grep -q "/api/signage/pair/request" backend/tests/test_signage_router_deps.py
    - grep -q "/api/signage/pair/status" backend/tests/test_signage_router_deps.py
    - grep -q "require_admin" backend/tests/test_signage_router_deps.py
    - grep -q "get_current_device" backend/tests/test_signage_router_deps.py
    - grep -q "42-02-signage-pair-router-SUMMARY" backend/tests/test_signage_router_deps.py
    - `pytest backend/tests/test_signage_router_deps.py -x` exits 0 with 3 tests passing
    - First test asserts len(found) > 0 (no vacuous truth)
    - Second test asserts len(found) >= 2 (player has /playlist and /heartbeat)
  </acceptance_criteria>
  <done>Dep-audit test passes, allow-list documented, non-vacuous assertions.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create CI grep guards test (SGN-BE-10)</name>
  <files>backend/tests/test_signage_ci_guards.py</files>
  <read_first>
    - backend/tests/test_snmp_poller_ci_guards.py (grep-in-test pattern — verified)
    - backend/app/ tree (to confirm no pre-existing violations; if any, the test will surface them and they must be fixed, not excluded)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions (SGN-BE-10 in §phase_requirements)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md §"Pattern: CI Grep Guards (SGN-BE-10)"
  </read_first>
  <action>
    Create `backend/tests/test_signage_ci_guards.py`:

    ```python
    """SGN-BE-10 (Phase 43): CI grep guards.

    Cross-cutting hazard #6/#7 enforcement:
    - No `import sqlite3` anywhere in backend/app/
    - No `import psycopg2` anywhere in backend/app/
    - No sync `subprocess.run`/`subprocess.Popen`/`subprocess.call` in any
      signage module under backend/app/ (async code must use
      asyncio.subprocess_exec — Phase 44 will enforce this for PPTX).

    Tests themselves may use subprocess — they live in backend/tests/, not
    backend/app/, and the guards explicitly only scan backend/app/.
    """
    import subprocess
    from pathlib import Path

    APP_DIR = Path(__file__).resolve().parents[1] / "app"


    def _grep_files(pattern: str, root: Path) -> list[str]:
        """Return list of file paths (one per matching file) via `grep -r -l`."""
        result = subprocess.run(
            ["grep", "-r", "--include=*.py", "-l", pattern, str(root)],
            capture_output=True,
            text=True,
        )
        return [line for line in result.stdout.splitlines() if line.strip()]


    def test_no_sqlite3_import_in_backend_app():
        hits = _grep_files("^import sqlite3", APP_DIR)
        hits += _grep_files("^from sqlite3", APP_DIR)
        assert hits == [], f"sqlite3 import found in backend/app/: {hits}"


    def test_no_psycopg2_import_in_backend_app():
        hits = _grep_files("^import psycopg2", APP_DIR)
        hits += _grep_files("^from psycopg2", APP_DIR)
        assert hits == [], f"psycopg2 import found in backend/app/: {hits}"


    def _signage_modules() -> list[Path]:
        """Return every .py file under backend/app/ whose name or path contains 'signage'."""
        all_py = list(APP_DIR.rglob("*.py"))
        return [
            p
            for p in all_py
            if "signage" in p.name.lower() or "signage" in str(p).lower()
        ]


    def test_no_sync_subprocess_in_signage_modules():
        offenders: list[tuple[str, str]] = []
        for path in _signage_modules():
            content = path.read_text()
            for bad in ("subprocess.run", "subprocess.Popen", "subprocess.call"):
                if bad in content:
                    offenders.append((str(path), bad))
        assert offenders == [], (
            f"sync subprocess in signage module(s): {offenders} — "
            "use asyncio.subprocess_exec instead"
        )


    def test_scanner_actually_finds_signage_files():
        """Sanity: the scanner covers a real set of files (non-vacuous)."""
        paths = _signage_modules()
        assert len(paths) >= 3, (
            f"expected ≥3 signage modules under backend/app/, found {paths}"
        )
    ```

    The test file itself uses `subprocess.run` and `subprocess.CalledProcessError`-adjacent patterns — this is allowed because the file lives in `backend/tests/`, NOT in `backend/app/`. The guards explicitly scan only `backend/app/`.

    If any pre-existing file in `backend/app/` already contains `import sqlite3`, `import psycopg2`, or sync subprocess in a signage module, the tests will fail — DO NOT add exclusions. Fix the underlying file (likely by removing the import or switching to asyncio subprocess). Escalate if the violation is in unrelated code outside the signage surface and was intentional (unlikely given the codebase history).
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_ci_guards.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File backend/tests/test_signage_ci_guards.py exists with 4 test functions
    - grep -q "APP_DIR" backend/tests/test_signage_ci_guards.py
    - grep -q "subprocess.run" backend/tests/test_signage_ci_guards.py (for the guard test itself to execute grep; permitted since it's in backend/tests/)
    - grep -q "signage" backend/tests/test_signage_ci_guards.py
    - `pytest backend/tests/test_signage_ci_guards.py -x` exits 0 with all 4 tests passing
    - test_scanner_actually_finds_signage_files ensures non-vacuous truth (≥3 signage modules present)
  </acceptance_criteria>
  <done>Four guard tests green; all three prohibited patterns verified absent in the scanned scope.</done>
</task>

</tasks>

<verification>
- `pytest backend/tests/test_signage_router_deps.py backend/tests/test_signage_ci_guards.py -x -v` all pass
- Full Phase 43 test suite: `pytest backend/tests/test_signage_resolver.py backend/tests/test_signage_admin_router.py backend/tests/test_signage_player_router.py backend/tests/test_signage_heartbeat_sweeper.py backend/tests/test_signage_router_deps.py backend/tests/test_signage_ci_guards.py -x`
- No regression: `pytest backend/tests/ -x` full run green
</verification>

<success_criteria>
1. Dep-audit walks every `/api/signage` route, asserts correct gate, and fails loudly on violation (Phase success criterion 4).
2. Allow-list is a single module-level constant with a comment pointing at Phase 42 Plan 02 SUMMARY (D-05).
3. `import sqlite3`, `import psycopg2`, and sync subprocess.* are proven absent from their respective scopes (Phase success criterion 5; SGN-BE-10 satisfied; cross-cutting hazard #6/#7).
4. Sanity tests prevent vacuous-truth green (both dep-audit tests and the scanner-coverage test).
</success_criteria>

<output>
After completion, create `.planning/phases/43-media-playlist-device-admin-api-polling/43-05-SUMMARY.md`
</output>
