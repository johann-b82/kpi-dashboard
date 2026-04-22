# Phase 58: Sensors Layout Parity - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The `/sensors` page chrome matches every other dashboard route: header-level controls (time-window picker + "Jetzt messen" action) live in the shared `SubHeader`, and the page body is reserved for KPI cards, charts, and tables. Existing per-route SubHeader conditional pattern (D-07 from Phase 56) is extended; no new SubHeader abstraction is introduced.

Out of scope: redesigning the SubHeader layout itself, adding new sensor controls, URL-syncing the time window, mobile-specific layout work, anything inside `/settings/sensors`.

</domain>

<decisions>
## Implementation Decisions

### Time-window state placement
- **D-01:** `SensorTimeWindowProvider` is hoisted to wrap `App.tsx` (always mounted). Both `SubHeader` and `SensorsPage` consume the same `useSensorWindow()` context. Cost is a 5-element string state always live; benefit is no remounting on `/sensors` entry and a single source of truth.
- **D-02:** Time window stays state-only — no URL sync, no `?window=` query param. Matches `DateRangeFilter` on `/sales`. Defaults reset on reload, as today.

### SubHeader slot layout (on `/sensors` only)
- **D-03:** Time-window `SegmentedControl` (`SensorTimeWindowPicker`) sits in the **left slot**, mirroring `DateRangeFilter` on `/sales`. Establishes the convention: "time/range scope" lives left, "actions + freshness" live right.
- **D-04:** Right-slot order on `/sensors`: **`PollNowButton` → `SensorFreshnessIndicator`** (action then status). Existing `<SensorFreshnessIndicator />` stays where it is in the right slot; the button is inserted to its left.

### Visibility & pattern reuse
- **D-05:** New SubHeader controls render only when `location === "/sensors"`, reusing the per-route conditional pattern from D-07 (Phase 56). Picker + PollNow are completely hidden on every other route.
- **D-06:** `/sensors` page body after the move contains only `SensorStatusCards` + `SensorTimeSeriesChart`. The current `<div className="flex items-center justify-between">` wrapping `PollNowButton` + `SensorTimeWindowPicker` is deleted entirely. No spacer.

### PollNow appearance
- **D-07:** `PollNowButton` renders as **icon + label, size="sm"** in the SubHeader using the Phase 55 `Button` primitive at `h-8`. Icon is a refresh/play lucide glyph; label remains the existing `t("sensors.pollNow")` key ("Jetzt messen"/"Measure now").
- **D-08:** Loading UX during the 30s blocking poll: button becomes disabled, icon swaps to `Loader2` with `animate-spin`. No inline status text — keeps right slot from fighting with the freshness indicator. Matches existing `PollNowButton` behavior; only the icon swap is new.

### Claude's Discretion
- Exact lucide icon for "Jetzt messen" (planner picks: `RefreshCw`, `Play`, `Activity`, `Zap` are all reasonable — match what the rest of the app already uses for "kick a job").
- File restructure shape: keep `SensorTimeWindowPicker` colocated in `components/sensors/SensorTimeWindow.tsx`, or extract a thinner `SubHeaderSensorPicker` wrapper — planner decides based on prop surface.
- Whether to delete the now-empty `pt-4` from `SensorsPage` or keep it for visual rhythm with other pages.
- Exact arrangement of left-slot picker if any vertical divider or `gap-3` tweak is needed for visual parity with `/sales`.

### Folded Todos
None — no pending todos matched Phase 58 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 58: Sensors Layout Parity" (lines 277-287) — phase goal + 3 success criteria
- `.planning/REQUIREMENTS.md` SENSORS-01..03 (lines 44-46) — acceptance criteria

### Prior-phase contracts (Phase 54-57)
- `.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md` D-07/D-08 — per-route SubHeader conditional slot pattern (Sales/HR Toggle on `/sales|/hr` only)
- `.planning/phases/55-consolidated-form-controls/55-PLAN.md` (and primitive at `frontend/src/components/ui/button.tsx`) — `Button` primitive contract (size="sm" → h-8, ghost variant)
- `.planning/phases/54-toggle-primitive-migrations/` — `SegmentedControl`/`Toggle` patterns; `SensorTimeWindowPicker` uses the same SegmentedControl

### Code touch-points (existing, must read before editing)
- `frontend/src/components/SubHeader.tsx` — current per-route conditional structure; already renders `<SensorFreshnessIndicator />` for `/sensors`
- `frontend/src/pages/SensorsPage.tsx` — current body layout that gets stripped to KPI/chart only
- `frontend/src/components/sensors/SensorTimeWindow.tsx` — `SensorTimeWindowProvider`, `SensorTimeWindowPicker`, `useSensorWindow`, `SENSOR_WINDOWS` constant
- `frontend/src/components/sensors/PollNowButton.tsx` — uses Phase 55 `Button` primitive already; 30s blocking call + loading state to preserve
- `frontend/src/App.tsx` — provider hoist target for D-01

### i18n
- `frontend/src/locales/{en,de}.json` — existing `sensors.pollNow`, `sensors.subheader.lastMeasured`, `sensors.subheader.never` keys are already present and reused; no new keys expected unless planner introduces an aria-label for the picker placement.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` (`ui/button.tsx`): Phase 55 primitive — already used by `PollNowButton`. Size="sm" gives h-8 chip suitable for SubHeader.
- `SegmentedControl` (`ui/segmented-control.tsx`): backs `SensorTimeWindowPicker` — works at SubHeader scale unchanged.
- `SubHeader` per-route conditional pattern: extend the existing `if (isDashboard)` / `if (location === "/sensors")` chain with a new `/sensors`-scoped block. No new abstraction.
- `SensorFreshnessIndicator`: already in SubHeader right slot for `/sensors` — survives unchanged.

### Established Patterns
- Two-row chrome: `NavBar` h-16 + `SubHeader` h-12 (fixed). Total chrome height stays identical — no body offset changes.
- Per-route conditional rendering inside `SubHeader.tsx` via `useLocation()` (D-07 from Phase 56).
- DE/EN i18n parity is enforced repo-wide (Phase 57 introduced `check-locale-parity.mts`); any new keys land in both locales in the same commit.
- TanStack Query is the SubHeader's data layer (already used for `sensorKeys.status()` in `SensorFreshnessIndicator`); `PollNowButton` uses `useMutation` + `queryClient.invalidateQueries(sensorKeys.status())` — keep that wiring intact when relocating.

### Integration Points
- `App.tsx`: wrap children with `<SensorTimeWindowProvider>` at the top (D-01). Single edit.
- `SubHeader.tsx`: extend left-slot block with `<SensorTimeWindowPicker />` for `/sensors`; insert `<PollNowButton size="sm" />` into the right slot before the existing `<SensorFreshnessIndicator />`. Reuse `useSensorWindow()` from the hoisted context.
- `SensorsPage.tsx`: delete the `<div className="flex items-center justify-between">` wrapper and the `<PollNowButton />` + `<SensorTimeWindowPicker />` calls; keep `SensorStatusCards` + `SensorTimeSeriesChart`. Provider import is removed (now lives in App.tsx).
- `PollNowButton.tsx`: add an `icon` slot or accept `size`/`variant` props if not already there — planner verifies the Button primitive's surface and either threads props or wraps a thin SubHeader-specific variant.

</code_context>

<specifics>
## Specific Ideas

- "/sales is the reference" — left = scope (range filter), right = action + freshness. /sensors should look the same shape.
- PollNow icon-then-label is the right call because the action kicks an SNMP poll — explicit text reduces accidental clicks vs an icon-only ghost.
- Loader2 spin + disabled state during the 30s block is already in the wild (consistent with how migrate-style buttons elsewhere behave).

</specifics>

<deferred>
## Deferred Ideas

- URL sync for the sensor time window (`?window=24h`) — would enable shareable `/sensors` deep links. Not requested; revisit only if shareable links become a need.
- Future `/settings/sensors` SubHeader treatment — not in this phase. If admin sub-page eventually wants its own sensor controls, gate logic can be widened later.
- Mobile (<sm) layout for the SubHeader on `/sensors` — current SubHeader is desktop-first; no responsive work in this phase. Surface as Phase 59 (A11y & Parity Sweep) input if regressions are spotted.
- "Polling…" inline status text alongside the spinner — rejected for this phase to keep the right slot uncluttered; can be added later if user feedback demands more visible progress feedback.

</deferred>

---

*Phase: 58-sensors-layout-parity*
*Context gathered: 2026-04-22*
