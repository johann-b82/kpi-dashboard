---
phase: 06-settings-page-and-sub-components
plan: "03"
subsystem: ui
tags: [react, shadcn, react-colorful, react-dropzone, wcag, i18n, typescript]

requires:
  - phase: 06-settings-page-and-sub-components
    plan: "01"
    provides: "react-colorful, culori, Input/Label primitives, color.ts, uploadLogo, wcagContrast"

provides:
  - ColorPicker component (label + swatch popover + hex input + optional badge slot)
  - ContrastBadge component (warn-only WCAG 2.1 badge, hides at >= 4.5 ratio)
  - LogoUpload component (dropzone + thumbnail + immediate POST + cache update)
  - 43 new settings.* locale keys in en.json matching UI-SPEC copywriting contract

affects:
  - 06-04-settings-page (SettingsPage composes all three components)

tech-stack:
  added: []
  patterns:
    - "PopoverTrigger with render prop (base-ui pattern, no asChild)"
    - "useMutation + setQueryData for immediate cache update on logo upload (D-13)"
    - "Flat dot-notation locale keys for settings.* namespace in en.json"

key-files:
  created:
    - frontend/src/components/settings/ColorPicker.tsx
    - frontend/src/components/settings/ContrastBadge.tsx
    - frontend/src/components/settings/LogoUpload.tsx
  modified:
    - frontend/src/locales/en.json (44 lines added — 43 new settings.* keys)

key-decisions:
  - "ContrastBadge copy hardcoded EN in Phase 6 (not localized via settings.contrast.badge) per plan instruction — Phase 7 will localize"
  - "LogoUpload uses setQueryData (not invalidateQueries) on upload success per D-13 (staleTime Infinity avoids redundant refetch)"
  - "en.json extended with 43 keys (2 existing stubs preserved) — de.json untouched"

requirements-completed: [BRAND-05, BRAND-08, SET-01]

duration: ~2min
completed: 2026-04-11
---

# Phase 06 Plan 03: Settings Sub-Components Summary

**ColorPicker (swatch + react-colorful popover + hex input), ContrastBadge (WCAG warn-only), LogoUpload (dropzone + immediate POST), and 43 EN locale keys — all three presentational components ready for SettingsPage composition in plan 04**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-11T16:21:28Z
- **Completed:** 2026-04-11T16:23:51Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `ColorPicker.tsx`: label + swatch button (PopoverTrigger with `render` prop) + `HexColorPicker` popover + hex `Input`; emits HEX only (D-03); optional `contrastBadge` ReactNode slot
- `ContrastBadge.tsx`: calls `wcagContrast(colorA, colorB)` from `lib/color.ts`; returns `null` when ratio ≥ 4.5; renders `<Badge variant="destructive">` with copy `"Contrast {n} : 1 — needs 4.5 : 1"` when below threshold (BRAND-08 warn-only)
- `LogoUpload.tsx`: `react-dropzone` with `image/png` + `image/svg+xml` accept, `maxSize: 1_048_576`; immediate `useMutation(uploadLogo)` on drop; `setQueryData(["settings"], response)` on success; `toast.error` for client-side rejections (file-too-large, file-invalid-type)
- `en.json`: 43 new `settings.*` keys covering all UI-SPEC copy; both old stub keys preserved; de.json untouched

## Task Commits

1. **Task 1: Create ColorPicker + ContrastBadge** — `a6b4c22` (feat)
2. **Task 2: Create LogoUpload** — `04d22ef` (feat)
3. **Task 3: Add EN locale keys** — `6ca351e` (feat)

## Export Signatures (for plan 04 SettingsPage implementer)

### frontend/src/components/settings/ColorPicker.tsx
```typescript
export interface ColorPickerProps {
  label: string;          // Visible label above the row (e.g. "Primary")
  value: string;          // Current HEX "#rrggbb" — NEVER oklch
  onChange: (hex: string) => void;  // Fires on swatch drag or text input
  contrastBadge?: ReactNode;         // Pass <ContrastBadge colorA=... colorB=... /> here
  id?: string;            // Optional; auto-generated from label if omitted
}
export function ColorPicker(props: ColorPickerProps): JSX.Element;
```

### frontend/src/components/settings/ContrastBadge.tsx
```typescript
export interface ContrastBadgeProps {
  colorA: string;  // Any CSS color string culori can parse (hex, oklch, named)
  colorB: string;
}
export function ContrastBadge(props: ContrastBadgeProps): JSX.Element | null;
// Returns null when wcagContrast(colorA, colorB) >= 4.5
// Returns destructive Badge with "Contrast {n} : 1 — needs 4.5 : 1" when < 4.5
```

### frontend/src/components/settings/LogoUpload.tsx
```typescript
interface LogoUploadProps {
  logoUrl: string | null;  // Current logo URL from settings cache
}
export function LogoUpload(props: LogoUploadProps): JSX.Element;
// Emits nothing — updates ["settings"] cache on successful upload
// No remove-logo capability (D-17)
```

### New locale keys added (en.json)

All keys are flat dot-notation under `settings.*`. Key highlights:
- `settings.identity.logo.dropzone_empty` — "Drop a PNG or SVG here, or click to browse"
- `settings.identity.logo.dropzone_replace` — "Replace logo"
- `settings.actions.save` — "Save changes"
- `settings.actions.color_picker_aria` — "Pick {{label}} color"
- `settings.actions.logo_dropzone_aria` — "Upload logo by dropping a file or pressing Enter to open file browser"
- `settings.toasts.logo_too_large` — "Logo is too large. Maximum size is 1 MB."
- `settings.toasts.logo_wrong_type` — "Only PNG and SVG files are allowed."
- `settings.reset_dialog.confirm` — "Reset"
- `settings.unsaved_dialog.confirm` — "Discard & leave"
- `settings.error.heading` — "Couldn't load settings"

Full list: 43 keys total. Both `settings.page_title_stub` and `settings.stub_body` preserved.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

- **ContrastBadge copy not localized:** Per plan instructions, the badge copy (`"Contrast {n} : 1 — needs 4.5 : 1"`) is hardcoded EN in Phase 6. The locale key `settings.contrast.badge` IS in en.json for Phase 7 to wire up, but ContrastBadge.tsx uses the interpolated string directly today. This is per plan spec ("Phase 7 will pipe it through i18next").
- **"Uploading…" text:** The pending-state label inside LogoUpload is a hardcoded EN literal per plan instruction — it is not in the UI-SPEC copy contract and does not need a locale key in Phase 6.
- **Build transient error:** During Task 1 verification, the first `npm run build` returned a TypeScript error from `useSettingsDraft.ts` (parallel 06-02 agent was mid-write). Immediate re-run succeeded. No intervention needed.

## de.json status

de.json was NOT touched. Confirmed via `git status` — file unmodified.

## Known Stubs

- **ContrastBadge copy:** Hardcoded EN string (not localized). Intentional per plan — Phase 7 will wire `t("settings.contrast.badge", { ratio })`.
- **"Uploading…" text in LogoUpload:** Hardcoded EN pending label. Phase 7 may add locale key.

These stubs do NOT prevent plan 03's goal — components are complete and plan 04 can compose them fully.

## Self-Check: PASSED

- FOUND: frontend/src/components/settings/ColorPicker.tsx
- FOUND: frontend/src/components/settings/ContrastBadge.tsx
- FOUND: frontend/src/components/settings/LogoUpload.tsx
- FOUND: commit a6b4c22 (Task 1)
- FOUND: commit 04d22ef (Task 2)
- FOUND: commit 6ca351e (Task 3)
- en.json: 45 settings.* keys (2 old stubs + 43 new), valid JSON
- Build: PASSED (tsc -b && vite build, exit 0)
