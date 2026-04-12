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
