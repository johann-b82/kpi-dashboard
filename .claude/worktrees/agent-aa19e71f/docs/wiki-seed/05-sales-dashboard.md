# Sales Dashboard User Guide

The **Sales** tab (default landing page) visualizes monthly revenue, order volume, and period-over-period change from uploaded ERP exports.

## KPI cards

Four cards run across the top row:

- **Revenue** — sum of `order_total` over the selected date range.
- **Orders** — count of distinct orders.
- **Avg order value** — Revenue ÷ Orders.
- **Customers** — count of distinct customers.

Each card shows three numbers:

- **Top:** the KPI value for the selected date range.
- **Middle delta (vs. month / vs. quarter / vs. year):** percentage change vs. the corresponding prior period. Concrete labels (`vs. April 2025`, `vs. Q2 2025`) replaced the generic "vs. prev." in v1.10.
- **Bottom trend:** sparkline of the KPI across the prior 12 periods.

Deltas render green / red / neutral based on direction. Zero prior-period data renders as `—` (no delta computed from an empty baseline).

## Date-range presets

Top-right SegmentedControl exposes:

- **This month** (default)
- **Last month**
- **This quarter**
- **Last quarter**
- **YTD**
- **Custom** — opens a date picker; selected range drives every KPI card + chart.

## Chart area

The large chart below the KPI row defaults to revenue over time. Chart type toggle (line / bar) sits top-right of the chart.

- Hover tooltip shows exact value per point.
- Toggle chart type: **Line** for trend emphasis, **Bar** for monthly comparisons.
- The chart honors the global date-range selector.

## Sales table

Below the chart. One row per uploaded order. Columns: Order ID, Date, Customer, Items, Total, Status. Sortable by clicking the header. Filter input at top-right filters by customer or order ID.

## Upload flow

- **NavBar → Upload icon** navigates to `/upload`.
- Drag a CSV, TXT, or Excel file into the drop zone (or click to pick).
- After parse: the upload appears in the **Upload History** table with a row count + timestamp. The dashboard auto-refreshes; new data is immediately reflected in KPI cards and charts.
- Delete an upload from the history row to remove its rows from the DB.

## Keyboard shortcuts

- `?` — open shortcut help (if enabled in future)
- `/` — focus the sales table filter

See [[Settings Walkthrough]] for branding + appearance customization, and [[Dev Setup]] for local development.
