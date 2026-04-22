---
phase: 58-sensors-layout-parity
plan: 01
subsystem: frontend-sensors
tags: [sensors, react-context, ui-primitives, lucide-icons]
requirements_completed: [SENSORS-02]
requires:
  - PollNowButton mutation/timeout wiring preserved byte-identical
  - SensorTimeWindowProvider export from components/sensors/SensorTimeWindow.tsx
provides:
  - "PollNowButton size prop + icon swap (RefreshCw idle / Loader2 spinning)"
  - "SensorTimeWindowProvider hoisted above AppShell inside DateRangeProvider"
affects:
  - frontend/src/components/sensors/PollNowButton.tsx
  - frontend/src/App.tsx
tech_stack:
  added: []
  patterns:
    - "lucide-react icon swap via resolved component (Icon = isPending ? Loader2 : RefreshCw)"
    - "Button primitive auto-sizes unclassed SVG via [&_svg:not([class*='size-'])]:size-*"
    - "React context hoist: single Provider above AppShell so chrome + body share state"
key_files:
  created: []
  modified:
    - frontend/src/components/sensors/PollNowButton.tsx
    - frontend/src/App.tsx
decisions:
  - "Icon uses unclassed SVG (only animate-spin allowed) — Button primitive auto-sizes per size prop (Pitfall 4)"
  - "useMutation config preserved byte-identical — mutationFn/onSuccess/onError unchanged"
  - "Provider nested INSIDE DateRangeProvider, not outside — matches SensorsPage legacy ordering"
metrics:
  duration: "95s"
  tasks: 2
  files: 2
  completed: "2026-04-22"
---

# Phase 58 Plan 01: Sensors Layout Parity — Foundations Summary

One-liner: Expanded PollNowButton with size prop + RefreshCw/Loader2 icon swap, and hoisted SensorTimeWindowProvider to App.tsx so SubHeader + SensorsPage can share one window context — foundations Plan 58-02 wires up.

## What Shipped

### Task 1 — PollNowButton size prop + icon swap
- Added `import { Loader2, RefreshCw } from "lucide-react"` to PollNowButton.tsx
- Introduced `interface PollNowButtonProps { size?: "default" | "sm" }` and `{ size = "default" }: PollNowButtonProps = {}` signature
- Forwarded `size={size}` to the `<Button>` primitive
- Runtime icon resolution: `const Icon = mutation.isPending ? Loader2 : RefreshCw`, rendered as `<Icon className={mutation.isPending ? "animate-spin" : undefined} />` before the label
- Preserved `POLL_TIMEOUT_MS`, `TIMEOUT_SENTINEL`, `pollWithTimeout()`, and the full `useMutation({ mutationFn, onSuccess, onError })` block byte-identical
- No explicit `h-4 w-4` / `size-*` classes on the icon — Button auto-sizes unclassed SVGs per the size token (Pitfall 4)

Signature diff:
```diff
-export function PollNowButton() {
+interface PollNowButtonProps {
+  size?: "default" | "sm";
+}
+
+export function PollNowButton({ size = "default" }: PollNowButtonProps = {}) {
```

Existing sole call site `SensorsPage.tsx` renders `<PollNowButton />` — default `size="default"` keeps that path behaviourally unchanged.

### Task 2 — SensorTimeWindowProvider hoisted to App.tsx
- Added `import { SensorTimeWindowProvider } from "./components/sensors/SensorTimeWindow";` grouped with the other sensor imports (directly after `SensorDraftProvider`)
- Wrapped `<AppShell />` with `<SensorTimeWindowProvider>` inside `<DateRangeProvider>`:

```tsx
<DateRangeProvider>
  <SensorTimeWindowProvider>
    <AppShell />
  </SensorTimeWindowProvider>
</DateRangeProvider>
```

- No other provider moved, reordered, or removed
- `SensorTimeWindow.tsx` untouched — its exported `SensorTimeWindowProvider` was already fit-for-purpose (D-01, RESEARCH Pattern 2)

### Key link for Plan 58-02
The hoisted provider means Plan 58-02's SubHeader can call `useSensorWindow()` on `/sensors` routes and read the same context that `SensorsPage` writes to — no prop drilling, no second provider, no state duplication.

## Verification

- `cd frontend && npx tsc --noEmit` — ZERO errors in plan-modified files (PollNowButton.tsx, App.tsx)
- `grep -c "RefreshCw" PollNowButton.tsx` → 2 (import + Icon resolution)
- `grep -c "Loader2" PollNowButton.tsx` → 2
- `grep -c "SensorTimeWindowProvider" App.tsx` → 3 (import + open tag + close tag)
- `grep -q "POLL_TIMEOUT_MS = 30_000" PollNowButton.tsx` → PASS (timeout preserved)
- `grep -q "pollWithTimeout" PollNowButton.tsx` → PASS (helper preserved)
- Icon has no literal `h-4 w-4` or `size-4`/`size-3.5` class — only `animate-spin`

## Deviations from Plan

None on the plan surface. One out-of-scope observation logged.

### Out-of-Scope (logged to deferred-items.md)
- `cd frontend && npm run build` surfaces pre-existing TS errors (SalesTable, PersonioCard, SnmpWalkCard, select.tsx, useSensorDraft, defaults.ts, ScheduleEditDialog, SchedulesPage tests) — all in files NOT modified by this plan. Tracked in STATE.md as "Phase-54 TS debt". Per deviation Rule scope boundary, not a Plan 58-01 regression.

## Commits

| Task | Commit  | Message                                                |
| ---- | ------- | ------------------------------------------------------ |
| 1    | f324713 | feat(58-01): thread size prop + icon swap into PollNowButton |
| 2    | 73f1468 | feat(58-01): hoist SensorTimeWindowProvider to App.tsx |

## Preview Verification

Skipped at this plan boundary — Plan 58-01 ships foundations with no new visible surface: `SensorsPage.tsx` still renders `<PollNowButton />` with the default `size="default"` (same h-8 as before, now with a leading RefreshCw icon) and the new provider has no consumer yet (SubHeader integration lands in Plan 58-02). Manual walk-through of the SubHeader `size="sm"` rendering + shared window context is in Plan 58-02's explicit `verification` block per the plan output spec.

## Known Stubs

None. Both changes are wired up with real functionality — the SubHeader consumer is a Plan 58-02 scope item, not a stub.

## Self-Check: PASSED

- frontend/src/components/sensors/PollNowButton.tsx — FOUND (modified)
- frontend/src/App.tsx — FOUND (modified)
- commit f324713 — FOUND
- commit 73f1468 — FOUND
