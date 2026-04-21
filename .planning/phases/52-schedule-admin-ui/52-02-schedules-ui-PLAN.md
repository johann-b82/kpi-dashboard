---
phase: 52-schedule-admin-ui
plan: 02
type: execute
wave: 2
depends_on:
  - 52-01
files_modified:
  - frontend/src/signage/pages/SchedulesPage.tsx
  - frontend/src/signage/components/ScheduleEditDialog.tsx
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
    - "Midnight-spanning windows (start≥end) are blocked with the midnight_span error message; no auto-split (D-07)"
    - "Weekday quick-picks (Wochentags / Wochenende / Täglich) overwrite the 7 checkboxes (D-05)"
    - "Time inputs use native type=time; HH:MM ↔ HHMM integer conversion handled client-side at the form boundary (D-06)"
    - "Inline enabled toggle on each row fires PATCH with optimistic update + rollback on failure (D-02)"
    - "Row delete opens confirmation dialog; on confirm → DELETE + toast.success + list invalidate"
    - "Table default ordering is priority desc, then updated_at desc (D-01)"
    - "SchedulesPage reads ?highlight=id1,id2,... query param → matching rows gain ring-1 ring-primary/40 for ~5s; first match scrolls into view; URL cleaned via history.replaceState (D-14)"
    - "PlaylistsPage handles 409 {detail, schedule_ids} from deletePlaylist: shows sonner error with schedules_active_title/body and action button 'Zu den Zeitplänen' that navigates to /signage/schedules?highlight=... (D-13)"
    - "No raw fetch( anywhere in the new/modified files (hard gate 2). No dark: Tailwind variants (hard gate 3). npm run check:signage passes."
  artifacts:
    - path: "frontend/src/signage/pages/SchedulesPage.tsx"
      provides: "Schedules list page — table, empty state, new-schedule CTA, highlight handling"
      min_lines: 120
    - path: "frontend/src/signage/components/ScheduleEditDialog.tsx"
      provides: "Create/edit dialog with all validation rules (D-11/D-12)"
      min_lines: 150
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
Ship the Schedules admin UI: list page, create/edit dialog, delete confirmation, weekday bitmask row, time adapters, route registration, SignagePage integration, and the cross-tab 409 UX on PlaylistsPage. This is the user-visible core of Phase 52.

Purpose: Deliver SGN-SCHED-UI-01 (4th tab + AdminOnly + list), SGN-SCHED-UI-02 (editor + all validation), and the check:signage side of SGN-SCHED-UI-04 (no dark: / no raw fetch).

Output: A fully functional Schedules tab where an admin can create/read/update/delete schedules and toggle enabled inline, plus the Playlists-delete 409 toast with deep-link into the highlight flow.
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

    Validation rules (D-12) enforced before submit:
    1. playlist_id truthy → else error `signage.admin.schedules.error.playlist_required`
    2. at least one weekday → else `error.weekdays_required`
    3. start and end both parse via hhmmFromString → else `error.time_format`
    4. start < end strict → else `error.start_after_end` (or `error.start_equals_end` if equal)
    5. start >= end with non-equal → D-07 midnight-span → `error.midnight_span` (block submit, no auto-split)
    6. priority is a non-negative integer → else clamp to 0 on submit (D-08 helper hint implies forgiveness)

    Validation timing (D-11):
    - `errors` map on submit attempt for all fields
    - On blur of a field that has been touched at least once, re-validate only that field + cross-field pairs (e.g. blurring end re-checks start<end if start touched)
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
    4. Validation function `validate(field?, values)` → returns `{errors, isValid}`. Full-form variant for submit; per-field variant for onBlur.
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
    - All five validation error keys referenced: `grep -cE 'error\.(playlist_required|weekdays_required|start_after_end|time_format|midnight_span)' frontend/src/signage/components/ScheduleEditDialog.tsx` returns ≥5
    - `grep -q 'toast.created' frontend/src/signage/components/ScheduleEditDialog.tsx` AND `grep -q 'toast.updated' ...` succeed
    - `grep -q 'invalidateQueries' frontend/src/signage/components/ScheduleEditDialog.tsx` succeeds with signageKeys.schedules() query key
    - `grep -nE 'dark:|fetch\(' frontend/src/signage/components/ScheduleEditDialog.tsx` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Editor dialog handles create+edit, all six validation rules, timings per D-11, submits via apiClient, invalidates and toasts.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: SchedulesPage (list + highlight) + route + SignagePage wire + PlaylistsPage 409 upgrade</name>
  <files>frontend/src/signage/pages/SchedulesPage.tsx, frontend/src/App.tsx, frontend/src/signage/pages/SignagePage.tsx, frontend/src/signage/pages/PlaylistsPage.tsx, frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/pages/DevicesPage.tsx (table + empty-state + inline toggle pattern — copy shape)
    - frontend/src/signage/pages/PlaylistsPage.tsx (existing deletePlaylist mutation — will be upgraded to detect 409 with schedule_ids)
    - frontend/src/signage/pages/SignagePage.tsx (the null placeholder from Plan 01 — replace with <SchedulesPage/>)
    - frontend/src/App.tsx (existing /signage/devices route registration under <AdminOnly>)
    - frontend/src/signage/lib/signageApi.ts (existing deletePlaylist → upgrade to apiClientWithBody for 409 body extraction)
    - frontend/src/signage/components/ScheduleEditDialog.tsx (Task 2)
    - frontend/src/signage/components/ScheduleDeleteDialog.tsx (Task 1)
    - frontend/src/signage/lib/scheduleAdapters.ts (Task 1)
    - .planning/phases/52-schedule-admin-ui/52-CONTEXT.md §List (D-01, D-02, D-03), §Cross-tab integration (D-13, D-14)
  </read_first>
  <behavior>
    **SchedulesPage.tsx:**
    - Fetches via `useQuery({ queryKey: signageKeys.schedules(), queryFn: signageApi.listSchedules })` and playlists via `signageApi.listPlaylists()` for name lookup.
    - Client-side sort: priority desc, then updated_at desc (D-01) — `[...schedules].sort((a,b)=> b.priority - a.priority || b.updated_at.localeCompare(a.updated_at))`.
    - Renders layout container `max-w-7xl mx-auto px-6 pt-4 pb-16 space-y-6`? NO — SignagePage already provides this wrapper. SchedulesPage renders `<section className="space-y-4">` and starts with the header row: a right-aligned `<Button>` labeled `signage.admin.schedules.new_cta` that opens the edit dialog in create mode.
    - While loading: render the same "loading" div as PlaylistsPage (the muted-foreground one). On error: render the destructive error card with `signage.admin.schedules.error.load_failed`.
    - Empty state (schedules.length === 0): `<section className="rounded-md border border-border bg-card p-12 text-center space-y-3">` with `<h2 className="text-lg font-semibold">{t('empty_title')}</h2>`, `<p className="text-sm text-muted-foreground">{t('empty_body')}</p>`, and an empty-state Button opening the create dialog.
    - Populated: shadcn Table with headers from `col.playlist/days/time/priority/enabled/actions` i18n keys. Per row:
      - Playlist: look up name from playlists map; fallback to `{id[:8]}…` if missing.
      - Days: render 7 weekday abbreviations separated by spaces; checked weekdays have `font-semibold`, unchecked have `text-muted-foreground`. Uses `weekdayMaskToArray(sched.weekday_mask)` + the 7 weekday i18n keys.
      - Time window: `${hhmmToString(sched.start_hhmm)} – ${hhmmToString(sched.end_hhmm)}` (en-dash).
      - Priority: raw number.
      - Enabled: shadcn `Switch` (or controlled Checkbox) that fires an inline PATCH via `signageApi.updateSchedule(id, {enabled: next})`. Optimistic: `queryClient.setQueryData(signageKeys.schedules(), (prev)=> prev.map(s => s.id===id ? {...s, enabled: next} : s))` BEFORE the await; on error: revert via the previous snapshot + `toast.error(save_failed)`; on success: `toast.success(enabled? toast.enabled : toast.disabled)` + `invalidateQueries(signageKeys.schedules())`.
      - Actions: Edit icon-button opens edit dialog with this schedule; Trash2 icon-button (text-destructive) opens ScheduleDeleteDialog.

    - Highlight (D-14):
      - Read `?highlight=id1,id2,…` on mount via `useSearch()` from wouter or `new URLSearchParams(location.search)`.
      - Highlighted row gets `ring-1 ring-primary/40 rounded` attribute for 5 s (useEffect with setTimeout clearing a `highlightedIds` state).
      - After capturing the IDs, call `window.history.replaceState(null, '', '/signage/schedules')` so back-nav doesn't restore the param.
      - First matching row scrolls into view via `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on mount.

    - Dialog state: `const [editing, setEditing] = useState<SignageSchedule | null | undefined>(undefined)` — undefined = closed, null = create, object = edit. Delete target state: `const [deleteTarget, setDeleteTarget] = useState<SignageSchedule | null>(null)`.

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
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -20 && npm run check:signage 2>&1 | tail -20 && grep -c "SchedulesPage" src/signage/pages/SignagePage.tsx src/App.tsx && ! grep -nE 'dark:|fetch\(' src/signage/pages/SchedulesPage.tsx</automated>
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
    - `grep -q '<AdminOnly>' frontend/src/App.tsx` context shows wrap around the schedules route (inspect with `grep -A2 "schedules" frontend/src/App.tsx` — must show AdminOnly)
    - `grep -q 'import { SchedulesPage }' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -q 'active === "schedules" && <SchedulesPage' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -q 'apiClientWithBody' frontend/src/signage/lib/signageApi.ts | head -1` — deletePlaylist line now uses apiClientWithBody: `grep -A2 "deletePlaylist:" frontend/src/signage/lib/signageApi.ts` shows apiClientWithBody
    - `grep -q 'schedule_ids' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -q 'schedules_active_title' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -q 'highlight=' frontend/src/signage/pages/PlaylistsPage.tsx` succeeds
    - `grep -rnE 'dark:' frontend/src/signage/pages/SchedulesPage.tsx frontend/src/signage/components/Schedule*.tsx frontend/src/signage/components/WeekdayCheckboxRow.tsx` returns empty
    - `grep -rnE 'fetch\(' frontend/src/signage/pages/SchedulesPage.tsx frontend/src/signage/components/Schedule*.tsx frontend/src/signage/components/WeekdayCheckboxRow.tsx frontend/src/signage/lib/scheduleAdapters.ts` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npm run check:signage` exits 0
  </acceptance_criteria>
  <done>/signage/schedules renders the admin-gated table; create/edit/delete/toggle-enabled all flow through apiClient. Highlight param works. PlaylistsPage shows the schedule-aware 409 toast with deep-link.</done>
</task>

</tasks>

<verification>
Run from `frontend/`:
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/signage/lib/scheduleAdapters.test.ts` → all green
- `npm run check:signage` → exit 0 (no `dark:`, no raw `fetch(`, no sqlite3/psycopg2 imports)
- `npm run check:i18n-parity` → exit 0 (keys added by Plan 01 are consumed here)
- Manual smoke in dev server:
  1. Navigate to `/signage` → SegmentedControl 4th segment "Schedules" visible
  2. Click it → `/signage/schedules`, empty state shown with "New schedule" CTA
  3. Create a schedule (Mo-Fr / 07:00 / 11:00 / priority 10) → row appears at top of table
  4. Try start=12:00 end=11:00 → inline error "Start time must be before end time" blocks submit
  5. Try no weekdays → "Pick at least one weekday" error
  6. Toggle enabled off on a row → optimistic flip + toast.disabled; refreshing preserves state
  7. Delete a schedule → confirmation dialog → confirm → row removed + toast.deleted
  8. Create playlist referenced by a schedule; delete the playlist → toast with "Zu den Zeitplänen" action → clicking it navigates to `/signage/schedules?highlight=...` → matching row ring visible ~5s → URL cleans up
</verification>

<success_criteria>
1. SGN-SCHED-UI-01: `/signage/schedules` route registered under `<AdminOnly>`; SegmentedControl shows 4 segments with Schedules as the 4th; list renders with priority/updated_at desc sort; inline enabled toggle works with optimistic update + rollback.
2. SGN-SCHED-UI-02: ScheduleEditDialog enforces all 6 validation rules (playlist/weekdays/time-format/start<end/midnight-span/priority) with D-11 timing; submits via apiClient createSchedule/updateSchedule.
3. SGN-SCHED-UI-04: `npm run check:signage` green on all new files (no `dark:`, no raw `fetch(`, no direct DB imports).
4. Cross-tab 409 (D-13, D-14): PlaylistsPage delete on a playlist referenced by schedules shows the deep-link toast; Schedules page highlights the referenced rows for ~5s and scrolls the first into view; URL is cleaned.
</success_criteria>

<output>
After completion, create `.planning/phases/52-schedule-admin-ui/52-02-SUMMARY.md` with:
- What shipped (SchedulesPage, ScheduleEditDialog, ScheduleDeleteDialog, WeekdayCheckboxRow, scheduleAdapters + tests, route, SignagePage wire, PlaylistsPage 409 upgrade, deletePlaylist → apiClientWithBody)
- Notable design calls (e.g. chose react-hook-form vs plain useState in the editor — whichever matched PlaylistNewDialog)
- Any D-12 rule that ended up warning-only instead of blocking (advisory overlap check) with rationale
- Carry-forward for Plan 03: none — docs plan is independent
</output>
