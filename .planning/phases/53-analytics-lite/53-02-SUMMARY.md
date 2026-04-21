---
phase: 53-analytics-lite
plan: 02-frontend-devices-analytics-columns
subsystem: signage-admin-ui
tags: [frontend, react, tanstack-query, i18n, signage, analytics, phase-53]
requires:
  - phase-53 plan-01 (GET /api/signage/analytics/devices + DeviceAnalyticsRead)
provides:
  - SignageDeviceAnalytics TS interface
  - signageApi.listDeviceAnalytics()
  - signageKeys.deviceAnalytics() query-key factory entry
  - UptimeBadge component (+ uptimeTier pure selector)
  - DevicesPage Uptime 24h / Missed 24h columns with 30s polling + focus refetch
  - 7 signage.admin.device.analytics.* i18n keys (EN + DE du-tone)
  - Admin guide §Analytics (EN) / §Analyse (DE)
affects:
  - frontend/src/signage/pages/DevicesPage.tsx (2 new columns + second useQuery)
tech-stack:
  added: []
  patterns:
    - DeviceStatusChip className-override pattern for semantic-colour badges
    - native title= tooltip fallback (no Radix Tooltip dependency)
    - O(1) render-side lookup via Object.fromEntries inside queryFn
    - explicit refetchOnWindowFocus: true on the analytics useQuery (D-11 defence-in-depth)
key-files:
  created:
    - frontend/src/signage/components/UptimeBadge.tsx
    - frontend/src/signage/components/UptimeBadge.test.tsx
    - frontend/src/signage/pages/DevicesPage.test.tsx
    - .planning/phases/53-analytics-lite/53-02-SUMMARY.md
  modified:
    - frontend/src/signage/lib/signageTypes.ts
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/signage/pages/DevicesPage.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/docs/en/admin-guide/digital-signage.md
    - frontend/src/docs/de/admin-guide/digital-signage.md
key-decisions:
  - uptimeTier() exported as a pure function for direct unit testing; tier thresholds match D-13 exactly (≥95/≥80/<80)
  - Single-row tier inheritance - the missed-variant badge reuses the uptime tier so both badges in a row are always the same colour
  - Uptime/Missed columns inserted IMMEDIATELY after Status (not between Playlist and Last seen) - preserves D-14 Status→Uptime→Missed ordering while keeping the existing Tags/Playlist columns untouched; Last seen still appears to the right of Missed so "between Status and Last seen" holds
  - Test harness uses the shared i18n instance via I18nextProvider + i18nInitPromise await (matches SchedulesPage.test.tsx convention)
  - refetchOnWindowFocus observer-introspection test via q.observers[*].options rather than q.options (TanStack Query v5 stores per-observer option overrides)
requirements-completed:
  - SGN-ANA-01 (frontend half - full requirement now delivered across 53-01 + 53-02)
duration: ~15m
completed: 2026-04-21
---

# Phase 53 Plan 02: Frontend Devices Analytics Columns Summary

**One-liner:** Shipped the frontend half of SGN-ANA-01 — DevicesPage now renders `Uptime 24h` and `Missed 24h` badge columns immediately after Status, polling `/api/signage/analytics/devices` every 30 s with explicit `refetchOnWindowFocus: true`, backed by an `UptimeBadge` component that reuses the DeviceStatusChip className pattern (bg-green-100/amber-100/red-100/muted, no `dark:` variants, no new cva variants) and exposes 14 + 11 Vitest tests covering tier thresholds at 95/94.9/80/79.9, EN/DE tooltip parity with literal numerator/denominator wording, partial-window tooltip for fresh devices, and the `refetchOnWindowFocus` wiring.

**Duration:** ~15m
**Tasks:** 4/4 complete
**Files changed:** 12 (4 new, 8 modified)

## What Shipped

### Types + API + query key (Task 1, commit `f65f3e0`)
- `SignageDeviceAnalytics` interface in `frontend/src/signage/lib/signageTypes.ts` - 1:1 mirror of backend `DeviceAnalyticsRead` (`device_id: string`, `uptime_24h_pct: number | null`, `missed_windows_24h: number`, `window_minutes: number`).
- `signageApi.listDeviceAnalytics()` in `frontend/src/signage/lib/signageApi.ts` - GETs `/api/signage/analytics/devices` via the shared `apiClient` (no raw `fetch(`).
- `signageKeys.deviceAnalytics()` returning `["signage", "devices", "analytics"] as const` - subtree of `devices` so `invalidateQueries({ queryKey: ["signage", "devices"] })` would catch both if ever needed.

### i18n keys (Task 1, same commit)
All 7 keys in `signage.admin.device.analytics.*` namespace landed flat-dotted (matching the rest of the file; `i18n.ts` sets `keySeparator: false`) in both `en.json` and `de.json`:
- `uptime24h.label` / `missed24h.label` - column headers ("Uptime 24h" / "Betriebszeit 24 h", "Missed 24h" / "Ausfälle 24 h").
- `uptime24h.tooltip` / `.tooltip_partial` - full-24 h and partial-window copy using `{{buckets}} / {{denom}}` placeholders; partial variant adds `{{windowH}}` and the "device is new" / "Gerät ist neu" qualifier.
- `missed24h.tooltip` / `.tooltip_partial` - uses `{{missed}}` + `{{windowH}}` placeholders.
- `badge.noData` - "No heartbeats yet." / "Noch keine Heartbeats." rendered by the neutral tier.

DE copy uses informal "du" where a pronoun appears; no "Sie"/"Ihre"/"Ihr " across any new line. `check-locale-parity.mts` passes (469 keys in both locales).

### UptimeBadge (Task 2, commit `b457bae`)
- `frontend/src/signage/components/UptimeBadge.tsx` (90 lines): pure `uptimeTier(pct)` selector + `<UptimeBadge variant data />` render. Tier → className via 4-entry `CLASS_MAP` (`bg-green-100`, `bg-amber-100`, `bg-red-100`, `bg-muted`). `data === undefined || uptime_24h_pct === null` collapses to the neutral path (label `"—"`, noData tooltip). `variant="missed"` inherits the uptime-variant tier so a row's two badges never disagree in colour. Tooltip lives on a wrapping `<span title={...}>` (no Radix Tooltip component in this repo - see 53-RESEARCH.md §Pattern 8).
- `frontend/src/signage/components/UptimeBadge.test.tsx` (14 tests): pure tier selector at 100/95/94.9/80/79.9/0/null; component render for neutral-on-undefined, neutral-on-null-pct, green-at-95, amber-at-94.9, red-at-79.9, missed-variant-inherits-red, partial-window with windowH=1 for a 30-min device, and EN/DE tooltip copy parity.

### DevicesPage integration (Task 3, commit `e2fe63a`)
- Second `useQuery<Record<string, SignageDeviceAnalytics>>` alongside the existing `listDevices` query. `queryFn` calls `signageApi.listDeviceAnalytics()` then reduces to a `device_id → row` map via `Object.fromEntries` so render-side lookup is O(1). Explicit `refetchInterval: 30_000` and `refetchOnWindowFocus: true` (D-11 defence-in-depth).
- Two new `<TableHead>` cells inserted immediately after the Status header; matching `<UptimeBadge variant="uptime" />` and `<UptimeBadge variant="missed" />` `<TableCell>` cells inserted immediately after the Status chip cell. No changes to any other columns, no changes to the revoke mutation, no changes to the `DeviceEditDialog`. Empty-state branch is untouched.
- `frontend/src/signage/pages/DevicesPage.test.tsx` (11 tests): column headers render, column-ordering check (Status → Uptime → Missed … → Last seen), green-at-95, amber-at-94.9, red-at-79.9, neutral for device missing from analytics response, neutral for `uptime_24h_pct: null` (zero-heartbeat case per Plan 01 SUMMARY interface contract), EN tooltip literal numerator/denominator, DE tooltip switch via `i18n.changeLanguage("de")`, partial-window tooltip with `windowH = Math.ceil(30/60) = 1`, and observer-introspection assertion that the analytics query's option `refetchOnWindowFocus === true`.

### Admin guide (Task 4, commit `f2a4411`)
- `frontend/src/docs/en/admin-guide/digital-signage.md` §Analytics - appended after §Schedules. Covers the 5 D-18 items: badge meaning (Uptime 24h %, Missed 24h), 95/80 colour thresholds (plus neutral "—"), one-minute window definition, partial-window note for fresh devices (denominator = minutes since first heartbeat, up to 1440), 30 s polling + tab-visibility refresh.
- `frontend/src/docs/de/admin-guide/digital-signage.md` §Analyse - structurally parallel (same section order, same bullet counts). Uses informal "du"/"dein" throughout ("damit du vom ersten Tag an ein ehrliches Signal siehst"); no formal pronouns.

## Verification Output

### Typecheck (`npx tsc --noEmit`)
Clean. All new/modified Plan 53-02 files typecheck.

### Signage invariants (`npm run check:signage`)
```
SIGNAGE INVARIANTS OK: 50 files scanned
```
The new `UptimeBadge.tsx`, `UptimeBadge.test.tsx`, and the extended `DevicesPage.test.tsx` are auto-covered by `check-signage-invariants.mjs` ROOTS (no script edit needed). No `dark:` variants and no raw `fetch(` in any new file.

### Locale parity (`node --experimental-strip-types scripts/check-locale-parity.mts`)
```
PARITY OK: 469 keys in both en.json and de.json
```

### Plan 53-02 Vitest suites
```
Test Files  2 passed (2)
     Tests  25 passed (25)
```
- `UptimeBadge.test.tsx`: 14/14
- `DevicesPage.test.tsx`: 11/11

### Full frontend Vitest run
`Tests 94 passed (94)`; one test FILE fails to collect (`tests/e2e/rebuild-persistence.spec.ts` — Playwright-style spec accidentally picked up by Vitest). Pre-existing, unrelated to this plan (reproduces on HEAD before any 53-02 changes).

## Commits

| Task | Hash      | Message                                                                |
|------|-----------|------------------------------------------------------------------------|
| 1    | `f65f3e0` | feat(53-02): add DeviceAnalytics types, API method, query key, i18n keys |
| 2    | `b457bae` | feat(53-02): add UptimeBadge component with threshold tier logic + tests |
| 3    | `e2fe63a` | feat(53-02): DevicesPage uptime/missed columns with 30s polling + focus refetch |
| 4    | `f2a4411` | docs(53-02): admin-guide Analytics / Analyse sections for uptime badges |

## Deviations from Plan

### [Rule 3 - Blocking] Signage invariants script false-positive on `dark:` inside JSDoc
- **Found during:** Task 2 verification run of `npm run check:signage`.
- **Issue:** `check-signage-invariants.mjs` strips trailing `//` comments but not block-comment `/* ... */` bodies. Initial `UptimeBadge.tsx` JSDoc contained the literal substring `` `dark:` classes — hard gate 3 … `` which the regex flagged as a violation.
- **Fix:** Rephrased the JSDoc to say "no dark-mode classes" without the `dark:` literal. Intent preserved, invariant script clean.
- **Files modified:** `frontend/src/signage/components/UptimeBadge.tsx`.
- **Commit:** bundled into `b457bae`.

### [Clarification - not a fix] Column-ordering interpretation vs. existing Tags + Playlist columns
- **Found during:** Task 3 planning of where to insert the new `<TableHead>` cells.
- **Issue:** The plan's D-14 column order is `Name → Status → Uptime → Missed → Last Seen → Actions`, but DevicesPage already has `Name → Status → Tags → Playlist → Last Seen → Actions` (6 cols, two legacy columns Tags/Playlist between Status and Last Seen). Plan action step C says "immediately after Status and immediately before Last seen" — but with Tags/Playlist in between, the only way to satisfy *both* constraints literally is to remove Tags/Playlist, which was explicitly excluded by "NO changes to any other cells/columns".
- **Resolution:** Inserted Uptime + Missed immediately after Status. Final column order is `Name → Status → Uptime 24h → Missed 24h → Tags → Playlist → Last seen → Actions`. This preserves D-14's "Status → Uptime → Missed" ordering (the meaningful part of D-14) and "Last seen appears to the right of Missed" (what "between Status and Last seen" buys you). Documented here because the DevicesPage test's column-ordering assertion was adjusted to check `idxStatus < idxUptime < idxMissed < idxLastSeen` rather than `idxMissed + 1 === idxLastSeen`.
- **Files modified:** none beyond those already in Task 3.

**Total deviations:** 1 Rule-3 auto-fix (regex false-positive in JSDoc) + 1 plan-interpretation note. No functional deviations from the spec.

## Authentication Gates

None. All work was static frontend code + unit tests; no live admin JWT required in tests (API methods are mocked via `vi.mock("@/signage/lib/signageApi")`).

## Open-Question Resolutions (from 53-RESEARCH)

1. **Tooltip fallback.** `frontend/src/components/ui/tooltip.tsx` was confirmed absent. Used native `title={tooltipCopy}` on a wrapping `<span>` per RESEARCH §Pattern 8. Accessibility: title attribute is screen-reader-readable, browser-native hover UX. Zero new deps.
2. **Global QueryClient `refetchOnWindowFocus` override.** Grep of `frontend/src/App.tsx`, `main.tsx`, and `queryClient`-related files showed no `refetchOnWindowFocus: false` override. The explicit `refetchOnWindowFocus: true` on the analytics `useQuery` is defence-in-depth per D-11, robust to any future global-default flip.

## Zero-heartbeat resolution consumption

Plan 01 SUMMARY resolved D-16 as **INCLUDED**: zero-heartbeat devices appear in the endpoint response with `uptime_24h_pct: null, missed_windows_24h: 0, window_minutes: 0`. DevicesPage exercises BOTH fallback paths:
1. **Missing from map** — still handled: if the server races (e.g. device created between the two queries) and the analytics row is not yet in `analyticsByDevice[device.id]`, `UptimeBadge` receives `data={undefined}` and renders the neutral "—" badge.
2. **Null pct** — the explicit `uptime_24h_pct === null` branch inside `UptimeBadge` renders the same neutral "—" badge with the `badge.noData` tooltip.

Both are covered by their own DevicesPage tests (tests 6 and 7 in the Phase 53 describe block).

## Invariants CI Auto-Coverage

Confirmed: `frontend/scripts/check-signage-invariants.mjs` ROOTS include `frontend/src/signage/components/` and `frontend/src/signage/pages/`. Dropping `UptimeBadge.tsx`, `UptimeBadge.test.tsx`, and `DevicesPage.test.tsx` into those directories picked them up automatically - the scan went from 47 → 50 files without any script edit. No ROOTS modification needed.

## Carry-forward

**None.** Phase 53 Analytics-lite is fully delivered across Plans 01 (backend) + 02 (frontend). Next action: `/gsd:verify-work 53` to run the milestone gate, then phase-complete handoff.

## Known Stubs

None. Every rendered cell is wired to real data (`analyticsByDevice[device.id]` or `undefined` → neutral fallback). The neutral "—" is the intentional informational state from the backend, not a placeholder.

## Self-Check: PASSED

**Created files verified on disk:**
- `frontend/src/signage/components/UptimeBadge.tsx` — FOUND
- `frontend/src/signage/components/UptimeBadge.test.tsx` — FOUND
- `frontend/src/signage/pages/DevicesPage.test.tsx` — FOUND
- `.planning/phases/53-analytics-lite/53-02-SUMMARY.md` — (this file)

**Commits verified via `git log --oneline`:**
- `f65f3e0` — FOUND
- `b457bae` — FOUND
- `e2fe63a` — FOUND
- `f2a4411` — FOUND
