# Deferred Items — Phase 57

## Pre-existing TypeScript build errors (out of scope for Phase 57)

`npm --prefix frontend run build` produces ~25 TypeScript errors in files NOT
touched by Phase 57 plans:

- `src/components/dashboard/SalesTable.tsx` (Phase 54 TS debt — see PROJECT.md)
- `src/components/settings/PersonioCard.tsx` (implicit any)
- `src/components/settings/sensors/SnmpWalkCard.tsx` (implicit any)
- `src/components/ui/select.tsx` (Plan 55-02 declaration, see Decision in STATE.md)
- `src/hooks/useSensorDraft.ts` (erasableSyntaxOnly + duplicate keys)
- `src/lib/defaults.ts` (Settings type drift — sensor_* fields missing)
- `src/signage/components/ScheduleEditDialog.tsx` (implicit any)
- `src/signage/components/ScheduleEditDialog.test.tsx` (require not typed)
- `src/signage/pages/SchedulesPage.{tsx,test.tsx}` (Promise<null> vs void; unused directives)

These are tracked as pre-existing carry-forward debt and were not introduced
by Phase 57 plans. None of these errors live in files modified by 57-05
(`MediaPage.tsx`, `MediaInUseDialog.tsx`).
