---
phase: 06-settings-page-and-sub-components
plan: "01"
subsystem: ui
tags: [react, culori, oklch, color, shadcn, tailwind, vite, typescript]

requires:
  - phase: 05-frontend-plumbing-themeprovider-and-navbar
    provides: Settings type, fetchSettings, useSettings hook, ThemeProvider, DEFAULT_SETTINGS

provides:
  - react-colorful@5.6.1 installed (HexColorPicker for Wave 2 hooks/components)
  - culori@4.0.2 + @types/culori@4.0.1 installed (oklch color math)
  - shadcn Input primitive (base-ui/react/input wrapper, no asChild)
  - shadcn Label primitive (plain label element, no asChild)
  - color.ts: hexToOklch, oklchToHex, wcagContrast, WHITE_OKLCH
  - api.ts extended: SettingsUpdatePayload, updateSettings (PUT /api/settings), uploadLogo (POST /api/settings/logo)

affects:
  - 06-02-hooks
  - 06-03-sub-components
  - 06-04-settings-page

tech-stack:
  added:
    - react-colorful@^5.6.1 (dependency)
    - culori@^4.0.2 (dependency)
    - "@types/culori@^4.0.1" (devDependency)
  patterns:
    - Tree-shaken culori imports (parse, formatCss, formatHex, converter, wcagContrast)
    - Fault-tolerant error parsing: res.json().catch(() => fallback) for non-JSON error responses
    - oklch string format "oklch(L C H)" via formatCss — matches backend _OKLCH_RE validator

key-files:
  created:
    - frontend/src/lib/color.ts
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/label.tsx
  modified:
    - frontend/package.json (3 new packages)
    - frontend/package-lock.json (lockfile updated)
    - frontend/src/lib/api.ts (SettingsUpdatePayload + updateSettings + uploadLogo appended)

key-decisions:
  - "wcagContrast called with 2 args (not 3) — @types/culori 4.0.1 types only declare 2-arg signature; WCAG21 is culori default"
  - "shadcn input.tsx uses @base-ui/react/input (shadcn registry matched project base-ui pattern, no asChild)"
  - "shadcn label.tsx uses plain <label> element (no base-ui dependency, matching label primitive convention)"

patterns-established:
  - "color.ts is the single place for oklch math — hooks/components import hexToOklch/oklchToHex/wcagContrast from here"
  - "Fetcher error pattern: res.json().catch(() => fallback) guards against non-JSON 502/504 errors"

requirements-completed: [BRAND-05, UX-02]

duration: 2min
completed: 2026-04-11
---

# Phase 06 Plan 01: Foundation Dependencies Summary

**culori@4.0.2 + react-colorful@5.6.1 installed; hex<>oklch conversion module and PUT/POST settings fetchers wired, unblocking Wave 2 hooks and sub-components**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-11T16:17:07Z
- **Completed:** 2026-04-11T16:19:14Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Three npm packages installed at locked versions: react-colorful@^5.6.1, culori@^4.0.2, @types/culori@^4.0.1
- shadcn `input` and `label` primitives created matching project base-ui pattern (no `asChild`, no Radix)
- `frontend/src/lib/color.ts` created: hexToOklch, oklchToHex, wcagContrast, WHITE_OKLCH — all color-space logic isolated here
- `frontend/src/lib/api.ts` extended: SettingsUpdatePayload interface + updateSettings (PUT) + uploadLogo (POST) appended without touching existing exports
- Full build (tsc -b + vite build) passes clean across all three tasks

## Task Commits

1. **Task 1: Install deps and shadcn primitives** - `62a74e0` (feat)
2. **Task 2: Create frontend/src/lib/color.ts** - `45445f8` (feat)
3. **Task 3: Extend api.ts with updateSettings and uploadLogo** - `d5e3b7c` (feat)

**Plan metadata:** (docs commit follows)

## Export Signatures (for downstream plan executors)

### frontend/src/lib/color.ts
```typescript
export function hexToOklch(hex: string): string;
// Converts "#4466cc" → "oklch(0.55 0.15 250)" (backend-valid format via formatCss)
// Throws Error on unparseable input

export function oklchToHex(oklch: string): string;
// Converts "oklch(0.55 0.15 250)" → "#4466cc" (for HexColorPicker display)
// Returns "#000000" on parse failure

export function wcagContrast(colorA: string, colorB: string): number;
// WCAG 2.1 contrast ratio; accepts hex, rgb, oklch, named colors
// Returns 0 on parse failure; 4.5:1 threshold for BRAND-08

export const WHITE_OKLCH: "oklch(1 0 0)";
// Use for destructive/white contrast comparison
```

### frontend/src/lib/api.ts (new exports)
```typescript
export interface SettingsUpdatePayload {
  color_primary: string;    // oklch(L C H) format
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  default_language: "DE" | "EN";
  // NO logo_url, NO logo_updated_at (D-05 — separate endpoint)
}

export async function updateSettings(payload: SettingsUpdatePayload): Promise<Settings>;
// PUT /api/settings — throws Error with backend detail string on non-2xx

export async function uploadLogo(file: File): Promise<Settings>;
// POST /api/settings/logo — FormData with field name "file"
// throws Error with backend detail string on non-2xx
```

## Files Created/Modified
- `frontend/src/lib/color.ts` — hex↔oklch conversion + WCAG contrast helpers via culori
- `frontend/src/components/ui/input.tsx` — shadcn Input wrapping @base-ui/react/input
- `frontend/src/components/ui/label.tsx` — shadcn Label wrapping plain `<label>`
- `frontend/package.json` — 3 new packages added
- `frontend/package-lock.json` — lockfile updated
- `frontend/src/lib/api.ts` — SettingsUpdatePayload + updateSettings + uploadLogo appended

## Decisions Made

- **wcagContrast 2-arg call:** @types/culori 4.0.1 declares only `wcagContrast(a, b): number`. The plan specified a third `"WCAG21"` argument, but this isn't in the type definitions. Removed third arg — culori uses WCAG 2.1 by default.
- **shadcn input uses base-ui:** The shadcn registry for this project emits `@base-ui/react/input` wrappers (not Radix), consistent with all other primitives. Plan fallback (manual creation) was not needed.
- **shadcn label uses plain label:** Registry emitted a plain `<label>` function component — matches project conventions; no asChild.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unsupported third argument to wcagContrast**
- **Found during:** Task 2 (color.ts typecheck)
- **Issue:** Plan specified `_wcagContrast(a, b, "WCAG21")` but @types/culori 4.0.1 declares `wcagContrast(colorA, colorB): number` (2 args only). TypeScript error TS2554.
- **Fix:** Removed `"WCAG21"` third argument. Culori's wcagContrast uses WCAG 2.1 by default, so behavior is identical.
- **Files modified:** `frontend/src/lib/color.ts`
- **Verification:** `tsc --noEmit` passed after removal
- **Committed in:** `45445f8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Fix required for correctness; no behavior change (WCAG21 is culori's default). No scope creep.

## Issues Encountered

- `npm --prefix frontend exec -- shadcn@latest add input --yes` returned "command not found" — used `npx shadcn@latest add input --yes` from within `frontend/` directory instead (same result).

## Known Stubs

None — this plan installs infrastructure only; no UI rendering stubs introduced.

## Next Phase Readiness

- Plan 06-02 (hooks) is unblocked: `updateSettings`, `uploadLogo`, `hexToOklch`, `oklchToHex`, `wcagContrast` all available
- Plan 06-03 (sub-components) is unblocked: `Input`, `Label` primitives available; `color.ts` ready for ColorPicker integration
- Build passes clean — no regressions in existing Phase 5 code

---
*Phase: 06-settings-page-and-sub-components*
*Completed: 2026-04-11*

## Self-Check: PASSED

- FOUND: frontend/src/lib/color.ts
- FOUND: frontend/src/components/ui/input.tsx
- FOUND: frontend/src/components/ui/label.tsx
- FOUND: .planning/phases/06-settings-page-and-sub-components/06-01-SUMMARY.md
- FOUND: commit 62a74e0 (Task 1)
- FOUND: commit 45445f8 (Task 2)
- FOUND: commit d5e3b7c (Task 3)
