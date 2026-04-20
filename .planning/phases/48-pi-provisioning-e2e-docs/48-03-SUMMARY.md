---
phase: 48-pi-provisioning-e2e-docs
plan: "03"
subsystem: player-frontend
tags: [player, sidecar, d8-fix, token-handoff, phase47-closeout]
dependency_graph:
  requires: [48-01]
  provides: [sidecar-token-handoff, d8-cache-fix, phase47-d7-d8-closeout]
  affects: [frontend/src/player/lib/playerApi.ts, frontend/src/player/PairingScreen.tsx, frontend/src/player/hooks/useSidecarStatus.ts]
tech_stack:
  added: []
  patterns:
    - "AbortSignal.timeout(200) for fire-and-forget fetch with hard deadline"
    - "useRef for previous-status tracking in React hook without triggering re-renders"
key_files:
  created: []
  modified:
    - frontend/src/player/lib/playerApi.ts
    - frontend/src/player/PairingScreen.tsx
    - frontend/src/player/hooks/useSidecarStatus.ts
    - .planning/phases/47-player-bundle/47-VERIFICATION.md
decisions:
  - "postSidecarToken is fire-and-forget (void) in both call sites — sidecar absence must not delay pairing UX"
  - "Re-post on unknown/online→offline covers both cold-start race and sidecar restart without requiring a separate recovery hook"
  - "prevStatusRef (useRef) chosen over useState to track previous status — avoids extra re-render and is read-only in effect callbacks"
metrics:
  duration: "~7 minutes"
  completed: "2026-04-20T09:46:05Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 48 Plan 03: D-8 fix + sidecar integration + D-7 closeout Summary

**One-liner:** cache: "no-store" added to playerFetch + postSidecarToken helper wired into PairingScreen and useSidecarStatus for Phase 47 D-7/D-8 closeout and Pi sidecar token handoff.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | D-8 fix + postSidecarToken helper in playerApi.ts | 5123062 | frontend/src/player/lib/playerApi.ts (+19 lines) |
| 2 | Wire postSidecarToken into PairingScreen + useSidecarStatus | cd96dcb | frontend/src/player/PairingScreen.tsx (+9), frontend/src/player/hooks/useSidecarStatus.ts (+18) |
| 3 | Append D-7 + D-8 closeout notes to 47-VERIFICATION.md | 85ebf8a | .planning/phases/47-player-bundle/47-VERIFICATION.md (+10) |

## Changes Summary

### frontend/src/player/lib/playerApi.ts (+19 lines)

1. `cache: "no-store"` added to the `playerFetch()` fetch() call — Phase 47 D-8 closeout. Browser HTTP cache can no longer serve stale playlist data even when sidecar/backend respond with fresh data.
2. New exported helper `postSidecarToken(token: string): Promise<boolean>` — POSTs `{token}` to `http://localhost:8080/token` with 200ms AbortSignal timeout. Returns `true` on 2xx, `false` on any error. Never throws. Used by both PairingScreen and useSidecarStatus.

### frontend/src/player/PairingScreen.tsx (+9 lines)

- Import `postSidecarToken` from `./lib/playerApi`.
- In the `"claimed"` branch, after persisting to localStorage, call `void postSidecarToken(status.device_token)` before `navigate()`. Fire-and-forget: sidecar absence does not delay pairing UX.

### frontend/src/player/hooks/useSidecarStatus.ts (+18 lines)

- Import `postSidecarToken` from `../lib/playerApi`.
- Import `useRef` (alongside existing `useEffect`, `useState`).
- Add `prevStatusRef = useRef<SidecarStatus>("unknown")` to track previous status across probes.
- In `runProbe`'s `.then()` callback: record previous status, update ref, call `setStatus`, then conditionally re-post stored `localStorage.getItem("signage_device_token")` when the new status is `"offline"` and the previous was `"unknown"` or `"online"` (sidecar-restart recovery case).

### .planning/phases/47-player-bundle/47-VERIFICATION.md (+10 lines)

New section appended: `## Phase 47 Carry-forward Closeouts (updated by Phase 48)`.

| Defect | Status |
|--------|--------|
| D-7 (SW scope blocks /api/* runtime caching) | RESOLVED by Phase 48 Plan 48-01 |
| D-8 (playerFetch HTTP cache staleness) | RESOLVED by Phase 48 Plan 48-03 Task 1 |
| G2 (bundle gz 204 540 / 200 000) | OPEN — decision gated to Plan 48-05 |

## CI Guard Results

### check-player-isolation.mjs
```
check-player-isolation: scanned 16 files, 0 violations
```
Both new `postSidecarToken` call sites are in pre-existing exempt files (`PairingScreen.tsx`, `useSidecarStatus.ts`). No allowlist expansion required.

### check-player-bundle-size.mjs
```
check-player-bundle-size: TOTAL 199.7 KB gz / 195.3 KB limit (102.3%)
check-player-bundle-size: FAIL — 204540 bytes > 200000 byte limit
```
Pre-existing G2 failure (was 204,456 bytes before this plan; now 204,540 — +84 bytes for postSidecarToken). This is not a regression introduced by Plan 48-03. The cap exceedance predates this plan and is tracked as G2 OPEN, decision gated to Plan 48-05.

## Carry-forward Defect State

| Defect | State after 48-03 |
|--------|-------------------|
| D-7 (SW scope) | RESOLVED (Phase 48-01) |
| D-8 (playerFetch cache) | RESOLVED (this plan) |
| G2 (bundle gz cap) | OPEN — Plan 48-05 |

## Deviations from Plan

None — plan executed exactly as written. The isolation guard confirmed no allowlist expansion was needed (pitfall note in plan verified correct: PairingScreen.tsx and useSidecarStatus.ts were already in the exempt set).

## Known Stubs

None. `postSidecarToken` is fully wired; both call sites are live. The sidecar may not be running in dev (the 200ms timeout handles this gracefully).

## Self-Check: PASSED

| Item | Result |
|------|--------|
| frontend/src/player/lib/playerApi.ts | FOUND |
| frontend/src/player/PairingScreen.tsx | FOUND |
| frontend/src/player/hooks/useSidecarStatus.ts | FOUND |
| .planning/phases/47-player-bundle/47-VERIFICATION.md | FOUND |
| Commit 5123062 (Task 1) | FOUND |
| Commit cd96dcb (Task 2) | FOUND |
| Commit 85ebf8a (Task 3) | FOUND |
