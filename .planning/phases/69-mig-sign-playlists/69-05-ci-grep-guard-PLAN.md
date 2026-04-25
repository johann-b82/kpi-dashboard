---
phase: 69-mig-sign-playlists
plan: 05
type: execute
wave: 2
depends_on: ["69-01", "69-02"]
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "CI fails fast (pre-stack) if any backend/app/ file reintroduces @router.post / @router.get / @router.patch on '/api/signage/playlists' (root) or '/api/signage/playlists/{id}' (by-id) — D-04 first two block clauses"
    - "CI fails fast if any backend/app/ file reintroduces @router.put on '/api/signage/playlists/{id}/tags' — D-04 third block clause"
    - "Surviving @router.delete on '/api/signage/playlists/{id}' and @router.put on '/api/signage/playlists/{id}/items' do NOT trigger the guard — D-04 allow clauses"
    - "_notify_playlist_changed helper is INTENTIONALLY NOT guarded against — D-04b"
    - "Guard runs in <1s pre-stack per Phase 66/67/68 fast-fail pattern"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Pre-stack method-anchored grep guard for migrated playlist routes"
      contains: "MIG-SIGN-03"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "backend/app/ tree"
      via: "method-anchored regex grep, exit 1 on match"
      pattern: "@router\\.(post|get|patch).*signage/playlists"
---

<objective>
Add a pre-stack CI grep guard that fails the build if any file under `backend/app/` reintroduces a method-anchored decorator matching the migrated playlist routes (POST/GET/PATCH on root or by-id, PUT on `/{id}/tags`), while explicitly allowing the surviving DELETE on `/{id}` and bulk PUT on `/{id}/items` per D-04. Pattern modeled on the existing Phase 66/67/68 guards already in the workflow file.

Purpose: Lock in MIG-SIGN-03 — once Directus owns the metadata + tags surface, regression to FastAPI must be impossible. D-04b: do NOT add a guard against `_notify_playlist_changed` — surviving DELETE + bulk-PUT still need it.

Output: One new step appended near the existing Phase 68 guard in `.github/workflows/ci.yml`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-07-ci-grep-guard-PLAN.md
@.github/workflows/ci.yml

<interfaces>
Existing guards in `.github/workflows/ci.yml` (verified by Read):
- Phase 66 step `Guard — no /api/me in frontend (MIG-AUTH-03)`.
- Phase 67 step `Guard — no /api/data/sales or /api/data/employees in backend (MIG-DATA-04)`.
- Phase 68 step `Guard — no /api/signage/tags or /api/signage/schedules in backend (MIG-SIGN-01/02)` at line 107.

D-04 requires METHOD-ANCHORED regex (not literal-path-anchored) because the surviving DELETE + bulk-PUT use the same `/api/signage/playlists` literal but on different methods. Three block clauses + two allow clauses:

Block (must-fail patterns):
- `@router\.(post|get|patch)\b[^@]*"/api/signage/playlists"` — root POST/GET/PATCH (note: in this codebase the prefix `/api/signage` is on the parent router and `/playlists` is on the child router, so the actual decorator literal is `@router.post("")` or `@router.get("")` on the playlists sub-router, NOT the full path. The guard MUST match against the full URL form to be useful — see step 1 below for resolution).
- `@router\.(get|patch)\b[^@]*"/api/signage/playlists/\{[^}]+\}"` — by-id GET/PATCH.
- `@router\.put\b[^@]*"/api/signage/playlists/\{[^}]+\}/tags"` — tags PUT.

Allow (must NOT match):
- `@router.delete` on `/playlists/{id}` — surviving (D-04 allow).
- `@router.put` on `/playlists/{id}/items` — surviving (D-04 allow).

PRACTICAL NOTE for the executor: in this codebase decorators on the playlists sub-router use the `/playlists` prefix relative form (`@router.delete("/{playlist_id}")`, `@router.put("/{playlist_id}/items")`). The literal `"/api/signage/playlists"` only appears in client code, comments, or full-path docs — NOT in `@router.*` decorators. To make the guard meaningful AND precise, use TWO complementary checks:
  (a) Path-string check: block ANY occurrence of `"/api/signage/playlists"` or `"/api/signage/playlists/` in `backend/app/` source code. This catches reintroductions of the literal in client docstrings, frontend-style code accidentally pasted in, or any new module that hardcodes the URL. The literal does NOT appear in the surviving DELETE / bulk-PUT decorators (which use the relative `/{playlist_id}` form).
  (b) Decorator check: block any new `@router.(post|get|patch)\b[^@]*"/playlists"` or `@router.(get|patch)\b[^@]*"/{playlist_id}"` (without `/items` after) inside `backend/app/routers/signage_admin/playlists.py` specifically (the surviving file). The surviving DELETE in this file is on `"/{playlist_id}"` — the decorator method itself is `delete`, so the regex `@router\.(post|get|patch)\b` does not match it. The surviving bulk-PUT is in `playlist_items.py` on `"/{playlist_id}/items"` — different file, and uses `put`, so the regex still does not false-positive there.

D-04 + D-04a — pre-stack step (no DB), <1s.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add method-anchored CI grep guard for migrated playlist routes</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .github/workflows/ci.yml (lines 95-130 — find the existing Phase 68 guard step at line 107 to anchor new step right after it)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-04, D-04a, D-04b)
    - .planning/phases/68-mig-sign-tags-schedules/68-07-ci-grep-guard-PLAN.md (precedent shape)
  </read_first>
  <action>
    1. Locate the existing Phase 68 guard step in `.github/workflows/ci.yml` (named `Guard — no /api/signage/tags or /api/signage/schedules in backend (MIG-SIGN-01/02)`). Insert the NEW step IMMEDIATELY AFTER it so all pre-stack guards cluster together.
    2. New step body — uses two complementary greps per the practical note above:
       ```yaml
       # -----------------------------------------------------------------------
       # Phase 69 MIG-SIGN-03: CI guard — fail on any backend/app/ file
       # reintroducing the migrated playlist routes. Two complementary checks:
       #   (a) literal path string `"/api/signage/playlists"` reappearing
       #       anywhere in backend/app/ (catches client-style URLs, docs,
       #       accidental pastes); does NOT match surviving DELETE +
       #       bulk-PUT decorators which use the relative `"/{playlist_id}"`
       #       form on the sub-router.
       #   (b) method-anchored decorator regex on backend/app/routers/signage_admin/
       #       blocking POST/GET/PATCH/PUT-tags reintroductions while
       #       allowing the surviving DELETE on /{playlist_id} and the
       #       surviving PUT on /{playlist_id}/items (D-04 allow list).
       # _notify_playlist_changed helper is INTENTIONALLY NOT guarded
       # against (D-04b — surviving DELETE + bulk-PUT still use it).
       # Pre-stack grep — fails in <1s on regression.
       # -----------------------------------------------------------------------
       - name: "Guard — no migrated playlist routes in backend (MIG-SIGN-03)"
         run: |
           # (a) Literal path string check — block reappearance under backend/app/.
           if grep -rnE '"/api/signage/playlists"|"/api/signage/playlists/' backend/app/; then
             echo "ERROR: '/api/signage/playlists' literal found in backend/app/ (Phase 69 — playlist metadata + tags + items GET migrated to Directus collections signage_playlists / signage_playlist_items / signage_playlist_tag_map)."
             exit 1
           fi
           # (b) Method-anchored decorator regex — block POST/GET/PATCH on root
           # and on /{...} (by-id) inside the playlists sub-router file. The
           # surviving file's only decorator is @router.delete which the
           # (post|get|patch) alternation cannot match.
           if grep -rnE '@router\.(post|get|patch)\b[^@]*"/?(\{[^}]+\}|)"?' backend/app/routers/signage_admin/playlists.py; then
             echo "ERROR: forbidden decorator (POST/GET/PATCH) found in backend/app/routers/signage_admin/playlists.py (Phase 69 — only @router.delete survives in this file; CRUD goes through Directus)."
             exit 1
           fi
           # Block @router.put on /{...}/tags anywhere in backend/app/ (the
           # surviving bulk-PUT is on /{...}/items in playlist_items.py — a
           # different path; the /tags suffix is the precise discriminator).
           if grep -rnE '@router\.put\b[^@]*"/?\{[^}]+\}/tags"?' backend/app/routers/signage_admin/; then
             echo "ERROR: @router.put on /{...}/tags found in backend/app/routers/signage_admin/ (Phase 69 — playlist tags PUT migrated to Directus signage_playlist_tag_map FE-driven diff)."
             exit 1
           fi
           echo "OK: no migrated playlist routes in backend/app/"
       ```
    3. Verify the regex precision with manual probes (run locally before commit):
       ```bash
       # (a) literal-path probe
       printf '%s\n' '"/api/signage/playlists"' | grep -E '"/api/signage/playlists"|"/api/signage/playlists/'  # match
       printf '%s\n' '"/api/signage/playlists/abc"' | grep -E '"/api/signage/playlists"|"/api/signage/playlists/'  # match
       printf '%s\n' '"/api/signage/playlists_archive"' | grep -E '"/api/signage/playlists"|"/api/signage/playlists/'  # NO match (no quote-close before non-/ char) — verify
       # (b) decorator probe — surviving file should pass after Plan 69-01.
       grep -rnE '@router\.(post|get|patch)\b' backend/app/routers/signage_admin/playlists.py  # exits 1 (no match)
       grep -rnE '@router\.delete\b' backend/app/routers/signage_admin/playlists.py  # exits 0 (the survivor)
       grep -rnE '@router\.put\b[^@]*"/?\{[^}]+\}/tags"?' backend/app/routers/signage_admin/  # exits 1 (no match)
       grep -rnE '@router\.put\b[^@]*"/?\{[^}]+\}/items"?' backend/app/routers/signage_admin/playlist_items.py  # exits 0 (the survivor)
       ```
    4. Validate YAML: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
    5. Run the guard locally end-to-end against current tree (after Plans 69-01 + 69-02 land): the guard must exit 0 on a clean tree (no regression).
  </action>
  <verify>
    <automated>python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && grep -n "Guard — no migrated playlist routes in backend (MIG-SIGN-03)" .github/workflows/ci.yml && bash -c 'set -e; if grep -rnE "\"/api/signage/playlists\"|\"/api/signage/playlists/" backend/app/; then exit 1; fi; if grep -rnE "@router\.(post|get|patch)\b" backend/app/routers/signage_admin/playlists.py; then exit 1; fi; if grep -rnE "@router\.put\b[^@]*\"/?\{[^}]+\}/tags\"?" backend/app/routers/signage_admin/; then exit 1; fi; echo OK'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Guard — no migrated playlist routes in backend (MIG-SIGN-03)" .github/workflows/ci.yml` exits 0.
    - `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
    - With Plans 69-01 + 69-02 already applied, all three local guard greps exit 1 (no match) — i.e., the guard would currently pass.
    - Manual probe: introducing a sentinel `@router.post("")` into `playlists.py` then re-running the guard must exit 1; remove sentinel before commit.
    - The guard does NOT match the surviving `@router.delete("/{playlist_id}")` in `playlists.py` (decorator probe regex excludes `delete`).
    - The guard does NOT match the surviving `@router.put("/{playlist_id}/items")` in `playlist_items.py` (the /tags-suffix regex excludes /items).
  </acceptance_criteria>
  <done>Method-anchored guard appended to ci.yml; YAML valid; allow clauses for surviving DELETE + bulk-PUT verified by probe.</done>
</task>

</tasks>

<verification>
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
- Local execution of all three guard greps exits 1 on the current tree (no matches).
- Sentinel injection probe (manual) flips each clause to exit 1 individually.
</verification>

<success_criteria>
CI step in place; valid YAML; precision verified — blocks regression while allowing the two surviving FastAPI playlist routes per D-04.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-05-SUMMARY.md` capturing: the exact regexes used, the false-positive guard probes against surviving DELETE + bulk-PUT, and confirmation that `_notify_playlist_changed` is intentionally not guarded.
</output>
