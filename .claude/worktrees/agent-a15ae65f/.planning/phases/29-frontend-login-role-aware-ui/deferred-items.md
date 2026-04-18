
## From Plan 29-02 execution (2026-04-15)

Pre-existing TypeScript build errors in frontend (verified present before Plan 29-02 changes via `git stash` baseline):

- `src/components/dashboard/HrKpiCharts.tsx` lines 111, 112, 135, 136 — Recharts Tooltip formatter type mismatch (ValueType vs number)
- `src/components/dashboard/SalesTable.tsx` lines 31, 110–116 — Generic Record<string, unknown> constraint on SalesRecordRow

These are unrelated to auth infrastructure. `npm run build` reports them but Plan 29-02 files (directusClient.ts, apiClient.ts, auth/*.tsx, components/ui/form.tsx) compile cleanly on their own.
