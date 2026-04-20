---
phase: 47-player-bundle
plan: 02
subsystem: frontend-player
tags: [pairing, device-token, tanstack-query, wouter, polling]
requires:
  - Phase 47-01 (foundation — @/player/lib/strings, @/player/lib/queryKeys)
  - Phase 42 pairing endpoints (consumed unchanged — /pair/request, /pair/status)
  - wouter (admin-shared vendor chunk from 47-01)
  - @tanstack/react-query (admin-shared vendor chunk from 47-01)
provides:
  - useDeviceToken hook (token resolution + persistence + clearToken)
  - PairingCode presentational component (16rem monospace)
  - PairingScreen (full pairing surface with 3s polling)
affects:
  - Plan 47-04 (App.tsx must register `/player/:token` AND `/player/` routes)
  - Plan 47-05 (check-player-isolation.mjs must exempt PairingScreen.tsx)
tech-stack:
  added: []
  patterns:
    - Wouter useParams + useLocation for URL-as-source-of-truth token resolution
    - Synchronous initial useState reader from URL→localStorage (first-paint correctness)
    - TanStack Query refetchInterval + gcTime=0 for ephemeral poll state
    - Anonymous raw fetch() for unauthenticated signage pre-token endpoints
key-files:
  created:
    - frontend/src/player/hooks/useDeviceToken.ts
    - frontend/src/player/components/PairingCode.tsx
    - frontend/src/player/PairingScreen.tsx
  modified: []
decisions:
  - Raw fetch() inside PairingScreen.tsx (not playerFetch) — pair endpoints are unauthenticated
    per Phase 42 D-15; playerFetch requires a bearer token. Plan 47-05 CI guard must exempt this
    file as the SECOND exempt callsite (alongside frontend/src/player/lib/playerApi.ts).
  - Re-issue 5s before expires_in elapses (not exactly at expires_in) to avoid a brief gap where
    the displayed code is expired but no new one is shown.
  - On `expired` status: drop session state + explicit re-request (belt-and-braces; the mount
    effect's cancelled-flag prevents double-fire).
  - `<output aria-live="polite">` semantic for the code (not `<div>`) per UI-SPEC §Accessibility.
metrics:
  duration: 2m
  completed: 2026-04-20
---

# Phase 47 Plan 02: Pairing Screen and Token Summary

Shipped the pairing surface and the token-resolution hook per CONTEXT D-2/D-3 and
UI-SPEC §Pairing screen. A Pi booting with no token renders the giant XXX-XXX
code, polls `/pair/status` every 3s, and on `claimed` persists the
`device_token` to `localStorage.signage_device_token` before navigating to
`/player/<token>`. `/player/` reload (no token segment) recovers identity from
localStorage via `useDeviceToken`. Three files, ~215 LOC total, zero new deps.

## Files Created

| File | Purpose |
| ---- | ------- |
| `frontend/src/player/hooks/useDeviceToken.ts` | Token resolver: URL → localStorage → null; persists URL token; `clearToken()` wipes + navigates to `/player/` |
| `frontend/src/player/components/PairingCode.tsx` | Pure `<output aria-live>` at `text-[16rem] font-mono font-semibold tracking-[0.05em] leading-none text-neutral-50` |
| `frontend/src/player/PairingScreen.tsx` | Full pairing surface: `/pair/request` on mount + expiry cycle, TanStack Query `/pair/status` @ 3s, claim → persist + navigate |

## Wouter Routes Consumed (Hand-off to Plan 47-04)

Plan 47-04's `App.tsx` MUST register BOTH routes:

```tsx
<Route path="/player/:token" component={PlaybackScreen /* 47-03 */} />
<Route path="/player/" component={PairingScreen} />
```

Without the `/player/` (no-token) route, the `clearToken()` navigation on 401
revoke and the initial boot-with-no-token path both fall through to a 404.
`useDeviceToken` uses `useParams<{ token?: string }>()`, which works with both
routes — the hook is mounted on whichever route wins.

## CI Guard Exemption (Hand-off to Plan 47-05)

`frontend/src/player/PairingScreen.tsx` contains TWO raw `fetch()` callsites:

1. `fetch("/api/signage/pair/request", { method: "POST" })` — anonymous, no auth
2. `fetch("/api/signage/pair/status?pairing_session_id=…")` — anonymous, no auth

These endpoints are unauthenticated per Phase 42 D-15 (pair/request + pair/status
are the only public signage routes, locked by `PUBLIC_SIGNAGE_ROUTES` in Plan
43-05's dep-audit). `playerFetch` requires a bearer token and is therefore the
wrong adapter. Plan 47-05's `check-player-isolation.mjs` MUST exempt this file
as the **second exempt callsite** alongside `frontend/src/player/lib/playerApi.ts`.

Recommended exemption list for the CI script:

```js
const FETCH_EXEMPT_FILES = [
  "frontend/src/player/lib/playerApi.ts",
  "frontend/src/player/PairingScreen.tsx",
];
```

## Requirements Satisfied

- **SGN-PLY-02** (token resolution + bearer attach): `useDeviceToken` reads URL → localStorage → null in priority order, persists URL token to localStorage, exposes `clearToken()`. Bearer attach itself is via `playerFetch` (Plan 47-01 already built); this plan provides the token source.
- **SGN-PLY-03** (pairing screen + 3s polling): `PairingScreen` renders the XXX-XXX code at 16rem, polls `/pair/status` every 3000ms, handles `claimed` / `expired` / `claimed_consumed` / `pending`, re-issues on expiry.

## Must-Haves (All Satisfied)

- ✓ Pi with no token in URL or localStorage renders the pairing screen (initial `useState` reader → null → 47-04 routes to PairingScreen)
- ✓ Pairing screen calls POST `/api/signage/pair/request` on mount and renders the returned XXX-XXX code at ≥16rem font-mono
- ✓ Pairing screen polls GET `/api/signage/pair/status?pairing_session_id=…` every 3s (TanStack Query `refetchInterval: 3_000`, `gcTime: 0`, `staleTime: 0`)
- ✓ On `status === 'claimed'`, token is written to `localStorage.signage_device_token` and player navigates to `/player/<token>`
- ✓ On `expired` (or `expires_in` exhaustion with no claim), pairing flow re-issues POST `/pair/request` and updates the displayed code
- ✓ `useDeviceToken` reads URL → localStorage → null in priority order, persists URL token to localStorage, exposes `clearToken()` that wipes localStorage and navigates to `/player/`

## Deviations from Plan

None — plan executed exactly as written. No auto-fix or architectural deviations
needed; the plan code blocks were production-ready and the project's
`erasableSyntaxOnly` tsconfig quirk (flagged in 47-01 Summary) didn't affect this
plan's code (no TS parameter-properties used).

## Known Stubs

None. All three components are fully wired:

- `useDeviceToken` has complete URL/localStorage/clear/navigate logic.
- `PairingCode` renders the exact UI-SPEC class string.
- `PairingScreen` is feature-complete — claim handoff navigates into `/player/<token>`, which Plan 47-04's routing picks up and Plan 47-03's PlaybackScreen consumes.

The pairing surface is deliberately minimal (no QR, no logo, no language toggle)
per CONTEXT D-3's explicit prohibitions — these are intentional scope decisions,
not stubs.

## Self-Check: PASSED

Files verified present on disk:
- FOUND: frontend/src/player/hooks/useDeviceToken.ts
- FOUND: frontend/src/player/components/PairingCode.tsx
- FOUND: frontend/src/player/PairingScreen.tsx

Commits verified in git log:
- FOUND: 37624c9 (Task 1 — useDeviceToken hook)
- FOUND: ad85a7a (Task 2 — PairingCode component)
- FOUND: fbff7ba (Task 3 — PairingScreen with polling + claim handoff)

Verification automation (from PLAN.md):
- PASS: `text-[16rem] font-mono font-semibold` + `text-neutral-50` + `<output aria-live="polite">` in PairingCode.tsx
- PASS: `refetchInterval: 3_000` + `gcTime: 0` + `/api/signage/pair/request` + `/api/signage/pair/status` + `navigate(\`/player/${status.device_token}\`)` + `gap-16` + `text-6xl font-semibold` in PairingScreen.tsx
- PASS: `"signage_device_token"` + `useParams` + `navigate("/player/")` + `clearToken` in useDeviceToken.ts
- PASS: zero `dark:` variants across all three files

tsc spot-check: no new type errors in player/hooks, player/components, or PairingScreen.tsx.
