/**
 * Phase 9 — Dual-delta KPI cards.
 *
 * Pure, locale-aware secondary-label helpers for the two delta badges.
 * Implements CARD-05 (contextual secondary labels) per 09-CONTEXT.md
 * section D.
 *
 * Phase 11 routes the previously-inline short-range and generic-fallback
 * strings through the injected t() function for full DE/EN parity;
 * month-name formatting uses getLocalizedMonthName (D-04).
 *
 * This file deliberately does NOT import i18next — it stays a pure
 * utility module; callers inject t() from their own useTranslation() hook.
 */
import { subMonths } from "date-fns";
import type { DateRangeValue } from "../components/dashboard/DateRangeFilter.tsx";
import type { Preset } from "./dateUtils.ts";

const EM_DASH = "—";
const LOCALE_TAG = { de: "de-DE", en: "en-US" } as const;

export type SupportedLocale = "de" | "en";

type ChartLabelT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Phase 11 — Locale-aware month name helper (D-04).
 *
 * Wraps Intl.DateTimeFormat with a fixed year-2000 seed date to avoid
 * DST/day-boundary edge cases. Short locale codes "de"/"en" (D-03) —
 * sufficient for { month: "long" }. Coexists intentionally with the
 * module-private LOCALE_TAG regional map used by formatPrevYearLabel
 * for the Apr.-style short-month case; do NOT unify them.
 */
export function getLocalizedMonthName(
  monthIndex: number,
  locale: SupportedLocale,
): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(2000, monthIndex, 1),
  );
}

/**
 * Secondary label for the "vs. previous period" delta badge.
 *
 * @param preset           Active preset, or null for custom ranges.
 * @param prevPeriodStart  First day of the prior period; null collapses
 *                         to em-dash (thisYear / allTime / no baseline).
 * @param locale           "de" | "en".
 * @param t                i18next-compatible t() function injected by caller
 *                         (keeps this module i18next-free for testability).
 * @param rangeLengthDays  Only consulted for the custom (preset === null)
 *                         branch — used to decide between the short-range
 *                         "{N} days earlier" and the generic "Vorperiode"
 *                         / "previous period" fallback.
 */
export function formatPrevPeriodLabel(
  preset: Preset | null,
  prevPeriodStart: Date | null,
  locale: SupportedLocale,
  t: ChartLabelT,
  rangeLengthDays?: number,
): string {
  // No baseline → em-dash (thisYear, allTime, or explicit null)
  if (
    preset === "thisYear" ||
    preset === "allTime" ||
    prevPeriodStart === null
  ) {
    return EM_DASH;
  }

  // thisMonth → "vs. {MonthName}" via Intl + locale-invariant "vs." prefix
  // (D-13: "vs." is a loanword kept in DE; no new vsMonth i18n key needed).
  if (preset === "thisMonth") {
    const monthName = getLocalizedMonthName(
      prevPeriodStart.getMonth(),
      locale,
    );
    return `vs. ${monthName}`;
  }

  // thisQuarter → "vs. Q{n}" (locale-invariant per D-02)
  if (preset === "thisQuarter") {
    const q = Math.floor(prevPeriodStart.getMonth() / 3) + 1;
    return `vs. Q${q}`;
  }

  // Custom (preset === null)
  if (preset === null) {
    if (rangeLengthDays !== undefined && rangeLengthDays < 7) {
      return t("dashboard.delta.vsShortPeriod", { count: rangeLengthDays });
    }
    // Generic fallback
    return t("dashboard.delta.vsCustomPeriod");
  }

  return EM_DASH;
}

/**
 * Secondary label for the "vs. previous year" delta badge.
 *
 * Uses `Intl.DateTimeFormat(…, { month: 'short', year: 'numeric' })`
 * so DE gets the trailing period (e.g. "Apr. 2025") automatically and
 * EN gets no period ("Apr 2025").
 */
export function formatPrevYearLabel(
  prevYearStart: Date | null,
  locale: SupportedLocale,
): string {
  if (prevYearStart === null) return EM_DASH;
  const formatted = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    month: "short",
    year: "numeric",
  }).format(prevYearStart);
  return `vs. ${formatted}`;
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
