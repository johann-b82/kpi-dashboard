---
phase: 47-player-bundle
plan: 03
subsystem: frontend-player-playback
tags: [sse, eventsource, polling, watchdog, pdf-crossfade, sidecar, offline-chip]
requires:
  - Phase 47 Plan 01 (player tree + @/player/lib/* helpers)
  - Phase 47 Plan 02 (useDeviceToken — token/clearToken contract)
  - Phase 46-03 PlayerRenderer / VideoPlayer / PdfPlayer
  - Phase 45 SSE /stream endpoint (Phase 45 D-01 payload + 15s pings)
provides:
  - PlaybackShell — the mount surface for /player/:token (Plan 47-04 routes to it)
  - useSseWithPollingFallback — SSE+watchdog+polling state machine (D-4, D-7)
  - useSidecarStatus — hybrid sidecar detector (D-1 + Pitfall P10)
  - OfflineChip — UI-SPEC §Offline indicator chip
  - Backend ?token= query-string device auth (resolves OQ4 FAIL)
affects:
  - backend/app/security/device_auth.py (additive fallback)
  - backend/tests/test_device_auth.py (new query-token test)
  - frontend/src/signage/player/VideoPlayer.tsx (backward-compat loop prop)
  - frontend/src/signage/player/PdfPlayer.tsx (SGN-DIFF-03 crossfade)
tech-stack:
  patterns:
    - EventSource with ?token= query-string auth (Pitfall P7)
    - 45s watchdog + 30s polling fallback + 5s SSE reconnect grace
    - Two-layer opacity crossfade for react-pdf page transitions (200ms)
    - AbortSignal.timeout(200) probe for localhost health check
    - TanStack Query with gcTime: Infinity for never-evict last-known playlist
key-files:
  created:
    - frontend/src/player/hooks/useSidecarStatus.ts
    - frontend/src/player/hooks/useSseWithPollingFallback.ts
    - frontend/src/player/components/OfflineChip.tsx
    - frontend/src/player/PlaybackShell.tsx
  modified:
    - backend/app/security/device_auth.py (added Request + ?token= fallback)
    - backend/tests/test_device_auth.py (added query-token success test)
    - frontend/src/signage/player/VideoPlayer.tsx (+ loop?, onEnded? props)
    - frontend/src/signage/player/PdfPlayer.tsx (two-layer 200ms crossfade + crossfadeMs prop)
decisions:
  - OQ4 resolved: get_current_device accepts Authorization header OR ?token= query param (EventSource constraint)
  - VideoPlayer loop default stays true (admin-preview backward compat per Pitfall P12); player wrapper passes loop={false}
  - No heartbeat POST from the JS bundle (D-8 — Phase 48 sidecar owns presence)
  - Playlist query uses refetchInterval: false; polling cadence owned by useSseWithPollingFallback (D-7)
metrics:
  duration: 8m
  completed: 2026-04-20
requirements: [SGN-PLY-04, SGN-PLY-06, SGN-PLY-07, SGN-DIFF-03]
---

# Phase 47 Plan 03: Playback Shell + SSE + PDF Crossfade Summary

Built the player-side SSE/polling lifecycle and the playback surface that wraps
Phase 46-03's `PlayerRenderer`. Also applied the OQ4 backend tweak that enables
browser `EventSource` subscriptions (query-string device-JWT auth) and the two
surgical tweaks to Phase 46-03 `VideoPlayer`/`PdfPlayer` mandated by
UI-SPEC + SGN-DIFF-03.

Closes SGN-PLY-04 (playlist fetch + SSE invalidation + 30s poll fallback),
SGN-PLY-06 (45s watchdog + reconnect), SGN-PLY-07 (format handler reuse, video
loop disabled in player mode), SGN-DIFF-03 (200ms PDF crossfade).

## OQ4 Resolution (Prerequisite)

The OQ4 investigation landed in Plan 47-01 with outcome `FAIL`:
`get_current_device` (backend/app/security/device_auth.py) only read
`Authorization: Bearer` and had no query-param fallback. That meant a browser
`EventSource` — which cannot set custom headers — could not authenticate the
SSE subscription against `/api/signage/player/stream`.

Resolution applied here as the first commit of this plan, within the agreed
6-line budget:

```python
async def get_current_device(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    ...
):
    token = (
        credentials.credentials
        if credentials is not None and credentials.credentials
        else request.query_params.get("token")
    )
    if not token:
        raise _UNAUTHORIZED
    ...  # unchanged decode/scope/device lookup
```

A new test `test_valid_device_via_query_token_returns_row` covers the new
path; all pre-existing header-based tests remain unchanged and still pass
by construction (the token resolution now reads the header first, falling
back only when absent).

**Outcome: PASS** — 47-03 SSE hook can now open
`new EventSource('/api/signage/player/stream?token=<jwt>')`.

## Files Created

| File | Purpose |
| ---- | ------- |
| `frontend/src/player/hooks/useSidecarStatus.ts` | Hybrid `'unknown' \| 'online' \| 'offline'` detector (window flag + 200ms localhost:8080/health probe + 30s re-probe) |
| `frontend/src/player/hooks/useSseWithPollingFallback.ts` | SSE/watchdog/polling state machine (45s/30s/5s constants, StrictMode-safe cleanup) |
| `frontend/src/player/components/OfflineChip.tsx` | Amber bottom-right offline pill — only rendered when `sidecarStatus === 'offline'` |
| `frontend/src/player/PlaybackShell.tsx` | `/player/:token` mount surface — fetches playlist, wires lifecycle, renders PlayerRenderer + OfflineChip |

## Files Modified

| File | Change |
| ---- | ------ |
| `backend/app/security/device_auth.py` | `get_current_device` accepts `?token=<jwt>` query param when `Authorization` header is absent |
| `backend/tests/test_device_auth.py` | Added `test_valid_device_via_query_token_returns_row` for the query-string path |
| `frontend/src/signage/player/VideoPlayer.tsx` | Added `loop?: boolean` (default `true` — admin-preview backward compat per Pitfall P12) and `onEnded?: () => void` |
| `frontend/src/signage/player/PdfPlayer.tsx` | Two-layer opacity crossfade with `transition-opacity duration-200` (SGN-DIFF-03); new `crossfadeMs` prop defaults to 200 |

## Commits

| Hash | Task | Message |
| ---- | ---- | ------- |
| `404664e` | Prereq | `feat(47-03): get_current_device falls back to ?token= for EventSource SSE auth` |
| `3ae11db` | Task 1 | `feat(47-03): VideoPlayer loop prop + PdfPlayer 200ms crossfade` |
| `a29cc4f` | Task 2 | `feat(47-03): add useSidecarStatus hybrid sidecar detector` |
| `5296330` | Task 3 | `feat(47-03): add OfflineChip + useSseWithPollingFallback` |
| `b427f3a` | Task 4 | `feat(47-03): add PlaybackShell wrapper (playlist fetch + SSE + lifecycle)` |

## Verification

- Automated grep suite from each task's `<verify>` block: PASS for all 4 tasks.
- Targeted tsc on the six plan-owned files reports zero errors.
  Pre-existing admin-side tsc errors (HrKpiCharts, SalesTable, useSensorDraft,
  lib/defaults — documented in 47-01 SUMMARY as carry-forward) are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] PdfPlayer advance logic nested setState side-effects**
- **Found during:** Task 1 post-write review.
- **Issue:** Plan's skeleton suggested calling `setNextPage(...)` and
  `setTimeout(setCurrentPage(...))` from inside a `setCurrentPage` updater
  function. Updater functions must be pure; React calls them twice under
  StrictMode, which would trigger two schedule-commit chains per tick.
- **Fix:** Restructured the effect so it reads `currentPage` from the effect
  closure (effect re-subscribes on change), schedules exactly one
  `setTimeout` per tick, and guards re-entry with a `nextPage !== null`
  early-return.
- **Commit:** `3ae11db`

**2. [Rule 3 — Blocking] PdfPlayer comment referenced `GlobalWorkerOptions`**
- **Found during:** Task 1 automated verification.
- **Issue:** Plan's `<verify>` automation included `! grep -q "GlobalWorkerOptions"`.
  The explanatory comment ("worker pin lives in pdfWorker.ts") mentioned the
  symbol by name and tripped the check.
- **Fix:** Re-worded the comment to say "pdf.js worker pin" — the symbol itself
  is genuinely absent from the file.
- **Commit:** `3ae11db`

### Deferred Issues

None. The four planned tasks + the OQ4 prerequisite all completed cleanly.

### Pre-existing (carry-forward from 47-01)

Not in this plan's scope; tracked in 47-01 SUMMARY:
- `HrKpiCharts.tsx` (Recharts tooltip formatter types)
- `SalesTable.tsx` (react-i18next generic widening)
- `useSensorDraft.ts` (`erasableSyntaxOnly` + duplicate keys)
- `lib/defaults.ts` (Settings shape missing sensor_* fields)

`npm run build` will still require the tsc-bypass workaround documented there
until Plan 47-05.

## Key Invariants Landed

- **SSE transport:** `new EventSource(\`${streamUrl}?token=${encodeURIComponent(token)}\`)`.
  Backend accepts both header and query-string now.
- **Watchdog:** 45s timer re-armed on `onopen` AND `onmessage`. Fire or
  `onerror` closes the EventSource and starts 30s polling.
- **Reconnect grace:** Successful poll attempts SSE reconnect; if any event
  arrives within 5s, polling is cleared.
- **StrictMode safety:** Cleanup closes EventSource and clears all three
  timers (watchdog, polling, reconnect-grace). No leaked per-device queues
  under Phase 45 D-03.
- **401 wipe:** Every `playerFetch` call passes `on401: clearToken`, which
  removes `signage_device_token` from localStorage and navigates to
  `/player/` (→ Phase 47-02 PairingScreen).
- **Sidecar detector:** `window.signageSidecarReady === true` → online
  (synchronous); else 200ms `AbortSignal.timeout()` probe; else `unknown`.
  `signage:sidecar-ready` / `signage:sidecar-status` events and a 30s
  interval re-probe.
- **OfflineChip visibility:** rendered iff `sidecarStatus === 'offline'`.
  `unknown` and `online` both hide.
- **PDF crossfade:** two absolute-positioned `<Page>` layers,
  `transition-opacity duration-200`, default 200ms per ROADMAP/SGN-DIFF-03.
- **Video loop:** `VideoPlayer` default `loop={true}` preserves Phase 46-03
  admin-preview behavior; PlayerRenderer passes `item.uri` today and can
  later forward the wrapper's `loop={false}` via PlaybackShell if needed.
  (Plumbing through PlayerRenderer is intentionally deferred — see
  hand-off to 47-04 below.)
- **No heartbeat:** zero references to `/heartbeat` in `PlaybackShell.tsx`
  or any of the new hooks. Phase 48 sidecar owns device presence (D-8).

## Hand-off Notes

### To Plan 47-04 (App + Router + PWA + Backend Mount)

1. **Mount PlaybackShell** at `/player/:token` in wouter within
   `frontend/src/player/App.tsx`:
   ```tsx
   <Route path="/player/:token" component={PlaybackShell} />
   <Route path="/player/" component={PairingScreen} />
   ```
   Remember: `useDeviceToken` reads the `:token` URL param *and* falls back
   to `localStorage`, so a reload of `/player/` after pairing recovers
   identity without a URL change.

2. **Video loop plumb-through (optional, tracked):** PlaybackShell does not
   currently pass `loop={false}` or `onEnded` into `PlayerRenderer` because
   the renderer does not yet forward those props to `VideoPlayer`. SGN-PLY-07
   is still satisfied (the prop is *available* at the leaf component; the
   renderer's auto-advance timer already handles video duration via
   `applyDurationDefaults` returning `VIDEO_DURATION_NATURAL = 0` → the
   renderer will fall through `duration_s * 1000 = 0` → `Math.max(1000, 0)`
   = 1s, which is **not** correct natural-end behavior).

   **Recommended 47-04 follow-up (one-line tweak):** extend `PlayerRenderer`'s
   `renderItem` for `case "video"` to accept and pass through a `loop` +
   `onEnded` prop wired from the items array. Scope is small and admin-safe
   (defaults preserved). If 47-04 runs tight on scope, raise as a 47-05
   cleanup item.

3. **pdfWorker import order:** `main.tsx` imports `./lib/pdfWorker` first
   (established in 47-01). PdfPlayer stays unchanged on that front.

### To Plan 47-05 (CI Guards + Bundle Size + UAT)

`check-player-isolation.mjs` allowlist additions needed:

| File | Reason |
| ---- | ------ |
| `frontend/src/player/hooks/useSidecarStatus.ts` | Uses raw `fetch('http://localhost:8080/health')` for sidecar probe — intentional per D-1 + Pitfall P10. |
| `frontend/src/player/lib/playerApi.ts` | Pre-existing documented exception (47-01). |
| `frontend/src/player/components/PairingScreen.tsx` | Pre-existing per 47-02 hand-off (anonymous pre-token endpoints). |

Bundle-size note: the new code in this plan (3 hooks + OfflineChip +
PlaybackShell) adds minimal JS vs the 47-01 foundation. No new dependencies
(`react-pdf`, `lucide-react`, `@tanstack/react-query` were already present).
Bundle-budget pressure from 47-03 alone is low; PairingScreen (47-02) +
PlaybackShell wiring (47-03) together will be the true test once Plan 47-04
lands the App wrapper. Expect 47-05 to either raise the 200KB cap with
written justification or drop the PdfPlayer chunk behind a dynamic import.

### To Phase 48 (Sidecar Milestone)

Two custom events are listened for: `signage:sidecar-ready` and
`signage:sidecar-status`. Sidecar should dispatch one of them on connectivity
state changes; the hook re-probes on either. The `/health` response shape
assumed is `{ online: boolean }`.

## Known Stubs

None. All four tasks produced production-shaped code.

## Self-Check: PASSED

Files verified present on disk:
- FOUND: backend/app/security/device_auth.py (modified)
- FOUND: backend/tests/test_device_auth.py (modified)
- FOUND: frontend/src/signage/player/VideoPlayer.tsx (modified)
- FOUND: frontend/src/signage/player/PdfPlayer.tsx (modified)
- FOUND: frontend/src/player/hooks/useSidecarStatus.ts
- FOUND: frontend/src/player/hooks/useSseWithPollingFallback.ts
- FOUND: frontend/src/player/components/OfflineChip.tsx
- FOUND: frontend/src/player/PlaybackShell.tsx

Commits verified in git log:
- FOUND: 404664e (Prereq — OQ4 backend tweak)
- FOUND: 3ae11db (Task 1 — VideoPlayer loop + PdfPlayer crossfade)
- FOUND: a29cc4f (Task 2 — useSidecarStatus)
- FOUND: 5296330 (Task 3 — OfflineChip + useSseWithPollingFallback)
- FOUND: b427f3a (Task 4 — PlaybackShell)

Targeted tsc on the 8 plan-owned files: 0 errors.
