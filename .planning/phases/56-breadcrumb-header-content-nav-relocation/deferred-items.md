# Deferred Items — Phase 56

Pre-existing TypeScript errors observed during Plan 56-03 execution in files unrelated to this plan's scope (NavBar.tsx, SubHeader.tsx). Not caused by this plan's changes.

- src/components/dashboard/SalesTable.tsx: unknown -> number|null
- src/components/settings/PersonioCard.tsx: implicit any v
- src/components/settings/sensors/SnmpWalkCard.tsx: implicit any v (2x)
- src/components/ui/select.tsx: unused React import + Generic Props type arg mismatch
- src/hooks/useSensorDraft.ts: erasableSyntaxOnly violation + 7 duplicate props
- src/lib/defaults.ts: Settings missing sensor_* properties
- src/signage/components/ScheduleEditDialog.test.tsx: missing @types/node
- src/signage/components/ScheduleEditDialog.tsx: implicit any v
- src/signage/pages/SchedulesPage.test.tsx: unused afterEach + unused @ts-expect-error (2x)

These predate Plan 56-03 and do not affect NavBar.tsx / SubHeader.tsx TypeScript CLEAN status.
