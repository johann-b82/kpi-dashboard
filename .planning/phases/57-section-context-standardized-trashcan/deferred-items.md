
## From 57-06 build (2026-04-22)
- Pre-existing/parallel-plan TS errors observed in build (NOT caused by 57-06):
  - src/signage/pages/SchedulesPage.tsx — references undefined ScheduleDeleteDialog/deleteTarget/setDeleteTarget; mid-flight from a parallel plan
  - src/signage/components/ScheduleEditDialog.* — implicit any, require, unused ts-expect-error
  - src/components/ui/select.tsx — Generic Props arg count, unused React import
  - src/components/dashboard/SalesTable.tsx — unknown args
  - src/components/settings/PersonioCard.tsx, sensors/SnmpWalkCard.tsx — implicit any
  - src/hooks/useSensorDraft.ts, src/lib/defaults.ts — pre-existing typing drift
- Plan 57-06 single-file change (PlaylistsPage.tsx) compiles cleanly with no remaining `deleteTarget` references and no `<Dialog>` inline blocks.

## Plan 57-08 — Out-of-Scope Build Errors (pre-existing)

Encountered during 57-08 build verification, all in files unrelated to DevicesPage.tsx:

- `src/hooks/useSensorDraft.ts:438-440` — duplicate object keys (color_muted, color_destructive, app_name)
- `src/lib/defaults.ts:3` — Settings type missing sensor_poll_interval_s and 4 sensor threshold props
- `src/signage/components/ScheduleEditDialog.test.tsx:45` — uses `require` without @types/node
- `src/signage/components/ScheduleEditDialog.tsx:254` — implicit any in callback param
- `src/signage/pages/PlaylistsPage.tsx:198` — Promise<null> vs Promise<void>
- `src/signage/pages/SchedulesPage.test.tsx:6,200,202` — unused imports + unused @ts-expect-error
- `src/signage/pages/SchedulesPage.tsx:329` — Promise<null> vs Promise<void>

Origin: parallel sensor/schedules work. Not introduced by 57-08; DevicesPage TS check is clean.
