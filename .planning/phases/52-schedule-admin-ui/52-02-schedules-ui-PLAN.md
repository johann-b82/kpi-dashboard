---
phase: 52-schedule-admin-ui
plan: 02
type: execute
wave: 2
depends_on:
  - 52-01
files_modified:
  - frontend/src/signage/pages/SchedulesPage.tsx
  - frontend/src/signage/pages/SchedulesPage.test.tsx
  - frontend/src/signage/components/ScheduleEditDialog.tsx
  - frontend/src/signage/components/ScheduleEditDialog.test.tsx
  - frontend/src/signage/components/ScheduleDeleteDialog.tsx
  - frontend/src/signage/components/WeekdayCheckboxRow.tsx
  - frontend/src/signage/lib/scheduleAdapters.ts
  - frontend/src/signage/pages/SignagePage.tsx
  - frontend/src/signage/pages/PlaylistsPage.tsx
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/App.tsx
autonomous: true
requirements:
  - SGN-SCHED-UI-01
  - SGN-SCHED-UI-02
  - SGN-SCHED-UI-04
must_haves:
  truths:
    - "Admin navigating to /signage/schedules sees a table of schedules (or the empty state), gated by <AdminOnly>"
    - "Admin can click 'New schedule' → editor dialog opens → fill playlist/weekdays/start/end/priority/enabled → submit creates via apiClient"
    - "Editor validates: playlist required, ≥1 weekday, both times in HH:MM, start<end strict, priority≥0; errors appear on submit and on blur for touched fields (D-11)"
    - "Midnight-spanning windows (start>end same-day reversal) are blocked with the midnight_span error; equal times emit start_equals_end; no auto-split (D-07)"
    - "Weekday quick-picks (Wochentags / Wochenende / Täglich) overwrite the 7 checkboxes (D-05)"
    - "Time inputs use native type=time; HH:MM ↔ HHMM integer conversion handled client-side at the form boundary (D-06)"
    - "Inline enabled toggle on each row fires PATCH with optimistic update + rollback on failure (D-02)"
    - "SSE schedule-changed events invalidate signageKeys.schedules() (D-03) — existing signage SSE handler switch extended with a schedule-changed case"
    - "Row delete opens confirmation dialog; on confirm → DELETE + toast.success + list invalidate"
    - "Table default ordering is priority desc, then updated_at desc (D-01)"
    - "SchedulesPage reads ?highlight=id1,id2,... query param → matching rows gain ring-1 ring-primary/40 for ~5s; first match scrolls into view; URL cleaned via history.replaceState (D-14)"
    - "PlaylistsPage handles 409 {detail, schedule_ids} from deletePlaylist: shows sonner error with schedules_active_title/body and action button 'Zu den Zeitplänen' that navigates to /signage/schedules?highlight=... (D-13)"
    - "Vitest component tests cover: editor validation (all 5 enforced keys), weekday quick-pick overwrite, inline toggle optimistic+rollback, SSE invalidation, and highlight-param ring+scroll+replaceState (D-19)"
    - "No raw fetch( anywhere in the new/modified files (hard gate 2). No dark: Tailwind variants (hard gate 3). npm run check:signage passes."
  artifacts:
    - path: "frontend/src/signage/pages/SchedulesPage.tsx"
      provides: "Schedules list page — table, empty state, new-schedule CTA, highlight handling"
      min_lines: 120
    - path: "frontend/src/signage/pages/SchedulesPage.test.tsx"
      provides: "Component tests: inline toggle optimistic+rollback, SSE invalidation, highlight param ring+scroll+replaceState (D-19)"
      min_lines: 120
    - path: "frontend/src/signage/components/ScheduleEditDialog.tsx"
      provides: "Create/edit dialog with all validation rules (D-11/D-12)"
      min_lines: 150
    - path: "frontend/src/signage/components/ScheduleEditDialog.test.tsx"
      provides: "Component tests: validation rules (5 keys) + weekday quick-pick overwrite (D-19)"
      min_lines: 100
    - path: "frontend/src/signage/components/ScheduleDeleteDialog.tsx"
      provides: "Destructive confirmation dialog"
      min_lines: 30
    - path: "frontend/src/signage/components/WeekdayCheckboxRow.tsx"
      provides: "7-checkbox row + 3 quick-pick chips with bit0=Mo..bit6=So bitmask adapter"
      min_lines: 60
    - path: "frontend/src/signage/lib/scheduleAdapters.ts"
      provides: "hhmmFromString/hhmmToString + weekdayMaskFromArray/weekdayMaskToArray pure adapters"
      min_lines: 30
    - path: "frontend/src/App.tsx"
      provides: "/signage/schedules route under <AdminOnly>"
      contains: "/signage/schedules"
  key_links:
    - from: "SchedulesPage"
      to: "/api/signage/schedules"
      via: "signageApi.listSchedules (TanStack useQuery)"
      pattern: "listSchedules"
    - from: "ScheduleEditDialog submit"
      to: "/api/signage/schedules"
      via: "signageApi.createSchedule / updateSchedule via useMutation"
      pattern: "createSchedule|updateSchedule"
    - from: "SchedulesPage enabled Switch"
      to: "PATCH /api/signage/schedules/{id}"
      via: "signageApi.updateSchedule({enabled}) optimistic"
      pattern: "updateSchedule.*enabled"
    - from: "Signage SSE handler"
      to: "signageKeys.schedules()"
      via: "case 'schedule-changed': queryClient.invalidateQueries({ queryKey: signageKeys.schedules() })"
      pattern: "schedule-changed"
    - from: "PlaylistsPage 409 handler"
      to: "/signage/schedules?highlight=..."
      via: "toast action button setLocation"
      pattern: "highlight="
    - from: "SignagePage active===schedules branch"
      to: "SchedulesPage"
      via: "React render"
      pattern: "<SchedulesPage"
---

<objective>
Ship the Schedules admin UI: list page, create/edit dialog, delete confirmation, weekday bitmask row, time adapters, route registration, SignagePage integration, SSE schedule-changed handler extension, component tests, and the cross-tab 409 UX on PlaylistsPage. This is the user-visible core of Phase 52.

Purpose: Deliver SGN-SCHED-UI-01 (4th tab + AdminOnly + list), SGN-SCHED-UI-02 (editor + all validation), and the check:signage side of SGN-SCHED-UI-04 (no dark: / no raw fetch). Addresses D-19 component test coverage and D-03 SSE handler extension.

Output: A fully functional Schedules tab where an admin can create/read/update/delete schedules and toggle enabled inline, plus the Playlists-delete 409 toast with deep-link into the highlight flow, plus Vitest component tests for editor + list.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/52-schedule-admin-ui/52-CONTEXT.md
@.planning/phases/52-schedule-admin-ui/52-UI-SPEC.md
@.planning/phases/52-schedule-admin-ui/52-01-SUMMARY.md
@frontend/src/signage/pages/SignagePage.tsx
@frontend/src/signage/pages/PlaylistsPage.tsx
@frontend/src/signage/pages/DevicesPage.tsx
@frontend/src/signage/components/PlaylistNewDialog.tsx
@frontend/src/signage/components/MediaDeleteDialog.tsx
@frontend/src/signage/components/DeviceEditDialog.tsx
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/App.tsx

<interfaces>
<!-- Types and API methods delivered by Plan 01 — executor uses these directly, no exploration needed. -->

From frontend/src/signage/lib/signageTypes.ts (Plan 01):
```ts
export interface SignageSchedule {
  id: string;           // uuid
  playlist_id: string;  // uuid
  weekday_mask: number; // 0..127, bit0=Mo..bit6=So
  start_hhmm: number;   // 0..2359
  end_hhmm: number;     // 0..2359
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface SignageScheduleCreate { /* same as SignageSchedule minus id/timestamps */ }
export interface SignageScheduleUpdate { /* all fields optional */ }
```

From frontend/src/signage/lib/signageApi.ts (Plan 01):
```ts
signageApi.listSchedules(): Promise<SignageSchedule[]>
signageApi.createSchedule(body: SignageScheduleCreate): Promise<SignageSchedule>
signageApi.updateSchedule(id: string, body: SignageScheduleUpdate): Promise<SignageSchedule>
signageApi.deleteSchedule(id: string): Promise<null>
signageApi.listPlaylists(): Promise<SignagePlaylist[]>  // for the playlist picker
// ApiErrorWithBody + apiClientWithBody already exported (used for the 409 upgrade to deletePlaylist)
```

From frontend/src/lib/queryKeys.ts (Plan 01):
```ts
signageKeys.schedules()                  // ['signage', 'schedules']
signageKeys.scheduleItem(id: string)     // ['signage', 'schedules', id]
signageKeys.playlists()                  // existing, ['signage', 'playlists']
```

Backend 409 shape (Phase 51 Plan 02) when deleting a playlist with active schedules:
```
HTTP 409
{ "detail": "...", "schedule_ids": ["uuid", ...] }
```

i18n error keyset (shipped by Plan 01) — Plan 02 enforces 5 of these client-side:
- `error.playlist_required` (enforced)
- `error.weekdays_required` (enforced)
- `error.time_format` (enforced)
- `error.start_equals_end` (enforced — same-time case)
- `error.midnight_span` (enforced — any start>end same-day reversal per D-07)
- `error.start_after_end` (shipped for API-error parity / server response surfacing only; NOT a distinct client-side rule — any client-side `start > end` routes to `midnight_span`)
- `error.save_failed`, `error.load_failed`, `error.delete_failed` (used for mutation/query errors)

Wouter routing — all /signage/* routes wrap in <AdminOnly> (see existing /signage/devices registration).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Adapters + WeekdayCheckboxRow + ScheduleDeleteDialog (pure-logic primitives)</name>
  <files>frontend/src/signage/lib/scheduleAdapters.ts, frontend/src/signage/lib/scheduleAdapters.test.ts, frontend/src/signage/components/WeekdayCheckboxRow.tsx, frontend/src/signage/components/ScheduleDeleteDialog.tsx</files>
  <read_first>
    - frontend/src/signage/components/MediaDeleteDialog.tsx (destructive dialog pattern — copy the shape for ScheduleDeleteDialog)
    - frontend/src/components/ui/checkbox.tsx, button.tsx, dialog.tsx (shadcn primitives already on disk)
    - .planning/phases/52-schedule-admin-ui/52-UI-SPEC.md §"Weekday bitmask adapter (D-05)" and §"Time input format"
  </read_first>
  <behavior>
    scheduleAdapters.ts (pure functions, unit-tested):
    - `hhmmFromString("07:30")` → `730`; `hhmmFromString("00:00")` → `0`; `hhmmFromString("23:59")` → `2359`
    - `hhmmToString(730)` → `"07:30"`; `hhmmToString(0)` → `"00:00"`; `hhmmToString(900)` → `"09:00"`; `hhmmToString(1430)` → `"14:30"`
    - `hhmmFromString("")` returns `null`; `hhmmFromString("bad")` returns `null`; `hhmmFromString("25:00")` returns `null` (hour>23); `hhmmFromString("12:60")` returns `null` (minute>59)
    - `weekdayMaskToArray(0b0011111)` → `[true, true, true, true, true, false, false]` (Mo-Fr on)
    - `weekdayMaskFromArray([true,true,true,true,true,false,false])` → `31` (= 0b0011111)
    - Bit 0 = Monday, bit 6 = Sunday. `weekdayMaskFromArray([false]*7)` → 0.

    WeekdayCheckboxRow.tsx (React component, uses adapters):
    - Props: `{ value: boolean[7], onChange: (next: boolean[7]) => void, id?: string, error?: boolean }`
    - Renders 3 quick-pick buttons at top labeled via i18n (`quickpick.weekdays|weekend|daily`) that overwrite the checkbox state via onChange
    - Quick-pick "Weekdays" sets `[true,true,true,true,true,false,false]`; "Weekend" sets `[false,false,false,false,false,true,true]`; "Daily" sets `[true]*7`
    - Renders 7 checkboxes labeled Mo/Di/Mi/Do/Fr/Sa/So (via `signage.admin.schedules.weekday.{mo..su}` i18n keys); each toggles `value[i]` via onChange
    - When `error` prop true, adds `text-destructive` to the label row for visual error marking (no `dark:` variant — use token)

    ScheduleDeleteDialog.tsx:
    - Props: `{ open: boolean, onOpenChange: (next: boolean) => void, onConfirm: () => void, busy?: boolean, scheduleName: string }`
    - shadcn Dialog with title from `signage.admin.schedules.delete.title`, body from `delete.body` (t() with `{{name}}` → scheduleName)
    - Primary destructive button from `delete.confirm`, secondary cancel from `delete.cancel`
    - Mirrors MediaDeleteDialog.tsx structure verbatim (same Dialog + two-button footer pattern)
  </behavior>
  <action>
    **scheduleAdapters.ts** — write pure functions with NO React dependency:

    ```ts
    // bit0=Mo..bit6=So
    export function weekdayMaskToArray(mask: number): boolean[] {
      return Array.from({ length: 7 }, (_, i) => ((mask >> i) & 1) === 1);
    }
    export function weekdayMaskFromArray(arr: boolean[]): number {
      return arr.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
    }
    // Accepts "HH:MM". Returns integer HHMM (0..2359) or null when malformed.
    export function hhmmFromString(s: string): number | null {
      const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(s);
      if (!m) return null;
      return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
    }
    // 0..2359 → "HH:MM" (zero-padded). Out-of-range returns "".
    export function hhmmToString(n: number): string {
      if (!Number.isInteger(n) || n < 0 || n > 2359) return "";
      const hh = Math.floor(n / 100);
      const mm = n % 100;
      if (mm > 59) return "";
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    ```

    **scheduleAdapters.test.ts** — Vitest with the exact cases listed in behavior. Write tests FIRST (they MUST fail before implementing above). Test names should be: `hhmmFromString parses valid HH:MM`, `hhmmFromString rejects out-of-range hour/minute`, `hhmmFromString rejects malformed input`, `hhmmToString pads single digits`, `hhmmToString rejects out-of-range`, `hhmmToString rejects non-integer minute overflow`, `weekday adapters roundtrip bit0=Mo..bit6=So`.

    **WeekdayCheckboxRow.tsx** — functional component. Import `Checkbox` from `@/components/ui/checkbox`, `Button` from `@/components/ui/button`, `useTranslation` from `react-i18next`. Use `className="text-sm text-muted-foreground"` for labels and the quick-pick buttons variant="outline" size="sm". Render 3 quick-pick Buttons in a flex-row with `gap-2`, then a `<div className="flex flex-wrap gap-4">` containing 7 `<label>` elements each wrapping a Checkbox. Match weekday order Mo,Di,Mi,Do,Fr,Sa,So (UI-SPEC §Weekday bitmask adapter).

    **ScheduleDeleteDialog.tsx** — copy the structure of MediaDeleteDialog.tsx verbatim. Replace copy keys with `signage.admin.schedules.delete.{title,body,confirm,cancel}`. Use `Button variant="destructive"` for the confirm. Disable both buttons when `busy`.

    NO raw `fetch(`. NO `dark:` variants. Use only semantic tokens (`bg-background`, `text-destructive`, `text-muted-foreground`, `border-border`, etc.).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/signage/lib/scheduleAdapters.test.ts 2>&1 | tail -25 && npx tsc --noEmit 2>&1 | tail -15 && ! grep -E 'dark:|fetch\(' src/signage/lib/scheduleAdapters.ts src/signage/components/WeekdayCheckboxRow.tsx src/signage/components/ScheduleDeleteDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npx vitest run src/signage/lib/scheduleAdapters.test.ts` exits 0 with ≥7 passing tests
    - `grep -q 'export function hhmmFromString' frontend/src/signage/lib/scheduleAdapters.ts` succeeds
    - `grep -q 'export function hhmmToString' frontend/src/signage/lib/scheduleAdapters.ts` succeeds
    - `grep -q 'export function weekdayMaskToArray' frontend/src/signage/lib/scheduleAdapters.ts` succeeds
    - `grep -q 'export function weekdayMaskFromArray' frontend/src/signage/lib/scheduleAdapters.ts` succeeds
    - `grep -qE 'quickpick\.(weekdays|weekend|daily)' frontend/src/signage/components/WeekdayCheckboxRow.tsx` succeeds
    - `grep -qE 'signage\.admin\.schedules\.weekday\.(mo|tu|we|th|fr|sa|su)' frontend/src/signage/components/WeekdayCheckboxRow.tsx` succeeds
    - `grep -q 'signage.admin.schedules.delete.title' frontend/src/signage/components/ScheduleDeleteDialog.tsx` succeeds
    - `grep -q 'variant="destructive"' frontend/src/signage/components/ScheduleDeleteDialog.tsx` succeeds
    - `grep -rE 'dark:|fetch\(' frontend/src/signage/lib/scheduleAdapters.ts frontend/src/signage/components/WeekdayCheckboxRow.tsx frontend/src/signage/components/ScheduleDeleteDialog.tsx` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Pure adapters are unit-tested and green. WeekdayCheckboxRow + ScheduleDeleteDialog render correctly with i18n keys and no dark:/no fetch.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: ScheduleEditDialog (create+edit, all D-11/D-12 validation)</name>
  <files>frontend/src/signage/components/ScheduleEditDialog.tsx</files>
  <read_first>
    - frontend/src/signage/components/PlaylistNewDialog.tsx (Dialog + Form + react-hook-form precedent)
    - frontend/src/signage/components/DeviceEditDialog.tsx (edit vs. create mode toggle)
    - frontend/src/signage/components/WeekdayCheckboxRow.tsx (Task 1 — import + wire)
    - frontend/src/signage/lib/scheduleAdapters.ts (Task 1 — hhmmFromString/hhmmToString/weekdayMask*)
    - .planning/phases/52-schedule-admin-ui/52-CONTEXT.md §Editor dialog (D-04..D-12)
    - .planning/phases/52-schedule-admin-ui/52-UI-SPEC.md §Form + Validation copy keys
  </read_first>
  <behavior>
    Props:
    - `{ open: boolean, onOpenChange: (b:boolean)=>void, schedule?: SignageSchedule | null /* null/undefined = create mode */ }`

    Fields + defaults (D-06, D-08, D-09):
    - playlist: Select populated by `signageApi.listPlaylists()` via useQuery(signageKeys.playlists()) — required (D-10)
    - weekdays: WeekdayCheckboxRow — at least one must be checked (D-12)
    - start: `<Input type="time">` — HH:MM required
    - end:   `<Input type="time">` — HH:MM required
    - priority: `<Input type="number" min={0} step={1}>` default 0 (D-08)
    - enabled: shadcn Switch or Checkbox default true on create (D-09)

    **Validation — single decision tree (D-12 + D-07 consolidated; matches Plan 01 i18n keyset):**

    The pre-submit validator runs this decision tree per field group in order. Only the FIRST failing rule for a given field surface yields an error message:

    1. `playlist_id` truthy → else `signage.admin.schedules.error.playlist_required`
    2. `weekdays.some(Boolean)` → else `signage.admin.schedules.error.weekdays_required`
    3. **Time decision tree (replaces former rules 3–5):**
       ```ts
       const startN = hhmmFromString(start);
       const endN   = hhmmFromString(end);
       if (startN === null || endN === null) {
         timeError = 'signage.admin.schedules.error.time_format';
       } else if (startN === end N) {
         timeError = 'signage.admin.schedules.error.start_equals_end';
       } else if (startN > endN) {
         // D-07: any same-day reversal is a midnight-span — no separate start_after_end client rule
         timeError = 'signage.admin.schedules.error.midnight_span';
       } else {
         // startN < endN — valid window
         timeError = null;
       }
       ```
       Note: `error.start_after_end` exists in the locale file (Plan 01) for API-error parity — if the backend ever returns a distinct "start after end" detail, that key is used for surfacing it via `error.save_failed`. Client-side enforcement never emits it.
    4. `priority` is a non-negative integer → else clamp to 0 on submit (D-08 helper hint implies forgiveness; no distinct error key)

    Validation timing (D-11):
    - `errors` map on submit attempt for all fields
    - On blur of a field that has been touched at least once, re-validate only that field + cross-field pairs (e.g. blurring end re-runs the time decision tree if start touched)
    - Untouched fields stay neutral before submit

    Submit behavior:
    - Create mode: call `signageApi.createSchedule({playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled})` where start_hhmm/end_hhmm are converted via hhmmFromString and weekday_mask via weekdayMaskFromArray. On success: `queryClient.invalidateQueries(signageKeys.schedules())`, `toast.success(t('signage.admin.schedules.toast.created'))`, close dialog.
    - Edit mode (`schedule` prop present): call `signageApi.updateSchedule(schedule.id, diff)` where diff omits unchanged fields (or sends the full set — either is acceptable since backend PATCH accepts all-optional). On success: same invalidate + `toast.success(t('signage.admin.schedules.toast.updated'))`, close.
    - On error (ApiError / any throw): `toast.error(t('signage.admin.schedules.error.save_failed', { detail }))` where detail is `err.message`.
    - During submit, disable both dialog buttons (prevent double-submit).

    Copy:
    - Dialog title: create mode uses `signage.admin.schedules.new_cta`, edit mode uses `signage.admin.schedules.page_title` + edit suffix — or simpler: reuse `new_cta` + `save_cta` as submit button labels.
    - Submit button: create → `create_cta` ("Create schedule"); edit → `save_cta` ("Save changes")
    - Cancel button: `cancel_cta`

    No `dark:` variants. No raw `fetch(`. Use semantic tokens only. Error text uses `text-destructive text-sm` below the offending input.
  </behavior>
  <action>
    Create `frontend/src/signage/components/ScheduleEditDialog.tsx`. Use react-hook-form if the project already uses it in PlaylistNewDialog — otherwise use plain `useState` + controlled inputs (inspect PlaylistNewDialog first and match its style).

    Structure:
    1. Imports: Dialog/DialogContent/DialogHeader/DialogTitle/DialogFooter from `@/components/ui/dialog`, Button, Input, Label, Checkbox (or Switch), useTranslation, useMutation + useQuery + useQueryClient from `@tanstack/react-query`, toast from `sonner`, signageApi + types + signageKeys, WeekdayCheckboxRow, scheduleAdapters.
    2. Component state: playlist_id (string), weekdays (boolean[7]), start (string "HH:MM"), end (string "HH:MM"), priority (number), enabled (boolean), touched (Record<field, boolean>), errors (Record<field, string | null>).
    3. On mount / schedule prop change: hydrate defaults. Create mode: `["", [false*7], "", "", 0, true]`. Edit mode: adapt from schedule via `hhmmToString` + `weekdayMaskToArray`.
    4. Validation function `validate(field?, values)` → returns `{errors, isValid}`. Full-form variant for submit; per-field variant for onBlur. Implements the decision tree in <behavior> verbatim — in particular, the time branch emits exactly one of `time_format | start_equals_end | midnight_span` (never `start_after_end`).
    5. Playlist Select: simple native `<select>` styled with Tailwind utilities (shadcn has no Select block in the inventory per UI-SPEC — reuse what DeviceEditDialog does for tag lists or use native select for simplicity). Render `<option value="">{placeholder}</option>` then one option per playlist.
    6. On submit: validate all; if invalid, set errors + touched for all fields; if valid, run createMutation or updateMutation.
    7. useMutation setups mirror PlaylistNewDialog pattern.

    Include inline helper text for priority (i18n `field.priority.help`) and weekdays (`field.weekdays.help`).

    The form layout uses `space-y-4` (UI-SPEC §Spacing) with a flex row for start+end time inputs (`grid grid-cols-2 gap-4`). No custom font sizes/weights outside the 4-role scale (UI-SPEC §Typography).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -15 && ! grep -nE 'dark:|fetch\(' src/signage/components/ScheduleEditDialog.tsx && grep -cE 'signage\.admin\.schedules\.(field|error|toast|new_cta|create_cta|save_cta|cancel_cta)' src/signage/components/ScheduleEditDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists with ≥150 lines: `wc -l < frontend/src/signage/components/ScheduleEditDialog.tsx` returns ≥150
    - `grep -q 'signageApi.createSchedule' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds
    - `grep -q 'signageApi.updateSchedule' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds
    - `grep -q 'signageApi.listPlaylists' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds
    - `grep -q 'WeekdayCheckboxRow' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds
    - `grep -qE 'hhmmFromString|hhmmToString|weekdayMaskFromArray' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds
    - All 5 client-enforced validation error keys referenced: `grep -cE 'error\.(playlist_required|weekdays_required|start_equals_end|time_format|midnight_span)' frontend/src/signage/components/ScheduleEditDialog.tsx` returns ≥5
    - `error.start_after_end` MUST NOT be emitted from client-side validation: `grep -E 'errors?\.[a-z_]*\s*=.*error\.start_after_end|setError.*start_after_end|timeError.*=.*start_after_end' frontend/src/signage/components/ScheduleEditDialog.tsx` returns empty (the string MAY appear only in a comment referencing the decision tree or in a `save_failed` passthrough; not as a validator branch assignment)
    - `grep -q 'toast.created' frontend/src/signage/components/ScheduleEditDialog.tsx` AND `grep -q 'toast.updated' ...` succeed
    - `grep -q 'invalidateQueries' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds with signageKeys.schedules() query key
    - `grep -nE 'dark:|fetch\(' frontend/src/signage/components/ScheduleEditDialog.tsx` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Editor dialog handles create+edit; the time decision tree routes malformed→time_format, equal→start_equals_end, reversed→midnight_span (never start_after_end); timing per D-11; submits via apiClient; invalidates and toasts.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: SchedulesPage + route + SignagePage wire + SSE schedule-changed handler + PlaylistsPage 409 upgrade</name>
  <files>frontend/src/signage/pages/SchedulesPage.tsx, frontend/src/App.tsx, frontend/src/signage/pages/SignagePage.tsx, frontend/src/signage/pages/PlaylistsPage.tsx, frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/pages/DevicesPage.tsx (table + empty-state + inline toggle pattern — copy shape)
    - frontend/src/signage/pages/PlaylistsPage.tsx (existing deletePlaylist mutation — will be upgraded to detect 409 with schedule_ids)
    - frontend/src/signage/pages/SignagePage.tsx (the null placeholder from Plan 01 — replace with <SchedulesPage/>; ALSO locate the existing SSE event-kind switch/handler here, or follow imports to the hook/file that owns it)
    - frontend/src/App.tsx (existing /signage/devices route registration under <AdminOnly>)
    - frontend/src/signage/lib/signageApi.ts (existing deletePlaylist → upgrade to apiClientWithBody for 409 body extraction)
    - frontend/src/signage/components/ScheduleEditDialog.tsx (Task 2)
    - frontend/src/signage/components/ScheduleDeleteDialog.tsx (Task 1)
    - frontend/src/signage/lib/scheduleAdapters.ts (Task 1)
    - .planning/phases/52-schedule-admin-ui/52-CONTEXT.md §List (D-01, D-02, D-03), §Cross-tab integration (D-13, D-14)
    - Run this grep first to locate the SSE handler: `grep -rnE "EventSource|event\.data|onmessage|case ['\"]playlist-changed['\"]|case ['\"]device-changed['\"]" frontend/src/signage/` — the file(s) returned are where the schedule-changed case gets added
  </read_first>
  <behavior>
    **SchedulesPage.tsx:**
    - Fetches via `useQuery({ queryKey: signageKeys.schedules(), queryFn: signageApi.listSchedules })` and playlists via `signageApi.listPlaylists()` for name lookup.
    - Client-side sort: priority desc, then updated_at desc (D-01) — `[...schedules].sort((a,b)=> b.priority - a.priority || b.updated_at.localeCompare(a.updated_at))`.
    - Renders `<section className="space-y-4">` (SignagePage provides the outer wrapper) with a right-aligned `<Button>` labeled `signage.admin.schedules.new_cta` that opens the edit dialog in create mode.
    - While loading: render the same "loading" div as PlaylistsPage (the muted-foreground one). On error: render the destructive error card with `signage.admin.schedules.error.load_failed`.
    - Empty state (schedules.length === 0): `<section className="rounded-md border border-border bg-card p-12 text-center space-y-3">` with `<h2 className="text-lg font-semibold">{t('empty_title')}</h2>`, `<p className="text-sm text-muted-foreground">{t('empty_body')}</p>`, and an empty-state Button opening the create dialog.
    - Populated: shadcn Table with headers from `col.playlist/days/time/priority/enabled/actions` i18n keys. Per row:
      - Playlist: look up name from playlists map; fallback to `{id[:8]}…` if missing.
      - Days: render 7 weekday abbreviations separated by spaces; checked weekdays have `font-semibold`, unchecked have `text-muted-foreground`. Uses `weekdayMaskToArray(sched.weekday_mask)` + the 7 weekday i18n keys.
      - Time window: `${hhmmToString(sched.start_hhmm)} – ${hhmmToString(sched.end_hhmm)}` (en-dash).
      - Priority: raw number.
      - Enabled: shadcn `Switch` (or controlled Checkbox) that fires an inline PATCH via `signageApi.updateSchedule(id, {enabled: next})`. Optimistic: snapshot prev via `queryClient.getQueryData(signageKeys.schedules())`, then `queryClient.setQueryData(signageKeys.schedules(), (prev)=> prev.map(s => s.id===id ? {...s, enabled: next} : s))` BEFORE the await; on error: revert via `queryClient.setQueryData(signageKeys.schedules(), prevSnapshot)` + `toast.error(save_failed)`; on success: `toast.success(enabled? toast.enabled : toast.disabled)` + `invalidateQueries(signageKeys.schedules())`.
      - Actions: Edit icon-button opens edit dialog with this schedule; Trash2 icon-button (text-destructive) opens ScheduleDeleteDialog.

    - Highlight (D-14):
      - Read `?highlight=id1,id2,…` on mount via `useSearch()` from wouter or `new URLSearchParams(window.location.search)`.
      - Highlighted row gets `ring-1 ring-primary/40 rounded` for 5 s (useEffect with setTimeout clearing a `highlightedIds` state).
      - After capturing the IDs, call `window.history.replaceState(null, '', '/signage/schedules')` so back-nav doesn't restore the param.
      - First matching row scrolls into view via `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on mount.

    - Dialog state: `const [editing, setEditing] = useState<SignageSchedule | null | undefined>(undefined)` — undefined = closed, null = create, object = edit. Delete target state: `const [deleteTarget, setDeleteTarget] = useState<SignageSchedule | null>(null)`.

    **SSE schedule-changed handler (D-03):**
    - Locate the existing signage SSE event-kind switch (likely in `SignagePage.tsx` or a `useSignageSse`/`useSignageEvents` hook imported by it — use the grep from <read_first>).
    - Add exactly one case to the existing switch:
      ```ts
      case 'schedule-changed':
        queryClient.invalidateQueries({ queryKey: signageKeys.schedules() });
        break;
      ```
    - If `signageKeys` is not yet imported in that file, add the import from `@/lib/queryKeys`.
    - Do not alter other case branches.
  </behavior>
  <action>
    **App.tsx** — register a new route BEFORE the `/signage` fallthrough (wouter first-match). Place alongside the other `/signage/*` routes:
    ```tsx
    <Route path="/signage/schedules">
      <AdminOnly><SignagePage initialTab="schedules" /></AdminOnly>
    </Route>
    ```
    Do NOT import SchedulesPage into App.tsx — SignagePage's internal conditional render is the mount point (same pattern as media/playlists/devices).

    **SignagePage.tsx** — replace the `null` placeholder from Plan 01:
    ```tsx
    {active === "schedules" && <SchedulesPage />}
    ```
    Add the import `import { SchedulesPage } from "./SchedulesPage";` alongside the existing tab imports.

    **SSE handler extension** — open the file returned by the grep in <read_first>. Add the `case 'schedule-changed':` branch to the existing switch (or equivalent if-chain). If the handler is in a hook file, the import for `signageKeys` comes from `@/lib/queryKeys`; `queryClient` is already in scope there.

    **signageApi.ts — deletePlaylist upgrade (D-13):**
    Current implementation uses `apiClient` which discards the 409 body. Replace with `apiClientWithBody` so callers can read `body.schedule_ids`. Exact change: in the `deletePlaylist` entry, swap `apiClient` → `apiClientWithBody` and keep the same signature. Also add a comment noting the 409 response shape.

    **PlaylistsPage.tsx — 409 cross-tab toast (D-13):**
    Extend the existing `deleteMutation.onError` handler. When `err instanceof ApiErrorWithBody && err.status === 409 && typeof err.body === 'object' && err.body && 'schedule_ids' in err.body && Array.isArray((err.body as any).schedule_ids)`:
    - Extract `scheduleIds: string[]`.
    - Call `toast.error(t('signage.admin.playlists.error.schedules_active_title'), { description: t('signage.admin.playlists.error.schedules_active_body'), action: { label: t('signage.admin.nav.schedules'), onClick: () => setLocation(\`/signage/schedules?highlight=\${scheduleIds.join(',')}\`) } })`.
    - Use `useLocation()` from `wouter` to get `setLocation` (already imported in PlaylistsPage? If not, add it).
    - Import `ApiErrorWithBody` from `../lib/signageApi`.
    - Otherwise fall through to the existing generic toast.
    Keep the rest of onError intact.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -20 && npm run check:signage 2>&1 | tail -20 && grep -c "SchedulesPage" src/signage/pages/SignagePage.tsx src/App.tsx && ! grep -nE 'dark:|fetch\(' src/signage/pages/SchedulesPage.tsx && grep -rn "schedule-changed" src/signage/ | grep -v node_modules</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l < frontend/src/signage/pages/SchedulesPage.tsx` ≥ 120
    - `grep -q "signageApi.listSchedules" frontend/src/signage/pages/SchedulesPage.tsx` succeeds
    - `grep -q "signageApi.updateSchedule" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (for inline enabled toggle)
    - `grep -q "signageApi.deleteSchedule" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (delete flow)
    - `grep -qE "priority.*-.*a\.priority|b\.priority.*-.*a\.priority" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (D-01 sort)
    - `grep -q "highlight" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (D-14)
    - `grep -q "history.replaceState" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (D-14 URL cleanup)
    - `grep -qE "ring-1 ring-primary" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (D-14 visual)
    - `grep -q "ScheduleEditDialog" frontend/src/signage/pages/SchedulesPage.tsx` succeeds
    - `grep -q "ScheduleDeleteDialog" frontend/src/signage/pages/SchedulesPage.tsx` succeeds
    - `grep -q "p-12" frontend/src/signage/pages/SchedulesPage.tsx` succeeds (empty-state padding parity)
    - `grep -q 'Route path="/signage/schedules"' frontend/src/App.tsx` succeeds
    - `grep -A2 "schedules" frontend/src/App.tsx | grep -q '<AdminOnly>'` succeeds (AdminOnly wrap on the schedules route)
    - `grep -q 'import { SchedulesPage }' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -q 'active === "schedules" && <SchedulesPage' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - **SSE schedule-changed case wired (D-03):** `grep -rnE "case\s+['\"]schedule-changed['\"]" frontend/src/signage/` returns ≥1 match, and that match is in the same file as an adjacent `invalidateQueries` call against `signageKeys.schedules()`: `grep -rn -A3 "case 'schedule-changed'" frontend/src/signage/ | grep -q "signageKeys.schedules()"`
    - `grep -A2 "deletePlaylist:" frontend/src/signage/lib/signageApi.ts` shows `apiClientWithBody`
    - `grep -q 'schedule_ids' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -q 'schedules_active_title' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -q 'highlight=' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -rnE 'dark:' frontend/src/signage/pages/SchedulesPage.tsx frontend/src/signage/components/Schedule*.tsx frontend/src/signage/components/WeekdayCheckboxRow.tsx` returns empty
    - `grep -rnE 'fetch\(' frontend/src/signage/pages/SchedulesPage.tsx frontend/src/signage/components/Schedule*.tsx frontend/src/signage/components/WeekdayCheckboxRow.tsx frontend/src/signage/lib/scheduleAdapters.ts` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npm run check:signage` exits 0
  </acceptance_criteria>
  <done>/signage/schedules renders the admin-gated table; create/edit/delete/toggle-enabled all flow through apiClient. SSE schedule-changed invalidates the schedules query. Highlight param works. PlaylistsPage shows the schedule-aware 409 toast with deep-link.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Vitest component tests — ScheduleEditDialog + SchedulesPage (D-19)</name>
  <files>frontend/src/signage/components/ScheduleEditDialog.test.tsx, frontend/src/signage/pages/SchedulesPage.test.tsx</files>
  <read_first>
    - frontend/src/signage/components/ScheduleEditDialog.tsx (Task 2 — component under test)
    - frontend/src/signage/pages/SchedulesPage.tsx (Task 3 — component under test)
    - frontend/vitest.config.ts (or vite.config.ts if tests live there) — confirm jsdom env + @testing-library setup
    - frontend/src/test-utils/* if present (QueryClientProvider + i18n wrapper helpers; inspect before writing)
    - Any existing *.test.tsx file in frontend/src/signage/ (e.g. PlaylistsPage.test.tsx) — copy its render-wrapper pattern (QueryClientProvider + i18next stub + wouter Router + sonner Toaster)
  </read_first>
  <behavior>
    **ScheduleEditDialog.test.tsx — validation + weekday quick-picks (D-12, D-05, D-11):**

    1. `submits with empty form → all three required errors` — mount dialog in create mode with a stubbed `signageApi.listPlaylists` returning `[{id:'p1', name:'PL', ...}]`. Click the submit button without filling anything. Assert: `getByText(t('signage.admin.schedules.error.playlist_required'))` visible, `...weekdays_required` visible, `...time_format` visible (or whichever is the first failing rule for time per the decision tree — both start and end empty → time_format).
    2. `time decision tree: start === end → start_equals_end` — fill playlist, pick Monday, enter start=`09:00` end=`09:00`, submit. Assert the error under the time-group reads `signage.admin.schedules.error.start_equals_end` (and NOT `midnight_span`, NOT `start_after_end`).
    3. `time decision tree: start > end → midnight_span` — fill playlist, pick Monday, enter start=`22:00` end=`02:00`, submit. Assert error reads `signage.admin.schedules.error.midnight_span`. Assert `start_after_end` text is NOT in the DOM.
    4. `time decision tree: malformed input → time_format` — clear start, leave end=`09:00`, submit. Assert `time_format` error appears (decision tree short-circuits before equal/reversal checks).
    5. `time decision tree: valid start < end → no time error, no error.start_after_end in DOM` — fill playlist, Monday, `07:00`–`11:00`, submit. Assert `createSchedule` mock called once with `{start_hhmm: 700, end_hhmm: 1100, weekday_mask: 1, ...}`.
    6. `quick-pick Weekdays overwrites checkbox state` — open dialog, manually check Saturday only, then click the "Wochentags/Weekdays" quick-pick button. Assert Mo/Di/Mi/Do/Fr checkboxes are checked AND Sa/So are unchecked (i.e. overwrite, not union).
    7. `quick-pick Daily overwrites to all 7` and `quick-pick Weekend overwrites to Sa+So only` — two more assertions of the same shape.
    8. `blur triggers per-field validation for touched fields (D-11)` — focus then blur the playlist select without choosing one (mark touched), then type anything elsewhere. Assert `playlist_required` error is visible WITHOUT pressing submit. Then focus/blur `end` with `start=07:00 end=06:00` → assert `midnight_span` appears on blur (cross-field revalidation).

    **SchedulesPage.test.tsx — inline toggle + SSE invalidation + highlight (D-02, D-03, D-14):**

    9. `inline enabled toggle: optimistic update + success toast` — render with 1 schedule enabled=true. Stub `signageApi.updateSchedule` to resolve after a short delay with `{...sched, enabled:false}`. Click the row's Switch. Assert: the Switch's checked state flips to false synchronously (before the promise resolves) — verify via `expect(switch).not.toBeChecked()` immediately after click. After resolve: `toast.success` spy called with `toast.disabled` key.
    10. `inline enabled toggle: rollback on 500` — same setup but stub updateSchedule to reject with a 500 error. Click Switch. Assert: optimistic flip happens first, then after rejection resolves the Switch reverts to checked=true AND `toast.error` spy called with a key matching `error.save_failed`. Verify via `queryClient.getQueryData(signageKeys.schedules())` that the cached entry's `enabled` field is back to `true`.
    11. `SSE schedule-changed triggers invalidateQueries(signageKeys.schedules())` — render the component tree that includes the SSE handler (SignagePage or the hook, per Task 3's handler location). Dispatch a mock SSE event with `{ kind: 'schedule-changed' }`. Assert `queryClient.invalidateQueries` was called with `{ queryKey: ['signage', 'schedules'] }`. (If the handler lives in a hook, test the hook in isolation — render `renderHook(() => useSignageSse(...))` and fire the event on the mocked EventSource.)
    12. `?highlight=id1,id2 → ring class + scrollIntoView + replaceState` — pre-populate the query cache with 3 schedules whose ids are `id1, id2, id3`. Render SchedulesPage with `window.location.search = '?highlight=id1,id2'` (use a history wrapper or stub `window.location`). After mount:
        - `id1` and `id2` rows have class string including `ring-1` and `ring-primary/40`
        - `id3` row does NOT have that class
        - `Element.prototype.scrollIntoView` spy was called at least once (for the first match `id1`)
        - `history.replaceState` spy was called with `(null, '', '/signage/schedules')`
        - After advancing timers by 5100 ms (`vi.advanceTimersByTime(5100)`), the ring classes are removed from `id1`/`id2` rows.
  </behavior>
  <action>
    Write `frontend/src/signage/components/ScheduleEditDialog.test.tsx` and `frontend/src/signage/pages/SchedulesPage.test.tsx` following the existing signage `*.test.tsx` harness:

    ```tsx
    // Render helper (inline or reuse test-utils if present):
    function renderWithProviders(ui: React.ReactElement) {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return {
        queryClient,
        ...render(
          <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
              <Router base="">{ui}</Router>
            </I18nextProvider>
          </QueryClientProvider>
        ),
      };
    }
    ```

    Mock `signageApi` via `vi.mock('@/signage/lib/signageApi', ...)` and `sonner` via `vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))`.

    For test 11 (SSE): if the handler lives in `SignagePage.tsx`, render `<SignagePage />` with a stubbed `EventSource` (assign `global.EventSource` to a class that captures instances and exposes `emit(data)`). If the handler lives in a hook, import the hook and render with `renderHook`.

    For test 12 (highlight + timers): wrap the test in `vi.useFakeTimers()` / `vi.useRealTimers()` and stub `Element.prototype.scrollIntoView = vi.fn()` plus `window.history.replaceState = vi.fn()` in `beforeEach`.

    Use `@testing-library/user-event` for clicks/typing (already present in the frontend if other `*.test.tsx` files use it; otherwise fall back to `fireEvent`).

    Aim for ≥12 top-level `test(...)` entries matching the 12 behaviors above. Each test name should be grep-findable per the acceptance criteria.

    No raw `fetch(`, no `dark:` — tests must not introduce either. Use only i18n keys that exist in Plan 01's keyset (the mocked i18n can return the raw key via `t=(k)=>k` if that matches the existing harness).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/signage/components/ScheduleEditDialog.test.tsx src/signage/pages/SchedulesPage.test.tsx 2>&1 | tail -40 && npx tsc --noEmit 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npx vitest run src/signage/components/ScheduleEditDialog.test.tsx src/signage/pages/SchedulesPage.test.tsx` exits 0
    - ScheduleEditDialog.test.tsx contains these test names (grep-verifiable):
      - `grep -q "submits with empty form" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
      - `grep -qE "start === end|start_equals_end" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
      - `grep -qE "start > end|midnight_span" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
      - `grep -qE "malformed|time_format" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
      - `grep -qE "quick-pick|Weekdays|Wochentags" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
      - `grep -qE "blur|touched" frontend/src/signage/components/ScheduleEditDialog.test.tsx`
    - SchedulesPage.test.tsx contains these test names (grep-verifiable):
      - `grep -qE "optimistic" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -qE "rollback|500" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -qE "schedule-changed|SSE.*invalidate" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -qE "highlight" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -q "scrollIntoView" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -q "replaceState" frontend/src/signage/pages/SchedulesPage.test.tsx`
      - `grep -qE "ring-1|ring-primary" frontend/src/signage/pages/SchedulesPage.test.tsx`
    - Total test count ≥ 12 across the two files: `grep -cE "^\s*(test|it)\(" frontend/src/signage/components/ScheduleEditDialog.test.tsx frontend/src/signage/pages/SchedulesPage.test.tsx | awk -F: '{s+=$2} END{exit !(s>=12)}'`
    - No raw `fetch(` in either test file: `grep -nE 'fetch\(' frontend/src/signage/components/ScheduleEditDialog.test.tsx frontend/src/signage/pages/SchedulesPage.test.tsx` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Vitest component tests cover D-19 scope: editor validation decision tree + weekday quick-pick overwrite + inline toggle optimistic+rollback + SSE schedule-changed invalidation + highlight param ring/scroll/replaceState. All green locally.</done>
</task>

</tasks>

<verification>
Run from `frontend/`:
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/signage/lib/scheduleAdapters.test.ts src/signage/components/ScheduleEditDialog.test.tsx src/signage/pages/SchedulesPage.test.tsx` → all green
- `npm run check:signage` → exit 0 (no `dark:`, no raw `fetch(`, no sqlite3/psycopg2 imports)
- `npm run check:i18n-parity` → exit 0 (keys added by Plan 01 are consumed here)
- `grep -rn "schedule-changed" frontend/src/signage/` returns ≥2 hits (SSE handler case + test file)
- Manual smoke in dev server:
  1. Navigate to `/signage` → SegmentedControl 4th segment "Schedules" visible
  2. Click it → `/signage/schedules`, empty state shown with "New schedule" CTA
  3. Create a schedule (Mo-Fr / 07:00 / 11:00 / priority 10) → row appears at top of table
  4. Try start=12:00 end=11:00 → inline midnight_span error blocks submit
  5. Try start=09:00 end=09:00 → start_equals_end error
  6. Try no weekdays → weekdays_required error
  7. Toggle enabled off on a row → optimistic flip + toast.disabled; refreshing preserves state
  8. Delete a schedule → confirmation dialog → confirm → row removed + toast.deleted
  9. Trigger a backend mutation from another tab/context → SSE schedule-changed arrives → list refetches (observable via network tab)
  10. Create playlist referenced by a schedule; delete the playlist → toast with "Zu den Zeitplänen" action → clicking it navigates to `/signage/schedules?highlight=...` → matching row ring visible ~5s → URL cleans up
</verification>

<success_criteria>
1. SGN-SCHED-UI-01: `/signage/schedules` route registered under `<AdminOnly>`; SegmentedControl shows 4 segments with Schedules as the 4th; list renders with priority/updated_at desc sort; inline enabled toggle works with optimistic update + rollback; SSE `schedule-changed` invalidates the schedules query.
2. SGN-SCHED-UI-02: ScheduleEditDialog enforces the consolidated validation decision tree (playlist_required / weekdays_required / time_format / start_equals_end / midnight_span) with D-11 timing; submits via apiClient createSchedule/updateSchedule.
3. SGN-SCHED-UI-04: `npm run check:signage` green on all new files (no `dark:`, no raw `fetch(`, no direct DB imports). D-19 Vitest component tests cover editor validation, weekday quick-picks, inline toggle optimistic+rollback, SSE invalidation, and highlight param behaviors.
4. Cross-tab 409 (D-13, D-14): PlaylistsPage delete on a playlist referenced by schedules shows the deep-link toast; Schedules page highlights the referenced rows for ~5s and scrolls the first into view; URL is cleaned.
</success_criteria>

<output>
After completion, create `.planning/phases/52-schedule-admin-ui/52-02-SUMMARY.md` with:
- What shipped (SchedulesPage + test, ScheduleEditDialog + test, ScheduleDeleteDialog, WeekdayCheckboxRow, scheduleAdapters + tests, route, SignagePage wire, SSE schedule-changed case, PlaylistsPage 409 upgrade, deletePlaylist → apiClientWithBody)
- Which file owns the SSE switch (SignagePage.tsx vs. a hook) and where the new case lives
- Notable design calls (e.g. chose react-hook-form vs plain useState in the editor — whichever matched PlaylistNewDialog)
- Any D-12 rule that ended up warning-only instead of blocking (advisory overlap check) with rationale
- Confirmation that `error.start_after_end` is NOT emitted by client-side validation (kept in i18n only for API-error parity)
- Carry-forward for Plan 03: none — docs plan is independent
</output>
