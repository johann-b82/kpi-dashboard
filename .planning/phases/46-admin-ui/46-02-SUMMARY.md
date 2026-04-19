---
phase: 46-admin-ui
plan: 02
subsystem: ui
tags: [signage, react, tanstack-query, tagpicker, polling, pptx, dialog, base-ui]

requires:
  - phase: 46-admin-ui
    provides: signageKeys (added in 46-01), signage.admin.* i18n keys (en.json/de.json), signage/ directory tree
provides:
  - Typed API wrapper module (signageApi) consumed by 46-04/05/06
  - ApiErrorWithBody class preserving status+body for 409 playlist_ids extraction (Pitfall 6)
  - TagPicker token-chip autocomplete component (combobox/listbox ARIA, Enter/comma/Backspace/Escape contract)
  - DeviceStatusChip with D-14 thresholds (<2/<5/>5min) via date-fns
  - MediaStatusPill with TanStack refetchInterval polling that stops on terminal states
  - MediaDeleteDialog two-mode (confirm + in_use) playlist-count UX
affects: [46-04 media, 46-05 playlists, 46-06 devices, 46-06 pair]

tech-stack:
  added: []
  patterns:
    - "ApiErrorWithBody subclass to preserve full JSON body on non-ok (variant of shared apiClient)"
    - "TanStack Query refetchInterval as a function returning false on terminal status (Pattern 9)"
    - "Token-chip controlled input over string[] with onMouseDown commit (avoids onBlur race)"

key-files:
  created:
    - frontend/src/signage/lib/signageTypes.ts
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/signage/components/TagPicker.tsx
    - frontend/src/signage/components/DeviceStatusChip.tsx
    - frontend/src/signage/components/MediaStatusPill.tsx
    - frontend/src/signage/components/MediaDeleteDialog.tsx
  modified: []

key-decisions:
  - "ApiErrorWithBody is signage-local — do not modify shared apiClient. Single-purpose variant scoped to the 409 playlist_ids extraction need; matches D-18's single-exception model."
  - "Status colors (green/amber/red) are intentionally light/dark invariant per UI-SPEC color table — meaning > theming, exempt from no-dark: invariant scope."
  - "TagPicker fetches tag list once per session (staleTime: Infinity) and filters client-side per D-15."
  - "MediaDeleteDialog is presentational: caller manages open + mode; 409 → in_use is the caller's job (decoupled from network layer)."
  - "fetch() inside signageApi.ts is the single CI grep guard exemption (lib/), components/player/pages must use apiClient/signageApi only."

patterns-established:
  - "Pattern: Subclass Error to preserve HTTP status + body when shared apiClient discards non-detail fields"
  - "Pattern: refetchInterval as `(query) => terminal ? false : 3000` for self-terminating polling"
  - "Pattern: combobox + listbox role + onMouseDown commit to fire before blur-close"

requirements-completed: [SGN-ADM-08]

duration: 4min
completed: 2026-04-19
---

# Phase 46-admin-ui Plan 02: Shared Primitives Summary

**Five reusable signage admin building blocks (typed API, two status badges, token-chip picker, two-mode delete dialog) + 409-body-preserving error class — ready for consumption by 46-04/05/06 with zero route wiring required.**

## Performance

- **Duration:** ~4 min (parallel wave 1 with 46-01 and 46-03)
- **Started:** 2026-04-19T20:52:42Z
- **Completed:** 2026-04-19T20:56:46Z
- **Tasks:** 3 / 3
- **Files created:** 6

## Accomplishments

- Typed `signageApi` wrapper with `ApiErrorWithBody` class — 409 `playlist_ids` extraction now possible without modifying shared `apiClient`
- Four cross-cutting UI primitives (TagPicker, DeviceStatusChip, MediaStatusPill, MediaDeleteDialog) all import-clean and ready for sub-page consumption
- Zero `dark:` Tailwind variants (token-only) and zero `fetch(` outside `signage/lib/` — both Phase 46 invariants honored from day one

## Task Commits

1. **Task 1: signageTypes.ts + signageApi.ts (typed wrappers + 409 body extraction)** — `909e89f` (feat)
2. **Task 2: TagPicker, DeviceStatusChip, MediaStatusPill** — `e6d97ef` (feat)
3. **Task 3: MediaDeleteDialog with 409 playlist_ids count** — `f70eabd` (feat)

## Files Created

- `frontend/src/signage/lib/signageTypes.ts` — narrow TS mirrors of backend Pydantic schemas (SignageMedia, SignageDevice, SignagePlaylist, SignagePlaylistItem, SignageTag, MediaInUseError)
- `frontend/src/signage/lib/signageApi.ts` — `ApiErrorWithBody` class + `apiClientWithBody<T>` variant + `signageApi` typed GET wrappers (listTags/createTag/listMedia/getMedia/deleteMedia/listPlaylists/getPlaylist/listDevices)
- `frontend/src/signage/components/TagPicker.tsx` — combobox/listbox token-chip input over `string[]` with full keyboard contract
- `frontend/src/signage/components/DeviceStatusChip.tsx` — `last_seen_at` → green/amber/red/grey via `date-fns.differenceInMinutes`
- `frontend/src/signage/components/MediaStatusPill.tsx` — TanStack `useQuery` with `refetchInterval` that returns `false` on terminal status to self-terminate
- `frontend/src/signage/components/MediaDeleteDialog.tsx` — two-mode dialog (`confirm` shows destructive button; `in_use` shows playlist count + close-only)

## Verification Results

- `npm run build` (signage scope): no errors in any file under `src/signage/`. (Pre-existing tsc errors elsewhere in the repo — defaults.ts, useSensorDraft.ts, HrKpiCharts.tsx, SalesTable.tsx — are out of scope per SCOPE BOUNDARY rule and pre-date this plan.)
- `npm run lint` (signage scope): zero errors/warnings in `src/signage/lib/` and `src/signage/components/`.
- `grep -rn "dark:" src/signage/`: no matches (token-only invariant).
- `grep -rn "fetch(" src/signage/components/ src/signage/player/`: no matches (signageApi-only invariant; `fetch(` inside `signage/lib/signageApi.ts` is the documented single exemption).
- All grep-based acceptance criteria for Tasks 1-3 pass (export shapes, ARIA roles, threshold constants, color classes, animate-pulse, playlistCount, etc.).

## Deviations from Plan

### Auto-fixed Issues

None.

### Coordination Notes

- **`signageKeys` already added by 46-01:** the plan's Task 1 contingency ("if parallel-executed and missing, create it here") was unnecessary because 46-01's commit `2cb1767` landed the keys before this plan's executor woke up. Re-used the existing `signageKeys.tags()` and `signageKeys.mediaItem(id)` shapes directly — both match the plan's expected signatures.
- **All `signage.admin.*` i18n keys already present** in `en.json` / `de.json` (added by 46-01 commit `1de780a`). Tasks 2+3 wired keys directly; no locale edits required.

### Out-of-scope discoveries

Pre-existing tsc + ESLint errors in unrelated files (defaults.ts, useSensorDraft.ts, HrKpiCharts.tsx, SalesTable.tsx, signage/player/PptxPlayer.tsx, etc.). These existed in the working tree before this plan's executor started (verified via `git stash && npm run build`) and are out of scope per the SCOPE BOUNDARY rule. Not logged to deferred-items.md because they are unrelated to signage admin primitives — they belong to the player plan (46-03) and pre-existing dashboard code.

## Authentication Gates

None.

## Known Stubs

None — all four components are fully wired to either signageApi or to caller-controlled props.

## Self-Check: PASSED

Verified file existence and commit hashes:

- `frontend/src/signage/lib/signageTypes.ts` — FOUND
- `frontend/src/signage/lib/signageApi.ts` — FOUND
- `frontend/src/signage/components/TagPicker.tsx` — FOUND
- `frontend/src/signage/components/DeviceStatusChip.tsx` — FOUND
- `frontend/src/signage/components/MediaStatusPill.tsx` — FOUND
- `frontend/src/signage/components/MediaDeleteDialog.tsx` — FOUND
- Commit `909e89f` (Task 1) — FOUND
- Commit `e6d97ef` (Task 2) — FOUND
- Commit `f70eabd` (Task 3) — FOUND
