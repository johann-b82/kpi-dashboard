# Phase 61: TS Cleanup — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** Fast path — scope derived from ROADMAP.md Phase 61 block + `npm run build` error list captured 2026-04-22 against `main@0a567bd`

## Goal

`npm run build` exits 0 with **zero** `error TS` lines in the frontend build output. No `|| true` fallback. Remove the `|| true` from any CI step that currently swallows TS failures.

Concretely: the 31 errors listed in `<errors>` below all resolve, no new errors appear, no runtime behaviour changes, no test logic changes.

## Why now

Pre-existing debt accumulated across v1.17 / v1.18 / v1.19. Flagged in the v1.19 milestone audit as carry-forward. Bundled into v1.20 alongside Phase 60 so we can ship `npm run build` green.

## Locked decisions

### D-01: No behaviour changes
Cleanup is mechanical / typing-only. No runtime semantics change. No refactor for its own sake. If a fix requires changing behaviour, **stop and escalate** — the scope says type-level only.

### D-02: Minimise blast radius
Where a type tightening forces a downstream change (e.g. `useTableState` generic constraint on `SalesRecordRow`), prefer **adding an index signature to the row type** or **constraining the generic with a broader shape** over rewriting the hook's API. Change the fewest files possible.

### D-03: No test-logic changes
Test hygiene errors (unused imports, stale `@ts-expect-error`, bare `require()`) are fixed in place. Do not rewrite tests, do not re-assert, do not change what is covered.

### D-04: `@types/node` is acceptable
If the `require()` fix is cleaner with `@types/node` added to devDependencies than with a rewrite, take the dependency. Document in SUMMARY.

### D-05: Drop `|| true` fallback
Final task of the phase: grep for `tsc || true` / `npm run build || true` / similar patterns in `package.json`, `Dockerfile`, CI scripts, pre-commit hooks. Remove them so the gate actually enforces. If none exist, confirm in SUMMARY.

### D-06: Atomic commits per file
One commit per file touched, prefixed `fix(61): <filename>` — keeps git-bisect clean if a change regresses behaviour in a way types don't catch.

### D-07: Verify after every file
After each per-file fix: run `npx tsc --noEmit` (NOT full build, faster) and confirm the error count drops by exactly the expected number. If a fix introduces new errors, revert and re-approach.

### D-08: Full-build gate at phase end
Phase is not complete until `npm run build` exits 0 in a clean container — `docker compose exec -T frontend npm run build` (or equivalent). Not just `tsc --noEmit` — the Vite build step must pass too (catches things like missing entry-point types).

## Claude's discretion

- Whether `useSensorDraft.ts` line 232 is `const enum` / `namespace` / decorator — inspect and pick the minimal fix.
- For the duplicate spread keys (lines 434–440), decide whether to collapse the duplicated `...spread` or remove the inner overrides. Evidence should guide which side is stale.
- For `base-ui/react/select` `Props` arity drift — read the current `@base-ui/react` types and match. If the version in `package.json` no longer has this surface, pin or adjust the wrapper's generic. Do not upgrade `@base-ui/react` in this phase.
- Order of attack: plan sequentially, but parallel-safe per-file fixes are fine.

## Requirements traceability

No new requirement IDs needed — this phase closes v1.19 tech-debt documented in the audit. SUMMARY should cite it as "v1.19-MILESTONE-AUDIT tech-debt carry-forward".

## Dependencies

- **Upstream:** Phase 60 complete (no file collisions; follow-up commit `4d1c5f0` already landed).
- **Downstream:** v1.20 complete-milestone.

## Non-goals (explicit)

- No new tests.
- No refactor of `useTableState`, `useSensorDraft`, or `DEFAULT_SETTINGS` beyond what typing requires.
- No `@base-ui/react` upgrade.
- No ESLint rule changes.
- No `tsconfig.json` settings changes beyond what is strictly required to fix errors (e.g. if `erasableSyntaxOnly` is genuinely fighting legitimate code, escalate rather than disable).

<errors>
Full output of `npm run build` against `main@0a567bd` on 2026-04-22 (31 errors, 9 files):

```
src/components/dashboard/HrKpiCharts.tsx(146,15): error TS2322: Type '(m: string) => string' is not assignable to type '((label: ReactNode, payload: readonly Payload<ValueType, NameType>[]) => ReactNode) & ((label: any, payload: TooltipPayload) => ReactNode)'.
src/components/dashboard/HrKpiCharts.tsx(147,15): error TS2322: Type '(v: number, name: string) => string[] | null[]' is not assignable to type 'Formatter<ValueType, NameType> & ((value: ValueType, name: NameType, item: TooltipPayloadEntry, index: number, payload: TooltipPayload) => ReactNode | [...])'.
src/components/dashboard/HrKpiCharts.tsx(185,15): error TS2322: Type '(m: string) => string' is not assignable to type '((label: ReactNode, payload: readonly Payload<ValueType, NameType>[]) => ReactNode) & ((label: any, payload: TooltipPayload) => ReactNode)'.
src/components/dashboard/HrKpiCharts.tsx(186,15): error TS2322: Type '(v: number, name: string) => string[] | null[]' is not assignable to type 'Formatter<ValueType, NameType> & ((value: ValueType, name: NameType, item: TooltipPayloadEntry, index: number, payload: TooltipPayload) => ReactNode | [...])'.
src/components/dashboard/SalesTable.tsx(31,19): error TS2345: Argument of type 'SalesRecordRow[] | undefined' is not assignable to parameter of type 'Record<string, unknown>[] | undefined'.
src/components/dashboard/SalesTable.tsx(110,21): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/dashboard/SalesTable.tsx(111,63): error TS2322: Type 'unknown' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/dashboard/SalesTable.tsx(112,45): error TS2322: Type '{}' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/dashboard/SalesTable.tsx(113,67): error TS2322: Type '{}' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/dashboard/SalesTable.tsx(114,57): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | null'.
src/components/dashboard/SalesTable.tsx(115,72): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number | null'.
src/components/dashboard/SalesTable.tsx(116,72): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number | null'.
src/components/settings/PersonioCard.tsx(154,31): error TS7006: Parameter 'v' implicitly has an 'any' type.
src/components/settings/sensors/SnmpWalkCard.tsx(277,37): error TS7006: Parameter 'v' implicitly has an 'any' type.
src/components/settings/sensors/SnmpWalkCard.tsx(297,37): error TS7006: Parameter 'v' implicitly has an 'any' type.
src/components/ui/select.tsx(1,1): error TS6133: 'React' is declared but its value is never read.
src/components/ui/select.tsx(7,24): error TS2707: Generic type 'Props' requires between 1 and 2 type arguments.
src/hooks/useSensorDraft.ts(232,15): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
src/hooks/useSensorDraft.ts(434,11): error TS2783: 'color_primary' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(435,11): error TS2783: 'color_accent' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(436,11): error TS2783: 'color_background' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(437,11): error TS2783: 'color_foreground' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(438,11): error TS2783: 'color_muted' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(439,11): error TS2783: 'color_destructive' is specified more than once, so this usage will be overwritten.
src/hooks/useSensorDraft.ts(440,11): error TS2783: 'app_name' is specified more than once, so this usage will be overwritten.
src/lib/defaults.ts(3,14): error TS2739: Type '{ ... }' is missing the following properties from type 'Settings': sensor_poll_interval_s, sensor_temperature_min, sensor_temperature_max, sensor_humidity_min, sensor_humidity_max
src/signage/components/ScheduleEditDialog.test.tsx(45,17): error TS2591: Cannot find name 'require'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/signage/components/ScheduleEditDialog.tsx(254,33): error TS7006: Parameter 'v' implicitly has an 'any' type.
src/signage/pages/SchedulesPage.test.tsx(6,3): error TS6133: 'afterEach' is declared but its value is never read.
src/signage/pages/SchedulesPage.test.tsx(200,5): error TS2578: Unused '@ts-expect-error' directive.
src/signage/pages/SchedulesPage.test.tsx(202,5): error TS2578: Unused '@ts-expect-error' directive.
```
</errors>

## Canonical refs (for the planner)

- `frontend/tsconfig.json` — `erasableSyntaxOnly` is enabled; respect it.
- `frontend/package.json` — `@base-ui/react`, `recharts`, `@types/*` versions determine type surfaces.
- `frontend/src/lib/types.ts` (or wherever `Settings` is defined) — source of truth for sensor_* fields that `defaults.ts` must match.
- `frontend/src/hooks/useTableState.ts` — the generic signature to respect when fixing SalesTable.
- `.planning/milestones/v1.19-MILESTONE-AUDIT.md` — origin of this carry-forward.
