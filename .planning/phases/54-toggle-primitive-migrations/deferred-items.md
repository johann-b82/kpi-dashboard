# Phase 54 — Deferred Items

Pre-existing build errors discovered during Plan 54-05 execution. Confirmed to exist prior to this plan's changes (reproduced on HEAD with Plan 54-05 edits stashed). Out of scope per SCOPE BOUNDARY rule.

## Pre-existing TypeScript Errors (not caused by Plan 54-05)

- `src/components/dashboard/SalesTable.tsx` — TS2344 / TS2322 / TS2345 errors around SalesRecordRow index signature (multiple lines 110–116).
- `src/hooks/useSensorDraft.ts(232,15)` — TS1294: syntax not allowed when `erasableSyntaxOnly` is enabled.
- `src/hooks/useSensorDraft.ts(434–440)` — TS2783: `color_primary`, `color_accent`, `color_background`, `color_foreground`, `color_muted`, `color_destructive`, `app_name` specified more than once.
- `src/lib/defaults.ts(3,14)` — TS2739: defaults missing `sensor_poll_interval_s`, `sensor_temperature_min/max`, `sensor_humidity_min/max` from Settings type.
- `src/signage/pages/SchedulesPage.test.tsx(6,3)` — TS6133: `afterEach` unused.
- `src/signage/pages/SchedulesPage.test.tsx(200,5)` / `(202,5)` — TS2578: unused `@ts-expect-error` directives.

These cause `npm run build` (which runs `tsc -b` first) to exit non-zero. The pure `tsc --noEmit` run I performed for LanguageToggle.tsx acceptance succeeded with no errors. Vite build itself would succeed; the blocker is `tsc -b`.

Action: a dedicated cleanup plan should address these before the v1.19 milestone closes (most look related to the Sensor phase and Schedules test file).
