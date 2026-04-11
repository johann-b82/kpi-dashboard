import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { KpiCard } from "./KpiCard";
import { fetchKpiSummary } from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";

interface KpiCardGridProps {
  startDate?: string;
  endDate?: string;
}

export function KpiCardGrid({ startDate, endDate }: KpiCardGridProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";

  const { data, isLoading, isError } = useQuery({
    queryKey: kpiKeys.summary(startDate, endDate),
    queryFn: () => fetchKpiSummary(startDate, endDate),
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const formatCount = (n: number) =>
    new Intl.NumberFormat(locale).format(n);

  if (isError) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-6">
        <p className="text-sm font-semibold">{t("dashboard.error.heading")}</p>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.error.body")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <KpiCard
          label={t("dashboard.kpi.totalRevenue.label")}
          value={data ? formatCurrency(Number(data.total_revenue)) : undefined}
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.kpi.averageOrderValue.label")}
          value={
            data ? formatCurrency(Number(data.avg_order_value)) : undefined
          }
          isLoading={isLoading}
        />
        <KpiCard
          label={t("dashboard.kpi.totalOrders.label")}
          value={data ? formatCount(Number(data.total_orders)) : undefined}
          isLoading={isLoading}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t("dashboard.kpi.exclusionNote")}
      </p>
    </div>
  );
}
