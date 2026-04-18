# Phase 19: Backend — Array Migration, API, and KPI Aggregation - Research

**Researched:** 2026-04-12
**Domain:** SQLAlchemy 2.0 async / Alembic migration / PostgreSQL JSONB / FastAPI Pydantic schemas / HR KPI aggregation
**Confidence:** HIGH

## Summary

Phase 19 converts three scalar settings columns (`personio_sick_leave_type_id` INT, `personio_production_dept` STRING, `personio_skill_attr_key` STRING) to JSONB array columns in the `app_settings` singleton table. All three changes are tightly coupled: the DB schema, the API schemas, the router handlers, and the KPI aggregation service must move in lockstep so the system is never in a partially-migrated state.

All the required patterns are already established in the codebase. The JSONB column pattern comes from `PersonioEmployee.raw_json`. The `postgresql_using` Alembic cast pattern is the standard way to convert a column type in-place without losing data. The SQLAlchemy `.in_()` filter is a direct replacement for `==` equality in the existing KPI queries. The only non-trivial case is `_skill_development`: multi-key JSONB path queries require Python-level `or_()` across dynamically constructed conditions, not a single `.in_()` call, because each key access is a separate SQLAlchemy JSONB subscript expression.

The `PersonioOptions` endpoint (`GET /api/settings/personio-options`) does not need changes — it already returns live absence types and departments; it does not store or return the selected values from settings. API-02 is satisfied by leaving it unchanged.

**Primary recommendation:** Implement in three sequential changes — (1) Alembic migration, (2) model + schema update, (3) KPI aggregation update — so each step is independently testable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use JSONB columns for all 3 array fields — consistent with existing `raw_json` JSONB column on `PersonioEmployee`. No PostgreSQL native ARRAY type.
- **D-02:** Migration uses `postgresql_using` with `jsonb_build_array()` to convert existing scalar values to single-element JSON arrays in-place.
- **D-03:** Clean break to arrays-only — `PUT /api/settings` accepts arrays (`list[int]` / `list[str]`), `GET /api/settings` returns arrays. No backward-compatible single-value acceptance.
- **D-04:** No external callers exist (internal tool) — no transition period needed.
- **D-05:** OR/union semantics for all multi-select fields — `IN` filter (any match counts). Selecting multiple sick leave types counts absences matching ANY selected type. Selecting multiple departments counts employees in ANY selected department. Selecting multiple skill keys counts employees with ANY selected attribute.
- **D-06:** `is_configured=false` when the array field is empty (`[]`) or null — matching success criteria SC-5.

### Claude's Discretion

- Null vs empty array normalization in DB (whether to collapse both to one canonical form or allow both) — Claude can decide based on what simplifies the code.
- Exact Alembic migration mechanics (single migration file vs multiple, `postgresql_using` expression details).
- Pydantic validator approach for array fields in `SettingsUpdate` schema.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-01 | Database migration converts the 3 scalar columns to JSON array columns, preserving existing single values as single-element arrays | Alembic `op.alter_column` with `postgresql_using` + `jsonb_build_array()` handles in-place type conversion |
| API-01 | Settings GET/PUT endpoints accept and return arrays for all 3 Personio config fields | `SettingsRead` and `SettingsUpdate` schema changes + `_build_read` router update |
| API-02 | Personio options endpoint continues to return available absence types, departments, and skill attributes | No change needed — endpoint reads live Personio data, not stored selections |
| KPI-01 | Sick leave ratio considers all selected absence type IDs (IN filter instead of equality) | `PersonioAbsence.absence_type_id.in_(sick_leave_type_ids)` replaces `==` |
| KPI-02 | Revenue per production employee considers all selected departments (IN filter instead of equality) | `PersonioEmployee.department.in_(production_depts)` in `_headcount_at_eom` |
| KPI-03 | Skill development KPI considers all selected skill attribute keys (IN filter instead of equality) | Python-level `or_()` across per-key JSONB path conditions |
| KPI-04 | Each KPI returns `is_configured=false` only when its corresponding array is empty or null | Replace `if x is not None` guard with `if x` (falsy for None and `[]`) |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| SQLAlchemy | 2.0.49 | JSONB column type, async ORM | Already in use; `JSONB` from `sqlalchemy.dialects.postgresql` |
| Alembic | 1.18.4 | Schema migration | Already in use; `op.alter_column` + `postgresql_using` |
| Pydantic v2 | bundled with FastAPI | Schema validation | Already in use; `list[int]` and `list[str]` field types |
| asyncpg | 0.31.0 | Async PG driver | Already in use; handles JSONB natively |

No new packages required. This phase is purely a refactor of existing code.

---

## Architecture Patterns

### Pattern 1: Alembic JSONB Column Type Change with `postgresql_using`

**What:** Change an existing column type using `op.alter_column` with an explicit PostgreSQL CAST expression.
**When to use:** When converting a scalar column to JSONB and data must be preserved as a single-element array.

```python
# Source: Alembic official docs + existing v1_3_personio_settings_columns.py pattern
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

def upgrade() -> None:
    # Convert INT scalar to JSONB array: e.g., 42 -> [42]
    # NULL stays NULL (jsonb_build_array(NULL) -> [null] would be wrong — handle with CASE)
    op.alter_column(
        "app_settings",
        "personio_sick_leave_type_id",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_sick_leave_type_id IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_sick_leave_type_id) END"
        ),
    )
    op.alter_column(
        "app_settings",
        "personio_production_dept",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_production_dept IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_production_dept) END"
        ),
    )
    op.alter_column(
        "app_settings",
        "personio_skill_attr_key",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_skill_attr_key IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_skill_attr_key) END"
        ),
    )

def downgrade() -> None:
    # Downgrade: extract first element back to scalar
    # JSONB ->> 0 returns the first element as text; cast appropriately
    op.alter_column(
        "app_settings",
        "personio_sick_leave_type_id",
        type_=sa.Integer(),
        postgresql_using="(personio_sick_leave_type_id->0)::int",
    )
    op.alter_column(
        "app_settings",
        "personio_production_dept",
        type_=sa.String(255),
        postgresql_using="personio_production_dept->>0",
    )
    op.alter_column(
        "app_settings",
        "personio_skill_attr_key",
        type_=sa.String(255),
        postgresql_using="personio_skill_attr_key->>0",
    )
```

**NULL handling is critical:** `jsonb_build_array(NULL)` produces `[null]`, NOT `NULL`. A CASE expression is required to preserve NULL rows as NULL. The singleton row likely has NULL in all three fields if never configured — without the CASE guard, it would become `[null]` which is truthy and not empty, breaking the `is_configured=false` logic.

### Pattern 2: SQLAlchemy JSONB Model Column

**What:** Replace `Integer` / `String` mapped columns with JSONB.

```python
# Source: existing PersonioEmployee.raw_json pattern in backend/app/models.py line 169
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

# Replace lines 151-153 in models.py:
personio_sick_leave_type_id: Mapped[list | None] = mapped_column(JSONB, nullable=True)
personio_production_dept: Mapped[list | None] = mapped_column(JSONB, nullable=True)
personio_skill_attr_key: Mapped[list | None] = mapped_column(JSONB, nullable=True)
```

### Pattern 3: Pydantic Schema — Arrays with Empty-List Support

**What:** `SettingsUpdate` and `SettingsRead` updated to use `list[int]` / `list[str]`.

The key design choice for `SettingsUpdate`: how to distinguish "caller didn't send this field" from "caller intentionally cleared it to `[]`". Since D-03 is a clean break (arrays always expected), use `list[int] | None = None` where `None` means "don't change" and `[]` means "clear to empty".

```python
# SettingsUpdate — None means "don't change", [] means "clear"
personio_sick_leave_type_id: list[int] | None = None
personio_production_dept: list[str] | None = None
personio_skill_attr_key: list[str] | None = None

# SettingsRead — always returns list (empty or populated)
personio_sick_leave_type_id: list[int] = []
personio_production_dept: list[str] = []
personio_skill_attr_key: list[str] = []
```

**`SettingsRead` default of `[]`:** When Pydantic reads from the ORM row and the JSONB column is NULL (never configured), `from_attributes=True` will yield `None`. Use a `@field_validator` or `model_validator` to normalize `None -> []`. Alternatively, use `list[int] | None = None` and document that `null` and `[]` are both "not configured" — simpler but less clean. Recommendation (Claude's discretion): normalize to `[]` in the `_build_read` helper rather than in Pydantic, since `_build_read` already does explicit field mapping.

### Pattern 4: Router — Conditional Array Assignment

**What:** Replace the existing `if payload.x is not None` guard with direct assignment (since `[]` is a valid "set" value and `None` still means "don't change").

```python
# In put_settings handler — replace existing lines 191-196:
if payload.personio_sick_leave_type_id is not None:
    row.personio_sick_leave_type_id = payload.personio_sick_leave_type_id
if payload.personio_production_dept is not None:
    row.personio_production_dept = payload.personio_production_dept
if payload.personio_skill_attr_key is not None:
    row.personio_skill_attr_key = payload.personio_skill_attr_key

# This pattern is UNCHANGED — None still means "don't touch", [] means "clear"
# The guard is identical; only the type of the assigned value changes.
```

### Pattern 5: KPI Aggregation — `is_configured` Guard Update

**What:** Replace `is not None` checks with truthiness checks (empty list is falsy).

```python
# compute_hr_kpis in hr_kpi_aggregation.py — replace lines 332, 348, 359:

# BEFORE:
if sick_type_id is not None:

# AFTER:
if sick_type_id:  # False for None and []
```

**This is the critical semantic change:** A `[]` must produce `is_configured=False`. An integer `0` would also be falsy, but `0` is not a valid absence type ID in practice. For robustness, `bool([]) == False` and `bool([42]) == True` — standard Python truthiness is sufficient.

### Pattern 6: KPI Aggregation — `IN` Filter for Sick Leave and Department

**What:** Replace equality filters with `column.in_(list)` in SQLAlchemy.

```python
# _sick_leave_ratio — replace line 166:
# BEFORE:
PersonioAbsence.absence_type_id == sick_leave_type_id,

# AFTER:
PersonioAbsence.absence_type_id.in_(sick_leave_type_ids),
```

```python
# _headcount_at_eom — replace lines 82-83:
# BEFORE:
if department is not None:
    stmt = stmt.where(PersonioEmployee.department == department)

# AFTER:
if departments:  # non-empty list
    stmt = stmt.where(PersonioEmployee.department.in_(departments))
```

**Function signature changes:**
- `_headcount_at_eom(session, last_day, department: str | None)` → `departments: list[str] | None`
- `_sick_leave_ratio(session, first_day, last_day, sick_leave_type_id: int)` → `sick_leave_type_ids: list[int]`
- `_skill_development(session, last_day, skill_attr_key: str)` → `skill_attr_keys: list[str]`
- `_revenue_per_production_employee(session, ..., production_dept: str)` → `production_depts: list[str]`

### Pattern 7: KPI Aggregation — JSONB Multi-Key `OR` for Skill Development

**What:** `_skill_development` uses JSONB subscript access. SQLAlchemy JSONB subscripts return individual column expressions — `.in_()` cannot be used across multiple JSONB path accesses. Instead, use `or_()` to combine per-key conditions.

```python
# _skill_development — replace line 269 area:
# BEFORE (single key):
PersonioEmployee.raw_json["attributes"][skill_attr_key]["value"].as_string().notin_(["null", ""]),

# AFTER (multiple keys — or_ across per-key conditions):
from sqlalchemy import or_

def _build_skill_condition(keys: list[str]):
    """Build OR condition: employee has non-null value for ANY of the skill keys."""
    return or_(*(
        PersonioEmployee.raw_json["attributes"][key]["value"].as_string().notin_(["null", ""])
        for key in keys
    ))

# In the skilled_stmt:
skilled_stmt = select(func.count(PersonioEmployee.id)).where(
    PersonioEmployee.hire_date <= last_day,
    or_(
        PersonioEmployee.termination_date.is_(None),
        PersonioEmployee.termination_date > last_day,
    ),
    PersonioEmployee.raw_json.isnot(None),
    _build_skill_condition(skill_attr_keys),
)
```

**Note:** `or_(*[...])` with an empty list raises a SQLAlchemy error (`or_()` with no arguments). The guard `if skill_key:` in `compute_hr_kpis` prevents calling `_skill_development` with an empty list — but `_skill_development` itself should also guard against it or the empty-list case should be handled before calling the helper.

### Anti-Patterns to Avoid

- **Do not use PostgreSQL native ARRAY type** — locked to JSONB (D-01). PostgreSQL `ARRAY` would require `ARRAY(Integer)` or `ARRAY(Text)` and different cast expressions in the migration.
- **Do not use `jsonb_build_array(value)` without NULL guard** — produces `[null]` instead of `NULL` for unconfigured rows, which breaks the `is_configured=false` logic.
- **Do not call `or_()` with an empty sequence** — SQLAlchemy raises `ArgumentError: or_() requires at least one argument`. Guard upstream.
- **Do not use `personio_sync_interval_h` None pattern for arrays** — the existing `if x is not None: row.x = payload.x` pattern must remain (None = don't change, `[]` = clear). Do not change this guard to `if x:` in the router — that would prevent clearing to empty array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column type conversion with data preservation | Custom UPDATE + ALTER TABLE | `op.alter_column` with `postgresql_using` | Alembic handles transactional DDL, rollback, history |
| JSON array storage | Serialize/deserialize manually | SQLAlchemy JSONB column | asyncpg maps JSONB to Python dicts/lists natively |
| Multi-value filter | Manual `WHERE x=1 OR x=2 OR x=3` | `.in_(list)` | Cleaner, avoids injection risk, SQLAlchemy handles empty list |

---

## Runtime State Inventory

**Trigger:** This is a data migration phase.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `app_settings` row id=1 — has scalar values in `personio_sick_leave_type_id` (INT), `personio_production_dept` (STRING), `personio_skill_attr_key` (STRING). Likely NULL if never configured. | Alembic migration with CASE + `jsonb_build_array()` converts in-place |
| Live service config | n/a — settings are in PostgreSQL, managed by the app | No manual step |
| OS-registered state | None — no OS-level registration of these fields | None |
| Secrets/env vars | None — these are app settings, not secrets | None |
| Build artifacts | None relevant to this rename | None |

**NULL rows:** The singleton `app_settings` row will have NULL in all three columns if Personio was never fully configured. The migration must handle NULL gracefully (CASE expression). After migration, NULL columns read as `None` in Python → normalized to `[]` in `_build_read`.

---

## Common Pitfalls

### Pitfall 1: NULL becomes `[null]` without CASE guard
**What goes wrong:** `jsonb_build_array(NULL)` in PostgreSQL returns `[null]`, a non-null JSONB value. After migration, `is_configured` would incorrectly show `true` for unconfigured rows.
**Why it happens:** `jsonb_build_array` always wraps its argument, even when NULL.
**How to avoid:** Use `CASE WHEN col IS NULL THEN NULL ELSE jsonb_build_array(col) END` in the `postgresql_using` expression.
**Warning signs:** `GET /api/settings` returns `personio_sick_leave_type_id: [null]` instead of `[]`.

### Pitfall 2: Empty `or_()` call crashes SQLAlchemy
**What goes wrong:** `or_(*[])` raises `ArgumentError: or_() requires at least one argument`.
**Why it happens:** `_skill_development` builds conditions dynamically from a list. If called with `[]`, the generator produces nothing.
**How to avoid:** The `if skill_key:` guard in `compute_hr_kpis` prevents calling `_skill_development` with empty list. Add an assertion or early return inside `_skill_development` as belt-and-braces.
**Warning signs:** 500 error from `compute_hr_kpis` when skill_attr_key is `[]`.

### Pitfall 3: Router guard change breaks "clear to empty" use case
**What goes wrong:** Changing the PUT handler guard from `if payload.x is not None` to `if payload.x:` would prevent the frontend from clearing a setting back to `[]` (empty array is falsy).
**Why it happens:** Over-applying the "empty = not configured" semantic to the router update path.
**How to avoid:** Keep the router guard as `if payload.x is not None`. The "empty = not configured" logic lives only in the KPI service and the `is_configured` flag, not in the persistence path.
**Warning signs:** `PUT /api/settings` with `{"personio_sick_leave_type_id": []}` does not clear the stored value.

### Pitfall 4: `SettingsRead` from_attributes reads None for JSONB null
**What goes wrong:** When the JSONB column contains NULL, Pydantic `from_attributes=True` sets the Python field to `None`. If the schema declares `list[int]` (not `list[int] | None`), Pydantic raises a validation error.
**Why it happens:** The migration preserves NULL for unconfigured rows.
**How to avoid:** Declare schema fields as `list[int] | None = None` or normalize in `_build_read` before constructing `SettingsRead`. The `_build_read` helper pattern is already used in `settings.py` — normalize there: `personio_sick_leave_type_id = row.personio_sick_leave_type_id or []`.
**Warning signs:** 500 error from `GET /api/settings` when Personio was never configured.

### Pitfall 5: Alembic env.py uses async engine — migration must still be sync-compatible
**What goes wrong:** The `env.py` builds the connection string using asyncpg. The `op.alter_column` with `postgresql_using` is a DDL operation — it runs synchronously inside `do_run_migrations` via `run_sync`. This is already the established pattern; no change needed.
**How to avoid:** Follow the existing migration pattern exactly. Do not add async code inside the migration file.

---

## Code Examples

### Migration — single file, all three columns

```python
# backend/alembic/versions/v1_6_array_settings_columns.py
"""v1.6 Convert Personio config columns to JSONB arrays

Converts personio_sick_leave_type_id (INT), personio_production_dept (STRING),
and personio_skill_attr_key (STRING) to JSONB columns containing arrays.
Existing scalar values are wrapped in single-element arrays.
NULL values remain NULL.

Revision ID: <generated>
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "<new_revision_id>"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "app_settings",
        "personio_sick_leave_type_id",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_sick_leave_type_id IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_sick_leave_type_id) END"
        ),
    )
    op.alter_column(
        "app_settings",
        "personio_production_dept",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_production_dept IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_production_dept) END"
        ),
    )
    op.alter_column(
        "app_settings",
        "personio_skill_attr_key",
        type_=JSONB,
        postgresql_using=(
            "CASE WHEN personio_skill_attr_key IS NULL THEN NULL "
            "ELSE jsonb_build_array(personio_skill_attr_key) END"
        ),
    )


def downgrade() -> None:
    op.alter_column(
        "app_settings",
        "personio_sick_leave_type_id",
        type_=sa.Integer(),
        postgresql_using="(personio_sick_leave_type_id->0)::int",
    )
    op.alter_column(
        "app_settings",
        "personio_production_dept",
        type_=sa.String(255),
        postgresql_using="personio_production_dept->>0",
    )
    op.alter_column(
        "app_settings",
        "personio_skill_attr_key",
        type_=sa.String(255),
        postgresql_using="personio_skill_attr_key->>0",
    )
```

### `_build_read` normalization — NULL to empty list

```python
# In settings.py _build_read:
return SettingsRead(
    ...
    personio_sick_leave_type_id=row.personio_sick_leave_type_id or [],
    personio_production_dept=row.personio_production_dept or [],
    personio_skill_attr_key=row.personio_skill_attr_key or [],
)
```

### `compute_hr_kpis` — updated guards and array destructuring

```python
# In hr_kpi_aggregation.py compute_hr_kpis:
sick_type_ids: list[int] = settings_row.personio_sick_leave_type_id or [] if settings_row else []
prod_depts: list[str] = settings_row.personio_production_dept or [] if settings_row else []
skill_keys: list[str] = settings_row.personio_skill_attr_key or [] if settings_row else []

# Guards become truthiness checks:
if sick_type_ids:     # replaces: if sick_type_id is not None
if prod_depts:        # replaces: if prod_dept is not None
if skill_keys:        # replaces: if skill_key is not None
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scalar INT/STRING settings columns | JSONB array columns | Phase 19 (this phase) | Enables multi-select for all 3 KPI filter fields |
| Equality filter in KPI queries | IN filter (`.in_()`) | Phase 19 | KPIs now aggregate over multiple selected values |
| `is not None` as "configured" check | Truthiness (`bool(list)`) | Phase 19 | Empty list correctly signals "not configured" |

---

## Open Questions

1. **Null normalization canonical form**
   - What we know: Migration preserves NULL for unconfigured rows; Python reads this as `None`; `_build_read` normalizes to `[]`
   - What's unclear: Whether to ALSO normalize in the Pydantic schema layer or only in `_build_read`
   - Recommendation (Claude's discretion): Normalize only in `_build_read` — single place, explicit, matches existing pattern for other fields in that helper. Declare `SettingsRead` fields as `list[int] | None = None` to avoid Pydantic validation errors, then normalize before constructing `SettingsRead`.

2. **`PersonioOptions` skill attributes field**
   - What we know: Current `PersonioOptions` schema only has `absence_types` and `departments` — no `skill_attributes` list. The `personio_options` endpoint fetches live from Personio API (absence types + employee departments). Skill attribute keys come from `raw_json["attributes"]` on stored employees, not from a dedicated Personio endpoint.
   - What's unclear: Does API-02 implicitly require adding skill attribute key discovery to `PersonioOptions`? The CONTEXT.md says API-02 is "Personio options endpoint continues to return available absence types, departments, and skill attributes unchanged" — the word "continues" and "unchanged" strongly imply no change is needed.
   - Recommendation: Leave `PersonioOptions` and the personio-options endpoint completely unchanged. API-02 is satisfied by non-regression — the endpoint must not break, and it won't since no code touching it is modified.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all tools are already installed and running in the project's Docker Compose stack)

---

## Validation Architecture

nyquist_validation is explicitly `false` in `.planning/config.json` — this section is omitted.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/models.py` — JSONB column pattern (line 169, `PersonioEmployee.raw_json`)
- `backend/alembic/versions/v1_3_personio_settings_columns.py` — existing migration pattern
- `backend/app/services/hr_kpi_aggregation.py` — all 4 KPI functions examined directly
- `backend/app/routers/settings.py` — settings router patterns examined directly
- `backend/app/schemas.py` — Pydantic schema patterns examined directly
- `backend/alembic/env.py` — async migration engine pattern confirmed

### Secondary (MEDIUM confidence)
- SQLAlchemy 2.0 docs: `op.alter_column` with `postgresql_using` is documented for PostgreSQL column type changes
- PostgreSQL docs: `jsonb_build_array()` behavior with NULL arguments is documented

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — all patterns are direct extensions of existing codebase code
- Pitfalls: HIGH — derived from reading the actual code paths that will be modified

**Research date:** 2026-04-12
**Valid until:** Stable — no fast-moving dependencies; valid indefinitely for this codebase
