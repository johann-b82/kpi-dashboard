import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { fetchChartData } from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";

interface RevenueChartProps {
  startDate?: string;
  endDate?: string;
}

const GRANULARITY = "monthly" as const;

export function RevenueChart({ startDate, endDate }: RevenueChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";

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

  if (isError) {
    return (
      <Card className="p-6">
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
        <p className="text-xl font-semibold">{t("dashboard.chart.title")}</p>
        <div className="mt-4 min-h-[400px] w-full bg-muted rounded animate-pulse" />
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
      <p className="text-xl font-semibold mb-4">
        {t("dashboard.chart.title")}
      </p>
      <div className="min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
