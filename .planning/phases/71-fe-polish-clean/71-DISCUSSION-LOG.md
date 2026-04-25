# Phase 71: FE polish + CLEAN — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 71-fe-polish-clean
**Areas discussed:** Snapshot test format, Cache purge + error normalization, Rollback depth + architecture docs, Dead-code deletion ordering

---

## Snapshot test format (FE-05)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Structure | JSON fixtures + diff (recommended) | One `.json` baseline per endpoint, deep-equal | ✓ |
| Structure | Vitest inline snapshots | `toMatchInlineSnapshot()` | |
| Structure | Zod schema parse | Shape-only contract | |
| Side | Frontend adapter-level (recommended) | Mocked Directus SDK in vitest | ✓ |
| Side | Backend integration-level | pytest against live Directus | |
| Side | Both | Belt-and-suspenders | |
| Coverage | All migrated reads (recommended) | ~9 fixtures | ✓ |
| Coverage | Only structural risk | ~5 fixtures | |
| Coverage | Reads + writes | ~15 fixtures | |
| Regen | UPDATE_SNAPSHOTS=1 (recommended) | Env var overwrites + commit-msg convention | ✓ |
| Regen | Manual fixture edit | PR review only gate | |
| Regen | Vitest --update | Only viable with inline snapshots | |

**Notes:** All recommended options selected.

---

## Cache purge + error normalization (FE-03/04)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Purge flag | Versioned key + value (recommended) | `kpi.cache_purge_v22="done"` | ✓ |
| Purge flag | Build-hash key | Per-deploy purge | |
| Purge flag | Server-driven /version | New endpoint | |
| Purge scope | Legacy `['signage', ...]` only (recommended) | Pre-Phase-65 namespace only | ✓ |
| Purge scope | Nuke all React Query cache | `queryClient.clear()` | |
| Purge scope | Legacy + sales/employees/me | Belt-and-suspenders | |
| Err norm | Central toApiError() (recommended) | Shared helper | ✓ |
| Err norm | Per-call inline | try/catch in each function | |
| Err norm | Directus middleware | SDK transport interceptor | |
| FK 409 | Inside toApiError() (recommended) | Single source of truth | ✓ |
| FK 409 | Per-endpoint reshape | Custom catch per endpoint | |
| FK 409 | Skip — no Directus DELETE today | Defer until needed | |

**Notes:** Phase 71 D-03b clarifies that today no Directus-served DELETE has FK dependents — implementation defers FK ID-reshape until first such endpoint exists.

---

## Rollback depth + architecture docs (CLEAN-03/05)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Rollback E2E | Signage golden-path (recommended) | ~10min checklist | ✓ |
| Rollback E2E | Full UAT regression | ~60min | |
| Rollback E2E | Smoke + critical paths | ~25min | |
| Runbook | operator-runbook.md (recommended) | New section in existing file | ✓ |
| Runbook | New rollback-runbook.md | Standalone | |
| Runbook | Inline in PR description | Archive-only | |
| Arch doc | ADR + README link (recommended) | docs/adr/0001-…  | ✓ |
| Arch doc | README block + arch.md prose | No ADR formalism | |
| Arch doc | Single docs/architecture.md | Prose + mermaid | |
| CI guards | Keep per-phase steps (recommended) | Add only missing guards | ✓ |
| CI guards | Consolidate into guards.sh | Refactor existing CI | |
| CI guards | Move to pre-commit hook | Local-only enforcement | |

**Notes:** D-04b clarifies pre-Phase-68 (NOT pre-Phase-65) is the rollback target — Phase 65 is schema-additive.

---

## Dead-code deletion ordering (CLEAN-01/02)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Delete order | Single-PR sweep (recommended) | One plan, atomic | ✓ |
| Delete order | Staged per-collection | 6+ commits | |
| Delete order | Routers first, then schemas/tests | 2-wave bisect-friendly | |
| Devices.py | Keep file (recommended) | Phase 70 already trimmed | ✓ |
| Devices.py | Rename to calibration.py | Cosmetic clarity | |
| Devices.py | Inline into new file | Drop devices.py entirely | |
| Smoke test | OpenAPI paths snapshot (recommended) | `app.openapi()['paths']` | ✓ |
| Smoke test | Grep against live route table | curl + grep | |
| Smoke test | Trust grep guards only | No surface assertion | |
| DB_EXCLUDE | Pytest assertion (recommended) | Code-level superset check | ✓ |
| DB_EXCLUDE | CI grep | Bash step in workflow | |
| DB_EXCLUDE | Runtime startup check | FastAPI startup hook | |

**Notes:** D-06c clarifies most deletion was already done in Phases 66–70; CLEAN-01/02 in Phase 71 is the catch-all sweep for orphans.

---

## Claude's Discretion

- ADR file numbering (0001 vs 001) — planner picks, prefers consistency.
- Whether to extract a shared tag-map diff util — planner weighs against snapshot test cleanup benefit.
- Exact set of legacy `signageKeys.*` consumers to rename — heuristic in CONTEXT.md.

## Deferred Ideas

- Optimistic updates on Directus writes
- Settings rewrite to Directus (next milestone candidate)
- Shared `replaceCollectionTagMap()` util (post-v1.22 if not done in Phase 71)
- Legacy `signageKeys.*` ad-hoc cleanup
- Backend-level snapshot tests (Directus version-drift detection)
- CI guard consolidation
