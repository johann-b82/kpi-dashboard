export const kpiKeys = {
  all: ["kpis"] as const,
  summary: (start?: string, end?: string) =>
    ["kpis", "summary", { start, end }] as const,
  chart: (
    start: string | undefined,
    end: string | undefined,
    granularity: string,
  ) => ["kpis", "chart", { start, end, granularity }] as const,
  latestUpload: () => ["kpis", "latest-upload"] as const,
};
