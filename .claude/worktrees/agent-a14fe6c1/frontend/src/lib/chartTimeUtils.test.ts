import { describe, it, expect } from "vitest";
import {
  buildMonthSpine,
  mergeIntoSpine,
  formatMonthYear,
  yearBoundaryDates,
} from "./chartTimeUtils";

describe("buildMonthSpine", () => {
  it("returns 6 entries from Oct 2024 to Mar 2025", () => {
    const result = buildMonthSpine("2024-10-01", "2025-03-01");
    expect(result).toEqual([
      "2024-10-01",
      "2024-11-01",
      "2024-12-01",
      "2025-01-01",
      "2025-02-01",
      "2025-03-01",
    ]);
  });

  it("returns a single entry for a single month", () => {
    expect(buildMonthSpine("2025-06-01", "2025-06-01")).toEqual(["2025-06-01"]);
  });

  it("returns entries within the same year", () => {
    const result = buildMonthSpine("2025-03-01", "2025-05-01");
    expect(result).toEqual(["2025-03-01", "2025-04-01", "2025-05-01"]);
  });
});

describe("mergeIntoSpine", () => {
  it("fills missing months with revenue: null", () => {
    const spine = ["2025-01-01", "2025-02-01", "2025-03-01"];
    const points = [
      { date: "2025-01-01", revenue: 100 },
      { date: "2025-03-01", revenue: 300 },
    ];
    expect(mergeIntoSpine(spine, points)).toEqual([
      { date: "2025-01-01", revenue: 100 },
      { date: "2025-02-01", revenue: null },
      { date: "2025-03-01", revenue: 300 },
    ]);
  });

  it("returns all nulls when points array is empty", () => {
    const spine = ["2025-01-01", "2025-02-01"];
    expect(mergeIntoSpine(spine, [])).toEqual([
      { date: "2025-01-01", revenue: null },
      { date: "2025-02-01", revenue: null },
    ]);
  });

  it("returns empty array for empty spine", () => {
    expect(mergeIntoSpine([], [{ date: "2025-01-01", revenue: 100 }])).toEqual([]);
  });
});

describe("formatMonthYear", () => {
  it("formats en-US Nov 2025 as \"Nov '25\"", () => {
    expect(formatMonthYear("2025-11-01", "en-US")).toBe("Nov '25");
  });

  it("formats en-US Jan 2025 as \"Jan '25\"", () => {
    expect(formatMonthYear("2025-01-01", "en-US")).toBe("Jan '25");
  });

  it("formats de-DE Jan 2025 as \"Jan '25\"", () => {
    // German abbreviated month for January is "Jan"
    expect(formatMonthYear("2025-01-01", "de-DE")).toBe("Jan '25");
  });
});

describe("yearBoundaryDates", () => {
  it("returns only January dates from a mixed spine", () => {
    const spine = ["2024-11-01", "2024-12-01", "2025-01-01", "2025-02-01"];
    expect(yearBoundaryDates(spine)).toEqual(["2025-01-01"]);
  });

  it("returns empty array when no January in spine", () => {
    expect(yearBoundaryDates(["2025-03-01", "2025-04-01"])).toEqual([]);
  });

  it("returns multiple January dates across years", () => {
    const spine = ["2024-01-01", "2024-06-01", "2025-01-01"];
    expect(yearBoundaryDates(spine)).toEqual(["2024-01-01", "2025-01-01"]);
  });
});
