---
phase: 68-mig-sign-tags-schedules
plan: 05
type: execute
wave: 2
depends_on: ["68-02", "68-04"]
files_modified:
  - frontend/src/signage/components/ScheduleEditDialog.tsx
  - frontend/src/signage/components/ScheduleEditDialog.test.tsx
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
autonomous: true
requirements: [MIG-SIGN-02]

must_haves:
  truths:
    - "Submitting a schedule create/update where the Directus Flow returns code 'schedule_end_before_start' shows the existing i18n message 'signage.admin.schedules.error.start_after_end' inline (not a raw DirectusError detail)"
    - "Existing client-side pre-validation (start === end, midnight-span) is unchanged"
    - "DE/EN i18n parity preserved (no new keys added unless mirrored in both files)"
  artifacts:
    - path: "frontend/src/signage/components/ScheduleEditDialog.tsx"
      provides: "Directus error → i18n key mapping in mutation onError"
      contains: "schedule_end_before_start"
    - path: "frontend/src/signage/components/ScheduleEditDialog.test.tsx"
      provides: "Test asserting friendly error renders on Directus 400"
  key_links:
    - from: "Directus mutation rejection"
      to: "Inline form error"
      via: "onError(err) → parse code → setErrors({time: 'signage.admin.schedules.error.start_after_end'})"
      pattern: "schedule_end_before_start"
---

<objective>
Map the Directus Flow validation error (code `schedule_end_before_start` from Plan 02) onto the existing i18n key `signage.admin.schedules.error.start_after_end` in `ScheduleEditDialog.tsx`. Existing client-side pre-validation stays as-is — this plan only adds a server-side fallback path for cases the client validator cannot catch (defensive: e.g., other clients writing to the same dialog through Directus, or future change to FE validation).

Purpose: MIG-SIGN-02 success criterion 2 — friendly error message on `start_hhmm < end_hhmm` violation.

Output: Edits to `ScheduleEditDialog.tsx` mutation `onError` handlers; one new test case covering the Directus-error path.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@frontend/src/signage/components/ScheduleEditDialog.tsx
@frontend/src/signage/components/ScheduleEditDialog.test.tsx
@frontend/src/locales/en.json
@frontend/src/locales/de.json

<interfaces>
Existing i18n key (already in en.json line 388, mirrored in de.json):
- EN: `"signage.admin.schedules.error.start_after_end": "Start time must be before end time."`
- DE: same key, German translation. Verify with `grep -n "start_after_end" frontend/src/locales/de.json`.

Existing `ScheduleEditDialog.tsx` validators (lines 81-107) handle:
- `start === end` → key `start_equals_end`
- `start > end` (same day) → key `midnight_span` (per D-07: same-day reversal interpreted as midnight-span)

Note: today's FE validation NEVER produces `start_after_end` because reversed-range is treated as a midnight span. The Directus Flow (Plan 02) is the only path that can fire `schedule_end_before_start` — covering the case where a write originates outside the dialog (Directus Data Model UI, REST, or future paths). Mapping it through the dialog is defense-in-depth so admin users who somehow trigger it see a translated message.

Existing mutation onError handlers (lines 163-168, 179-184) call:
```ts
onError: (err) => {
  const detail = err instanceof Error ? err.message : String(err);
  toast.error(t("signage.admin.schedules.error.save_failed", { detail }));
}
```

Directus SDK throws errors with shape (from `@directus/sdk` types): `{ errors: [{ message: string, extensions: { code: string } }] }`. When the Plan-02 Flow throws `new Error(JSON.stringify({ code: "schedule_end_before_start" }))`, the message is the JSON. Test by parsing message string for the literal `"schedule_end_before_start"`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Directus-error → i18n-key mapping in onError handlers</name>
  <files>frontend/src/signage/components/ScheduleEditDialog.tsx</files>
  <read_first>
    - frontend/src/signage/components/ScheduleEditDialog.tsx (lines 75-220)
    - frontend/src/signage/components/ScheduleEditDialog.test.tsx
    - frontend/src/locales/en.json (line 388)
    - frontend/src/locales/de.json (search for `start_after_end`)
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-02, D-03)
  </read_first>
  <behavior>
    - When the create or update mutation rejects with an error whose stringified payload contains `schedule_end_before_start`, the dialog sets `errors.time = "signage.admin.schedules.error.start_after_end"` via the existing `setErrors` setter and does NOT raise a toast.
    - When the rejection is anything else, the existing toast-with-detail behavior is unchanged.
  </behavior>
  <action>
    1. Add helper near `validateAll` (top of `ScheduleEditDialog.tsx`):
       ```ts
       function isScheduleEndBeforeStartError(err: unknown): boolean {
         const msg = err instanceof Error ? err.message : String(err);
         if (msg.includes("schedule_end_before_start")) return true;
         // Directus SDK error shape: { errors: [{ extensions: { code } }] }
         if (err && typeof err === "object" && "errors" in err) {
           const errs = (err as { errors?: Array<{ extensions?: { code?: string } }> }).errors;
           if (Array.isArray(errs)) {
             return errs.some((e) => e?.extensions?.code === "schedule_end_before_start");
           }
         }
         return false;
       }
       ```
    2. Update `createMutation.onError` and `updateMutation.onError`:
       ```ts
       onError: (err) => {
         if (isScheduleEndBeforeStartError(err)) {
           setErrors((prev) => ({ ...prev, time: "signage.admin.schedules.error.start_after_end" }));
           setTouched((prev) => ({ ...prev, time: true }));
           return;
         }
         const detail = err instanceof Error ? err.message : String(err);
         toast.error(t("signage.admin.schedules.error.save_failed", { detail }));
       }
       ```
    3. Confirm i18n keys present in BOTH locales:
       - `grep -n "signage.admin.schedules.error.start_after_end" frontend/src/locales/en.json`
       - `grep -n "signage.admin.schedules.error.start_after_end" frontend/src/locales/de.json`
       Both must return exactly one match. If DE is missing, add a translated entry mirroring EN. (Per cross-cutting hazard 1, DE/EN parity is enforced.)
    4. Confirm no existing key `schedule_end_before_start` shows up directly to the user (it's a stable error code, not a translation key); the user sees the i18n string.
  </action>
  <verify>
    <automated>cd frontend && grep -n "isScheduleEndBeforeStartError\|schedule_end_before_start" src/signage/components/ScheduleEditDialog.tsx && grep -n "start_after_end" src/locales/en.json src/locales/de.json && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "schedule_end_before_start" frontend/src/signage/components/ScheduleEditDialog.tsx` exits 0 (helper present).
    - `grep -n "start_after_end" frontend/src/locales/en.json` exits 0.
    - `grep -n "start_after_end" frontend/src/locales/de.json` exits 0.
    - `cd frontend && npx tsc --noEmit` exits 0.
    - The DE and EN files each contain exactly one occurrence of `start_after_end` (no duplicate keys introduced).
  </acceptance_criteria>
  <done>onError maps Directus code to FE i18n key; DE/EN parity preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add test case for Directus 400 → friendly error inline</name>
  <files>frontend/src/signage/components/ScheduleEditDialog.test.tsx</files>
  <read_first>
    - frontend/src/signage/components/ScheduleEditDialog.test.tsx (existing structure: `start_after_end` mock at line 169; describe block starts line 176)
    - frontend/src/signage/components/ScheduleEditDialog.tsx
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-02)
  </read_first>
  <behavior>
    - When `signageApi.createSchedule` is mocked to reject with an Error carrying `"schedule_end_before_start"` in the message, after submitting the form the dialog renders the EN string "Start time must be before end time." inline (NOT a toast).
    - Same for the update path.
  </behavior>
  <action>
    1. Inside the existing `describe("ScheduleEditDialog — validation + quick-picks (D-12, D-05, D-11)", ...)` block, add a new `it`:
       ```ts
       it("renders friendly inline error when Directus rejects with schedule_end_before_start (Phase 68 MIG-SIGN-02)", async () => {
         const err = new Error(JSON.stringify({ code: "schedule_end_before_start" }));
         vi.mocked(signageApi.createSchedule).mockRejectedValueOnce(err);
         // ... render dialog with valid client-side state, click Save
         // assert screen.getByText("Start time must be before end time.") in the dialog
         // assert toast.error was NOT called
       });
       ```
       Use the existing test helpers + render utilities in the file (mirror the pattern from the test at line ~176). The mock setup at line 169 already provides the EN string for `start_after_end`.
    2. Add a parallel `it` for `updateSchedule` mock rejection.
    3. Run the test file: `cd frontend && npm test -- --run ScheduleEditDialog`.
  </action>
  <verify>
    <automated>cd frontend && npm test -- --run ScheduleEditDialog 2>&1 | tail -20 | grep -qE "passed|✓"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "schedule_end_before_start" frontend/src/signage/components/ScheduleEditDialog.test.tsx` exits 0.
    - `cd frontend && npm test -- --run ScheduleEditDialog` exits 0 with all `it` cases passing (including the two new ones).
    - Vitest output shows the new test names: "renders friendly inline error when Directus rejects with schedule_end_before_start" (create + update variants).
  </acceptance_criteria>
  <done>Tests cover the Directus-error → i18n key path for both create and update.</done>
</task>

</tasks>

<verification>
- DE/EN i18n parity: `python -c "import json; en=json.load(open('frontend/src/locales/en.json')); de=json.load(open('frontend/src/locales/de.json')); assert set(en.keys())==set(de.keys()), 'parity drift'"` exits 0 (or wherever the project's parity check lives).
- `cd frontend && npm test -- --run ScheduleEditDialog` exits 0.
- `cd frontend && npx tsc --noEmit` exits 0.
</verification>

<success_criteria>
Submitting an inverted-range schedule (server-side trip) renders translated inline error; existing client-side validation paths unchanged; DE/EN parity preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-05-SUMMARY.md` documenting the helper added, the two new test cases, and confirmation of i18n parity.
</output>
