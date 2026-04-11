# Phase 3: Dashboard Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-dashboard-frontend
**Areas discussed:** Navigation & page layout, KPI metric definitions, Chart time granularity, Date filter UX

---

## Navigation & Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top navigation bar | Horizontal nav with Dashboard/Upload links, requires router | ✓ |
| Tab-style layout | Single page with tab switching, no router needed | |
| Sidebar navigation | Left sidebar with nav links, scales for more pages | |
| Dashboard-first with upload as modal/drawer | Dashboard only page, upload opens as overlay | |

**User's choice:** Top navigation bar
**Notes:** None

### Follow-up: Landing page

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard | Users come here to see KPIs most of the time | ✓ |
| Upload page | Users need to upload data first | |
| You decide | Claude picks | |

**User's choice:** Dashboard

### Follow-up: Nav bar contents

| Option | Description | Selected |
|--------|-------------|----------|
| Just page links + language toggle | Minimal, clean | |
| Add data freshness indicator in nav bar | "Last updated" visible on every page | ✓ |
| You decide | Claude picks | |

**User's choice:** Data freshness indicator in the nav bar

---

## KPI Metric Definitions

### Revenue definition

| Option | Description | Selected |
|--------|-------------|----------|
| Sum of total_value for all orders | Includes zero-value orders | |
| Sum of total_value excluding zero-value orders | Filters out total_value = 0 | ✓ |
| Something else | Different definition | |

**User's choice:** Exclude zero-value orders

### Average order value

| Option | Description | Selected |
|--------|-------------|----------|
| Mean of total_value where total_value > 0 | Consistent with revenue filter | ✓ |
| Median instead of mean | Less sensitive to outliers | |
| You decide | Claude picks | |

**User's choice:** Mean, consistent with revenue exclusion

### Additional metric cards

| Option | Description | Selected |
|--------|-------------|----------|
| Just the three required | Total revenue, avg order value, total orders | ✓ |
| Add total remaining value | Sum of remaining_value | |
| Add customer count | Distinct customer_id count | |
| Something else | Other metrics | |

**User's choice:** Just the three required

---

## Chart Time Granularity

### Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly bars | Fixed monthly aggregation | |
| User-selectable granularity | Toggle daily/weekly/monthly | ✓ |
| Auto-scale based on date range | Automatic based on range width | |
| You decide | Claude picks | |

**User's choice:** User-selectable (daily/weekly/monthly)

### Chart type

| Option | Description | Selected |
|--------|-------------|----------|
| Bar chart | Discrete time buckets | |
| Line chart | Trend/flow over time | |
| Toggle between bar and line | User chooses; pulls DASH-05 from v2 | ✓ |
| You decide | Claude picks | |

**User's choice:** Toggle (pulls DASH-05 from v2 into v1)

### Default chart type

| Option | Description | Selected |
|--------|-------------|----------|
| Bar chart | Clearer for discrete periods | |
| Line chart | Shows trend direction immediately | ✓ |
| You decide | Claude picks | |

**User's choice:** Line chart as default

---

## Date Filter UX

### Picker type

| Option | Description | Selected |
|--------|-------------|----------|
| Preset quick ranges only | Buttons like "Last 30 days," limited flexibility | |
| Calendar date picker only | Two date inputs with calendar popover | |
| Both presets and calendar picker | Quick ranges plus custom range option | ✓ |
| You decide | Claude picks | |

**User's choice:** Both presets and calendar

### Default date range

| Option | Description | Selected |
|--------|-------------|----------|
| All time | Show everything uploaded | |
| Current year | Scoped to this calendar year | ✓ |
| Last 12 months (rolling) | Trailing year regardless of calendar | |
| You decide | Claude picks | |

**User's choice:** Current year

### Preset ranges

| Option | Description | Selected |
|--------|-------------|----------|
| Standard: This month, This quarter, This year, All time | Four presets | ✓ |
| Extended: add Last 30 days, Last 12 months | Six presets | |
| You decide | Claude picks | |

**User's choice:** Standard four presets

---

## Claude's Discretion

- Router library choice
- Calendar date picker component
- Granularity toggle UI style
- Chart type toggle UI style
- API endpoint design for KPI queries
- Responsive breakpoint strategy (INFR-03)
- Quick-range button placement relative to calendar picker

## Deferred Ideas

- DASH-06: Period-over-period deltas (v2)
- DASH-07: Export filtered data as CSV (v2)
- DASH-08: Per-upload drill-down view (v2)
- Additional metric cards (remaining value, customer count) — explicitly excluded from v1
