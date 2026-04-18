---
phase: 07-i18n-integration-and-polish
plan: 06
subsystem: testing
tags: [playwright, pytest, docker, rebuild-persistence, smoke-test, i18n]

requires:
  - phase: 07-i18n-integration-and-polish
    provides: ["bootstrap i18n writer (07-02)", "PreferencesCard language picker (07-03)", "NavBar LanguageToggle persistence (07-04)", "DE locale parity (07-05)"]
  - phase: 04-backend-schema-api-and-security
    provides: ["app_settings singleton + logo bytea persistence"]
provides:
  - "Rebuild-persistence harness proving SC4: all 8 settings fields + logo bytes survive docker compose down + up --build"
  - "Re-runnable self-cleaning smoke test at scripts/smoke-rebuild.sh (9-step orchestrator with trap EXIT)"
  - "Playwright config + first e2e spec establishing visual regression scaffolding"
  - "Host-side locale key-parity check wired into the smoke script"
affects: ["future e2e tests", "CI (when introduced)", "developer onboarding smoke validation"]

tech-stack:
  added: []
  patterns:
    - "pytest seed/assert/cleanup trio with module-local autouse override to bypass conftest reset_settings fixture"
    - "trap EXIT cleanup for bash harnesses that mutate shared singleton state"
    - "docker compose up -d --wait (Compose v2.17+) instead of hand-rolled healthcheck polling"
    - "host-side Python locale parity check (frontend files not bind-mounted into api container)"

key-files:
  created:
    - backend/tests/test_rebuild_seed.py
    - backend/tests/test_rebuild_assert.py
    - backend/tests/test_rebuild_cleanup.py
    - frontend/playwright.config.ts
    - frontend/tests/e2e/rebuild-persistence.spec.ts
    - scripts/smoke-rebuild.sh
  modified:
    - frontend/src/bootstrap.ts
    - frontend/src/components/LanguageToggle.tsx
    - frontend/.gitignore

key-decisions:
  - "Base64 literal 1x1 red PNG embedded in seed test (no Pillow dep, deterministic bytes)"
  - "Module-local reset_settings autouse override in assert + cleanup tests — prevents conftest fixture from wiping the state under verification (Research Pitfall 5)"
  - "docker compose down (NO -v) — preserving postgres_data is the whole point of the test (Pitfall 4)"
  - "Locale key parity check runs on host Python, not inside api container — frontend files aren't bind-mounted (Pitfall 6)"
  - "trap cleanup EXIT ensures singleton is reset even on mid-test failure, keeping dev stack recoverable"

patterns-established:
  - "Pattern: Smoke harness = seed pytest -> compose rebuild -> assert pytest -> playwright -> parity -> cleanup"
  - "Pattern: Override conftest autouse fixtures at module level when a test explicitly requires pre-existing state"
  - "Pattern: bootstrap.ts is the sole writer of html[lang] — change listener keeps attribute in sync"

requirements-completed: [I18N-01, I18N-02]

duration: 45min
completed: 2026-04-11
---

# Phase 7 Plan 6: Rebuild Persistence Harness Summary

**End-to-end rebuild-persistence smoke harness proving all branding + i18n state survives `docker compose down && up --build` via pytest seed/assert/cleanup trio, Playwright visual check, and host-side locale parity — closes Phase 7 and satisfies SC4.**

## Performance

- **Duration:** ~45 min (including Rule 2 deviation + post-approval refinement)
- **Completed:** 2026-04-11
- **Tasks:** 4 (3 auto + 1 human-verify)
- **Files created:** 6
- **Files modified:** 3

## Accomplishments

- Authoritative end-to-end proof that `docker compose down && up --build` does NOT nuke any persisted setting: all 6 colors, app_name, default_language, and the uploaded logo bytes (byte-exact) survive.
- Re-runnable smoke test `./scripts/smoke-rebuild.sh` that any future developer can invoke to validate the full stack — with automatic singleton reset on exit.
- First Playwright e2e spec in the codebase, establishing the pattern for future visual regression tests against the running dev stack.
- Bootstrap i18n writer now mirrors the active language onto `<html lang>`, unblocking the Playwright assertion `html[lang=de]` (Rule 2 fix, essential for SC4).
- Post-approval UX refinement: NavBar `LanguageToggle` no longer fires a redundant success toast — the language flip is self-confirming visual feedback.

## Task Commits

1. **Task 1: pytest seed + assert + cleanup trio**
   - `30ba89e` — test(07-06): add rebuild persistence pytest seed/assert/cleanup (all 3 files initial)
   - `cfa55cb` — test(07-06): add rebuild persistence seed/assert/cleanup pytest trio (seed PNG constant fix)
2. **Task 2: Playwright config + rebuild-persistence spec**
   - `7ef0dea` — test(07-06): add Playwright config + rebuild-persistence spec
3. **Task 3: scripts/smoke-rebuild.sh orchestrator**
   - `bdecb2c` — test(07-06): add scripts/smoke-rebuild.sh rebuild persistence harness
   - `4f0e4f9` — chore(07-06): ignore Playwright test-results and report output
4. **Rule 2 deviation (html lang mirror)**
   - `80db6ec` — fix(07-06): mirror i18n language onto <html lang> attribute
5. **Post-approval refinement (NavBar toast polish)**
   - `5d7917b` — fix(07-04): remove success toast from NavBar LanguageToggle
6. **Task 4: Human verification** — APPROVED by user after green harness run.

## Files Created/Modified

### Created
- `backend/tests/test_rebuild_seed.py` — seeds 8 settings fields + deterministic 1x1 red PNG logo; exports `REBUILD_SEED_PAYLOAD` and `RED_1X1_PNG` for reuse by assert test.
- `backend/tests/test_rebuild_assert.py` — re-fetches settings after rebuild, asserts byte-exact equality of all fields + logo bytes. Overrides autouse `reset_settings` to a no-op.
- `backend/tests/test_rebuild_cleanup.py` — PUTs canonical `DEFAULT_SETTINGS` back to the singleton. Called by `trap cleanup EXIT` in the shell orchestrator.
- `frontend/playwright.config.ts` — chromium-only, workers=1, baseURL `http://localhost:5173`, reporter `list`.
- `frontend/tests/e2e/rebuild-persistence.spec.ts` — asserts `html[lang=de]`, German "Einstellungen" heading, NavBar logo alt `Rebuild Test Corp`, and computed `--primary` CSS var equals seeded oklch.
- `scripts/smoke-rebuild.sh` — 9-step orchestrator per D-23: up --wait -> seed -> down (no -v) -> up --build --wait -> assert -> playwright -> locale parity -> cleanup on EXIT.

### Modified
- `frontend/src/bootstrap.ts` — added `document.documentElement.lang = i18n.language` on initial settings fetch AND on every `languageChanged` event, keeping `<html lang>` in sync with the runtime i18n state.
- `frontend/src/components/LanguageToggle.tsx` — removed success toast from mutation onSuccess (post-approval refinement; the visible language flip is self-confirming).
- `frontend/.gitignore` — ignore Playwright `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`.

## Decisions Made

- **Base64 literal PNG seed:** Chose the frozen base64 literal approach over importing Pillow (not a project dep). Deterministic, inline, one-line byte comparison against the exact same constant on the assert side.
- **Module-local `reset_settings` override:** Both the assert and cleanup test modules re-declare `reset_settings` as an autouse no-op fixture, shadowing the session-wide conftest fixture. Without this, the conftest fixture would wipe the persisted state before the assert test can read it (Research Pitfall 5).
- **`docker compose down` (no `-v`):** Explicitly documented in the script with a comment. The entire purpose of the test is to prove `postgres_data` (a named volume) survives a `down`; adding `-v` would nuke it and silently mask any actual persistence bug (Pitfall 4).
- **Host-side locale parity check:** `frontend/src/locales/*.json` is not bind-mounted into the api container, so the `python3 -c "..."` parity check runs on the host, not via `docker compose exec` (Pitfall 6).
- **No `webServer` auto-start in playwright config:** The harness assumes `docker compose up` is already running; a webServer config would double-start and confuse the port.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Bootstrap did not sync `<html lang>` attribute**
- **Found during:** Task 2 (Playwright rebuild-persistence spec authoring) — after writing `await expect(page.locator("html")).toHaveAttribute("lang", "de")`, discovered that `bootstrap.ts` called `i18n.changeLanguage()` but never touched `document.documentElement.lang`. Playwright assertion would fail against a default `lang="en"` set by Vite's template.
- **Issue:** The `<html lang>` attribute is the accessibility contract for screen readers and the canonical locale signal for the whole document. Without it, (a) the Playwright SC4 assertion fails, and (b) assistive tech mispronounces German content.
- **Fix:** Added `document.documentElement.lang = i18n.language` after the initial `changeLanguage()` in `bootstrap.ts`, AND installed a persistent `i18n.on('languageChanged', ...)` listener so any runtime language switch (PreferencesCard, NavBar toggle) also mirrors to `<html lang>`. bootstrap.ts remains the single writer.
- **Files modified:** `frontend/src/bootstrap.ts`
- **Verification:** Playwright spec asserts `html[lang=de]` and passes after rebuild; manual refresh on `/upload` shows `document.documentElement.lang` flipping between `en` and `de` via NavBar toggle.
- **Committed in:** `80db6ec`

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical a11y + test contract).
**Impact on plan:** Essential for SC4 completion and accessibility correctness. Zero scope creep — the fix is 19 lines in exactly one file and strengthens the single-writer invariant established in plan 07-02.

## Post-approval Refinements

After the user approved the human verification checkpoint (Task 4, D-27), a small UX polish was committed in the same phase:

**`5d7917b` — fix(07-04): remove success toast from NavBar LanguageToggle**
- **Rationale:** The NavBar `LanguageToggle` was firing a success toast on every language switch, but the entire UI flipping language is itself self-confirming feedback. The toast was redundant and slightly noisy after 07-04's pessimistic mutation flow landed.
- **Scope:** One-line deletion in `LanguageToggle.tsx` (no test changes, no regressions).
- **Why logged against 07-04:** The file was introduced in plan 07-04; the commit is a direct refinement of that plan's UX pattern. Documented here in the 07-06 summary because it was discovered and shipped during 07-06 finalization.

## Issues Encountered

- **PNG constant initial mismatch:** First seed test commit (`30ba89e`) had a base64 literal whose bytes did not match the frozen `RED_1X1_PNG` constant used by the assert import. Regenerated via Pillow one-liner on host, re-froze, and committed fix in `cfa55cb`. No behavior impact — caught by the acceptance-criteria header check before the rebuild loop.
- **`.gitignore` missing Playwright artifacts:** First dry run of the harness left untracked `test-results/` and `playwright-report/` directories in git status. Added to `frontend/.gitignore` in `4f0e4f9`.

## Harness Run Result (pre-approval)

```
[smoke-rebuild] Starting stack (preserves postgres_data)...
[smoke-rebuild] Seeding test state (8 fields + 1x1 red PNG)...
[smoke-rebuild] Stopping containers (volume persists)...
[smoke-rebuild] Rebuilding images and restarting...
[smoke-rebuild] Asserting DB persistence after rebuild...
[smoke-rebuild] Running Playwright visual check...
[smoke-rebuild] Checking locale key parity (en.json vs de.json)...
[smoke-rebuild] Cleanup: resetting app_settings singleton to defaults...
[smoke-rebuild] ✓ Rebuild persistence verified
EXIT=0
```

User approved the 7-step human verification checklist (D-27). SC4 confirmed.

## User Setup Required

None — no new external services; Playwright chromium was installed on the host during plan 07-01.

## Next Phase Readiness

Phase 07 (i18n integration and polish) is COMPLETE. All 6 plans (07-01 through 07-06) have landed SUMMARY files. Milestone v1.1 (Branding & Settings) is fully delivered:

- SC1 — i18n bootstrap with no language flash ✓ (07-02)
- SC2 — Settings page language picker with live preview + draft flow ✓ (07-03)
- SC3 — NavBar LanguageToggle persists via single PUT ✓ (07-04) + post-approval toast polish (`5d7917b`)
- SC4 — docker compose rebuild preserves all persisted settings ✓ (07-06, this plan)

**No known blockers.** `./scripts/smoke-rebuild.sh` is available as an ongoing smoke test for future phases.

**Requirements closed:** I18N-01 (full German locale with informal du tone, delivered in 07-05 and verified here), I18N-02 (rebuild-persistence harness, this plan).

## Self-Check: PASSED

All 9 created/modified files present on disk. All 7 commit hashes (30ba89e, cfa55cb, 7ef0dea, bdecb2c, 4f0e4f9, 80db6ec, 5d7917b) present in git history.

---
*Phase: 07-i18n-integration-and-polish*
*Completed: 2026-04-11*
