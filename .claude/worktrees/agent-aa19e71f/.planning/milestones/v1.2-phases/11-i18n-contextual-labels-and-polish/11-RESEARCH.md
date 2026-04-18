# Phase 11: i18n, Contextual Labels, and Polish - Research

**Researched:** 2026-04-12
**Domain:** react-i18next 17 locale parity + Intl.DateTimeFormat wiring + manual verification ritual
**Confidence:** HIGH

## Summary

Phase 11 closes the DE/EN parity gap left open by Phases 9 and 10 and swaps the last hardcoded period strings in `frontend/src/lib/periodLabels.ts` for `Intl.DateTimeFormat`-backed, `t()`-routed output. Actual byte-for-byte diff of the two locale files confirms CONTEXT D-06 exactly: **EN 119 keys, DE 109 keys, 10 missing in DE, 0 missing in EN, no stray DE keys** — see the enumerated diff below. There is nothing else to reconcile in the locale JSON.

The research surface is narrow and every important decision is already locked in CONTEXT.md (D-01 through D-18). The planner's job is mostly mechanical: insert 10 alphabetically-sorted keys into `de.json` with the exact DE phrasings locked in D-15, extend `periodLabels.ts` with a `getLocalizedMonthName` helper + route month/quarter/custom/short branches through `t()`, ship `frontend/scripts/check-locale-parity.mts` as persistent infra, and carry out the 4×2 human walkthrough for SC5.

**Primary recommendation:** Follow CONTEXT verbatim — no library additions, no codebase-wide sweep, no Playwright spec, no new test framework. Every new verification step uses the existing `node --experimental-strip-types frontend/scripts/verify-phase-*.mts` pattern already established in Phase 9/10.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Period label formatting (Intl.DateTimeFormat wiring)**
- **D-01:** The `Intl.DateTimeFormat`-backed month-name helper lives in `frontend/src/lib/periodLabels.ts` — the existing Phase 10 module is extended, **not** forked. No new `intlLabels.ts` / `intl.ts` module.
- **D-02:** Quarter labels render as language-agnostic **"Q1 / Q2 / Q3 / Q4"** in both DE and EN. Zero translation, zero new `quarter.q1..q4` i18n keys. The interpolation pattern `"Revenue Q{{quarter}}"` / `"Umsatz Q{{quarter}}"` passes the literal number 1–4 into the key.
- **D-03:** The i18n-language-code → Intl-locale-string map uses **short codes only**: `"DE"` → `"de"`, `"EN"` → `"en"`. No regional disambiguation.
- **D-04:** `getLocalizedMonthName(monthIndex: 0-11, locale: "de" | "en"): string`. Wraps `new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, monthIndex, 1))`. Year-2000 fixed seed avoids DST edge cases. Unit-tested in the existing `verify-phase-NN.mts` pattern.
- **D-05:** `formatChartSeriesLabel` is extended to call `getLocalizedMonthName` for the month case and route all strings through `t()`. The `range` argument remains unused for quarter/year/allTime branches.

**String inventory scope & audit strategy**
- **D-06:** Audit scope is **narrow** — only the 10 known EN-only keys (verified by diff) plus strings replaced by Intl output. No full-codebase sweep.
- **D-07:** Planner spot-checks `KpiCard*.tsx`, `RevenueChart.tsx`, `DashboardPage.tsx` for JSX text nodes and `aria-label={...}` values not wrapped in `t()`. Cheap confirmation, not a separate audit task.
- **D-08:** Locale-parity script at `frontend/scripts/check-locale-parity.mts`. Runnable via `node --experimental-strip-types`. Exits `1` with diff report on divergence, `0` on parity. NOT wired into `smoke-rebuild.sh` this phase.

**i18next plural handling**
- **D-09:** DE plurals mirror EN `_one`/base-key structure exactly. For `vsShortPeriod`:
  - EN: `vsShortPeriod_one` = `"vs. 1 day earlier"`, `vsShortPeriod` = `"vs. {{count}} days earlier"`
  - DE: `vsShortPeriod_one` = `"vs. 1 Tag zuvor"`, `vsShortPeriod` = `"vs. {{count}} Tage zuvor"`
- **D-10:** No ICU MessageFormat plugin. i18next default DE plural rules (`one`/`other`) match EN shape. Zero new dependencies.

**German translation choices for new v1.2 UI terms**
- **D-11:** Base revenue noun is **"Umsatz"** in all 4 `dashboard.chart.series.*` keys (not Erlös, not Einnahmen).
- **D-12:** Year-specific chart series label: `"Umsatz {{year}}"` (not `"Umsatz im Jahr {{year}}"`).
- **D-13:** Delta prefix keeps the **"vs."** loanword (not "ggü.", not "im Vergleich zu"). Applies to all 4 `dashboard.delta.vs*` keys.
- **D-14:** Day-count relative: `"vs. {{count}} Tage zuvor"` / `"vs. 1 Tag zuvor"`. Nominative "Tage", not dative "Tagen".
- **D-15:** Concrete DE translations LOCKED:
  - `dashboard.chart.series.revenue` → `"Umsatz"`
  - `dashboard.chart.series.revenueMonth` → `"Umsatz {{month}}"`
  - `dashboard.chart.series.revenueQuarter` → `"Umsatz Q{{quarter}}"`
  - `dashboard.chart.series.revenueYear` → `"Umsatz {{year}}"`
  - `dashboard.delta.vsCustomPeriod` → `"vs. Vorperiode"`
  - `dashboard.delta.vsYear` → `"vs. {{year}}"`
  - `dashboard.delta.vsShortPeriod` → `"vs. {{count}} Tage zuvor"`
  - `dashboard.delta.vsShortPeriod_one` → `"vs. 1 Tag zuvor"`

**Milestone-level human verification checkpoint (SC5)**
- **D-16:** Plan 11-03 is a **manual-only walkthrough** — no new Playwright e2e spec this phase.
- **D-17:** Checkpoint artifact is the standard `11-VERIFICATION.md` produced by `gsd-verifier`. No separate `MILESTONE-AUDIT.md`.
- **D-18:** Checkpoint matrix: **4 date presets × 2 languages × all 3 cards + chart**. Per-row must pass (no drift, no stale overlay, em-dash where expected, German reads naturally).

### Claude's Discretion

- **Exact DE phrasing for `noBaseline` / `noBaselineTooltip`** (EN: `"No comparison period available"`) — recommended: `"Kein Vergleichszeitraum verfügbar"` for both (single translation keeps it simple), informal "du" tone per Phase 7 D-17. Alternative: compact `"Kein Vergleich möglich"` for the badge label + longer form for the tooltip.
- **Whether `formatChartSeriesLabel` keeps `t` injection or imports i18next directly** — default keep injection (matches Phase 10, preserves pure-function testability in verify scripts).
- **Exact signature and diff report format of `check-locale-parity.mts`** — Claude decides. Must exit non-zero on divergence, print both missing-in-DE and missing-in-EN, runnable standalone with `--experimental-strip-types`, no build step.
- **Number of plans and wave grouping** — ROADMAP pre-scopes 3 plans. Planner may collapse 11-01 into 11-02 if EN pass is trivial (all 10 keys already exist in `en.json` — "EN pass" really means "replace hardcoded strings with `t()` calls + add Intl helpers").
- **Whether to pre-wire `check-locale-parity.mts` into the Phase 11 verification loop as a hard gate** — recommended yes.

### Deferred Ideas (OUT OF SCOPE)

- **Intl.NumberFormat / currency formatting pass** — deferred from Phase 7, belongs in a later dashboard-polish phase.
- **Full codebase hardcoded-string sweep** — explicitly rejected in D-06.
- **Playwright e2e spec for 4 presets × 2 languages × card+chart** — rejected in D-16.
- **Parity script in `smoke-rebuild.sh`** — rejected in D-08. Rebuild harness stays focused.
- **Additional languages beyond DE/EN.**
- **ICU MessageFormat plugin.**
- **"Vorwoche / previous week" period labels** — mentioned in ROADMAP goal wording but no weekly preset currently exists in the filter UI. Revisit if a future phase adds one.
- **Retroactive tone review of existing 111 DE keys.**
- **Chart-color Settings customization** — deferred by Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| I18N-DELTA-01 | All new UI strings (badge labels, tooltips, secondary labels, chart legend) in both `en.json` and `de.json` in informal "du" tone; locale parity verified via the same set-diff check used in Phase 7 | Exact 10-key diff enumerated below. `smoke-rebuild.sh` step 9 already runs the Phase 7 parity check in Python; Plan 11-02 adds a persistent `.mts` equivalent at `frontend/scripts/check-locale-parity.mts` per D-08. D-15 locks every DE phrasing except the `noBaseline*` pair (discretion). |
| I18N-DELTA-02 | Period labels ("März"/"March", "Q1", "Vorwoche"/"previous week") locale-formatted via the existing i18next pattern or `Intl.DateTimeFormat` fallback; no new date library | `Intl.DateTimeFormat` with short locale codes `de`/`en` is a Node 18+ / evergreen browser native API with ECMA-402 guarantees for month names. `getLocalizedMonthName` helper per D-04 wraps a single constructor call; `formatChartSeriesLabel` already uses it in the month branch (just needs a named helper extraction + DE phrasing routed through `t()`). `formatPrevPeriodLabel` currently inlines `"vs. ${monthName}"` / `"vs. Vorperiode"` / `"vs. previous period"` — these are the hardcoded strings to extract in Plan 11-01/11-02. No "Vorwoche" string exists in the codebase today (no weekly preset). |
</phase_requirements>

## Standard Stack

### Already Installed (no additions allowed)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| i18next | ^26.0.4 | Runtime translation store | Already wired in `frontend/src/i18n.ts`; provides native `_one`/base plural resolution for both DE and EN without a plugin |
| react-i18next | ^17.0.2 | React hook bindings (`useTranslation`) | Already threaded through every dashboard component; `languageChanged` event triggers re-render of all subscribers |
| date-fns | ^4.1.0 | Date arithmetic (`subMonths`, `differenceInDays`) | Already used by `periodLabels.ts`; no date formatting needed — use Intl for that |
| Intl.DateTimeFormat | Built-in (V8/Node native, ECMA-402) | Locale-aware month names ("März", "April"…) | Zero-dependency, ~2 lines, full CLDR backing, identical output in browser and `node --experimental-strip-types` verify scripts |

**No new packages.** `CLAUDE.md` and CONTEXT D-01, D-10 prohibit dependency additions for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Intl.DateTimeFormat | `date-fns/locale` (already installed, `format(date, 'LLLL', { locale: de })`) | Works but redundant — would need to import both `de` and `en` locale submodules, adds bundler work, same output | Intl wins: no imports, no submodules, runs identically in verify scripts (no React/bundler) |
| i18next plural keys | `i18next-icu` + ICU MessageFormat | Richer plural/gender rules | Overkill — EN + DE share the same `one/other` split; default rules already work (proven by existing delta keys in EN) |
| t() injection in periodLabels.ts | `import i18next from "i18next"` directly | Fewer function arguments | Injection wins — preserves pure-function testability; verify scripts call `formatChartSeriesLabel(..., fakeT)` without spinning up i18next (see `verify-phase-10-01.mts` lines 28–42) |

## Architecture Patterns

### Established Project Structure (already in place)
```
frontend/
├── src/
│   ├── locales/
│   │   ├── en.json          # 119 keys — source of truth
│   │   └── de.json          # 109 keys — +10 needed for parity
│   ├── lib/
│   │   ├── periodLabels.ts  # EXTEND — add getLocalizedMonthName, route through t()
│   │   ├── dateUtils.ts     # Preset type source
│   │   └── deltaFormat.ts   # Phase 9 — not touched
│   ├── components/dashboard/
│   │   ├── KpiCardGrid.tsx  # Consumer of formatPrevPeriodLabel / formatPrevYearLabel
│   │   ├── DeltaBadge.tsx   # Receives noBaselineTooltip prop (already t() in KpiCardGrid)
│   │   ├── DeltaBadgeStack.tsx
│   │   └── RevenueChart.tsx # Consumer of formatChartSeriesLabel
│   └── i18n.ts              # keySeparator: false, fallbackLng: "en"
├── scripts/
│   ├── check-locale-parity.mts       # NEW — persistent infra (D-08)
│   ├── verify-phase-09-01.mts        # pattern reference
│   ├── verify-phase-09-02.mts        # pattern reference
│   └── verify-phase-10-01.mts        # pattern reference (closest sibling)
```

### Pattern 1: `node --experimental-strip-types` verify scripts

Direct reference: `frontend/scripts/verify-phase-10-01.mts` — 50 lines, imports `.ts` files with explicit extensions, defines a local `fakeT` that template-resolves i18next `{{var}}` placeholders, then runs `assertEq()` calls.

```typescript
// Source: frontend/scripts/verify-phase-10-01.mts (lines 28-42)
const fakeT = (key: string, opts?: Record<string, unknown>): string => {
  const templates: Record<string, string> = {
    "dashboard.chart.series.revenue": "Revenue",
    "dashboard.chart.series.revenueMonth": "Revenue {{month}}",
    "dashboard.chart.series.revenueQuarter": "Revenue Q{{quarter}}",
    "dashboard.chart.series.revenueYear": "Revenue {{year}}",
  };
  let out = templates[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      out = out.replace(`{{${k}}}`, String(v));
    }
  }
  return out;
};
```

Plan 11's verify script should ship both `fakeT_en` and `fakeT_de` templates and assert every new `periodLabels.ts` branch in both locales.

### Pattern 2: Intl.DateTimeFormat month-name extraction

```typescript
// Source: existing formatChartSeriesLabel in periodLabels.ts (line 137)
new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: "long" }).format(anchor)
// "de-DE" → "April" / "de" → "April" — identical output
```

Per D-03 and D-04, the new helper uses short locale codes and a year-2000 seed:

```typescript
// Proposed signature (D-04)
export function getLocalizedMonthName(
  monthIndex: number,       // 0..11
  locale: SupportedLocale,  // "de" | "en"
): string {
  return new Intl.DateTimeFormat(locale, { month: "long" })
    .format(new Date(2000, monthIndex, 1));
}
```

Note: the existing `periodLabels.ts` uses the regional `LOCALE_TAG` map (`"de-DE"` / `"en-US"`) for `formatPrevYearLabel` which needs the trailing period in DE short month (`"Apr. 2025"`). D-03 specifies short codes `"de"`/`"en"` for the new helper. **Both can coexist** — short codes are fine for the `month: "long"` use case (DE month names are identical across regions). Document the dual use explicitly in the module's header comment so Phase 12 doesn't "helpfully" unify them.

### Pattern 3: i18next plural resolution

`t("dashboard.delta.vsShortPeriod", { count: 3 })` → resolves `vsShortPeriod` (other) in both DE/EN when count ≠ 1.
`t("dashboard.delta.vsShortPeriod", { count: 1 })` → resolves `vsShortPeriod_one` in both DE/EN when count === 1.

Mechanism: i18next's `Intl.PluralRules` fallback is built-in; no plugin. Proven by the Phase 9 EN strings already present (`vsShortPeriod_one`).

### Pattern 4: Locale file alphabetization
New DE keys MUST be inserted in alphabetical position to match the (mostly-sorted) existing layout. `en.json` positions the 10 new keys at lines 64–73 in a contiguous `dashboard.chart.series.*` / `dashboard.delta.*` block; `de.json` has a gap between `dashboard.chart.xAxis` (line 63) and `settings.page_title` (line 64). That gap is where the 10 new DE keys go.

### Anti-Patterns to Avoid
- **Restructuring keys into nested objects** — the i18next config has `keySeparator: false`, flat dot-separated keys are the contract. Nesting breaks runtime lookups silently.
- **Hardcoding `"vs."` prefix in component JSX** — the prefix lives inside the locale string value, not in the component. Keeps DE and EN free to diverge later if UX wants.
- **Re-importing `i18next` inside `periodLabels.ts`** — would break `verify-phase-11-*.mts` which must run without a DOM/React runtime.
- **Calling `.toLocaleString("de", …)` for month names** — older, less predictable than `Intl.DateTimeFormat` with explicit `month: "long"` option.
- **Seeding month-name Intl with `new Date()` (today)** — month boundaries + DST can give wrong results on day 31 → use `new Date(2000, monthIndex, 1)` (D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| German month names | Hardcoded `["Januar", "Februar", …]` array | `Intl.DateTimeFormat("de", { month: "long" })` | ECMA-402 / CLDR-backed; zero maintenance; identical across Node + browser |
| Plural disambiguation | Manual `count === 1 ? X : Y` ternaries in JSX | i18next's `_one` suffix convention | Already works; tested; extends cleanly to other languages in future |
| Locale parity detection | Hand-written `Object.keys()` comparison per invocation | Single persistent `check-locale-parity.mts` script (D-08) | Catches every future regression with one invocation; matches Phase 7 pattern that already runs in `smoke-rebuild.sh` |
| DE informal "du" validation | Lint rule / regex for "Sie" | Human review at Plan 11-03 checkpoint + loanword preservation per Phase 7 D-18 | Tone quality is a judgement call, not a machine check; 10 strings is small enough for a human pass |
| Language-switch re-render plumbing | Custom event bus / global store sub | `useTranslation()` hook already in place | react-i18next already re-renders all `t()` consumers on `languageChanged`; no plumbing needed |

**Key insight:** Phase 11 is 90% data entry (JSON keys), 10% plumbing (one pure helper + one parity script). Any task that feels more complex than "copy the EN string, translate, run parity check" is probably over-engineered.

## Runtime State Inventory

This is an i18n + locale file phase — no stored data, no live service config, no OS registrations. Explicit per-category answers:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no DB rows reference new locale keys; `app_settings.language` stores only `"de"`/`"en"` short codes, which are unchanged; KPI data tables have no locale coupling | None |
| Live service config | **None** — no external services consume these strings; all rendering is client-side via the bundled JSON | None |
| OS-registered state | **None** — no service names, task descriptions, or scheduler entries | None |
| Secrets/env vars | **None** — no env vars reference locale key names or values | None |
| Build artifacts / installed packages | **None** — Vite import-resolves JSON at build time; no generated types, no `.d.ts` reexports, no precompiled locale bundles. Adding keys to `de.json` is picked up by Vite HMR and by `npm run build` automatically | None — but note: if Plan 11-01/11-02 replaces hardcoded strings with `t()` calls, **`tsc --build` must still pass** (any stale type cache in `node_modules/.vite` is self-healing on next dev/build) |

**Canonical answer to the rename question:** Phase 11 is a **rewrite** phase (new strings land, old hardcoded strings get deleted in-place), not a **rename** phase. No string keys already in use are being renamed. No migration concern.

## Common Pitfalls

### Pitfall 1: Forgetting to extract the `"vs. previous period"` / `"vs. Vorperiode"` strings from `formatPrevPeriodLabel`
**What goes wrong:** Adding the 10 new DE keys makes `check-locale-parity.mts` pass, but the actual `formatPrevPeriodLabel` function still returns hardcoded English `"vs. previous period"` for the custom-range generic fallback — so the DE user literally never sees a German string in that branch.
**Why it happens:** The 10-key diff only tells you what's missing from the JSON; it doesn't tell you what strings are still hardcoded in `.ts` source. The TODO comment at `periodLabels.ts:15-17` explicitly flags this.
**How to avoid:** Plan 11-01 (or 11-02, depending on how the planner collapses) must include a task that replaces **every literal English string in `periodLabels.ts`** with a `t()` call. The verify script must `grep -nF '"vs.' src/lib/periodLabels.ts` and assert zero matches in return values.
**Warning signs:** Verify script passes but a manual DE walk through a custom 5-day range shows "vs. 5 days earlier" instead of "vs. 5 Tage zuvor".

### Pitfall 2: Passing the i18n `SupportedLocale` ("de") where `Intl` expects a BCP-47 tag
**What goes wrong:** Mixing `"de"` (short, per D-03) with `"de-DE"` (regional, used by existing `LOCALE_TAG` map in `periodLabels.ts`) inside the same module. Both work for `month: "long"` but future options (`day`, `weekday`) may diverge.
**Why it happens:** D-03 locked short codes for the NEW helper, but the EXISTING `formatPrevYearLabel` uses regional codes and needs to keep doing so (it relies on DE-specific short-month-with-period rendering — `"Apr. 2025"`).
**How to avoid:** Keep two exports: the existing `LOCALE_TAG` (regional, for the prev-year short-month case) stays; add a new lookup or inline `locale` directly for `getLocalizedMonthName`. Document the intentional split in the module header.
**Warning signs:** Grepping for `LOCALE_TAG` across the repo shows unintended consolidation attempts.

### Pitfall 3: `verify-phase-*.mts` scripts require `.ts` extensions in imports
**What goes wrong:** Stripped-types Node refuses to resolve `from "../src/lib/periodLabels"`; you MUST write `from "../src/lib/periodLabels.ts"`.
**Why it happens:** `node --experimental-strip-types` only transpiles; it does not do extension-less module resolution the way `tsx` does.
**How to avoid:** Every import in `verify-phase-11-*.mts` and in `check-locale-parity.mts` uses explicit `.ts` (or `.json`) extensions. Follow `verify-phase-10-01.mts` exactly. `tsc` allows this because `allowImportingTsExtensions=true` is set in `tsconfig.app.json`.
**Warning signs:** Verify script fails with "ERR_MODULE_NOT_FOUND" on first run.

### Pitfall 4: JSON imports with `node --experimental-strip-types`
**What goes wrong:** `import en from "../src/locales/en.json"` may or may not work depending on Node version and the presence of `--experimental-default-type` / import assertions.
**How to avoid:** `check-locale-parity.mts` should use `readFileSync` + `JSON.parse` explicitly, not import-syntax:
```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const en = JSON.parse(readFileSync(resolve("frontend/src/locales/en.json"), "utf8"));
```
This is identical to what `smoke-rebuild.sh` step 9 already does in Python and sidesteps any JSON-import flag dance. Runs from repo root OR from `frontend/` — paths should be resolved relative to the script's own location (`fileURLToPath(import.meta.url)`) for robustness.
**Warning signs:** Script works on one Node version, breaks on another.

### Pitfall 5: i18next plural resolution edge case — `count: 0`
**What goes wrong:** `t("vsShortPeriod", { count: 0 })` in DE returns the `other` form: `"vs. 0 Tage zuvor"`. Grammatically OK but semantically weird — a 0-day range probably shouldn't render at all.
**Why it happens:** EN and DE both treat 0 as "other" (not "one") per CLDR. Not a bug, but a surprise.
**How to avoid:** Verify that `KpiCardGrid.tsx` / `formatPrevPeriodLabel` never passes `count: 0` (it doesn't — the `rangeLengthDays < 7` branch only fires when there's a nonzero range). No code change, just a documented assumption.
**Warning signs:** Custom 0-day range manifests a visually weird badge; unlikely to occur in practice.

### Pitfall 6: Alphabetical sort is approximate, not strict
**What goes wrong:** Planner tries to enforce strict alphabetical sort on the locale files and triggers a massive diff.
**Why it happens:** The existing files are "mostly sorted" — insertion order was preserved as keys were added. Enforcing perfect sort would reorder 100+ existing keys for zero user benefit.
**How to avoid:** Insert the 10 new DE keys in the gap between `dashboard.chart.xAxis` and `settings.page_title` (lines 63/64 of current `de.json`), in the same alphabetical order as they appear in `en.json` lines 64–73. Do not resort anything else.
**Warning signs:** Diff shows more than +10 line additions to `de.json`.

### Pitfall 7: Hardcoded `"Q"` prefix in quarter labels
**What goes wrong:** Someone "helpfully" splits `"Umsatz Q{{quarter}}"` into `"Umsatz"` + `t("quarter.q{{n}}")` to allow per-language quarter names.
**Why it happens:** Over-engineering — the plain `"Q1"` is already language-agnostic and globally understood.
**How to avoid:** Enforce D-02 in the verify script — assert the literal `"Q"` appears inside the resolved `t()` output for `revenueQuarter` in both locales. Reject any `quarter.q1..q4` new keys.
**Warning signs:** PR adds new keys that weren't in the D-15 locked list.

## Code Examples

### Example 1: Extended `getLocalizedMonthName` in periodLabels.ts

```typescript
// Source: proposed, based on CONTEXT D-04 + existing periodLabels.ts structure

/**
 * Locale-aware month name via Intl.DateTimeFormat.
 * Year-2000 seed avoids DST edge cases on day-31.
 * Short locale code per D-03 — regional variant not needed for `month: "long"`.
 */
export function getLocalizedMonthName(
  monthIndex: number,          // 0..11
  locale: SupportedLocale,     // "de" | "en"
): string {
  return new Intl.DateTimeFormat(locale, { month: "long" })
    .format(new Date(2000, monthIndex, 1));
}
```

### Example 2: `formatPrevPeriodLabel` routed through `t()`

```typescript
// Source: proposed rewrite of current periodLabels.ts:39-83
// Signature gains `t: ChartLabelT` to stay injection-based (matches Plan 10 pattern)

export function formatPrevPeriodLabel(
  preset: Preset | null,
  prevPeriodStart: Date | null,
  locale: SupportedLocale,
  t: ChartLabelT,
  rangeLengthDays?: number,
): string {
  if (preset === "thisYear" || preset === "allTime" || prevPeriodStart === null) {
    return EM_DASH;
  }

  if (preset === "thisMonth") {
    return `vs. ${getLocalizedMonthName(prevPeriodStart.getMonth(), locale)}`;
    // NOTE: the "vs. " prefix is still inline here because it's identical in DE and EN per D-13.
    // Alternative: add a dedicated `dashboard.delta.vsMonth` key = `"vs. {{month}}"` and route
    // through t() for full consistency with the other vs* keys. Planner's call.
  }

  if (preset === "thisQuarter") {
    const q = Math.floor(prevPeriodStart.getMonth() / 3) + 1;
    return `vs. Q${q}`;
  }

  if (preset === null) {
    if (rangeLengthDays !== undefined && rangeLengthDays < 7) {
      return t("dashboard.delta.vsShortPeriod", { count: rangeLengthDays });
    }
    return t("dashboard.delta.vsCustomPeriod");
  }

  return EM_DASH;
}
```

**Note:** the caller (`KpiCardGrid.tsx`) already has access to `t` via `useTranslation()`. Adding `t` as a trailing parameter is a non-breaking change to the existing call site on lines 75–80.

### Example 3: `check-locale-parity.mts`

```typescript
// Source: proposed — Node 22+ with --experimental-strip-types
// Exit 0 = parity, exit 1 = divergence with diff report
// Run: node --experimental-strip-types frontend/scripts/check-locale-parity.mts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const load = (rel: string): Record<string, string> =>
  JSON.parse(readFileSync(resolve(repoRoot, rel), "utf8"));

const en = load("frontend/src/locales/en.json");
const de = load("frontend/src/locales/de.json");

const enKeys = new Set(Object.keys(en));
const deKeys = new Set(Object.keys(de));

const missingInDe = [...enKeys].filter((k) => !deKeys.has(k)).sort();
const missingInEn = [...deKeys].filter((k) => !enKeys.has(k)).sort();

for (const k of missingInDe) console.log(`MISSING_IN_DE: ${k}`);
for (const k of missingInEn) console.log(`MISSING_IN_EN: ${k}`);

if (missingInDe.length === 0 && missingInEn.length === 0) {
  console.log(`PARITY OK: ${enKeys.size} keys in both locales`);
  process.exit(0);
}

console.log(
  `PARITY FAIL: ${missingInDe.length} missing in DE, ${missingInEn.length} missing in EN`,
);
process.exit(1);
```

### Example 4: Exact locale diff to resolve (verified 2026-04-12)

```
$ python3 -c "..." # see smoke-rebuild.sh step 9
EN keys: 119
DE keys: 109
MISSING_IN_DE:
  dashboard.chart.series.revenue
  dashboard.chart.series.revenueMonth
  dashboard.chart.series.revenueQuarter
  dashboard.chart.series.revenueYear
  dashboard.delta.noBaseline
  dashboard.delta.noBaselineTooltip
  dashboard.delta.vsCustomPeriod
  dashboard.delta.vsShortPeriod
  dashboard.delta.vsShortPeriod_one
  dashboard.delta.vsYear
MISSING_IN_EN: (none)
```

All 10 missing-in-DE keys have locked translations in D-15 except `noBaseline` / `noBaselineTooltip` (Claude's discretion — recommended `"Kein Vergleichszeitraum verfügbar"` for both).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded phrase arrays for month names | `Intl.DateTimeFormat` | Node 12+, all evergreen browsers since ~2018 | Zero-maintenance; full CLDR data; ECMA-402 guarantees |
| `i18next-icu` plugin for plurals | Built-in `_one` / base-key resolution with `Intl.PluralRules` | i18next 17+ ships native support | No plugin needed for DE/EN (both follow CLDR `one`/`other`) |
| `date-fns/locale` imports for month names | `Intl.DateTimeFormat` | General preference since ~2020 | Smaller bundle; no locale imports |
| Nested JSON locale trees | Flat dot-separated keys with `keySeparator: false` | Project D-19 (Phase 7) | Simpler lookup, easier parity diff, cleaner git diffs |

**Deprecated/outdated in this project:**
- None for Phase 11 scope. Phase 7 already locked the modern patterns.

## Open Questions

1. **Should `"vs. "` prefix live inside each locale key (duplicated 4+ times) or stay as an inline JSX literal?**
   - What we know: D-13 locks the **word** "vs." as a loanword in DE, but not its location. Current code has it inline; the new keys in D-15 bake it into the value strings (e.g. `"vs. Vorperiode"`).
   - What's unclear: Whether `formatPrevPeriodLabel`'s `thisMonth` branch should ALSO route through a `dashboard.delta.vsMonth` key (= `"vs. {{month}}"`) or keep the inline template literal.
   - Recommendation: **Keep the `vsMonth` string inline in the helper** — it's a pure prefix + Intl output, no translation risk, and adding another key just for parity theater bloats the set. DE and EN render identical format (`"vs. April"`). Document this explicitly so the verify script doesn't complain.

2. **Exact DE phrasing for `noBaseline` vs. `noBaselineTooltip`?**
   - What we know: EN uses the same string `"No comparison period available"` for both. User discretion in CONTEXT.
   - Recommendation: `"Kein Vergleichszeitraum verfügbar"` for both. Matches informal register (no "Sie"-form because the sentence has no verb); technically neutral; preserves the simple "badge label = tooltip" pattern that EN uses.
   - Surface at human-review checkpoint in Plan 11-02 or 11-03. User can pick a different phrasing without breaking any code path.

3. **Should `check-locale-parity.mts` replace the Python block in `smoke-rebuild.sh` step 9?**
   - What we know: D-08 explicitly rejects wiring the `.mts` script into `smoke-rebuild.sh` this phase (keep rebuild harness focused).
   - Recommendation: Leave the Python block in place. Revisit in a future infra-polish phase. Ship the `.mts` as a standalone dev tool / pre-commit candidate.

4. **Does the current `formatPrevPeriodLabel` signature break if we add `t` as a parameter?**
   - What we know: Current call site is `KpiCardGrid.tsx:75-80`, 4 positional args, `rangeLengthDays` trailing.
   - Recommendation: Add `t` as the **4th positional arg** (before `rangeLengthDays`), making the full signature `(preset, prevPeriodStart, locale, t, rangeLengthDays?)`. Update the single call site. The verify script already knows how to pass a `fakeT` for this shape (Plan 10 pattern).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (host, for verify scripts) | `node --experimental-strip-types` | ✓ (assumed — Phase 9/10 verify scripts already ran) | ≥22.x | — |
| Python 3 (host) | `smoke-rebuild.sh` step 9 Python parity check | ✓ (used by Phase 7+) | 3.x | None — not new to Phase 11 |
| Docker + docker compose | Full human-verification session (`docker compose up --build`) | ✓ (project baseline) | v2 | — |
| Playwright / chromium | NOT required Phase 11 | N/A | — | D-16 — no new e2e spec |
| Intl.DateTimeFormat | Runtime (browser + Node verify) | ✓ (V8 native, full ICU) | ECMA-402 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node --experimental-strip-types` + ad-hoc assertion scripts (no vitest/jest — enforced by Phase 9 D-08-style "no new deps" invariant) |
| Config file | None — scripts are self-contained |
| Quick run command | `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` |
| Full suite command | All three: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts && node --experimental-strip-types frontend/scripts/verify-phase-11-01.mts && node --experimental-strip-types frontend/scripts/verify-phase-11-02.mts` (names subject to planner's final plan layout) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| I18N-DELTA-01 | EN and DE locale files have identical key sets | parity check | `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` | ❌ Wave 0 — new script |
| I18N-DELTA-01 | New DE keys match D-15 phrasings exactly | unit | `node --experimental-strip-types frontend/scripts/verify-phase-11-02.mts` (asserts `de.json` has literal D-15 values) | ❌ Wave 0 — new script |
| I18N-DELTA-01 | `dashboard.delta.vsShortPeriod` plural resolves correctly (count=1 vs count=3) in DE | unit | Same verify script — calls real i18next with DE resources and asserts `t("...", { count: 1 })` vs `count: 3` outputs | ❌ Wave 0 |
| I18N-DELTA-01 | Informal "du" tone reviewed | manual-only | Human review at Plan 11-03 checkpoint | N/A |
| I18N-DELTA-02 | `getLocalizedMonthName(3, "de")` === `"April"`, `(3, "en")` === `"April"`, `(0, "de")` === `"Januar"`, `(0, "en")` === `"January"` | unit | Same verify script | ❌ Wave 0 |
| I18N-DELTA-02 | `formatChartSeriesLabel` routes through `t()` in all four preset branches for both locales | unit | Existing `verify-phase-10-01.mts` pattern extended with DE fakeT | ❌ Wave 0 |
| I18N-DELTA-02 | `formatPrevPeriodLabel` uses `t()` for `vsCustomPeriod` and `vsShortPeriod` branches in DE | unit | New verify script | ❌ Wave 0 |
| I18N-DELTA-02 | No hardcoded English strings remain in `periodLabels.ts` return values | grep assertion | `grep -nE '"vs\.\s+(previous|[0-9])' frontend/src/lib/periodLabels.ts` must return zero matches | ❌ Wave 0 (inline in verify script) |
| SC4 (re-render on language switch) | Cards + chart legend re-render without refresh | manual-only | Plan 11-03 human walkthrough | N/A — react-i18next already handles this via `languageChanged` event, no new code path to cover |
| SC5 (end-to-end matrix) | 4 presets × 2 languages × 3 cards + chart | manual-only | Plan 11-03 checkpoint, gsd-verifier produces `11-VERIFICATION.md` | N/A |

### Sampling Rate
- **Per task commit:** `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` (< 1 s, hard gate)
- **Per wave merge:** Full suite (parity + unit verify scripts + `npm run build` + `tsc -b` in `frontend/`)
- **Phase gate:** Full suite green + manual Plan 11-03 walkthrough passes before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/scripts/check-locale-parity.mts` — persistent infra per D-08
- [ ] `frontend/scripts/verify-phase-11-01.mts` (or 11-02.mts depending on plan split) — unit-tests `getLocalizedMonthName`, `formatPrevPeriodLabel` new branches, `formatChartSeriesLabel` DE branches, and literal D-15 DE string values in `de.json`
- [ ] No framework install — uses existing `node --experimental-strip-types` pattern
- [ ] No shared fixtures — each script is self-contained per Phase 9/10 convention

## Project Constraints (from CLAUDE.md)

- **No bare-metal dependencies** — Phase 11 adds zero runtime deps; uses only Intl (built-in) and existing i18next/react-i18next. ✓
- **`docker compose` v2 syntax** — if any plan includes manual-verification-via-rebuild, use `docker compose up --build` (not `docker-compose`). ✓
- **Locale keys flat, `keySeparator: false`** — enforced by existing `i18n.ts`; new DE keys must follow the same dot-separated convention. ✓
- **Informal "du" tone** — carried over from Phase 7 D-17; locked by CONTEXT D-11..D-15 and reviewed at Plan 11-03 checkpoint. ✓
- **Loanwords preserved** (Dashboard, Upload, KPI, Logo + new: "vs.") — D-13. ✓
- **No new React state libs** — TanStack Query handles server state; Phase 11 adds no client state. ✓
- **GSD workflow enforcement** — every file change goes through a plan in this phase. ✓

## Sources

### Primary (HIGH confidence)
- `.planning/phases/11-i18n-contextual-labels-and-polish/11-CONTEXT.md` — every decision D-01..D-18 is binding
- `.planning/REQUIREMENTS.md` — I18N-DELTA-01, I18N-DELTA-02 definitions
- `.planning/ROADMAP.md` §Phase 11 — SC1–SC5
- `frontend/src/locales/en.json` — 119 keys, source of truth (read in full)
- `frontend/src/locales/de.json` — 109 keys, target (read in full)
- `frontend/src/lib/periodLabels.ts` — Phase 9/10 module to extend (read in full, includes explicit `TODO(Phase 11)` comment at lines 15-17)
- `frontend/src/i18n.ts` — confirmed `keySeparator: false`, `fallbackLng: "en"`, resources loaded statically
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — confirmed consumer pattern lines 75–83 (`formatPrevPeriodLabel`, `formatPrevYearLabel`, `noBaselineTooltip = t(...)`)
- `frontend/src/components/dashboard/DeltaBadge.tsx` — confirmed `noBaselineTooltip` is threaded in as a prop (not imported directly)
- `frontend/scripts/verify-phase-10-01.mts` — closest sibling pattern for new verify scripts
- `scripts/smoke-rebuild.sh` lines 114–125 — existing Python parity check (reference for `.mts` rewrite semantics)
- `frontend/package.json` — confirmed versions: i18next ^26.0.4, react-i18next ^17.0.2, date-fns ^4.1.0

### Secondary (MEDIUM confidence)
- ECMA-402 / Intl.DateTimeFormat documentation — `month: "long"` with `"de"`/`"en"` short locales returns CLDR-backed full month names; verified working in existing `periodLabels.ts:137-138`

### Tertiary (LOW confidence)
- None. Every claim in this document is grounded in a file read from the working tree.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified from `package.json` on disk
- Architecture: HIGH — every pattern grounded in existing files read in full
- Pitfalls: HIGH — most pitfalls derive directly from code inspection (e.g., Pitfall 1 from the TODO comment at `periodLabels.ts:15-17`, Pitfall 2 from the dual `LOCALE_TAG` usage in the same file, Pitfall 3 from the `.ts` extension convention in `verify-phase-10-01.mts:10-11`)
- Locale diff: HIGH — re-ran the exact Python script from `smoke-rebuild.sh` step 9; CONTEXT D-06's enumeration matches byte-for-byte
- DE translation choices: N/A — locked by user in CONTEXT D-15

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — Phase 11 scope is stable, no upstream breaking changes expected in i18next/react-i18next/Node)
