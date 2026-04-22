---
phase: 58-sensors-layout-parity
plan: 02
subsystem: frontend-sensors
tags: [sensors, subheader, layout-parity, wouter-location]
requirements_completed: [SENSORS-01, SENSORS-02, SENSORS-03]
requires:
  - Plan 58-01 upstream: PollNowButton size prop + SensorTimeWindowProvider hoisted to App.tsx
provides:
  - "SubHeader /sensors slot parity: SensorTimeWindowPicker (left) + PollNowButton size=sm (right)"
  - "SensorsPage body reduced to pure data presentation (cards + chart)"
affects:
  - frontend/src/components/SubHeader.tsx
  - frontend/src/pages/SensorsPage.tsx
tech_stack:
  added: []
  patterns:
    - "Per-route SubHeader slot gating via wouter location === \"/sensors\""
    - "Hoisted React context consumed by both chrome (SubHeader) and body (SensorsPage)"
key_files:
  created: []
  modified:
    - frontend/src/components/SubHeader.tsx
    - frontend/src/pages/SensorsPage.tsx
decisions:
  - "Doc-comment rewritten to avoid literal PollNowButton/SensorTimeWindowPicker/SensorTimeWindowProvider tokens so AC greps stay strict (Rule 3 — plan-spec contradiction)"
  - "pt-4 preserved per UI-SPEC default body rhythm (D-07)"
  - "PollNowButton block placed BEFORE the freshness ternary so right-slot order is PollNow -> freshness (D-04)"
metrics:
  duration: "154s"
  tasks: 2
  files: 2
  completed: "2026-04-22"
---

# Phase 58 Plan 02: Sensors Layout Parity — SubHeader Wiring Summary

One-liner: Wired SensorTimeWindowPicker into the SubHeader left slot and PollNowButton (size=sm) into the right slot — both gated on `location === "/sensors"` — and stripped SensorsPage to just `SensorStatusCards` + `SensorTimeSeriesChart`, completing chrome/body parity with `/sales`.

## What Shipped

### Task 1 — SubHeader /sensors slot wiring (commit `83c904b`)

Two named imports added alongside existing sensor-aware imports:

```tsx
import { SensorTimeWindowPicker } from "@/components/sensors/SensorTimeWindow";
import { PollNowButton } from "@/components/sensors/PollNowButton";
```

Left slot — added inside the first `<div className="flex items-center gap-3">` after the `/sales` DateRangeFilter block:

```tsx
{location === "/sensors" && <SensorTimeWindowPicker />}
```

Right slot — added inside the second `<div className="flex items-center gap-3">` immediately before the freshness-indicator ternary:

```tsx
{location === "/sensors" && <PollNowButton size="sm" />}
```

No wrapping div, no divider. Existing slot content preserved byte-identical: `isDashboard` Toggle, `/sales` DateRangeFilter, AdminOnly Upload link, and the full freshness ternary (SensorFreshnessIndicator / HrFreshnessIndicator / FreshnessIndicator).

Line locations after edit (diff regions):
- Imports: lines 9–10 (new)
- Left-slot insertion: line 125
- Right-slot insertion: line 142 (immediately before ternary at 143)

### Task 2 — SensorsPage strip (commit `285b1ac`)

Before (33 lines): `SensorTimeWindowProvider` wrapper + inline `flex items-center justify-between` control bar holding `<PollNowButton />` + `<SensorTimeWindowPicker />` + the data components.

After (19 lines):

```tsx
import { SensorStatusCards } from "@/components/sensors/SensorStatusCards";
import { SensorTimeSeriesChart } from "@/components/sensors/SensorTimeSeriesChart";

export function SensorsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
      <SensorStatusCards />
      <SensorTimeSeriesChart />
    </div>
  );
}
```

Deletions vs. previous file:
- `import { SensorTimeWindowProvider, SensorTimeWindowPicker } from ...` — removed
- `import { PollNowButton } from ...` — removed
- `<SensorTimeWindowProvider>` wrapper — removed (Pitfall 2: no nested provider; 58-01 hoisted it to App.tsx)
- `<div className="flex items-center justify-between gap-4 flex-wrap">` control bar + its 2 children — removed (D-06, SENSORS-03)

Body layout wrapper preserved: `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`.

## Verification

### Goal-backward (all five truths)

1. Left slot on `/sensors`: `grep -qE 'location === "/sensors" && <SensorTimeWindowPicker />' src/components/SubHeader.tsx` — PASS (line 125).
2. Right slot on `/sensors` with PollNow before freshness: both conditions hold — `PollNowButton size="sm"` at line 142, `SensorFreshnessIndicator` at line 144.
3. Per-route visibility: only `location === "/sensors"` references — no other route renders these components.
4. Page body minimal: only `<SensorStatusCards />` + `<SensorTimeSeriesChart />` inside the layout wrapper. 0 occurrences of SensorTimeWindowProvider/SensorTimeWindowPicker/PollNowButton/`flex items-center justify-between` in SensorsPage.tsx. File is 19 lines.
5. Reactivity: structural — Plan 58-01 hoisted provider above AppShell so both SubHeader's picker (on /sensors) and the page body (cards + chart) resolve to the same `useSensorWindow()` context.

### Automated checks

- `cd frontend && npx tsc --noEmit` — ZERO errors in plan-modified files (SubHeader.tsx, SensorsPage.tsx). Pre-existing Phase-54 TS debt elsewhere unchanged.
- i18n parity: EN 517 keys == DE 517 keys, zero missing, zero extra. (No `check:locale-parity` npm script exists; counted directly via Node walk over both locale JSON trees.) Zero new i18n keys introduced — all keys used by the newly placed components (`sensors.window.*`, `sensors.poll.*`) already existed.
- `npm run build` fails on the same pre-existing Phase-54 TS debt set (HrKpiCharts, SalesTable, PersonioCard, SnmpWalkCard, select.tsx, useSensorDraft, defaults.ts, ScheduleEditDialog, SchedulesPage tests) — documented in deferred-items.md. Zero errors in plan-modified files.

### Manual smoke (to capture at UAT / verifier pass)

Not executed in this session (no dev server running). Structural guarantees:

- Visit `/sensors` → SubHeader shows `[SensorTimeWindowPicker]` on the left (after the /sales placeholder region which is absent on this route) and `[PollNowButton(sm)] [SensorFreshnessIndicator]` on the right. Page body shows only cards + chart.
- Change window in SubHeader → `useSensorWindow.setWindow()` fires; cards + chart consume the same hoisted context and re-render.
- Click PollNow → spinner swap (RefreshCw -> Loader2) per 58-01, success/failure toasts fire.
- Visit `/sales` → no SensorTimeWindowPicker, no PollNowButton in SubHeader (both blocks gated out).
- Visit `/hr` → Sales/HR Toggle + HrFreshnessIndicator preserved, no sensor chrome.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] SensorsPage doc-comment conflict with acceptance criteria**

- **Found during:** Task 2 verification
- **Issue:** The plan's prescribed `<action>` block included a JSDoc comment containing the literal tokens `SensorTimeWindowPicker`, `PollNowButton`, and `SensorTimeWindowProvider`. However, the plan's own acceptance criteria require `! grep -q "SensorTimeWindowProvider" ...` (and the same for `SensorTimeWindowPicker` and `PollNowButton`) to exit 0 — i.e., those tokens must be absent from the file. Direct contradiction between the prescribed code and the AC grep pattern.
- **Fix:** Rewrote the JSDoc comment to describe the same intent without the literal component names:
  - `Time-window picker (SensorTimeWindowPicker)` → `Time-window picker`
  - `poll action (PollNowButton)` → `poll action`
  - `SensorTimeWindowProvider is hoisted to App.tsx` → `The time-window provider is hoisted to App.tsx`
- **Files modified:** `frontend/src/pages/SensorsPage.tsx`
- **Commit:** folded into `285b1ac` (Task 2 commit — deviation discovered pre-commit)

No other deviations. Plan 58-01's already-documented pre-existing TS debt is inherited unchanged.

## Known Stubs

None. Both SubHeader slot consumers (SensorTimeWindowPicker, PollNowButton) are fully wired to real data/actions; the SensorsPage body consumes the same hoisted context as before.

## Commits

| Task | Commit   | Message                                                                |
| ---- | -------- | ---------------------------------------------------------------------- |
| 1    | 83c904b  | feat(58-02): wire /sensors slot blocks into SubHeader                   |
| 2    | 285b1ac  | feat(58-02): strip SensorsPage to cards + chart only                    |

## Self-Check: PASSED

- frontend/src/components/SubHeader.tsx — FOUND (modified)
- frontend/src/pages/SensorsPage.tsx — FOUND (modified, 19 lines)
- commit 83c904b — FOUND
- commit 285b1ac — FOUND
- i18n parity EN=DE=517 — VERIFIED
- tsc clean on plan-modified files — VERIFIED
