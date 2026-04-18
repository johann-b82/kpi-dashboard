# Phase 15: HR KPI Cards & Dashboard - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The HR tab displays all 5 KPI cards with dual delta badges (vs. Vorperiode + vs. Vorjahr), backed by backend aggregation endpoints computing from Personio synced data. Handles error states, unconfigured-setting fallbacks, and no-data states. No time filter — fixed calendar month windows.

</domain>

<decisions>
## Implementation Decisions

### KPI Computation Periods
- **D-01:** Time window is **calendar month** — current month for the primary value, previous month for "vs. Vorperiode", same month last year for "vs. Vorjahr".
- **D-02:** Headcount-based denominators (Fluctuation, Rev/Emp) use **end-of-month snapshot** — count active employees as of the last day of the period.
- **D-03:** No date filter on HR tab (carried from Phase 14 D-14). Backend computes fixed calendar month windows server-side.

### Card Layout & Ordering
- **D-04:** 5 cards in a **3 + 2 grid** (`grid-cols-3` top row, 2 cards left-aligned bottom row). Matches Sales dashboard grid pattern.
- **D-05:** Top row (most prominent): Overtime Ratio, Sick Leave Ratio, Fluctuation. Bottom row: Skill Development, Revenue per Production Employee.
- **D-06:** Cards reuse the existing `KpiCard` component with `delta` slot for `DeltaBadgeStack`.

### Fallback & Edge States
- **D-07:** When Personio hasn't synced yet (no data): show all 5 cards with em-dash values and a **banner above** the grid hinting to sync first. Cards are visible but inert.
- **D-08:** When a KPI's required setting isn't configured (sick_leave_type_id, skill_attr_key, production_dept): that card shows **"nicht konfiguriert"** with a small link to Settings. Other cards render normally.
- **D-09:** When the HR KPI endpoint returns an error: show **error banner above cards** (red-tinted, matches Sales dashboard `isError` pattern) with em-dash values in all cards.
- **D-10:** Em-dash fallback for delta badges when no previous period data exists (matching Sales v1.2 pattern).

### Cross-Source KPI: Revenue per Production Employee
- **D-11:** Production department matching uses **exact string match** on `personio_production_dept` setting: `WHERE department = setting`.
- **D-12:** Revenue numerator is **total monthly revenue** from SalesRecord (`SUM(total_value) WHERE total_value > 0`), same aggregation logic as Sales dashboard.
- **D-13:** Denominator is production employee headcount at end of month (active employees in configured department).
- **D-14:** When no ERP/sales data exists: show em-dash for Rev/Emp card (per HRKPI-05 requirement).

### KPI Formulas (for reference)
- **Overtime Ratio (HRKPI-01):** overtime hours / total hours from personio_attendance for the calendar month. Overtime = attendance hours exceeding weekly_working_hours prorated to daily.
- **Sick Leave Ratio (HRKPI-02):** sick leave absence hours / total scheduled hours for the calendar month. Sick leave identified by `absence_type_id = personio_sick_leave_type_id` setting.
- **Fluctuation (HRKPI-03):** employees with termination_date in the calendar month / active headcount at end of month.
- **Skill Development (HRKPI-04):** employees with the configured skill attribute key (from raw_json) that changed value during the calendar month / total headcount. Requires `personio_skill_attr_key` setting.
- **Revenue per Production Employee (HRKPI-05):** total monthly sales revenue / production department headcount at end of month. Requires `personio_production_dept` setting and sales data.

### Claude's Discretion
- Backend endpoint structure (single `/api/hr/kpis` endpoint vs. per-KPI endpoints)
- HR KPI aggregation service module naming and internal structure
- Whether to create a dedicated `HrKpiCardGrid` component or extend the existing pattern differently
- Delta badge label text for fixed calendar month windows (e.g., "vs. Jan 2026" or "vs. Vormonat")
- Pydantic response schema design for HR KPI data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Dashboard Components (reuse for HR)
- `frontend/src/components/dashboard/KpiCard.tsx` — Reusable card with label, value, delta slot
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — Sales KPI grid pattern (useQuery, formatCurrency, delta computation)
- `frontend/src/components/dashboard/DeltaBadgeStack.tsx` — Dual delta badge component
- `frontend/src/components/dashboard/DeltaBadge.tsx` — Single delta badge with formatting
- `frontend/src/components/dashboard/deltaFormat.ts` — Delta percentage formatting utility
- `frontend/src/lib/delta.ts` — computeDelta helper (if exists)

### HR Page Shell (Phase 14 output)
- `frontend/src/pages/HRPage.tsx` — Current HR page with sync toolbar; KPI cards replace the placeholder
- `frontend/src/lib/api.ts` — fetchSyncMeta, triggerSync, SyncMetaResponse already exported
- `frontend/src/lib/queryKeys.ts` — syncKeys factory; extend with HR KPI query keys

### Backend Data Layer
- `backend/app/models.py` — PersonioEmployee, PersonioAttendance, PersonioAbsence, PersonioSyncMeta models
- `backend/app/models.py` — AppSettings with personio_sick_leave_type_id, personio_production_dept, personio_skill_attr_key
- `backend/app/services/kpi_aggregation.py` — Sales KPI aggregation pattern (SQL via SQLAlchemy, async session)
- `backend/app/routers/kpis.py` — Sales KPI endpoint pattern
- `backend/app/routers/sync.py` — GET /api/sync/meta endpoint (Phase 14)
- `backend/app/schemas.py` — Pydantic schema patterns (SyncMetaRead, SyncResult, KpiSummary)

### Prior Phase Context
- `.planning/phases/14-navigation-hr-tab-shell/14-CONTEXT.md` — Phase 14 decisions (D-05 layout, D-14 no time filter)
- `.planning/phases/12-hr-schema-personio-client/12-CONTEXT.md` — Phase 12 decisions (D-05 through D-08 table design)
- `.planning/phases/13-sync-service-settings-extension/13-CONTEXT.md` — Phase 13 sync service decisions

### Locale Files
- `frontend/src/locales/en.json` — Add HR KPI card labels and error strings
- `frontend/src/locales/de.json` — German translations for all new strings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KpiCard` component: Generic card with label/value/delta slot — directly reusable for HR KPIs
- `DeltaBadgeStack` + `DeltaBadge`: Dual delta badge rendering — reusable with HR delta values
- `deltaFormat.ts`: Percentage formatting with locale support
- `computeDelta` helper: Computes percentage change between current and baseline
- `kpi_aggregation.py`: Pattern for SQL-based KPI computation with async session
- `formatCurrency` / `formatCount` in KpiCardGrid: Intl.NumberFormat patterns to reuse

### Established Patterns
- TanStack Query `useQuery` with key factories for all data fetching
- Pydantic v2 schemas with `from_attributes` for ORM → response mapping
- SQLAlchemy 2.0 async `select()` with `func` aggregations
- Error block: `border-destructive bg-destructive/10 p-6` pattern from KpiCardGrid
- Loading skeleton: `bg-muted rounded animate-pulse` from KpiCard

### Integration Points
- `HRPage.tsx`: Replace `{t("hr.placeholder")}` with `<HrKpiCardGrid />` component
- `api.ts`: Add `fetchHrKpis()` function and `HrKpiResponse` type
- `queryKeys.ts`: Add `hrKpiKeys` factory
- `backend/app/routers/`: New HR KPI router or extend existing
- `en.json` / `de.json`: HR KPI card labels, error messages, "nicht konfiguriert" strings

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-hr-kpi-cards-dashboard*
*Context gathered: 2026-04-12*
