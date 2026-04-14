/**
 * Chart series label helper for RevenueChart.
 *
 * Phase 24 — stripped of the dual-delta badge formatters (formatPrevPeriodLabel,
 * formatPrevYearLabel) after those consumers migrated to the shared
 * kpi.delta.* i18n namespace. `formatChartSeriesLabel` remains because
 * RevenueChart.tsx still consumes it for its two-series legend.
 *
 * This file deliberately does NOT import i18next — it stays a pure
 * utility module; callers inject t() from their own useTranslation() hook.
 */
import { subMonths } from "date-fns";
import type { DateRangeValue } from "../components/dashboard/DateRangeFilter.tsx";
import type { Preset } from "./dateUtils.ts";

type SupportedLocale = "de" | "en";

type ChartLabelT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Locale-aware month name helper.
 *
 * Wraps Intl.DateTimeFormat with a fixed year-2000 seed date to avoid
 * DST/day-boundary edge cases.
 */
export function getLocalizedMonthName(
  monthIndex: number,
  locale: SupportedLocale,
): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(2000, monthIndex, 1),
  );
}

export interface ChartSeriesLabels {
  current: string;
  prior: string;
}

/**
 * Phase 10 — contextual legend labels for RevenueChart's two series.
 *
 * Returns `{ current, prior }` strings resolved via the injected
 * `t()` function (keeps this file i18next-free — caller passes
 * `t` from its own useTranslation() hook). Locale is needed for
 * month-name formatting via Intl.DateTimeFormat.
 *
 * Decision table (CONTEXT §C D-10):
 *   thisMonth   → "Revenue April" / "Revenue March"
 *   thisQuarter → "Revenue Q2"    / "Revenue Q1"    (Q1 rolls to Q4)
 *   thisYear    → "Revenue 2026"  / "Revenue 2025"
 *   allTime     → "Revenue"       / ""  (prior empty — overlay suppressed)
 */
export function formatChartSeriesLabel(
  preset: Preset,
  range: DateRangeValue,
  locale: SupportedLocale,
  t: ChartLabelT,
): ChartSeriesLabels {
  const anchor = range.to ?? new Date();

  if (preset === "thisMonth") {
    return {
      current: t("dashboard.chart.series.revenueMonth", {
        month: getLocalizedMonthName(anchor.getMonth(), locale),
      }),
      prior: t("dashboard.chart.series.revenueMonth", {
        month: getLocalizedMonthName(subMonths(anchor, 1).getMonth(), locale),
      }),
    };
  }

  if (preset === "thisQuarter") {
    const currentQ = Math.floor(anchor.getMonth() / 3) + 1;
    const priorQ = currentQ === 1 ? 4 : currentQ - 1;
    return {
      current: t("dashboard.chart.series.revenueQuarter", {
        quarter: currentQ,
      }),
      prior: t("dashboard.chart.series.revenueQuarter", {
        quarter: priorQ,
      }),
    };
  }

  if (preset === "thisYear") {
    const currentYear = anchor.getFullYear();
    const priorYear = currentYear - 1;
    return {
      current: t("dashboard.chart.series.revenueYear", {
        year: currentYear,
      }),
      prior: t("dashboard.chart.series.revenueYear", {
        year: priorYear,
      }),
    };
  }

  // preset === "allTime"
  return {
    current: t("dashboard.chart.series.revenue"),
    prior: "",
  };
}
