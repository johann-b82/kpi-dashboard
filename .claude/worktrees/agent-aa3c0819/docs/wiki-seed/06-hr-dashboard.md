# HR Dashboard User Guide

The **HR** tab visualizes headcount, attendance, and absence data synced from Personio. See [[Personio Sync Runbook]] for how the data gets there.

## Five HR KPIs

| KPI | Definition |
| --- | --- |
| **Headcount** | Active employees at period end, filtered by the included departments + employment types (see [[Settings Walkthrough]]). |
| **Sick days** | Total sick-leave days in the period across included employees. |
| **Vacation days** | Total approved vacation days in the period. |
| **Attendance hours** | Sum of attendance entries matching the included attendance types. |
| **Overtime hours** | Attendance hours beyond the per-employee Sollwert (target). |

Each KPI card follows the same layout as the Sales tab: current value + concrete delta (vs. month / quarter / year) + prior-12-period sparkline.

## Trend charts

Below the KPI cards, a 12-month chart row renders one line per KPI. Hover for exact values. The chart honors the global date-range selector in the header.

## Sollwerte (targets)

Target reference lines are drawn on the attendance + overtime charts when Sollwerte are configured. To set Sollwerte:

- **Settings → HR → Sollwerte** — enter monthly target hours per department or role.
- The chart draws the target as a dashed horizontal line; bars/points above cross into overtime territory.

## Employee table

A per-employee table appears beneath the charts. Columns: Name, Department, Employment type, Active (badge), Attendance, Sick days, Vacation days. Filter by department + employment type via the multi-select pickers above the table. Clear filters via the **Reset** button.

## Refresh cadence

- Personio sync runs every 60 minutes (configurable — see [[Personio Sync Runbook]]).
- The HR SubHeader shows **Last sync: N minutes ago**. Click **Sync now** to trigger an immediate refresh.

## Gotchas

- **Department changes:** if Personio adds/removes a department, it won't automatically be included in the filter — re-visit **Settings → HR** to pick it up.
- **Time zones:** Personio returns UTC; all displayed dates are local. Trend shape is unaffected; individual daily totals may differ by ±1 day from Personio's own dashboards.
- **Deleted employees:** KPI Dashboard soft-retains historical records for trend stability. A dismissed employee's headcount contribution ends at their termination date but their attendance remains in the historical window.
