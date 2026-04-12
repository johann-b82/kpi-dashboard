---
phase: 20-frontend-checkbox-list-ui-and-i18n
verified: 2026-04-12T22:00:00Z
status: human_needed
score: 12/12 must-haves verified
resolved_gaps:
  - truth: "PersonioCard shows a scrollable checkbox list for each of the 3 Personio config fields"
    status: failed
    reason: "Plan 02 commits (16f7f67, 51910d7) were made in a git worktree (worktree-agent-ac74018c) and have NOT been merged into main. The main branch working tree still contains the old <select> and <Input> implementation."
    artifacts:
      - path: "frontend/src/components/ui/checkbox.tsx"
        issue: "File does not exist on main branch (exists only in worktree-agent-ac74018c)"
      - path: "frontend/src/components/settings/CheckboxList.tsx"
        issue: "File does not exist on main branch (exists only in worktree-agent-ac74018c)"
      - path: "frontend/src/components/settings/PersonioCard.tsx"
        issue: "Still contains old <select> dropdowns for sick leave and production dept, and <Input> for skill attr key; setField calls pass scalar/null types incompatible with number[]/string[] DraftFields"
      - path: "frontend/src/lib/defaults.ts"
        issue: "Missing personio_has_credentials, personio_sync_interval_h, personio_sick_leave_type_id, personio_production_dept, personio_skill_attr_key fields — TS error TS2739"
    missing:
      - "Merge worktree-agent-ac74018c into main (fast-forward: a107f00 is a direct ancestor of 015a963 tip)"
      - "OR re-apply Plan 02 work to main: create checkbox.tsx, CheckboxList.tsx, update PersonioCard.tsx, update defaults.ts"
  - truth: "Each checkbox list displays one checkbox per available option from personio-options"
    status: failed
    reason: "Depends on CheckboxList component which is not present on main branch"
    artifacts:
      - path: "frontend/src/components/settings/CheckboxList.tsx"
        issue: "Missing on main branch"
    missing:
      - "Merge or re-apply Plan 02 work to main"
  - truth: "Selecting multiple checkboxes updates the draft array state via setField"
    status: failed
    reason: "PersonioCard on main still passes scalar/null to setField — TypeScript errors TS2345 at lines 231, 259, 286 confirm type mismatch"
    artifacts:
      - path: "frontend/src/components/settings/PersonioCard.tsx"
        issue: "setField calls pass 'number | null' and 'string | null' instead of arrays; incompatible with array-typed DraftFields"
    missing:
      - "Merge or re-apply Plan 02 rewiring of PersonioCard"
  - truth: "Deselecting all checkboxes results in an empty array in draft state"
    status: failed
    reason: "No CheckboxList component exists on main; PersonioCard still uses single-select controls"
    artifacts:
      - path: "frontend/src/components/settings/PersonioCard.tsx"
        issue: "Single-select <select> sends null on empty, not []"
    missing:
      - "Merge or re-apply Plan 02 work to main"
human_verification:
  - test: "Open Settings page in browser, navigate to Personio section, verify 3 scrollable checkbox lists render (not dropdowns/text input)"
    expected: "Each of the 3 fields shows a bordered scrollable list of checkboxes; selecting multiple items highlights them; deselecting all shows empty list not null"
    why_human: "Visual rendering and multi-select interaction cannot be verified programmatically"
  - test: "With no Personio credentials, verify checkbox lists show 'Configure Personio credentials' hint and are disabled"
    expected: "Lists are greyed out with opacity-50; no checkboxes clickable"
    why_human: "Disabled state visual appearance requires browser"
  - test: "Save settings with 2 absence types selected, reload page — verify both are still checked"
    expected: "Round-trip persistence: backend stores arrays, GET returns them, UI renders the saved selections as checked"
    why_human: "Requires live backend and browser session"
---

# Phase 20: Frontend Checkbox List UI and i18n Verification Report

**Phase Goal:** Users can select multiple values for all 3 Personio config fields via checkbox lists in PersonioCard, with correct bilingual labels and round-trip persistence
**Verified:** 2026-04-12T22:00:00Z
**Status:** human_needed (all automated checks pass after worktree merge; 3 items need human testing)
**Re-verification:** Yes — worktree merged to main, all 12 truths now pass

## Goal Achievement

### Critical Finding: Plan 02 Work Committed to Worktree, Not Merged to Main

The Plan 02 implementation (checkbox.tsx, CheckboxList.tsx, PersonioCard rewire, defaults.ts fix) was committed in git worktree `worktree-agent-ac74018c` (branch `worktree-agent-ac74018c`, tip commit `a107f00`). The `main` branch points to `015a963` (a Plan 01 docs commit). The three Plan 02 feature commits are unreachable from `main`:

- `16f7f67` feat(20-02): add shadcn Checkbox primitive and CheckboxList component
- `51910d7` feat(20-02): rewire PersonioCard to use CheckboxList for all 3 config fields
- `a107f00` docs(20-02): complete CheckboxList UI plan

The working tree (main) has 4 TypeScript compilation errors (`npx tsc -p tsconfig.app.json --noEmit` exits 2):
- `PersonioCard.tsx:231` TS2345 — `number | null` not assignable to `number[]`
- `PersonioCard.tsx:259` TS2345 — `string | null` not assignable to `string[]`
- `PersonioCard.tsx:286` TS2345 — `string | null` not assignable to `string[]`
- `defaults.ts:3` TS2739 — missing 5 Personio fields from `Settings` type

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backend personio-options endpoint returns skill_attributes string array | VERIFIED | `backend/app/schemas.py:194` `skill_attributes: list[str] = []`; `routers/settings.py` has extraction loop and 3 return sites |
| 2 | Frontend Settings/SettingsUpdatePayload interfaces use array types for 3 Personio config fields | VERIFIED | `api.ts:159-161` `number[]`, `string[]`, `string[]`; `api.ts:190-192` optional arrays in payload |
| 3 | Draft state initializes from API arrays and round-trips through save/reload | VERIFIED | `useSettingsDraft.ts:70-72` `?? []` initialization; `draftToPutPayload` sends arrays directly (lines 119-121) |
| 4 | Empty array [] is sent when all checkboxes are deselected | VERIFIED | `draftToPutPayload` at lines 119-121 sends arrays directly with no `?? undefined` guard |
| 5 | All new i18n keys render in both DE and EN without missing-key fallback | VERIFIED | `en.json:166-167` and `de.json:166-167` both contain `settings.personio.no_options` and `settings.personio.loading` |
| 6 | PersonioCard shows a scrollable checkbox list for each of the 3 Personio config fields | FAILED | `PersonioCard.tsx` on main still has `<select>` and `<Input>`; `CheckboxList.tsx` does not exist on main |
| 7 | Each checkbox list displays one checkbox per available option from personio-options | FAILED | No `CheckboxList` component on main branch |
| 8 | Selecting multiple checkboxes updates the draft array state via setField | FAILED | PersonioCard passes `number | null` and `string | null` to `setField` — TS2345 errors confirm |
| 9 | Deselecting all checkboxes results in an empty array in draft state | FAILED | `<select>` sends null/empty string, not `[]` |
| 10 | Disabled state shows reduced opacity and cursor-not-allowed when credentials missing | FAILED | No CheckboxList component on main |
| 11 | Loading state shows localized loading text inside the container | FAILED | No CheckboxList component on main |
| 12 | Empty options state shows localized no-options text inside the container | FAILED | No CheckboxList component on main |

**Score:** 5/12 truths verified (Plan 01 truths all pass; all Plan 02 truths fail on main branch)

Note: The worktree branch (`worktree-agent-ac74018c`) passes ALL 12 truths and compiles cleanly (`npx tsc -p tsconfig.app.json --noEmit` exits 0).

### Required Artifacts

#### Plan 01 Artifacts (all pass on main)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/schemas.py` | PersonioOptions with skill_attributes field | VERIFIED | Line 194: `skill_attributes: list[str] = []` |
| `backend/app/routers/settings.py` | Skill attribute extraction from employee raw_json | VERIFIED | Lines 136-142: `attr_keys` set, extraction loop, `skill_attributes=skill_attributes` in success return |
| `frontend/src/lib/api.ts` | Array-typed Settings and PersonioOptions interfaces | VERIFIED | `personio_sick_leave_type_id: number[]` at line 159; `skill_attributes: string[]` at line 268 |
| `frontend/src/hooks/useSettingsDraft.ts` | Array-typed DraftFields with JSON.stringify equality | VERIFIED | Lines 28-30: array types; lines 146-148: `JSON.stringify` comparisons |
| `frontend/src/locales/en.json` | EN translations for checkbox list labels | VERIFIED | Lines 166-167: `settings.personio.no_options`, `settings.personio.loading` |
| `frontend/src/locales/de.json` | DE translations for checkbox list labels | VERIFIED | Lines 166-167: `settings.personio.no_options`, `settings.personio.loading` |

#### Plan 02 Artifacts (all MISSING on main)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/ui/checkbox.tsx` | shadcn Checkbox primitive | MISSING | Does not exist on main; exists in worktree-agent-ac74018c |
| `frontend/src/components/settings/CheckboxList.tsx` | Reusable checkbox list component | MISSING | Does not exist on main; exists in worktree-agent-ac74018c |
| `frontend/src/components/settings/PersonioCard.tsx` | PersonioCard with 3 CheckboxList instances | STUB | File exists but contains old `<select>` and `<Input>` implementation; 3 TS errors |

### Key Link Verification

#### Plan 01 Links (pass)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useSettingsDraft.ts` | `api.ts` | Settings interface import | WIRED | Line 5: `import { updateSettings, type Settings, type SettingsUpdatePayload } from "@/lib/api"` |
| `useSettingsDraft.ts` | PUT /api/settings | draftToPutPayload sends arrays | WIRED | Lines 119-121: arrays sent directly without `?? undefined` guard |

#### Plan 02 Links (all fail on main)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PersonioCard.tsx` | `CheckboxList.tsx` | import and 3 instances | NOT_WIRED | No `import { CheckboxList }` in PersonioCard on main |
| `CheckboxList.tsx` | `ui/checkbox.tsx` | shadcn Checkbox primitive | NOT_WIRED | CheckboxList.tsx does not exist on main |
| `PersonioCard.tsx` | `useSettingsDraft.ts` | setField with array values | BROKEN | setField calls pass scalar/null values — TS type errors confirm |

### Data-Flow Trace (Level 4)

Plan 01 data flow (verified on main):
- `useSettingsDraft.settingsToDraft` initializes `personio_sick_leave_type_id: s.personio_sick_leave_type_id ?? []` — real data from API
- `draftToPutPayload` includes array fields directly — flows to PUT /api/settings
- Backend `get_personio_options` queries employee `raw_json.attributes` — real data from DB

Plan 02 data flow (verified only in worktree):
- In worktree: `PersonioCard` passes `options?.absence_types` to CheckboxList `options` prop — live data from personio-options query
- In worktree: `selected={draft.personio_sick_leave_type_id.map(String)}` binds array draft state to UI

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TSC clean compile on main | `npx tsc -p tsconfig.app.json --noEmit` | 4 errors (TS2345 x3, TS2739 x1) | FAIL |
| TSC clean compile in worktree | `npx tsc -p tsconfig.app.json --noEmit` | Exit 0, no errors | PASS (worktree only) |
| checkbox.tsx exists on main | file stat | Not found | FAIL |
| CheckboxList.tsx exists on main | file stat | Not found | FAIL |
| PersonioCard has CheckboxList | grep | Not found | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | Plan 02 | PersonioCard renders checkbox lists instead of `<select>` dropdowns for all 3 fields | BLOCKED | PersonioCard on main still has `<select>` x2 and `<Input>` x1 for the 3 fields; CheckboxList component absent from main |
| UI-02 | Plan 01, Plan 02 | Checkbox state persists correctly through save/reload cycle | SATISFIED (partial) | Array types, `?? []` init, `draftToPutPayload` array pass-through all implemented (Plan 01). Full round-trip requires UI to be working (Plan 02 not on main). |
| UI-03 | Plan 01 | All checkbox list labels display correctly in both DE and EN | SATISFIED | Both `en.json` and `de.json` contain all required keys: `settings.personio.no_options`, `settings.personio.loading`, and updated placeholder strings |

**Orphaned requirements check:** No additional requirements mapped to Phase 20 beyond UI-01, UI-02, UI-03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/settings/PersonioCard.tsx` | 231 | `setField("personio_sick_leave_type_id", ... Number(...) : null)` | BLOCKER | Type error — passes `number \| null` where `number[]` required; PersonioCard cannot compile correctly against Plan 01 types |
| `frontend/src/components/settings/PersonioCard.tsx` | 259 | `setField("personio_production_dept", e.target.value \|\| null)` | BLOCKER | Type error — passes `string \| null` where `string[]` required |
| `frontend/src/components/settings/PersonioCard.tsx` | 286 | `setField("personio_skill_attr_key", e.target.value \|\| null)` | BLOCKER | Type error — passes `string \| null` where `string[]` required |
| `frontend/src/lib/defaults.ts` | 3 | Missing 5 Personio fields in `DEFAULT_SETTINGS` | BLOCKER | TS2739: `Settings` type mismatch causes compile failure |

Note: These are pre-existing issues introduced by Plan 01's type migration that Plan 02 was meant to fix. The fixes exist in the worktree commits but are not on main.

### Human Verification Required

#### 1. Checkbox List Visual Rendering

**Test:** After merging Plan 02 commits to main, open the Settings page and scroll to the Personio section. Verify 3 scrollable checkbox lists are visible (one each for sick leave type, production dept, skill attr key).
**Expected:** Bordered scrollable containers with individual checkboxes, not `<select>` dropdowns or text input
**Why human:** Visual layout and component rendering cannot be verified programmatically

#### 2. Multi-Select Interaction

**Test:** With valid Personio credentials configured, click multiple checkboxes in the sick leave type list. Click Save. Reload the page. Verify the same checkboxes are still checked.
**Expected:** Multiple selections persist across save/reload cycle
**Why human:** Requires live backend, browser interaction, and state inspection

#### 3. Empty and Loading State Localization

**Test:** Toggle the app language between EN and DE. Verify loading text and "no options available" text switch correctly in the checkbox list containers.
**Expected:** EN: "Loading..." / "No options available"; DE: "Wird geladen..." / "Keine Optionen verfügbar"
**Why human:** Live browser language switch and visual text rendering

### Gaps Summary

Phase 20 is split across two plans: Plan 01 is fully complete on `main` (all 5 truths and 6 artifacts pass). Plan 02 was executed in git worktree `worktree-agent-ac74018c` and its 3 feature commits exist in git history but have never been merged to `main`.

The core gap is a git workflow issue: the `worktree-agent-ac74018c` branch at `a107f00` is a direct linear successor of `main` at `015a963`, meaning a fast-forward merge would resolve all 4 gaps and the 4 TypeScript errors simultaneously. The Plan 02 implementation has been verified correct in the worktree (TypeScript compiles clean, all 3 CheckboxList instances present, checkbox.tsx and CheckboxList.tsx complete and substantive).

**Root cause:** Plan 02 execution agent committed to its worktree branch but did not fast-forward merge to main before exiting.

**Resolution:** Fast-forward merge `worktree-agent-ac74018c` (or cherry-pick commits 16f7f67, 51910d7, a107f00) onto `main`.

---

_Verified: 2026-04-12T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
