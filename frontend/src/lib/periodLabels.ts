/**
 * Phase 9 — Dual-delta KPI cards.
 *
 * Pure, locale-aware secondary-label helpers for the two delta badges.
 * Implements CARD-05 (contextual secondary labels) per 09-CONTEXT.md
 * section D.
 *
 * These helpers compose Intl.DateTimeFormat output with a small set of
 * static phrase strings ("vs. ", "Vorperiode", "days earlier", …). The
 * phrases are inline for Phase 9 so EN runtime works today; Phase 11
 * will extract them to `en.json` / `de.json` keys in the dedicated DE
 * parity pass. This file deliberately does NOT import i18next — it
 * stays a pure utility module.
 *
 * TODO(Phase 11): extract `vsPrefix`, `vsCustomPeriod`, `vsShortPeriod`
 * strings to i18n keys (see CONTEXT section D for proposed key names).
 */
import { subMonths } from "date-fns";
import type { DateRangeValue } from "../components/dashboard/DateRangeFilter.tsx";
import type { Preset } from "./dateUtils.ts";

const EM_DASH = "—";
const LOCALE_TAG = { de: "de-DE", en: "en-US" } as const;

export type SupportedLocale = "de" | "en";

/**
 * Secondary label for the "vs. previous period" delta badge.
 *
 * @param preset           Active preset, or null for custom ranges.
 * @param prevPeriodStart  First day of the prior period; null collapses
 *                         to em-dash (thisYear / allTime / no baseline).
 * @param locale           "de" | "en".
 * @param rangeLengthDays  Only consulted for the custom (preset === null)
 *                         branch — used to decide between the short-range
 *                         "{N} days earlier" and the generic "Vorperiode"
 *                         / "previous period" fallback.
 */
export function formatPrevPeriodLabel(
  preset: Preset | null,
  prevPeriodStart: Date | null,
  locale: SupportedLocale,
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

  // thisMonth → "vs. {MonthName}"
  if (preset === "thisMonth") {
    const monthName = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      month: "long",
    }).format(prevPeriodStart);
    return `vs. ${monthName}`;
  }

  // thisQuarter → "vs. Q{n}" (locale-neutral)
  if (preset === "thisQuarter") {
    const q = Math.floor(prevPeriodStart.getMonth() / 3) + 1;
    return `vs. Q${q}`;
  }

  // Custom (preset === null)
  if (preset === null) {
    if (rangeLengthDays !== undefined && rangeLengthDays < 7) {
      if (locale === "de") {
        return `vs. ${rangeLengthDays} Tage zuvor`;
      }
      // EN: special-case 1-day
      if (rangeLengthDays === 1) return "vs. 1 day earlier";
      return `vs. ${rangeLengthDays} days earlier`;
    }
    // Generic fallback
    return locale === "de" ? "vs. Vorperiode" : "vs. previous period";
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

type ChartLabelT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

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
    const fmt = new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      month: "long",
    });
    return {
      current: t("dashboard.chart.series.revenueMonth", {
        month: fmt.format(anchor),
      }),
      prior: t("dashboard.chart.series.revenueMonth", {
        month: fmt.format(subMonths(anchor, 1)),
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
