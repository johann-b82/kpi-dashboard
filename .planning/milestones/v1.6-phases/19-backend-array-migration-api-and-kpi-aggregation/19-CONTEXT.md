# Phase 19: Backend — Array Migration, API, and KPI Aggregation - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the 3 Personio config fields (`personio_sick_leave_type_id`, `personio_production_dept`, `personio_skill_attr_key`) from scalar DB columns to JSON arrays. Update the Settings API to accept/return arrays. Update HR KPI aggregation to filter with IN clauses instead of equality. Existing single-value rows auto-migrate to single-element arrays via Alembic.

</domain>

<decisions>
## Implementation Decisions

### Column Storage Type
- **D-01:** Use JSONB columns for all 3 array fields — consistent with existing `raw_json` JSONB column on `PersonioEmployee`. No PostgreSQL native ARRAY type.
- **D-02:** Migration uses `postgresql_using` with `jsonb_build_array()` to convert existing scalar values to single-element JSON arrays in-place.

### API Contract
- **D-03:** Clean break to arrays-only — `PUT /api/settings` accepts arrays (`list[int]` / `list[str]`), `GET /api/settings` returns arrays. No backward-compatible single-value acceptance.
- **D-04:** No external callers exist (internal tool) — no transition period needed.

### KPI Aggregation Semantics
- **D-05:** OR/union semantics for all multi-select fields — `IN` filter (any match counts). Selecting multiple sick leave types counts absences matching ANY selected type. Selecting multiple departments counts employees in ANY selected department. Selecting multiple skill keys counts employees with ANY selected attribute.
- **D-06:** `is_configured=false` when the array field is empty (`[]`) or null — matching success criteria SC-5.

### Claude's Discretion
- Null vs empty array normalization in DB (whether to collapse both to one canonical form or allow both) — Claude can decide based on what simplifies the code.
- Exact Alembic migration mechanics (single migration file vs multiple, `postgresql_using` expression details).
- Pydantic validator approach for array fields in `SettingsUpdate` schema.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — MIG-01, API-01, API-02, KPI-01, KPI-02, KPI-03, KPI-04 requirements
- `.planning/ROADMAP.md` — Phase 19 success criteria (5 items)

### Existing Implementation (must-read before modifying)
- `backend/app/models.py` — Current `AppSettings` model with scalar columns (lines 151-153)
- `backend/app/schemas.py` — `SettingsUpdate` and `SettingsRead` Pydantic schemas (lines 123-165)
- `backend/app/services/hr_kpi_aggregation.py` — KPI functions using equality filters: `_sick_leave_ratio` (line 166), `_skill_development` (line 269), `_revenue_per_production_employee` (line 293), `_headcount_at_eom` (line 83)
- `backend/app/routers/settings.py` — Settings GET/PUT endpoints
- `backend/alembic/versions/v1_3_personio_settings_columns.py` — Original migration that added these columns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **JSONB column pattern**: `PersonioEmployee.raw_json` already uses `JSONB` from `sqlalchemy.dialects.postgresql` — same import and column pattern reusable
- **Alembic migration pattern**: 9 existing migrations in `backend/alembic/versions/` — follow existing naming convention
- **`aggregate_kpi_summary` reuse**: `_revenue_per_production_employee` already calls this for revenue numerator — only denominator query changes

### Established Patterns
- **SQLAlchemy 2.0 async**: All queries use `select()` + `await session.execute()` pattern
- **Singleton settings**: `AppSettings` with `id=1` CHECK constraint, loaded via `sa_select(AppSettings).where(AppSettings.id == 1)`
- **Settings read in KPI service**: `compute_hr_kpis` loads settings once, destructures into local vars (lines 318-324)

### Integration Points
- **`_headcount_at_eom`**: Currently takes `department: str | None` — needs to accept `list[str]` and use `IN` filter instead of `==`
- **`_sick_leave_ratio`**: Currently takes `sick_leave_type_id: int` — needs `list[int]` and `IN` filter
- **`_skill_development`**: Currently takes `skill_attr_key: str` — needs `list[str]` and OR across multiple JSONB paths
- **`compute_hr_kpis`**: Destructures settings to scalars — needs to pass arrays and check `empty or null` instead of `is not None`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-backend-array-migration-api-and-kpi-aggregation*
*Context gathered: 2026-04-12*
