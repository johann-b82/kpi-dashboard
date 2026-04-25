---
phase: 68-mig-sign-tags-schedules
plan: 04
subsystem: signage-frontend
tags: [migration, directus-sdk, signage, frontend, tags, schedules]
requires:
  - "Phase 67 D-01 inline-swap pattern (signageApi adapter style)"
  - "@/lib/directusClient singleton (Phase 64)"
  - "signage_device_tags + signage_schedules collections exposed via Directus (Phase 65)"
provides:
  - "Tag CRUD via Directus SDK (listTags/createTag/updateTag/deleteTag)"
  - "Schedule CRUD via Directus SDK (listSchedules/createSchedule/updateSchedule/deleteSchedule)"
  - "Public signatures of signageApi tag + schedule methods unchanged (D-00g)"
affects:
  - "frontend/src/signage/lib/signageApi.ts"
tech_stack_added: []
tech_stack_patterns:
  - "directus.request(readItems/createItem/updateItem/deleteItem(...)) inline-swap"
  - "Collection field allowlist constant (SCHEDULE_FIELDS) mirroring TS row type"
key_files_created: []
key_files_modified:
  - "frontend/src/signage/lib/signageApi.ts"
decisions:
  - "Used @/lib/directusClient (verified codebase canonical path) instead of plan-listed @/lib/directus — singleton import path matches Phases 64/66/67"
  - "Added updateTag + deleteTag (D-04 covers all 4 tag verbs); FastAPI tag surface removed in Plan 01 so any future caller must go through Directus"
  - "SCHEDULE_FIELDS allowlist constant defined once and spread into every Directus schedule call to keep payload shape stable and prevent over-fetching"
metrics:
  duration: "~2m"
  completed: "2026-04-25"
  tasks: 2
  files: 1
requirements:
  - MIG-SIGN-01
  - MIG-SIGN-02
---

# Phase 68 Plan 04: Frontend signageApi Directus SDK Swap Summary

**One-liner:** Inline-swapped 8 signage tag + schedule CRUD methods in `signageApi.ts` from FastAPI `apiClient(...)` to `directus.request(readItems/createItem/updateItem/deleteItem(...))`, preserving public signatures so all consumers compile and run unchanged.

## What Was Built

### Tag CRUD (4 methods)

- `listTags()` → `readItems("signage_device_tags", { fields: ["id","name"], sort: ["id"], limit: -1 })`
- `createTag(name)` → `createItem("signage_device_tags", { name }, { fields: ["id","name"] })`
- `updateTag(id, name)` → `updateItem("signage_device_tags", id, { name }, ...)` (newly added)
- `deleteTag(id)` → `deleteItem("signage_device_tags", id)` (newly added)

Collection name is `signage_device_tags` (verified `directus/snapshots/v1.22.yaml:43`), NOT `signage_tags`.

### Schedule CRUD (4 methods)

- `listSchedules()` → `readItems("signage_schedules", { fields: SCHEDULE_FIELDS, sort: ["-priority","-updated_at"], limit: -1 })` — preserves FastAPI sort contract.
- `createSchedule(body)` / `updateSchedule(id, body)` / `deleteSchedule(id)` — straightforward SDK swaps.
- Inverted-range writes (start_hhmm >= end_hhmm) now surface as `DirectusError` carrying the Plan 02 validation hook's i18n key.
- New `SCHEDULE_FIELDS` allowlist constant mirrors the `SignageSchedule` TS row type.

### Imports

Added at top of `signageApi.ts`:
```ts
import { directus } from "@/lib/directusClient";
import { readItems, createItem, updateItem, deleteItem } from "@directus/sdk";
```

## Decisions Made

1. **Directus client import path:** Plan listed `@/lib/directus`, but the actual canonical singleton in this repo is `@/lib/directusClient` (verified — used by `auth/AuthContext.tsx`, `auth/useCurrentUserProfile.ts`, `signage/components/MediaUploadDropZone.tsx`). Used the verified path; documented as a plan-text deviation only (no behavioral change).
2. **Add updateTag + deleteTag:** No current consumer (`grep -rn "signageApi\.updateTag\|signageApi\.deleteTag" frontend/src/` returned 0). Added them anyway because D-04 explicitly covers all 4 tag verbs and the FastAPI tag surface is being removed in Plan 01 — any future Tag-management UI must route through Directus, and having the adapter ready avoids a future round-trip.
3. **`SCHEDULE_FIELDS` allowlist as a `const` array:** Defined once near the top of the file rather than inlined per call. Keeps payload shape consistent and makes a future schema field addition a one-line change.

## Deviations from Plan

### Plan-text adjustments (no behavior change)

**1. [Rule 3 - Blocking] Directus client import path**
- **Found during:** Task 1 setup
- **Issue:** Plan specified `import { directus } from "@/lib/directus"`, but `frontend/src/lib/directus.ts` does not exist. Canonical singleton lives at `frontend/src/lib/directusClient.ts`.
- **Fix:** Used `@/lib/directusClient` — matches Phases 64/66/67 convention.
- **Files:** `frontend/src/signage/lib/signageApi.ts`
- **Commit:** `eaa1110`

### Plan verification regex (cosmetic)

The plan's Task 2 acceptance regex `(read|create|update|delete)Item\("signage_schedules"` only matches 3 of 4 calls because the SDK function is `readItems` (plural) — the regex matches `readItem` then expects `(` next char, but the file has `readItems(`. The spirit of the criterion is met: all 4 operations route through SDK helpers (`grep -cE '(readItems|createItem|updateItem|deleteItem)\("signage_schedules"' = 4`). No code change needed.

## Verification Results

- `grep -nE 'apiClient.*signage/tags' src/signage/lib/signageApi.ts` → no match (exit 1) ✓
- `grep -nE 'apiClient.*signage/schedules' src/signage/lib/signageApi.ts` → no match (exit 1) ✓
- `grep -n 'readItems("signage_device_tags"' …` → exit 0 ✓
- `grep -n 'createItem("signage_device_tags"' …` → exit 0 ✓
- `grep -cE '(readItems|createItem|updateItem|deleteItem)\("signage_schedules"' …` → 4 ✓
- `cd frontend && npx tsc --noEmit` → exit 0 ✓
- `cd frontend && npm test -- --run ScheduleEditDialog` → 8/8 pass ✓
- `cd frontend && npm test -- --run signage` → 65/65 pass across 6 files ✓

## Consumer Impact

Zero. All 8 public function signatures are unchanged:

| Method                      | Before                                    | After                                    | Signature changed? |
| --------------------------- | ----------------------------------------- | ---------------------------------------- | ------------------ |
| `listTags()`                | `Promise<SignageTag[]>`                   | `Promise<SignageTag[]>`                  | No                 |
| `createTag(name)`           | `Promise<SignageTag>`                     | `Promise<SignageTag>`                    | No                 |
| `updateTag(id, name)`       | (did not exist)                           | `Promise<SignageTag>`                    | New (additive)     |
| `deleteTag(id)`             | (did not exist)                           | `Promise<null>`                          | New (additive)     |
| `listSchedules()`           | `Promise<SignageSchedule[]>`              | `Promise<SignageSchedule[]>`             | No                 |
| `createSchedule(body)`      | `Promise<SignageSchedule>`                | `Promise<SignageSchedule>`               | No                 |
| `updateSchedule(id, body)`  | `Promise<SignageSchedule>`                | `Promise<SignageSchedule>`               | No                 |
| `deleteSchedule(id)`        | `Promise<null>`                           | `Promise<null>`                          | No                 |

Files NOT touched (intentional, per D-00g): `SchedulesPage.tsx`, `ScheduleEditDialog.tsx`, `TagPicker.tsx`, schedule adapter modules.

## Commits

- `eaa1110` — feat(68-04): swap signage tag CRUD to Directus SDK
- `0c6aefd` — feat(68-04): swap signage schedule CRUD to Directus SDK

## Known Stubs

None. No hardcoded empty values, no placeholder text, no unwired components introduced.

## Self-Check: PASSED

- Modified file exists: `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/signage/lib/signageApi.ts` ✓
- Commit `eaa1110` exists in git log ✓
- Commit `0c6aefd` exists in git log ✓
