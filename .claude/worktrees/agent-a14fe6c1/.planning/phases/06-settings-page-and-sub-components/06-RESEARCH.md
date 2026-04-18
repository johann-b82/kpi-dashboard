# Phase 6: Settings Page and Sub-components - Research

**Researched:** 2026-04-11
**Domain:** React form state management, live preview, color pickers, WCAG contrast, unsaved-changes guards
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Color pickers (BRAND-05)**
- D-01: Use `react-colorful` (~2.8KB) + hex text input side-by-side. One `ColorPicker` sub-component reused 6 times, driven by `{ label, tokenKey, value, onChange }`.
- D-02: Add `culori` as a frontend dependency. Tree-shake `parse`, `formatCss`, `converter('oklch')`, `wcagContrast`.
- D-03: Picker emits HEX; page container is responsible for hex→oklch conversion before touching cache or PUT payload.

**Live preview mechanism**
- D-04: Live preview uses `queryClient.setQueryData(['settings'], draft)` on every draft change. ThemeProvider's existing `useEffect` reapplies automatically — no new writer code.
- D-05: Updates are NOT debounced. CSS `setProperty` is microsecond-cheap.
- D-06: Pre-edit snapshot captured on mount and after every successful Save/Reset. Used for dirty detection, Discard, and unsaved-guard comparison.
- D-07: Dirty detection — shallow-equal of 8 draft fields: `color_*` ×6, `app_name`, `default_language`. Logo excluded from dirty state (uploads immediately).

**Page layout**
- D-08: Single scrolling page with shadcn `Card` sections: (1) Identity, (2) Colors. No Tabs or Accordion.
- D-09: Sticky bottom action bar — `fixed bottom-0 inset-x-0 bg-card border-t`. Scroll container has enough `pb` padding. Left: "Unsaved changes" indicator (dirty only). Right: Discard (ghost, dirty only), Reset to defaults (ghost/outline, always), Save (primary, disabled when pristine).

**Save / Discard / Reset semantics**
- D-10: Save = `PUT /api/settings` with full draft (colors oklch-converted + `app_name` + `default_language`). On 2xx: `toast.success`, update snapshot, `queryClient.setQueryData`. On failure: `toast.error`, preserve draft.
- D-11: Discard = restore draft from snapshot + `queryClient.setQueryData(['settings'], snapshot)`. No server call, no toast.
- D-12: Reset to defaults = shadcn Dialog confirm → `PUT /api/settings` with `DEFAULT_SETTINGS` payload → on 2xx: refresh, update snapshot, `toast.success`.

**Logo upload UX (BRAND-01 UI)**
- D-13: Reuse `react-dropzone` (already in `components/DropZone.tsx`). `accept: { 'image/png': ['.png'], 'image/svg+xml': ['.svg'] }`, `maxSize: 1_048_576`, `maxFiles: 1`.
- D-14: Immediate POST on file drop to `POST /api/settings/logo`. On success: invalidate or update settings query.
- D-15: Current logo thumbnail (max 120×120, object-contain) next to dropzone. Dropzone label: "Replace logo" if logo exists, "Upload logo" if null.
- D-16: react-dropzone client-side rejections fire `toast.error`. Backend 422 responses caught from fetch and surfaced via `toast.error(err.detail)`.
- D-17: No "remove logo" button. Users clear logo via Reset to defaults.

**Unsaved-changes guard (UX-01)**
- D-18: Custom `useUnsavedGuard(isDirty)` hook. (1) In-app nav intercept via document-level capture-phase click listener. (2) `window.addEventListener('beforeunload', ...)` while dirty. (3) Cleanup on unmount.
- D-19: Dialog actions — "Discard & leave" (reverts draft then navigates), "Stay" (cancels). No "Save & leave".
- D-20: Guard only triggers when leaving `/settings`. Intra-page interactions do not trigger.

**WCAG contrast badges (BRAND-08)**
- D-21: Inline badges under affected pickers. Three pairs: primary/primary-foreground, background/foreground (both), destructive/white. Appears only when contrast < 4.5:1. Warn-only, never blocks Save.
- D-22: Derived token lookup via `getComputedStyle(document.documentElement).getPropertyValue('--primary-foreground')`. Destructive/white pair uses literal `oklch(1 0 0)`.
- D-23: Contrast via `culori.wcagContrast(a, b)`. Display: "Contrast {value} : 1 — needs 4.5 : 1". Badge: `<Badge variant="destructive">`.

### Claude's Discretion
- Exact styling of the sticky bottom bar (shadow, blur, border treatment)
- Whether Identity card renders app name above or beside the logo section
- Whether color pickers share a single Popover or each has its own (UI-SPEC specifies one per picker)
- Exact copy strings (EN-only stubs; Phase 7 translates DE)
- Component file split: `SettingsPage.tsx` may decompose into `components/settings/ColorPicker.tsx`, `LogoUpload.tsx`, `ActionBar.tsx`, `ResetDialog.tsx`, `useUnsavedGuard.ts`, `useSettingsDraft.ts`
- Whether `useSettingsDraft` returns a single hook or multiple smaller hooks
- Test strategy: vitest + @testing-library/react; MSW or fetch mocks matching Phase 3/5 conventions
- Whether locale files get new `settings.*` keys in Phase 6 or deferred to Phase 7 — recommend adding EN-only stubs now, DE in Phase 7

### Deferred Ideas (OUT OF SCOPE)
- Language select UI (I18N-01) — Phase 7
- `i18n.changeLanguage` wiring on Save (I18N-02) — Phase 7
- DE translations for Settings page copy — Phase 7
- Dedicated DELETE /api/settings/logo endpoint — Phase 4 deferred; Reset covers it
- "Save & leave" option on unsaved-guard dialog
- Color preset swatches / palette library — v1.2+
- Dark mode toggle — v1.2+
- Per-section save buttons
- Optimistic concurrency on Save
- Auto-derived foreground colors
- Field-level validation errors inline
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | User can navigate to a dedicated Settings page via a top-nav link | Route and stub already exist from Phase 5; this phase replaces the stub body |
| BRAND-05 | User can edit 6 semantic color tokens via hex inputs; values converted to oklch | react-colorful + culori pattern documented in §Color Picker section |
| BRAND-07 | Theme changes reflect instantly as live preview via CSS variable injection; changes only persist after Save | `queryClient.setQueryData(['settings'], draft)` triggers ThemeProvider.applyTheme automatically; one writer invariant holds |
| BRAND-08 | Color inputs show WCAG AA contrast badge (warn, do not block) for 3 critical pairs | `culori.wcagContrast()` + 4.5:1 threshold; Badge variant="destructive" pattern |
| UX-01 | Navigating away with unsaved changes shows confirmation dialog; `beforeunload` handler covers tab close | wouter `aroundNav` or document-level capture-phase click listener; `beforeunload` event |
| UX-02 | Save shows success or error toast; failed saves preserve draft state | sonner `toast.success` / `toast.error` patterns already in codebase |
</phase_requirements>

---

## Summary

Phase 5 delivered all the plumbing this phase needs: `ThemeProvider` (the single CSS-var writer), `useSettings()` hook, `Settings` type, `DEFAULT_SETTINGS` + `THEME_TOKEN_MAP`, the `/settings` route registered in `App.tsx`, and the `SettingsPage.tsx` stub. Phase 6's entire job is to replace that stub with a real form page that sits on top of the existing infrastructure — no new routes, no new provider, no backend changes.

The live-preview mechanism is already wired: any call to `queryClient.setQueryData(['settings'], nextDraft)` causes ThemeProvider's `useEffect` to fire `applyTheme(nextDraft)`, which writes 6 CSS vars and updates `document.title`. Phase 6 simply mutates the cache on every draft field change. The pattern is confirmed by reading `ThemeProvider.tsx` — `applyTheme` iterates `THEME_TOKEN_MAP` and calls `root.style.setProperty` for each token. No additional "preview writer" is needed.

The two new frontend dependencies (`react-colorful` 5.6.1, `culori` 4.0.2) are small, well-maintained, and confirmed on npm. `react-colorful` is dependency-free and mobile-friendly. `culori` ships TypeScript types via `@types/culori` (the package itself does not bundle types — `@types/culori` 4.0.1 is the required companion). Neither is a shadcn registry block; both install as ordinary npm packages. `input` and `label` shadcn primitives are not yet installed and must be added via `npx shadcn add input` and `npx shadcn add label`. `input` and `label` are needed for the app name field and the 6 hex text inputs inside each ColorPicker.

**Primary recommendation:** Build the `useSettingsDraft` hook first (manages snapshot + draft state + dirty detection + save/discard/reset mutations) because all sub-components depend on the shape it exports. Then build sub-components (`ColorPicker`, `LogoUpload`, `ActionBar`, `ResetDialog`, `UnsavedChangesDialog`) in isolation, and assemble them in the full `SettingsPage` last. `useUnsavedGuard` is standalone and can be built in parallel with sub-components.

---

## What Already Exists (Phase 5 Inventory)

This is the most important section — Phase 6 builds ON these, does not duplicate them.

| Asset | Location | Phase 6 Use |
|-------|----------|-------------|
| `Settings` type | `frontend/src/lib/api.ts:94-105` | Already defines all 10 fields; add `updateSettings()` and `uploadLogo()` fetchers to same file |
| `fetchSettings()` | `frontend/src/lib/api.ts:107-111` | Read path; no changes needed |
| `useSettings()` hook | `frontend/src/hooks/useSettings.ts` | Read path for initial data; `useQueryClient()` provides write path |
| `DEFAULT_SETTINGS` | `frontend/src/lib/defaults.ts` | Reset payload source; already mirrors backend `defaults.py` |
| `THEME_TOKEN_MAP` | `frontend/src/lib/defaults.ts` | Used to iterate 6 pickers; already maps `color_*` → `--css-var` |
| `ThemeProvider` + `applyTheme` | `frontend/src/components/ThemeProvider.tsx` | Do NOT modify; `applyTheme` fires automatically on cache change |
| `/settings` route | `frontend/src/App.tsx:Route` | Already registered; Phase 6 replaces `SettingsPage.tsx` body only |
| `SettingsPage.tsx` stub | `frontend/src/pages/SettingsPage.tsx` | Current 16-line stub; fully replaced |
| `sonner` Toaster | `frontend/src/App.tsx:Toaster` | Globally mounted; `import { toast } from "sonner"` pattern ready |
| `react-dropzone` | `frontend/package.json` | Already installed; `DropZone.tsx` is the reference implementation |
| shadcn `Card`, `Button`, `Dialog`, `Popover`, `Badge`, `Separator` | `frontend/src/components/ui/` | All installed; `dialog.tsx` + `popover.tsx` use `@base-ui/react` pattern |
| `lucide-react` icons | `frontend/package.json` | Already installed; use `Upload`, `RotateCcw`, `Undo2`, `Check`, `AlertTriangle`, `X` |
| `en.json` locale keys | `frontend/src/locales/en.json` | Has `settings.page_title_stub` and `settings.stub_body`; Phase 6 adds new `settings.*` keys |
| wouter routing | `frontend/src/App.tsx` + `NavBar.tsx` | No new routes needed; unsaved-guard uses `useLocation()` setter + `aroundNav` |

**shadcn primitives NOT yet installed (required this phase):**
- `input` — install via `npx shadcn add input`
- `label` — install via `npx shadcn add label`

---

## Standard Stack

### Core (already installed)
| Library | Version (installed) | Purpose | Notes |
|---------|---------------------|---------|-------|
| React | 19.2.4 | UI framework | Via `package.json` |
| TanStack Query | 5.97.0 | Server state — `queryClient.setQueryData` for live preview | staleTime: Infinity per D-13 |
| wouter | 3.9.0 | Client routing + `useLocation` for nav intercept | `aroundNav` prop on `<Router>` for nav blocking |
| sonner | 2.0.7 | Toast notifications | Globally mounted in App.tsx |
| react-dropzone | 15.0.0 | Logo file input | Already used in DropZone.tsx |
| shadcn/ui (base-ui backed) | 4.2.0 | UI primitives | Use `render` prop, NOT `asChild` |
| Tailwind CSS v4 | 4.2.2 | Styling | CSS-first config; no `tailwind.config.js` |
| lucide-react | 1.8.0 | Icons | Already available |

### New dependencies (must install)
| Library | Version (npm current) | Purpose | Why |
|---------|----------------------|---------|-----|
| `react-colorful` | 5.6.1 | Visual hex color picker | Locked decision D-01; ~2.8KB gzip, dependency-free, mobile-friendly, accessible |
| `culori` | 4.0.2 | hex↔oklch conversion + wcagContrast | Locked decision D-02; tree-shakeable |
| `@types/culori` | 4.0.1 | TypeScript types for culori | culori does NOT ship its own types; this package is REQUIRED |

**Installation:**
```bash
cd frontend
npm install react-colorful culori
npm install --save-dev @types/culori
npx shadcn add input
npx shadcn add label
```

### Version verification
Verified against npm registry on 2026-04-11:
- `react-colorful`: latest is **5.6.1** (confirmed)
- `culori`: latest is **4.0.2** (confirmed)
- `@types/culori`: latest is **4.0.1** (confirmed — separate package, not bundled)

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
frontend/src/
├── components/
│   └── settings/
│       ├── ColorPicker.tsx        # Single picker: label + hex input + react-colorful popover + contrast badge slot
│       ├── LogoUpload.tsx         # Dropzone + thumbnail; wraps react-dropzone; immediate POST behavior
│       ├── ActionBar.tsx          # Sticky bottom bar: dirty indicator + Discard + Reset + Save
│       ├── ResetDialog.tsx        # shadcn Dialog: confirm Reset to defaults flow
│       └── UnsavedChangesDialog.tsx  # shadcn Dialog: driven by useUnsavedGuard
├── hooks/
│   ├── useSettingsDraft.ts        # Snapshot + draft + isDirty + save + discard + resetToDefaults
│   └── useUnsavedGuard.ts         # beforeunload + in-app nav intercept
├── lib/
│   └── color.ts                   # hex↔oklch via culori + wcagContrast helper
└── pages/
    └── SettingsPage.tsx           # Fully replaces Phase 5 stub; assembles all sub-components
```

**Existing files modified (extend, not replace):**
- `frontend/src/lib/api.ts` — add `SettingsUpdatePayload`, `updateSettings()`, `uploadLogo()`
- `frontend/src/locales/en.json` — add `settings.*` keys (EN stubs; DE in Phase 7)

### Pattern 1: useSettingsDraft Hook

The central state manager. Returns everything SettingsPage and ActionBar need.

```typescript
// Source: derived from D-06, D-07, D-10, D-11, D-12 in CONTEXT.md
// frontend/src/hooks/useSettingsDraft.ts

type DraftFields = Pick<Settings,
  'color_primary' | 'color_accent' | 'color_background' |
  'color_foreground' | 'color_muted' | 'color_destructive' |
  'app_name' | 'default_language'
>;

function useSettingsDraft() {
  const queryClient = useQueryClient();
  const { data } = useSettings();                      // read path
  const [snapshot, setSnapshot] = useState<DraftFields | null>(null);
  const [draft, setDraft] = useState<DraftFields | null>(null);

  // Capture snapshot on first load (D-06)
  useEffect(() => {
    if (data && snapshot === null) {
      const s = pick8Fields(data);
      setSnapshot(s);
      setDraft(s);
    }
  }, [data]);

  const isDirty = useMemo(() =>
    snapshot !== null && draft !== null && !shallowEqual8(draft, snapshot),
    [draft, snapshot]
  );

  const setField = useCallback((field: keyof DraftFields, value: string) => {
    setDraft(prev => {
      const next = { ...prev!, [field]: value };
      // Live preview: push draft into cache so ThemeProvider reapplies (D-04)
      queryClient.setQueryData(['settings'], (old: Settings) => ({ ...old, ...next }));
      return next;
    });
  }, [queryClient]);

  // save, discard, resetToDefaults mutations omitted for brevity
  return { draft, setField, isDirty, snapshot, save, discard, resetToDefaults };
}
```

### Pattern 2: ColorPicker Component

Emits HEX only; container converts to oklch (D-03).

```typescript
// frontend/src/components/settings/ColorPicker.tsx
// Uses react-colorful's HexColorPicker

import { HexColorPicker } from "react-colorful";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  label: string;
  value: string;          // hex: "#rrggbb"
  onChange: (hex: string) => void;
  contrastBadge?: React.ReactNode;   // Contrast badge slot (null when passing)
}

function ColorPicker({ label, value, onChange, contrastBadge }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild={false} render={
            <button
              className="w-8 h-8 rounded border border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              style={{ backgroundColor: value }}
              aria-label={`Pick ${label} color`}
            />
          } />
          <PopoverContent className="w-auto p-3">
            <HexColorPicker color={value} onChange={onChange} />
          </PopoverContent>
        </Popover>
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#0066FF"
          className="w-28 font-mono text-sm"
        />
      </div>
      {contrastBadge}
    </div>
  );
}
```

**Important:** shadcn's Popover wraps `@base-ui/react/popover`. Use `render` prop pattern, NOT `asChild` — confirmed in `components/ui/popover.tsx` and CLAUDE.md conventions.

### Pattern 3: hex↔oklch via culori

```typescript
// frontend/src/lib/color.ts
// Source: culori docs + CONTEXT.md D-02, D-03

import { parse, formatCss, converter, wcagContrast as _wcagContrast } from "culori";

const toOklch = converter("oklch");

export function hexToOklch(hex: string): string {
  const color = parse(hex);
  if (!color) throw new Error(`Invalid hex: ${hex}`);
  return formatCss(toOklch(color));
}

export function oklchToHex(oklch: string): string {
  const color = parse(oklch);
  if (!color) return "#000000";
  // culori formats to hex via the rgb converter internally
  const rgb = converter("rgb")(color);
  if (!rgb) return "#000000";
  // formatHex is available in culori
  return formatCss({ ...rgb, mode: "rgb" });
}

export function wcagContrast(colorA: string, colorB: string): number {
  const a = parse(colorA);
  const b = parse(colorB);
  if (!a || !b) return 0;
  return _wcagContrast(a, b);
}
```

**Note:** The backend's `_OKLCH_RE` regex accepts `oklch(L C H)` with specific L/C/H ranges. `culori`'s `formatCss` emits `oklch(L C H)` format (no slash for alpha), which matches the backend validator. Do NOT emit hex to the PUT endpoint — backend rejects non-oklch.

### Pattern 4: Unsaved-changes Guard (wouter)

wouter 3.9.0 does NOT have a React Router-style `useBlocker` hook. The `aroundNav` prop on `<Router>` intercepts all programmatic navigations, but does not catch direct `<a>` tag clicks. The CONTEXT.md D-18 approach uses a **document-level capture-phase click listener** to catch NavBar Link clicks.

```typescript
// frontend/src/hooks/useUnsavedGuard.ts
// Source: wouter docs §aroundNav + CONTEXT.md D-18

export function useUnsavedGuard(isDirty: boolean, onShowDialog: (to: string) => void) {
  useEffect(() => {
    if (!isDirty) return;

    // Tab close (D-18 responsibility 2)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // In-app nav intercept (D-18 responsibility 1)
    // Capture phase catches clicks before wouter Link's handler
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest("a[href]");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href === "/settings" || href.startsWith("#")) return;
      // Currently on /settings with dirty state — intercept
      if (window.location.pathname !== "/settings") return;
      e.preventDefault();
      e.stopPropagation();
      onShowDialog(href);
    };
    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [isDirty, onShowDialog]);
}
```

**Critical limitation:** wouter's `useLocation` setter fires popstate but does NOT expose a blocking API. The document capture listener correctly handles NavBar `<Link>` (which renders as `<a>`) clicks. Browser back/forward (popstate) requires a separate `popstate` listener — include this in the hook.

```typescript
// Additional popstate listener (browser back/forward)
const handlePopState = (e: PopStateEvent) => {
  if (isDirty && window.location.pathname !== "/settings") {
    // push state back to /settings
    window.history.pushState(null, "", "/settings");
    onShowDialog("__back__"); // sentinel for back navigation
  }
};
window.addEventListener("popstate", handlePopState);
```

### Pattern 5: WCAG Contrast Badge

```typescript
// Inline in ColorPicker or as a small ContrastBadge component
// Source: CONTEXT.md D-21, D-22, D-23

function ContrastBadge({ colorA, colorB }: { colorA: string; colorB: string }) {
  const ratio = wcagContrast(colorA, colorB);
  if (ratio >= 4.5) return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      Contrast {ratio.toFixed(1)} : 1 — needs 4.5 : 1
    </Badge>
  );
}
```

For the `primary/primary-foreground` pair, `colorB` is read at render time:
```typescript
const primaryFg = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-foreground").trim();
```
This reflects the live CSS var after `applyTheme` fires (since ThemeProvider already updated `:root` inline styles from the draft).

### Pattern 6: Logo Upload (api.ts extension)

```typescript
// Add to frontend/src/lib/api.ts

export interface SettingsUpdatePayload {
  color_primary: string;   // oklch
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  default_language: "DE" | "EN";
}

export async function updateSettings(payload: SettingsUpdatePayload): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to save settings");
  }
  return res.json();
}

export async function uploadLogo(file: File): Promise<Settings> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/settings/logo", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to upload logo");
  }
  return res.json();
}
```

### Anti-Patterns to Avoid

- **Do NOT write CSS vars directly in SettingsPage** — ThemeProvider is the SINGLE owner of `document.documentElement.style.setProperty`. Use `queryClient.setQueryData` to trigger the existing writer.
- **Do NOT debounce draft updates** — D-05 explicitly prohibits this; instant preview is required.
- **Do NOT use `asChild` on shadcn/base-ui components** — use the `render` prop pattern as seen in existing `popover.tsx`.
- **Do NOT send hex colors to PUT /api/settings** — backend validator accepts only `oklch(L C H)`. Convert ALL 6 colors before the PUT call.
- **Do NOT check for empty string as "no logo" sentinel** — check `logo_url !== null` (from Phase 5 D-16; confirmed in NavBar.tsx).
- **Do NOT use `useMutation` for live preview** — live preview is a local cache mutation, not a server call.
- **Do NOT import from `wouter` with `useBlocker`** — wouter 3.9.0 has no blocker hook; use the document capture listener pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color saturation/hue picker UI | Custom canvas/SVG color wheel | `react-colorful` (`HexColorPicker`) | Handles touch, keyboard, accessibility, and pointer events correctly |
| hex↔oklch conversion math | Custom color space math | `culori` (`converter('oklch')`, `parse`, `formatCss`) | Color space math has subtle edge cases at gamut boundaries; culori handles them |
| WCAG relative luminance | Inline `(0.2126r + 0.7152g + 0.0722b)` formula | `culori.wcagContrast()` | culori normalizes gamma correctly for both sRGB and oklch inputs |
| Hex validation | Custom regex | `culori.parse()` returns null on invalid | Built-in rejection is cleaner |
| Drag-and-drop file input | Native `<input type="file">` with manual DnD | `react-dropzone` (already installed) | Handles MIME type checking, size rejection, multi-browser drag quirks, accessibility |
| Confirm dialogs | `window.confirm()` | shadcn `Dialog` (already installed) | Native dialogs can't be styled; Dialog is already in the codebase |
| Toast notifications | Custom toast state | `sonner` `toast.success` / `toast.error` | Already globally mounted in App.tsx; consistent with Phase 2/3 patterns |

---

## API Contract (Phase 4 — Final, No Changes)

The backend is complete. Phase 6 is frontend-only. Key facts:

| Endpoint | Method | Phase 6 Use | Notes |
|----------|--------|-------------|-------|
| `GET /api/settings` | GET | `useSettings()` — already wired | Returns `SettingsRead` (10 fields including `logo_url`, `logo_updated_at`) |
| `PUT /api/settings` | PUT | Save + Reset to defaults | Body: `SettingsUpdatePayload` (8 fields, colors must be `oklch(L C H)`) |
| `POST /api/settings/logo` | POST | Logo upload | Multipart form; returns `SettingsRead` with new `logo_url` |
| `GET /api/settings/logo` | GET | Logo display (NavBar already uses URL) | Raw bytes; supports ETag / 304 |

**Critical:** `PUT /api/settings` does NOT accept logo bytes (D-05). Logo has its own `POST /api/settings/logo`.

**Reset to defaults** works by sending `DEFAULT_SETTINGS` verbatim to `PUT /api/settings`. The backend's D-07 logic detects exact match and sets `logo_data = logo_mime = logo_updated_at = None`. The frontend's `DEFAULT_SETTINGS` in `defaults.ts` must match the backend's `DEFAULT_SETTINGS` in `defaults.py` exactly — they were manually synchronized in Phase 5 (D-16) and remain in sync.

**Backend color format:** `oklch(0.55 0.15 250)` — three numbers, space-separated. culori's `formatCss` emits this exact format. Validated with backend `_OKLCH_RE` regex.

**Logo URL format:** `/api/settings/logo?v={epoch_seconds}`. The `?v=` param provides cache-busting. Frontend simply uses the `logo_url` field value as-is — never constructs this URL.

**Error shape on 422:** `{ detail: string }` — parse with `await res.json()` and use `err.detail` as the toast message.

---

## Common Pitfalls

### Pitfall 1: Sending Hex to PUT /api/settings
**What goes wrong:** Backend returns 422 ("color must be a valid oklch(L C H) string").
**Why it happens:** ColorPicker emits HEX (D-03). If conversion is missed, hex reaches the PUT body.
**How to avoid:** All hex→oklch conversion happens in the `save()` function inside `useSettingsDraft`, never in the picker itself. Keep a centralized conversion step.
**Warning signs:** 422 on Save with "color must be a valid oklch" in the toast.

### Pitfall 2: ThemeProvider Double-Write
**What goes wrong:** Phase 6 component calls `document.documentElement.style.setProperty()` directly, AND ThemeProvider also fires — either both apply (harmless but confusing) or they race.
**Why it happens:** Developer tries to "help" the preview by writing CSS vars directly.
**How to avoid:** ONLY use `queryClient.setQueryData(['settings'], draft)`. ThemeProvider subscribes to the `['settings']` cache and applies all 6 vars atomically in one `useEffect`.
**Warning signs:** CSS vars being applied twice, or `applyTheme` running when it shouldn't.

### Pitfall 3: Wouter Navigation Not Intercepted
**What goes wrong:** User clicks NavBar link while dirty, no guard dialog appears.
**Why it happens:** wouter 3.9.0 has no `useBlocker`. The `aroundNav` prop only intercepts calls to the navigate function — it does NOT intercept direct `<a href>` clicks that wouter renders via `<Link>`.
**How to avoid:** Use the document-level capture-phase click listener in `useUnsavedGuard`. Capture phase fires before wouter's `<a>` click handler, allowing `e.preventDefault()` to stop the navigation.
**Warning signs:** Direct link clicks bypass the dialog; programmatic `navigate()` calls work but clicks don't.

### Pitfall 4: Popover Rendering with asChild
**What goes wrong:** `PopoverTrigger` doesn't render the custom swatch button, or renders an extra wrapper.
**Why it happens:** shadcn's `@base-ui/react` wrapper uses the `render` prop, not `asChild`. Using `asChild` causes TypeScript errors or no-op behavior.
**How to avoid:** Use `render={<button .../>}` prop on `PopoverTrigger` (confirmed by inspecting `components/ui/popover.tsx` which uses `@base-ui/react/popover`).

### Pitfall 5: culori types missing
**What goes wrong:** TypeScript errors on `import { parse, formatCss, converter, wcagContrast } from "culori"`.
**Why it happens:** `culori` 4.x does NOT bundle its own TypeScript types. The package ships as pure JS.
**How to avoid:** Install `@types/culori` as a dev dependency alongside `culori`. Confirmed: `@types/culori@4.0.1` is the companion.

### Pitfall 6: Snapshot Not Refreshed After Save
**What goes wrong:** After a successful Save, the "Unsaved changes" indicator stays visible; Discard reverts to old pre-save state.
**Why it happens:** Snapshot is captured on mount but not updated after Save success.
**How to avoid:** In D-10, after 2xx: explicitly set snapshot to the response body. The `save()` mutation in `useSettingsDraft` must call `setSnapshot(responseData)` after `queryClient.setQueryData(['settings'], responseData)`.

### Pitfall 7: oklchToHex for Initial Picker Value
**What goes wrong:** ColorPicker receives `"oklch(0.55 0.15 250)"` from the server, but `HexColorPicker` requires a hex string like `"#4466cc"`. Picker shows black or crashes.
**Why it happens:** Forgetting to convert oklch→hex when loading initial values into picker state.
**How to avoid:** In `useSettingsDraft`, when loading draft from `data` (the server response), convert each `color_*` oklch value to hex before storing in the draft. The draft stores HEX; `save()` converts back to oklch. `lib/color.ts` provides both conversion functions.

### Pitfall 8: Badge variant="destructive" styling
**What goes wrong:** Badge renders with soft background but CONTEXT.md D-23 implies a clear warning.
**Why it happens:** The installed `badge.tsx` has `variant="destructive"` as `bg-destructive/10 text-destructive` (confirmed by reading badge.tsx) — this IS the correct variant. Do not create a custom badge.
**Warning signs:** Thinking the badge is "too subtle" — it correctly uses the destructive token colors with 10% opacity background, which follows the design system.

---

## Dialog API Specifics (base-ui via shadcn)

The installed `dialog.tsx` wraps `@base-ui/react/dialog`. Key API points confirmed by reading the file:

- `Dialog` = `DialogPrimitive.Root` — use `open` + `onOpenChange` props for controlled state
- `DialogContent` renders backdrop + popup together; `showCloseButton={true}` by default (X button included)
- Focus is trapped automatically (base-ui default) — do not add manual focus traps
- Open/close animations use `data-open` / `data-closed` attributes with Tailwind v4 `data-open:animate-in` utilities (built-in)
- Use `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` for correct slot layout

```typescript
// Controlled dialog pattern (for ResetDialog, UnsavedChangesDialog)
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent showCloseButton={false}>  {/* custom action buttons = no X */}
    <DialogHeader>
      <DialogTitle>Reset to default branding?</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleConfirm}>Reset</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Locale Keys to Add (EN-only, Phase 6)

Add to `frontend/src/locales/en.json`. Phase 7 adds DE translations. Do not add to `de.json` in Phase 6.

Key prefix: `settings.*`

Based on the UI-SPEC copywriting contract:
```json
{
  "settings.page_title": "Settings",
  "settings.page_subtitle": "Customize your app's branding",
  "settings.identity.title": "Identity",
  "settings.identity.app_name.label": "App name",
  "settings.identity.app_name.placeholder": "KPI Light",
  "settings.identity.app_name.help": "Shown in the top navigation and browser tab.",
  "settings.identity.logo.label": "Logo",
  "settings.identity.logo.dropzone_empty": "Drop a PNG or SVG here, or click to browse",
  "settings.identity.logo.dropzone_replace": "Replace logo",
  "settings.identity.logo.help": "PNG or SVG, up to 1 MB. Displayed at 60 × 60 px.",
  "settings.colors.title": "Colors",
  "settings.colors.primary": "Primary",
  "settings.colors.accent": "Accent",
  "settings.colors.background": "Background",
  "settings.colors.foreground": "Foreground",
  "settings.colors.muted": "Muted",
  "settings.colors.destructive": "Destructive",
  "settings.colors.hex_placeholder": "#0066FF",
  "settings.actions.unsaved": "Unsaved changes",
  "settings.actions.discard": "Discard",
  "settings.actions.reset": "Reset to defaults",
  "settings.actions.save": "Save changes",
  "settings.actions.color_picker_aria": "Pick {{label}} color",
  "settings.actions.logo_dropzone_aria": "Upload logo by dropping a file or pressing Enter to open file browser",
  "settings.toasts.saved": "Settings saved",
  "settings.toasts.save_error": "Couldn't save settings: {{detail}}",
  "settings.toasts.logo_updated": "Logo updated",
  "settings.toasts.logo_too_large": "Logo is too large. Maximum size is 1 MB.",
  "settings.toasts.logo_wrong_type": "Only PNG and SVG files are allowed.",
  "settings.toasts.logo_error": "Couldn't upload logo: {{detail}}",
  "settings.toasts.reset_success": "Reset to default branding",
  "settings.toasts.reset_error": "Couldn't reset settings: {{detail}}",
  "settings.reset_dialog.title": "Reset to default branding?",
  "settings.reset_dialog.body": "This restores the original colors and app name, and removes your uploaded logo. This cannot be undone.",
  "settings.reset_dialog.cancel": "Cancel",
  "settings.reset_dialog.confirm": "Reset",
  "settings.unsaved_dialog.title": "Discard unsaved changes?",
  "settings.unsaved_dialog.body": "You have unsaved branding changes. Leaving this page will lose them.",
  "settings.unsaved_dialog.cancel": "Stay",
  "settings.unsaved_dialog.confirm": "Discard & leave",
  "settings.contrast.badge": "Contrast {{ratio}} : 1 — needs 4.5 : 1",
  "settings.error.heading": "Couldn't load settings",
  "settings.error.body": "Check your connection and refresh the page."
}
```

Note: The existing `settings.page_title_stub` and `settings.stub_body` keys can be left in place or removed — they are currently referenced in the stub `SettingsPage.tsx` which gets replaced.

---

## State of the Art

| Topic | Old Pattern | Current Pattern | Impact |
|-------|-------------|-----------------|--------|
| React Router nav blocking | `useNavigate` + `useBlocker` hook | Wouter has no `useBlocker`; use document capture listener + popstate | Must implement manually |
| Color space for web theming | HSL | oklch (perceptually uniform) | Already established in this project; CSS vars use oklch |
| Tailwind config | `tailwind.config.js` | CSS-first in `index.css` via `@theme` block (v4) | No `tailwind.config.js` file; all customization in CSS |
| shadcn headless primitives | `@radix-ui` + `asChild` | `@base-ui/react` + `render` prop | Breaking change — `asChild` not available |
| WCAG contrast calculation | Custom luminance formula | `culori.wcagContrast()` | Handles oklch and sRGB inputs correctly |
| Toast | custom `useToast` hook | `sonner` — globally mounted | Simpler API: `toast.success()` / `toast.error()` |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Yes | 25.9.0 | — |
| npm | package install | Yes | 11.12.1 | — |
| Docker | Container builds | Yes | 29.3.1 | — |
| `react-colorful` | ColorPicker component | Not yet (to install) | 5.6.1 on npm | — |
| `culori` | hex↔oklch + wcagContrast | Not yet (to install) | 4.0.2 on npm | — |
| `@types/culori` | TypeScript types for culori | Not yet (to install) | 4.0.1 on npm | — |
| shadcn `input` primitive | App name + hex inputs | Not installed | Available via `npx shadcn add input` | — |
| shadcn `label` primitive | Form field labels | Not installed | Available via `npx shadcn add label` | — |
| Backend `PUT /api/settings` | Save + Reset | Yes (Phase 4 complete) | — | — |
| Backend `POST /api/settings/logo` | Logo upload | Yes (Phase 4 complete) | — | — |

**Missing dependencies with no fallback (must install in Wave 0):**
- `react-colorful` — no alternative; locked in D-01
- `culori` + `@types/culori` — no alternative; locked in D-02
- `shadcn input` + `shadcn label` — no alternative for form fields

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/ThemeProvider.tsx` — confirmed single-writer pattern, `applyTheme` iterates `THEME_TOKEN_MAP`
- `frontend/src/lib/api.ts` — confirmed `Settings` type (10 fields), `fetchSettings`, error shape
- `frontend/src/lib/defaults.ts` — confirmed `DEFAULT_SETTINGS` + `THEME_TOKEN_MAP` shapes
- `frontend/src/components/ui/dialog.tsx` — confirmed base-ui Dialog API, controlled pattern
- `frontend/src/components/ui/popover.tsx` — confirmed `render` prop pattern, base-ui Popover
- `frontend/src/components/ui/badge.tsx` — confirmed `variant="destructive"` styling
- `frontend/src/components/DropZone.tsx` — confirmed react-dropzone pattern + rejection handling
- `frontend/node_modules/wouter/README.md` — confirmed no `useBlocker`, `aroundNav` prop, `useLocation` API
- `backend/app/routers/settings.py` — confirmed API contract, reset logic, logo endpoints
- `backend/app/schemas.py` — confirmed `_OKLCH_RE` regex, `SettingsUpdate`, `SettingsRead`
- `frontend/package.json` — confirmed installed deps, absent `input`/`label`, absent `react-colorful`/`culori`

### Secondary (MEDIUM confidence)
- npm registry: `react-colorful@5.6.1` (verified current), `culori@4.0.2` (verified current), `@types/culori@4.0.1` (verified — separate DefinitelyTyped package)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified against package.json, npm registry, existing source files
- Architecture: HIGH — all patterns derived directly from CONTEXT.md decisions + existing code
- API contract: HIGH — read directly from backend source (routers/settings.py, schemas.py)
- Pitfalls: HIGH — sourced from reading actual source files (ThemeProvider, popover.tsx, wouter README)
- Wouter unsaved guard: MEDIUM — confirmed no blocker hook; document-listener pattern is standard workaround

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable libraries; Tailwind v4 and base-ui are moving fast but the installed versions are pinned)

**nyquist_validation:** Disabled in `.planning/config.json` — Validation Architecture section omitted.
