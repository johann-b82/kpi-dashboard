# Phase 58: Sensors Layout Parity - Research

**Researched:** 2026-04-22
**Domain:** React/TypeScript frontend chrome refactor — `/sensors` layout parity with other dashboard routes (pure relocation of existing controls into `SubHeader`).
**Confidence:** HIGH

## Summary

Phase 58 is a mechanical relocation, not a design or capability phase. Every component the planner will move already exists and ships production-hardened: `SubHeader` already conditionally renders per-route content (Phase 56 D-07 pattern), `SensorTimeWindowPicker` is a drop-in `SegmentedControl` consumer, `PollNowButton` is a Phase 55 `Button` consumer with its mutation/timeout/toast flow locked in, and `SensorFreshnessIndicator` already lives in the SubHeader right slot. The only engineering is wiring: hoist `SensorTimeWindowProvider` to `App.tsx`, extend `SubHeader.tsx` with a `/sensors` left-slot block for the picker plus a right-slot prepend for `PollNowButton`, add an icon + `size="sm"` to `PollNowButton` (or a thin wrapper), and delete the control bar from `SensorsPage.tsx`.

All required i18n keys already exist in both locales (`en.json` + `de.json`) — zero new keys are needed unless the planner introduces an aria-label for picker placement. No backend change, no API change, no new primitive, no new abstraction.

**Primary recommendation:** Execute the relocation exactly as CONTEXT.md D-01..D-08 lock it. The single load-bearing implementation decision the planner must resolve is the `PollNowButton` surface — either thread `size`/`icon` props into the existing component, or wrap a thin SubHeader-specific variant that composes `Button` directly. Evidence below favours threading props (single source of truth for the poll/timeout/toast flow).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `SensorTimeWindowProvider` is hoisted to wrap `App.tsx` (always mounted). Both `SubHeader` and `SensorsPage` consume the same `useSensorWindow()` context. Cost is a 5-element string state always live; benefit is no remounting on `/sensors` entry and a single source of truth.
- **D-02:** Time window stays state-only — no URL sync, no `?window=` query param. Matches `DateRangeFilter` on `/sales`. Defaults reset on reload, as today.
- **D-03:** Time-window `SegmentedControl` (`SensorTimeWindowPicker`) sits in the **left slot**, mirroring `DateRangeFilter` on `/sales`. Establishes the convention: "time/range scope" lives left, "actions + freshness" live right.
- **D-04:** Right-slot order on `/sensors`: **`PollNowButton` → `SensorFreshnessIndicator`** (action then status). Existing `<SensorFreshnessIndicator />` stays where it is in the right slot; the button is inserted to its left.
- **D-05:** New SubHeader controls render only when `location === "/sensors"`, reusing the per-route conditional pattern from D-07 (Phase 56). Picker + PollNow are completely hidden on every other route.
- **D-06:** `/sensors` page body after the move contains only `SensorStatusCards` + `SensorTimeSeriesChart`. The current `<div className="flex items-center justify-between">` wrapping `PollNowButton` + `SensorTimeWindowPicker` is deleted entirely. No spacer.
- **D-07:** `PollNowButton` renders as **icon + label, size="sm"** in the SubHeader using the Phase 55 `Button` primitive at `h-8`. Icon is a refresh/play lucide glyph; label remains the existing `t("sensors.pollNow")` key ("Jetzt messen"/"Measure now").
- **D-08:** Loading UX during the 30s blocking poll: button becomes disabled, icon swaps to `Loader2` with `animate-spin`. No inline status text — keeps right slot from fighting with the freshness indicator. Matches existing `PollNowButton` behavior; only the icon swap is new.

### Claude's Discretion

- Exact lucide icon for "Jetzt messen" (planner picks: `RefreshCw`, `Play`, `Activity`, `Zap` are all reasonable — match what the rest of the app already uses for "kick a job").
- File restructure shape: keep `SensorTimeWindowPicker` colocated in `components/sensors/SensorTimeWindow.tsx`, or extract a thinner `SubHeaderSensorPicker` wrapper — planner decides based on prop surface.
- Whether to delete the now-empty `pt-4` from `SensorsPage` or keep it for visual rhythm with other pages.
- Exact arrangement of left-slot picker if any vertical divider or `gap-3` tweak is needed for visual parity with `/sales`.

### Deferred Ideas (OUT OF SCOPE)

- URL sync for the sensor time window (`?window=24h`) — would enable shareable `/sensors` deep links. Not requested; revisit only if shareable links become a need.
- Future `/settings/sensors` SubHeader treatment — not in this phase.
- Mobile (<sm) layout for the SubHeader on `/sensors` — current SubHeader is desktop-first; no responsive work in this phase. Surface as Phase 59 input if regressions are spotted.
- "Polling…" inline status text alongside the spinner — rejected for this phase to keep right slot uncluttered.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SENSORS-01 | The date-range / time-window selector on `/sensors` moves from the page body into the SubHeader (left or center slot). | `SubHeader.tsx` already owns left-slot `DateRangeFilter` on `/sales` (lines 116-122) via the same `location === "/..."` guard. Extend the pattern for `/sensors` with `SensorTimeWindowPicker`. Provider hoist (D-01) resolves the context-scoping question. |
| SENSORS-02 | The "Jetzt messen" action moves into the SubHeader right slot and uses the shared `Button` primitive. | `PollNowButton` already imports and renders `Button` from `@/components/ui/button` (line 4). No new primitive needed. Insert into right-slot block before `<SensorFreshnessIndicator />`. Add `RefreshCw` + `Loader2` icons (both already used in `PersonioCard.tsx`). |
| SENSORS-03 | The `/sensors` page body contains only KPI cards, charts, and tables — no header-level controls remain inline. | `SensorsPage.tsx` body after edit = `<SensorStatusCards />` + `<SensorTimeSeriesChart />` inside the existing `max-w-7xl ... space-y-8` div. Delete the `<div className="flex items-center justify-between ...">` wrapper (lines 24-27) entirely. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow:** No direct file edits outside a GSD command. This phase runs under `/gsd:execute-phase`.
- **Frontend stack (locked):** React 19, Vite, TypeScript, Tailwind v4, shadcn/ui (base-nova preset), `@base-ui/react` primitives, `lucide-react` icons, TanStack Query v5.
- **No backend / API changes** — v1.19 is pure-frontend (ROADMAP cross-cutting hazard #10).
- **No `dark:` Tailwind variants** — tokens only (cross-cutting hazard #3). `SubHeader.tsx` is already compliant.
- **DE/EN i18n parity** — any new keys must ship in both `en.json` and `de.json` in the same commit (CI-enforced via `check-locale-parity.mts` from Phase 57).
- **Container is Docker Compose** — irrelevant to this phase (frontend-only).
- **apiClient-only in admin frontend** — `PollNowButton` already uses `pollSensorsNow()` from `@/lib/api`; preserved.

## Standard Stack

This phase introduces **no new dependencies**. It consumes already-installed primitives.

### Core (already installed, no changes)
| Library | Version (installed) | Purpose in this phase | Why Standard |
|---------|---------------------|-----------------------|--------------|
| React | 19.x | JSX, hooks, context | Project baseline. `SensorTimeWindowProvider` uses `createContext` + `useState` (already implemented). |
| TypeScript | 5.x | Type safety on context, slot props | Project baseline. |
| Tailwind CSS | 4.x | `h-8`, `gap-3`, slot layout utilities | Project baseline. |
| `@base-ui/react` | project-pinned | Underlies `Button` primitive | Project baseline (Phase 55). |
| `@tanstack/react-query` | 5.x | `useMutation` for poll, query invalidation | `PollNowButton` already uses it (unchanged). |
| `lucide-react` | project-pinned | `RefreshCw`, `Loader2` icons | Already imported repo-wide (`PersonioCard.tsx:4`). |
| `wouter` | project-pinned | `useLocation()` for per-route conditional | Already used in `SubHeader.tsx:1,90`. |
| `react-i18next` | project-pinned | `t()` for labels/aria | Already used in `PollNowButton.tsx:2,32` and `SubHeader.tsx:3,89`. |

### In-repo primitives (already exist — consume, don't recreate)
| Component | Path | Purpose |
|-----------|------|---------|
| `Button` | `frontend/src/components/ui/button.tsx` | `size="sm"` → `h-7`, `size="default"` → `h-8`. **Note:** CONTEXT.md D-07 says "size=sm … at h-8" — this conflates two separate facts. The Phase 55 primitive resolves `sm` to `h-7`, not `h-8`. UI-SPEC.md line 96 flags this. See **Pitfall 1** below. |
| `SegmentedControl` | `frontend/src/components/ui/segmented-control.tsx` | Backs `SensorTimeWindowPicker`; 5-option, stays as SegmentedControl (Phase 54 carved out 2-option cases to `Toggle` only). |
| `SensorTimeWindowPicker` | `frontend/src/components/sensors/SensorTimeWindow.tsx` | Already consumes `useSensorWindow()`; drop-in for SubHeader left slot. |
| `SensorTimeWindowProvider` | same file | Hoist target for D-01. |
| `PollNowButton` | `frontend/src/components/sensors/PollNowButton.tsx` | Already Phase 55-compliant; needs icon + size prop surface. |
| `SensorFreshnessIndicator` | inline in `SubHeader.tsx:50-86` | Stays in place; `PollNowButton` inserts to its left. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff / Why Not |
|------------|-----------|--------------------|
| Threading `size`/`icon` into `PollNowButton` | Thin `SubHeaderPollNowButton` wrapper composing `Button` directly | Wrapper duplicates mutation + toast + timeout logic or forces extracting a hook. Threading preserves single source of truth. Recommended. |
| Keeping `SensorTimeWindowProvider` on `SensorsPage` | Conditionally rendering provider on `/sensors` around SubHeader | Fails D-01: context would need to wrap SubHeader conditionally, which reintroduces remount behavior. Rejected by user. |
| `Play` / `Activity` / `Zap` icon | `RefreshCw` | `RefreshCw` is the app's established "kick a refresh job" icon (`PersonioCard.tsx:214`). Use it for consistency. Recommended. |
| New SubHeader abstraction (slot-renderer registry) | Continue per-route `if` chain | Per-route conditional is Phase 56 D-07 lock; extending is correct, abstraction is YAGNI this phase. |

**Installation:** No `npm install` needed.

## Architecture Patterns

### Recommended file changes (4 files, ~1 surgical diff each)

```
frontend/src/
├── App.tsx                                       # wrap AppShell children with <SensorTimeWindowProvider>
├── components/
│   ├── SubHeader.tsx                             # add /sensors left-slot block (picker) + right-slot prepend (PollNow)
│   └── sensors/
│       ├── PollNowButton.tsx                     # accept size + icon props; swap Loader2 on isPending
│       └── SensorTimeWindow.tsx                  # unchanged structurally; export surface is reused
└── pages/
    └── SensorsPage.tsx                           # delete provider wrapper + control bar <div>; body = cards + chart
```

### Pattern 1: Per-route conditional SubHeader slot

**What:** `SubHeader.tsx` reads `useLocation()` and renders per-route content inside the shared `flex items-center justify-between` chrome shell. Established Phase 56 D-07.

**When to use:** Any route-specific control that belongs in the header but isn't a global control.

**Example (existing, verbatim from SubHeader.tsx:100-147):**

```tsx
// left slot
{location === "/sales" && (
  <DateRangeFilter value={range} preset={preset} onChange={handleFilterChange} />
)}
// right slot
{location === "/sensors" ? (
  <SensorFreshnessIndicator />
) : location === "/hr" ? (
  <HrFreshnessIndicator />
) : (
  <FreshnessIndicator />
)}
```

**Extend for Phase 58:**

```tsx
// left slot — add:
{location === "/sensors" && <SensorTimeWindowPicker />}

// right slot — add before the existing freshness ternary:
{location === "/sensors" && <PollNowButton size="sm" />}
```

### Pattern 2: React context hoist with `useState` (D-01)

**What:** Move a colocated provider from a page component to `App.tsx` so two distinct subtrees (SubHeader, Page) consume the same state.

**When to use:** When a single piece of UI state needs to be read by both chrome and page body, and URL sync is not required.

**Example (existing hoist pattern, from App.tsx:100-117):**

```tsx
<ThemeProvider>
  <SettingsDraftProvider>
    <SensorDraftProvider>
      <DateRangeProvider>          {/* already hoisted — SubHeader reads via useDateRange() */}
        <AppShell />
      </DateRangeProvider>
    </SensorDraftProvider>
  </SettingsDraftProvider>
</ThemeProvider>
```

**Extend:** Add `<SensorTimeWindowProvider>` as an inner wrapper (order doesn't matter functionally; place it just inside `DateRangeProvider` for symmetry).

### Pattern 3: Mutation-aware icon swap on a single Button (D-07/D-08)

**What:** A button whose icon swaps between an idle glyph and `Loader2 animate-spin` based on mutation state. Disabled + `aria-busy` while loading.

**Reference pattern (verbatim from `PersonioCard.tsx:204,214`):**

```tsx
<Button ...>
  {isPending
    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />...</>
    : <><RefreshCw className="h-4 w-4 mr-1" />...</>}
</Button>
```

Note: `Button` primitive CSS rule `[&_svg:not([class*='size-'])]:size-4` (button.tsx:19) auto-sizes unclassed SVGs. For `size="sm"` the auto-rule shifts to `size-3.5` (line 38). The planner can rely on the auto-rule and drop explicit `h-4 w-4` classes — or keep explicit classes if visual regression in the SubHeader slot is a concern.

### Anti-Patterns to Avoid

- **Adding a new SubHeader abstraction (slot registry, per-route config object).** Out of scope — Phase 56 D-07 locks the per-route `if` pattern for v1.19. Save abstraction for a later phase when the chain grows.
- **Conditionally wrapping `<SubHeader>` with `<SensorTimeWindowProvider>` instead of hoisting to App.tsx.** Rejected by user (D-01). Reintroduces remount-on-route-change.
- **Creating a new `PollNowButton` variant component in `components/sensors/`.** Duplicates mutation + toast + timeout logic. Thread `size`/`icon` props instead.
- **Adding a `?window=` URL param "for free" because you're already in the file.** Explicit deferred item.
- **Hardcoding `"1h" | "6h" | "24h" | "7d" | "30d"` strings at any new call site.** `SENSOR_WINDOWS` constant + `SensorWindow` type already exist in `SensorTimeWindow.tsx`; import them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button-sized chip with label | Custom `<button>` with Tailwind | `Button size="sm"` from `@/components/ui/button` | Phase 55 already standardized this; CI guard `check:phase-57` blocks raw `<button>`. |
| Loading spinner | Custom CSS keyframe | `<Loader2 className="animate-spin" />` from `lucide-react` | Repo convention (`PersonioCard.tsx`, `App.tsx:79,87`). |
| Refresh/poll icon | Custom SVG | `<RefreshCw />` from `lucide-react` | Repo convention for "kick a job". |
| 5-option picker | Custom toggle row | `SegmentedControl` | Phase 54 lock: 2-option → `Toggle`, 3+-option → `SegmentedControl`. Sensor window has 5. |
| Per-route header slot | `Object.fromEntries({ "/sensors": ..., "/sales": ... })` registry | Inline `&&` conditionals in `SubHeader.tsx` | Phase 56 D-07 lock: per-route `if` chain is the v1.19 pattern. |
| Context provider to pass window between SubHeader and SensorsPage | Prop drilling / URL param / Zustand store | Existing `SensorTimeWindowProvider` hoisted to `App.tsx` | D-01 lock; existing context is fit-for-purpose. |
| i18n keys | Hardcode EN + DE string literals | Existing `sensors.poll.*`, `sensors.window.*`, `sensors.subheader.*` keys | All keys exist in both locales (verified below). |

**Key insight:** Phase 58 is a wiring phase. Every abstraction it needs already exists. Writing "new" code here is almost always a miss.

## Runtime State Inventory

This phase is a frontend refactor with **no stored data, no service config, no OS registrations, no secrets, and no backend build artifacts** to migrate. Included for discipline:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `SensorWindow` state is `useState`, resets on reload (D-02). No DB or API persistence. No `localStorage`/`sessionStorage` for sensor window. Verified by grep of `SensorTimeWindow.tsx`. | None. |
| Live service config | None — no external service config references `/sensors` chrome layout. | None. |
| OS-registered state | None — pure frontend bundle. | None. |
| Secrets / env vars | None. | None. |
| Build artifacts | Vite bundle (`frontend/dist/`) — auto-rebuilds on next `npm run build`. No pinned artifact references `SensorsPage` control bar. | Standard `npm run build` as part of CI. |

**Canonical question answered:** After every file in the repo is updated, there is no cached, stored, or registered state from the old layout that survives. The old control bar exists in JSX only; deleting the JSX removes it entirely.

## Common Pitfalls

### Pitfall 1: `size="sm"` on the Button primitive resolves to `h-7`, not `h-8`

**What goes wrong:** CONTEXT.md D-07 says "`size="sm"` … using the Phase 55 `Button` primitive at `h-8`". These two facts are inconsistent with the actual primitive: `button.tsx:35-38` defines `default` → `h-8`, `sm` → `h-7`. UI-SPEC.md line 96 already flagged this.

**Why it happens:** Verbal shorthand ("the small button with the h-8 feel") collides with the primitive's variant names.

**How to avoid:** Planner resolves explicitly — either
- **(a) Use `size="sm"` (h-7)** — marginally denser than the SubHeader's `h-12` chrome; matches `sm` label "small". Consistent with how other SubHeader chips should render.
- **(b) Use `size="default"` (h-8)** — matches the literal `h-8` number in D-07.
- **Recommended: (a) `size="sm"`** because D-07's intent is explicitly "size="sm"" (the numeric reference was the conflation). UI-SPEC.md line 96 also recommends this. Verify visual fit in the SubHeader `h-12` slot during execution.

**Warning signs:** Row height in SubHeader looks off-by-one compared to the existing `SensorFreshnessIndicator` text line (`text-xs`) height.

### Pitfall 2: `SensorTimeWindowProvider` re-imported on `SensorsPage.tsx` after hoist

**What goes wrong:** Two providers nested — inner one shadows outer, context splits between SubHeader (outer value) and body (inner value). Picker in header changes state but cards/chart don't re-render.

**Why it happens:** Natural drift when editing files in parallel; import line survives the hoist.

**How to avoid:** Explicitly delete the `SensorTimeWindowProvider` import and JSX wrapper in `SensorsPage.tsx`. Keep only `SensorTimeWindowPicker` export used elsewhere (if anywhere — grep confirms: only `SensorsPage.tsx` uses it today, so this import line disappears entirely).

**Warning signs:** Changing the window in SubHeader does not refetch `SensorStatusCards` / `SensorTimeSeriesChart` data.

### Pitfall 3: `useSensorWindow()` throws on non-`/sensors` routes after hoist

**What goes wrong:** If the hoist is done but any component outside `/sensors` mistakenly imports `useSensorWindow()`, it used to throw "must be used inside provider". After hoist, it silently returns the real value — bug goes latent.

**Why it happens:** Global hoist removes the compile/runtime fence the original colocated provider provided.

**How to avoid:** `useSensorWindow()` is currently only called inside `SensorTimeWindowPicker` (same file) and `SensorStatusCards.tsx` / `SensorTimeSeriesChart.tsx` (via import). Confirm grep. No new callers expected this phase. Accept that the hoist is a deliberate relaxation — the trade-off in D-01 is explicit.

**Warning signs:** New code on unrelated routes starts calling `useSensorWindow()` and gets a stale `"24h"` default; surface as a code-review checkpoint.

### Pitfall 4: Icon sizing conflicts with `Button size="sm"` CSS rule

**What goes wrong:** `button.tsx:38` has `[&_svg:not([class*='size-'])]:size-3.5` for `sm`. Passing `<RefreshCw className="h-4 w-4" />` forces the icon to `h-4 w-4` (= `size-4`), overriding the auto-rule and making the icon visually larger than the sibling label text.

**Why it happens:** Copy-pasting the `PersonioCard.tsx` pattern which explicitly sets `h-4 w-4`.

**How to avoid:** For `size="sm"`, **omit explicit size classes on the icon** and let the auto-rule apply `size-3.5`. For `size="default"`, the auto-rule applies `size-4` which matches the `h-4 w-4` pattern.

**Warning signs:** Icon looks disproportionate to the label; visual regression against other SubHeader right-slot elements.

### Pitfall 5: Left-slot layout inside `/sensors` breaks existing `gap-3` assumption

**What goes wrong:** `SubHeader.tsx:103` uses `<div className="flex items-center gap-3">` for the left slot. A single-child picker is fine; if a divider or secondary control is added "for visual rhythm", the gap changes behavior.

**How to avoid:** Render `SensorTimeWindowPicker` as a single child — no wrapping div, no divider. Matches `DateRangeFilter` on `/sales` (also a single child).

**Warning signs:** Visual test shows extra whitespace or phantom divider.

### Pitfall 6: DE/EN i18n parity guard trips on a new aria-label

**What goes wrong:** Planner decides to add an `aria-label` on the picker placement ("in header") — e.g. `sensors.window.ariaSubheader` — and only commits it to `en.json`. `check-locale-parity.mts` fails CI.

**How to avoid:** Any new key lands in both `en.json` and `de.json` in the same commit. Current plan needs zero new keys (verified — see "i18n Inventory" below). If one is introduced, DE copy must be du-tone (Phase 57 convention).

**Warning signs:** `npm run check:locale-parity` fails.

### Pitfall 7: Forgetting `pt-4` resolution on `SensorsPage`

**What goes wrong:** Claude's-discretion item: keep or drop `pt-4` from the body container? If kept: visual rhythm matches other routes. If dropped: KPI cards hug the SubHeader more tightly and feel crammed.

**How to avoid:** Default is **keep `pt-4`** (UI-SPEC default) — matches `/sales` and `/hr` body rhythm. Only drop if a visual review says otherwise.

## Code Examples

Verified patterns from current codebase.

### Example 1: Per-route left slot in SubHeader (extend this block)

Source: `frontend/src/components/SubHeader.tsx:103-123`

```tsx
<div className="flex items-center gap-3">
  {isDashboard && (
    <Toggle
      segments={[
        { value: "/sales", label: t("nav.sales") },
        { value: "/hr", label: t("nav.hr") },
      ] as const}
      value={location === "/hr" ? "/hr" : "/sales"}
      onChange={(path) => navigate(path)}
      aria-label={t("nav.dashboardToggleLabel")}
      className="border-transparent"
    />
  )}
  {location === "/sales" && (
    <DateRangeFilter value={range} preset={preset} onChange={handleFilterChange} />
  )}
  {/* ADD: Phase 58 */}
  {location === "/sensors" && <SensorTimeWindowPicker />}
</div>
```

### Example 2: Per-route right slot in SubHeader (insert PollNowButton before freshness)

Source: `frontend/src/components/SubHeader.tsx:124-146`

```tsx
<div className="flex items-center gap-3">
  {isDashboard && (
    <AdminOnly>
      <Link href="/upload" aria-label={t("nav.upload")} ... />
    </AdminOnly>
  )}
  {/* ADD: Phase 58 — before the freshness ternary */}
  {location === "/sensors" && <PollNowButton size="sm" />}

  {location === "/sensors" ? (
    <SensorFreshnessIndicator />
  ) : location === "/hr" ? (
    <HrFreshnessIndicator />
  ) : (
    <FreshnessIndicator />
  )}
</div>
```

### Example 3: PollNowButton surface expansion (thread size + icon)

Current: `frontend/src/components/sensors/PollNowButton.tsx:31-66`

Target shape (minimal edit — planner confirms prop forwarding to `Button`):

```tsx
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PollNowButtonProps {
  size?: "default" | "sm";
}

export function PollNowButton({ size = "default" }: PollNowButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({ /* unchanged */ });

  const Icon = mutation.isPending ? Loader2 : RefreshCw;
  const label = mutation.isPending
    ? t("sensors.poll.refreshing")
    : t("sensors.poll.now");

  return (
    <Button
      type="button"
      size={size}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-busy={mutation.isPending}
    >
      <Icon className={mutation.isPending ? "animate-spin" : undefined} />
      {label}
    </Button>
  );
}
```

Note: Drop explicit `h-4 w-4` on icon — let Button's `[&_svg:not([class*='size-'])]:size-*` rule apply. Verify visual in both `size="default"` (page callers, if any) and `size="sm"` (SubHeader). `SensorsPage` is the only current caller and it's being deleted, so the `size="default"` default is effectively unused after this phase — still keep it for the default-safe API.

### Example 4: SensorsPage after migration

Target `frontend/src/pages/SensorsPage.tsx`:

```tsx
import { SensorStatusCards } from "@/components/sensors/SensorStatusCards";
import { SensorTimeSeriesChart } from "@/components/sensors/SensorTimeSeriesChart";

export function SensorsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
      <SensorStatusCards />
      <SensorTimeSeriesChart />
    </div>
  );
}
```

Note: Provider import + wrapper gone (hoisted). Control-bar `<div>` + `PollNowButton` + `SensorTimeWindowPicker` imports gone. `pt-4` preserved (UI-SPEC default).

### Example 5: App.tsx provider hoist

Target `frontend/src/App.tsx:100-117`:

```tsx
import { SensorTimeWindowProvider } from "./components/sensors/SensorTimeWindow";
// ...

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SettingsDraftProvider>
            <SensorDraftProvider>
              <DateRangeProvider>
                <SensorTimeWindowProvider>   {/* ADD */}
                  <AppShell />
                </SensorTimeWindowProvider>
              </DateRangeProvider>
            </SensorDraftProvider>
          </SettingsDraftProvider>
        </ThemeProvider>
      </AuthProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
```

## i18n Inventory (existing — zero new keys expected)

Verified present in both `frontend/src/locales/en.json` and `frontend/src/locales/de.json`:

| Key | EN | DE |
|-----|----|----|
| `sensors.window.1h/6h/24h/7d/30d` | `1h/6h/24h/7d/30d` | `1 Std / 6 Std / 24 Std / 7 T / 30 T` |
| `sensors.window.aria` | `Time window` | `Zeitraum` |
| `sensors.poll.now` | `Poll now` | `Jetzt messen` |
| `sensors.poll.refreshing` | `Polling...` | `Messung läuft...` |
| `sensors.poll.success` | `Polled {{count}} sensors` | `{{count}} Sensoren gemessen` |
| `sensors.poll.failure` | `Poll failed — check sensor config` | `Messung fehlgeschlagen — prüfe die Konfiguration` |
| `sensors.poll.timeout` | `Poll timed out after 30 s` | `Messung nach 30 s abgebrochen` |
| `sensors.subheader.lastMeasured` | `Last measured {{seconds}} s ago` | `Letzte Messung vor {{seconds}} s` |
| `sensors.subheader.never` | `No measurements yet` | `Noch keine Messungen` |

**Note on CONTEXT.md D-07:** references `t("sensors.pollNow")`. Actual key is `sensors.poll.now` (dotted, not camelCase). Planner must use the real key. UI-SPEC.md has this correct.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|--------------|------------------|--------------|-----------------------|
| Raw `<button>` for actions | `Button` primitive from `@/components/ui/button` | Phase 55 (v1.19) | `PollNowButton` already conforms. CI grep guard blocks regression. |
| 2-option `SegmentedControl` | `Toggle` primitive | Phase 54 (v1.19) | No impact — sensor window is 5-option, stays on `SegmentedControl`. |
| Top-header content tabs | `SubHeader` per-route conditional slots | Phase 56 (v1.19) | This phase extends that pattern. |
| Ad-hoc delete dialogs | `DeleteDialog` + `DeleteButton` | Phase 57 (v1.19) | No impact — phase has no destructive actions. |
| `h-9`/`h-10`/`h-11` form heights | `h-8` default | Phase 55 (v1.19) | Reinforces the D-07 height target. |

**Deprecated / gone:**
- `lastDashboard` sessionStorage routing hint (removed in Phase 56 P03). Not relevant here.
- Raw `<button>` in signage + admin pages (migrated in Phase 55 P04). Not relevant here.

## Open Questions

1. **Does the existing `PollNowButton` signature accept new props without downstream breakage?**
   - What we know: Current callers: only `SensorsPage.tsx:25` — `<PollNowButton />` (no props). Signature today accepts no props.
   - What's unclear: Whether adding an optional `size?: "default" | "sm"` prop is visible to any test file.
   - Recommendation: Grep `PollNowButton` usage before editing. Safe change — adding an optional prop with default is backward-compatible. No migration concerns.

2. **Should the `size="default"` branch of `PollNowButton` survive after the SubHeader move?**
   - What we know: After Phase 58, `SensorsPage` no longer renders `PollNowButton`. The only caller is SubHeader with `size="sm"`.
   - What's unclear: Whether any admin sub-page may later render a standalone "poll now" action.
   - Recommendation: Keep the default prop (`size = "default"`) for API safety — no maintenance cost, future-proof.

3. **Is the `gap-3` between left-slot children acceptable for a single-child `/sensors` left slot?**
   - What we know: `/sales` left slot is a single `DateRangeFilter` child inside `gap-3` — works visually.
   - What's unclear: Whether the picker (SegmentedControl with 5 segments) has enough visual weight to feel unbalanced alone on the left.
   - Recommendation: Ship as-is; visually audit during execution. Phase 59 owns the a11y/parity sweep where any visual fix can land.

## Environment Availability

Not applicable — this phase is frontend-only (TypeScript/React), no external tools beyond the existing Node/Vite toolchain already in use. No CLI utilities, databases, or services are newly required.

## Sources

### Primary (HIGH confidence — in-repo verification)
- `frontend/src/components/SubHeader.tsx` — per-route conditional slot pattern, existing `SensorFreshnessIndicator` placement
- `frontend/src/pages/SensorsPage.tsx` — current body structure to strip
- `frontend/src/components/sensors/SensorTimeWindow.tsx` — `SensorTimeWindowProvider` + `useSensorWindow` + `SENSOR_WINDOWS` + `SensorTimeWindowPicker`
- `frontend/src/components/sensors/PollNowButton.tsx` — current mutation/timeout/toast flow
- `frontend/src/App.tsx` — provider hoist target
- `frontend/src/components/ui/button.tsx` — Button variant contract (size scale, svg auto-size rule)
- `frontend/src/locales/{en,de}.json` — i18n keys verified present in both locales
- `frontend/src/components/settings/PersonioCard.tsx` — `RefreshCw` + `Loader2` icon swap pattern (app convention)
- `.planning/phases/58-sensors-layout-parity/58-CONTEXT.md` — locked decisions D-01..D-08
- `.planning/phases/58-sensors-layout-parity/58-UI-SPEC.md` — design contract
- `.planning/REQUIREMENTS.md` — SENSORS-01..03 acceptance text
- `.planning/ROADMAP.md` — phase goal + success criteria + cross-cutting hazards

### Secondary (MEDIUM confidence — extrapolation from prior-phase outputs)
- Phase 56 P03 — NavBar/SubHeader atomic refactor established the `h-16` + `h-12` chrome + per-route conditional pattern
- Phase 55 P01 — Button primitive size scale with `h-8` default and `h-7` for `sm`

### Tertiary (LOW confidence)
- None. All findings ground out in the repo or locked-in decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every component required is present in-repo and verified in code.
- Architecture: **HIGH** — the per-route conditional slot pattern and provider-hoist pattern both exist already; this phase only extends them.
- Pitfalls: **HIGH** — the `size=sm` → `h-7`/`h-8` disambiguation and the icon auto-sizing rule are read directly from the current `button.tsx`.
- i18n: **HIGH** — all required keys verified present in both locales.
- `PollNowButton` prop threading: **MEDIUM** — recommended approach (threading) not yet implemented; small risk in test-surface changes.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (pure in-repo state, stable unless a concurrent phase edits the touched files)
