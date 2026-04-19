import type { PrevBounds } from "./prevBounds.ts";
import type { ComparisonMode } from "./chartComparisonMode.ts";

export const kpiKeys = {
  all: ["kpis"] as const,
  /**
   * Phase 9: the cache key now embeds prev bounds so TanStack Query
   * invalidates whenever the user changes preset or custom range. The
   * `prev` argument is optional so existing v1.1 callers continue to
   * compile; plan 09-03 upgrades KpiCardGrid to pass it.
   */
  summary: (start?: string, end?: string, prev?: PrevBounds) =>
    ["kpis", "summary", { start, end, prev }] as const,
  /**
   * Phase 10: embed comparison mode + prev bounds so TanStack Query
   * invalidates whenever the user changes preset or the derived prior
   * window shifts. Lock-step with KpiCardGrid's summary key (SC5).
   */
  chart: (
    start: string | undefined,
    end: string | undefined,
    granularity: string,
    comparison?: ComparisonMode,
    prevStart?: string,
    prevEnd?: string,
  ) =>
    [
      "kpis",
      "chart",
      { start, end, granularity, comparison, prevStart, prevEnd },
    ] as const,
  latestUpload: () => ["kpis", "latest-upload"] as const,
};

export const syncKeys = {
  meta: () => ["sync", "meta"] as const,
};

export const hrKpiKeys = {
  all: () => ["hr", "kpis"] as const,
};

/**
 * Phase 39 — sensor query keys. `readings` embeds the hours window so TanStack
 * Query invalidates automatically when the SegmentedControl changes.
 */
export const sensorKeys = {
  all: ["sensors"] as const,
  list: () => ["sensors", "list"] as const,
  readings: (sensorId: number, hours: number) =>
    ["sensors", "readings", { sensorId, hours }] as const,
  status: () => ["sensors", "status"] as const,
};

/**
 * Phase 46 — signage admin query keys. Mirrors sensorKeys shape.
 * media()/playlists()/devices()/tags() are the top-level collections.
 * Item-level keys embed the id for per-row invalidation (e.g. PPTX polling).
 */
export const signageKeys = {
  all: ["signage"] as const,
  media: () => ["signage", "media"] as const,
  mediaItem: (id: string) => ["signage", "media", id] as const,
  playlists: () => ["signage", "playlists"] as const,
  playlistItem: (id: string) => ["signage", "playlists", id] as const,
  devices: () => ["signage", "devices"] as const,
  tags: () => ["signage", "tags"] as const,
};
