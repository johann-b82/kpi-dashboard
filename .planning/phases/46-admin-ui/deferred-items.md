Out-of-scope pre-existing TS errors (NOT from this plan):
- src/components/dashboard/HrKpiCharts.tsx (Recharts tooltip prop type drift)
- src/components/dashboard/SalesTable.tsx (data table generic type)
- src/hooks/useSensorDraft.ts (erasableSyntaxOnly + duplicate keys)
- src/lib/defaults.ts (missing sensor_* fields on Settings)

Discovered during plan 46-03 build verification on 2026-04-19. Files in /signage/player/ are clean.

