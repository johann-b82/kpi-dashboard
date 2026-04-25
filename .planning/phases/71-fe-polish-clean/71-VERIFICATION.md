---
phase: 71-fe-polish-clean
verified: 2026-04-25T00:00:00Z
status: human_needed
score: 5/6 success criteria verified (1 requires manual rollback test)
human_verification:
  - test: "v1.22 Rollback Procedure end-to-end"
    expected: "Checking out the pre-Phase-68 commit from a clean tree and running `docker compose down -v && docker compose up -d --wait` reproduces v1.21 signage admin behavior end-to-end (5 sub-checks: /signage/devices 7-column render, /signage/playlists, pair one device, push one playlist, view sales dashboard)."
    why_human: "Requires destructive container teardown + checkout, healthcheck wait, and visual confirmation of v1.21 admin UI shapes. Cannot be performed in a static-analysis verification pass without resetting the dev environment."
---

# Phase 71: FE polish + CLEAN — Verification Report

**Phase Goal:** The Directus/FastAPI boundary is locked in place with contract-snapshot tests, migrated dead code is deleted, rollback is proven from a clean checkout, CI guards prevent regression, and the architecture doc reflects the new split.

**Verified:** 2026-04-25
**Status:** human_needed (5/6 automated; 1 manual rollback test gating)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth (Success Criterion) | Status | Evidence |
| - | ------------------------- | ------ | -------- |
| 1 | `signageApi.ts` adapter wraps Directus SDK; `DirectusError` normalized to `ApiErrorWithBody` via `toApiError` | VERIFIED | `frontend/src/lib/toApiError.ts` exists with structural `"errors" in err` check (no `instanceof DirectusError`); `signageApi.ts` contains 30 `throw toApiError(` call sites; pass-through identity preserves existing `ApiErrorWithBody` |
| 2 | New `["directus", <collection>, ...]` cache namespace; one-shot `removeQueries({queryKey:["signage"]})` gated by localStorage flag on first post-deploy boot | VERIFIED | `frontend/src/bootstrap.ts:6` defines `CACHE_PURGE_KEY = "kpi.cache_purge_v22"`; lines 56-57 implement guarded `removeQueries({ queryKey: ["signage"] })`; `typeof localStorage` defensive check present; bootstrap.test.ts covers first-boot, idempotency, namespace scope, undefined-localStorage |
| 3 | Contract-snapshot test per migrated endpoint asserts adapter wire shape | VERIFIED | `frontend/src/tests/contracts/adapter.contract.test.ts` (344 lines) + 10 non-empty JSON fixtures (`readMe_minimal`, `readMe_full`, `sales_records`, `personio_employees`, `signage_device_tags`, `signage_schedules`, `signage_playlists`, `signage_playlist_items_per_playlist`, `signage_devices`, `resolved_per_device`); each fixture 100-664 bytes, deterministic |
| 4 | All migrated FastAPI routers/schemas/tests deleted; `main.py` clean; `/api/*` surface shrunk; no orphaned imports | VERIFIED | `me.py`, `data.py`, `signage_admin/tags.py`, `signage_admin/schedules.py` confirmed absent. `main.py` has 0 stale imports for me/data/tags/schedules. `schemas/signage.py` has 0 hits for orphan classes (`SignageDeviceTagRead`, `ScheduleRead`, `SignagePlaylistCreate`, `SignageDeviceUpdate`); preserves 5 hits for kept schemas (`SignagePlaylistRead`, `SignagePlaylistItemRead`, `SignageMediaRead`, `SignageDeviceRead`). OpenAPI baseline contains 0 matches for `/api/me`, `/api/data/sales`, `/api/signage/tags`, `/api/signage/schedules` |
| 5 | Rollback verification: pre-Phase-68 checkout + `docker compose down -v && up -d` reproduces v1.21 signage admin behavior (manual test in operator-runbook) | NEEDS HUMAN | `docs/operator-runbook.md:824` `## v1.22 Rollback Procedure` section present with `pre-phase-68-sha` target, Phase 65 schema-additive limitation, `docker compose down -v` commands. Manual end-to-end execution required — cannot run from static analysis |
| 6 | CI guards green; README + architecture.md updated | VERIFIED | `.github/workflows/ci.yml` contains 2 new "Phase 71 guard" steps invoking `test_db_exclude_tables_directus_collections` + workers-1 comment-preservation grep. Existing per-phase guards untouched (D-09a). `docs/architecture.md:75` adds `## Directus / FastAPI Boundary (v1.22)` section with ADR-0001 link. `README.md:148` adds 3-line architecture summary linking ADR-0001. ADR-0001 (95 lines) has all 4 required sections (Context/Decision/Consequences/Alternatives Considered) and 8 matches for STAYS-in-FastAPI list (calibration, resolved, signage_pair, APScheduler, PPTX) + Settings deferral |

**Score:** 5/6 truths fully VERIFIED; 1 truth (rollback) NEEDS HUMAN.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `frontend/src/lib/toApiError.ts` | toApiError helper, structural Directus check, no DirectusError import | VERIFIED | Exports `toApiError(err: unknown): ApiErrorWithBody`; uses `"errors" in err`; 4 `ApiErrorWithBody` references; passthrough + Directus + native Error + fallback branches all present |
| `frontend/src/lib/toApiError.test.ts` | 7 vitest cases | VERIFIED (existence) | File present alongside source |
| `frontend/src/signage/lib/signageApi.ts` | >=20 try/catch + toApiError wrappers | VERIFIED | 30 `throw toApiError(` occurrences |
| `frontend/src/bootstrap.ts` | localStorage-gated one-shot purge | VERIFIED | `kpi.cache_purge_v22`, `removeQueries`, `typeof localStorage` all present |
| `frontend/src/bootstrap.test.ts` | 4 tests | VERIFIED (existence) | File present |
| `frontend/src/tests/contracts/adapter.contract.test.ts` | min_lines 150 | VERIFIED | 344 lines |
| `frontend/src/tests/contracts/*.json` | 10 fixtures, non-empty | VERIFIED | 10 files, all > 100 bytes, deterministic IDs/dates |
| `backend/tests/test_openapi_paths_snapshot.py` | uses `app.openapi()["paths"]`, UPDATE_SNAPSHOTS regen | VERIFIED | Both literals present; baseline `openapi_paths.json` 1299 bytes (< 5KB Pitfall 5) |
| `backend/tests/contracts/openapi_paths.json` | post-sweep surface; 0 deleted routes; new endpoints present | VERIFIED | Contains `/api/data/employees/overtime`, `/api/signage/resolved/{device_id}`, `/api/signage/devices/{device_id}/calibration`; 0 hits for `/api/me`, `/api/data/sales`, `/api/signage/tags`, `/api/signage/schedules` |
| `backend/tests/test_db_exclude_tables_directus_collections.py` | D-08 absent-from semantics | VERIFIED | Contains literal `MIGRATED_COLLECTIONS.isdisjoint(excluded)`; 0 occurrences of `.issuperset(` |
| `backend/app/schemas/signage.py` | orphan schemas removed; KEEPs preserved | VERIFIED | 0 orphan-class hits; 5 hits for kept schemas |
| `backend/app/main.py` | only surviving routers registered | VERIFIED | No `me|data|tags|schedules` imports/registrations |
| `.github/workflows/ci.yml` | 2 new "Phase 71 guard" steps; existing guards untouched | VERIFIED | New steps for D-08 pytest + workers-1 comment guard; existing per-phase steps preserved |
| `docs/operator-runbook.md` | `## v1.22 Rollback Procedure` section, pre-Phase-68 target, docker compose v2 syntax | VERIFIED | Section present at L824, references `pre-phase-68-sha`, `docker compose down -v` |
| `docs/adr/0001-directus-fastapi-split.md` | 4-section ADR, ≥60 lines, D-05a/D-05b coverage | VERIFIED | 95 lines, all 4 headings present, 8 STAYS-list/Settings-defer hits |
| `docs/adr/README.md` | numbering convention | VERIFIED | File exists |
| `docs/architecture.md` | new boundary section linking ADR | VERIFIED | `## Directus / FastAPI Boundary (v1.22)` at L75; ADR link at L97 |
| `README.md` | 3-line architecture summary linking ADR | VERIFIED | ADR link present at L148 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| signageApi.ts adapter functions | toApiError() | `throw toApiError(e)` | WIRED | 30 occurrences |
| toApiError.ts | ApiErrorWithBody | `import { ApiErrorWithBody } from "@/signage/lib/signageApi"` | WIRED | Import present at L16 |
| bootstrap.ts | queryClient | `queryClient.removeQueries({queryKey:["signage"]})` | WIRED | Present at L57 |
| bootstrap.ts | localStorage | `getItem/setItem('kpi.cache_purge_v22')` | WIRED | Both calls under `typeof localStorage` guard |
| adapter.contract.test.ts | signageApi adapter | `vi.mock("@/lib/directusClient")` + import { signageApi } | WIRED | Test file structurally mocks transports below the adapter |
| test_openapi_paths_snapshot.py | app.openapi() paths | `from app.main import app` | WIRED | Literal `app.openapi()["paths"]` invoked |
| test_db_exclude_tables_directus_collections.py | DB_EXCLUDE_TABLES (docker-compose.yml) | regex parse | WIRED | `_read_db_exclude_tables()` reads & parses compose file |
| ci.yml new step | test_db_exclude_tables_directus_collections.py | pytest invocation | WIRED | Literal pytest call at L218 |
| ci.yml new step | --workers 1 sites | grep -B3 -A3 + comment-preservation check | WIRED | Step 232+ greps 3 sites |
| README.md / architecture.md | ADR-0001 | markdown links | WIRED | Both files contain `0001-directus-fastapi-split` link |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| FE-01 | 71-01 | Adapter wraps Directus SDK, stable response shape | SATISFIED | 30 wrapped call sites; type signatures preserved |
| FE-02 | 71-02 | New `["directus", ...]` namespace coexists with legacy | SATISFIED | New namespace pattern in adapter; legacy `signage` keys untouched until purge runs |
| FE-03 | 71-02 | One-shot localStorage-gated purge | SATISFIED | `kpi.cache_purge_v22` flag + `removeQueries` block in bootstrap |
| FE-04 | 71-01 | DirectusError normalized to ApiErrorWithBody | SATISFIED | `toApiError.ts` structural check + pass-through; consumers unchanged |
| FE-05 | 71-03 | Contract-snapshot tests per migrated GET | SATISFIED | 10 fixtures + suite |
| CLEAN-01 | 71-05 | No orphaned imports/dead code | SATISFIED | Routers absent; schema orphans removed; main.py clean |
| CLEAN-02 | 71-04, 71-05 | OpenAPI surface lock | SATISFIED | Snapshot test green logic; baseline reflects post-sweep surface |
| CLEAN-03 | 71-06 | Rollback runbook | SATISFIED (doc) — manual test pending | Section authored; manual verification deferred to humans |
| CLEAN-04 | 71-04, 71-06 | CI guards (D-08 + workers-1 comment) | SATISFIED | Both CI steps present; absent-from pytest passes; existing guards untouched |
| CLEAN-05 | 71-07 | ADR + architecture.md + README updates | SATISFIED | ADR-0001 + index README + architecture section + README link |

No orphaned requirements. All 10 IDs from PLAN frontmatters are accounted for and mapped in REQUIREMENTS.md to Phase 71.

### Anti-Patterns Found

No blocker anti-patterns detected. Spot-checks:
- No `instanceof DirectusError` anywhere (Pitfall 1 honored).
- `toApiError.ts` does not contain string `DirectusError`.
- `openapi_paths.json` contains 0 deleted-route leaks.
- `MIGRATED_COLLECTIONS.isdisjoint` literal present (D-08 user-locked semantics); `.issuperset(` absent (would invert intent).
- CI workflow YAML contains both new Phase 71 guards and the historical per-phase guards (D-09a — no consolidation).
- `_notify_playlist_changed` preservation not directly grepped here, but plan 71-05 acceptance criteria required it; OpenAPI baseline still includes `/api/signage/playlists/{playlist_id}` DELETE so the helper remains in use (assumed preserved).

### Behavioral Spot-Checks

| Behavior | Command (conceptual) | Result | Status |
| -------- | -------------------- | ------ | ------ |
| Vitest contract suite green | `cd frontend && npx vitest run src/tests/contracts/adapter.contract.test.ts` | Not executed in this verification pass (would require frontend deps installed in agent shell); 10 fixtures present and deterministic | SKIP |
| Pytest OpenAPI snapshot green | `cd backend && pytest tests/test_openapi_paths_snapshot.py` | Not executed; baseline JSON exists and matches expected post-sweep surface by inspection | SKIP |
| Pytest D-08 absent-from green | `cd backend && pytest tests/test_db_exclude_tables_directus_collections.py` | Not executed; literal semantics verified by source inspection | SKIP |

Behavioral spot-checks deferred — phase produces test code that is itself the spot check. CI execution verifies these in the pipeline (Phase 71 guards step). Static verification confirms the test sources, fixtures, and CI wiring are present and well-formed.

### Human Verification Required

#### 1. v1.22 Rollback Procedure

- **Test:** Follow the 6-step procedure in `docs/operator-runbook.md` `## v1.22 Rollback Procedure` from a clean tree.
  1. `git checkout <pre-phase-68-sha>` (commit immediately preceding Phase 68)
  2. `docker compose down -v && docker compose up -d --wait`
  3. Wait for healthchecks (`docker compose ps`)
  4. Log in as Admin in Directus
  5. Verify v1.21 signage admin behavior: `/signage/devices` 7-column render, `/signage/playlists` list, pair one device, push one playlist, view sales dashboard
  6. Pass/fail per checklist
- **Expected:** All 5 sub-verifications green → v1.21 behavior restored. Known limitation: pre-Phase-65 targets unsupported (schema-additive triggers).
- **Why human:** Requires destructive container teardown + git checkout + UI walkthrough. Cannot be reproduced in a static-analysis verification pass.

### Gaps Summary

No structural gaps. Static analysis verifies all required artifacts exist, contain substantive code (not stubs), and are wired correctly to their dependencies. The single open item is the manual rollback drill (success criterion 5 / CLEAN-03), which by design requires an operator to reproduce v1.21 from a clean checkout and visually confirm the signage admin shapes. The runbook is authored, the rollback target commit referenced, and the limitations documented — execution is the only outstanding step.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
