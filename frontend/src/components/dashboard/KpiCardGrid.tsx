/**
 * KpiCardGrid — dashboard KPI summary with dual-baseline delta badges.
 *
 * Phase 24 — delta labels unified under the shared kpi.delta.* i18n
 * namespace; allTime / custom-range presets hide the delta badge row
 * entirely (per D-12 — no em-dash, no placeholder).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import type { Preset } from "@/lib/dateUtils";

interface KpiCardGridProps {
  startDate?: string;
  endDate?: string;
  preset: Preset | null;
  range: DateRangeValue;
}

// Phase 24 D-11: granularity -> relative i18n key.
// Returns null for allTime / custom range — caller hides the badges (D-12).
function prevPeriodLabelKey(preset: Preset | null): string | null {
  if (preset === "thisMonth") return "kpi.delta.prevMonth";
  if (preset === "thisQuarter") return "kpi.delta.prevQuarter";
  if (preset === "thisYear") return "kpi.delta.prevYear";
  return null;
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

  const labelKey = prevPeriodLabelKey(preset);
  const prevPeriodLabel = labelKey ? t(labelKey) : null;
  // Per follow-up decision: keep duplicate "vs. prev. year" row on thisYear preset
  // (preserves current two-badge behavior — no conditional collapse).
  const prevYearLabel = labelKey ? t("kpi.delta.prevYear") : null;

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

  const showBadges = prevPeriodLabel !== null && prevYearLabel !== null;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <KpiCard
          label={t("dashboard.kpi.totalRevenue.label")}
          value={data ? formatCurrency(Number(data.total_revenue)) : undefined}
          isLoading={isLoading}
          delta={
            data && showBadges ? (
              <DeltaBadgeStack
                prevPeriodDelta={revenueDeltas.prevPeriodDelta}
                prevYearDelta={revenueDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel!}
                prevYearLabel={prevYearLabel!}
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
            data && showBadges ? (
              <DeltaBadgeStack
                prevPeriodDelta={aovDeltas.prevPeriodDelta}
                prevYearDelta={aovDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel!}
                prevYearLabel={prevYearLabel!}
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
            data && showBadges ? (
              <DeltaBadgeStack
                prevPeriodDelta={ordersDeltas.prevPeriodDelta}
                prevYearDelta={ordersDeltas.prevYearDelta}
                prevPeriodLabel={prevPeriodLabel!}
                prevYearLabel={prevYearLabel!}
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
