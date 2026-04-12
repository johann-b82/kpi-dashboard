/**
 * KpiCardGrid — dashboard KPI summary with dual-baseline delta badges.
 *
 * Implements CARD-01 (dual badges on all 3 cards) and CARD-05 (contextual
 * labels from filter scope), plus wires CARD-02/03/04 via DeltaBadge.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { differenceInDays } from "date-fns";
import { KpiCard } from "./KpiCard";
import { DeltaBadgeStack } from "./DeltaBadgeStack";
import type { DateRangeValue } from "./DateRangeFilter";
import {
  fetchKpiSummary,
  type KpiSummaryComparison,
} from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";
import { computePrevBounds } from "@/lib/prevBounds";
import { computeDelta } from "@/lib/delta";
import {
  formatPrevPeriodLabel,
  formatPrevYearLabel,
} from "@/lib/periodLabels";
import type { Preset } from "@/lib/dateUtils";

interface KpiCardGridProps {
  startDate?: string;
  endDate?: string;
  preset: Preset | null;
  range: DateRangeValue;
}

export function KpiCardGrid({
  startDate,
  endDate,
  preset,
  range,
}: KpiCardGridProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const shortLocale: "de" | "en" = i18n.language === "de" ? "de" : "en";

  const prevBounds = useMemo(
    () => computePrevBounds(preset, range),
    [preset, range.from, range.to],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: kpiKeys.summary(startDate, endDate, prevBounds),
    queryFn: () => fetchKpiSummary(startDate, endDate, prevBounds),
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const formatCount = (n: number) =>
    new Intl.NumberFormat(locale).format(n);

  // Compute contextual labels once per render (shared across all 3 cards).
  const prevPeriodStartDate = prevBounds.prev_period_start
    ? new Date(prevBounds.prev_period_start)
    : null;
  const prevYearStartDate = prevBounds.prev_year_start
    ? new Date(prevBounds.prev_year_start)
    : null;

  const rangeLengthDays =
    range.from && range.to
      ? differenceInDays(range.to, range.from) + 1
      : undefined;

  const prevPeriodLabel = formatPrevPeriodLabel(
    preset,
    prevPeriodStartDate,
    shortLocale,
    t,
    rangeLengthDays,
  );
  const prevYearLabel = formatPrevYearLabel(prevYearStartDate, shortLocale);

  const noBaselineTooltip = t("dashboard.delta.noBaselineTooltip");

  const kpiDeltas = (
    key: keyof KpiSummaryComparison,
    current: number | undefined,
  ): { prevPeriodDelta: number | null; prevYearDelta: number | null } => {
    if (current === undefined) {
      return { prevPeriodDelta: null, prevYearDelta: null };
    }
    const pp = data?.previous_period?.[key] ?? null;
    const py = data?.previous_year?.[key] ?? null;
    return {
      prevPeriodDelta: computeDelta(current, pp),
      prevYearDelta: computeDelta(current, py),
    };
  };

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

  const revenueDeltas = kpiDeltas(
    "total_revenue",
    data ? Number(data.total_revenue) : undefined,
  );
  const aovDeltas = kpiDeltas(
    "avg_order_value",
    data ? Number(data.avg_order_value) : undefined,
  );
  const ordersDeltas = kpiDeltas(
    "total_orders",
    data ? Number(data.total_orders) : undefined,
  );

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <KpiCard
          label={t("dashboard.kpi.totalRevenue.label")}
          value={data ? formatCurrency(Number(data.total_revenue)) : undefined}
          isLoading={isLoading}
          delta={
            data ? (
              <DeltaBadgeStack
                prevPeriodDelta={revenueDeltas.prevPeriodDelta}
                prevYearDelta={revenueDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel}
                prevYearLabel={prevYearLabel}
                locale={shortLocale}
                noBaselineTooltip={noBaselineTooltip}
              />
            ) : undefined
          }
        />
        <KpiCard
          label={t("dashboard.kpi.averageOrderValue.label")}
          value={
            data ? formatCurrency(Number(data.avg_order_value)) : undefined
          }
          isLoading={isLoading}
          delta={
            data ? (
              <DeltaBadgeStack
                prevPeriodDelta={aovDeltas.prevPeriodDelta}
                prevYearDelta={aovDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel}
                prevYearLabel={prevYearLabel}
                locale={shortLocale}
                noBaselineTooltip={noBaselineTooltip}
              />
            ) : undefined
          }
        />
        <KpiCard
          label={t("dashboard.kpi.totalOrders.label")}
          value={data ? formatCount(Number(data.total_orders)) : undefined}
          isLoading={isLoading}
          delta={
            data ? (
              <DeltaBadgeStack
                prevPeriodDelta={ordersDeltas.prevPeriodDelta}
                prevYearDelta={ordersDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel}
                prevYearLabel={prevYearLabel}
                locale={shortLocale}
                noBaselineTooltip={noBaselineTooltip}
              />
            ) : undefined
          }
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t("dashboard.kpi.exclusionNote")}
      </p>
    </div>
  );
}
