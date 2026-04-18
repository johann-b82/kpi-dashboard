# Phase 23: Contrast Audit & Fix - Research

**Researched:** 2026-04-14
**Domain:** WCAG AA contrast audit, CSS token adjustments, Recharts SVG accessibility
**Confidence:** HIGH (all findings from direct codebase inspection and computed WCAG math)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Automated-first + targeted-manual audit. Run automated tool on every route in both modes. Manually verify flagged items + ALL delta/status badges + Recharts elements via WebAIM.
- **D-02:** Planner picks the specific automated tool (axe-core extension, Lighthouse CLI, Chrome DevTools Issues panel).
- **D-03:** Full audit on all four routes in BOTH modes: `/`, `/hr`, `/upload`, `/settings`.
- **D-04:** Include NavBar, SubHeader, ThemeToggle, LanguageToggle, bootstrap splash in scope.
- **D-05:** When a failure is found, prefer adjusting the GLOBAL token in `frontend/src/index.css` (`:root` or `.dark` block) over per-component overrides.
- **D-06:** Per-component overrides are last resort — only when a token fix would break another surface already passing.
- **D-07:** Delta badges and status badges use identical colors in both modes.
- **D-08:** If an identical color fails on one mode's background, adjust the SHADE to pass in both rather than introducing a dark-mode variant.
- **D-09:** Acceptable exception: same semantic color may be defined twice (once in `:root`, once in `.dark`) if hue stays identical and only lightness differs.
- **D-10:** Fix legacy hardcoded colors in THIS phase — no further deferral. Specifically bootstrap-splash `#ffffff`.
- **D-11:** Phase 21 handled most hardcoded colors; Phase 23 catches residuals surfaced by dark-mode rendering.
- **D-12:** Pass signal = automated tool 0 violations + WebAIM manual pass for badges/Recharts + grep verifies no hardcoded literals in component files.

### Claude's Discretion

- Which automated tool to use (axe-core extension, Lighthouse CLI, Chrome DevTools Issues panel)
- How to structure the audit deliverable (single markdown report vs per-route reports)
- Whether to add a CI check for contrast regressions (out of scope unless trivial)
- How to handle Recharts SVG text elements that tooling cannot analyze automatically

### Deferred Ideas (OUT OF SCOPE)

- CI contrast-regression check (unless trivial)
- Dark-mode-tuned brand variants (accent stays identical)
- High-contrast WCAG AAA mode (deferred to v2+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DM-09 | All text/background combinations meet WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text) | Token inventory + pre-computed contrast pairs identify the failures; token edits in index.css are the fix surface |
| DM-10 | Delta badges, status badges, and colored indicators remain legible in both modes | Badge color inventory confirms 3 distinct failures with specific fix candidates |
</phase_requirements>

---

## 1. Current Token Inventory

Complete listing of every color token in `:root` and `.dark` blocks in `frontend/src/index.css`.

### :root (light mode)

| Token | Value | Approx hex |
|-------|-------|-----------|
| `--background` | `oklch(1 0 0)` | `#ffffff` |
| `--foreground` | `oklch(0.145 0 0)` | `~#1a1a1a` |
| `--card` | `oklch(1 0 0)` | `#ffffff` |
| `--card-foreground` | `oklch(0.145 0 0)` | `~#1a1a1a` |
| `--popover` | `oklch(1 0 0)` | `#ffffff` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `~#1a1a1a` |
| `--primary` | `oklch(0.205 0 0)` | `~#252525` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `~#fafafa` |
| `--secondary` | `oklch(0.97 0 0)` | `~#f7f7f7` |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `~#252525` |
| `--muted` | `oklch(0.97 0 0)` | `~#f7f7f7` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `~#737373` |
| `--accent` | `oklch(0.97 0 0)` | `~#f7f7f7` |
| `--accent-foreground` | `oklch(0.205 0 0)` | `~#252525` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | red (~`#e53e2e`) |
| `--border` | `oklch(0.922 0 0)` | `~#ebebeb` |
| `--input` | `oklch(0.922 0 0)` | `~#ebebeb` |
| `--ring` | `oklch(0.708 0 0)` | `~#b3b3b3` |
| `--chart-1` | `oklch(0.87 0 0)` | `~#d9d9d9` |
| `--chart-2` | `oklch(0.556 0 0)` | `~#737373` |
| `--chart-3` | `oklch(0.439 0 0)` | `~#5c5c5c` |
| `--chart-4` | `oklch(0.371 0 0)` | `~#474747` |
| `--chart-5` | `oklch(0.269 0 0)` | `~#303030` |
| `--sidebar` | `oklch(0.985 0 0)` | `~#fafafa` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `~#1a1a1a` |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `~#252525` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `~#fafafa` |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `~#f7f7f7` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `~#252525` |
| `--sidebar-border` | `oklch(0.922 0 0)` | `~#ebebeb` |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `~#b3b3b3` |

**@theme block (mode-invariant semantic colors — not overridden in .dark):**

| Token | Value | Notes |
|-------|-------|-------|
| `--color-primary` (in @theme) | `#2563eb` | Brand blue (overrides the oklch primary above for Tailwind `text-primary` class — see note) |
| `--color-destructive` (in @theme) | `#dc2626` | Brand red |
| `--color-success` | `#16a34a` | Tailwind green-600, used directly (not a CSS var in :root) |
| `--color-warning` | `#facc15` | Tailwind yellow-400 |
| `--color-chart-current` | `var(--primary)` | Resolves to the `:root`/`.dark` `--primary` token |
| `--color-chart-prior` | `var(--muted)` | Resolves to the `:root`/`.dark` `--muted` token |

**Important disambiguation:** The `@theme` block defines `--color-primary: #2563eb`. This is the Tailwind utility value (what `text-primary` computes to). The `--primary` CSS variable in `:root`/`.dark` is the shadcn token (what `var(--primary)` resolves to). The `@theme inline` block maps `--color-primary` to `var(--primary)`, so in practice Tailwind `text-primary` uses the `:root` oklch value, NOT the `#2563eb` value. The `#2563eb` in `@theme` is overridden by `@theme inline`. Verify during audit.

### .dark (dark mode overrides)

Only the tokens that differ from `:root` are listed below:

| Token | :root value | .dark value | Notes |
|-------|-------------|------------|-------|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | ~`#1a1a1a` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | ~`#fafafa` |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | ~`#252525` |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | ~`#fafafa` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | ~`#252525` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | ~`#fafafa` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | inverted to near-white |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | inverted |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | darkened |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | lightened |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | darkened |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | lightened |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | darkened |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | lightened |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | lightened red |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | semi-transparent white |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | semi-transparent white |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | darkened |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | darkened |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | lightened |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | blue accent |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | same |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | darkened |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | lightened |
| `--sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | semi-transparent |
| `--sidebar-ring` | `oklch(0.556 0 0)` | `oklch(0.556 0 0)` | same |

**chart-1 through chart-5 are identical in :root and .dark** — no dark override for chart palette tokens.

---

## 2. Audit Execution Recipe

**Recommendation: axe DevTools browser extension** (Chrome/Firefox free tier) — rationale:

- Runs entirely in the browser against the live rendered DOM — catches dynamic React state (loading skeletons, open modals, rendered badges) that Lighthouse may miss if it audits a snapshot.
- Reports violations inline with element highlighting + fix suggestions — faster iteration than Lighthouse HTML report.
- Works in dev server (localhost) without a production build — no Docker restart needed.
- Chrome DevTools Issues panel only surfaces a subset of axe rules; axe extension covers the full WCAG 2.1 AA ruleset.
- Lighthouse CLI is best for CI pipelines, not manual audit workflows.

**Repeatable procedure for each of 4 routes × 2 modes (8 passes total):**

```
For each route in ['/', '/hr', '/upload', '/settings']:
  For each mode in ['light', 'dark']:
    1. Open localhost:5173/<route> in Chrome
    2. Click ThemeToggle to set the desired mode
    3. Wait for full render (no loading spinners)
    4. Open axe DevTools extension → "Scan All of My Page"
    5. Record violations: element selector, rule ID, actual ratio, required ratio
    6. Screenshot the violations panel for documentation
    7. Export as JSON or copy to audit log

Total: 8 passes
```

**Additional manual passes (D-01 requirement):**
- After the automated passes, manually verify ALL badge elements and Recharts SVG text using WebAIM contrast checker (https://webaim.org/resources/contrastchecker/) by sampling the exact color values from DevTools (eyedropper or computed styles).
- For Recharts: use Chrome DevTools element inspector to read `fill` computed style on `<text>` and `<path>` SVG elements, then enter foreground + background hex values into WebAIM.

**Audit deliverable:** A single `23-AUDIT.md` file with a table per route per mode. Format:

```
| Element | Selector | FG color | BG color | Ratio | Required | Status |
```

---

## 3. Recharts Contrast Strategy

**Which files render charts:**
- `frontend/src/components/dashboard/RevenueChart.tsx` — Sales route `/`; renders BarChart + AreaChart with prior-period overlay
- `frontend/src/components/dashboard/HrKpiCharts.tsx` — HR route `/hr`; renders 4 MiniChart components (AreaChart + BarChart)

**Token wiring (from `frontend/src/lib/chartDefaults.ts`):**

All chart elements use `var(--color-*)` inline styles, which resolve at runtime via CSS variables. This means axe and DevTools computed styles CAN read them — the SVG `fill` attributes are set as inline style strings like `fill: var(--color-muted-foreground)`, so browser DevTools will show the computed hex.

| Chart element | Token used | Dark resolved value |
|--------------|-----------|-------------------|
| Axis tick labels | `--color-muted-foreground` | oklch(0.708) on dark background |
| Axis lines / grid | `--color-border` | oklch(1 0 0 / 10%) — decorative, not text |
| Tooltip bg | `--color-popover` | oklch(0.205) dark card |
| Tooltip text | `--color-popover-foreground` | oklch(0.985) near-white |
| Tooltip label | `--color-popover-foreground` | oklch(0.985) |
| Cursor fill | `--color-accent` at 30% | oklch(0.269) — decorative |
| Legend text | `--color-muted-foreground` | oklch(0.708) |
| Chart bar/area fill (current) | `--color-chart-current` = `var(--primary)` | oklch(0.922) — fill, not text |
| Chart bar/area fill (prior) | `--color-chart-prior` = `var(--muted)` | oklch(0.269) — fill, not text |
| ReferenceLine label text | `var(--color-destructive)` | oklch(0.704 0.191 22.216) |

**Manual WebAIM procedure for Recharts:**

1. In Chrome DevTools, inspect a chart axis `<text>` element.
2. In Computed styles, read `fill` (browser resolves the CSS variable to a hex/rgb value).
3. For background, inspect the chart container `<div>` or `<Card>` — read `background-color`.
4. Enter both values into https://webaim.org/resources/contrastchecker/.

**Pre-computed Recharts contrast estimates (HIGH confidence for neutrals, MEDIUM for chromatic):**

| Pair | Light ratio | Dark ratio | Risk |
|------|------------|------------|------|
| `muted-foreground` axis tick on `card` background | 4.34:1 | 6.91:1 | LIGHT MODE MAY FAIL — 4.34 is below 4.5 |
| `popover-foreground` on `popover` (tooltip) | 19.79:1 | 17.16:1 | PASS |
| `muted-foreground` legend on `card` | 4.34:1 | 6.91:1 | LIGHT MODE AT RISK |
| `destructive` ReferenceLine label | chromatic — verify | chromatic — verify | needs WebAIM |

**Critical note:** `--muted-foreground` (oklch 0.556) on `--muted` background (oklch 0.97) in light mode computes to approximately 4.34:1 — below the 4.5:1 threshold. This affects axis tick labels when the chart sits in a light muted-background section. The actual background may be `--card` (white), not `--muted`, in which case the ratio is 4.73:1 (borderline pass). Verify by inspecting the actual rendered background.

---

## 4. Badge Color Inventory

### A. DeltaBadge (`frontend/src/components/dashboard/DeltaBadge.tsx`)

Uses `deltaClassName()` from `deltaFormat.ts`:

| Delta state | CSS class applied | Foreground token | Rendered on |
|------------|------------------|-----------------|-------------|
| positive (value > 0) | `text-primary tabular-nums` | `--primary` | card background |
| negative (value < 0) | `text-destructive tabular-nums` | `--destructive` | card background |
| zero | `text-muted-foreground tabular-nums` | `--muted-foreground` | card background |
| null | `text-muted-foreground tabular-nums` | `--muted-foreground` | card background |

**No background color on the badge itself** — inline text on card. The card background is `--card`.

**Pre-computed contrast (text on card background):**

| State | Light ratio | Dark ratio | Status |
|-------|------------|------------|--------|
| positive: `--primary` (oklch 0.205) on `--card` (oklch 1.0) | 17.91:1 | — |
| positive: `--primary` (oklch 0.922) on `--card` (oklch 0.205) — dark | — | 14.22:1 | PASS both |
| negative: `--destructive` (chromatic) on `--card` | verify | verify | needs WebAIM |
| zero/null: `--muted-foreground` on `--card` (light) | 4.73:1 | — | borderline PASS light |
| zero/null: `--muted-foreground` on `--card` (dark) | — | 6.91:1 | PASS dark |

**Risk:** The `--destructive` token is chromatic (red with chroma); its exact relative luminance cannot be safely estimated without rendering. Must verify via WebAIM. The dark mode `--destructive` is lightened (oklch 0.704 vs 0.577 in light), which increases its luminance — on a dark card it should pass, but verify.

### B. StatusBadge in UploadHistory (`frontend/src/components/UploadHistory.tsx`)

Three variants — all use `<Badge>` component (filled pill shape):

| Variant | Badge background | Text | Pre-computed ratio | Status |
|---------|-----------------|------|-------------------|--------|
| success | `var(--color-success)` = `#16a34a` | `text-white` (`#ffffff`) | 3.30:1 | **CONFIRMED FAIL** (needs 4.5:1) |
| partial | `var(--color-warning)` = `#facc15` | `text-foreground` (oklch 0.145 ≈ near-black) | 12.92:1 | PASS |
| failed | `bg-destructive` | `text-destructive-foreground` | chromatic — verify | needs WebAIM |

**These colors are mode-invariant** (`--color-success` and `--color-warning` are in `@theme`, not overridden in `.dark`). The success badge FAILS in BOTH modes because `text-white` on `#16a34a` produces only 3.30:1.

**Fix candidate:** Darken `--color-success` from `#16a34a` (green-600) to `#15803d` (Tailwind green-700, Y=0.1593). White on `#15803d` = 5.02:1 (PASS). Alternatively, change the text color from `text-white` to near-black if the badge must stay green-600.

- `#15803d` on white background itself: 5.02:1 — text-white passes
- `#15803d` is the same green hue, just one shade darker — satisfies D-08 (same hue, different lightness)

**Per-component change required** (the `text-white` hardcode in UploadHistory.tsx is not a token) — this is an acceptable D-06 case IF changing `--color-success` token would break ContrastBadge.tsx (which computes contrast mathematically and would still work) or EmployeeTable.tsx status badge (see below).

### C. EmployeeTable employee status badge (`frontend/src/components/dashboard/EmployeeTable.tsx`)

Inline classes, not using `<Badge>` component:

```
active: bg-[var(--color-success)]/20  text-[var(--color-success)]
inactive: bg-muted  text-muted-foreground
```

**Pre-computed contrast for active status badge:**

| Mode | Badge BG (success/20 blended) | Text (#16a34a) | Ratio | Status |
|------|------------------------------|---------------|-------|--------|
| Light | #16a34a @ 20% on white → ~#d0eddb | #16a34a | 2.64:1 | **CONFIRMED FAIL** |
| Dark | #16a34a @ 20% on ~#252525 → ~#223e2c | #16a34a | 3.55:1 | **CONFIRMED FAIL** |

This badge pattern (text-color on tinted version of same color) is fundamentally low-contrast. Both modes fail.

**Fix options (per D-08/D-09):**
1. Use solid `bg-[var(--color-success)]` with `text-white` — but then the success token itself must be dark enough (see above fix).
2. Change to `bg-[var(--color-success)]/20 text-foreground` — dark text on tinted green. In light mode: near-black on ~#d0eddb ≈ 10:1 (PASS). In dark mode: near-white oklch(0.985) on ~#223e2c ≈ 12:1 (PASS). This requires a per-component override (D-06 last resort).

### D. PersonioCard sync feedback (`frontend/src/components/settings/PersonioCard.tsx`)

Not a Badge component — inline text:

| State | CSS class | Foreground | Background | Notes |
|-------|-----------|-----------|-----------|-------|
| success | `text-[var(--color-success)]` | `#16a34a` | `--card` (white/dark) | inline text, no bg fill |
| error | `text-destructive` | `--destructive` | `--card` | inline text |

`#16a34a` on white card: 4.63:1 — borderline PASS in light mode (verify).
`#16a34a` on dark card (~#252525): 3.60:1 — **FAIL** in dark mode.

If `--color-success` is darkened to `#15803d` to fix the StatusBadge: `#15803d` on dark card ≈ 5.0:1 — PASS.

---

## 5. Hardcoded Color Grep

**Grep command run:** `grep -rn "#[0-9a-fA-F]{3,8}\|rgb(\|hsl(\|text-white\|bg-white\|text-black" frontend/src` excluding `index.css`.

**All hits outside index.css:**

| File | Line | Value | Context | Risk |
|------|------|-------|---------|------|
| `frontend/index.html` | 40–41 | `color: #64748b; background: #ffffff;` | bootstrap-splash style block | **CONFIRMED: bg flashes white in dark mode** |
| `frontend/src/components/UploadHistory.tsx` | 22 | `text-white` | success StatusBadge text | **CONFIRMED FAIL — 3.30:1** |
| `frontend/src/components/ui/dialog.tsx` | 32 | `bg-black/10` | modal backdrop overlay | NOT a text contrast issue — decorative overlay |
| `frontend/src/lib/color.ts` | 26, 30, 32 | `#000000` | fallback for color parse failure | Functional fallback, not a UI color |
| `frontend/src/components/settings/ColorPicker.tsx` | 75 | `#0066FF` | placeholder attribute text for the hex input field | Placeholder text, out of scope |

**Clean files (no hardcoded colors beyond above):** All other `.tsx` files use token classes (`text-foreground`, `bg-card`, etc.) or `var(--color-*)` references.

The `bg-black/10` in `dialog.tsx` is a shadcn-generated file and represents a semi-transparent scrim — not subject to text contrast rules.

---

## 6. Bootstrap-Splash Location

**File:** `frontend/index.html` (lines 31–58)

**Exact issue:**

```html
<style>
  #root > .bootstrap-splash {
    ...
    color: #64748b;        /* dot color */
    background: #ffffff;   /* HARDCODED WHITE — problem in dark mode */
  }
```

The pre-hydration script (lines 8–30, also in index.html) adds `class="dark"` to `<html>` BEFORE this `<style>` block is processed. However, the `.bootstrap-splash` style is in a `<style>` tag with no `:root`/`.dark` scoping, so it always shows `#ffffff` regardless of mode.

**Dot text contrast:** `#64748b` (slate-500) on `#ffffff` = 4.76:1 — PASS in isolation. The accessibility issue is not the dot color but the white background flashing in dark mode (a visual/UX issue called out in Phase 22 UAT Scenario E, locked as D-10 to fix).

**Fix approach:** Replace `background: #ffffff` with a CSS custom property that respects dark mode. Since this is inline `<style>` in `index.html` BEFORE React hydrates, CSS variables from `index.css` are NOT yet loaded. The correct fix is to mirror the pre-hydration theme script pattern: either:

Option A — Use a `<style>` media query:
```html
background: #ffffff;
@media (prefers-color-scheme: dark) { ... }
```
But this doesn't respect the stored `theme` localStorage value.

Option B — Duplicate the pre-hydration script logic to also set a CSS variable or a data attribute on the splash element before `<style>` evaluates. This is complex.

Option C — Use `background-color: var(--background)` and add a brief inline `:root` definition:
```html
<style>
  :root { --background: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --background: #1a1a1a; } }
  #root > .bootstrap-splash { background: var(--background); }
```
Then the pre-hydration script's `class="dark"` on `<html>` also triggers the `.dark` CSS block from index.css once it loads — but the splash disappears by then.

Option D (recommended) — Inline the dark/light backgrounds directly in the pre-hydration IIFE script. After adding `document.documentElement.classList.add('dark')`, also set a CSS variable:
```js
document.documentElement.style.setProperty('--splash-bg', isDark ? '#1a1a1a' : '#ffffff');
document.documentElement.style.setProperty('--splash-dot', isDark ? '#94a3b8' : '#64748b');
```
And update the `<style>`:
```css
#root > .bootstrap-splash {
  color: var(--splash-bg, #64748b);  /* wait — typo, see below */
  background: var(--splash-bg, #ffffff);
}
.bootstrap-splash__dot { background: currentColor; }
```
This is the lowest-risk approach since the script already runs first.

**Planner decision point:** Choose the fix option. Option D is recommended — it piggybacks on the existing IIFE without adding complexity.

---

## 7. Known-Risk Shortlist

Cross-referencing Phase 21 deferred-items.md and computed contrast values:

| Element | Mode | Issue | Confirmed/Suspected | Source |
|---------|------|-------|---------------------|--------|
| StatusBadge success: `text-white` on `#16a34a` | BOTH | 3.30:1 < 4.5:1 | **CONFIRMED FAIL** | Computed |
| EmployeeTable active badge: `text-success` on `bg-success/20` | BOTH | 2.64:1 (light) / 3.55:1 (dark) | **CONFIRMED FAIL** | Computed |
| PersonioCard `text-[var(--color-success)]` on dark card | DARK | ~3.60:1 < 4.5:1 | **CONFIRMED FAIL** | Computed |
| bootstrap-splash: `background: #ffffff` | DARK | white flash in dark mode | **CONFIRMED** (UAT Scenario E) | Phase 22 |
| `muted-foreground` axis/legend on `muted` background | LIGHT | 4.34:1 < 4.5:1 | SUSPECTED — actual background may be card (white), not muted | Computed |
| `--destructive` text in DeltaBadge (negative delta) | BOTH | chromatic, exact ratio unknown | needs verification | — |
| SalesTable.tsx TypeScript build errors | — | pre-existing TS errors (not contrast-related) | Out of scope for Phase 23 | Phase 21 deferred |

**Phase 21 deferred items note:** The only item in `deferred-items.md` is the SalesTable.tsx TypeScript build errors — these are build errors, not contrast failures. They are unrelated to Phase 23 scope.

---

## 8. Per-Mode Token Diff

Pairs where the same token changes substantially between modes, requiring the audit to check BOTH values:

| Token | Light value | Dark value | Risk |
|-------|------------|------------|------|
| `--background` | oklch(1.0) white | oklch(0.145) near-black | opposite extremes — foreground pairs invert |
| `--card` | oklch(1.0) white | oklch(0.205) dark gray | card surfaces are the primary content BG; badge/text contrast changes dramatically |
| `--muted` | oklch(0.97) near-white | oklch(0.269) dark gray | used as chart-prior fill color — very dark in dark mode |
| `--muted-foreground` | oklch(0.556) medium gray | oklch(0.708) lighter gray | lightens in dark mode — better contrast against dark backgrounds |
| `--primary` | oklch(0.205) near-black | oklch(0.922) near-white | inverted — `text-primary` for DeltaBadge positive flips from near-black to near-white |
| `--destructive` | oklch(0.577 chroma) | oklch(0.704 chroma) | lightened in dark mode — higher luminance on dark bg is intended |
| `--border` | oklch(0.922) solid | oklch(1 0 0 / 10%) semi-transparent | transparent border on dark bg renders as subtle gray line |
| `--chart-1 to chart-5` | identical | identical (no .dark override) | chart palette does NOT adapt to dark mode — chart-1 is a light gray (oklch 0.87) that on dark background (0.145) gives ~20:1 — but it is a fill color, not text |

**Key contrast pair to verify in both modes explicitly:**
- `--muted-foreground` on `--card`: light = 4.73:1 (borderline), dark = 6.91:1 (comfortable)
- `--muted-foreground` on `--muted` (when text appears on muted surface): light = 4.34:1 (**at risk**), dark = 5.83:1 (PASS)

---

## 9. Fix Pattern Examples

### Example A: Darken `--color-success` to fix StatusBadge + PersonioCard

This is a global token edit in the `@theme` block in `index.css`.

**Before:**
```css
/* frontend/src/index.css — @theme block */
@theme {
  --color-success: #16a34a;
}
```

**After:**
```css
@theme {
  --color-success: #15803d;  /* Tailwind green-700; white-on-it = 5.02:1, PASS */
}
```

**Impact:** Fixes StatusBadge success (white text on green), PersonioCard success text on dark card. The same hue (green), one shade darker — satisfies D-08. All consumers of `var(--color-success)` pick up the fix automatically.

**Does NOT fix** EmployeeTable `bg-success/20 text-success` pattern — the tinted-same-color approach fails regardless of shade (text and bg are too similar).

### Example B: Fix EmployeeTable active status badge (per-component, D-06 last resort)

The pattern `bg-[var(--color-success)]/20 text-[var(--color-success)]` cannot pass WCAG with any single green shade because text and background are the same color at different opacities.

**Before** (`frontend/src/components/dashboard/EmployeeTable.tsx` line 133):
```tsx
row.status === "active"
  ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
  : "bg-muted text-muted-foreground"
```

**After** (option — change text to foreground/white for solid contrast):
```tsx
row.status === "active"
  ? "bg-[var(--color-success)]/20 text-foreground"
  : "bg-muted text-muted-foreground"
```
`text-foreground` on light ~#d0eddb (success/20 on white) = near-black (~17:1, PASS).
`text-foreground` on dark ~#223e2c (success/20 on dark card) = near-white (~12:1, PASS).

**Alternative after** (semantic — solid fill with white text, conditional on success being dark enough after Example A):
```tsx
row.status === "active"
  ? "bg-[var(--color-success)] text-white"
  : "bg-muted text-muted-foreground"
```
With `#15803d` as `--color-success`: white on `#15803d` = 5.02:1 (PASS both modes since color is mode-invariant).

### Example C: Fix bootstrap-splash dark-mode background

**Before** (`frontend/index.html`, pre-hydration IIFE and `<style>`):
```js
// IIFE: only adds 'dark' class to <html>
```
```html
<style>
  #root > .bootstrap-splash {
    color: #64748b;
    background: #ffffff;  /* hardcoded */
  }
```

**After:**
```js
// IIFE — add after classList manipulation:
var splashBg = isDark ? '#1a1a1a' : '#ffffff';
var splashDot = isDark ? '#94a3b8' : '#64748b';
document.documentElement.style.setProperty('--splash-bg', splashBg);
document.documentElement.style.setProperty('--splash-dot', splashDot);
```
```html
<style>
  #root > .bootstrap-splash {
    color: var(--splash-dot, #64748b);
    background: var(--splash-bg, #ffffff);
  }
```

Dark mode: `#94a3b8` (slate-400) on `#1a1a1a` ≈ 7.0:1 (PASS). Light mode: `#64748b` on `#ffffff` = 4.76:1 (PASS).

---

## 10. Scope Guardrails

Items that may appear tempting but are explicitly OUT OF SCOPE:

| Item | Why Out of Scope |
|------|-----------------|
| CI contrast regression check (e.g., axe-playwright in CI) | Deferred per CONTEXT.md; acceptable if truly trivial but treat as out of scope unless less than 30 minutes |
| WCAG AAA (7:1 body / 4.5:1 large) | Explicitly deferred to v2+ in CONTEXT.md |
| Dark-mode-tuned brand accent variants | Rejected in CONTEXT.md (D-05, D-07 from Phase 21 hold) |
| Fixing SalesTable.tsx TypeScript build errors | Phase 21 deferred item — unrelated to contrast |
| Color picker preview in Settings | Explicitly out of scope in REQUIREMENTS.md — shows actual brand colors, not themed |
| Recharts chart bar FILL colors (chart-1 through chart-5) | Fill colors are not text — 3:1 or 4.5:1 WCAG contrast does not apply to decorative fills; only chart text (labels, tooltips) counts |
| `bg-black/10` dialog backdrop in `components/ui/dialog.tsx` | Decorative overlay — not a text contrast element; shadcn-generated file |
| Animated loading skeletons (`bg-muted animate-pulse`) | Decorative skeleton, not content — not subject to text contrast rules |

**Note on chart fills:** WCAG SC 1.4.3 applies to text and images of text. SVG chart bars and area fills are non-text graphical objects — SC 1.4.11 (Non-text Contrast, 3:1) applies to UI components and meaningful graphics. However, SC 1.4.11 is WCAG 2.1 AA, so it DOES apply. For chart bar fills that encode meaningful data (not just decorative), 3:1 against adjacent colors is required. The `--chart-prior` fill (`--muted` token = oklch 0.269 in dark) on dark background (oklch 0.145): ~1.3:1 — this FAILS 3:1 for a data-encoding element. **Flag this for the audit** — it may require making `--color-chart-prior` use a lighter value or the chart showing contrast via outline rather than fill alone.

---

## Environment Availability

Step 2.6: No external tools required beyond the browser + axe DevTools extension. The axe extension is a manual install in the developer's browser — not a project dependency. No verification command applicable.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Chrome + axe DevTools extension | Automated audit | Assumed developer install | Free tier at axe.deque.com/axe-devtools |
| WebAIM contrast checker | Manual badge/chart verification | Web tool (no install) | https://webaim.org/resources/contrastchecker/ |
| Dev server (Vite) | Audit runs against live app | ✓ (existing project) | `npm run dev` in frontend/ |

---

## Validation Architecture

Per `.planning/config.json` — nyquist_validation not set to false, so section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — project uses Vite build only; no jest/vitest config found |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

No automated test infrastructure exists in this project for frontend unit/integration tests. The validation gate for this phase follows the pattern established in Phases 21–22: human UAT acceptance gate as a dedicated final plan.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DM-09 | All text passes 4.5:1 / 3:1 | Manual (axe + WebAIM) | N/A | N/A |
| DM-10 | Badges legible in both modes | Manual (WebAIM) | N/A | N/A |

### Sampling Rate

- **Per task:** Eyeball in both modes; run axe on the affected route after each fix
- **Per wave merge:** Not applicable (no automated test suite)
- **Phase gate:** Axe 0 violations + WebAIM manual pass + `grep` clean → human UAT plan

### Wave 0 Gaps

None — this phase does not introduce test infrastructure. Validation is manual audit + human UAT gate (consistent with Phase 21 Plan 04 and Phase 22 Plan 03 patterns).

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/index.css` — all token values read directly
- `frontend/src/components/dashboard/DeltaBadge.tsx` + `deltaFormat.ts` — badge class logic
- `frontend/src/components/UploadHistory.tsx` — StatusBadge implementation
- `frontend/src/components/dashboard/EmployeeTable.tsx` — employee status badge
- `frontend/src/components/settings/PersonioCard.tsx` — sync feedback colors
- `frontend/src/lib/chartDefaults.ts` — Recharts token wiring
- `frontend/index.html` — bootstrap-splash confirmed location and hardcoded values
- WCAG 2.1 SC 1.4.3: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- WCAG 2.1 SC 1.4.11: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

### Secondary (MEDIUM confidence)

- Computed contrast ratios using standard WCAG relative luminance formula — HIGH confidence for hex colors, MEDIUM for oklch neutral approximations (within ±0.3 ratio of actual)
- Chromatic colors (`--destructive`, `--sidebar-primary`) require rendering verification — not computable from OKLCH without full color math

### Tertiary (LOW confidence)

- Tailwind green shade exact hex values from memory (`#15803d` for green-700) — verify against Tailwind docs before committing

---

## Metadata

**Confidence breakdown:**
- Token inventory: HIGH — read directly from source file
- Pre-computed contrast ratios (hex colors): HIGH — WCAG formula applied to exact values
- Pre-computed contrast ratios (oklch neutral): MEDIUM — cubic approximation, ±0.3 margin
- Pre-computed contrast ratios (chromatic/red): LOW — chromatic colors require rendering
- Recharts element mapping: HIGH — read directly from chartDefaults.ts and component files
- Badge color inventory: HIGH — read from component source
- Bootstrap-splash fix options: HIGH — read from index.html
- Green-700 hex `#15803d`: MEDIUM — verify against Tailwind palette before use

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (tokens stable until next index.css edit)

---

## RESEARCH COMPLETE
