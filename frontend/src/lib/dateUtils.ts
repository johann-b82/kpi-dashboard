import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  format,
} from "date-fns";

export type Preset = "thisMonth" | "thisQuarter" | "thisYear" | "allTime";

export function getPresetRange(preset: Preset): { from?: Date; to?: Date } {
  const now = new Date();
  switch (preset) {
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "thisQuarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "thisYear":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "allTime":
      return { from: undefined, to: undefined };
  }
}

export function toApiDate(d: Date | undefined): string | undefined {
  return d ? format(d, "yyyy-MM-dd") : undefined;
}
