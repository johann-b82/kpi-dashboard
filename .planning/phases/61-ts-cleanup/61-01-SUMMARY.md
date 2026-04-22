---
phase: 61-ts-cleanup
plan: 01
subsystem: frontend-build-hygiene
tags: [ts-cleanup, build-gate, type-safety, tech-debt]
requires: []
provides:
  - npm-run-build-green
  - zero-ts-errors-frontend
  - no-pipe-true-in-build-path
affects:
  - frontend/src/hooks/useSensorDraft.ts (public class API + internal return type)
  - frontend/src/components/ui/select.tsx (onValueChange null boundary at wrapper)
tech-stack:
  added: []
  patterns:
    - "Narrow wrapper generic + null-guard at boundary (select.tsx) instead of touching every consumer"
    - "Type-intersection at call site (SalesRow = SalesRecordRow & Record<string, unknown>) instead of rewriting useTableState generic or widening SalesRecordRow"
    - "Explicit class field + constructor assignment instead of parameter-property shorthand (erasableSyntaxOnly compliance)"
    - "Partial<SettingsUpdatePayload> return type instead of 'as SettingsUpdatePayload' cast — fixes TS2783 duplicate-key warnings without touching spread layout beyond brand-block destructure"
key-files:
  created:
    - .planning/phases/61-ts-cleanup/61-01-SUMMARY.md
  modified:
    - frontend/src/signage/pages/SchedulesPage.test.tsx
    - frontend/src/signage/components/ScheduleEditDialog.test.tsx
    - frontend/src/signage/components/ScheduleEditDialog.tsx
    - frontend/src/components/settings/PersonioCard.tsx
    - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    - frontend/src/lib/defaults.ts
    - frontend/src/hooks/useSensorDraft.ts
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/dashboard/HrKpiCharts.tsx
    - frontend/src/components/dashboard/SalesTable.tsx
decisions:
  - "select.tsx wrapper narrows @base-ui onValueChange via Omit + null-guard — keeps all 5 consumer files (PersonioCard, SnmpWalkCard ×2, PlaylistItemList, ScheduleEditDialog) passing (v: string) callbacks without modification (D-02 minimise blast radius)"
  - "SalesTable Option A (call-site intersection) over Option B (api.ts index signature) — keeps SalesRecordRow pristine for other consumers"
  - "useSensorDraft buildGlobalsPayload return type tightened from SettingsUpdatePayload to Partial<SettingsUpdatePayload> — the cast was misleading; accurate type closes TS2783 duplicate-key errors on caller spread"
  - "SensorDraftValidationError class rewritten without parameter-property shorthand; preserves public readonly key surface (erasableSyntaxOnly compliance, D-01 banned widening)"
  - "ScheduleEditDialog.test.tsx factory closes over top-level 'import * as React' — avoids adding @types/node (D-04 permitted but not needed)"
metrics:
  baseline_errors: 31
  final_errors: 0
  files_fixed: 10
  commits: 10
  duration: "7m 38s"
  completed_date: 2026-04-22
---

# Phase 61 Plan 01: TypeScript Cleanup Summary

**One-liner:** Closed 31 pre-existing TypeScript errors across 10 frontend files via mechanical type-only fixes (no behaviour changes, no test-logic changes, no `@ts-expect-error`/`as any` suppressions, no `skipLibCheck` / strict-flag weakening), unblocking `npm run build` green for v1.20 shipping.

## Error census (baseline → final)

Baseline (`npx tsc -b` at `main@f0beb2f`, 2026-04-22): **31 errors across 9 files.**

| File | Baseline | Final | Delta | Commit |
| --- | --- | --- | --- | --- |
| `src/signage/pages/SchedulesPage.test.tsx` | 3 | 0 | −3 | `6bb576f` |
| `src/signage/components/ScheduleEditDialog.test.tsx` | 1 | 0 | −1 | `a38a068` |
| `src/signage/components/ScheduleEditDialog.tsx` | 1 | 0 | −1 | `bef97e3` |
| `src/components/settings/PersonioCard.tsx` | 1 | 0 | −1 | `1980996` |
| `src/components/settings/sensors/SnmpWalkCard.tsx` | 2 | 0 | −2 | `f4a54c3` |
| `src/lib/defaults.ts` | 1 | 0 | −1 | `d626ae7` |
| `src/hooks/useSensorDraft.ts` | 8 | 0 | −8 | `a42a8a1` |
| `src/components/ui/select.tsx` | 2 | 0 | −2 | `77bba35` |
| `src/components/dashboard/HrKpiCharts.tsx` | 4 | 0 | −4 | `3fb4c5e` |
| `src/components/dashboard/SalesTable.tsx` | 8 | 0 | −8 | `62701ca` |
| **Total** | **31** | **0** | **−31** | 10 commits |

Note: per-file delta counts sum to 31 (not 22+9) because select.tsx's null-guard wrapper also collapsed a latent cascade — 5 consumer files (PersonioCard, SnmpWalkCard ×2, PlaylistItemList, ScheduleEditDialog) would have broken if I had used the naive `<Value>` generic without the Omit+null-guard at the wrapper boundary. The wrapper change absorbs that cascade in a single file.

## Commits (10 atomic, `fix(61):` prefix, D-06)

1. `6bb576f` — fix(61): SchedulesPage.test.tsx — drop unused afterEach + stale @ts-expect-error
2. `a38a068` — fix(61): ScheduleEditDialog.test.tsx — replace bare require with ES import
3. `bef97e3` — fix(61): ScheduleEditDialog.tsx — annotate onValueChange parameter
4. `1980996` — fix(61): PersonioCard.tsx — annotate v parameter
5. `f4a54c3` — fix(61): SnmpWalkCard.tsx — annotate v parameters
6. `d626ae7` — fix(61): defaults.ts — add 5 sensor_* fields to DEFAULT_SETTINGS
7. `a42a8a1` — fix(61): useSensorDraft.ts — remove parameter-property + collapse duplicate spread keys
8. `77bba35` — fix(61): select.tsx — drop unused React import + narrow Root.Props generic
9. `3fb4c5e` — fix(61): HrKpiCharts.tsx — wrap Tooltip labelFormatter + formatter for Recharts 3.8.1 signature
10. `62701ca` — fix(61): SalesTable.tsx — narrow useTableState generic via SalesRow intersection

## Gate verification

**D-07 per-file verification (`npx tsc -b` from `frontend/` after each commit):**

| After commit | Total errors | Expected |
| --- | --- | --- |
| `6bb576f` | 28 | 28 (−3) ✓ |
| `a38a068` | 27 | 27 (−1) ✓ |
| `bef97e3` | 26 | 26 (−1) ✓ |
| `1980996` | 25 | 25 (−1) ✓ |
| `f4a54c3` | 23 | 23 (−2) ✓ |
| `d626ae7` | 22 | 22 (−1) ✓ — Task 1 gate PASS |
| `a42a8a1` | 14 | 14 (−8) ✓ |
| `77bba35` | 12 | 12 (−2 direct + −8 cascade absorbed) ✓ |
| `3fb4c5e` | 8 | 8 (−4) ✓ |
| `62701ca` | 0 | 0 (−8) ✓ — Phase gate PASS |

**D-08 full-build gate:** `npm run build` from `frontend/` — `exit=0`, 0 `error TS`, `dist/player/index.html` present (post-build rename succeeded). Ran on host; container was available but its image lacks `@testing-library/*` dev deps which are required by the tsc -b pass the build invokes (pre-existing environmental drift, not a Phase 61 regression — container is for runtime-serve only, build is a host/CI concern).

**D-05 `|| true` audit:** Grep against canonical build surfaces (`frontend/package.json`, `docker-compose.yml`, `frontend/Dockerfile`, `.github/workflows/`, `.husky/`, `scripts/smoke-*.sh`) — **no matches.** No `|| true` swallows `tsc` / `vite build` / `npm run build` failures in any CI / hook / build path. D-05 satisfied by verification (no edit required).

**Suppression-directive audit (D-01/D-03):** `git grep @ts-expect-error|@ts-ignore` across `frontend/src/**/*.ts{,x}` returns **exactly 1 hit**: `frontend/src/components/ui/toggle.test.tsx:82` (deliberate runtime-assert for bad-input test). `git blame` shows authorship `dd2fd2bd` (Johann Bechtold, 2026-04-21, v1.19 Phase 54) — pre-dates Phase 61. **Zero suppressions authored by `fix(61):` commits.**

**`as any` / `as unknown as X` audit:** `git show` against each of the 10 Phase 61 commits, grepping added lines for `\b(as any|as unknown as)\b` — **zero hits.** Only narrowing casts (`as SalesRow[]`, `as [string, string]`, `as [string | null, string | null]`, `as Value`) were used, all bounded to known types inferred from surrounding code.

**Blast-radius audit (D-02):**
- `git diff 4d6570d..HEAD -- frontend/src/hooks/useTableState.ts` → **empty** ✓ (hook untouched)
- `git diff 4d6570d..HEAD -- frontend/src/lib/api.ts` → **empty** ✓ (SalesRecordRow pristine, Option A taken)

## Deviations from Plan

### Auto-fixed adaptations (not tracked as separate commits — all absorbed into the file's own `fix(61):` commit)

**1. [Rule 1 — Type Drift] select.tsx generic cascade**
- **Found during:** Task 2 Step 2
- **Issue:** Applying the plan's literal guidance (`function Select<Value>(props: SelectPrimitive.Root.Props<Value>)`) inherited `@base-ui/react`'s tightened `onValueChange: (value: Value | null, eventDetails) => void`. Five consumer files that pass `(v: string) => ...` would have broken with TS2322.
- **Fix:** Wrapped the generic with `type SelectProps<Value = string> = Omit<Root.Props<Value>, "onValueChange"> & { onValueChange?: (value: Value) => void }` and guarded the null at the wrapper (explicit `if (value !== null)` check). Zero consumer-file changes required — D-02 minimise blast radius preserved.
- **Files modified:** only `frontend/src/components/ui/select.tsx`
- **Commit:** `77bba35`

**2. [Rule 1 — Type Drift] useSensorDraft buildGlobalsPayload return type**
- **Found during:** Task 2 Step 1(b)
- **Issue:** The first pass (destructure brand block from `settingsData` + spread `...globalsBody`) did not fix TS2783 because `buildGlobalsPayload` declares return type `SettingsUpdatePayload` via `as` cast — TS saw all 8 brand keys as potentially present in `globalsBody`, flagging them as duplicate-overwritten.
- **Fix:** Tightened `buildGlobalsPayload` return from `SettingsUpdatePayload | null` to `Partial<SettingsUpdatePayload> | null` (the accurate type — only `sensor_*` fields are ever populated). Removed the misleading `as` cast. Plan called this out as fallback option.
- **Files modified:** only `frontend/src/hooks/useSensorDraft.ts`
- **Commit:** `a42a8a1`

### None of the following occurred

- No architectural changes (Rule 4 not triggered)
- No missing critical functionality added (Rule 2 not triggered — codebase was in a "broken build, correct runtime" state pre-Phase 61)
- No test assertions modified (D-03 preserved; only unused imports / stale suppressions / bare `require` removed)
- No `@ts-expect-error` / `@ts-ignore` / `as any` / `as unknown as` introduced
- No `tsconfig.app.json` / `tsconfig.json` changes (plan listed `tsconfig.app.json` as "only if strictly required" — not required)
- No `@base-ui/react` / `recharts` / any dependency version change
- No `@types/node` added (D-04 permitted but not needed — ES import at top of factory file sufficed)

## Authentication gates

None — this phase is purely local file edits and a build gate; no external services involved.

## Traceability

- **Requirement closed:** `TS-CLEANUP-01` (`npm run build` exits 0 with zero `error TS`; no `|| true` in build path).
- **Milestone context:** v1.19-MILESTONE-AUDIT tech-debt carry-forward (9 files flagged; closed in full).
- **Milestone:** v1.20 HR Date-Range Filter + TS Cleanup. Phase 61 is the second and final phase — ready for `/gsd:complete-milestone 1.20` after Phase 60 Plan 04 Task 2 (human visual-parity checkpoint) clears.

## Option A vs Option B notes

- **SalesTable:** Option A taken (call-site intersection `SalesRow = SalesRecordRow & Record<string, unknown>`). `api.ts` unchanged; `SalesRecordRow` kept pristine for downstream consumers. Concrete field types (`customer_name: string | null`, `total_value: number | null`) survive through `processed.map`.
- **useSensorDraft line 232:** Replaced parameter-property `constructor(public readonly key: string)` with explicit `readonly key: string` field declaration + `this.key = key` assignment inside constructor. Public API (`new SensorDraftValidationError(...).key`) byte-for-byte preserved.

## Self-Check: PASSED

All 10 modified files verified present:
- FOUND: `frontend/src/signage/pages/SchedulesPage.test.tsx`
- FOUND: `frontend/src/signage/components/ScheduleEditDialog.test.tsx`
- FOUND: `frontend/src/signage/components/ScheduleEditDialog.tsx`
- FOUND: `frontend/src/components/settings/PersonioCard.tsx`
- FOUND: `frontend/src/components/settings/sensors/SnmpWalkCard.tsx`
- FOUND: `frontend/src/lib/defaults.ts`
- FOUND: `frontend/src/hooks/useSensorDraft.ts`
- FOUND: `frontend/src/components/ui/select.tsx`
- FOUND: `frontend/src/components/dashboard/HrKpiCharts.tsx`
- FOUND: `frontend/src/components/dashboard/SalesTable.tsx`

All 10 commits verified on branch: `6bb576f`, `a38a068`, `bef97e3`, `1980996`, `f4a54c3`, `d626ae7`, `a42a8a1`, `77bba35`, `3fb4c5e`, `62701ca` — all FOUND.

Final gate: `cd frontend && npm run build` → `exit=0`, `grep -c 'error TS' = 0`, `dist/player/index.html` exists.
