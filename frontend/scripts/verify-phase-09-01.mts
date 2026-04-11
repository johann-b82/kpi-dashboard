#!/usr/bin/env node
// Phase 9 Plan 01 — pure-function verification script.
//
// Run:
//   node --experimental-strip-types frontend/scripts/verify-phase-09-01.mts
//
// This file is intentionally a throwaway/bridge: no vitest or jest is
// installed (see 09-01-PLAN.md test_strategy). We assert with plain
// `throw` + a small helper. Exit code 0 on success.

import { computeDelta } from "../src/lib/delta.ts";
import { computePrevBounds } from "../src/lib/prevBounds.ts";

function assertEq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`[FAIL] ${label}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// ────────────────────────────────────────────────────────────────
// Task 1: computeDelta
// ────────────────────────────────────────────────────────────────
assertEq(computeDelta(110, 100), 0.1, "computeDelta(110, 100) === 0.1");
assertEq(
  Number(computeDelta(90, 100)?.toFixed(10)),
  -0.1,
  "computeDelta(90, 100) === -0.1",
);
assertEq(computeDelta(0, 100), -1, "computeDelta(0, 100) === -1");
assertEq(computeDelta(100, null), null, "computeDelta(100, null) === null");
assertEq(computeDelta(100, 0), null, "computeDelta(100, 0) === null");
assertEq(computeDelta(0, 0), null, "computeDelta(0, 0) === null");

// ────────────────────────────────────────────────────────────────
// Task 1: computePrevBounds
// ────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-04-11T12:00:00Z");

assertEq(
  computePrevBounds("thisMonth", {}, TODAY),
  {
    prev_period_start: "2026-03-01",
    prev_period_end: "2026-03-11",
    prev_year_start: "2025-04-01",
    prev_year_end: "2025-04-11",
  },
  "computePrevBounds thisMonth @ 2026-04-11",
);

assertEq(
  computePrevBounds("thisQuarter", {}, TODAY),
  {
    prev_period_start: "2026-01-01",
    prev_period_end: "2026-01-11",
    prev_year_start: "2025-04-01",
    prev_year_end: "2025-04-11",
  },
  "computePrevBounds thisQuarter @ 2026-04-11",
);

assertEq(
  computePrevBounds("thisYear", {}, TODAY),
  {
    prev_year_start: "2025-01-01",
    prev_year_end: "2025-04-11",
  },
  "computePrevBounds thisYear @ 2026-04-11 (prev_period collapsed)",
);

assertEq(
  computePrevBounds("allTime", {}, TODAY),
  {},
  "computePrevBounds allTime → {}",
);

assertEq(
  computePrevBounds(
    null,
    {
      from: new Date("2026-04-01T00:00:00"),
      to: new Date("2026-04-07T00:00:00"),
    },
    TODAY,
  ),
  {
    prev_period_start: "2026-03-25",
    prev_period_end: "2026-03-31",
    prev_year_start: "2025-04-01",
    prev_year_end: "2025-04-07",
  },
  "computePrevBounds custom 7-day window",
);

console.log("09-01 Task 1 assertions passed");
