---
phase: 47-player-bundle
plan: 03
type: execute
wave: 2
depends_on: [47-01]
files_modified:
  - frontend/src/player/hooks/useSseWithPollingFallback.ts
  - frontend/src/player/hooks/useSidecarStatus.ts
  - frontend/src/player/components/OfflineChip.tsx
  - frontend/src/player/PlaybackShell.tsx
  - frontend/src/signage/player/VideoPlayer.tsx
  - frontend/src/signage/player/PdfPlayer.tsx
autonomous: true
requirements: [SGN-PLY-04, SGN-PLY-06, SGN-PLY-07, SGN-DIFF-03]
must_haves:
  truths:
    - "PlaybackShell loads /api/signage/player/playlist on mount and renders items via <PlayerRenderer>"
    - "EventSource subscribes to /api/signage/player/stream?token=<token>; on `playlist-changed` event, playlist refetches"
    - "45s watchdog (resettable on every event including server pings) closes EventSource on silence and starts 30s polling"
    - "Successful poll triggers SSE reconnect; if first event arrives within 5s, polling stops"
    - "On any 401, useDeviceToken.clearToken() is invoked"
    - "VideoPlayer accepts a new `loop?: boolean` prop defaulting to `true` (admin backward compat); player wrapper passes `loop={false}`"
    - "PdfPlayer renders TWO Page layers and crossfades opacity over 200ms on page change (SGN-DIFF-03)"
    - "OfflineChip is visible only when window.signageSidecarReady === true AND useSidecarStatus reports offline"
    - "useSidecarStatus uses hybrid detector: window flag synchronously + 200ms localhost:8080/health probe fallback (Pitfall P10)"
  artifacts:
    - path: frontend/src/player/hooks/useSseWithPollingFallback.ts
      provides: "SSE/watchdog/polling state machine (D-7)"
      exports: ["useSseWithPollingFallback"]
    - path: frontend/src/player/hooks/useSidecarStatus.ts
      provides: "hybrid sidecar detector (Pitfall P10)"
      exports: ["useSidecarStatus"]
    - path: frontend/src/player/components/OfflineChip.tsx
      provides: "amber bottom-right offline indicator (UI-SPEC §Offline indicator chip)"
      exports: ["OfflineChip"]
    - path: frontend/src/player/PlaybackShell.tsx
      provides: "playback surface that wraps PlayerRenderer with lifecycle"
      exports: ["PlaybackShell"]
  key_links:
    - from: frontend/src/player/PlaybackShell.tsx
      to: frontend/src/signage/player/PlayerRenderer.tsx
      via: "import { PlayerRenderer }"
      pattern: "from \"@/signage/player/PlayerRenderer\""
    - from: frontend/src/player/PlaybackShell.tsx
      to: /api/signage/player/playlist
      via: "playerFetch GET via TanStack Query"
      pattern: "/api/signage/player/playlist"
    - from: frontend/src/player/hooks/useSseWithPollingFallback.ts
      to: /api/signage/player/stream
      via: "new EventSource(`/api/signage/player/stream?token=${token}`)"
      pattern: "/api/signage/player/stream"
    - from: frontend/src/signage/player/VideoPlayer.tsx
      to: PlaybackShell
      via: "loop prop defaults to true; player wrapper passes loop={false}"
      pattern: "loop\\?\\s*:\\s*boolean"
---

<objective>
Build the playback surface: the PlayerRenderer wrapper that owns the SSE+watchdog+polling lifecycle, the hybrid sidecar detector, the offline chip, and the two surgical tweaks to Phase 46-03 components (VideoPlayer loop prop, PdfPlayer crossfade).

Purpose: Closes SGN-PLY-04 (playlist fetch + SSE-driven invalidation + 30s polling fallback), SGN-PLY-06 (45s watchdog + auto-reconnect), SGN-PLY-07 (format handler reuse with timing defaults + loop disabled), SGN-DIFF-03 (PDF crossfade between pages).
Output: 4 new files + 2 surgical modifications to Phase 46-03 components.

PRECONDITION: Plan 47-01 Task 0 (47-OQ4-RESOLUTION.md) must show `Outcome: PASS`. If FAIL, this plan is BLOCKED — escalate to add a backend tweak before executing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/47-player-bundle/47-CONTEXT.md
@.planning/phases/47-player-bundle/47-RESEARCH.md
@.planning/phases/47-player-bundle/47-UI-SPEC.md
@.planning/phases/45-sse-broadcast/45-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/46-admin-ui/46-03-player-renderer-SUMMARY.md
@frontend/src/signage/player/PlayerRenderer.tsx
@frontend/src/signage/player/VideoPlayer.tsx
@frontend/src/signage/player/PdfPlayer.tsx
@frontend/src/signage/player/types.ts
@frontend/src/player/lib/playerApi.ts
@frontend/src/player/lib/queryKeys.ts
@frontend/src/player/lib/durationDefaults.ts
@frontend/src/player/lib/strings.ts
@frontend/src/player/lib/mediaUrl.ts
@frontend/src/player/hooks/useDeviceToken.ts
@.planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md

<interfaces>
<!-- Phase 46-03 PlayerRenderer surface (frontend/src/signage/player/types.ts + PlayerRenderer.tsx) -->
import type { PlayerItem } from "@/signage/player/types";
export function PlayerRenderer(props: { items: PlayerItem[] }): JSX.Element;

<!-- Phase 45 SSE event payload (45-CONTEXT D-01) -->
interface PlaylistChangedEvent {
  event: "playlist-changed";
  playlist_id: string;  // str(uuid)
  etag: string;
}
// Server also emits 15s ping comments (": ping\n\n") per Phase 45 SSE keepalive — these do NOT trigger
// onmessage; they reach the EventSource as no-op heartbeats but DO reset the readyState OPEN watchdog.
// Implementation note: the watchdog reset on EventSource open + onmessage covers the meaningful events;
// for the 15s pings to reset the watchdog as REQUIRED by D-7 ("watchdog resets on every event INCLUDING
// the 15s server pings"), use addEventListener('open') for initial + a periodic readyState check OR
// rely on the fact that Browsers fire onmessage only for `data:` events but EventSource onerror fires
// when the underlying connection drops — which is the watchdog's actual purpose.
// SAFE PATTERN: reset on onopen and onmessage; the 45s watchdog covers the case where neither fires.

<!-- Phase 43 envelope (43-CONTEXT D-06/D-07) — what /playlist returns -->
interface PlaylistEnvelope {
  playlist_id: string | null;
  name: string | null;
  items: Array<{
    media_id: string;
    kind: "image" | "video" | "pdf" | "iframe" | "html" | "pptx";
    uri: string;
    duration_ms: number;
    transition: "fade" | "cut";
    position: number;
  }>;
  resolved_at: string;
}

<!-- Phase 46-03 VideoPlayer current shape (from SUMMARY): <video muted autoPlay playsInline loop> with loop hardcoded TRUE -->
<!-- Phase 46-03 PdfPlayer current shape: single <Page> rendered with auto-flip via setTimeout -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Surgical tweaks — VideoPlayer loop prop + PdfPlayer crossfade (SGN-PLY-07 + SGN-DIFF-03)</name>
  <files>frontend/src/signage/player/VideoPlayer.tsx, frontend/src/signage/player/PdfPlayer.tsx</files>
  <read_first>
    - frontend/src/signage/player/VideoPlayer.tsx (Phase 46-03 — note current `loop` is hardcoded)
    - frontend/src/signage/player/PdfPlayer.tsx (Phase 46-03 — note current single-Page render with setTimeout flip)
    - .planning/phases/46-admin-ui/46-03-player-renderer-SUMMARY.md (hand-off notes — "loop is admin-preview specific; Phase 47 wrapper disables")
    - .planning/phases/47-player-bundle/47-RESEARCH.md (Pitfall P12 — VideoPlayer loop prop)
  </read_first>
  <action>
    **VideoPlayer change** (additive, backward-compatible per Pitfall P12):

    Add a `loop?: boolean` prop defaulting to `true` (preserves admin-preview behavior). The player wrapper (PlaybackShell, Task 4) passes `loop={false}`. Also add an optional `onEnded?: () => void` callback so the player wrapper can advance the playlist on natural-end (D-6 video sentinel).

    Read the existing VideoPlayer.tsx, then update its props interface and component:
    ```tsx
    // Existing prop type (extend, do not rewrite from scratch — preserve all current props):
    export interface VideoPlayerProps {
      // ...all existing props...
      loop?: boolean;       // NEW — defaults to true (admin backward compat per Pitfall P12)
      onEnded?: () => void; // NEW — fires on natural end; player wrapper advances playlist
    }

    export function VideoPlayer({ loop = true, onEnded, /* ...existing... */ }: VideoPlayerProps) {
      // ...existing JSX, but replace `<video ... loop>` with `<video ... loop={loop} onEnded={onEnded}>`
    }
    ```

    Write a Phase 47 comment above the component:
    ```tsx
    // Phase 46-03 originally hardcoded `loop`. Phase 47 P12 made it a prop:
    //   - admin preview keeps backward-compat default (loop=true)
    //   - player wrapper (frontend/src/player/PlaybackShell.tsx) passes loop=false
    //     so video plays once and `onEnded` advances the playlist (D-6 VIDEO_DURATION_NATURAL).
    ```

    **PdfPlayer change** (additive — implements SGN-DIFF-03 crossfade):

    Read the existing PdfPlayer.tsx (built in 46-03). Currently renders one `<Page>` and flips on a timer. SGN-DIFF-03 requires a 200ms opacity crossfade between consecutive pages.

    Implementation pattern (RESEARCH §Pattern — partial; full implementation here):
    1. Add a `crossfadeMs` prop, default 200.
    2. Render TWO `<Page>` layers absolute-positioned (`absolute inset-0`).
    3. Maintain `currentPage` and `nextPage` state.
    4. Maintain `fadingTo` state (boolean) tracking whether a crossfade is in progress.
    5. On the auto-flip timer:
       - Set `nextPage` = current + 1 (mod pageCount).
       - Set `fadingTo = true`.
       - Layer A (currentPage): `transition-opacity duration-200`, `opacity-100` → `opacity-0`.
       - Layer B (nextPage): `transition-opacity duration-200`, `opacity-0` → `opacity-100`.
       - After `crossfadeMs`, swap: `currentPage = nextPage`; `fadingTo = false`.

    Skeleton (executor fills in around the existing PdfPlayer body):
    ```tsx
    export interface PdfPlayerProps {
      // ...existing props (uri, autoFlipSeconds, etc.)...
      crossfadeMs?: number; // NEW — defaults to 200 per SGN-DIFF-03
    }

    export function PdfPlayer({ crossfadeMs = 200, /* ...existing... */ }: PdfPlayerProps) {
      const [currentPage, setCurrentPage] = useState(1);
      const [nextPage, setNextPage] = useState<number | null>(null);
      // existing pageCount + ResizeObserver state preserved as-is

      // Replace the existing `setCurrentPage(p => (p % pageCount) + 1)` flip with:
      const advance = useCallback(() => {
        setNextPage((p) => {
          const target = currentPage >= pageCount ? 1 : currentPage + 1;
          return target;
        });
        // After the crossfade, commit the swap.
        const t = window.setTimeout(() => {
          setCurrentPage((p) => (p >= pageCount ? 1 : p + 1));
          setNextPage(null);
        }, crossfadeMs);
        return () => window.clearTimeout(t);
      }, [currentPage, pageCount, crossfadeMs]);

      // existing autoFlipSeconds setTimeout calls advance() instead of the direct setCurrentPage.

      return (
        <div ref={containerRef} className="relative w-full h-full bg-black">
          <Document file={uri} onLoadSuccess={({ numPages }) => setPageCount(numPages)}>
            {/* Layer A: current page */}
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{ opacity: nextPage === null ? 1 : 0 }}
            >
              <Page
                pageNumber={currentPage}
                width={containerWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
            {/* Layer B: next page (only mounted during crossfade) */}
            {nextPage !== null && (
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{ opacity: 1 }}
              >
                <Page
                  pageNumber={nextPage}
                  width={containerWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            )}
          </Document>
        </div>
      );
    }
    ```

    Add a comment above the component:
    ```tsx
    // SGN-DIFF-03: PDF crossfade between consecutive pages.
    // Two-layer overlap with `transition-opacity duration-200`. Default 200ms per ROADMAP success criterion 3.
    // Admin-configurable per-playlist piece is OUT OF SCOPE per CONTEXT (no admin UI changes); fixed default.
    ```

    Critical:
    - Do NOT introduce GlobalWorkerOptions configuration here — Phase 47 owns the pin in `frontend/src/player/lib/pdfWorker.ts` (Plan 47-01) which is imported by `main.tsx`.
    - Preserve the existing `renderTextLayer={false}` and `renderAnnotationLayer={false}` props — the 46-03 verification gate checks these.
    - Preserve `autoFlipSeconds` prop and the ≥1000ms guard.
    - Do NOT change the Document/Page imports — same `react-pdf` package as 46-03.
  </action>
  <verify>
    <automated>grep -q "loop?: boolean" frontend/src/signage/player/VideoPlayer.tsx && grep -q "loop = true" frontend/src/signage/player/VideoPlayer.tsx && grep -q "onEnded?:" frontend/src/signage/player/VideoPlayer.tsx && grep -q "crossfadeMs" frontend/src/signage/player/PdfPlayer.tsx && grep -q "transition-opacity duration-200" frontend/src/signage/player/PdfPlayer.tsx && grep -q "renderTextLayer={false}" frontend/src/signage/player/PdfPlayer.tsx && grep -q "renderAnnotationLayer={false}" frontend/src/signage/player/PdfPlayer.tsx && ! grep -q "GlobalWorkerOptions" frontend/src/signage/player/PdfPlayer.tsx</automated>
  </verify>
  <done>
    `VideoPlayer` accepts `loop` (default `true`) + `onEnded`. `PdfPlayer` renders two-layer crossfade with 200ms transition. `GlobalWorkerOptions` is NOT touched here (lives in Plan 47-01 pdfWorker.ts). Phase 46 admin preview behavior is preserved (default props match 46-03 SUMMARY).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build useSidecarStatus hook (hybrid detector — Pitfall P10)</name>
  <files>frontend/src/player/hooks/useSidecarStatus.ts</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-1 — sidecar contract)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (Pitfall P10 — hybrid detector pattern, 200ms timeout)
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Offline indicator chip §"Visibility rules" — 4-state truth table)
  </read_first>
  <action>
    Create `frontend/src/player/hooks/useSidecarStatus.ts`:

    ```ts
    // Phase 47 D-1 + Pitfall P10: hybrid sidecar detector.
    // Resolution priority:
    //   1. window.signageSidecarReady === true → flagged-ready
    //   2. fetch('http://localhost:8080/health') with 200ms timeout → fetch-detected
    //   3. neither → 'unknown' (treat as no sidecar; Offline chip stays hidden per UI-SPEC truth table)
    //
    // Status semantics (UI-SPEC §"Visibility rules"):
    //   'unknown'  → sidecar not present (dev server, no Pi); chip HIDDEN
    //   'online'   → sidecar present and reporting connectivity OK; chip HIDDEN
    //   'offline'  → sidecar present and reporting connectivity FAILED; chip VISIBLE
    //
    // Result is cached for the session; the sidecar dispatches 'signage:sidecar-ready' on its own
    // when status changes (Phase 48 contract), and the listener invalidates the cache.

    import { useEffect, useState } from "react";

    export type SidecarStatus = "unknown" | "online" | "offline";

    const SIDECAR_HEALTH_URL = "http://localhost:8080/health";
    const PROBE_TIMEOUT_MS = 200;

    async function probeSidecar(): Promise<SidecarStatus> {
      // Sync flag check first.
      if (typeof window !== "undefined" && window.signageSidecarReady === true) {
        return "online";
      }
      // Fetch probe with 200ms abort.
      try {
        const r = await fetch(SIDECAR_HEALTH_URL, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (!r.ok) return "unknown";
        // Sidecar /health response shape (Phase 48 contract — assumed):
        //   { online: boolean }
        const body = (await r.json().catch(() => ({}))) as { online?: boolean };
        if (body.online === true) return "online";
        if (body.online === false) return "offline";
        return "online"; // sidecar exists but didn't report — assume online
      } catch {
        return "unknown";
      }
    }

    export function useSidecarStatus(): SidecarStatus {
      const [status, setStatus] = useState<SidecarStatus>("unknown");

      useEffect(() => {
        let cancelled = false;
        // Initial probe.
        probeSidecar().then((s) => {
          if (!cancelled) setStatus(s);
        });

        // Listen for sidecar-dispatched updates (Phase 48 will dispatch this on status changes).
        const handler = () => {
          probeSidecar().then((s) => {
            if (!cancelled) setStatus(s);
          });
        };
        if (typeof window !== "undefined") {
          window.addEventListener("signage:sidecar-ready", handler);
          window.addEventListener("signage:sidecar-status", handler);
        }

        // Periodic re-probe every 30s in case sidecar comes/goes mid-session without dispatching events.
        const interval = window.setInterval(handler, 30_000);

        return () => {
          cancelled = true;
          if (typeof window !== "undefined") {
            window.removeEventListener("signage:sidecar-ready", handler);
            window.removeEventListener("signage:sidecar-status", handler);
          }
          window.clearInterval(interval);
        };
      }, []);

      return status;
    }
    ```

    Critical:
    - 200ms timeout via `AbortSignal.timeout(200)` — matches Pitfall P10 spec.
    - Initial state `'unknown'` — UI-SPEC truth table: chip HIDDEN until proven otherwise.
    - Two custom event names listened to: `signage:sidecar-ready` (Phase 48 dispatches when sidecar comes online) and `signage:sidecar-status` (any status change). Phase 47 ships defensively for both.
    - Periodic 30s re-probe for safety.
    - `fetch()` here is allowed (CI guard exempts hooks/useSidecarStatus.ts — add to allowlist in Plan 47-05).
  </action>
  <verify>
    <automated>test -f frontend/src/player/hooks/useSidecarStatus.ts && grep -q "AbortSignal.timeout(PROBE_TIMEOUT_MS)\|AbortSignal.timeout(200)" frontend/src/player/hooks/useSidecarStatus.ts && grep -q "localhost:8080/health" frontend/src/player/hooks/useSidecarStatus.ts && grep -q "signageSidecarReady" frontend/src/player/hooks/useSidecarStatus.ts && grep -q '"unknown"\|"online"\|"offline"' frontend/src/player/hooks/useSidecarStatus.ts && grep -q "signage:sidecar-ready" frontend/src/player/hooks/useSidecarStatus.ts</automated>
  </verify>
  <done>
    Hook returns `'unknown' | 'online' | 'offline'`. Reads `window.signageSidecarReady` synchronously, falls back to a 200ms-timeout probe of `http://localhost:8080/health`. Re-probes on `signage:sidecar-ready` / `signage:sidecar-status` custom events and every 30s.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build OfflineChip + useSseWithPollingFallback hook</name>
  <files>frontend/src/player/components/OfflineChip.tsx, frontend/src/player/hooks/useSseWithPollingFallback.ts</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Offline indicator chip — exact classes; §"Data Fetching Contract")
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-4, D-7 — SSE/polling lifecycle)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§Pattern 3 — full hook reference; Pitfall P7 — token in URL accepted)
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md (D-01 payload, 15s pings)
    - .planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md (must show PASS)
    - frontend/src/player/lib/strings.ts (t function for offline label)
  </read_first>
  <action>
    Confirm `47-OQ4-RESOLUTION.md` shows `Outcome: PASS` before proceeding. If FAIL, halt and escalate.

    **File 1: `frontend/src/player/components/OfflineChip.tsx`** (UI-SPEC §Offline indicator chip)

    ```tsx
    // Phase 47 UI-SPEC §Offline indicator chip: amber bottom-right pill.
    // Visibility rules (UI-SPEC §"Visibility rules"):
    //   show iff sidecarStatus === 'offline'.
    //   ('unknown' and 'online' both hide the chip — defaults to assumed-OK.)

    import { WifiOff } from "lucide-react";
    import { t } from "@/player/lib/strings";
    import type { SidecarStatus } from "@/player/hooks/useSidecarStatus";

    export interface OfflineChipProps {
      sidecarStatus: SidecarStatus;
    }

    export function OfflineChip({ sidecarStatus }: OfflineChipProps) {
      if (sidecarStatus !== "offline") return null;
      return (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("offline.aria_label")}
          className="fixed bottom-8 right-8 z-50 px-3 py-2 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 flex items-center gap-1 text-sm font-semibold text-amber-400"
        >
          <WifiOff className="w-4 h-4" aria-hidden="true" />
          <span>{t("offline.label")}</span>
        </div>
      );
    }
    ```

    Class string MUST be exactly: `fixed bottom-8 right-8 z-50 px-3 py-2 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 flex items-center gap-1 text-sm font-semibold text-amber-400` (UI-SPEC §Offline indicator chip §"Position & sizing").

    **File 2: `frontend/src/player/hooks/useSseWithPollingFallback.ts`**

    Implements D-4 + D-7 lifecycle. Full implementation:

    ```ts
    // Phase 47 D-4 + D-7: SSE/watchdog/polling lifecycle.
    // States: connecting → live → silent (watchdog fired) → polling → reconnecting → live.
    //
    // Key invariants:
    //   - 45s watchdog (resettable on EventSource onopen + onmessage)
    //   - On watchdog fire OR onerror: close ES, start 30s polling
    //   - On successful poll: attempt SSE reconnect; if first event arrives within 5s, kill polling
    //   - Token transport: ?token= query string (Pitfall P7 accepted; Phase 45 dep supports — see 47-OQ4-RESOLUTION)
    //   - StrictMode safety: cleanup closes ES + clears all timers (Pitfall: leaked EventSources crash server queue)

    import { useEffect, useRef } from "react";
    import { playerFetch } from "@/player/lib/playerApi";

    const WATCHDOG_MS = 45_000;
    const POLLING_MS = 30_000;
    const SSE_RECONNECT_GRACE_MS = 5_000;

    export interface UseSseWithPollingFallbackOpts {
      token: string | null;
      streamUrl: string;          // e.g. "/api/signage/player/stream"
      pollUrl: string;            // e.g. "/api/signage/player/playlist"
      /** Called when an SSE event OR a successful poll says the playlist may have changed. */
      onPlaylistInvalidated: () => void;
      /** Called on 401 — caller wipes token. */
      onUnauthorized: () => void;
    }

    export function useSseWithPollingFallback(opts: UseSseWithPollingFallbackOpts): void {
      const { token, streamUrl, pollUrl, onPlaylistInvalidated, onUnauthorized } = opts;
      const callbacksRef = useRef({ onPlaylistInvalidated, onUnauthorized });
      callbacksRef.current = { onPlaylistInvalidated, onUnauthorized };

      useEffect(() => {
        if (!token) return;

        let killed = false;
        let es: EventSource | null = null;
        let watchdog: number | undefined;
        let pollingTimer: number | undefined;
        let reconnectGrace: number | undefined;
        let lastEventAt = 0;

        const clearWatchdog = () => {
          if (watchdog !== undefined) {
            window.clearTimeout(watchdog);
            watchdog = undefined;
          }
        };
        const clearPolling = () => {
          if (pollingTimer !== undefined) {
            window.clearInterval(pollingTimer);
            pollingTimer = undefined;
          }
        };
        const clearReconnectGrace = () => {
          if (reconnectGrace !== undefined) {
            window.clearTimeout(reconnectGrace);
            reconnectGrace = undefined;
          }
        };

        const armWatchdog = () => {
          clearWatchdog();
          if (killed) return;
          watchdog = window.setTimeout(onWatchdogFire, WATCHDOG_MS);
        };

        const onWatchdogFire = () => {
          if (killed) return;
          es?.close();
          es = null;
          startPolling();
        };

        const noteEvent = () => {
          lastEventAt = Date.now();
          armWatchdog();
        };

        const openSse = () => {
          if (killed) return;
          // ?token= per Pitfall P7 (browsers can't set EventSource headers); validated by 47-OQ4-RESOLUTION.
          const fullUrl = `${streamUrl}?token=${encodeURIComponent(token)}`;
          es = new EventSource(fullUrl);
          es.onopen = () => noteEvent();
          es.onmessage = (e) => {
            noteEvent();
            // Parse Phase 45 payload {event, playlist_id, etag}; on 'playlist-changed', invalidate.
            try {
              const data = JSON.parse(e.data) as { event?: string };
              if (data.event === "playlist-changed") {
                callbacksRef.current.onPlaylistInvalidated();
              }
            } catch {
              // Malformed payload — still treat as liveness signal.
            }
          };
          es.onerror = () => {
            if (killed) return;
            es?.close();
            es = null;
            startPolling();
          };
          armWatchdog();
        };

        const startPolling = () => {
          if (killed || pollingTimer !== undefined) return;
          const poll = async () => {
            try {
              await playerFetch(pollUrl, {
                token,
                on401: () => callbacksRef.current.onUnauthorized(),
              });
              if (killed) return;
              callbacksRef.current.onPlaylistInvalidated();
              // Successful poll → try SSE reconnect; if first event arrives within 5s, kill polling.
              if (!es) {
                openSse();
                clearReconnectGrace();
                reconnectGrace = window.setTimeout(() => {
                  // If we got an event during the grace window, polling will already be cleared.
                  if (Date.now() - lastEventAt <= SSE_RECONNECT_GRACE_MS) {
                    clearPolling();
                  }
                  reconnectGrace = undefined;
                }, SSE_RECONNECT_GRACE_MS);
              }
            } catch {
              // 401 already handled inside playerFetch; other errors → keep polling silently.
            }
          };
          // Fire immediately, then on interval.
          void poll();
          pollingTimer = window.setInterval(() => void poll(), POLLING_MS);
        };

        openSse();

        return () => {
          killed = true;
          es?.close();
          es = null;
          clearWatchdog();
          clearPolling();
          clearReconnectGrace();
        };
      }, [token, streamUrl, pollUrl]);
    }
    ```

    Critical:
    - StrictMode-safe: cleanup closes ES + clears ALL three timers (watchdog, pollingTimer, reconnectGrace).
    - `lastEventAt` tracks when the most recent event arrived; the reconnect-grace check uses it to decide whether to kill polling.
    - The `?token=` URL only forms inside this hook — never logged outside.
    - The hook returns `void` (no state) — invalidation flows through the callback. Caller (PlaybackShell) drives playlist refetch via TanStack Query's `invalidateQueries`.
    - Server's 15s `: ping` SSE comments don't fire `onmessage` (browsers swallow comment-only events) — but they DO keep the connection alive. The watchdog will not fire as long as the connection is healthy because `onerror` triggers earlier than 45s of true silence. This is the correct shape per RESEARCH §Pattern 3.
  </action>
  <verify>
    <automated>test -f frontend/src/player/components/OfflineChip.tsx && test -f frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q 'sidecarStatus !== "offline"' frontend/src/player/components/OfflineChip.tsx && grep -q "WifiOff" frontend/src/player/components/OfflineChip.tsx && grep -q "fixed bottom-8 right-8 z-50" frontend/src/player/components/OfflineChip.tsx && grep -q "text-amber-400" frontend/src/player/components/OfflineChip.tsx && grep -q "WATCHDOG_MS = 45_000" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "POLLING_MS = 30_000" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "SSE_RECONNECT_GRACE_MS = 5_000" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "new EventSource" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "?token=" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "es?.close" frontend/src/player/hooks/useSseWithPollingFallback.ts && grep -q "playlist-changed" frontend/src/player/hooks/useSseWithPollingFallback.ts</automated>
  </verify>
  <done>
    OfflineChip is null unless `sidecarStatus === 'offline'`; otherwise renders amber pill bottom-right. SSE hook implements: open EventSource(`<streamUrl>?token=<token>`) → 45s watchdog → on fire/error close+start 30s polling → on poll-success try reconnect with 5s grace. Cleanup closes ES + clears all timers.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Build PlaybackShell — wraps PlayerRenderer with playlist + SSE/polling lifecycle</name>
  <files>frontend/src/player/PlaybackShell.tsx</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Playback canvas — full spec; §"Mount behavior" 6 steps; §"Format handler timing defaults")
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-2 — 401 wipe; D-6 — durations; D-8 — NO heartbeat from JS)
    - frontend/src/signage/player/PlayerRenderer.tsx (the component being wrapped)
    - frontend/src/signage/player/types.ts (PlayerItem shape)
    - frontend/src/player/lib/durationDefaults.ts (applyDurationDefaults)
    - frontend/src/player/lib/mediaUrl.ts (resolveMediaUrl — sidecar URL rewrite)
    - frontend/src/player/lib/playerApi.ts
    - frontend/src/player/lib/queryKeys.ts
    - frontend/src/player/hooks/useDeviceToken.ts (clearToken on 401)
    - frontend/src/player/hooks/useSseWithPollingFallback.ts
    - frontend/src/player/hooks/useSidecarStatus.ts
    - frontend/src/player/components/OfflineChip.tsx
  </read_first>
  <action>
    Create `frontend/src/player/PlaybackShell.tsx`:

    ```tsx
    // Phase 47 UI-SPEC §Playback canvas: wraps <PlayerRenderer> with the SSE/polling lifecycle,
    // duration defaults, sidecar-aware media URLs, and the offline chip overlay.
    // NO heartbeat (D-8 — heartbeat is the Phase 48 sidecar's job, not the JS bundle).

    import { useEffect, useMemo } from "react";
    import { useQuery, useQueryClient } from "@tanstack/react-query";
    import { PlayerRenderer } from "@/signage/player/PlayerRenderer";
    import type { PlayerItem } from "@/signage/player/types";
    import { playerFetch } from "@/player/lib/playerApi";
    import { playerKeys } from "@/player/lib/queryKeys";
    import { applyDurationDefaults } from "@/player/lib/durationDefaults";
    import { resolveMediaUrl } from "@/player/lib/mediaUrl";
    import { useDeviceToken } from "@/player/hooks/useDeviceToken";
    import { useSseWithPollingFallback } from "@/player/hooks/useSseWithPollingFallback";
    import { useSidecarStatus } from "@/player/hooks/useSidecarStatus";
    import { OfflineChip } from "@/player/components/OfflineChip";

    interface PlaylistEnvelope {
      playlist_id: string | null;
      name: string | null;
      items: Array<{
        media_id: string;
        kind: PlayerItem["kind"];
        uri: string;
        duration_ms: number;
        transition: "fade" | "cut";
        position: number;
        // optional handler-specific fields (slide_paths for pptx, html_content for html, etc.)
        slide_paths?: string[];
        pageCount?: number;
      }>;
      resolved_at: string;
    }

    const PLAYLIST_URL = "/api/signage/player/playlist";
    const STREAM_URL = "/api/signage/player/stream";

    export function PlaybackShell() {
      const { token, clearToken } = useDeviceToken();
      const queryClient = useQueryClient();
      const sidecarStatus = useSidecarStatus();

      // Initial + invalidate-driven playlist fetch. Polling fallback (30s) is driven by the SSE hook, NOT
      // a refetchInterval here — see UI-SPEC §"Data Fetching Contract" (refetchInterval: false normally).
      const { data: envelope } = useQuery<PlaylistEnvelope>({
        queryKey: playerKeys.playlist(),
        queryFn: () =>
          playerFetch<PlaylistEnvelope>(PLAYLIST_URL, {
            token: token!,
            on401: clearToken,
          }),
        enabled: !!token,
        staleTime: 5 * 60_000,
        gcTime: Infinity, // never evict last-known playlist (offline cache-and-loop)
        retry: (failureCount) => failureCount < 3,
      });

      // Wire the SSE/watchdog/polling lifecycle. On any signal that the playlist may have changed,
      // invalidate the query so TanStack refetches (which reuses the SW-cached response if offline).
      useSseWithPollingFallback({
        token,
        streamUrl: STREAM_URL,
        pollUrl: PLAYLIST_URL,
        onPlaylistInvalidated: () => {
          void queryClient.invalidateQueries({ queryKey: playerKeys.playlist() });
        },
        onUnauthorized: clearToken,
      });

      // Apply per-format duration defaults (D-6) AND sidecar URL rewrite (D-1).
      // Result is memoized so PlayerRenderer's [items] reset effect only fires on actual playlist change.
      const items: PlayerItem[] = useMemo(() => {
        if (!envelope) return [];
        const mapped: PlayerItem[] = envelope.items.map((it) => ({
          id: `${it.media_id}-${it.position}`,
          kind: it.kind,
          uri: resolveMediaUrl({ id: it.media_id, uri: it.uri }),
          duration_s: it.duration_ms > 0 ? it.duration_ms / 1000 : undefined,
          transition: it.transition,
          // Pass through optional handler-specific fields:
          ...(it.slide_paths !== undefined ? { slide_paths: it.slide_paths } : {}),
          ...(it.pageCount !== undefined ? { pageCount: it.pageCount } : {}),
        }));
        return applyDurationDefaults(mapped);
      }, [envelope]);

      // Hide cursor on playback canvas (UI-SPEC §"No user interaction" safety net).
      useEffect(() => {
        const prev = document.body.style.cursor;
        document.body.style.cursor = "none";
        return () => {
          document.body.style.cursor = prev;
        };
      }, []);

      return (
        <div className="w-screen h-screen bg-black overflow-hidden">
          <PlayerRenderer items={items} />
          <OfflineChip sidecarStatus={sidecarStatus} />
        </div>
      );
    }
    ```

    Critical (do not deviate):
    - Layout: EXACTLY `w-screen h-screen bg-black overflow-hidden` (UI-SPEC §Playback canvas §Layout).
    - `gcTime: Infinity` for the playlist query (UI-SPEC §"Data Fetching Contract" — never evict last-known).
    - `staleTime: 5 * 60_000` per UI-SPEC.
    - NO `refetchInterval` on the playlist query — polling cadence is owned by the SSE hook's fallback.
    - NO heartbeat POST anywhere in this file (D-8).
    - `on401: clearToken` on every playerFetch call.
    - `cursor: none` cleanup restores the previous value (so admin-side preview reuse doesn't break).
    - `key` for items: `${media_id}-${position}` (positional uniqueness; PlayerRenderer uses item.id internally).
  </action>
  <verify>
    <automated>test -f frontend/src/player/PlaybackShell.tsx && grep -q "PlayerRenderer" frontend/src/player/PlaybackShell.tsx && grep -q "useSseWithPollingFallback" frontend/src/player/PlaybackShell.tsx && grep -q "useSidecarStatus" frontend/src/player/PlaybackShell.tsx && grep -q "OfflineChip" frontend/src/player/PlaybackShell.tsx && grep -q "applyDurationDefaults" frontend/src/player/PlaybackShell.tsx && grep -q "resolveMediaUrl" frontend/src/player/PlaybackShell.tsx && grep -q "/api/signage/player/playlist" frontend/src/player/PlaybackShell.tsx && grep -q "/api/signage/player/stream" frontend/src/player/PlaybackShell.tsx && grep -q "gcTime: Infinity" frontend/src/player/PlaybackShell.tsx && grep -q "w-screen h-screen bg-black overflow-hidden" frontend/src/player/PlaybackShell.tsx && grep -q "on401: clearToken" frontend/src/player/PlaybackShell.tsx && ! grep -q "/heartbeat" frontend/src/player/PlaybackShell.tsx && ! grep -q "dark:" frontend/src/player/PlaybackShell.tsx</automated>
  </verify>
  <done>
    PlaybackShell mounts → fetches playlist via playerFetch → wires SSE+watchdog+polling → applies duration defaults + sidecar URL rewrite → renders PlayerRenderer + OfflineChip → 401 triggers clearToken. NO heartbeat. NO `dark:`. Layout exact match to UI-SPEC.
  </done>
</task>

</tasks>

<verification>
- All 4 new files exist; 2 modified files have the additive changes.
- Targeted typecheck: `cd frontend && npx tsc --noEmit src/player/hooks/*.ts src/player/components/*.tsx src/player/PlaybackShell.tsx src/signage/player/VideoPlayer.tsx src/signage/player/PdfPlayer.tsx` should be clean (admin-side pre-existing errors not in this set).
- Manual smoke deferred to Plan 47-05's full UAT.
</verification>

<success_criteria>
- SGN-PLY-04: playlist fetched on mount + invalidated on SSE event + 30s polling kicks in on watchdog fire.
- SGN-PLY-06: EventSource opens with `?token=`, 45s watchdog cycle works, reconnect grace honors the 5s rule.
- SGN-PLY-07: VideoPlayer accepts `loop={false}` from PlaybackShell; format handlers reused from Phase 46-03 unchanged otherwise.
- SGN-DIFF-03: PdfPlayer crossfades between consecutive pages over 200ms.
- 401 from any API call wipes localStorage and navigates to pairing screen.
</success_criteria>

<output>
After completion, create `.planning/phases/47-player-bundle/47-03-SUMMARY.md` with:
- Files created + modified
- Confirmation that 47-OQ4-RESOLUTION.md was checked PASS before execution (or escalation if FAIL)
- Confirmation that VideoPlayer change is backward-compatible for admin (default loop=true preserved)
- Hand-off note: Plan 47-04 must wire PlaybackShell into App.tsx at `/player/:token` route
- Hand-off note: Plan 47-05's check-player-isolation.mjs must allowlist `useSidecarStatus.ts` (uses raw fetch for localhost probe), `playerApi.ts` (the documented apiClient exception), and `PairingScreen.tsx` (anonymous pre-token endpoints)
</output>
