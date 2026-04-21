// Phase 47 UI-SPEC §Playback canvas: wraps <PlayerRenderer> with the SSE/polling
// lifecycle, duration defaults, sidecar-aware media URLs, and the offline chip
// overlay.
//
// Heartbeat: the Pi sidecar owns production heartbeats (Phase 48 D-8). As a
// browser-testing fallback (no sidecar present), the JS bundle sends a
// lightweight 60s heartbeat so admin presence/analytics reflect reality. The
// server-side event insert is idempotent (ON CONFLICT on (device_id, ts)), so
// Pi-with-sidecar + JS double-heartbeat is harmless.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayerRenderer } from "@/signage/player/PlayerRenderer";
import type {
  PlayerItem,
  PlayerItemKind,
  PlayerTransition,
} from "@/signage/player/types";
import { playerFetch } from "@/player/lib/playerApi";
import { playerKeys } from "@/player/lib/queryKeys";
import { applyDurationDefaults } from "@/player/lib/durationDefaults";
import { resolveMediaUrl } from "@/player/lib/mediaUrl";
import { useDeviceToken } from "@/player/hooks/useDeviceToken";
import { useSseWithPollingFallback } from "@/player/hooks/useSseWithPollingFallback";
import { useSidecarStatus } from "@/player/hooks/useSidecarStatus";
import { OfflineChip } from "@/player/components/OfflineChip";

interface PlaylistEnvelopeItem {
  media_id: string;
  kind: PlayerItemKind;
  uri: string;
  duration_ms: number;
  transition: PlayerTransition | "fade" | "cut";
  position: number;
  // Optional handler-specific fields (server may emit these for pptx/html).
  slide_paths?: string[] | null;
  html?: string | null;
}

interface PlaylistEnvelope {
  playlist_id: string | null;
  name: string | null;
  items: PlaylistEnvelopeItem[];
  resolved_at: string;
}

const PLAYLIST_URL = "/api/signage/player/playlist";
const STREAM_URL = "/api/signage/player/stream";

export function PlaybackShell() {
  const { token, clearToken } = useDeviceToken();
  const queryClient = useQueryClient();
  const sidecarStatus = useSidecarStatus();

  // Initial + invalidate-driven playlist fetch. Polling fallback (30s) is driven
  // by the SSE hook, NOT a refetchInterval here — see UI-SPEC §"Data Fetching
  // Contract" (refetchInterval: false normally).
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

  // Wire the SSE/watchdog/polling lifecycle. On any signal that the playlist may
  // have changed, invalidate the query so TanStack refetches (which reuses the
  // SW-cached response if offline).
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
  // Result is memoized so PlayerRenderer's [items] reset effect only fires on
  // an actual playlist change.
  const items: PlayerItem[] = useMemo(() => {
    if (!envelope) return [];
    const mapped: PlayerItem[] = envelope.items.map((it) => {
      const transition: PlayerTransition =
        it.transition === "fade" || it.transition === "cut"
          ? it.transition
          : null;
      return {
        id: `${it.media_id}-${it.position}`,
        kind: it.kind,
        uri: resolveMediaUrl({ id: it.media_id, uri: it.uri }, token),
        html: it.html ?? null,
        slide_paths: it.slide_paths ?? null,
        duration_s: it.duration_ms > 0 ? it.duration_ms / 1000 : 0,
        transition,
      };
    });
    return applyDurationDefaults(mapped);
  }, [envelope, token]);

  // Browser-testing heartbeat fallback: 60s interval while the tab is visible.
  // Pi sidecar still owns production heartbeats; this just closes the gap when
  // the player is opened directly in a browser (admin QA, internal demos).
  useEffect(() => {
    if (!token) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void playerFetch<void>("/api/signage/player/heartbeat", {
        token,
        method: "POST",
        body: JSON.stringify({
          current_item_id: null,
          playlist_etag: null,
        }),
        headers: { "Content-Type": "application/json" },
        on401: clearToken,
      }).catch(() => {
        // Heartbeat failures are non-fatal for playback. Silence.
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [token, clearToken]);

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
