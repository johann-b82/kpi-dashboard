---
phase: 68-mig-sign-tags-schedules
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements: [MIG-SIGN-01, MIG-SIGN-02]

must_haves:
  truths:
    - "signageApi.listTags / createTag / updateTag / deleteTag fetch from Directus signage_device_tags collection (no apiClient call)"
    - "signageApi.listSchedules / createSchedule / updateSchedule / deleteSchedule fetch from Directus signage_schedules collection"
    - "Public function signatures of all 8 functions are unchanged — consumer files (SchedulesPage, ScheduleEditDialog, TagPicker) compile and run unchanged"
  artifacts:
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "Inline-swapped tag + schedule CRUD via Directus SDK"
      contains: "directus.request(readItems(\"signage_device_tags\""
  key_links:
    - from: "signageApi.ts"
      to: "Directus collections"
      via: "directus.request(readItems/createItem/updateItem/deleteItem(...))"
      pattern: "directus\\.request\\((read|create|update|delete)Item"
---

<objective>
Inline-swap the tag + schedule functions in `frontend/src/signage/lib/signageApi.ts` from `apiClient(...)` calls to Directus SDK `directus.request(...)` (D-07). Public function signatures stay identical (D-00g) — consumers do not change.

Purpose: MIG-SIGN-01 + MIG-SIGN-02 frontend leg. Mirrors the Phase 67 D-01 inline-swap pattern.

Output: Single-file edit of `signageApi.ts`. No new modules, no consumer changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@.planning/phases/67-migrate-data-py-sales-employees-split/67-CONTEXT.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/api.ts

<interfaces>
Currently `signageApi.ts` exports for tags: `listTags`, `createTag` (no `updateTag` / `deleteTag` — verified by Read). Plan scope (D-04) covers ALL 4 tag verbs. Add `updateTag` + `deleteTag` if any UI needs them; otherwise document deferral in SUMMARY.

Schedule exports: `listSchedules`, `createSchedule`, `updateSchedule`, `deleteSchedule` — all 4 swap.

Directus client + SDK helpers (Phase 67 path — verify with grep):
```ts
import { directus } from "@/lib/directus";
import { readItems, createItem, updateItem, deleteItem } from "@directus/sdk";
```

Collection names (verified in `directus/snapshots/v1.22.yaml`):
- Tags = `signage_device_tags` (NOT `signage_tags` — line 43 of snapshot).
- Schedules = `signage_schedules`.

Type shapes (already mirror Pydantic *Read per Phase 65 AUTHZ): `SignageTag = {id: number, name: string}`. `SignageSchedule` = full row including timestamps. Hand-maintained per D-00h.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Swap listTags + createTag (and add updateTag + deleteTag if needed) to Directus SDK</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/lib/api.ts
    - frontend/src/signage/lib/signageTypes.ts
    - directus/snapshots/v1.22.yaml lines 418-470
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-00g, D-04, D-07)
  </read_first>
  <behavior>
    - listTags() returns `SignageTag[]` ordered by id ascending.
    - createTag(name) returns the new `SignageTag`; duplicate name surfaces a DirectusError.
    - updateTag(id, name) PATCHes name; returns updated `SignageTag`.
    - deleteTag(id) deletes row; resolves to null on success; FK violation surfaces as DirectusError.
  </behavior>
  <action>
    1. Add imports at the top of `signageApi.ts` (path verified against `frontend/src/lib/api.ts` from Phase 67):
       ```ts
       import { directus } from "@/lib/directus";
       import { readItems, createItem, updateItem, deleteItem } from "@directus/sdk";
       ```
    2. Replace `listTags`:
       ```ts
       listTags: () =>
         directus.request(
           readItems("signage_device_tags", {
             fields: ["id", "name"],
             sort: ["id"],
             limit: -1,
           }),
         ) as Promise<SignageTag[]>,
       ```
    3. Replace `createTag`:
       ```ts
       createTag: (name: string) =>
         directus.request(
           createItem("signage_device_tags", { name }, { fields: ["id", "name"] }),
         ) as Promise<SignageTag>,
       ```
    4. `grep -rn "signageApi\.updateTag\|signageApi\.deleteTag" frontend/src/`. If a consumer exists or the admin Tags surface needs them, add:
       ```ts
       updateTag: (id: number, name: string) =>
         directus.request(
           updateItem("signage_device_tags", id, { name }, { fields: ["id", "name"] }),
         ) as Promise<SignageTag>,
       deleteTag: (id: number) =>
         directus.request(deleteItem("signage_device_tags", id)) as Promise<null>,
       ```
       If no consumer exists, document the deferral in SUMMARY (FastAPI surface is gone after Plan 01, so any future use must go through Directus).
  </action>
  <verify>
    <automated>cd frontend && grep -nE "apiClient.*signage/tags" src/signage/lib/signageApi.ts && exit 1 || true; grep -n "readItems(\"signage_device_tags\"" src/signage/lib/signageApi.ts && grep -n "createItem(\"signage_device_tags\"" src/signage/lib/signageApi.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "apiClient.*signage/tags" frontend/src/signage/lib/signageApi.ts` exits 1.
    - `grep -n "readItems(\"signage_device_tags\"" frontend/src/signage/lib/signageApi.ts` exits 0.
    - `grep -n "createItem(\"signage_device_tags\"" frontend/src/signage/lib/signageApi.ts` exits 0.
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>Tag CRUD swapped to Directus SDK; types compile.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Swap schedule CRUD to Directus SDK</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (lines 200-218 schedules block)
    - frontend/src/signage/lib/signageTypes.ts
    - directus/snapshots/v1.22.yaml lines 572-657
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-00g, D-07)
  </read_first>
  <behavior>
    - listSchedules() returns `SignageSchedule[]` sorted by priority desc then updated_at desc (matches FastAPI today: `priority.desc(), updated_at.desc()`).
    - createSchedule(body) returns full `SignageSchedule`; inverted-range body raises DirectusError carrying code `schedule_end_before_start` (from Plan 02 hook).
    - updateSchedule(id, body) PATCHes provided fields; inverted result triggers same hook.
    - deleteSchedule(id) resolves to null.
  </behavior>
  <action>
    1. Define field allowlist constant near top of file:
       ```ts
       const SCHEDULE_FIELDS = [
         "id", "playlist_id", "weekday_mask",
         "start_hhmm", "end_hhmm", "priority", "enabled",
         "created_at", "updated_at",
       ] as const;
       ```
       Confirm the list matches `SignageSchedule` row type (read `signageTypes.ts`).
    2. Replace `listSchedules`:
       ```ts
       listSchedules: () =>
         directus.request(
           readItems("signage_schedules", {
             fields: [...SCHEDULE_FIELDS],
             sort: ["-priority", "-updated_at"],
             limit: -1,
           }),
         ) as Promise<SignageSchedule[]>,
       ```
    3. Replace `createSchedule`:
       ```ts
       createSchedule: (body: SignageScheduleCreate) =>
         directus.request(
           createItem("signage_schedules", body, { fields: [...SCHEDULE_FIELDS] }),
         ) as Promise<SignageSchedule>,
       ```
    4. Replace `updateSchedule`:
       ```ts
       updateSchedule: (id: string, body: SignageScheduleUpdate) =>
         directus.request(
           updateItem("signage_schedules", id, body, { fields: [...SCHEDULE_FIELDS] }),
         ) as Promise<SignageSchedule>,
       ```
    5. Replace `deleteSchedule`:
       ```ts
       deleteSchedule: (id: string) =>
         directus.request(deleteItem("signage_schedules", id)) as Promise<null>,
       ```
    6. Run existing test suite: `cd frontend && npm test -- --run ScheduleEditDialog` — must still pass (existing tests mock `signageApi`; behavior at the public boundary is unchanged).
  </action>
  <verify>
    <automated>cd frontend && grep -nE "apiClient.*signage/schedules" src/signage/lib/signageApi.ts && exit 1 || true; COUNT=$(grep -cE "(read|create|update|delete)Item\(\"signage_schedules\"" src/signage/lib/signageApi.ts); test "$COUNT" = "4" && npx tsc --noEmit && npm test -- --run ScheduleEditDialog</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "apiClient.*signage/schedules" frontend/src/signage/lib/signageApi.ts` exits 1.
    - `grep -cE "(read|create|update|delete)Item\(\"signage_schedules\"" frontend/src/signage/lib/signageApi.ts` returns `4`.
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npm test -- --run ScheduleEditDialog` exits 0.
  </acceptance_criteria>
  <done>Schedule CRUD swapped to Directus SDK; existing dialog tests still green.</done>
</task>

</tasks>

<verification>
- `grep -nE "apiClient.*signage/(tags|schedules)" frontend/src/signage/lib/signageApi.ts` exits 1.
- `cd frontend && npx tsc --noEmit` exits 0.
- `cd frontend && npm test -- --run signage` exits 0 (covers ScheduleEditDialog + scheduleAdapters at minimum).
</verification>

<success_criteria>
All 8 (or 6 if updateTag/deleteTag deferred) public functions in `signageApi.ts` route through Directus SDK. Consumer code unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-04-SUMMARY.md` listing: which functions were swapped, whether updateTag/deleteTag were added or deferred, any consumer impact, and the result of the existing test suite.
</output>
