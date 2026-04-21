---
phase: 52-schedule-admin-ui
plan: 01
subsystem: signage-admin-frontend
tags: [signage, schedules, i18n, types, api, frontend]
requires:
  - backend/app/schemas/signage.py (ScheduleRead)
  - backend/app/routers/signage_admin/schedules.py (/api/signage/schedules)
  - Phase 51 Plan 02 (schedule-changed SSE + playlist DELETE 409)
provides:
  - SignageSchedule / SignageScheduleCreate / SignageScheduleUpdate TS types
  - signageApi.listSchedules / createSchedule / updateSchedule / deleteSchedule
  - signageKeys.schedules() / scheduleItem(id)
  - All signage.admin.schedules.* + signage.admin.nav.schedules + playlists 409 i18n keys (EN/DE)
  - 4th "Schedules" segment in SignagePage SegmentedControl
affects:
  - frontend/src/signage/lib/signageTypes.ts
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - frontend/src/signage/pages/SignagePage.tsx
tech-stack:
  added: []
  patterns:
    - apiClient-only (hard gate 2 — no raw fetch introduced)
    - flat-dotted i18n keys (matches Phase 46 parity contract)
    - 4-role SegmentedControl pattern (matches existing media/playlists/devices)
key-files:
  created: []
  modified:
    - frontend/src/signage/lib/signageTypes.ts
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/signage/pages/SignagePage.tsx
decisions:
  - Flat-dotted top-level i18n keys (not nested objects) matches Phase 46 parity script contract
  - SegmentedControl placeholder renders null — Plan 02 replaces with <SchedulesPage />
  - SchedulesPage import deferred to Plan 02 (component doesn't exist yet)
  - App.tsx /signage/schedules route registration deferred to Plan 02 (ships with the page)
metrics:
  duration: 146s
  completed: 2026-04-21
  tasks: 3
  files: 6
  commits: 3
requirements:
  - SGN-SCHED-UI-01
  - SGN-SCHED-UI-02
  - SGN-SCHED-UI-04
---

# Phase 52 Plan 01: Foundation Summary

**One-liner:** Type/transport/i18n plumbing for Phase 52 Schedules — SignageSchedule TS type, 4 signageApi CRUD methods, 55 new bilingual i18n keys, and a 4th "Schedules" SegmentedControl segment (renders null awaiting Plan 02).

## What Shipped

### Types (signageTypes.ts)
- `SignageSchedule` — mirrors backend ScheduleRead: `id`, `playlist_id` (both uuid strings), `weekday_mask` (0..127 bit0=Mo..bit6=So), `start_hhmm` / `end_hhmm` (0..2359 HHMM integers), `priority`, `enabled`, `created_at`, `updated_at`.
- `SignageScheduleCreate` — all ScheduleBase fields; `priority`/`enabled` optional.
- `SignageScheduleUpdate` — all fields optional (PATCH body).

### API (signageApi.ts)
- `listSchedules()` → `GET /api/signage/schedules`
- `createSchedule(body)` → `POST /api/signage/schedules`
- `updateSchedule(id, body)` → `PATCH /api/signage/schedules/{id}`
- `deleteSchedule(id)` → `DELETE /api/signage/schedules/{id}`
- All via shared `apiClient` (hard gate 2). No raw `fetch()` introduced.

### Query keys (queryKeys.ts)
- `signageKeys.schedules()` → `["signage", "schedules"] as const`
- `signageKeys.scheduleItem(id)` → `["signage", "schedules", id] as const`

### i18n (en.json / de.json)
- **55 new keys** added in flat-dotted form (matches existing `signage.admin.*` convention).
- Breakdown: 1 nav, 4 page CTAs, 6 column headers, 7 weekday labels, 3 empty state, 9 form fields, 3 weekday quick-picks, 8 validation/error (incl. `midnight_span` D-07 + `{{detail}}` placeholders), 5 toasts, 4 delete confirmation, 3 playlist-DELETE 409 cross-tab keys under `signage.admin.playlists.error.schedules_active_*`.
- DE uses informal "du" tone throughout (verified: no `Sie`/`Ihre`/`Ihr ` in diff).
- Parity verified: EN total = 462, DE total = 462, no missing keys in either locale.

### SignagePage
- `SignageTab` union extended to `"media" | "playlists" | "devices" | "schedules"`.
- `tabs` array appends a 4th entry `{ id: "schedules", path: "/signage/schedules", labelKey: "signage.admin.nav.schedules" }` after `devices` (order: media → playlists → devices → schedules).
- Conditional render block: `{active === "schedules" && null /* Phase 52 Plan 02 mounts <SchedulesPage /> here */}`.
- No new imports added; SchedulesPage import lands in Plan 02.

## i18n Style Detail (for Plan 02)

en.json and de.json both use **flat-dotted top-level keys** (e.g. `"signage.admin.schedules.page_title": "..."`). This matches the Phase 46 parity script's `Object.keys` contract. Plan 02 MUST follow the same convention when adding any further keys.

## Verification

- `cd frontend && npx tsc --noEmit` → PASS (exit 0, no output)
- `cd frontend && npm run check:signage` → PASS (41 files scanned, no dark: variants or raw fetch introduced)
- i18n parity (inline node check — no dedicated npm script exists in this project): EN 462 == DE 462, zero missing keys in either locale.
- `git diff` grep for new `fetch(` → empty (apiClient-only).
- `git diff frontend/src/locales/de.json | grep` for `Sie |Ihre |Ihr ` → empty (du-tone preserved).

## Commits

- `be9d7b2` — feat(52-01): add SignageSchedule types, signageApi CRUD, query keys
- `070f263` — feat(52-01): add signage.admin.schedules i18n keys (EN/DE du-tone)
- `e743118` — feat(52-01): add Schedules as 4th SegmentedControl segment

## Deviations from Plan

**None — plan executed exactly as written.**

Note: the plan's `verify` block referenced `npm run check:i18n-parity`, but no such script exists in `frontend/package.json`. Used the plan's inline node parity check (Object.keys comparison of en/de) as the authoritative parity verification. This is not a functional deviation (parity was still verified) — only a tooling detail; Plan 02 should note this if the plan text implies the script exists.

## Carry-forward for Plan 02

Plan 02 must:

1. **Create `frontend/src/signage/pages/SchedulesPage.tsx`** (list page).
2. **Register `/signage/schedules` route in `frontend/src/App.tsx`** — same `<AdminOnly>` wrapper pattern as `/signage/devices`; must support `initialTab="schedules"` prop convention.
3. **Replace `null` in `SignagePage.tsx`** with `<SchedulesPage />` and add the import at the top of the file.
4. **Create `ScheduleEditDialog.tsx`** — uses `signageApi.createSchedule` / `updateSchedule`, the new types, and HHMM ↔ "HH:MM" adapter (see UI-SPEC §Time input format).
5. **Create `ScheduleDeleteDialog.tsx`** — `toast.success(t("signage.admin.schedules.toast.deleted"))`.
6. **Create `WeekdayCheckboxRow.tsx`** — 7 checkboxes bit0=Mo..bit6=So; use weekday labels `signage.admin.schedules.weekday.{mo,tu,we,th,fr,sa,su}`.
7. **Upgrade PlaylistsPage DELETE handler** to surface `{detail, schedule_ids}` 409 body using the already-added `signage.admin.playlists.error.schedules_active_*` keys.
8. **Flat-dotted i18n convention** — any further Phase 52 keys MUST match the flat-dotted style already used.
9. **Use `apiClient` only** (no raw `fetch()`); `check:signage` guards this.

All types/apis/query-keys/locales Plan 02 needs are now available — it should be pure rendering + dialog wiring with no scavenging.

## Self-Check: PASSED

- frontend/src/signage/lib/signageTypes.ts: FOUND (SignageSchedule exported)
- frontend/src/signage/lib/signageApi.ts: FOUND (4 schedule methods)
- frontend/src/lib/queryKeys.ts: FOUND (schedules/scheduleItem)
- frontend/src/locales/en.json: FOUND (55 new schedule keys)
- frontend/src/locales/de.json: FOUND (55 new schedule keys, du-tone)
- frontend/src/signage/pages/SignagePage.tsx: FOUND (4th segment wired)
- Commit be9d7b2: FOUND
- Commit 070f263: FOUND
- Commit e743118: FOUND
