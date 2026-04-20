---
phase: 48-pi-provisioning-e2e-docs
plan: 03
type: execute
wave: 2
depends_on: [48-01]
files_modified:
  - frontend/src/player/lib/playerApi.ts
  - frontend/src/player/hooks/useSidecarStatus.ts
  - frontend/src/player/PairingScreen.tsx
  - frontend/scripts/check-player-isolation.mjs
  - .planning/phases/47-player-bundle/47-VERIFICATION.md
autonomous: true
requirements: [SGN-OPS-03]
must_haves:
  truths:
    - "Carry-forward D-8 closed: `playerFetch` in frontend/src/player/lib/playerApi.ts passes `cache: 'no-store'` to fetch() — browser HTTP cache can no longer serve stale playlist data"
    - "After admin claim succeeds in PairingScreen.tsx, the player POSTs the new device JWT to `http://localhost:8080/token` (fire-and-forget; 200ms timeout so the pairing UX is unblocked if no sidecar exists)"
    - "useSidecarStatus.ts re-posts the stored localStorage token to POST /token whenever sidecar transitions unknown→offline (sidecar restart case, RESEARCH §1 Unknown 2 tail)"
    - "check-player-isolation.mjs allowlist includes the new POST /token callsite; CI guard still exits 0"
    - "47-VERIFICATION.md updated: D-7 marked RESOLVED (by Phase 48-01 sidecar, which replaces SW-scoped runtime caching for /playlist + media); D-8 marked RESOLVED (by this plan)"
  artifacts:
    - path: frontend/src/player/lib/playerApi.ts
      provides: "D-8 fix: cache: 'no-store' + helper postSidecarToken()"
    - path: frontend/src/player/hooks/useSidecarStatus.ts
      provides: "Token re-post on sidecar-restart transition"
    - path: frontend/src/player/PairingScreen.tsx
      provides: "One-shot POST /token on successful claim"
    - path: .planning/phases/47-player-bundle/47-VERIFICATION.md
      provides: "D-7 + D-8 closeout notes tied to Phase 48 plans"
  key_links:
    - from: frontend/src/player/PairingScreen.tsx
      to: http://localhost:8080/token
      via: "fetch POST (exempt callsite allowlisted by isolation guard)"
      pattern: "localhost:8080/token"
    - from: frontend/src/player/hooks/useSidecarStatus.ts
      to: http://localhost:8080/token
      via: "fetch POST on unknown→offline transition when localStorage has device_token"
      pattern: "localhost:8080/token"
---

<objective>
Close the three outstanding Phase 47 carry-forwards at the player side and wire the player to the new sidecar's `POST /token` endpoint (Plan 48-01 contract).

Three changes:
1. **D-8 fix** (one-line): `cache: "no-store"` in `playerFetch` so the browser HTTP cache cannot serve stale playlist data over the sidecar's own freshness logic.
2. **Sidecar token handoff**: after a successful pairing claim the player POSTs the new JWT to `http://localhost:8080/token` so the sidecar can make authenticated upstream requests.
3. **Sidecar restart re-post**: when the sidecar restarts, `useSidecarStatus` detects the unknown→offline transition and re-posts the cached localStorage token so the sidecar recovers without re-pairing.
4. **47-VERIFICATION.md update**: mark D-7 (SW scope) and D-8 (fetch cache) both RESOLVED with pointers to Phase 48 plans.

Purpose: Plan 48-01 ships the sidecar's `POST /token` route; Plan 48-02 drops the systemd unit ordering. This plan is the frontend half that connects the player bundle to the sidecar so all five RESEARCH §2 sidecar routes are exercised end-to-end.
Output: 3 frontend files modified, 1 CI guard allowlist extended, 1 VERIFICATION.md update closing Phase 47 carry-forwards.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
@.planning/phases/47-player-bundle/47-VERIFICATION.md
@.planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
@frontend/src/player/lib/playerApi.ts
@frontend/src/player/hooks/useSidecarStatus.ts
@frontend/src/player/PairingScreen.tsx
@frontend/scripts/check-player-isolation.mjs
</context>

<interfaces>
<!-- Sidecar route contract from Plan 48-01 (Wave 1) -->
POST http://localhost:8080/token
  Content-Type: application/json
  Body: {"token": "<device_jwt>"}
  Response 200: {"accepted": true}
  Response 4xx/5xx: ignored (fire-and-forget; sidecar falls back to cached token or offline)

<!-- Existing frozen contracts (do not break) -->
From useSidecarStatus.ts:
  status: 'unknown' | 'online' | 'offline'
  'unknown' → sidecar not present (dev/no Pi); chip hidden
  Transitions dispatched via 'signage:sidecar-status' window event

From playerApi.ts:
  playerFetch<T>(url, opts): Promise<T>
  Opts include { token, on401, headers }
  This file is the ONE permitted raw fetch callsite in frontend/src/player/**
  Isolation guard exempts: playerApi.ts, useSidecarStatus.ts, PairingScreen.tsx
</interfaces>

<pitfalls_inherited>
- **Pitfall 14 (RESEARCH §11):** The D-8 fix is `cache: "no-store"` on line 32 of playerApi.ts. One line, no other changes needed.
- **Open Question 2 (RESEARCH §12):** The CI guard `check-player-isolation.mjs` already exempts useSidecarStatus.ts and PairingScreen.tsx. Adding a new `fetch()` call to `http://localhost:8080/token` within those files is already covered — do NOT broaden the allowlist unnecessarily. Verify by running the guard after edits.
- **Sidecar cold-start race:** On first pair, the sidecar has no token. POST /token is the bridge. If the sidecar is not yet up (systemd startup race), the POST will fail — that is OK, the 30s polling re-probe in useSidecarStatus will trigger the re-post path once the sidecar comes online.
</pitfalls_inherited>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: D-8 fix + postSidecarToken helper in playerApi.ts</name>
  <files>frontend/src/player/lib/playerApi.ts</files>
  <read_first>
    - frontend/src/player/lib/playerApi.ts (current state)
    - .planning/phases/47-player-bundle/47-UAT-RESULTS.md (D-8 discovery context)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §1 Unknown 2 "Exact handoff spec"
  </read_first>
  <behavior>
    - playerFetch sends `cache: "no-store"` in RequestInit so the browser does not serve stale cached responses even when the sidecar/backend respond with fresh data (D-8)
    - New helper `postSidecarToken(token: string): Promise<boolean>` — POSTs `{token}` to `http://localhost:8080/token`, 200ms timeout, returns true on 2xx, false on any error. Never throws.
  </behavior>
  <action>
    Modify `frontend/src/player/lib/playerApi.ts`:

    1. In the existing `playerFetch` function, change the `fetch(url, { ...rest, headers: {...} })` call to include `cache: "no-store"`:
       ```ts
       const r = await fetch(url, {
         ...rest,
         cache: "no-store",  // Phase 47 D-8 closeout — prevent browser HTTP cache from serving stale responses
         headers: { Accept: "application/json", ...headers, Authorization: `Bearer ${token}` },
       });
       ```

    2. Append a new exported helper:
       ```ts
       // Phase 48: push the device JWT to the Pi sidecar so it can make authenticated
       // upstream requests and own the 60s heartbeat. Fire-and-forget: if the sidecar
       // is not running, the 200ms timeout fails fast and the UX is unaffected.
       const SIDECAR_TOKEN_URL = "http://localhost:8080/token";
       export async function postSidecarToken(token: string): Promise<boolean> {
         try {
           const r = await fetch(SIDECAR_TOKEN_URL, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ token }),
             signal: AbortSignal.timeout(200),
           });
           return r.ok;
         } catch {
           return false;
         }
       }
       ```

    No other changes to this file. Keep the existing exempt-file comment banner at the top.
  </action>
  <verify>
    <automated>grep -q 'cache: "no-store"' frontend/src/player/lib/playerApi.ts && grep -q 'postSidecarToken' frontend/src/player/lib/playerApi.ts && grep -q "localhost:8080/token" frontend/src/player/lib/playerApi.ts && cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | (! grep -E "player/lib/playerApi\\.ts.*error")</automated>
  </verify>
  <done>
    playerApi.ts contains the `cache: "no-store"` option and the exported `postSidecarToken` helper. TypeScript compiles without new errors in this file.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire postSidecarToken into PairingScreen.tsx (post-claim) and useSidecarStatus.ts (restart recovery)</name>
  <files>frontend/src/player/PairingScreen.tsx, frontend/src/player/hooks/useSidecarStatus.ts</files>
  <read_first>
    - frontend/src/player/PairingScreen.tsx (find the claim-success branch; Phase 47 D-2/D-4 fixed localStorage-first and navigate-base-relative)
    - frontend/src/player/hooks/useSidecarStatus.ts (current hybrid detector)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §1 Unknown 2 "Token re-post on sidecar restart"
  </read_first>
  <action>
    **Edit `PairingScreen.tsx`:** after the existing code path that persists the newly-minted token to localStorage on successful claim (find the `claimed`/`device_token` branch), call `postSidecarToken(token)` before navigating to the playback route. Import from `./lib/playerApi`. Do NOT await — but DO fire and move on (use `void postSidecarToken(token)` so lint/TS doesn't complain about a floating promise).

    **Edit `useSidecarStatus.ts`:** enhance the hook so that when a probe transitions the status from `'unknown'` to `'offline'` AND localStorage has `signage_device_token`, the hook re-posts the token to the sidecar. Specifically:

    1. Import `postSidecarToken` from `../lib/playerApi`.
    2. Inside `runProbe`, after `setStatus(s)`, if the NEW status is `'offline'` AND the previous status was `'unknown'` or `'online'` (i.e., we just learned the sidecar exists but is offline, consistent with a restart where it has no token yet), AND `localStorage.getItem('signage_device_token')` returns a truthy value, call `void postSidecarToken(token)`.
    3. Keep the cancelled-guard in place.

    Constraint: the new fetch call is inside `useSidecarStatus.ts` which is ALREADY in the isolation guard's exempt list — no CI guard edit needed for this hook. The `PairingScreen.tsx` exempt entry likewise already covers the new call.

    Run the isolation guard to confirm:
    ```
    cd frontend && node scripts/check-player-isolation.mjs
    ```
  </action>
  <verify>
    <automated>grep -q 'postSidecarToken' frontend/src/player/PairingScreen.tsx && grep -q 'postSidecarToken' frontend/src/player/hooks/useSidecarStatus.ts && cd frontend && node scripts/check-player-isolation.mjs</automated>
  </verify>
  <done>
    PairingScreen.tsx calls postSidecarToken on successful claim. useSidecarStatus.ts re-posts the stored token on sidecar-restart transition. isolation guard exits 0 with zero violations.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Append D-7 + D-8 closeout notes to 47-VERIFICATION.md</name>
  <files>.planning/phases/47-player-bundle/47-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-VERIFICATION.md (existing amendments table + hand-off section)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md "Carry-forward from Phase 47"
  </read_first>
  <action>
    Append a new section to `.planning/phases/47-player-bundle/47-VERIFICATION.md` immediately before the "Hand-off to Phase 48" section (or after, if the existing file has a trailing section). Title it `## Phase 47 Carry-forward Closeouts (updated by Phase 48)`.

    Content (markdown table + dated entries):

    ```markdown
    ## Phase 47 Carry-forward Closeouts (updated by Phase 48)

    **Date:** 2026-04-20

    | Defect | Status | Closed by | Notes |
    |--------|--------|-----------|-------|
    | D-7 (SW scope blocks `/api/*` runtime caching) | RESOLVED | Phase 48 Plan 48-01 | The Pi sidecar replaces the service worker's runtime-cache path entirely. `/api/signage/player/playlist` now flows through `http://localhost:8080/api/signage/player/playlist` when the sidecar is online; `window.signageSidecarReady` + `/health` probe controls the switch-over. SW stays precache-only for app shell at `/player/` scope. No SW re-scoping to `/` needed. |
    | D-8 (`playerFetch` HTTP cache staleness) | RESOLVED | Phase 48 Plan 48-03 Task 1 | `cache: "no-store"` added to `playerFetch`'s fetch() options in `frontend/src/player/lib/playerApi.ts`. Browser HTTP cache can no longer shadow fresh sidecar/backend responses. |
    | G2 (bundle gz 204 505 / 200 000) | OPEN (decision gated) | Orchestrator checkpoint in Plan 48-05 | Recommendation: raise cap to 210_000 per RESEARCH §10 / 47-VERIFICATION §Bundle Size. Plan 48-05 includes a human-decision checkpoint. |
    ```

    Do NOT modify the existing amendments table or hand-off section. This is an additive append.
  </action>
  <verify>
    <automated>grep -q "Phase 47 Carry-forward Closeouts" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "D-7 (SW scope" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "D-8" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "RESOLVED" .planning/phases/47-player-bundle/47-VERIFICATION.md</automated>
  </verify>
  <done>
    47-VERIFICATION.md has a new section closing D-7 + D-8 with explicit pointers to Plans 48-01 and 48-03. G2 remains flagged as pending orchestrator decision in Plan 48-05.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npx vite build --mode player` still succeeds (budget verification is Plan 48-05's concern but should not regress).
- `cd frontend && node scripts/check-player-isolation.mjs` exits 0.
- `cd frontend && node scripts/check-player-bundle-size.mjs` exits 0 (adds ~50 bytes for postSidecarToken; still under any reasonable cap).
- 47-VERIFICATION.md contains the new closeouts section.
</verification>

<success_criteria>
- D-8 fix in place (one-line cache: no-store).
- Token handoff wired on both the one-shot claim path and the sidecar-restart recovery path.
- CI isolation + bundle-size guards still pass.
- 47-VERIFICATION.md reflects Phase 47 closeout status for D-7 and D-8.
</success_criteria>

<output>
After completion, create `.planning/phases/48-pi-provisioning-e2e-docs/48-03-SUMMARY.md` recording:
- 3 frontend file diffs (line counts)
- check-player-isolation + check-player-bundle-size results before/after
- 47-VERIFICATION.md append confirmed
- Carry-forward defect state: D-7 RESOLVED, D-8 RESOLVED, G2 still OPEN (Plan 48-05)
</output>

<files_to_read>
- .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
- .planning/phases/47-player-bundle/47-VERIFICATION.md
- .planning/phases/47-player-bundle/47-UAT-RESULTS.md
- .planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
- frontend/src/player/lib/playerApi.ts
- frontend/src/player/hooks/useSidecarStatus.ts
- frontend/src/player/PairingScreen.tsx
- frontend/scripts/check-player-isolation.mjs
- frontend/scripts/check-player-bundle-size.mjs
</files_to_read>
