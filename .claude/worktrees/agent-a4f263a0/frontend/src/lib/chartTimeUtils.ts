import type { ChartPoint } from "@/lib/api";

/**
 * Generate an array of YYYY-MM-01 date strings from startDate to endDate (inclusive),
 * advancing one month at a time.
 */
export function buildMonthSpine(startDate: string, endDate: string): string[] {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);

  const spine: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const mm = String(month).padStart(2, "0");
    spine.push(`${year}-${mm}-01`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return spine;
}

/**
 * Merge API data points into a spine, filling gaps with revenue: null.
 */
export function mergeIntoSpine(spine: string[], points: ChartPoint[]): ChartPoint[] {
  const map = new Map<string, number | null>();
  for (const p of points) {
    map.set(p.date.slice(0, 7), p.revenue);
  }
  return spine.map((date) => ({
    date,
    revenue: map.get(date.slice(0, 7)) ?? null,
  }));
}

/**
 * Format a YYYY-MM-DD date string as "Mon 'YY" (e.g. "Nov '25") for the given locale.
 */
export function formatMonthYear(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

/**
 * Return only the dates from the spine that fall in January (year boundary markers).
 */
export function yearBoundaryDates(spine: string[]): string[] {
  return spine.filter((d) => d.slice(5, 7) === "01");
}
