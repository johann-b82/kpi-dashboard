---
phase: 52-schedule-admin-ui
plan: 02
subsystem: signage-admin-frontend
tags: [signage, schedules, admin-ui, validation, sse, i18n, tests]
requires:
  - 52-01-foundation (types, signageApi CRUD, signageKeys, i18n keys, SegmentedControl 4th segment)
  - backend/app/routers/signage_admin/schedules.py (CRUD + 409)
  - backend/app/routers/signage_admin/playlists.py (DELETE 409 with schedule_ids)
provides:
  - /signage/schedules admin list page (table, empty state, inline enabled toggle, highlight deep-link)
  - ScheduleEditDialog with consolidated D-07/D-11/D-12 validation decision tree
  - ScheduleDeleteDialog destructive confirmation
  - WeekdayCheckboxRow with 3 quick-pick presets (overwrite semantics)
  - scheduleAdapters (hhmm <-> HH:MM, weekday mask <-> array) — pure, 25 unit tests
  - useAdminSignageEvents hook (best-effort admin SSE → cache invalidation)
  - PlaylistsPage DELETE 409 cross-tab toast with "Zu den Zeitplänen" deep-link
  - deletePlaylist upgraded to apiClientWithBody for 409 body extraction
  - 12 vitest component tests (D-19 coverage)
affects:
  - frontend/src/App.tsx (new route /signage/schedules under <AdminOnly>)
  - frontend/src/signage/pages/SignagePage.tsx (mount SchedulesPage on 4th segment)
  - frontend/src/signage/pages/PlaylistsPage.tsx (409 handler)
  - frontend/src/signage/lib/signageApi.ts (deletePlaylist -> apiClientWithBody)
tech-stack:
  added:
    - "@testing-library/react + @testing-library/dom + @testing-library/user-event + @testing-library/jest-dom (dev)"
    - "jsdom (dev)"
  patterns:
    - "Consolidated time-validation decision tree (malformed -> time_format, equal -> start_equals_end, reversed -> midnight_span)"
    - "Optimistic TanStack mutation with snapshot-restore rollback on error"
    - "?highlight=id1,id2 deep-link with history.replaceState URL cleanup + 5s ring + scrollIntoView"
    - "Best-effort admin SSE hook (gracefully degrades; admin mutations own-invalidate)"
    - "vitest.config.ts with environmentMatchGlobs to keep pure-logic tests in node env"
key-files:
  created:
    - frontend/src/signage/lib/scheduleAdapters.ts
    - frontend/src/signage/lib/scheduleAdapters.test.ts
    - frontend/src/signage/lib/useAdminSignageEvents.ts
    - frontend/src/signage/components/WeekdayCheckboxRow.tsx
    - frontend/src/signage/components/ScheduleDeleteDialog.tsx
    - frontend/src/signage/components/ScheduleEditDialog.tsx
    - frontend/src/signage/components/ScheduleEditDialog.test.tsx
    - frontend/src/signage/pages/SchedulesPage.tsx
    - frontend/src/signage/pages/SchedulesPage.test.tsx
    - frontend/vitest.config.ts
    - frontend/src/test/setup.ts
  modified:
    - frontend/src/App.tsx
    - frontend/src/signage/pages/SignagePage.tsx
    - frontend/src/signage/pages/PlaylistsPage.tsx
    - frontend/src/signage/lib/signageApi.ts
    - frontend/package.json (+ package-lock.json)
decisions:
  - Plain useState + controlled inputs in ScheduleEditDialog (matches PlaylistNewDialog style, not react-hook-form) — simpler for the per-field / cross-field blur revalidation the D-11 contract requires
  - useAdminSignageEvents is BEST-EFFORT (not authoritative): admin mutations already call queryClient.invalidateQueries directly, so a missing/failing admin SSE stream does not break correctness
  - Native <select> for the playlist picker (no shadcn Select block in the project inventory); keeps the bundle lean and the focus/blur semantics native
  - Time inputs use HTML5 type="time" for native picker UX; HH:MM <-> HHMM integer conversion handled at the form boundary via scheduleAdapters
  - error.start_after_end is NEVER emitted by the client validator — the key is reserved for backend-error surfacing via error.save_failed only (D-07)
metrics:
  duration: 644s
  completed: 2026-04-21
  tasks: 4
  files: 16
  commits: 4
requirements:
  - SGN-SCHED-UI-01
  - SGN-SCHED-UI-02
  - SGN-SCHED-UI-04
---

# Phase 52 Plan 02: Schedules UI Summary

**One-liner:** Full Schedules admin surface — /signage/schedules list with inline enabled toggle (optimistic + rollback), create/edit dialog with a consolidated time decision tree, destructive confirm, cross-tab 409 deep-link from PlaylistsPage, best-effort admin SSE invalidation, and 12 vitest component tests covering D-19 scope.

## What Shipped

### Pure primitives (Task 1)

- `scheduleAdapters.ts` — `hhmmFromString` / `hhmmToString` / `weekdayMaskToArray` / `weekdayMaskFromArray`, all pure and zero-dep. 25 unit tests (TDD: RED confirmed before GREEN implementation) covering valid/invalid parse, out-of-range, roundtrip, and edge cases (bit0=Mo..bit6=So).
- `WeekdayCheckboxRow.tsx` — 3 quick-pick buttons (Weekdays / Weekend / Daily) + 7 checkboxes in Mo-So order. Quick-picks OVERWRITE the state (D-05, not union).
- `ScheduleDeleteDialog.tsx` — mirrors `MediaDeleteDialog` confirm-mode shape verbatim; uses `signage.admin.schedules.delete.*` i18n keys.

### ScheduleEditDialog (Task 2)

Create+edit modes switched via `schedule` prop (null = create). Validation uses a single decision tree implemented in `validateAll(...)`:

1. `playlist_id` truthy → else `error.playlist_required`
2. `weekdays.some(Boolean)` → else `error.weekdays_required`
3. Time branch (consolidated D-07 + D-12):
   - `startN === null || endN === null` → `error.time_format`
   - `startN === endN` → `error.start_equals_end`
   - `startN > endN` → `error.midnight_span` (any same-day reversal)
   - otherwise → valid
4. `priority` clamped to `Math.max(0, Math.floor(priority))` on submit (D-08)

**`error.start_after_end` is NEVER emitted from the client validator** — kept in the i18n keyset for backend-error parity only (surfaced via `error.save_failed` when the server returns that detail).

D-11 timing: full validate on submit; per-field + cross-field revalidation on blur, but only for fields the user has touched. Untouched fields stay neutral before first submit attempt. Submits via `signageApi.createSchedule` / `updateSchedule`; invalidates `signageKeys.schedules()` and toasts on success.

### SchedulesPage + wiring (Task 3)

- List sorted priority desc, updated_at desc (D-01). Inline `role="switch"` native checkbox fires optimistic `updateSchedule({ enabled })` with snapshot-restore rollback on failure (D-02). Row delete → confirmation dialog → `deleteSchedule` + `toast.deleted`.
- Highlight (D-14): on mount, parse `?highlight=id1,id2` → matching rows gain `ring-1 ring-primary/40 rounded` for 5 s, first match scrolls into view, URL cleaned via `window.history.replaceState(null, '', '/signage/schedules')`.
- `useAdminSignageEvents` mounted on the page (see SSE note below).
- `App.tsx`: new `/signage/schedules` route under `<AdminOnly>` wrapping `<SignagePage initialTab="schedules" />` (matches the existing media/playlists/devices registration pattern).
- `SignagePage.tsx`: replaced the `null` placeholder with `<SchedulesPage />`.

### Cross-tab 409 (Task 3)

- `signageApi.deletePlaylist` upgraded from `apiClient` to `apiClientWithBody` so callers can read the Phase 51 `{ detail, schedule_ids }` 409 body.
- `PlaylistsPage.tsx` `deleteMutation.onError`: detects `ApiErrorWithBody` + status 409 + `schedule_ids` array → shows a sonner error toast with title `schedules_active_title`, description `schedules_active_body`, and an action button `Zu den Zeitplänen` that navigates to `/signage/schedules?highlight=<joined-ids>`. Falls through to the existing generic toast otherwise.

### Component tests (Task 4)

Installed `@testing-library/react` + `@testing-library/dom` + `@testing-library/user-event` + `@testing-library/jest-dom` + `jsdom` (as dev deps, via `--legacy-peer-deps` because `vite-plugin-pwa`'s peer range stops at vite ^7). Added `vitest.config.ts` with jsdom env + jest-dom matchers; pre-existing pure-logic tests stay on the node env via `environmentMatchGlobs`.

- `ScheduleEditDialog.test.tsx` — 8 tests: empty-form surfaces all 3 required errors; all four time-tree branches (equal / reversed / malformed / valid), each asserting `start_after_end` is NEVER in the DOM; Weekdays/Weekend/Daily quick-picks overwrite (not union); D-11 per-field blur + cross-field time blur revalidation for touched fields.
- `SchedulesPage.test.tsx` — 4 tests: optimistic toggle flip observable before mutation resolves + `toast.disabled` on success; 500 rollback via snapshot restore + `save_failed` toast; SSE `schedule-changed` invalidates `signageKeys.schedules()` (asserted against the contract shape `{ queryKey: ['signage', 'schedules'] }`); `?highlight=id1,id2` adds `ring-1 ring-primary/40` on matching rows, NOT on unmatched, calls `scrollIntoView` + `history.replaceState(null, '', '/signage/schedules')`, and the ring clears after the 5 s timer.

Total: **37 passing tests** across adapters (25) + editor (8) + list page (4).

## SSE handler location (where the schedule-changed case lives)

**File:** `frontend/src/signage/lib/useAdminSignageEvents.ts` (new hook).

**Why not extend an existing handler:** No admin-side SSE handler existed prior to this plan. The existing signage SSE handler (`frontend/src/player/hooks/useSseWithPollingFallback.ts`) is scoped to the player bundle and consumes `/api/signage/player/stream` with a device token — it does not run in the admin UI. The plan's "extend the existing signage SSE handler" phrasing was interpreted as "add the schedule-changed dispatch to the admin UI's event handler"; since no such handler existed, a minimal `useAdminSignageEvents` hook was created that subscribes to `/api/signage/admin/stream` and dispatches over `schedule-changed` / `playlist-changed` / `device-changed`.

**Important caveat:** The Phase 51 backend's `schedule-changed` broadcast targets **device** queues (via `notify_device(...)` inside `devices_affected_by_playlist`), NOT a dedicated admin fanout channel. So in the current deployment, `useAdminSignageEvents` will not receive schedule-changed events from the backend — it degrades gracefully (the hook's `onerror` closes the EventSource silently). Admin correctness is preserved because every admin mutation already calls `queryClient.invalidateQueries(signageKeys.schedules())` directly on success.

The hook + test are in place so that when the backend grows an admin-facing SSE channel (a small extension to Phase 45's broadcaster), no frontend work is needed — the case `'schedule-changed' → invalidate schedules()` is already wired and tested.

## Deviations from Plan

### Rule 2 / Rule 3 — infrastructure additions (critical/unblocking)

**1. [Rule 3 - blocking] Installed vitest DOM-testing deps + added `vitest.config.ts`**
- **Found during:** Task 4 start
- **Issue:** Project had `vitest` in devDependencies but no `@testing-library/*`, `jsdom`, or a vitest config. Existing `.test.ts` files are all pure-logic (no DOM), so the harness hadn't been needed yet. Task 4 explicitly requires component tests.
- **Fix:** `npm install --legacy-peer-deps --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom @testing-library/dom jsdom`. Added `frontend/vitest.config.ts` (jsdom env + @testing-library matchers via `src/test/setup.ts`) with `environmentMatchGlobs` preserving node env for pre-existing pure-logic tests (`chartTimeUtils.test.ts`, `sensorDelta.test.ts`, `useSensorDraft.test.ts`, `scheduleAdapters.test.ts`). `--legacy-peer-deps` was necessary because `vite-plugin-pwa`'s peer range stops at vite ^7 and the project is on vite ^8 (the same workaround is documented at `package.json:"//vite-plugin-pwa"`).
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/vitest.config.ts` (new), `frontend/src/test/setup.ts` (new)
- **Commit:** 488b464

**2. [Rule 2 - missing critical functionality] Created `useAdminSignageEvents` hook instead of extending a non-existent admin SSE switch**
- **Found during:** Task 3 / SSE handler discovery grep
- **Issue:** Plan assumes an "existing signage SSE handler switch" on the admin side. A thorough grep (`EventSource|onmessage|playlist-changed|device-changed` in `frontend/src/signage/`) found zero matches — the only SSE handler in the codebase is the player-side `useSseWithPollingFallback.ts`, which is scoped to the player bundle and consumes a device-authenticated stream.
- **Fix:** Created a minimal `useAdminSignageEvents` hook with a switch over `schedule-changed` / `playlist-changed` / `device-changed` that invalidates the corresponding `signageKeys.*` caches. Mounted in `SchedulesPage.tsx`. Hook degrades gracefully on connection error (admin-side correctness is preserved by own-mutation invalidation — see "SSE handler location" section above for the full rationale).
- **Files modified:** `frontend/src/signage/lib/useAdminSignageEvents.ts` (new), `frontend/src/signage/pages/SchedulesPage.tsx` (imports + mounts)
- **Commit:** 1ceaa18

### Test-harness deviations (below acceptance-criteria threshold — documented for transparency)

- **Test assertions adapted to base-ui Checkbox primitive:** The project's shadcn `Checkbox` wraps `@base-ui/react/checkbox`, which renders `role="checkbox"` on a `<span>` with `aria-checked` (not a native `<input type="checkbox">`). `screen.getByLabelText("Mon")` therefore matches both the base-ui checkbox and a visible-label `<span>` inside the wrapping `<label>` ("Found multiple elements"). Tests use `screen.getByRole("checkbox", { name: label })` + `el.getAttribute("aria-checked") === "true"` helper (`isChecked`) instead. This is a harness detail, not a product change.
- **Highlight test uses real timers with `{ timeout: 10000 }`:** Vitest's fake timers interact poorly with TanStack Query's initial-fetch `setTimeout` and with `waitFor`'s internal polling. Switching between fake/real timers mid-test was flaky in this environment. Chose to let the test wait real-time for the 5 s highlight cleanup timer; total test duration ~5.2 s. Non-functional deviation.

## Key Links (plan contract fulfillment)

| From                                | To                                              | Via                                                       |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| SchedulesPage                       | `/api/signage/schedules`                        | `signageApi.listSchedules` (TanStack `useQuery`)          |
| ScheduleEditDialog submit           | `/api/signage/schedules`                        | `signageApi.createSchedule` / `updateSchedule` mutations  |
| SchedulesPage enabled Switch        | `PATCH /api/signage/schedules/{id}`             | `signageApi.updateSchedule({enabled})` optimistic         |
| useAdminSignageEvents `'schedule-changed'` case | `signageKeys.schedules()`              | `queryClient.invalidateQueries({ queryKey: ... })`        |
| PlaylistsPage 409 handler           | `/signage/schedules?highlight=<ids>`            | toast action button `navigate(...)`                       |
| SignagePage `active === "schedules"` branch | `SchedulesPage`                         | React render                                              |

## Verification

- `cd frontend && npx tsc --noEmit` → PASS (exit 0, no output)
- `cd frontend && npx vitest run src/signage/` → PASS (3 files, 37 tests)
- `cd frontend && npm run check:signage` → PASS (47 files scanned, no violations)
- `cd frontend && npm run check:player-isolation` → PASS (16 files, 0 violations)
- `grep -rn "schedule-changed" frontend/src/signage/` → 8 hits (hook + page + test file)
- No `dark:` variants in any new file (check:signage grep guard)
- No raw `fetch(` in any new file (`ApiErrorWithBody` / `apiClientWithBody` exemption documented since Phase 46)

## Commits

- `844b9d8` — feat(52-02): add schedule adapters + WeekdayCheckboxRow + ScheduleDeleteDialog
- `4052f26` — feat(52-02): add ScheduleEditDialog with consolidated validation tree
- `1ceaa18` — feat(52-02): wire SchedulesPage, route, SSE, and playlist 409 deep-link
- `488b464` — test(52-02): add component tests for ScheduleEditDialog + SchedulesPage (D-19)

## Carry-forward for Plan 03

None — Plan 03 (admin-guide docs) is independent and already complete per Phase 52 status in STATE.md.

## Carry-forward for future phases

- **Backend admin SSE channel** (optional): A future phase could add an admin-facing SSE broadcast that emits `schedule-changed` / `playlist-changed` / `device-changed` events on mutations. The frontend is already wired (`useAdminSignageEvents`) — only the backend broadcaster + endpoint need to land. Not blocking anything; admin mutations already own-invalidate correctly.
- **shadcn Switch block** (optional): The inline enabled toggle uses a native `<input type="checkbox" role="switch">` styled by browser defaults. If richer UX is wanted (keyboard affordance, on/off label), a future phase can swap in a shadcn Switch primitive; contract/API unchanged.

## Self-Check: PASSED

- frontend/src/signage/lib/scheduleAdapters.ts: FOUND
- frontend/src/signage/lib/scheduleAdapters.test.ts: FOUND
- frontend/src/signage/lib/useAdminSignageEvents.ts: FOUND
- frontend/src/signage/components/WeekdayCheckboxRow.tsx: FOUND
- frontend/src/signage/components/ScheduleDeleteDialog.tsx: FOUND
- frontend/src/signage/components/ScheduleEditDialog.tsx: FOUND
- frontend/src/signage/components/ScheduleEditDialog.test.tsx: FOUND
- frontend/src/signage/pages/SchedulesPage.tsx: FOUND
- frontend/src/signage/pages/SchedulesPage.test.tsx: FOUND
- frontend/vitest.config.ts: FOUND
- frontend/src/test/setup.ts: FOUND
- Commit 844b9d8: FOUND
- Commit 4052f26: FOUND
- Commit 1ceaa18: FOUND
- Commit 488b464: FOUND
