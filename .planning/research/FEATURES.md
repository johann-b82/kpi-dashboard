# Feature Landscape

**Domain:** File-upload-to-dashboard, internal sales/revenue KPI app
**Researched:** 2026-04-10
**Confidence:** HIGH for table stakes (well-established patterns); MEDIUM for differentiators (domain-specific)

---

## Table Stakes

Features users expect. Missing = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop file upload zone | Standard UX pattern; users refuse click-only uploaders in 2026 | Low | Also needs classic "Browse" button fallback for keyboard/accessibility users |
| Accepted format enforcement | Users need immediate rejection of wrong file types with explanation | Low | Validate on client before upload: .csv, .txt, .xlsx, .xls only |
| Upload progress indicator | Without feedback, users assume the app is broken and re-click | Low | Progress bar > spinner; show row count parsed if feasible |
| Actionable parse error messages | "Import failed" is unacceptable — must specify which row/column failed and why | Medium | Fixed schema simplifies this: known columns = known validation rules |
| Upload confirmation / success state | User needs to know the data is in the system before navigating away | Low | Show row count ingested, file name, timestamp |
| Summary metric cards | First thing users look at — total revenue, avg order value, record count | Low | Static layout for fixed schema is appropriate |
| Time-series line/bar chart | Trend over time is the primary value of a KPI dashboard | Medium | Revenue over time is the canonical example; one chart minimum |
| Upload history list | Users want to know what was uploaded, when, and how many rows | Low | Table with filename, timestamp, row count, status |
| Data freshness indicator | Users need to know when data was last loaded — stale data leads to wrong decisions | Low | "Last updated: [timestamp]" on dashboard header |
| Responsive layout (desktop-first) | Internal tools must be usable on standard 1080p/1440p monitors | Low | Mobile not required, but layout should not break at desktop widths |

---

## Differentiators

Features that set the product apart. Not universally expected but meaningfully increase value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-upload drill-down | Click an upload in history → see a filtered dashboard for just that upload's data | Medium | Requires URL-based filter state; useful for comparing periods |
| Date range filter on dashboard | Filter all charts/cards to a selected date window | Medium | Depends on data having a date column; high value for revenue trending |
| Duplicate upload detection | Warn or block when a file with identical content or same filename + date is re-uploaded | Medium | Prevents accidental double-counting of revenue |
| Inline parse preview | Before committing, show first N rows of parsed data so user can verify columns mapped correctly | Medium | Especially valuable when file format varies slightly (CSV vs TXT delimiter) |
| Export filtered data as CSV | User can download the current view (filtered date range) as CSV for external reporting | Low | Trivial SQL query → CSV response; high perceived value |
| Upload deletion / rollback | Remove an erroneous upload and revert its data contribution | High | Requires soft-delete or full audit table; worth deferring unless data integrity is a key concern |
| Chart type toggle (line vs bar) | Let users switch chart style for the same metric | Low | Low effort, high polish signal |
| Metric cards with period-over-period delta | Show "+12% vs last period" on each card | Medium | Requires defining "period" (last upload? last month?); requires date column |

---

## Anti-Features

Features to explicitly NOT build in v1. Each has a reason and a "what to do instead."

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Dynamic schema detection / column mapping UI | Fixed schema was a deliberate decision — auto-detection adds complexity with no user value here | Hard-code expected column names; fail clearly if they're missing |
| Real-time data pipeline / webhooks | Overengineering for a file-upload workflow; adds infrastructure complexity | Stick to upload-on-demand; v2 can add shared folder watcher |
| Authentication and user management | Explicitly deferred to v2 (Authentik/OIDC); building custom auth now wastes time and creates a throwaway system | Ship without auth, document the Authentik integration path |
| Role-based access control (admin vs viewer) | Zero value with one internal user group and no auth | Defer with auth to v2 |
| AI/NL query interface ("Why did revenue drop?") | Not appropriate for a v1 internal tool; adds LLM dependency and latency | Surface the raw data cleanly; analysts can interpret |
| 30+ metric cards or KPI overload | Cognitive overload kills dashboard adoption — users stop looking at it | 3–7 cards maximum; curate what matters |
| Scheduled auto-ingestion | Adds cron/watcher infrastructure; v2 scope | File upload is the explicit v1 interface |
| Multi-tenant / per-user dashboards | One internal team, one data set — no segmentation needed | Single shared view is correct for this use case |
| Custom chart builder / drag-and-drop layout editor | Massive scope; not needed when schema and metrics are fixed | Static layout defined in code; change it in code when requirements change |
| Notifications / email alerts | No auth = no user identity to notify; premature for v1 | Defer until users exist in the system (post-Authentik) |
| Mobile-optimized layout | Project context explicitly states web-first, internal team | Focus on 1280px+ desktop viewport |

---

## Feature Dependencies

```
File upload zone
  → Parse validation (must validate before persisting)
  → Progress indicator (during upload/parse)
  → Confirmation / error state (after parse attempt)
  → Upload history entry created (on success)

Upload history list
  → Per-upload drill-down (optional v1 differentiator)

Dashboard metric cards
  → Aggregated query on stored data
  → Data freshness indicator (timestamp from latest upload)

Time-series chart
  → Date column in data (required — validate on upload)
  → Date range filter (optional differentiator, depends on date column)

Duplicate detection
  → Upload history (must exist to compare against)
  → File hash or filename+date fingerprint

Export as CSV
  → Filtered query (depends on date range filter if implemented)
```

---

## MVP Recommendation

For the v1 milestone as described in PROJECT.md, prioritize in this order:

1. **File upload with validation and progress** — the core interaction; nothing works without it
2. **Parse error feedback** — without this, users have no recovery path on bad files
3. **Upload confirmation + history list** — closes the loop; shows the system worked
4. **Summary metric cards (3–5 cards)** — total revenue, avg order value, total orders, date range covered
5. **Time-series chart (revenue over time)** — the primary "insight" that justifies the tool
6. **Data freshness indicator** — trivial to add; prevents trust erosion

**Recommended differentiators for v1 (low effort, high value):**
- Chart type toggle (line vs bar) — 1 hour of work, visible quality signal
- Date range filter — medium effort, but transforms the dashboard from "static report" to "interactive tool"

**Defer to v2:**
- Per-upload drill-down
- Duplicate detection
- Inline parse preview
- Export as CSV
- Upload deletion/rollback

---

## Sales/Revenue Metric Reference

Standard metrics expected in this domain, for use when defining the fixed schema and card layout:

| Metric | Formula | Chart Type | Priority |
|--------|---------|-----------|---------|
| Total Revenue | SUM(order_value) | Card + line over time | P0 |
| Average Order Value (AOV) | SUM(revenue) / COUNT(orders) | Card + bar by period | P0 |
| Total Orders | COUNT(orders) | Card | P0 |
| Revenue by Period | SUM(revenue) GROUP BY period | Line chart | P0 |
| Revenue Growth Rate | (Current - Previous) / Previous × 100 | Card delta | P1 |
| Top Products / Categories | SUM(revenue) GROUP BY product | Bar chart | P1 |
| Order Count by Period | COUNT(orders) GROUP BY period | Bar chart | P1 |

---

## Sources

- https://www.simplekpi.com/Blog/best-kpi-dashboards-2026
- https://optif.ai/media/articles/sales-metrics-dashboard-15-kpis/
- https://www.klipfolio.com/resources/dashboard-examples/sales/sales-performance
- https://uploadcare.com/blog/file-uploader-ux-best-practices/
- https://www.importcsv.com/blog/data-import-ux
- https://blog.csvbox.io/file-upload-patterns/
- https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/
- https://www.metabase.com/blog/top-5-dashboard-fails
- https://improvado.io/blog/sales-metrics
- https://www.simplekpi.com/Resources/Dashboard-Charts-And-Graphs
