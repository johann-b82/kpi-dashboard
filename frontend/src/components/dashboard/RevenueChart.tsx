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
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchChartData } from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";

interface RevenueChartProps {
  startDate?: string;
  endDate?: string;
}

type ChartType = "bar" | "line";

const GRANULARITY = "monthly" as const;
const CHART_TYPES: ChartType[] = ["bar", "line"];

export function RevenueChart({ startDate, endDate }: RevenueChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const [chartType, setChartType] = useState<ChartType>("bar");

  const { data, isLoading, isError } = useQuery({
    queryKey: kpiKeys.chart(startDate, endDate, GRANULARITY),
    queryFn: () => fetchChartData(startDate, endDate, GRANULARITY),
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <p className="text-xl font-semibold">{t("dashboard.chart.title")}</p>
      <div className="flex gap-2">
        {CHART_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant={chartType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType(type)}
          >
            {t(`dashboard.chart.type.${type}`)}
          </Button>
        ))}
      </div>
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

  // Backend returns Decimal as JSON string; coerce to number for Recharts.
  const rows = (data ?? []).map((p) => ({
    date: p.date,
    revenue: Number(p.revenue),
  }));

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
              <Bar dataKey="revenue" fill="var(--color-success)" />
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
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
