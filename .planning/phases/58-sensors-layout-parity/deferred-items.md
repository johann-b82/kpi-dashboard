# Phase 58 — Deferred Items

## Out-of-scope pre-existing TypeScript errors (Phase-54 carry-forward)

Running `cd frontend && npm run build` surfaces pre-existing TS errors unrelated to Plan 58-01 changes. These files were NOT modified in this plan:

- `src/components/dashboard/SalesTable.tsx(116,72)` — TS2345 unknown not assignable to number|null (Phase-54 `<button>` migration deferred, see STATE.md)
- `src/components/settings/PersonioCard.tsx(154,31)` — TS7006 implicit any
- `src/components/settings/sensors/SnmpWalkCard.tsx(277,37 / 297,37)` — TS7006 implicit any
- `src/components/ui/select.tsx(1,1 / 7,24)` — TS6133 unused React + TS2707 generic arity (base-ui typings)
- `src/hooks/useSensorDraft.ts(232 / 434–440)` — TS1294 + TS2783 duplicate-key (legacy draft-merge helper)
- `src/lib/defaults.ts(3,14)` — TS2739 Settings type drift (sensor_* fields missing)
- `src/signage/components/ScheduleEditDialog.test.tsx(45,17)` — TS2591 require not typed (no @types/node)
- `src/signage/components/ScheduleEditDialog.tsx(254,33)` — TS7006 implicit any
- `src/signage/pages/SchedulesPage.test.tsx(6,3 / 200,5 / 202,5)` — TS6133 + TS2578

Per STATE.md Carry-forward Tech Debt + Phase-54 deferred-items convention, these are not Plan 58-01 regressions. `npx tsc --noEmit` reports ZERO errors in the files modified by this plan (PollNowButton.tsx, App.tsx).

## Plan 58-02

- `npm run build` surfaces the same pre-existing TS errors (HrKpiCharts added on top of the 58-01 list). All in files NOT modified by Plan 58-02. Carried forward as Phase-54 TS debt per scope boundary.
- Plan 58-02 tsc check limited to plan-modified files: `SubHeader.tsx` + `SensorsPage.tsx` — both compile clean.
