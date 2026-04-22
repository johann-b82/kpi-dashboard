# Phase 58: Sensors Layout Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 58-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 58-sensors-layout-parity
**Areas discussed:** Time-window state placement, SubHeader slot layout, Visibility & pattern reuse, PollNow appearance in SubHeader

---

## Time-window state placement

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap App.tsx | Hoist provider to app root; always-mounted; single source of truth. | ✓ |
| Conditional layout wrapper for /sensors | Scoped wrapper; restructures global SubHeader. | |
| Move state to small Zustand/global store | Refactor; inconsistent with existing Context patterns. | |

**User's choice:** Wrap App.tsx (Recommended)
**Notes:** Tiny always-on context (5-element string state) is acceptable.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep state-only | Matches DateRangeFilter on /sales; no URL sync. | ✓ |
| Add ?window= URL sync | Shareable deep links; new wouter useSearch wiring. | |

**User's choice:** Keep state-only (Recommended)
**Notes:** No need for shareable /sensors links right now.

---

## SubHeader slot layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left slot | Mirrors /sales DateRangeFilter; convention "scope left, action+status right". | ✓ |
| Center slot | Visually balanced; introduces new SubHeader pattern. | |

**User's choice:** Left slot (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Jetzt messen → Freshness | Action then status; matches refresh-button conventions. | ✓ |
| Freshness → Jetzt messen | Status then action. | |

**User's choice:** Jetzt messen → Freshness (Recommended)

---

## Visibility & pattern reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Render only on /sensors | Reuses D-07 per-route conditional. | ✓ |
| Render on /sensors + /settings/sensors prefix | Anticipates future surfaces. | |

**User's choice:** Render only on /sensors (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| KPI cards + chart only | Strict reading of SENSORS-03; controls row deleted. | ✓ |
| Keep empty spacer | Reserves vertical space; unnecessary. | |

**User's choice:** KPI cards + chart only (Recommended)

---

## PollNow appearance in SubHeader

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + label, size=sm | Refresh icon + text; Phase 55 Button h-8; spinner replaces icon during loading. | ✓ |
| Icon-only ghost button | Smallest footprint; loses text safety for action-y button. | |
| Text-only button | Current look; loses loading visual signal. | |

**User's choice:** Icon + label, size=sm (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Disable + spinner in place | Loader2 swap, button disabled; matches existing PollNowButton behavior. | ✓ |
| Inline status text alongside | More feedback; fights freshness indicator for space. | |

**User's choice:** Disable + spinner in place (Recommended)

---

## Claude's Discretion

- Exact lucide icon for "Jetzt messen" (RefreshCw / Play / Activity / Zap)
- Whether to extract a SubHeader-specific PollNowButton wrapper or thread size prop
- Whether to keep or remove `pt-4` spacer on the (now slimmer) SensorsPage body

## Deferred Ideas

- URL sync for sensor time window (?window=)
- Future /settings/sensors SubHeader treatment
- Mobile (<sm) responsive sweep — defer to Phase 59
- "Polling…" inline status text in right slot
