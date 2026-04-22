# Phase 59: A11y & Parity Sweep — Research

**Researched:** 2026-04-22
**Domain:** Frontend quality-gate sweep (i18n parity, a11y focus/name, dark-mode tokenization) over v1.19 surfaces
**Confidence:** HIGH

## Summary

v1.19 (Phases 54–58) delivered 5 shared primitives (`Toggle`, `Textarea`, `Select`, `Dropdown`, `SectionHeader`, `DeleteDialog`, `DeleteButton`), migrated every raw `<input>`/`<select>`/`<button>`/`<textarea>` consumer, relocated chrome (NavBar → SubHeader + Breadcrumb), and shipped a PollNowButton size-variant + Sensors layout parity. 80 frontend files touched across phases 54–58.

The infrastructure for this sweep is mostly already in place: a canonical locale parity script (`frontend/scripts/check-locale-parity.mts`), a Phase 57 CI-guard runner that already invokes it, a Tailwind v4 `@theme` + `.dark` token system with a `--ring` variable, and 527/527 flat-key parity in `en.json` / `de.json` as of 2026-04-22. The sweep is primarily **audit + gate-tightening** over a known file list — not new infrastructure.

Three notable misalignments between CONTEXT.md assumptions and shipped code:

1. **Focus-ring spec drift.** CONTEXT.md D-04 names `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none`. Shipped primitives (`Button`, `Input`, `Textarea`, `Select`) use a different canonical pattern: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (no offset, uses border swap + 3px semi-transparent ring). Only `checkbox.tsx` uses the CONTEXT.md spec. Pick one and converge — the shipped pattern is the majority.
2. **`dark:` variants are widespread in primitives.** STATE.md cross-cutting hazard #3 says "No `dark:` Tailwind variants (tokens only)", but `button.tsx`, `input.tsx`, `textarea.tsx`, `badge.tsx`, `calendar.tsx`, `select.tsx` all use `dark:` variants (16 occurrences across 8 files). The Phase 57 guard bans `dark:` only in the three new primitives (`section-header.tsx`, `delete-dialog.tsx`, `delete-button.tsx`) — not globally. A blanket sweep would require retokenizing borrowed shadcn/ui patterns. Recommendation: accept `dark:` in shipped primitives (they resolve tokens via `dark:border-input` etc., not hex) and scope A11Y-03 literally to "zero hardcoded color literals," leaving `dark:` variants permitted.
3. **Hardcoded literals already at baseline zero** except the one CONTEXT.md-acknowledged exception. Grep for hex/rgb/hsl in `.tsx` returns exactly one match: `frontend/src/components/settings/ColorPicker.tsx:66` — matches the allowlist. Grep for inline `style={{ color/background/... }}` returns two hits, one of which is a grid-template-columns string (benign) and one is the ColorPicker swatch. So A11Y-03's literal-scrub is a lock-in gate, not a hunt.

**Primary recommendation:** Decompose this phase into 4 plans along axes: (1) locale-parity tooling hardening (du-tone lint + CI wiring), (2) canonical focus-ring alignment, (3) CI guard consolidation (color-literal + `dark:` policy + aria-label coverage), (4) manual dark-mode screenshot audit per surface. Keep the existing `check-locale-parity.mts` as the parity SSOT — extend, don't replace.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Scope boundary:** "Surfaces touched by v1.19" = strict file list derived from `git log` across phase 54–58 commits. Direct render parents (e.g., `App.tsx`, `AppShell.tsx`, `SubHeader.tsx`) are OUT unless an a11y bug is proven.
- **D-02 Parity gate:** Add an automated parity gate (vitest or script invoked by CI/verification) asserting `en.json` key-count == `de.json` key-count. Replaces ad-hoc `wc -l`.
- **D-03 du-tone validation two-layer:** (a) human DE-copy review on new/renamed keys, (b) lint heuristic flagging `Sie|Ihnen|Ihre|Ihr` and capitalized formal-German address forms.
- **D-04 Focus-ring utility:** Introduce canonical `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` (exact tokens TBD during research). Shared primitives bake it in as default; one-offs opt in.
- **D-05 Color-literal policy:** Strict zero hex/rgb/named-color in `className` and inline `style` for STATIC surface colors. Data-driven colors (CSS variables, user-chosen) allowed. Allowlist starts with `ColorPicker.tsx` swatch. New exceptions require in-file justification.
- **D-06 Dark-mode audit two-pronged:** (a) automated literal grep as hard gate, (b) manual browser pass per migrated surface with screenshot in `59-VERIFICATION.md`.
- **D-07 Pre-existing TS debt deferred:** `npm run build` errors from phases 56/57/58 stay in their `deferred-items.md`; do not gate Phase 59.

### Claude's Discretion

- Exact Tailwind token names for focus ring (e.g., whether to introduce `ring-ring-hc` or rely on existing `--ring`).
- How to structure the parity-gate test (standalone script vs vitest assertion vs CI step) — based on existing test infra.
- Plan decomposition: single sweep plan vs three plans per A11Y requirement — planner's call.

### Deferred Ideas (OUT OF SCOPE)

- TypeScript debt cleanup phase (v1.20+ candidate).
- Higher-contrast focus-ring variant (`ring-ring-hc`) — not needed for A11Y-02.
- Broader route-level audit beyond the strict file list — queue as follow-up if issues surface.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-01 | Full DE/EN i18n key parity + du-tone DE copy for v1.19 keys | `check-locale-parity.mts` exists; 527/527 as of today. Needs: du-tone heuristic + CI wire-up. See §Locale Parity Tooling. |
| A11Y-02 | All new/migrated controls have accessible name + visible focus ring in light + dark | Toggle has `role="radiogroup"` + `aria-label`. Button/Input/Textarea/Select carry canonical focus ring (see §Focus-Ring Inventory). Need: audit 80-file surface list for missing `aria-label` on icon-only controls. |
| A11Y-03 | Zero hardcoded color literals + no contrast regressions on migrated surfaces | Current baseline: 1 hex literal in `.tsx` (ColorPicker, allowlisted). Token system is Tailwind v4 `@theme` + `:root` / `.dark` oklch. See §Color Token System. |

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** Before Edit/Write tools, route through a GSD command. Phase 59 is already under `/gsd:plan-phase` / `/gsd:execute-phase` — respected.
- **Stack lock-ins relevant here:** React 19.2.5, TypeScript 5.x, Tailwind CSS v4.2.2 (CSS-first config, no `tailwind.config.js`), shadcn/ui copy-paste pattern in `components/ui/`, TanStack Query for server state.
- **No backend changes** (v1.19 is pure frontend consistency milestone, cross-cutting hazard #10).

## v1.19 Surface Inventory (from `git log --since=2026-04-21`)

80 files total. Canonical list for D-01 scope (strict):

### Shared primitives (ship new or modified)
- `frontend/src/components/ui/toggle.tsx`, `toggle.test.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/textarea.tsx`, `textarea.test.tsx`
- `frontend/src/components/ui/select.tsx`, `select.test.tsx`
- `frontend/src/components/ui/dropdown.tsx`, `dropdown.test.tsx`
- `frontend/src/components/ui/section-header.tsx`, `__tests__/section-header.test.tsx`
- `frontend/src/components/ui/delete-dialog.tsx`, `delete-dialog.test.tsx`
- `frontend/src/components/ui/delete-button.tsx`, `__tests__/delete-button.test.tsx`

### Chrome + navigation (Phase 56)
- `frontend/src/components/NavBar.tsx` (stripped to identity-only)
- `frontend/src/components/SubHeader.tsx` (hosts Sales/HR + Upload + /sensors slots)
- `frontend/src/components/Breadcrumb.tsx`, `Breadcrumb.test.tsx`
- `frontend/src/components/UserMenu.tsx`, `UserMenu.test.tsx`
- `frontend/src/lib/breadcrumbs.ts`, `breadcrumbs.test.ts`
- `frontend/src/components/LanguageToggle.tsx`, `ThemeToggle.tsx`
- `frontend/src/App.tsx` (SensorTimeWindowProvider hoist)

### Admin section migrations (Phase 57)
- `frontend/src/signage/pages/MediaPage.tsx`, `PlaylistsPage.tsx`, `SchedulesPage.tsx`, `DevicesPage.tsx`, `SignagePage.tsx`, `PlaylistEditorPage.tsx`
- `frontend/src/signage/components/MediaInUseDialog.tsx`, `ScheduleEditDialog.tsx`, `MediaPickerDialog.tsx`, `PlaylistItemList.tsx`, `TagPicker.tsx`, `MediaRegisterUrlDialog.tsx`, `MediaUploadDropZone.tsx`, `DeviceEditDialog.tsx`, `WeekdayCheckboxRow.tsx`, `UptimeBadge.tsx`
- `frontend/src/pages/SensorsSettingsPage.tsx`, `LauncherPage.tsx`, `SettingsPage.tsx`
- `frontend/src/components/settings/sensors/SensorRowForm.tsx`, `SnmpWalkCard.tsx`
- `frontend/src/components/settings/PersonioCard.tsx`, `ColorPicker.tsx`, `LogoUpload.tsx`
- `frontend/src/components/UploadHistory.tsx`, `DropZone.tsx`
- `frontend/src/components/dashboard/EmployeeTable.tsx`, `SalesTable.tsx`, `HrKpiCharts.tsx`, `RevenueChart.tsx`

### Sensors parity (Phase 58)
- `frontend/src/components/sensors/PollNowButton.tsx`
- `frontend/src/pages/SensorsPage.tsx`

### Out of scope (touched but non-UI)
- `frontend/src/player/PlaybackShell.tsx` — player bundle, separate a11y domain
- `frontend/src/signage/lib/*` — API client + types, no UI surface
- `frontend/src/docs/*/admin-guide/digital-signage.md` — markdown docs, not chrome

**Counts**:
- Touched `.tsx` files in scope: ~55
- Files with `focus-visible:` or `focus:` utilities: 12 (baseline — uneven coverage)
- Files with `aria-label`: 41 (baseline — good but not complete)
- Files with hex/rgb/hsl literal in `.tsx`: **1** (ColorPicker, allowlisted)

## Color Token System (shipped, verified)

**File:** `frontend/src/index.css`

- **Tailwind v4 CSS-first config** via `@import "tailwindcss"` + `@theme inline { ... }`.
- **Dark mode:** `@custom-variant dark (&:is(.dark *))` — a class-based variant on ancestor `.dark`.
- **Tokens defined in oklch** under `:root { --background, --foreground, --primary, --ring, --border, --input, --destructive, --card, --popover, ... }` and overridden under `.dark { ... }`.
- **Ring token:** `--ring: oklch(0.708 0 0)` light / `oklch(0.556 0 0)` dark. Accessed in Tailwind as `ring-ring`, `border-ring`, `focus-visible:ring-ring/50`.
- **Base layer:** `* { @apply border-border outline-ring/50; }` — default outline is token-driven.
- **Exceptions in `index.css`:** Hex literals `#24292e #d73a49 #6f42c1 #005cc5 #032f62 #e36209 #6a737d #22863a #735c0f #f0fff4 #b31d28 #ffeef0 #ff7b72 #a5d6ff #8b949e #d2a8ff #79c0ff #ffa657` — all inside `.hljs` syntax-highlighting rules (GitHub Light + Dark themes). These are NOT component styles and NOT in-scope for A11Y-03's `className`/inline-`style` grep. Document as an explicit allowlist entry for `index.css` CSS-file-scoped literals.

**Implication for D-05 grep:** Scope must be `.tsx` files' `className=` strings and inline `style=` objects — NOT `.css` files. The Phase 57 CI guard already scans `.ts|.tsx|.js|.jsx|.mjs|.cjs` and correctly skips `.css`. Reuse that walker.

## Focus-Ring Inventory (shipped, verified)

| File | Utility used | Notes |
|------|--------------|-------|
| `button.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | Base + `destructive` variant overrides ring color |
| `input.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | Same pattern |
| `textarea.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | Same pattern (Phase 55-01 D-08 parity) |
| `select.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | Same pattern |
| `badge.tsx` | `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` | Note `[3px]` arbitrary vs `ring-3` — drift |
| `checkbox.tsx` | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | **Different** — matches CONTEXT.md D-04 spec, not the Button/Input family |
| `toggle.tsx` | **None** — no `focus-visible:` on the `<button role="radio">` elements | **Gap** — A11Y-02 applies; Toggle primitive lacks a visible focus ring |
| `delete-button.tsx`, `section-header.tsx`, `delete-dialog.tsx` | Inherit from `Button` / dialog primitives | OK — composes `<Button />` |
| `dropdown.tsx` | Trigger is caller-provided (usually `<Button />`) | Menu items inherit base-ui highlight; verify `data-highlighted` styling resolves focus ring |

**Critical finding:** The `Toggle` primitive (the v1.19 flagship component) does **not** render a focus ring. Its `<button>` elements have no `focus-visible:` utility. This is A11Y-02 's biggest explicit gap and must be a top-priority plan.

**Decision surface for planner (D-04 interpretation):**

CONTEXT.md D-04 names one spec; shipped primitives use another. Two paths:

- **Path A (recommended — converge to shipped pattern):** Standardize on `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`. Rationale: 4 primitives already use it; shadcn/ui v2026 pattern; `ring-offset-2` isn't needed when the border itself swaps to `border-ring`. Change `checkbox.tsx` to match. Apply to `toggle.tsx` segments.
- **Path B (converge to CONTEXT.md spec):** Retrofit all 4 primitives to `ring-2 ring-ring ring-offset-2 outline-none`. Rationale: matches D-04 verbatim. Higher churn (4 primitives + every variant class chain).

Both produce a visible ring in light + dark via `--ring`. Path A is lower-risk; Path B honors the letter of the decision. Flag this for planner/user decision — it's explicitly in Claude's Discretion per CONTEXT.md.

## Locale Parity Tooling (shipped + gap)

**Shipped:**
- `frontend/scripts/check-locale-parity.mts` — flat-key diff between `en.json` and `de.json`. Exits 1 with `MISSING_IN_DE` / `MISSING_IN_EN` lines on drift.
- `frontend/scripts/check-phase-57-guards.mts` — invokes the parity script as Guard 5 (belt-and-suspenders).
- Both scripts assume **flat dotted-key JSON** (Object.keys contract — verified against `Phase 46 P01` locked convention).
- As of 2026-04-22: `en.json` = `de.json` = 527 keys.

**Gaps relative to A11Y-01:**

1. **No du-tone lint.** CONTEXT.md D-03 requires a heuristic flagging `Sie|Ihnen|Ihre|Ihr`. One current hit: `de.json:506` — `"body": "Dieser Artikel konnte nicht geladen werden. Versuchen Sie, die Seite zu aktualisieren."` (formal `Versuchen Sie`). This is a real violation that the new lint would catch.
2. **Parity script not wired to a persistent CI entrypoint.** Only invoked transiently by `check:phase-57`. Phase 59 should either (a) add `npm run check:i18n-parity` as a top-level `package.json` script + hook into `check:phase-57`'s successor, or (b) promote into a vitest assertion.
3. **Scope of "new/renamed v1.19 keys":** derive from `git log --since=2026-04-21 -- frontend/src/locales/` diffs. See §Methodology for concrete commands.

**Recommended implementation (per D-03):**

```ts
// frontend/scripts/check-de-du-tone.mts
// Scans de.json VALUES (not keys) for formal-German red flags.
const FORMAL_TOKENS = /\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\b/g;
// Hit-list prints file:key:value so reviewers can approve/fix each.
```

The `Versuchen Sie` baseline hit is borderline: imperative formal. Du-tone replacement: `Versuche, die Seite zu aktualisieren` or `Lade die Seite neu`. Planner decides: fix as part of 59 (in scope because the key was touched in v1.13 doc work but reads out-of-milestone) or allowlist it.

## Standard Stack

### Core (already installed, verified against `package.json`)

| Library | Version | Purpose | Role in Phase 59 |
|---------|---------|---------|------------------|
| react-i18next | 17.0.2 | i18n runtime | Consumer of `en.json`/`de.json` — read-only for sweep |
| i18next | 26.0.4 | i18n core | — |
| tailwindcss | 4.2.2 | Utility CSS + token system | Source of `ring-ring`, `bg-background`, `.dark` variant |
| @base-ui/react | 1.3.0 | Headless primitives backing Button/Input/Select/Dropdown/Dialog | Already composes focus semantics; we style on top |
| vitest | 4.1.4 + @testing-library/* | Test runner | Parity-gate test can live here if planner chooses |
| eslint | 9.39.4 + typescript-eslint 8.58.0 | Lint | Potential host for du-tone custom rule (not recommended — scope it as a script) |

### Not installed (optionally considered)

| Library | Version | Purpose | Why NOT recommend |
|---------|---------|---------|-------------------|
| eslint-plugin-jsx-a11y | — | Lint rules for missing `alt`, `aria-*`, labels | **Overkill for 59**. 80-file sweep is small enough for manual + grep. Adds new dep + rule-tuning overhead. Flag as deferred if broader a11y becomes a milestone. |
| @axe-core/react / vitest-axe | — | Runtime axe violations | Redundant with D-06 manual browser pass; STATE.md already notes "v1.9 D-12 waiver: axe + WebAIM skipped at operator request" — keep the waiver. |

### Installation
No new installs required for Phase 59 implementation.

**Version verification (2026-04-22):**
- `tailwindcss@4.2.2` — present in package.json devDependencies, matches CLAUDE.md stack lock.
- `i18next@26.0.4` / `react-i18next@17.0.2` — present.
- `vitest@4.1.4` — present.
No registry checks needed; we add no new deps.

## Architecture Patterns

### Pattern: Tailwind v4 CSS-first token reference
Consume tokens via utility names derived from `@theme`:
- Colors: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-destructive`, `ring-ring`, `border-ring`, `border-input`, `bg-popover`.
- Dark-mode resolution: automatic via `.dark` ancestor + `@custom-variant dark`.

### Pattern: shadcn/ui focus-ring (shipped majority)
```tsx
className={cn(
  "… transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  className
)}
```
Source: `frontend/src/components/ui/input.tsx:12`, `button.tsx:19`.

### Pattern: Accessible name via `aria-label` on icon-only controls
Example (shipped): `<Button size="icon-xs" aria-label={t('ui.delete.trigger_aria')} onClick={...}><TrashIcon/></Button>` — used by `DeleteButton`. Phase 57 already enforced this; Phase 59 audits the long tail (e.g., `PollNowButton`, `UserMenu` avatar trigger, breadcrumb chevrons, chart-type Toggle triggers).

### Anti-Patterns to Avoid

- **Introducing new `focus-visible:` variants per component.** Pick one spec, apply uniformly.
- **Using `focus:` (no `-visible`) on buttons.** Keyboard-only ring is the a11y target; `:focus` fires on mouse click too and creates visual noise — use `focus-visible:`.
- **Nesting `dark:` inside component files when a token already handles it.** E.g., `dark:bg-card` is redundant against `bg-card` when `--card` is defined in `.dark`. Shipped code does this in a few places (`button.tsx:25` — `dark:border-input dark:bg-input/30`) — accept as shadcn/ui idiom, don't ban globally.
- **Using `<div onClick>` for actionable controls.** Always a shared `Button`/`Toggle`/`DeleteButton`. Phase 55 CTRL-02 closed most of these; Phase 59 audits residuals.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| i18n parity diff | Custom wc/grep loop | Existing `check-locale-parity.mts` | Already handles set-diff + sorted output + exit code |
| du-tone lint | Full NLP parser | Regex over `de.json` values for `\b(Sie\|Ihnen\|Ihre?\|Ihrer\|Ihres)\b` | Heuristic is D-03's explicit contract — keep it shallow |
| Color-literal scan | New walker | Extend `check-phase-57-guards.mts`'s Node fs walker | Already scans `.ts\|.tsx\|.js\|.jsx\|.mjs\|.cjs`, strips `// comments`, has SELF_PATH exempt |
| Focus-visible audit | Manual eyeball of 80 files | Grep: controls lacking `focus-visible:` inside `components/ui/*.tsx` + consumer-level buttons | Finite set |
| Accessible-name audit | axe | Grep for `<button>` / `<IconButton>` call sites without `aria-label` and without a child text node | 80-file scope; grep is tractable |

## Runtime State Inventory

Not applicable — Phase 59 is a pure frontend static-analysis + UI-audit sweep, no stored data, services, OS registrations, secrets, or build-artifact renames.

- **Stored data:** None — verified by reviewing phase scope (no DB migrations, no API changes).
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None — Tailwind v4 JIT recompiles from `index.css` each dev run; no stale artifacts persist.

## Common Pitfalls

### Pitfall 1: Scope creep into untouched chrome
**What goes wrong:** Auditor discovers an a11y issue in `App.tsx` or a non-migrated page (e.g., `/docs`) and expands the sweep.
**Why:** Genuine fix impulses.
**How to avoid:** Enforce D-01 literally via the §v1.19 Surface Inventory list above. Anything not in that list needs a proven bug + user approval to include.
**Warning signs:** Plan tasks reference files not in the git-log output.

### Pitfall 2: Focus-ring spec mismatch (D-04 drift)
**What goes wrong:** Planner applies CONTEXT.md D-04 verbatim and retrofits Button/Input/Textarea/Select; ends up with two focus-ring conventions in the repo.
**Why:** CONTEXT.md was written before the shipped primitives were re-inspected.
**How to avoid:** Planner explicitly picks Path A or Path B (see §Focus-Ring Inventory) and records the decision in PLAN.md. Checkbox either migrates or stays based on the choice.

### Pitfall 3: Accepting `dark:` ban at face value
**What goes wrong:** A task treats cross-cutting hazard #3 ("No `dark:` Tailwind variants") as a gate and starts deleting `dark:` from `button.tsx` / `input.tsx`. Those variants encode token *overrides* (not hex literals) and removing them changes visual output.
**Why:** Hazard wording is imprecise; Phase 57 guard only applies to three specific primitives.
**How to avoid:** Narrow A11Y-03's literal ban to hex/rgb/hsl/named-color strings in `className` and inline `style`, not to `dark:` variants. Document the distinction in the PLAN.

### Pitfall 4: `.css` files in the literal-scan
**What goes wrong:** Grep for `#[0-9a-f]{3,6}` includes `index.css` and trips 30+ matches inside `.hljs` syntax-highlighting rules.
**Why:** Syntax highlighting genuinely needs hex.
**How to avoid:** Scope scan to `.tsx/.jsx` files only. Explicitly allowlist `index.css` `.hljs` rules as file-level exception. Document in PLAN.

### Pitfall 5: flat-key vs nested-key drift
**What goes wrong:** Someone adds a nested i18n key (e.g., `"ui": { "delete": {...} }`); `check-locale-parity.mts` uses `Object.keys(...)` on the top level and silently misses nested diffs.
**Why:** Phase 46 P01 locked flat-dotted convention but it's not enforced by the parity script.
**How to avoid:** Either (a) add a second guard asserting no nested objects in `en.json`/`de.json`, or (b) recursively flatten before set-diff. Recommendation: (a) — one-liner, and rejecting nested shape at write-time is clearer.

### Pitfall 6: Toggle missing focus ring gets deprioritized
**What goes wrong:** Toggle focus-ring fix is bundled with a "general audit" plan; slips.
**Why:** It looks like a minor CSS line.
**How to avoid:** Give Toggle its own task. It's the v1.19 flagship primitive and drives language/theme/chart-type/Sales-HR — 5 high-traffic consumers.

### Pitfall 7: du-tone false positives
**What goes wrong:** The regex `\bIhr\b` matches legitimate German possessive `ihr` (lowercase) if the regex is case-insensitive, or the plural formal `Ihre Punkte` appears in a quote.
**Why:** German orthography.
**How to avoid:** Case-sensitive regex (`\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\b`), and emit line+key output so a human reviews each. Do NOT auto-fix. D-03 is explicit that this is a "lint heuristic … so regressions surface early" — not a rewrite.

### Pitfall 8: Icon-only controls without accessible names
**What goes wrong:** `<Button size="icon"><TrashIcon /></Button>` with no `aria-label` — screen-reader reads "button" only.
**Why:** Icon-only patterns are easy to forget.
**How to avoid:** Grep pattern: `<Button[^>]*size=.(icon|icon-xs|icon-sm).[^>]*>(?![^<]*aria-label)` — flag anything that has an `icon`-size variant without an `aria-label` attribute. Also scan `UserMenu.tsx` trigger and breadcrumb separator links.

## Code Examples

### Canonical focus-ring (Path A — shipped)
```tsx
// frontend/src/components/ui/button.tsx (verified shipped)
"… outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 …"
```

### Toggle focus-ring fix (proposed for Plan A11Y-02)
```tsx
// frontend/src/components/ui/toggle.tsx — segment <button> className:
const base = "flex-1 relative z-10 rounded-full h-6 px-3 text-sm inline-flex items-center justify-center gap-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20";
// Note: z-20 so ring isn't clipped by the animated indicator on top.
```

### Parity test (proposed vitest shape — if D-02 routes via vitest instead of script)
```ts
// frontend/src/locales/parity.test.ts
import en from "./en.json";
import de from "./de.json";
test("DE/EN flat-key parity", () => {
  const enKeys = Object.keys(en).sort();
  const deKeys = Object.keys(de).sort();
  expect(deKeys).toEqual(enKeys);
});
test("DE values avoid formal Sie-form (du-tone)", () => {
  const formal = /\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\b/;
  const hits = Object.entries(de).filter(([_, v]) =>
    typeof v === "string" && formal.test(v)
  );
  expect(hits, `Formal-German hits: ${JSON.stringify(hits, null, 2)}`).toEqual([]);
});
```

### Color-literal grep extension (proposed, adds to existing guard walker)
```ts
// In a new scripts/check-color-literals.mts using the same walker from
// check-phase-57-guards.mts:
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB_FN = /\b(rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/;
const NAMED = /\b(red|blue|green|yellow|black|white|gray|grey|orange|purple|pink)\b.*:/; // in className/style contexts
// Scope: only .tsx/.jsx files; SELF_PATH + ColorPicker.tsx exempt.
```

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| Per-component hex colors | Tailwind v4 `@theme` + `:root`/`.dark` oklch tokens | Dark mode resolves automatically; single source of truth |
| `tailwind.config.js` | Tailwind v4 CSS-first `@theme` inline in `index.css` | Removed in Tailwind v4 |
| `SegmentedControl` for 2 options | `Toggle` primitive (Phase 54) | Pill UX + animation + `role="radiogroup"` |
| Feature-variant dialog per domain | Single `DeleteDialog` + `DeleteButton` (Phase 57) | Retired MediaDeleteDialog, ScheduleDeleteDialog, SensorRemoveDialog, DeleteConfirmDialog |
| `window.confirm` | `DeleteDialog` via `DeleteButton` | Banned by Phase 57 guard |
| Raw `<input>`/`<select>`/`<button>` | `Input`/`Select`/`Button` primitives | Phase 55 CTRL-02 |
| `<a href>` back buttons + segmented tabs in top header | Breadcrumb trail + identity-only NavBar + SubHeader controls | Phase 56 HDR-01..04 |

## Methodology (concrete commands for Phase 59 execution)

### Derive v1.19-new i18n keys
```bash
# Keys added or renamed in v1.19 timeframe
git log --since=2026-04-21 -p -- frontend/src/locales/en.json | grep -E '^\+\s*"' | sort -u
git log --since=2026-04-21 -p -- frontend/src/locales/de.json | grep -E '^\+\s*"' | sort -u
# Diff the two to spot asymmetric adds/renames
```

### Derive touched file list (D-01 scope)
```bash
git log --since=2026-04-21 --name-only --pretty=format:'' -- frontend/src/ | grep -v '^$' | sort -u
```

### Baseline audit counts
```bash
# Files with focus-visible or focus utilities
grep -rl --include='*.tsx' 'focus-visible:\|focus:' frontend/src | wc -l       # 12
# Files with aria-label
grep -rl --include='*.tsx' 'aria-label' frontend/src | wc -l                   # 41
# Hex in .tsx (exclude CSS)
grep -rE --include='*.tsx' '#[0-9a-fA-F]{3,8}\b' frontend/src                  # 1 (ColorPicker swatch)
```

### Dark-mode manual audit (per D-06)
Available tool: `mcp__Claude_Preview__*` (referenced in CONTEXT.md). Flow per surface:
1. Start preview server, toggle `.dark` class (via existing `ThemeToggle`).
2. Screenshot each migrated page surface.
3. Attach to `59-VERIFICATION.md` keyed by file path.
4. Flag contrast regressions (WCAG AA on text; AAA not required).

## Open Questions

1. **Focus-ring spec convergence (Path A vs Path B).**
   - What we know: Shipped primitives use Path A; CONTEXT.md D-04 names Path B; Claude's Discretion per CONTEXT.md.
   - What's unclear: User preference.
   - Recommendation: Planner proposes Path A in PLAN.md with a one-line rationale; user may override. Mark as the first planner decision.

2. **du-tone baseline hit at `de.json:506`.**
   - What we know: `"Versuchen Sie, die Seite zu aktualisieren"` — a `Versuchen Sie` formal imperative.
   - What's unclear: Was this key added in v1.19? Git blame will tell (`git blame frontend/src/locales/de.json -L 500,510`). If it predates v1.19, D-01 puts it out of scope — allowlist it. If it was touched in v1.19, fix to du-tone.
   - Recommendation: Have the planner's task run the blame check and decide inline.

3. **Parity gate delivery: script vs vitest.**
   - What we know: `check-locale-parity.mts` exists and works; Phase 57 guards already invoke it.
   - What's unclear: Planner's call per CONTEXT.md.
   - Recommendation: Keep as a script (`npm run check:i18n` or equivalent), and add a thin vitest assertion file that execs it or re-imports logic. Scripts are friendlier in CI; vitest is friendlier locally. Doing both is 5 lines of code.

4. **Global vs per-plan CI guard wiring.**
   - What we know: `package.json` has `check:signage`, `check:player-*`, `check:phase-57`. Pattern: phase-specific guards with a "latest owns it all" successor.
   - Recommendation: Introduce `check:phase-59` (or rename to `check:v1.19-gates`) that unions: (a) locale parity, (b) du-tone heuristic, (c) color-literal literal scan, (d) a grep for icon-only controls missing `aria-label`. Plumb into the project's existing CI hook.

## Environment Availability

Skipped — Phase 59 is pure static analysis + UI audit, no external dependencies beyond the already-installed frontend toolchain (vitest, node, tailwindcss v4) all verified in `package.json`.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/59-a11y-parity-sweep/59-CONTEXT.md` — locked decisions D-01..D-07
- `.planning/REQUIREMENTS.md` — A11Y-01/02/03 authoritative text
- `.planning/STATE.md` — cross-cutting hazards, phase 54–58 decisions
- `frontend/src/index.css` — verified token system (oklch, `.dark` variant, `--ring`)
- `frontend/src/components/ui/{button,input,textarea,select,checkbox,badge,toggle,delete-button,section-header,delete-dialog}.tsx` — verified shipped primitives
- `frontend/scripts/check-locale-parity.mts` — verified parity-gate script
- `frontend/scripts/check-phase-57-guards.mts` — verified CI guard runner + walker to reuse
- `frontend/package.json` — verified installed deps + existing `check:*` scripts
- `git log --since=2026-04-21 --name-only` — canonical v1.19 file list (80 files)

### Secondary (MEDIUM confidence)
- Grep counts (`focus-visible:`: 12 files; `aria-label`: 41 files; hex in `.tsx`: 1) — verified via Grep tool

### Tertiary (LOW confidence)
- None — every claim above references a file or command rerunnable in-repo.

## Metadata

**Confidence breakdown:**
- v1.19 surface list: HIGH — directly from `git log`
- Token system / dark-mode: HIGH — verified in `index.css`
- Focus-ring shipped pattern: HIGH — verified in 4 primitive files
- Focus-ring spec drift finding: HIGH — code vs CONTEXT.md comparison verifiable
- Toggle missing focus ring: HIGH — re-read `toggle.tsx` line-by-line
- Color-literal baseline (1 hit): HIGH — Grep result
- du-tone baseline hit: HIGH — Grep on `de.json`
- Tooling recommendations: HIGH — reuses scripts already in repo
- Planner plan decomposition: MEDIUM — shape suggested, planner's final call per D-*

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — token system and primitives stable; will only drift if Phase 59 itself lands first)
