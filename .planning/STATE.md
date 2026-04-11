---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Period-over-Period Deltas
status: executing
stopped_at: Completed 08-02-PLAN.md
last_updated: "2026-04-11T21:13:34.225Z"
last_activity: 2026-04-11
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 100
---

# Project State: KPI Light

**Last updated:** 2026-04-11
**Session:** v1.1 Branding & Settings — roadmap created

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-11 after v1.0 milestone shipped)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 08 — backend-comparison-aggregation-and-chart-overlay-api

---

## Current Position

Phase: 08 (backend-comparison-aggregation-and-chart-overlay-api) — EXECUTING
Plan: 3 of 3
**Milestone:** v1.1 Branding & Settings — COMPLETE
**Phase:** 7 of 7 (i18n integration and polish) — COMPLETE
**Plan:** — (all 6 plans in Phase 7 complete)
**Status:** Executing Phase 08
**Last activity:** 2026-04-11

Progress: [██████████] 100% (19/19 plans in current scope)

---

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: — (no plans yet)
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---
| Phase 04-backend-schema-api-and-security P01 | 3min | 2 tasks | 5 files |
| Phase 04-backend-schema-api-and-security P02 | 3min | 2 tasks | 3 files |
| Phase 04-backend-schema-api-and-security P03 | 5min | 2 tasks | 2 files |
| Phase 04-backend-schema-api-and-security P05 | 4min | 2 tasks | 4 files |
| Phase 04-backend-schema-api-and-security P06 | 10min | 2 tasks | 2 files |
| Phase 05-frontend-plumbing-themeprovider-and-navbar P01 | 5min | 2 tasks | 5 files |
| Phase 05-frontend-plumbing-themeprovider-and-navbar P02 | 2min | 2 tasks | 4 files |
| Phase 05-frontend-plumbing-themeprovider-and-navbar P03 | 8min | 2 tasks | 1 files |
| Phase 06-settings-page-and-sub-components P06-01 | 2min | 3 tasks | 6 files |
| Phase 06-settings-page-and-sub-components P06-02 | 2min | 2 tasks | 2 files |
| Phase 06-settings-page-and-sub-components P06-03 | 2min | 3 tasks | 4 files |
| Phase 06-settings-page-and-sub-components P06-04 | 30min | 3 tasks | 6 files |
| Phase 07-i18n-integration-and-polish P02 | 3min | 3 tasks | 4 files |
| Phase 07-i18n-integration-and-polish P01 | 8min | 2 tasks | 4 files |
| Phase 07-i18n-integration-and-polish P02 | 5min | 3 tasks | 6 files |
| Phase 07-i18n-integration-and-polish P01 | 2min | 2 tasks | 4 files |
| Phase 07-i18n-integration-and-polish P03 | 2min | 3 tasks | 6 files |
| Phase 07-i18n-integration-and-polish P04 | 2min | 1 tasks | 1 files |
| Phase 07-i18n-integration-and-polish P05 | 2min | 1 tasks | 1 files |
| Phase 07-i18n-integration-and-polish P05 | 1min | 1 tasks | 1 files |
| Phase 07-i18n-integration-and-polish P04 | 2min | 1 tasks | 1 files |
| Phase 07-i18n-integration-and-polish P06 | 45min | 4 tasks | 9 files |
| Phase 08-backend-comparison-aggregation-and-chart-overlay-api P01 | 6min | 2 tasks | 3 files |
| Phase 08-backend-comparison-aggregation-and-chart-overlay-api P02 | 8min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- **v1.1 scoping:** Logo stored as bytea in Postgres (not filesystem) — avoids Docker volume complexity; self-contained with pg_dump backup
- **v1.1 scoping:** Hex input in ColorPicker; culori converts hex→oklch before API submission; backend stores as TEXT
- **v1.1 scoping:** `nh3==0.3.3` chosen for SVG sanitization (Rust-backed, pre-built wheels, no compiler in Docker)
- **v1.1 scoping:** No `i18next-browser-languageDetector` — server setting is the single source of truth; `changeLanguage()` called before first render
- [Phase 04-backend-schema-api-and-security]: Plan 04-01: nh3 upgraded to 0.3.4 (from STATE.md's 0.3.3); test harness uses lazy-import guard so collection survives partial tree across Wave 1 plans
- [Phase 04-backend-schema-api-and-security]: Plan 04-02: AppSettings singleton via CheckConstraint(id=1); migration duplicates defaults literally (no import of app.defaults) per D-18
- [Phase 04-backend-schema-api-and-security]: Plan 04-03: Pydantic belt-and-braces validator (blacklist before regex) for BRAND-09; local reset_settings override in test_color_validator.py isolates pure unit tests from parallel Wave 2 DB work
- [Phase 04-backend-schema-api-and-security]: Plan 04-05: /api/settings/* router wired (GET/PUT + logo POST/GET with weak ETag/304); engine.dispose() per-test fixture override unblocks shared asyncpg pool across test event loops
- [Phase 04-backend-schema-api-and-security]: Plan 04-06: Phase 4 smoke script + docker rebuild runbook landed; human verification approved (PASSED 16 / FAILED 0, rebuild SHAs matched). Runbook SVG bug fixed during verification: self-closing `<circle/>` is rewritten by nh3 html5ever and hits reject-on-mutation; explicit close-tag form required.
- [Phase 05-frontend-plumbing-themeprovider-and-navbar]: Plan 05-01: Settings type, fetcher, defaults, and useSettings hook plumbed; queryKey literal ['settings'] + staleTime Infinity per D-13; defaults duplicated verbatim from backend (D-16)
- [Phase 05-frontend-plumbing-themeprovider-and-navbar]: Plan 05-02: ThemeProvider gates children during isLoading with text-free skeleton (D-02); applyTheme iterates THEME_TOKEN_MAP to write 6 oklch CSS vars + document.title; Toaster kept outside provider per D-03; tsconfig.app.json gained ignoreDeprecations to unblock tsc -b on pre-existing baseUrl directive
- [Phase 05-frontend-plumbing-themeprovider-and-navbar]: Plan 05-03: NavBar brand slot reads from useSettings() with DEFAULT_SETTINGS fallback; logo/text mutually exclusive; Settings gear rendered as styled wouter Link directly (no nested Button) to avoid invalid <a><button>; Phase 5 human verification of all 4 success criteria PASSED
- [Phase 06-settings-page-and-sub-components]: Plan 06-01: wcagContrast called with 2 args (@types/culori 4.0.1 declares only 2-arg signature; WCAG21 is culori default)
- [Phase 06-settings-page-and-sub-components]: Plan 06-01: shadcn input/label created via registry (base-ui pattern matched, no asChild); color.ts isolated as single oklch math module
- [Phase 06-settings-page-and-sub-components]: Plan 06-02: Removed COLOR_KEYS/ColorKey from useSettingsDraft — unused by hook logic, caused tsc noUnusedLocals errors; plan code snippet was illustrative, not functional
- [Phase 06-settings-page-and-sub-components]: Plan 06-03: ContrastBadge copy hardcoded EN in Phase 6; locale key settings.contrast.badge added to en.json for Phase 7 wiring
- [Phase 06-settings-page-and-sub-components]: Plan 06-03: LogoUpload uses setQueryData (not invalidateQueries) on upload success; D-13 staleTime Infinity avoids redundant refetch
- [Phase 06-settings-page-and-sub-components]: hexToOklch clamps L to [0,1] and coerces non-finite hue to 0 — culori formatCss emits overflow/none values that the backend regex rejects
- [Phase 06-settings-page-and-sub-components]: formatDetail() helper added to api.ts to unwrap FastAPI 422 array-shaped detail into readable error strings for toasts
- [Phase 07-i18n-integration-and-polish]: Plan 07-02: bootstrap.ts is single cold-start i18n writer; reuses fetchSettings; seeds ['settings'] cache; falls back to EN without rethrow or DEFAULT_SETTINGS seed; splash placed INSIDE #root for atomic React replacement
- [Phase 07-i18n-integration-and-polish]: Plan 07-01: single-stage Dockerfile installs dev deps always (Research Pitfall 2 option A); chromium lives at ~/Library/Caches/ms-playwright on macOS
- [Phase 07-i18n-integration-and-polish]: Plan 07-02: Extracted shared queryClient singleton into frontend/src/queryClient.ts — App.tsx previously constructed QueryClient inline so bootstrap could not reach it (Rule 3 blocking fix)
- [Phase 07-i18n-integration-and-polish]: Plan 07-02: bootstrap.ts does NOT seed DEFAULT_SETTINGS on fetchSettings error (D-04) — falling back to changeLanguage('en') only, so useSettings() surfaces the real backend error via existing toast path
- [Phase 07-i18n-integration-and-polish]: Plan 07-02: Splash is text-free pulsing dots inside #root — React's first commit atomically replaces it; no localized text avoids mis-language flash during bootstrap fetch
- [Phase 07-i18n-integration-and-polish]: Plan 07-01: single-stage Dockerfile installs requirements-dev.txt (Pitfall 2 option A); Playwright from host with chromium at OS-default cache path (macOS: ~/Library/Caches/ms-playwright)
- [Phase 07-i18n-integration-and-polish]: Plan 07-03: PreferencesCard is pure (reports onChange only); useSettingsDraft.setField is the single i18n writer for draft preview — preserves single-writer invariant with bootstrap and LanguageToggle
- [Phase 07-i18n-integration-and-polish]: Plan 07-03: SettingsPage useEffect cleanup sets draftStatus.setDirty(false) on unmount so NavBar clears disabled state instantly on navigation (D-14)
- [Phase 07-i18n-integration-and-polish]: Plan 07-04: LanguageToggle rewritten with TanStack useMutation + pessimistic i18n.changeLanguage; disable state via useSettingsDraftStatus (no route sniffing); full 8-field PUT payload read from cache (no DEFAULT_SETTINGS fallback)
- [Phase 07-i18n-integration-and-polish]: Plan 07-05: de.json parity achieved at 109 keys (plan said 111, actual count derived from en.json); settings.preferences.title = 'Allgemein' per user preference; contrast badge uses German decimal comma '4,5 : 1'
- [Phase 07-i18n-integration-and-polish]: Plan 07-05: de.json parity achieved at 109 keys; settings.preferences.title = Allgemein (user preference); contrast.badge uses German decimal comma '4,5 : 1'
- [Phase 07-i18n-integration-and-polish]: Plan 07-04: LanguageToggle uses err.message (not formatDetail import) since updateSettings pre-formats errors via module-private formatDetail; keeps lib/api.ts exports untouched and matches SettingsPage.handleSave pattern
- [Phase 07-i18n-integration-and-polish]: Plan 07-04: LanguageToggle is pessimistic — i18n.changeLanguage fires only after server ack so a failed PUT never leaves runtime language out of sync with DB
- [Phase 07-i18n-integration-and-polish]: Plan 07-06: Rebuild-persistence harness (scripts/smoke-rebuild.sh) seeds via pytest, rebuilds stack with docker compose up --build, asserts via fresh pytest session, visually asserts via Playwright, runs host-side locale parity, and traps EXIT for singleton cleanup. SC4 verified green; user approved D-27.
- [Phase 07-i18n-integration-and-polish]: Plan 07-06: bootstrap.ts mirrors i18n.language onto document.documentElement.lang on init AND on every languageChanged event (Rule 2 deviation) — fixes a11y contract and unblocks Playwright html[lang=de] assertion; preserves single-writer invariant.
- [Phase 07-i18n-integration-and-polish]: Plan 07-06 post-approval: NavBar LanguageToggle no longer fires success toast (5d7917b) — the visible language flip is self-confirming; reduces post-07-04 UX noise.
- [Phase 08-backend-comparison-aggregation-and-chart-overlay-api]: Plan 08-01: aggregate_kpi_summary returns dict|None (not typed dataclass) so summary and chart endpoints project to different Pydantic shapes; unit tests use year 2099 dates to isolate from real 2026 seed data in shared dev db
- [Phase 08-backend-comparison-aggregation-and-chart-overlay-api]: Plan 08-02: Sequential awaits on shared AsyncSession (not asyncio.gather) — AsyncSession is not safe for concurrent execute() on a single connection; plan's done criteria explicitly allowed the sequential fallback
- [Phase 08-backend-comparison-aggregation-and-chart-overlay-api]: Plan 08-02: Additive non-breaking response shape — top-level current fields preserved, previous_period/previous_year added as nullable siblings; half-specified window and zero-row window both collapse to None (DELTA-05)

### Security Gates (Phase 4 must-haves)

- SVG XSS: `nh3` sanitization required before any logo is persistable
- CSS injection: Pydantic `@field_validator` with strict regex (reject `;`, `}`, `{`, `url(`, `expression(`, quotes)
- Both are **non-negotiable** — cannot be retrofitted after the feature ships on a zero-auth app

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — tracked in archived `02-HUMAN-UAT.md`. Non-blocking.
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly.

---

## Session Continuity

**Last session:** 2026-04-11T21:13:34.222Z
**Stopped at:** Completed 08-02-PLAN.md
**Resume file:** None
