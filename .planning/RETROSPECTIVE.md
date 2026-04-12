# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-11
**Phases:** 3 | **Plans:** 10 | **Sessions:** 1 (single execution window)

### What Was Built

- **Dockerized async FastAPI + PostgreSQL 17 stack** — compose with db → migrate → api → frontend, healthchecks on every service, Alembic migration service exits cleanly before api starts
- **38-column ERP tab-delimited ingestion pipeline** — pandas-based parser with German locale handling (decimal comma, DD.MM.YYYY dates), Pydantic v2 validation, UNIQUE `order_number` with cascade delete
- **Bilingual DE/EN React 19 + Vite 8 upload UI** — DropZone drag-and-drop, scrollable inline ErrorList (row/column), UploadHistory table with status badges, DeleteConfirmDialog
- **KPI query API** — three async aggregation endpoints (`/api/kpis` summary, `/api/kpis/chart` time-series, `/api/kpis/latest-upload`), backed by a `order_date` B-tree index for date-range queries
- **Interactive dashboard** — KPI summary cards (revenue, AOV, orders), Recharts bar/line revenue chart with toggle, DateRangeFilter with presets + custom calendar popover, FreshnessIndicator in NavBar
- **Upload → Dashboard auto-refresh** — DropZone onSuccess invalidates `kpiKeys.all`, TanStack Query v5 prefix-invalidates every dashboard query (summary, chart, latestUpload)

### What Worked

- **Parallel wave execution paid off in Phase 3 Wave 1** — backend KPI API and frontend router shell executed in parallel with zero conflicts (different subtrees). Wave 1 finished in ~3 min instead of 6 min sequential.
- **Pre-phase UI-SPEC + discussion + research artifacts** — Phase 3 planning had a clear design contract before execution. Zero design-related deviations during execution; the only deviation was a real bug (base-ui Popover vs Radix) caught immediately by the executor.
- **Async end-to-end from day one** — FastAPI + asyncpg + SQLAlchemy 2.0 async avoided the mid-project "sync-to-async rewrite" pitfall. Matches the I/O-bound nature of the workload.
- **Fixed schema decision** — locking the 38-column shape early (Phase 2) made the parser trivial and let Phase 3 assume column types without defensive coding.
- **TanStack Query prefix invalidation** — `kpiKeys.all = ["kpis"]` turned out to be the cleanest possible auto-refresh mechanism. Single call in DropZone covers every dashboard query without per-query plumbing.
- **Verifier agents caught real issues, not just box-checking** — Phase 3 verifier re-ran live curls against the running stack and confirmed the upload→dashboard flow end-to-end, not just SUMMARY compliance.

### What Was Inefficient

- **Phase 3 chart toggles round-trip** — plan called for granularity toggle + chart-type toggle; during post-verification UX tweak, user asked to remove both, then asked to re-add only chart type. Net: wasted work on GranularityToggle + tabs.tsx (created then deleted), and plan/code divergence that surfaced in the audit. **Lesson:** Visual UX calls are cheaper to make on a clickable prototype than to unwind in code.
- **Phase 2 `status: human_needed` items never closed** — 9/9 automated checks passed, but 5 visual items (drag-drop, toasts, inline errors) stayed pending across the whole milestone. They're non-blocking but clutter the audit. **Lesson:** HUMAN-UAT should be closed same-day via `/gsd:verify-work`, not deferred.
- **Phase 1 SUMMARY frontmatter gap** — `01-01-SUMMARY.md` and `01-02-SUMMARY.md` never listed `requirements-completed: [INFR-01, INFR-02]`. REQUIREMENTS.md was correct via manual edits, but the 3-source cross-reference in audit flagged the mismatch. **Lesson:** SUMMARY frontmatter should be treated as canonical, not the checkbox in REQUIREMENTS.md.
- **Initial ROADMAP.md Phase 3 progress row was stale** — when archiving, roadmap still listed Phase 3 as "0/4 Not started" despite Phase 3 being complete. The CLI didn't update the progress table during phase-complete.

### Patterns Established

- **Audit before archive** — running `/gsd:audit-milestone` before `/gsd:complete-milestone` surfaced the chart-toggle divergence and Phase 2 pending UAT. Worth the extra step on every milestone.
- **Post-execution UX tweaks go through `/gsd:quick`** — small visual changes during the same conversation as execute-phase should still be tracked as tech debt in the milestone audit.
- **Hardcoded sensible defaults for removed controls** — when a toggle is removed, keep the backend flexibility (e.g., `/api/kpis/chart?granularity=` still accepts all values) even if the UI ships one option. Cheap to re-enable later.
- **Base-ui primitives ≠ Radix primitives** — shadcn registries vary. Always check the underlying library before copying Radix-style `asChild` patterns into a project.
- **i18n flat keys (`keySeparator:false`) scale better** — avoids collision between `nav.lastUpdated` and `nav.lastUpdated.never` that would confuse a nested key tree.

### Key Lessons

1. **Deferred human-UAT rots.** If a phase ships `human_needed`, close it within the same session or it never gets done. Schedule visual verification as the final act of each phase, not "later".
2. **Plan/code divergence is invisible until audit.** The chart-toggle removal was a user-approved change, but `03-04-SUMMARY.md` still claimed the toggles existed. Audit caught it; execute-phase didn't. **Action:** post-phase tweaks should amend the affected SUMMARY, not leave it stale.
3. **Parallel waves only help when subtrees are truly independent.** Phase 3 Wave 1 worked because backend (Python) and frontend shell (TS) share no files. Wave 2 and Wave 3 had only one plan each — no parallelism possible. Don't force waves.
4. **Pre-phase design contracts (UI-SPEC, discuss, research) pay for themselves.** Phase 3 had zero mid-execution scope drift because the plan was fully specified before any code.
5. **Verifier agents should re-exercise the live stack, not just read SUMMARY.md.** Phase 3's verifier ran real curls and proved the data was live — that's what "verified" should always mean.

### Cost Observations

- Model mix: primarily sonnet (executors, verifier, integration checker, most orchestration), some opus (orchestrator for high-judgment steps)
- Sessions: 1 (single continuous session from Phase 3 start → milestone ship)
- Notable: Parallel Wave 1 in Phase 3 halved wall time vs sequential. Executor token usage averaged ~60-100k per plan — well within 200k window.

---

## Milestone: v1.2 — Period-over-Period Deltas

**Shipped:** 2026-04-12
**Phases:** 4 (8–11) | **Plans:** 10 | **Tasks:** 16

### What Was Built

- **Backend dual-baseline aggregation** — `summary` endpoint returns `previous_period` + `previous_year` comparison objects; `chart` endpoint gains `comparison` query param with aligned `previous_series`; SQL interval math (leap-year safe), null-safe for missing windows
- **Dual delta badges on all 3 KPI cards** — `▲ +12,4 %` (DE) / `▲ +12.4%` (EN) with up/down arrows, semantic colors, em-dash fallback + tooltip for null baselines
- **Contextual secondary labels** — "vs. März", "vs. Q1", "vs. 2025" driven by filter scope via `formatPrevPeriodLabel` + `formatPrevYearLabel`
- **Chart prior-period overlay** — amber second series at full opacity alongside blue current, Recharts Legend with contextual labels, null-gap handling
- **Full DE/EN i18n parity** — 119 keys in both locales, `getLocalizedMonthName` via `Intl.DateTimeFormat` (no new deps), persistent `check-locale-parity.mts` script
- **Live language switch** — all delta badges, tooltips, chart legend re-render on LanguageToggle without page refresh

### What Worked

- **Phase 8 backend-first approach** — having curl-testable endpoints before any frontend work meant Phase 9/10 executors never had to debug backend issues. Clean contract boundary.
- **Intl.DateTimeFormat over new dependencies** — zero new packages for locale-aware month names. The year-2000 seed date avoids DST edge cases. Simple, correct, zero-cost.
- **Persistent locale parity script** — `check-locale-parity.mts` catches key drift immediately. Should have existed since Phase 7 (v1.1 i18n).
- **Human checkpoint as final phase** — Phase 11-02's 4×2 matrix walkthrough caught no regressions, which validates the automated verification pipeline's thoroughness.
- **t() injection pattern for periodLabels** — keeping `periodLabels.ts` free of direct i18next imports makes it unit-testable with fake `t()` functions. Clean separation.

### What Was Inefficient

- **REQUIREMENTS.md traceability table went stale** — checkboxes in the requirements section were checked, but the traceability table at the bottom still showed "Not started" for CHART-04..06 and I18N-DELTA-01..02. The CLI's `phase complete` didn't update the table rows for phases that were already marked complete before the CLI ran. **Lesson:** traceability table should be updated at each phase completion, not just at milestone end.
- **Phase 8 roadmap progress row stayed at "0/3 Not started"** — same stale-progress issue from v1.0. The `roadmap update-plan-progress` tool was called correctly for later phases but Phase 8's row wasn't updated. Still a minor cosmetic issue.

### Patterns Established

- **`getLocalizedMonthName(monthIndex, locale)` with year-2000 seed** — standard pattern for Intl.DateTimeFormat month lookups. Avoids DST/timezone edge cases.
- **`ChartLabelT` injection** — pure functions accept a `t: (key, opts?) => string` parameter instead of importing i18next directly. Enables fake-t testing.
- **Persistent locale parity script** — `check-locale-parity.mts` as infrastructure, not a per-phase throwaway.
- **"vs." as locale-invariant loanword** — German keeps the "vs." prefix in delta labels; no separate translation key needed.

### Key Lessons

1. **Backend-first for data-driven features pays off.** Phase 8's clean API contract made Phases 9–11 straightforward — no "oh the API doesn't return that" surprises.
2. **Persistent infrastructure scripts > per-phase verify scripts.** `check-locale-parity.mts` will catch regressions in future milestones; per-phase `verify-phase-X.mts` scripts are throwaway. Build more of the former.
3. **Human walkthrough at milestone end is sufficient when automated verification covers the middle.** Phase 11-02's checkpoint found zero issues — the automated gates in 8–11 were thorough enough.

### Cost Observations

- Model mix: sonnet for all executor + verifier agents, opus for orchestration
- Sessions: 2 (Phase 8–10 in session 1, Phase 11 + milestone completion in session 2)
- Notable: Phase 11 was lightweight — 2 plans, 1 autonomous + 1 checkpoint. The i18n polish phase was intentionally small to minimize risk at milestone end.

---

## Milestone: v1.3 — HR KPI Dashboard & Personio-Integration

**Shipped:** 2026-04-12
**Phases:** 5 (12–16) | **Plans:** 10 | **Tasks:** 12
**Scope:** 27 files changed, +2,544 LOC, 20/20 requirements

### What Was Built

- **HR database schema + encrypted credentials (Phase 12)** — 4 Personio tables via Alembic, Fernet-encrypted credential columns, write-only Settings API, async PersonioClient with token caching and exception hierarchy
- **Sync service + Settings extension (Phase 13)** — APScheduler periodic sync, manual sync endpoint, raw data persistence, PersonioCard frontend with credential inputs, live-populated dropdowns, connection test
- **Multi-tab navigation (Phase 14)** — Dashboard→Sales rename, HR tab with sync freshness indicator and manual sync trigger
- **HR KPI cards (Phase 15)** — 5 KPIs (overtime, sick leave, fluctuation, skill development, revenue/employee) with dual delta badges, error/no-sync/unconfigured states
- **i18n polish (Phase 16)** — 24 new settings.personio.* keys, PersonioCard wired with useTranslation, 164 keys total DE/EN parity

### What Worked

- **Phase decomposition matched domain boundaries** — schema→sync→navigation→KPIs→i18n created clean dependency chains. Each phase had a clear contract to its successor.
- **Backend-first pattern continued from v1.2** — Phase 12 (schema) and Phase 13 (sync service) shipped before any frontend work, so Phase 14/15 executors had stable APIs to build against.
- **Single-plan phases (Phase 16) execute fast** — 1 plan with 2 tasks, no wave complexity, agent finished in ~5 minutes. Good pattern for i18n/polish phases.
- **Milestone audit caught a cosmetic ROADMAP.md issue** — plan checkbox not ticked and progress count at 0/1 despite completion. Fixed before archival.
- **Write-only credential pattern (PERS-01)** — Fernet encryption + never-return-in-GET eliminated an entire class of credential leakage bugs.

### What Was Inefficient

- **SUMMARY.md one-liner extraction still fragile** — `summary-extract` returned partial fragments ("One-liner:", "scheduler.py (new file):") for Phase 13 summaries, corrupting the auto-generated MILESTONES.md entry. Had to manually clean up. **Lesson:** SUMMARY template should enforce a clear one-liner field that the CLI can reliably parse.
- **ROADMAP.md plan progress not updated by phase-complete** — Phase 16 showed `0/1` plans and `[ ]` checkbox after `phase complete` ran. Same stale-progress issue from v1.0 and v1.2. **Lesson:** This is a recurring CLI bug — `phase complete` should also tick plan checkboxes.
- **Pre-existing TypeScript error in defaults.ts** — `Settings` type grew Personio fields across phases 12-13 but `defaults.ts` was never updated with the new fields. Not caught until Phase 16 ran `tsc --noEmit`. Non-blocking (runtime works via API defaults) but should have been caught in Phase 13 verification.

### Patterns Established

- **Fernet encryption for internal credential storage** — symmetric encryption with Python `cryptography` library; key stored as env var; write-only API pattern prevents accidental exposure.
- **APScheduler in-process under FastAPI lifespan** — no persistent job store needed for interval-based sync in internal tools; in-memory scheduler restarts cleanly on container restart.
- **INTERVAL_OPTIONS inside component body** — module-scope constants using `t()` don't re-evaluate on language change; must be inside the React component body.
- **Locale parity script as build gate** — `check-locale-parity.mts` now covers 164 keys across 4 milestones of accumulated translations.

### Key Lessons

1. **Domain-boundary phase decomposition works.** v1.3's 5 phases mapped cleanly to schema→service→UI shell→cards→polish. Each phase had minimal cross-cutting concerns.
2. **Recurring CLI bugs compound.** ROADMAP.md stale progress has appeared in v1.0, v1.2, and v1.3. Worth filing as a proper fix rather than manually patching each time.
3. **TypeScript strict mode catches late what verification should catch early.** The `defaults.ts` gap should have been caught in Phase 13 when the Settings type was extended.

### Cost Observations

- Model mix: sonnet for executor + verifier + integration checker, opus for orchestration
- Sessions: 1 (all 5 phases in single continuous session)
- Notable: Phase 16 (single plan) completed in ~5 min agent time — smallest phase yet. v1.3 overall was the fastest milestone despite being the largest feature set.

---

## Milestone: v1.4 — Navbar & Layout Polish

**Shipped:** 2026-04-12
**Phases:** 1 (17) | **Plans:** 2 | **Tasks:** 4
**Scope:** Frontend-only, 6 files changed, ~100 net LOC

### What Was Built

- **DateRangeContext** — shared filter state extracted from DashboardPage, mirroring SettingsDraftContext pattern; consumed by both SubHeader and DashboardPage
- **NavBar overhaul** — 32px logo (down from 56px), upload tab removed, upload icon (lucide-react) in action area with active state, FreshnessIndicator removed from navbar
- **SubHeader** — fixed bar below navbar with route-aware freshness (HR sync on /hr, upload on other routes), DateRangeFilter conditionally rendered on Sales tab only
- **Sync button relocation** — moved from HRPage to PersonioCard in Settings per user feedback during visual checkpoint
- **Layout spacing** — 32px navbar→sub-header gap, reduced page top padding for tighter sub-header→content spacing

### What Worked

- **Visual checkpoint caught real UX issues** — user iteratively refined: removed border, requested HR-specific freshness, relocated sync button, tuned spacing. 5 fix commits during checkpoint, all user-validated.
- **Single-phase milestone executed cleanly** — 2 waves, 2 plans, no cross-phase dependencies. Fastest milestone yet.
- **Context pattern reuse** — DateRangeContext exactly mirrored SettingsDraftContext (same createContext/useContext/Provider shape), making the new file predictable.

### What Was Inefficient

- **Worktree merge conflict** — Plan 01 worktree branch had a merge conflict in NavBar.tsx due to diverged history. Manual resolution needed. **Lesson:** worktree branches should be based on the latest main to minimize merge conflicts.
- **LAY-01 requirement defined, then user rejected** — the "horizontal separator line" requirement was planned, implemented (border-b), shown to user, then removed. Then shadow-sm was tried and also rejected. Net: 3 commits for a feature that ended up being "no border". **Lesson:** for visual UX requirements, validate mockups before defining requirements.

### Patterns Established

- **Route-aware SubHeader** — `useLocation()` to conditionally render domain-specific content in a shared layout component. Works for freshness indicator routing (HR sync vs upload).
- **Context-driven filter state** — DateRangeContext enables any component to read/write filter state without prop drilling. SubHeader writes, DashboardPage reads.

### Key Lessons

1. **Visual checkpoints are high-value for layout phases.** The 5 iterative fixes during the Plan 02 checkpoint produced a better result than any pre-planned spec could have.
2. **Requirements should describe intent, not implementation.** "LAY-01: Horizontal separator line" was too prescriptive — the user's actual intent was visual separation, which ended up being achieved by spacing alone.
3. **Frontend-only milestones are fast and low-risk.** No backend changes, no migrations, no API contract negotiations. Good candidate for single-session execution.

### Cost Observations

- Model mix: sonnet for executor + verifier, opus for orchestration
- Sessions: 1 (single session, ~30 min total)
- Notable: Checkpoint iteration (5 fix commits) used more context than the planned execution. Interactive refinement is token-expensive but produces better UX outcomes.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 1 | 3 | Initial baseline |
| v1.2 Deltas | 2 | 4 | Backend-first contract, persistent i18n infra |
| v1.3 HR+Personio | 1 | 5 | Domain-boundary decomposition, encrypted credentials |
| v1.4 Nav Polish | 1 | 1 | Visual checkpoint iteration, route-aware SubHeader |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 MVP | 0 automated | Manual curl + human-UAT | 0 (first milestone) |
| v1.2 Deltas | verify scripts + integration | Script-based + human 4×2 matrix | 0 (Intl.DateTimeFormat built-in) |
| v1.3 HR+Personio | parity script + tsc | Automated verification + audit | httpx, APScheduler, cryptography |
| v1.4 Nav Polish | tsc + visual UAT | Human checkpoint with iterative fixes | 0 (lucide-react already installed) |

### Top Lessons (Verified Across Milestones)

1. **Backend-first for data features** — clean API contract before frontend work prevents mid-execution surprises (v1.0, v1.2, v1.3)
2. **Persistent infra scripts > throwaway verify scripts** — `check-locale-parity.mts` catches regressions across milestones; per-phase scripts are single-use (v1.2, v1.3)
3. **Deferred human-UAT rots** — close visual verification same-day or it never gets done (v1.0, still relevant)
4. **Pre-phase design contracts pay for themselves** — zero mid-execution scope drift when plans are fully specified (v1.0, v1.2, v1.3)
5. **Domain-boundary phase decomposition scales** — mapping phases to domain concepts (schema→service→UI→polish) creates clean dependency chains with minimal cross-cutting concerns (v1.3)
6. **Recurring CLI bugs need upstream fixes, not workarounds** — ROADMAP.md stale progress appeared in v1.0, v1.2, and v1.3 (all milestones)
