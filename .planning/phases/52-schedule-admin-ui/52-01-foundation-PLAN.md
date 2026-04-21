---
phase: 52-schedule-admin-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/lib/signageTypes.ts
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - frontend/src/signage/pages/SignagePage.tsx
autonomous: true
requirements:
  - SGN-SCHED-UI-01
  - SGN-SCHED-UI-02
  - SGN-SCHED-UI-04
must_haves:
  truths:
    - "SegmentedControl on /signage shows 4 segments: Media, Playlists, Devices, Schedules"
    - "signageApi exposes listSchedules/createSchedule/updateSchedule/deleteSchedule backed by apiClient (no raw fetch)"
    - "SignageSchedule type exactly mirrors backend ScheduleRead (uuid id/playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled, created_at, updated_at)"
    - "Every signage.admin.schedules.* and signage.admin.nav.schedules key exists in both en.json and de.json with du-tone in DE"
    - "queryKeys.ts exports signageKeys.schedules() returning ['signage', 'schedules']"
  artifacts:
    - path: "frontend/src/signage/lib/signageTypes.ts"
      provides: "SignageSchedule TS type"
      contains: "export interface SignageSchedule"
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "Schedule CRUD methods on signageApi"
      contains: "listSchedules"
    - path: "frontend/src/lib/queryKeys.ts"
      provides: "signageKeys.schedules()"
      contains: "schedules:"
    - path: "frontend/src/locales/en.json"
      provides: "EN i18n keys under signage.admin.schedules"
      contains: "schedules"
    - path: "frontend/src/locales/de.json"
      provides: "DE i18n keys (du-tone)"
      contains: "Zeitpl"
    - path: "frontend/src/signage/pages/SignagePage.tsx"
      provides: "4th SegmentedControl segment"
      contains: "schedules"
  key_links:
    - from: "signageApi.listSchedules"
      to: "GET /api/signage/schedules"
      via: "apiClient<SignageSchedule[]>"
      pattern: "apiClient.*signage/schedules"
    - from: "SignagePage tabs array"
      to: "SchedulesPage route"
      via: "4th segment value 'schedules' path '/signage/schedules'"
      pattern: "id:\\s*['\"]schedules['\"]"
---

<objective>
Lay the type + transport + i18n foundation for Phase 52's Schedules tab. No UI components yet — this plan makes all non-visual plumbing available so Plan 02 can mount the page and dialogs without scavenging the codebase for contracts.

Purpose: Interface-first ordering. Plan 02 depends on `SignageSchedule`, `signageApi.listSchedules/create/update/delete`, `signageKeys.schedules()`, and every `signage.admin.schedules.*` i18n key existing in both locales. Wiring those up front means Plan 02 is pure rendering.

Output: Updated types/api/queryKeys, full bilingual i18n keyset from 52-UI-SPEC §Copywriting Contract, SignagePage extended with a `schedules` 4th segment that (temporarily) renders `null` — Plan 02 replaces the `null` with `<SchedulesPage />`.
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
@.planning/phases/51-schedule-schema-resolver/51-02-SUMMARY.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/signage/pages/SignagePage.tsx
@backend/app/schemas/signage.py
@backend/app/routers/signage_admin/schedules.py

<interfaces>
<!-- Backend contract (already shipped in Phase 51 Plan 02) — executor must mirror these exactly. -->

From backend/app/schemas/signage.py (ScheduleRead):
```python
class ScheduleBase(BaseModel):
    playlist_id: uuid.UUID
    weekday_mask: int = Field(..., ge=0, le=127)   # bit0=Mo..bit6=So
    start_hhmm: int  = Field(..., ge=0, le=2359)   # integer HHMM (e.g. 730, 1430)
    end_hhmm:   int  = Field(..., ge=0, le=2359)
    priority:   int = 0
    enabled:    bool = True

class ScheduleRead(ScheduleBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
```

From backend/app/routers/signage_admin/schedules.py:
- Mount: /api/signage/schedules (parent prefix /api/signage + router prefix /schedules)
- POST "" → 201, body ScheduleCreate (all ScheduleBase fields), returns ScheduleRead
- GET  "" → 200, returns list[ScheduleRead] ordered priority desc, updated_at desc
- PATCH "/{schedule_id}" → 200, body ScheduleUpdate (all optional), returns ScheduleRead
- DELETE "/{schedule_id}" → 204

From Phase 51 Plan 02 SUMMARY (playlist DELETE 409):
When DELETE /api/signage/playlists/{id} is blocked by active schedules, response is 409
with JSON body: { "detail": "Playlist has active schedules", "schedule_ids": ["uuid1", "uuid2"] }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add SignageSchedule type + query key + signageApi CRUD methods</name>
  <files>frontend/src/signage/lib/signageTypes.ts, frontend/src/signage/lib/signageApi.ts, frontend/src/lib/queryKeys.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageTypes.ts (existing type shapes for SignagePlaylist et al)
    - frontend/src/signage/lib/signageApi.ts (listPlaylists/createPlaylist/updatePlaylist/deletePlaylist precedent)
    - frontend/src/lib/queryKeys.ts (signageKeys block at the bottom)
    - backend/app/schemas/signage.py lines 225-290 (ScheduleBase/Create/Update/Read)
    - backend/app/routers/signage_admin/schedules.py lines 85-170 (routes + mounts)
  </read_first>
  <behavior>
    - `SignageSchedule` TypeScript interface matches ScheduleRead exactly
    - `signageApi.listSchedules()` GETs /api/signage/schedules via apiClient
    - `signageApi.createSchedule(body)` POSTs /api/signage/schedules via apiClient
    - `signageApi.updateSchedule(id, body)` PATCHes /api/signage/schedules/{id} via apiClient
    - `signageApi.deleteSchedule(id)` DELETEs /api/signage/schedules/{id} via apiClient
    - `signageKeys.schedules()` returns `['signage', 'schedules'] as const`
    - `signageKeys.scheduleItem(id)` returns `['signage', 'schedules', id] as const` (for per-row invalidation parity with mediaItem)
    - NO raw `fetch(` calls introduced (hard gate 2). apiClient only.
  </behavior>
  <action>
    In `frontend/src/signage/lib/signageTypes.ts`, append a new exported interface after the existing types. Per D-10 / UI-SPEC §Component Inventory:

    ```ts
    /**
     * Phase 52 SGN-SCHED-UI-01 — mirrors backend ScheduleRead
     * (backend/app/schemas/signage.py). weekday_mask bit0=Mo..bit6=So (D-05).
     * start_hhmm/end_hhmm are integers 0..2359 in HHMM form
     * (e.g. 730 = 07:30, 1430 = 14:30). Adapter to/from "HH:MM" lives in
     * the editor dialog (Plan 02).
     */
    export interface SignageSchedule {
      id: string;            // uuid
      playlist_id: string;   // uuid
      weekday_mask: number;  // 0..127, bit0=Mo..bit6=So
      start_hhmm: number;    // 0..2359
      end_hhmm: number;      // 0..2359
      priority: number;
      enabled: boolean;
      created_at: string;    // ISO8601
      updated_at: string;    // ISO8601
    }

    export interface SignageScheduleCreate {
      playlist_id: string;
      weekday_mask: number;
      start_hhmm: number;
      end_hhmm: number;
      priority?: number;
      enabled?: boolean;
    }

    export interface SignageScheduleUpdate {
      playlist_id?: string;
      weekday_mask?: number;
      start_hhmm?: number;
      end_hhmm?: number;
      priority?: number;
      enabled?: boolean;
    }
    ```

    In `frontend/src/signage/lib/signageApi.ts`:
    1. Add `SignageSchedule, SignageScheduleCreate, SignageScheduleUpdate` to the existing import block from `./signageTypes`.
    2. Inside the `signageApi` object, after the existing `deletePlaylist` entry, append:

    ```ts
    // Phase 52 SGN-SCHED-UI-01/02 — Schedules CRUD.
    // Backend router: backend/app/routers/signage_admin/schedules.py.
    // All methods use the shared apiClient (hard gate 2 — no raw fetch).
    listSchedules: () =>
      apiClient<SignageSchedule[]>("/api/signage/schedules"),
    createSchedule: (body: SignageScheduleCreate) =>
      apiClient<SignageSchedule>("/api/signage/schedules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateSchedule: (id: string, body: SignageScheduleUpdate) =>
      apiClient<SignageSchedule>(`/api/signage/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteSchedule: (id: string) =>
      apiClient<null>(`/api/signage/schedules/${id}`, { method: "DELETE" }),
    ```

    In `frontend/src/lib/queryKeys.ts`, inside the existing `signageKeys` object (it ends with `tags:`), add two entries after `tags`:

    ```ts
      // Phase 52 SGN-SCHED-UI-01
      schedules: () => ["signage", "schedules"] as const,
      scheduleItem: (id: string) => ["signage", "schedules", id] as const,
    ```

    Do NOT rewrite the whole `signageKeys` block. Just append these two entries before the closing `};`.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tee /tmp/tsc-52-01-t1.log; grep -E "SignageSchedule|listSchedules|createSchedule|updateSchedule|deleteSchedule|schedules\(\)|scheduleItem" src/signage/lib/signageTypes.ts src/signage/lib/signageApi.ts src/lib/queryKeys.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export interface SignageSchedule" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -q "export interface SignageScheduleCreate" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -q "export interface SignageScheduleUpdate" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -qE "listSchedules: \(\) =>" frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -qE "createSchedule: \(body: SignageScheduleCreate\)" frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -qE "updateSchedule: \(id: string, body: SignageScheduleUpdate\)" frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -qE "deleteSchedule: \(id: string\)" frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -q 'schedules: () => \["signage", "schedules"\] as const' frontend/src/lib/queryKeys.ts` succeeds
    - `grep -q 'scheduleItem: (id: string) => \["signage", "schedules", id\] as const' frontend/src/lib/queryKeys.ts` succeeds
    - No new raw `fetch(` in the diff: `git diff frontend/src/signage/lib/signageApi.ts | grep -E '^\+.*fetch\('` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0 (no type errors introduced)
  </acceptance_criteria>
  <done>SignageSchedule type, three signageApi CRUD methods, and two new signageKeys helpers exist and typecheck. No raw fetch added.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add all signage.admin.schedules.* i18n keys to en.json + de.json (DE du-tone)</name>
  <files>frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <read_first>
    - frontend/src/locales/en.json (search for existing `signage.admin.nav.*` and `signage.admin.playlists.*` blocks — match nesting style)
    - frontend/src/locales/de.json (search for existing du-tone phrasing — "Wähle", "Lege an", "Prüfe")
    - .planning/phases/52-schedule-admin-ui/52-UI-SPEC.md §Copywriting Contract (SSOT for every EN/DE pair below)
  </read_first>
  <behavior>
    - Every key listed in UI-SPEC §Copywriting Contract exists in BOTH en.json and de.json
    - DE copy uses informal "du" tone (never "Sie"/"Ihre")
    - Keys sit under the existing `signage` tree nesting style — use flat-dotted form if that's the project convention (Phase 46 Plan 01 STATE note: "flat-dotted top-level entries to match parity script's Object.keys contract"). Inspect existing en.json for nav block to confirm nesting convention used.
    - Playlist 409 cross-tab keys (`signage.admin.playlists.error.schedules_active_*`) added — used by Plan 02's PlaylistsPage upgrade.
  </behavior>
  <action>
    Open both `frontend/src/locales/en.json` and `frontend/src/locales/de.json`. Inspect the current `signage` block structure — Phase 46 Plan 01 used flat-dotted top-level keys (e.g. `"signage.admin.nav.media": "Media"`) to satisfy the parity CI. Match whatever style is currently present for existing `signage.admin.*` keys (nested object tree vs. flat-dotted strings).

    Add these keys in BOTH files, following the detected convention. Copy EN/DE values verbatim from 52-UI-SPEC.md §Copywriting Contract — do NOT paraphrase:

    Navigation:
    - `signage.admin.nav.schedules` → EN `Schedules`, DE `Zeitpläne`

    Page + CTAs:
    - `signage.admin.schedules.page_title` → `Schedules` / `Zeitpläne`
    - `signage.admin.schedules.new_cta` → `New schedule` / `Neuer Zeitplan`
    - `signage.admin.schedules.create_cta` → `Create schedule` / `Zeitplan erstellen`
    - `signage.admin.schedules.save_cta` → `Save changes` / `Änderungen speichern`
    - `signage.admin.schedules.cancel_cta` → `Cancel` / `Abbrechen`

    List columns + weekdays (14 keys — col.playlist/days/time/priority/enabled/actions + weekday.mo..su):
    Copy EN/DE pairs verbatim from UI-SPEC table "List — columns + row".

    Empty state (3 keys):
    - `signage.admin.schedules.empty_title`, `.empty_body`, `.empty_cta`
    Copy verbatim.

    Form fields (9 keys under `signage.admin.schedules.field.*`):
    - `field.playlist.label`, `field.playlist.placeholder`
    - `field.weekdays.label`, `field.weekdays.help`
    - `field.start.label`, `field.end.label`
    - `field.priority.label`, `field.priority.help`
    - `field.enabled.label`
    Copy verbatim.

    Weekday quick-picks (D-05) — 3 keys:
    - `signage.admin.schedules.quickpick.weekdays` → `Weekdays` / `Wochentags`
    - `signage.admin.schedules.quickpick.weekend`  → `Weekend`  / `Wochenende`
    - `signage.admin.schedules.quickpick.daily`    → `Daily`    / `Täglich`

    Validation + errors (8 keys under `signage.admin.schedules.error.*`):
    - `error.playlist_required`, `error.weekdays_required`
    - `error.start_after_end`, `error.start_equals_end`, `error.time_format`
    - `error.midnight_span` → EN `Keep the window within one day. Split midnight-spanning ranges into two schedules.` / DE `Der Zeitraum muss innerhalb eines Tages liegen. Teile ihn in zwei Einträge auf.` (D-07)
    - `error.save_failed` (with `{{detail}}` placeholder), `error.load_failed`, `error.delete_failed`
    Copy verbatim from UI-SPEC §Validation + error states.

    Toasts (5 keys under `signage.admin.schedules.toast.*`):
    - `toast.created`, `toast.updated`, `toast.deleted`, `toast.enabled`, `toast.disabled`
    Copy verbatim.

    Delete confirmation (4 keys under `signage.admin.schedules.delete.*`):
    - `delete.title` → `Delete schedule?` / `Zeitplan löschen?`
    - `delete.body`  → EN+DE per UI-SPEC (contains `{{name}}` placeholder)
    - `delete.confirm` → `Delete` / `Löschen`
    - `delete.cancel`  → `Cancel` / `Abbrechen`

    Cross-tab (Playlist 409) — 3 keys added under `signage.admin.playlists.error.*` (D-13, for Plan 02's PlaylistsPage.tsx upgrade):
    - `signage.admin.playlists.error.schedules_active_title` → `Playlist has active schedules` / `Playlist ist in Zeitplänen eingebunden`
    - `signage.admin.playlists.error.schedules_active_body`  → `Remove the playlist from these schedules first:` / `Entferne die Playlist erst aus diesen Zeitplänen:`
    - `signage.admin.playlists.error.schedules_active_link`  → `Schedule {{id_short}}` / `Zeitplan {{id_short}}`

    Total new keys: ~45. Every one must appear in BOTH en.json and de.json. DE values must not contain "Sie"/"Ihre" (du-tone).
  </action>
  <verify>
    <automated>cd frontend && npm run check:i18n-parity 2>&1 | tail -30 && node -e "const en=require('./src/locales/en.json'); const de=require('./src/locales/de.json'); const flat=o=>Object.keys(o).filter(k=>k.startsWith('signage.admin.schedules.')||k==='signage.admin.nav.schedules'||k.startsWith('signage.admin.playlists.error.schedules_active')); const ek=flat(en), dk=flat(de); const missingDe=ek.filter(k=>!(k in de)); const missingEn=dk.filter(k=>!(k in en)); if(missingDe.length||missingEn.length){console.error('PARITY FAIL', {missingDe, missingEn}); process.exit(1)} console.log('EN count:', ek.length, 'DE count:', dk.length)"</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run check:i18n-parity` exits 0
    - `grep -q '"signage.admin.nav.schedules"' frontend/src/locales/en.json` AND `... frontend/src/locales/de.json` succeed (or the equivalent for nested-object style; either way the parity CI must pass)
    - `grep -q '"signage.admin.schedules.page_title"' frontend/src/locales/en.json` (or nested equivalent) succeeds
    - `grep -q 'Zeitpläne' frontend/src/locales/de.json` succeeds
    - `grep -q 'Wähle' frontend/src/locales/de.json` succeeds (du-tone presence)
    - `grep -qE '"Ihre|"Sie |"Ihr ' frontend/src/locales/de.json` AGAINST the newly-added schedule keys returns empty — inspect the diff: `git diff frontend/src/locales/de.json | grep -E '^\+' | grep -E 'Sie |Ihre |Ihr '` returns nothing
    - Node script in verify command reports EN count == DE count for signage.admin.schedules.* keys
    - At least 45 new keys added across both files
  </acceptance_criteria>
  <done>All UI-SPEC §Copywriting keys live in both locales with du-tone DE. i18n-parity CI passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire Schedules as 4th SegmentedControl segment in SignagePage (placeholder render)</name>
  <files>frontend/src/signage/pages/SignagePage.tsx</files>
  <read_first>
    - frontend/src/signage/pages/SignagePage.tsx (full file — understand SignageTab union, tabs array, conditional render block)
  </read_first>
  <behavior>
    - `SignageTab` union includes `"schedules"` as a 4th member
    - `tabs` array has a 4th entry with `id: "schedules"`, `path: "/signage/schedules"`, `labelKey: "signage.admin.nav.schedules"` — appended AFTER `devices` (order: media, playlists, devices, schedules)
    - Conditional render block handles `active === "schedules"` — renders `null` in this plan (Plan 02 replaces with `<SchedulesPage />`)
    - No other logic changes in SignagePage
  </behavior>
  <action>
    Edit `frontend/src/signage/pages/SignagePage.tsx` with surgical changes only:

    1. Extend the `SignageTab` union (currently `"media" | "playlists" | "devices"`) to:
    ```ts
    type SignageTab = "media" | "playlists" | "devices" | "schedules";
    ```

    2. Append a 4th entry to the `tabs` array (after the `devices` entry, before the closing bracket):
    ```ts
      { id: "schedules", path: "/signage/schedules", labelKey: "signage.admin.nav.schedules" },
    ```

    3. After the existing `{active === "devices" && <DevicesPage />}` line, add a placeholder render for schedules. The full `SchedulesPage` component lands in Plan 02 — for now render `null` so this plan stays self-contained and type-safe:
    ```tsx
          {active === "schedules" && null /* Phase 52 Plan 02 mounts <SchedulesPage /> here */}
    ```

    Do NOT import SchedulesPage here (the file doesn't exist yet — import lands in Plan 02). Do NOT modify any other file in this task.

    Note: App.tsx route registration for `/signage/schedules` also lands in Plan 02 together with the SchedulesPage component. Visiting `/signage/schedules` before Plan 02 ships will hit the existing wouter fallthrough — acceptable because 52-01 and 52-02 are sequential (52-02 depends_on 52-01), so the intermediate state is never deployed.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -20 && grep -cE "'schedules'|\"schedules\"" src/signage/pages/SignagePage.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -qE 'type SignageTab = "media" \| "playlists" \| "devices" \| "schedules"' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -qE 'id: "schedules", path: "/signage/schedules", labelKey: "signage.admin.nav.schedules"' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -qE 'active === "schedules"' frontend/src/signage/pages/SignagePage.tsx` succeeds
    - `grep -cE '\{ id: "(media|playlists|devices|schedules)"' frontend/src/signage/pages/SignagePage.tsx` returns 4 (one line per tab)
    - The `tabs` array preserves order media→playlists→devices→schedules (grep line numbers should be ascending)
    - `cd frontend && npx tsc --noEmit` exits 0
    - No new imports added (SchedulesPage import is deferred to Plan 02): `git diff frontend/src/signage/pages/SignagePage.tsx | grep -E '^\+import'` returns empty
  </acceptance_criteria>
  <done>SignagePage renders Schedules as 4th SegmentedControl segment; active===schedules renders null awaiting Plan 02. Typechecks green.</done>
</task>

</tasks>

<verification>
Run from `frontend/`:
- `npx tsc --noEmit` → exit 0
- `npm run check:i18n-parity` → exit 0
- `npm run check:signage` → exit 0 (no `dark:` variants or raw fetch introduced)
- Visual smoke: load `/signage/media` in dev server → SegmentedControl shows 4 segments (Media / Playlists / Devices / Schedules). Clicking "Schedules" routes to `/signage/schedules` and renders an empty main area (placeholder null). Other tabs unaffected.
</verification>

<success_criteria>
1. `SignageSchedule` + `SignageScheduleCreate` + `SignageScheduleUpdate` exported from `signageTypes.ts`, match ScheduleRead field-for-field
2. `signageApi.{listSchedules, createSchedule, updateSchedule, deleteSchedule}` present, apiClient-only
3. `signageKeys.schedules()` + `signageKeys.scheduleItem(id)` exported from `queryKeys.ts`
4. All ~45 `signage.admin.schedules.*` + 3 `signage.admin.playlists.error.schedules_active_*` keys exist in both locales, DE uses du-tone, parity CI green
5. `SegmentedControl` on `/signage` renders 4 segments; 4th is `Schedules` → `/signage/schedules`
6. `npx tsc --noEmit` and `npm run check:signage` both pass
</success_criteria>

<output>
After completion, create `.planning/phases/52-schedule-admin-ui/52-01-SUMMARY.md` with:
- What shipped (types, API methods, query keys, i18n keys, SegmentedControl entry)
- Actual i18n key count (EN/DE)
- Whether en.json/de.json uses flat-dotted or nested-object form (Plan 02 copies this detail)
- Any deviations from the plan (e.g. if the convention forced a different nesting)
- Carry-forward for Plan 02: SchedulesPage import + App.tsx route + replace `null` with `<SchedulesPage />` in SignagePage
</output>
