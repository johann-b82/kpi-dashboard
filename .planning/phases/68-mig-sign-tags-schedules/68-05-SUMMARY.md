---
phase: 68-mig-sign-tags-schedules
plan: 05
subsystem: signage-frontend
tags: [migration, signage, frontend, schedules, validation, i18n, directus]
requires:
  - "Plan 02 Directus Flow validation hook emitting code 'schedule_end_before_start'"
  - "Plan 04 Directus SDK swap in signageApi (errors now flow from Directus, not FastAPI)"
  - "i18n key 'signage.admin.schedules.error.start_after_end' present in EN+DE since Phase 52"
provides:
  - "Server-side Directus error → inline i18n key mapping in ScheduleEditDialog"
  - "Defense-in-depth path so reversed-range writes from any client surface translated message"
affects:
  - "frontend/src/signage/components/ScheduleEditDialog.tsx"
  - "frontend/src/signage/components/ScheduleEditDialog.test.tsx"
tech_stack_added: []
tech_stack_patterns:
  - "Directus error-shape detection: dual match on Error.message JSON + SDK { errors: [{ extensions: { code } }] }"
  - "onError → setErrors (no toast) for known coded validation rejections"
key_files_created: []
key_files_modified:
  - "frontend/src/signage/components/ScheduleEditDialog.tsx"
  - "frontend/src/signage/components/ScheduleEditDialog.test.tsx"
decisions:
  - "Helper isScheduleEndBeforeStartError matches both message-string (Plan 02 throws JSON.stringify({code})) AND Directus SDK shape — robust to either rejection path"
  - "When matched, suppress toast and route to inline form error (errors.time) — matches existing client-side validator UX"
  - "i18n key mirrored EN+DE; no new keys added (key existed since Phase 52)"
metrics:
  duration: "~3m"
  completed: "2026-04-25"
  tasks: 2
  files: 2
requirements:
  - MIG-SIGN-02
---

# Phase 68 Plan 05: Frontend Schedule Validation UX Summary

**One-liner:** Mapped the Directus Flow validation error code `schedule_end_before_start` (Plan 02) to the existing i18n key `signage.admin.schedules.error.start_after_end` in `ScheduleEditDialog`, surfacing a translated inline error (no toast) when reversed-range writes round-trip from the server.

## What Was Built

### Helper (1 function)

`isScheduleEndBeforeStartError(err: unknown): boolean` — exported-style top-level helper that returns `true` when either:

1. `err.message` (or `String(err)`) contains the literal `schedule_end_before_start` (covers `new Error(JSON.stringify({ code: "schedule_end_before_start" }))` thrown by the Plan 02 Directus Flow), OR
2. `err.errors[].extensions.code === "schedule_end_before_start"` (covers the canonical `@directus/sdk` error envelope shape).

### Mutation onError mapping (2 mutations)

Both `createMutation.onError` and `updateMutation.onError` now branch:

```ts
if (isScheduleEndBeforeStartError(err)) {
  setErrors((prev) => ({
    ...prev,
    time: "signage.admin.schedules.error.start_after_end",
  }));
  setTouched((prev) => ({ ...prev, time: true }));
  return; // no toast
}
// existing toast path unchanged for everything else
```

### Tests (2 new cases)

Added to `ScheduleEditDialog.test.tsx` in the existing
`describe("ScheduleEditDialog — validation + quick-picks (D-12, D-05, D-11)")` block:

1. `renders friendly inline error when Directus rejects with schedule_end_before_start (Phase 68 MIG-SIGN-02 — create)` — mocks `signageApi.createSchedule` to reject with `new Error(JSON.stringify({ code: "schedule_end_before_start" }))`; submits a valid client-side form; asserts the EN string "Start time must be before end time." renders inline AND that `toast.error` was NOT called.
2. `renders friendly inline error when Directus rejects with schedule_end_before_start (Phase 68 MIG-SIGN-02 — update via SDK error shape)` — mocks `signageApi.updateSchedule` to reject with the canonical Directus SDK envelope `{ errors: [{ extensions: { code: "schedule_end_before_start" } }] }`; same assertion pair. Exercises the second branch of `isScheduleEndBeforeStartError`.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Helper present | `grep -nE "schedule_end_before_start" frontend/src/signage/components/ScheduleEditDialog.tsx` | exits 0 |
| EN locale key | `grep -n "start_after_end" frontend/src/locales/en.json` | line 388 |
| DE locale key | `grep -n "start_after_end" frontend/src/locales/de.json` | line 388 |
| EN/DE parity | `python3 -c "import json; en=json.load(...); de=json.load(...); assert set(en.keys())==set(de.keys())"` | parity OK |
| Type-check | `cd frontend && npx tsc --noEmit` | exits 0 |
| Test suite | `cd frontend && npm test -- --run ScheduleEditDialog` | 10/10 pass |

## Decisions Made

- **D-1: Dual-shape error detector.** Plan 02 throws a plain `Error` with a JSON-stringified payload, but the Directus SDK can also surface raw `{ errors: [...] }` objects from non-Flow rejections. Matching both keeps the dialog robust to either path without coupling to one error-emission style.
- **D-2: Suppress toast on mapped code.** The existing client-side validator UX renders inline `errors.time` for time-related issues — preserving that pattern for the server fallback keeps the user mental model consistent. The generic `save_failed` toast remains for any other rejection.
- **D-3: No new i18n keys.** Key already existed in EN+DE since Phase 52 (reserved for backend-error surfacing per the D-07 client validator decision). Reusing it avoids parity drift hazard #1.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 (TDD red/green) collapsed into a single test commit + single feat commit since both new test cases naturally belong in the same RED phase.

## Commits

- `5887bc3` — test(68-05): add failing test for Directus schedule_end_before_start error mapping (RED — 2 test cases)
- `a9b7c18` — feat(68-05): map Directus schedule_end_before_start to inline i18n error (GREEN — helper + onError mapping)

## Self-Check: PASSED

- FOUND: frontend/src/signage/components/ScheduleEditDialog.tsx (modified, helper present)
- FOUND: frontend/src/signage/components/ScheduleEditDialog.test.tsx (modified, 2 new test cases)
- FOUND: 5887bc3 (test commit)
- FOUND: a9b7c18 (feat commit)
- FOUND: i18n parity check passes (EN keys == DE keys)
- FOUND: 10/10 ScheduleEditDialog tests pass
- FOUND: tsc --noEmit clean
