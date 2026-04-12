import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { fetchHrKpiHistory } from "@/lib/api";

const CHART_HEIGHT = 220;

type ChartType = "area" | "bar";

interface ChartRow {
  month: string;
  below: number | null;
  above: number | null;
  value: number | null;
}

interface MiniChartProps {
  title: string;
  data: ChartRow[];
  formatValue: (v: number) => string;
  locale: string;
  chartType: ChartType;
  target: number | null;
  targetLabel: string;
}

function MiniChart({ title, data, formatValue, locale, chartType, target, targetLabel }: MiniChartProps) {
  const hasTarget = target != null;

  const formatMonth = (m: string) => {
    const d = new Date(m + "-01");
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
  };

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    fontSize: "12px",
  };

  const commonXAxis = (
    <XAxis
      dataKey="month"
      stroke="var(--color-muted-foreground)"
      tick={{ fontSize: 11 }}
      tickFormatter={formatMonth}
    />
  );

  const commonYAxis = (
    <YAxis
      stroke="var(--color-muted-foreground)"
      tick={{ fontSize: 11 }}
      tickFormatter={(v: number) => formatValue(v)}
      width={60}
    />
  );

  const tooltipFormatter = (v: number, name: string) => {
    // Only show the total value, hide the split segments
    if (name === "below" || name === "above") return [null, null];
    return [formatValue(v), title];
  };

  const targetLine = hasTarget ? (
    <ReferenceLine
      y={target}
      stroke="var(--color-destructive)"
      strokeDasharray="6 3"
      strokeWidth={1.5}
      label={{
        value: `${targetLabel}: ${formatValue(target)}`,
        position: "insideTopRight",
        fontSize: 10,
        fill: "var(--color-destructive)",
      }}
    />
  ) : null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {chartType === "area" ? (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            {commonXAxis}
            {commonYAxis}
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={formatMonth}
              formatter={hasTarget ? tooltipFormatter : (v: number) => [formatValue(v), title]}
            />
            {targetLine}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-chart-current)"
              strokeWidth={2}
              fill="var(--color-chart-current)"
              fillOpacity={0.15}
              connectNulls
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            {commonXAxis}
            {commonYAxis}
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={formatMonth}
              formatter={hasTarget ? tooltipFormatter : (v: number) => [formatValue(v), title]}
            />
            {targetLine}
            <Bar dataKey="value" fill="var(--color-chart-current)" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

export function HrKpiCharts() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const [chartType, setChartType] = useState<ChartType>("area");
  const { data: settings } = useSettings();

  const { data, isLoading } = useQuery({
    queryKey: ["hr-kpi-history"],
    queryFn: fetchHrKpiHistory,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-6 w-32 bg-muted rounded animate-pulse mb-3" />
            <div className="h-[220px] bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.length) return null;

  const formatPercent = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(v);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);

  const targetLabel = i18n.language === "de" ? "Soll" : "Target";

  const charts = [
    {
      key: "overtime_ratio" as const,
      title: t("hr.kpi.overtimeRatio.label"),
      format: formatPercent,
      target: settings?.target_overtime_ratio ?? null,
    },
    {
      key: "sick_leave_ratio" as const,
      title: t("hr.kpi.sickLeaveRatio.label"),
      format: formatPercent,
      target: settings?.target_sick_leave_ratio ?? null,
    },
    {
      key: "fluctuation" as const,
      title: t("hr.kpi.fluctuation.label"),
      format: formatPercent,
      target: settings?.target_fluctuation ?? null,
    },
    {
      key: "revenue_per_production_employee" as const,
      title: t("hr.kpi.revenuePerProductionEmployee.label"),
      format: formatCurrency,
      target: settings?.target_revenue_per_employee ?? null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SegmentedControl<ChartType>
          segments={[
            { value: "area", label: t("hr.chart.type.area") },
            { value: "bar", label: t("dashboard.chart.type.bar") },
          ]}
          value={chartType}
          onChange={setChartType}
          aria-label="Chart type"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map((chart) => {
          const chartData: ChartRow[] = data.map((p) => {
            const val = p[chart.key];
            if (chart.target == null || val == null) {
              return { month: p.month, value: val, below: null, above: null };
            }
            return {
              month: p.month,
              value: val,
              below: Math.min(val, chart.target),
              above: val > chart.target ? val - chart.target : 0,
            };
          });

          return (
            <MiniChart
              key={chart.key}
              title={chart.title}
              data={chartData}
              formatValue={chart.format}
              locale={locale}
              chartType={chartType}
              target={chart.target}
              targetLabel={targetLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
