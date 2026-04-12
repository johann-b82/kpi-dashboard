# Phase 19: Backend — Array Migration, API, and KPI Aggregation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 19-backend-array-migration-api-and-kpi-aggregation
**Areas discussed:** Column storage type, API backward compat, Multi-key KPI semantics

---

## Column Storage Type

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB (Recommended) | Already used in the codebase (raw_json column). Flexible, well-supported by SQLAlchemy, natural for JSON API responses. | ✓ |
| PostgreSQL ARRAY | Native array type. Cleaner type safety, uses ANY() for queries. Less common in this codebase. | |

**User's choice:** JSONB (Recommended)
**Notes:** Consistent with existing raw_json pattern in the codebase.

---

## API Backward Compat

| Option | Description | Selected |
|--------|-------------|----------|
| Arrays only (Recommended) | Clean break — PUT accepts arrays, GET returns arrays. Phase 20 follows immediately. No legacy callers. | ✓ |
| Accept both, return arrays | PUT accepts int\|list[int] and str\|list[str] — normalizes to array before storing. GET always returns arrays. | |

**User's choice:** Arrays only (Recommended)
**Notes:** Internal tool with no external callers — no transition period needed.

---

## Multi-key KPI Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| OR / union (Recommended) | Count absences matching ANY selected type. Employees in ANY selected department. Natural "multi-select" meaning. | ✓ |
| AND / intersection | Count matching ALL selected values. Doesn't work well for department or sick leave type (employee has one dept). | |

**User's choice:** OR / union (Recommended)
**Notes:** Widen the filter when multiple values are selected — natural multi-select behavior.

---

## Claude's Discretion

- Null vs empty array normalization in DB
- Exact Alembic migration mechanics
- Pydantic validator approach for array fields

## Deferred Ideas

None — discussion stayed within phase scope
