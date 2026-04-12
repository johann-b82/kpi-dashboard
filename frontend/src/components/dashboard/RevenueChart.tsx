import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fetchChartData } from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";
import { selectComparisonMode } from "@/lib/chartComparisonMode";
import { computePrevBounds } from "@/lib/prevBounds";
import { formatChartSeriesLabel } from "@/lib/periodLabels";
import type { Preset } from "@/lib/dateUtils";
import type { DateRangeValue } from "@/components/dashboard/DateRangeFilter";

interface RevenueChartProps {
  startDate?: string;
  endDate?: string;
  preset: Preset;
  range: DateRangeValue;
}

type ChartType = "bar" | "line";

const GRANULARITY = "monthly" as const;
const CHART_TYPES: ChartType[] = ["bar", "line"];

export function RevenueChart({
  startDate,
  endDate,
  preset,
  range,
}: RevenueChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const i18nLocale: "de" | "en" = i18n.language === "de" ? "de" : "en";
  const [chartType, setChartType] = useState<ChartType>("bar");

  // Phase 10: derive comparison mode + prev bounds before the query so
  // both inputs flow into the cache key (SC5 lock-step with KPI cards).
  const mode = selectComparisonMode(preset);
  const prevBounds = computePrevBounds(preset, range);
  const prevStart =
    mode === "previous_period"
      ? prevBounds.prev_period_start
      : mode === "previous_year"
        ? prevBounds.prev_year_start
        : undefined;
  const prevEnd =
    mode === "previous_period"
      ? prevBounds.prev_period_end
      : mode === "previous_year"
        ? prevBounds.prev_year_end
        : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: kpiKeys.chart(
      startDate,
      endDate,
      GRANULARITY,
      mode,
      prevStart,
      prevEnd,
    ),
    queryFn: () =>
      fetchChartData(
        startDate,
        endDate,
        GRANULARITY,
        mode,
        prevStart,
        prevEnd,
      ),
  });

  const labels = formatChartSeriesLabel(preset, range, i18nLocale, t);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <p className="text-xl font-semibold">{t("dashboard.chart.title")}</p>
      <SegmentedControl
        segments={CHART_TYPES.map((type) => ({
          value: type,
          label: t(`dashboard.chart.type.${type}`),
        }))}
        value={chartType}
        onChange={(type) => setChartType(type)}
        aria-label="Chart type"
      />
    </div>
  );

  if (isError) {
    return (
      <Card className="p-6">
        {Header}
        <p className="text-sm font-semibold">{t("dashboard.error.heading")}</p>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.error.body")}
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        {Header}
        <div className="min-h-[400px] w-full bg-muted rounded animate-pulse" />
      </Card>
    );
  }

  // Phase 10: merge current + previous into a single rows array
  // keyed by positional index (Phase 8 CHART-01 alignment contract).
  // Null handling: current always numeric; prior may be null per
  // bucket (CHART-03) — Number(null) would produce a fabricated
  // zero bar/line, so we preserve null explicitly.
  const currentPoints = data?.current ?? [];
  const prevPoints = data?.previous ?? null;
  const rows = currentPoints.map((p, i) => {
    const priorRaw = prevPoints ? (prevPoints[i]?.revenue ?? null) : null;
    return {
      date: p.date,
      revenue: p.revenue === null ? null : Number(p.revenue),
      revenuePrior:
        prevPoints === null
          ? undefined
          : priorRaw === null
            ? null
            : Number(priorRaw),
    };
  });

  const showPrior =
    mode !== "none" && data?.previous !== null && data?.previous !== undefined;

  return (
    <Card className="p-6">
      {Header}
      <div className="min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height={400}>
          {chartType === "bar" ? (
            <BarChart
              data={rows}
              margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                }}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Legend />
              <Bar
                dataKey="revenue"
                fill="var(--color-chart-current)"
                name={labels.current}
              />
              {showPrior && (
                <Bar
                  dataKey="revenuePrior"
                  fill="var(--color-chart-prior)"
                  name={labels.prior}
                />
              )}
            </BarChart>
          ) : (
            <LineChart
              data={rows}
              margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                }}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-chart-current)"
                strokeWidth={2}
                dot={false}
                name={labels.current}
              />
              {showPrior && (
                <Line
                  type="monotone"
                  dataKey="revenuePrior"
                  stroke="var(--color-chart-prior)"
                  strokeWidth={2}
                  dot={false}
                  name={labels.prior}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
