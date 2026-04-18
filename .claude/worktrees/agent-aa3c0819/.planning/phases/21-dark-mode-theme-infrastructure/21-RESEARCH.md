# Phase 21: Dark Mode Theme Infrastructure - Research

**Researched:** 2026-04-14
**Domain:** Tailwind v4 dark mode, shadcn/ui theming, Recharts token-based coloring, ThemeProvider extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** ThemeProvider applies brand-set surface colors (`--background`, `--foreground`, `--muted`, `--destructive`) **only in light mode**. In dark mode, these surfaces fall back to the shadcn `.dark` CSS block defaults.
- **D-02:** Brand accent/primary (`--primary`, `--accent`) are applied from Settings **in both modes** — this is the DM-04 requirement: brand accent identical light and dark.
- **D-03:** ThemeProvider must detect current mode by reading the `dark` class on `<html>` and conditionally skip `style.setProperty` calls for surface tokens. When dark mode activates/deactivates, the `.dark` CSS block takes over because inline styles are removed.
- **D-04:** `--destructive` follows the surface pattern — shadcn dark default in dark mode, brand value in light mode.
- **D-05:** Use the **existing shadcn `.dark` grayscale defaults** as-is. No brand tinting, no high-contrast/AMOLED variant. The `.dark` block in `frontend/src/index.css:95-127` is already correct.
- **D-06:** Do not add new Settings fields for dark-mode colors. Single brand palette; only light-mode surfaces come from Settings.
- **D-07:** All Recharts chart elements must reference CSS variables (tokens) so they auto-adapt when the `.dark` class toggles. No JS-side mode detection, no `useTheme()` hook for charts.
- **D-08:** Audit every Recharts component and replace any hardcoded colors with token references (exact token mapping defined in UI-SPEC).
- **D-09:** Amber warning color (`#facc15`) stays identical in light and dark mode. Do not add a `.dark` override for `--color-warning`.
- **D-10:** Full systematic audit of the frontend for hardcoded colors (hex literals, named colors, rgb/oklch/hsl literals outside index.css, Tailwind color utilities that don't adapt).
- **D-11:** Replace hardcoded colors with token equivalents per substitution table in UI-SPEC.
- **D-12:** Verify every shadcn/ui primitive in `frontend/src/components/ui/` renders correctly in dark mode.
- **D-13:** Dark mode is activated manually during Phase 21 development by toggling the `.dark` class on `<html>` via browser devtools. No temporary dev toggle in Phase 21.
- **D-14:** ThemeProvider's mode detection logic must work correctly when `.dark` class is added/removed externally.

### Claude's Discretion

- Exact mechanism for ThemeProvider to detect current mode (MutationObserver on `<html>` class, or re-render trigger)
- How to efficiently grep for hardcoded colors across the frontend (glob strategy, ripgrep patterns)
- Whether to extract the Recharts token defaults into a shared `chartDefaults.ts` helper or inline them per chart

### Deferred Ideas (OUT OF SCOPE)

- Dual brand palettes (Settings fields for dark-mode colors)
- High-contrast/AMOLED dark variant
- Brand-tinted dark surfaces
- Per-user dark mode preference in database
- Dark mode toggle UI (Phase 22)
- WCAG AA audit (Phase 23)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DM-01 | App has a dark color scheme with dark backgrounds, light text, and appropriate card/border colors | `.dark` CSS block already defined in `index.css:95-127`; ThemeProvider must not override surface tokens in dark mode |
| DM-02 | All shadcn/ui components render correctly in dark mode | shadcn components use `@theme inline` token aliases — they adapt automatically when `.dark` is on `<html>`; manual audit confirms no new CSS needed unless token gaps exist |
| DM-03 | Recharts charts use dark-mode-appropriate colors for axes, grid, tooltips, and legends | RevenueChart already uses `var(--color-*)` tokens for most elements; HrKpiCharts also largely tokenized; gap is tooltip `color` and `labelStyle`/`itemStyle` props missing |
| DM-04 | Brand accent color (from Settings) stays the same in both light and dark mode | ThemeProvider must continue to call `style.setProperty('--primary', ...)` and `style.setProperty('--accent', ...)` even when dark mode is active |
</phase_requirements>

---

## Summary

Phase 21 is a **pure frontend retheme**. The dark palette is already fully defined in `frontend/src/index.css` (lines 95-127). The `.dark` CSS block is complete and correct. No new CSS needs to be written — the only CSS work is confirming no token gaps exist.

The three concrete deliverables are: (1) extend `ThemeProvider` to be mode-aware so inline `style.setProperty` calls do not stomp the `.dark` block for surface tokens, (2) convert all Recharts component props that still use hardcoded colors to CSS variable references, and (3) convert hardcoded Tailwind utility classes and hex literals throughout the frontend to token-based equivalents.

The audit of the existing codebase (see Hardcoded Color Inventory below) reveals the scope is manageable: most chart code is already tokenized, the primary gaps are in `UploadHistory.tsx` (status badge colors), `DropZone.tsx` (drag state styling), `EmployeeTable.tsx` (employee status badge), and `ErrorList.tsx` (error border/text). The ThemeProvider extension requires adding a `MutationObserver` on `document.documentElement` and splitting the token-application logic into surface tokens (conditionally skipped in dark mode) and accent tokens (always applied).

**Primary recommendation:** ThemeProvider extension via `MutationObserver` is the right mechanism — it requires no prop threading, responds instantly to external `.dark` class changes (devtools in Phase 21, toggle in Phase 22), and adds minimal complexity to an already lean component.

---

## Project Constraints (from CLAUDE.md)

| Directive | Detail |
|-----------|--------|
| Frontend stack | React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Recharts 3.8.1 |
| Tailwind v4 dark mode | Class strategy — `@custom-variant dark (&:is(.dark *))` — already configured in `index.css:6` |
| shadcn/ui | Copy-paste pattern in `frontend/src/components/ui/`; use `render` prop not `asChild` |
| No tailwind.config.js | Tailwind v4 is CSS-first; all config lives in `index.css` |
| Docker Compose | Not relevant to this phase (frontend-only) |
| PostgreSQL | Not relevant to this phase |

---

## Existing Infrastructure Audit

### What Is Already In Place

| Asset | Location | Status |
|-------|----------|--------|
| `.dark` CSS block with full shadcn token set | `frontend/src/index.css:95-127` | Complete — all 18 tokens defined |
| `@custom-variant dark (&:is(.dark *))` | `frontend/src/index.css:6` | Complete — `dark:` utilities work out of the box |
| `@theme inline` token aliases for Tailwind | `frontend/src/index.css:17-58` | Complete — `bg-background`, `text-foreground`, etc. all mapped |
| `THEME_TOKEN_MAP` mapping Settings keys to CSS vars | `frontend/src/lib/defaults.ts:25-32` | Complete — 6 tokens: `--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--destructive` |
| ThemeProvider applying settings inline | `frontend/src/components/ThemeProvider.tsx` | Exists but not mode-aware — sets ALL 6 tokens unconditionally |
| RevenueChart Recharts with token colors | `frontend/src/components/dashboard/RevenueChart.tsx` | Partially done — uses `var(--color-border)`, `var(--color-muted-foreground)`, `var(--color-popover)`, `var(--color-chart-current)`, `var(--color-chart-prior)`. **Gaps:** Tooltip has no `color`, `labelStyle`, or `itemStyle`; Legend has no `wrapperStyle`; XAxis/YAxis missing `tick.fill` |
| HrKpiCharts Recharts with token colors | `frontend/src/components/dashboard/HrKpiCharts.tsx` | Partially done — `tooltipStyle` uses `var(--color-popover)` and `var(--color-border)` for container; XAxis/YAxis use `var(--color-muted-foreground)` for `stroke`. **Gaps:** Tooltip `contentStyle` has no `color` prop; `tick.fill` missing on axes; ReferenceLine `label.fill` uses `var(--color-destructive)` (good); Area/Bar fills use `var(--color-chart-current)` (good) |

### Hardcoded Color Inventory (Full Audit Results)

This is the complete list of locations requiring changes, found by running the audit grep patterns from 21-UI-SPEC.md.

#### Hardcoded Tailwind gray/slate/neutral utilities

| File | Line | Hardcoded | Required Replacement |
|------|------|-----------|----------------------|
| `UploadHistory.tsx` | 29 | `text-slate-900` | `text-foreground` |
| `UploadHistory.tsx` | 59 | `text-slate-500` | `text-muted-foreground` |
| `UploadHistory.tsx` | 67 | `bg-slate-200` | `bg-muted` |
| `UploadHistory.tsx` | 77 | `text-slate-700` | `text-foreground` |
| `UploadHistory.tsx` | 80 | `text-slate-500` | `text-muted-foreground` |
| `UploadHistory.tsx` | 102 | `text-slate-500` | `text-muted-foreground` |
| `UploadHistory.tsx` | 110 | `text-slate-400` / `text-slate-700` | `text-muted-foreground` / `text-foreground` |
| `DropZone.tsx` | 85, 89 | `bg-slate-100 border-slate-300` | `bg-muted border-border` |
| `DropZone.tsx` | 101 | `text-slate-500` | `text-muted-foreground` |
| `DropZone.tsx` | 110 | `text-slate-400` | `text-muted-foreground` |
| `DropZone.tsx` | 120 | `text-slate-400` | `text-muted-foreground` |
| `ErrorList.tsx` | 25 | `text-slate-700` | `text-foreground` |
| `EmployeeTable.tsx` | 136 | `bg-gray-100 text-gray-600` | `bg-muted text-muted-foreground` |
| `dialog.tsx` | 32 | `bg-black/10` | Keep — this is the shadcn default overlay; acceptable per D-05 (shadcn defaults as-is). Exception confirmed. |

#### Hardcoded semantic color utilities (not gray — require semantic token mapping)

| File | Line | Hardcoded | Strategy |
|------|------|-----------|----------|
| `UploadHistory.tsx` | 22 | `bg-green-600 text-white` (success badge) | Map to Tailwind `bg-[var(--color-success)] text-white` or use `success` variant. Note: `--color-success` is `#16a34a` defined in `@theme` block — both modes. |
| `UploadHistory.tsx` | 29 | `bg-yellow-400` (partial badge) | Map to `bg-[var(--color-warning)]` — `#facc15` same in both modes (D-09). |
| `UploadHistory.tsx` | 36 | `bg-red-600 text-white` (failed badge) | Map to `bg-destructive text-destructive-foreground`. |
| `UploadHistory.tsx` | 120 | `hover:text-red-600 hover:bg-red-50` (delete btn hover) | Map to `hover:text-destructive hover:bg-destructive/10`. |
| `DropZone.tsx` | 87 | `bg-blue-50 border-blue-600` (drag active) | Map to `bg-primary/5 border-primary`. |
| `DropZone.tsx` | 100 | `text-blue-600` (spinner) | Map to `text-primary`. |
| `DropZone.tsx` | 106 | `text-blue-600` (drag active text) | Map to `text-primary`. |
| `DropZone.tsx` | 116 | `bg-blue-600 hover:bg-blue-700 text-white` (browse btn) | Replace with `variant="default"` (already using default variant — remove the className override, let shadcn default styling take over). |
| `DropZone.tsx` | 126 | `text-red-600` (invalid file type) | Map to `text-destructive`. |
| `ErrorList.tsx` | 16 | `border-red-600` | Map to `border-destructive`. |
| `ErrorList.tsx` | 17 | `text-red-600` | Map to `text-destructive`. |
| `EmployeeTable.tsx` | 135 | `bg-green-100 text-green-800` (active status) | Use `bg-[var(--color-success)]/20 text-[var(--color-success)]` — semantic; `--color-success` is fixed in `@theme`. |
| `PersonioCard.tsx` | 154 | `text-green-600 dark:text-green-400` | Already has `dark:` override — examine if this can use `text-[var(--color-success)]` instead. Needs review. |
| `PersonioCard.tsx` | 208 | `text-green-600` | Map to `text-[var(--color-success)]`. |

#### Inline oklch literals in TypeScript/TSX (outside index.css)

| File | Location | Nature | Action |
|------|----------|--------|--------|
| `frontend/src/lib/defaults.ts:4-9` | `DEFAULT_SETTINGS` values | Light-mode Settings default seed values — these feed `THEME_TOKEN_MAP` and are intentionally applied only to light-mode surfaces (D-01). | **No change** — explicitly exempted per 21-UI-SPEC.md. |
| `frontend/src/pages/SettingsPage.tsx:310` | `"oklch(0 0 0)"` fallback | Safe fallback inside color conversion helper | **No change** — not a UI surface color. |
| `frontend/src/lib/color.ts:20` | `oklch(${L}...)` template | Color conversion utility | **No change** — not a UI surface color; library code. |

#### Hex literals in TypeScript/TSX (outside index.css)

| File | Location | Nature | Action |
|------|----------|--------|--------|
| `frontend/src/lib/color.ts:30, 32` | `"#000000"` fallback | Color conversion failure fallback | **No change** — not a UI surface; library utility. |
| `frontend/src/components/settings/ColorPicker.tsx:75` | `placeholder="#0066FF"` | Input placeholder text for hex input field | **No change** — it is example text, not a rendered color. |

---

## Architecture Patterns

### ThemeProvider Extension: Mode-Aware Token Application

**Pattern:** Split `applyTheme()` into surface tokens (mode-conditional) and accent tokens (always applied). Use `MutationObserver` on `document.documentElement` to detect external `.dark` class changes.

**Why MutationObserver:** The `.dark` class is added/removed externally (devtools now, Phase 22 toggle later). There is no React state to subscribe to in Phase 21. `MutationObserver` fires synchronously-ish on class change with no polling overhead, and the same observer will work correctly when Phase 22 adds toggle state — Phase 22 just needs to toggle the class, not wire into ThemeProvider.

**Surface tokens (skip in dark mode):** `--background`, `--foreground`, `--muted`, `--destructive`
**Accent tokens (always apply):** `--primary`, `--accent`

```typescript
// Conceptual structure for extended ThemeProvider
const SURFACE_TOKENS = ['color_background', 'color_foreground', 'color_muted', 'color_destructive'] as const;
const ACCENT_TOKENS = ['color_primary', 'color_accent'] as const;

function applyTheme(settings: Settings) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  // Always apply accent tokens (DM-04)
  ACCENT_TOKENS.forEach((key) => {
    root.style.setProperty(THEME_TOKEN_MAP[key], settings[key]);
  });

  if (!isDark) {
    // Light mode: apply surface tokens inline (D-01)
    SURFACE_TOKENS.forEach((key) => {
      root.style.setProperty(THEME_TOKEN_MAP[key], settings[key]);
    });
  } else {
    // Dark mode: remove inline surface tokens so .dark CSS block wins (D-03)
    SURFACE_TOKENS.forEach((key) => {
      root.style.removeProperty(THEME_TOKEN_MAP[key]);
    });
  }

  document.title = settings.app_name;
}
```

**MutationObserver wiring (inside ThemeProvider useEffect):**

```typescript
useEffect(() => {
  if (!effective) return;
  applyTheme(effective);

  const observer = new MutationObserver(() => {
    applyTheme(effective);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}, [effective]);
```

**Key constraint:** The observer must re-run `applyTheme` when the class changes. Because `effective` is in the closure, the observer will always have the latest settings. `attributeFilter: ['class']` limits observations to the class attribute only — no overhead from other attribute changes.

### Recharts Token Gaps to Close

Both `RevenueChart.tsx` and `HrKpiCharts.tsx` are mostly tokenized already. The gaps are all in tooltip text color and axis tick fill:

**RevenueChart.tsx gaps:**
- `<Tooltip>` `contentStyle` missing `color: 'var(--color-popover-foreground)'`
- `<Tooltip>` missing `labelStyle={{ color: 'var(--color-popover-foreground)' }}`
- `<Tooltip>` missing `itemStyle={{ color: 'var(--color-popover-foreground)' }}`
- `<XAxis>` and `<YAxis>` `stroke` is `var(--color-muted-foreground)` but `tick` has no `fill` — default tick fill is black; needs `tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}`
- `<Legend>` has no `wrapperStyle` — default Legend text is dark; needs `wrapperStyle={{ color: 'var(--color-muted-foreground)' }}`
- Tooltip cursor missing — should add `cursor={{ fill: 'var(--color-accent)', opacity: 0.3 }}`

**HrKpiCharts.tsx gaps:**
- `tooltipStyle` object missing `color: 'var(--color-popover-foreground)'`
- `<XAxis>` and `<YAxis>` `stroke` is `var(--color-muted-foreground)` but `tick` has no `fill`
- No `<Legend>` used — no gap there

**Shared helper decision (Claude's discretion → recommend extracting):** Given that the same props are needed in 2+ chart components, extract to `frontend/src/lib/chartDefaults.ts`. This prevents drift and makes the token mapping explicit in one place. The file should export:

```typescript
// frontend/src/lib/chartDefaults.ts
export const gridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
} as const;

export const axisProps = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  tickLine: { stroke: "var(--border)" },
  axisLine: { stroke: "var(--border)" },
} as const;

export const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
};

export const tooltipLabelStyle = { color: "var(--popover-foreground)" };
export const tooltipItemStyle = { color: "var(--popover-foreground)" };
export const tooltipCursorProps = { fill: "var(--accent)", opacity: 0.3 };
export const legendWrapperStyle = { color: "var(--muted-foreground)" };
```

Note: The `@theme inline` block maps `--color-border` → `var(--border)`, so in CSS attribute strings (like `stroke="var(--border)"`), use `var(--border)` — the raw CSS variable — not the Tailwind-generated `--color-border` alias. Both resolve the same value but `var(--border)` is the canonical shadcn form.

**Important nuance found in codebase audit:** The existing charts use `var(--color-border)` and `var(--color-popover)` etc. — the Tailwind-generated aliases from `@theme inline`. These work correctly because `@theme inline` maps `--color-border: var(--border)`. Either form (`var(--border)` or `var(--color-border)`) resolves identically. For consistency with existing code, keep using `var(--color-*)` form in the chart components to match the existing pattern in `RevenueChart.tsx` and `HrKpiCharts.tsx`.

### Tailwind v4 Dark Mode Mechanics (Verified)

The project already uses the correct Tailwind v4 dark mode approach:

```css
/* index.css line 6 */
@custom-variant dark (&:is(.dark *));
```

This means `dark:bg-background` compiles to `.dark .element { background: var(--background); }` — any element inside a `.dark` ancestor gets the dark variant applied. The toggle mechanism is adding/removing `class="dark"` on `<html>`.

**Critical for ThemeProvider:** CSS specificity order:
1. `.dark { --background: ... }` — lowest specificity (class rule)
2. `html { style: "--background: brand_value" }` — inline styles, always win

This is why ThemeProvider MUST remove surface token inline styles when dark mode is active. Inline styles override `.dark` block rules regardless of specificity.

### shadcn/ui Dark Mode (Verified)

All shadcn/ui primitives in this project use `@theme inline` aliased tokens:
- `bg-card` → `var(--card)` → resolved by `:root` or `.dark` block
- `text-card-foreground` → `var(--card-foreground)` → resolved by `:root` or `.dark` block

The primitives in `frontend/src/components/ui/` are already correctly implemented — they use Tailwind token utilities, not hardcoded colors. The only identified hardcoded color in a shadcn primitive file is `dialog.tsx:32` (`bg-black/10` for the backdrop overlay) — this is the original shadcn default and is acceptable per D-05.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting `.dark` class changes | Custom polling or event system | `MutationObserver` (native browser API) | Built-in, efficient, fires immediately on DOM mutation |
| Dark mode CSS variables | Manual per-component dark styles | `.dark` CSS block in `index.css` + Tailwind `dark:` utilities | Already complete; token propagation is automatic |
| Chart color tokens | Per-chart `useTheme()` hook with JS color values | CSS variables referenced inline in chart props | No JS mode detection needed; CSS variables resolve at paint time |

---

## Common Pitfalls

### Pitfall 1: Inline Style Specificity Override
**What goes wrong:** ThemeProvider continues to call `style.setProperty('--background', lightValue)` when dark mode is active. `.dark { --background: darkValue }` has no effect because inline styles always win over class rules.
**Why it happens:** The original `applyTheme()` applies all 6 tokens unconditionally. Adding `dark` class to `<html>` does not remove the inline style — they coexist, and inline wins.
**How to avoid:** When dark mode is detected, call `style.removeProperty('--background')` (and other surface tokens) rather than setting them. The `.dark` block then has no inline competitor.
**Warning signs:** In dark mode, the page background remains white/brand-color instead of `oklch(0.145 0 0)`.

### Pitfall 2: MutationObserver Closure Staleness
**What goes wrong:** Observer is created once with a stale closure over `effective` settings. When settings update, the observer still calls `applyTheme` with old settings.
**Why it happens:** `useEffect` dependency array — if observer setup and `applyTheme` are in the same effect, re-running the effect on `effective` change will reconnect the observer with the fresh closure.
**How to avoid:** The `useEffect` that wires the observer must list `effective` as a dependency — which it naturally does if observer setup and initial `applyTheme` call are in the same effect. The cleanup disconnects the old observer; the new effect run reconnects with fresh `effective`.

### Pitfall 3: Recharts Tooltip Text Still Black in Dark Mode
**What goes wrong:** Tooltip background turns dark (from `var(--color-popover)`) but text is still dark because `contentStyle` has no `color` prop. Browser default text color is inherited from the surrounding dark background context but Recharts renders the tooltip in a portal/absolute element that may not inherit the dark-mode foreground.
**Why it happens:** Recharts `contentStyle` only receives what you explicitly pass; it does not inherit from the CSS token cascade automatically.
**How to avoid:** Always set `color: 'var(--color-popover-foreground)'` alongside `background: 'var(--color-popover)'`. Also set `labelStyle` and `itemStyle` — these control the label and value text separately and are not covered by `contentStyle.color`.

### Pitfall 4: Axis Tick Color Ignored via `stroke` Prop
**What goes wrong:** Setting `stroke` on `<XAxis>` / `<YAxis>` colors the axis line but NOT the tick text. Tick text is controlled by the `tick` prop, which accepts `{ fill: string }`.
**Why it happens:** Recharts separates axis line rendering from tick label rendering into different SVG elements with different props.
**How to avoid:** Always set both: `stroke="var(--color-border)"` (axis line) AND `tick={{ fill: 'var(--color-muted-foreground)' }}` (tick text). The existing code has `stroke` but is missing `tick.fill`.

### Pitfall 5: Status Badges Without Dark-Mode Adaptation
**What goes wrong:** `UploadHistory.tsx` status badges use hardcoded `bg-green-600`, `bg-yellow-400`, `bg-red-600`. These do not adapt in dark mode — they remain the same concrete color regardless of mode.
**Why it happens:** Semantic colors (success, warning, error) were hardcoded when first written because the project had no dark mode.
**How to avoid:** Map to CSS variable references or `var()` inline: `bg-[var(--color-success)]`, `bg-[var(--color-warning)]`, `bg-destructive`. `--color-success` and `--color-warning` are defined in the `@theme` block (fixed values, not mode-adaptive) — which is correct per D-09 (semantic consistency across modes).

### Pitfall 6: DropZone Blue Drag State Not Brand-Coherent
**What goes wrong:** DropZone uses hardcoded `bg-blue-600` / `bg-blue-50` / `text-blue-600` for drag-active and button states. In dark mode these remain blue but the rest of the app uses the brand `--primary`.
**How to avoid:** Replace with `bg-primary` / `bg-primary/5` / `text-primary`. The Browse button should use the default variant (`variant="default"`) without a custom `className` color override — the shadcn default already uses `--primary`.

---

## Code Examples

### Extended ThemeProvider (key change)

```typescript
// Token split — matches THEME_TOKEN_MAP keys
const SURFACE_TOKEN_KEYS = [
  'color_background',
  'color_foreground',
  'color_muted',
  'color_destructive',
] as const satisfies ReadonlyArray<keyof typeof THEME_TOKEN_MAP>;

const ACCENT_TOKEN_KEYS = [
  'color_primary',
  'color_accent',
] as const satisfies ReadonlyArray<keyof typeof THEME_TOKEN_MAP>;

function applyTheme(settings: Settings) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  // DM-04 / D-02: Always apply accent tokens regardless of mode
  ACCENT_TOKEN_KEYS.forEach((key) => {
    root.style.setProperty(THEME_TOKEN_MAP[key], settings[key]);
  });

  if (isDark) {
    // D-01 / D-03: Remove surface inline styles so .dark block wins
    SURFACE_TOKEN_KEYS.forEach((key) => {
      root.style.removeProperty(THEME_TOKEN_MAP[key]);
    });
  } else {
    // Light mode: apply brand surface tokens
    SURFACE_TOKEN_KEYS.forEach((key) => {
      root.style.setProperty(THEME_TOKEN_MAP[key], settings[key]);
    });
  }

  document.title = settings.app_name;
}
```

### Recharts Axis with Correct Fill

```tsx
// Before (missing tick.fill)
<XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 12 }} />

// After (complete token coverage per D-08 / UI-SPEC)
<XAxis
  dataKey="date"
  stroke="var(--color-border)"
  axisLine={{ stroke: 'var(--color-border)' }}
  tickLine={{ stroke: 'var(--color-border)' }}
  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
  tickFormatter={formatXAxis}
/>
```

### Recharts Tooltip with Text Colors

```tsx
// Before (missing color, labelStyle, itemStyle)
<Tooltip
  contentStyle={{
    background: 'var(--color-popover)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
  }}
/>

// After (complete per UI-SPEC Recharts Contract)
<Tooltip
  contentStyle={{
    background: 'var(--color-popover)',
    color: 'var(--color-popover-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  }}
  labelStyle={{ color: 'var(--color-popover-foreground)' }}
  itemStyle={{ color: 'var(--color-popover-foreground)' }}
  cursor={{ fill: 'var(--color-accent)', opacity: 0.3 }}
/>
```

### Status Badge with Semantic Token

```tsx
// Before (hardcoded)
<Badge className="bg-green-600 text-white hover:bg-green-600">success</Badge>
<Badge className="bg-yellow-400 text-slate-900 hover:bg-yellow-400">partial</Badge>
<Badge className="bg-red-600 text-white hover:bg-red-600">failed</Badge>

// After (token-based, adapts in dark mode)
<Badge className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]">success</Badge>
<Badge className="bg-[var(--color-warning)] text-foreground hover:bg-[var(--color-warning)]">partial</Badge>
<Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">failed</Badge>
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a pure frontend code change with no external services, CLIs, or runtimes beyond the already-running Node.js dev environment).

---

## Open Questions

1. **DropZone button styling**
   - What we know: Line 116 uses `className="bg-blue-600 hover:bg-blue-700 text-white"` on a `<Button variant="default">`. The default variant in shadcn already renders with `--primary` background.
   - What's unclear: Whether the `className` was intentionally overriding the default variant because the Settings `--primary` at some point was set to a non-blue value, or if it was an oversight.
   - Recommendation: Remove the hardcoded className color override. The `variant="default"` shadcn styling will pick up whatever `--primary` is in Settings, which is correct behavior.

2. **PersonioCard.tsx `dark:text-green-400` on line 154**
   - What we know: This is the only existing `dark:` utility in the entire codebase — someone already added a dark override for the Personio connection success color.
   - What's unclear: Whether `dark:text-green-400` produces sufficient contrast or if it should be replaced with `text-[var(--color-success)]` (which is `#16a34a`, fixed).
   - Recommendation: Replace with `text-[var(--color-success)]` for consistency. `#16a34a` is a medium-dark green that may have insufficient contrast on dark backgrounds — but WCAG audit is Phase 23. For Phase 21, token consistency is the goal.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` dark mode config | CSS-first `@custom-variant dark` in `index.css` | Tailwind v4 (breaking change from v3) | No `tailwind.config.js` exists in this project — CSS-first is already in use |
| `darkMode: 'class'` in tailwind.config.js | `@custom-variant dark (&:is(.dark *))` | Tailwind v4 | Equivalent functionality, different syntax |
| Separate dark theme CSS file | Single `index.css` with `:root` + `.dark` blocks | shadcn/ui default | All tokens in one file |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `frontend/src/index.css`, `ThemeProvider.tsx`, `defaults.ts`, `RevenueChart.tsx`, `HrKpiCharts.tsx`, `UploadHistory.tsx`, `DropZone.tsx`, `EmployeeTable.tsx`, `ErrorList.tsx`, `dialog.tsx`, `deltaFormat.ts`
- `21-CONTEXT.md` — locked decisions D-01 through D-14
- `21-UI-SPEC.md` — Recharts contract table, hardcoded color substitution table, grep patterns

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — stack versions and conventions
- `REQUIREMENTS.md` — DM-01 through DM-04 scope definitions

### Tertiary (LOW confidence)
- None — all findings are directly from codebase inspection and planning documents

---

## Metadata

**Confidence breakdown:**
- Existing `.dark` CSS block completeness: HIGH — read directly from `index.css:95-127`
- ThemeProvider extension pattern: HIGH — read source, pattern is straightforward MutationObserver use
- Recharts gaps identified: HIGH — read both chart components directly; gaps are specific and enumerated
- Hardcoded color inventory: HIGH — ran all four grep patterns from 21-UI-SPEC.md directly against codebase
- shadcn/ui component dark readiness: HIGH — all components use Tailwind token utilities, confirmed by absence of hardcoded colors in `frontend/src/components/ui/`

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack — Tailwind v4, shadcn/ui copy-paste, Recharts 3.8.1)
