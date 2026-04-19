---
phase: 47-player-bundle
plan: 02
type: execute
wave: 2
depends_on: [47-01]
files_modified:
  - frontend/src/player/hooks/useDeviceToken.ts
  - frontend/src/player/components/PairingCode.tsx
  - frontend/src/player/PairingScreen.tsx
autonomous: true
requirements: [SGN-PLY-02, SGN-PLY-03]
must_haves:
  truths:
    - "Pi with no token in URL or localStorage renders the pairing screen"
    - "Pairing screen calls POST /api/signage/pair/request on mount and renders the returned XXX-XXX code at ≥16rem font-mono"
    - "Pairing screen polls GET /api/signage/pair/status?pairing_session_id=… every 3s"
    - "On status === 'claimed', token is written to localStorage.signage_device_token and player navigates to /player/<token>"
    - "On `expired` (or `expires_in` exhaustion with no claim), pairing flow re-issues POST /pair/request and updates the displayed code"
    - "useDeviceToken reads URL → localStorage → null in priority order, persists URL token to localStorage, exposes clearToken() that wipes localStorage and navigates to /player/"
  artifacts:
    - path: frontend/src/player/hooks/useDeviceToken.ts
      provides: "token resolution + persistence + clearToken (D-2)"
      exports: ["useDeviceToken"]
    - path: frontend/src/player/components/PairingCode.tsx
      provides: "256px monospace XXX-XXX block (UI-SPEC §Typography)"
      exports: ["PairingCode"]
    - path: frontend/src/player/PairingScreen.tsx
      provides: "full-viewport pairing UI with auto-polling"
      exports: ["PairingScreen"]
  key_links:
    - from: frontend/src/player/PairingScreen.tsx
      to: /api/signage/pair/request
      via: "playerFetch (anonymous — no token)"
      pattern: "/api/signage/pair/request"
    - from: frontend/src/player/PairingScreen.tsx
      to: /api/signage/pair/status
      via: "TanStack Query refetchInterval: 3000"
      pattern: "/api/signage/pair/status"
    - from: frontend/src/player/hooks/useDeviceToken.ts
      to: localStorage.signage_device_token
      via: "getItem/setItem/removeItem"
      pattern: "signage_device_token"
---

<objective>
Build the pairing surface (one of three player surfaces per UI-SPEC) and the token-resolution hook. After this plan, a Pi booting with no token shows the giant XXX-XXX code and auto-claims into a token; the token persists to localStorage so a `/player/` reload (no path segment) recovers identity.

Purpose: Closes SGN-PLY-02 (token resolution + bearer attach) and SGN-PLY-03 (pairing screen + 3s polling). Independent of the playback path (Plan 47-03) because the two surfaces never co-exist on screen.
Output: 3 files. ~200 LOC total. No PWA, no SSE, no playback wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/47-player-bundle/47-CONTEXT.md
@.planning/phases/47-player-bundle/47-RESEARCH.md
@.planning/phases/47-player-bundle/47-UI-SPEC.md
@.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md
@frontend/src/player/lib/strings.ts
@frontend/src/player/lib/playerApi.ts
@frontend/src/player/lib/queryKeys.ts
@frontend/src/player/lib/locale.ts

<interfaces>
<!-- Phase 42 pairing API contracts (consumed unchanged) -->

// POST /api/signage/pair/request   (no auth, rate-limited 5/min/IP per Phase 42 D-09)
// Response 200:
interface PairRequestResponse {
  pairing_code: string;          // "XXX-XXX" (with dash) per Phase 42 D-05
  pairing_session_id: string;    // UUID
  expires_in: number;            // seconds, default 600
}

// GET /api/signage/pair/status?pairing_session_id=<uuid>  (no auth)
// Response 200 (one of):
type PairStatusResponse =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "claimed"; device_token: string }       // single-fire per Phase 42 D-08
  | { status: "claimed_consumed" };                   // returned on subsequent polls after the single 'claimed'

<!-- From Plan 47-01 (already in tree) -->
import { playerFetch, PlayerApiError } from "@/player/lib/playerApi";
import { playerKeys } from "@/player/lib/queryKeys";
import { t } from "@/player/lib/strings";

<!-- Wouter (already in admin bundle, shared via vendor chunk in Plan 47-01 vite.config) -->
import { useParams, useLocation } from "wouter";
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build useDeviceToken hook (D-2 priority resolver + persistence)</name>
  <files>frontend/src/player/hooks/useDeviceToken.ts</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-2 — URL canonical, localStorage fallback, 401 wipe)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§"Architecture Patterns" Pat1 — full reference hook)
  </read_first>
  <action>
    Create `frontend/src/player/hooks/useDeviceToken.ts`:

    ```ts
    // Phase 47 D-2: token resolution + persistence + clear-on-401.
    // Priority: URL path token → localStorage → null.
    // Side effect: when URL provides the token, persist to localStorage so a /player/ (no token) reload recovers identity.

    import { useEffect, useState, useCallback } from "react";
    import { useParams, useLocation } from "wouter";

    const STORAGE_KEY = "signage_device_token";

    export interface UseDeviceTokenResult {
      token: string | null;
      clearToken: () => void;
    }

    export function useDeviceToken(): UseDeviceTokenResult {
      const params = useParams<{ token?: string }>();
      const [, navigate] = useLocation();

      // Initial read is synchronous so first paint has the right surface.
      const [token, setToken] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        const fromUrl = params?.token ?? null;
        if (fromUrl) return fromUrl;
        try {
          return window.localStorage.getItem(STORAGE_KEY);
        } catch {
          return null;
        }
      });

      // Persist URL token to localStorage on mount AND when params.token changes.
      useEffect(() => {
        if (typeof window === "undefined") return;
        if (!params?.token) return;
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored !== params.token) {
            window.localStorage.setItem(STORAGE_KEY, params.token);
          }
        } catch {
          // localStorage may be disabled (private browsing); fail soft — URL still works for this session.
        }
        setToken(params.token);
      }, [params?.token]);

      const clearToken = useCallback(() => {
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* fail soft */
          }
        }
        setToken(null);
        navigate("/player/");
      }, [navigate]);

      return { token, clearToken };
    }
    ```

    Notes the executor must respect:
    - `STORAGE_KEY` MUST be exactly `"signage_device_token"` (matches CONTEXT D-2 and the offline scenario tests in Phase 48).
    - `clearToken()` is the 401-revoked path — it MUST navigate to `/player/` (no token segment) so the wouter route falls through to PairingScreen.
    - The `try/catch` around localStorage covers private-browsing dev scenarios.
    - No imports from `@/signage/pages/`, `@/components/admin/`, or any other forbidden path (CI guard 47-05 enforces).
  </action>
  <verify>
    <automated>test -f frontend/src/player/hooks/useDeviceToken.ts && grep -q '"signage_device_token"' frontend/src/player/hooks/useDeviceToken.ts && grep -q "useParams" frontend/src/player/hooks/useDeviceToken.ts && grep -q "navigate(\"/player/\")" frontend/src/player/hooks/useDeviceToken.ts && grep -q "clearToken" frontend/src/player/hooks/useDeviceToken.ts</automated>
  </verify>
  <done>
    `useDeviceToken.ts` exists; exports `useDeviceToken` returning `{ token, clearToken }`. Initial value reads URL → localStorage. URL token writes to localStorage. `clearToken()` wipes storage and navigates to `/player/`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build PairingCode presentational component</name>
  <files>frontend/src/player/components/PairingCode.tsx</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Typography — exactly `text-[16rem] font-mono font-semibold tracking-[0.05em] leading-none`; §Color — `text-neutral-50`)
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-3 — code is the only thing on screen besides headline + hint)
  </read_first>
  <action>
    Create `frontend/src/player/components/PairingCode.tsx`:

    ```tsx
    // Phase 47 UI-SPEC §Typography: pairing code at 256px (16rem) monospace, semibold, tracking 0.05em.
    // Distance-readability target: ≥ 5m on a 1080p panel (CONTEXT D-3 + UI-SPEC §Typography rationale).
    // Pure presentational — props in, JSX out. No effects, no state.

    import { t } from "@/player/lib/strings";

    export interface PairingCodeProps {
      /** "XXX-XXX" formatted code, or null while the request is in flight. */
      code: string | null;
    }

    export function PairingCode({ code }: PairingCodeProps) {
      // ARIA per UI-SPEC §Accessibility: code is rendered inside <output aria-live="polite">.
      return (
        <output
          aria-live="polite"
          aria-label="Pairing code"
          className="text-[16rem] font-mono font-semibold tracking-[0.05em] leading-none text-neutral-50"
        >
          {code ?? t("pair.code_placeholder")}
        </output>
      );
    }
    ```

    Critical (do not deviate):
    - Tailwind classes are EXACTLY `text-[16rem] font-mono font-semibold tracking-[0.05em] leading-none text-neutral-50` per UI-SPEC §Typography.
    - The element is `<output>` (not `<div>` or `<span>`) per UI-SPEC §Accessibility.
    - Placeholder when `code === null` is the em-dash from `t("pair.code_placeholder")` (UI-SPEC §Pairing Loading state).
    - NO `dark:` variants. NO `useState`, NO `useEffect`. Pure component.
  </action>
  <verify>
    <automated>test -f frontend/src/player/components/PairingCode.tsx && grep -q 'text-\[16rem\]' frontend/src/player/components/PairingCode.tsx && grep -q "font-mono" frontend/src/player/components/PairingCode.tsx && grep -q "text-neutral-50" frontend/src/player/components/PairingCode.tsx && grep -q "<output" frontend/src/player/components/PairingCode.tsx && grep -q 'aria-live="polite"' frontend/src/player/components/PairingCode.tsx && ! grep -q "dark:" frontend/src/player/components/PairingCode.tsx</automated>
  </verify>
  <done>
    Component renders `<output>` with the exact UI-SPEC class string and aria-live attribute. Em-dash placeholder when `code === null`. No state, no effects, no `dark:` variants.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build PairingScreen with TanStack Query polling + claim handoff</name>
  <files>frontend/src/player/PairingScreen.tsx</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-3 — minimal screen, 3s poll, no QR/logo/toggle, navigator.language)
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Pairing screen — full layout spec, §"Data Fetching Contract" — refetchInterval: 3000, gcTime: 0)
    - .planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md (D-08 — claimed_consumed semantics, D-12 — TTL 600s)
  </read_first>
  <action>
    Create `frontend/src/player/PairingScreen.tsx`:

    ```tsx
    // Phase 47 SGN-PLY-03: full pairing surface.
    // Layout per UI-SPEC §Pairing screen: full viewport bg-neutral-950, centered column, gap-16.
    // Polling per UI-SPEC §"Data Fetching Contract": TanStack Query, refetchInterval 3000, gcTime 0.

    import { useEffect, useState } from "react";
    import { useLocation } from "wouter";
    import { useQuery } from "@tanstack/react-query";
    import { playerFetch } from "@/player/lib/playerApi";
    import { playerKeys } from "@/player/lib/queryKeys";
    import { t } from "@/player/lib/strings";
    import { PairingCode } from "@/player/components/PairingCode";

    interface PairRequestResponse {
      pairing_code: string;
      pairing_session_id: string;
      expires_in: number;
    }

    type PairStatusResponse =
      | { status: "pending" }
      | { status: "expired" }
      | { status: "claimed"; device_token: string }
      | { status: "claimed_consumed" };

    const STORAGE_KEY = "signage_device_token";

    /** Anonymous request — no Authorization header (Phase 42 D-15 — /pair/request is unauthenticated). */
    async function requestPairingSession(): Promise<PairRequestResponse> {
      const r = await fetch("/api/signage/pair/request", { method: "POST" });
      if (!r.ok) throw new Error(`pair/request failed ${r.status}`);
      return (await r.json()) as PairRequestResponse;
    }

    async function fetchPairStatus(sessionId: string): Promise<PairStatusResponse> {
      const r = await fetch(
        `/api/signage/pair/status?pairing_session_id=${encodeURIComponent(sessionId)}`,
      );
      if (!r.ok) throw new Error(`pair/status failed ${r.status}`);
      return (await r.json()) as PairStatusResponse;
    }

    export function PairingScreen() {
      const [, navigate] = useLocation();
      const [session, setSession] = useState<PairRequestResponse | null>(null);
      const [requestError, setRequestError] = useState(false);

      // Open a session on mount; re-issue on `expired` or after `expires_in` countdown elapses.
      useEffect(() => {
        let cancelled = false;
        let expiryTimer: number | undefined;

        const open = () => {
          requestPairingSession()
            .then((s) => {
              if (cancelled) return;
              setRequestError(false);
              setSession(s);
              // Re-issue 5s before expiry to avoid a brief gap.
              const ms = Math.max(5_000, (s.expires_in - 5) * 1000);
              expiryTimer = window.setTimeout(() => {
                if (!cancelled) open();
              }, ms);
            })
            .catch(() => {
              if (cancelled) return;
              setRequestError(true);
              // Retry every 5s silently per UI-SPEC §"Error state".
              expiryTimer = window.setTimeout(() => {
                if (!cancelled) open();
              }, 5_000);
            });
        };

        open();
        return () => {
          cancelled = true;
          if (expiryTimer) window.clearTimeout(expiryTimer);
        };
      }, []);

      // Poll status every 3s while a session is open.
      const { data: status } = useQuery<PairStatusResponse>({
        queryKey: playerKeys.pairStatus(session?.pairing_session_id ?? null),
        queryFn: () => fetchPairStatus(session!.pairing_session_id),
        refetchInterval: 3_000,
        enabled: !!session,
        gcTime: 0,
        staleTime: 0,
        retry: false,
      });

      // On `claimed`: persist token, navigate to playback. `claimed_consumed` is a no-op on this screen
      // (we already navigated away on the prior poll). `expired` triggers a fresh request via the effect above.
      useEffect(() => {
        if (!status) return;
        if (status.status === "claimed") {
          try {
            window.localStorage.setItem(STORAGE_KEY, status.device_token);
          } catch {
            /* fail soft — URL token still works for this session */
          }
          navigate(`/player/${status.device_token}`);
        } else if (status.status === "expired") {
          // Force re-issue: drop the session so the request effect's open() can re-fire.
          setSession(null);
          // The mount effect won't re-run, so do an explicit re-request:
          requestPairingSession()
            .then((s) => {
              setRequestError(false);
              setSession(s);
            })
            .catch(() => setRequestError(true));
        }
      }, [status, navigate]);

      const code = session?.pairing_code ?? null;
      // requestError state is silently retried per UI-SPEC; the surface still shows the placeholder em-dash.
      // Variable referenced to satisfy linter:
      void requestError;

      return (
        <main className="w-screen h-screen bg-neutral-950 flex flex-col items-center justify-center gap-16">
          <h1 className="text-6xl font-semibold leading-tight text-neutral-50">
            {t("pair.headline")}
          </h1>
          <PairingCode code={code} />
          <p className="text-2xl font-normal text-neutral-400 max-w-3xl text-center px-4">
            {t("pair.hint")}
          </p>
        </main>
      );
    }
    ```

    Critical (do not deviate):
    - Layout MUST be `flex flex-col items-center justify-center gap-16` (UI-SPEC §Pairing screen exact spec).
    - Headline classes EXACTLY `text-6xl font-semibold leading-tight text-neutral-50`.
    - Hint classes EXACTLY `text-2xl font-normal text-neutral-400`.
    - The two raw `fetch()` calls inside this file (for `/pair/request` and `/pair/status`) are pre-token endpoints — `playerFetch` requires a token and these are unauthenticated. Plan 47-05's CI guard MUST exempt this file OR these calls. Document in the SUMMARY that `PairingScreen.tsx` is the second exempt callsite (alongside `playerApi.ts`).
    - `staleTime: 0` and `gcTime: 0` per UI-SPEC §"Data Fetching Contract" — pair-status is ephemeral.
    - Re-request on `expired` per CONTEXT D-3 ("On `expires_in` countdown reaching zero with no claim: re-issue").
    - On `claimed`: writes token, navigates to `/player/<token>` — the wouter route in Plan 47-04's App.tsx will pick it up.
    - NO QR code, NO logo, NO language toggle (CONTEXT D-3 explicit prohibitions; UI-SPEC §Pairing screen confirms).
    - `<main>` for the root container — semantic landmark for the single-screen surface.
  </action>
  <verify>
    <automated>test -f frontend/src/player/PairingScreen.tsx && grep -q "refetchInterval: 3_000\|refetchInterval: 3000" frontend/src/player/PairingScreen.tsx && grep -q "gcTime: 0" frontend/src/player/PairingScreen.tsx && grep -q "/api/signage/pair/request" frontend/src/player/PairingScreen.tsx && grep -q "/api/signage/pair/status" frontend/src/player/PairingScreen.tsx && grep -q '"signage_device_token"' frontend/src/player/PairingScreen.tsx && grep -q 'navigate(`/player/${status.device_token}`)' frontend/src/player/PairingScreen.tsx && grep -q "PairingCode" frontend/src/player/PairingScreen.tsx && grep -q "gap-16" frontend/src/player/PairingScreen.tsx && grep -q "text-6xl font-semibold" frontend/src/player/PairingScreen.tsx && ! grep -q "dark:" frontend/src/player/PairingScreen.tsx</automated>
  </verify>
  <done>
    PairingScreen mounts → POSTs `/pair/request` → renders code via `<PairingCode>` → polls `/pair/status` every 3000ms via TanStack Query → on `{status: "claimed", device_token}` writes localStorage and navigates to `/player/<token>` → on `expired` re-issues a request → on network error retries every 5s silently. Layout matches UI-SPEC exactly. No QR, no logo, no toggle. No `dark:` variants.
  </done>
</task>

</tasks>

<verification>
- All 3 files exist.
- Manual smoke (deferred to Plan 47-05's full UAT script): in dev, hitting `/player/` with no localStorage token shows the giant code; admin claiming the code transitions the screen to `/player/<token>`.
</verification>

<success_criteria>
- SGN-PLY-02: token resolution + persistence + clear-on-401 wired (`useDeviceToken`).
- SGN-PLY-03: pairing screen renders, requests session, polls status every 3s, claims into localStorage and navigates.
- The pairing surface visually matches UI-SPEC §Pairing screen byte-for-byte on Tailwind classes.
</success_criteria>

<output>
After completion, create `.planning/phases/47-player-bundle/47-02-SUMMARY.md` with:
- Files created
- Confirmation that the two raw `fetch()` callsites in `PairingScreen.tsx` need to be exempted by Plan 47-05's `check-player-isolation.mjs` script (alongside `playerApi.ts`)
- Wouter routes consumed (`useParams`, `useLocation`) — confirmation that the App.tsx in Plan 47-04 must register `/player/:token` AND `/player/` routes
</output>
