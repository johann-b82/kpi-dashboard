---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 03
type: execute
wave: 2
depends_on: [56-01, 56-02]
files_modified:
  - frontend/src/components/NavBar.tsx
  - frontend/src/components/SubHeader.tsx
autonomous: false
requirements: [HDR-01, HDR-04]
must_haves:
  truths:
    - "Top header contains only: brand link, Breadcrumb, ThemeToggle, LanguageToggle, UserMenu (HDR-01)"
    - "No Sales/HR Toggle in top header (moved to SubHeader)"
    - "No Upload icon in top header (moved to SubHeader)"
    - "No Settings gear, Docs shortcut, or Sign-out button in top header (consolidated into UserMenu)"
    - "No back-to-dashboard button in top header (removed per D-10)"
    - "No lastDashboard sessionStorage read/write anywhere in frontend/src (D-10 + Pitfall 5)"
    - "SubHeader renders Sales/HR Toggle in left slot when location is /sales or /hr (D-07)"
    - "SubHeader renders Upload icon in right slot when location is /sales or /hr, wrapped in AdminOnly (D-08)"
    - "SubHeader height stays h-12 and total chrome stays pt-28 (UI-SPEC chrome contract)"
  artifacts:
    - path: "frontend/src/components/NavBar.tsx"
      provides: "Simplified top header — brand + Breadcrumb + ThemeToggle + LanguageToggle + UserMenu"
    - path: "frontend/src/components/SubHeader.tsx"
      provides: "SubHeader with Sales/HR Toggle + Upload link on /sales and /hr"
  key_links:
    - from: "NavBar.tsx"
      to: "Breadcrumb"
      via: "<Breadcrumb /> rendered between brand and right-cluster"
      pattern: "<Breadcrumb"
    - from: "NavBar.tsx"
      to: "UserMenu"
      via: "<UserMenu /> rendered in right cluster"
      pattern: "<UserMenu"
    - from: "SubHeader.tsx"
      to: "ui/toggle (Phase 54)"
      via: "<Toggle segments=... /> mounted on /sales and /hr"
      pattern: "<Toggle"
    - from: "SubHeader.tsx"
      to: "AdminOnly wrapping Upload <Link>"
      via: "upload admin gate preserved (D-08)"
      pattern: "<AdminOnly"
---

<objective>
Refactor NavBar.tsx to strip all route-specific controls and wire in
Breadcrumb + UserMenu. Extend SubHeader.tsx to host Sales/HR Toggle + Upload
icon on `/sales` and `/hr` only. Remove lastDashboard sessionStorage
entirely. This is the "atomic chrome swap" — the two files must land
together so the header is coherent at every commit.

Purpose: Makes the Plan 01/02 components visible in the app. Implements
HDR-01 (top header = identity only) and HDR-04 (relocate content controls
to SubHeader).

Output: Two existing files heavily modified; zero new files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-01-SUMMARY.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-02-SUMMARY.md

@frontend/src/components/NavBar.tsx
@frontend/src/components/SubHeader.tsx
@frontend/src/components/Breadcrumb.tsx
@frontend/src/components/UserMenu.tsx
@frontend/src/components/LanguageToggle.tsx
@frontend/src/components/ThemeToggle.tsx
@frontend/src/components/ui/toggle.tsx
@frontend/src/auth/AdminOnly.tsx
@frontend/src/components/dashboard/DateRangeFilter.tsx
@frontend/src/hooks/useSettings.ts
@frontend/src/lib/defaults.ts

<interfaces>
<!-- Key APIs for this plan -->

From Plan 01 (now on disk):
```ts
import { Breadcrumb } from "@/components/Breadcrumb"; // no props
```

From Plan 02 (now on disk):
```ts
import { UserMenu } from "@/components/UserMenu"; // no props
```

Phase 54 Toggle primitive (frontend/src/components/ui/toggle.tsx):
```ts
// 2-tuple segments required (enforced at type level)
<Toggle
  segments={[{value: "X", label: "X"}, {value: "Y", label: "Y"}] as const}
  value={currentValue}
  onChange={(v) => ...}
  aria-label="..."
  className="..."
/>
```

AdminOnly wrapper (frontend/src/auth/AdminOnly.tsx):
```ts
// Renders children only if current user is admin
<AdminOnly>...</AdminOnly>
```

wouter:
```ts
import { Link, useLocation } from "wouter";
const [location, navigate] = useLocation();
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor NavBar.tsx to identity-only top header</name>
  <files>frontend/src/components/NavBar.tsx</files>
  <read_first>
    - frontend/src/components/NavBar.tsx (current 157-line source — every import, every effect, every JSX block will be stripped or replaced)
    - frontend/src/components/Breadcrumb.tsx (Plan 01 output — to import)
    - frontend/src/components/UserMenu.tsx (Plan 02 output — to import)
    - frontend/src/hooks/useSettings.ts + frontend/src/lib/defaults.ts (brand rendering — keep as-is)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pattern 4 + §Pitfall 5 (lastDashboard removal)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md "Fixed chrome contract"
  </read_first>
  <action>
Replace the entire contents of `frontend/src/components/NavBar.tsx` with:

```tsx
import { Link, useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { UserMenu } from "@/components/UserMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export function NavBar() {
  const [location] = useLocation();
  const isLauncher = location === "/";
  const { data } = useSettings();
  const settings = data ?? DEFAULT_SETTINGS;

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          {settings.logo_url != null && (
            <img
              src={settings.logo_url}
              alt={settings.app_name}
              className="max-h-8 max-w-8 object-contain"
            />
          )}
          <span className="text-sm font-medium">{settings.app_name}</span>
        </Link>
        {!isLauncher && <Breadcrumb />}
        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <LanguageToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
```

CRITICAL REMOVALS — these must be GONE from NavBar.tsx after this task:
- All `lastDashboard` references (sessionStorage.getItem, sessionStorage.setItem, useEffect, local state) — all 5 hits per RESEARCH Pitfall 5
- Back-to-dashboard `<Button variant="ghost"><ArrowLeft>` block and its i18n strings
- Sales/HR `<Toggle>` JSX block and related `useAuth`/`navigate` wiring
- Docs `<Link>` icon row
- Upload `<AdminOnly><Link>` icon row
- Settings gear `<Link>` icon row
- Sign-out `<Button>` icon row
- Imports now unused: `ArrowLeft`, `Upload` (renamed `UploadIcon`), `Settings` (`SettingsIcon`), `LogOut`, `Library`, `Toggle`, `Button`, `useAuth`, `AdminOnly`, `useTranslation`, `useEffect`, `useState`

Use the EXACT source above — do NOT introduce new abstractions. Chrome contract: h-16 top-0 z-50 unchanged.

Verification grep (author MUST confirm before marking done):
- `rg -n "lastDashboard" frontend/src` returns ZERO matches (Pitfall 5 invariant)
- `rg -n "dark:" frontend/src/components/NavBar.tsx` returns ZERO matches
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "NavBar.tsx" || echo "CLEAN"</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "lastDashboard" frontend/src` returns ZERO matches (Pitfall 5 invariant — this is a repo-wide check, not just NavBar.tsx)
    - `rg -n "<Breadcrumb" frontend/src/components/NavBar.tsx` returns a match
    - `rg -n "<UserMenu" frontend/src/components/NavBar.tsx` returns a match
    - `rg -n "<ThemeToggle" frontend/src/components/NavBar.tsx` returns a match
    - `rg -n "<LanguageToggle" frontend/src/components/NavBar.tsx` returns a match
    - `rg -n "<Toggle" frontend/src/components/NavBar.tsx` returns ZERO matches (Sales/HR Toggle removed)
    - `rg -n "ArrowLeft|<AdminOnly|LogOut|Settings as|Upload as|Library" frontend/src/components/NavBar.tsx` returns ZERO matches
    - `rg -n "back_to_sales|back_to_hr|nav.back" frontend/src/components/NavBar.tsx` returns ZERO matches
    - `rg -n "useAuth|useEffect|useState" frontend/src/components/NavBar.tsx` returns ZERO matches
    - `rg -n "dark:" frontend/src/components/NavBar.tsx` returns ZERO matches
    - `rg -n "h-16|top-0|z-50" frontend/src/components/NavBar.tsx` returns at least 3 matches (chrome contract preserved)
    - NavBar.tsx source is ≤ 60 lines (`wc -l frontend/src/components/NavBar.tsx` ≤ 60) — dramatic simplification per RESEARCH Pattern 4
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "NavBar.tsx" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
NavBar.tsx contains only brand + Breadcrumb + ThemeToggle + LanguageToggle + UserMenu; lastDashboard is gone from the repo; TypeScript clean; dark-mode invariant preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend SubHeader.tsx to host Sales/HR Toggle + Upload on /sales & /hr</name>
  <files>frontend/src/components/SubHeader.tsx</files>
  <read_first>
    - frontend/src/components/SubHeader.tsx (current source — extend the per-route conditional pattern already used with `location === "/sales"`)
    - frontend/src/components/ui/toggle.tsx (Toggle primitive contract — 2-tuple segments enforced)
    - frontend/src/auth/AdminOnly.tsx (wrapper component signature)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pattern 5 (full SubHeader refactor source)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md "Interaction Contract → Sales/HR Toggle in SubHeader" and "Upload icon in SubHeader"
  </read_first>
  <action>
Modify `frontend/src/components/SubHeader.tsx` to add:

1. **Left slot Sales/HR Toggle** on `/sales` and `/hr` (D-07). Place it alongside the existing DateRangeFilter using `gap-3` side-by-side (planner discretion per CONTEXT):

```tsx
import { Toggle } from "@/components/ui/toggle";

// Inside SubHeader body, after useLocation:
const [location, navigate] = useLocation();
const isDashboard = location === "/sales" || location === "/hr";

// In the left slot JSX:
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
```

2. **Right slot Upload icon** on `/sales` and `/hr` (D-08, AdminOnly preserved):

```tsx
import { Link } from "wouter";
import { Upload as UploadIcon } from "lucide-react";
import { AdminOnly } from "@/auth/AdminOnly";
import { cn } from "@/lib/utils";

// In the right slot JSX, BEFORE existing freshness indicators:
{isDashboard && (
  <AdminOnly>
    <Link
      href="/upload"
      aria-label={t("nav.upload")}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent/10 transition-colors",
        location === "/upload" ? "text-primary" : "text-foreground",
      )}
    >
      <UploadIcon className="h-4 w-4" />
    </Link>
  </AdminOnly>
)}
```

3. **Preserve existing SubHeader behavior**: FreshnessIndicator/HrFreshnessIndicator/SensorFreshnessIndicator rendering, DateRangeFilter on `/sales`, top-16 h-12 z-40 chrome contract, `return null` on `/` (launcher).

4. **Planner's discretion** (per CONTEXT): exact left-slot flex arrangement. Default: `<div className="flex items-center gap-3">{Toggle}{DateRangeFilter on /sales only}</div>`.

DO NOT:
- Change SubHeader height (stays h-12)
- Change z-index (stays z-40)
- Introduce a new abstraction for per-route slots (extend the existing `location === "/sales"` pattern)
- Add `dark:` variants
- Use hardcoded colors

If the existing SubHeader.tsx does NOT render on `/hr` today, ADD the necessary conditional so it renders on `/hr` (so the Toggle is visible there). If it already renders on `/hr`, leave that logic alone.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "SubHeader.tsx" || echo "CLEAN"</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "<Toggle" frontend/src/components/SubHeader.tsx` returns a match
    - `rg -n "aria-label=\\{t\\(\"nav.dashboardToggleLabel\"\\)\\}" frontend/src/components/SubHeader.tsx` returns a match
    - `rg -n "<AdminOnly" frontend/src/components/SubHeader.tsx` returns a match
    - `rg -n "Upload as UploadIcon|lucide-react.*Upload" frontend/src/components/SubHeader.tsx` returns a match
    - `rg -n "href=\"/upload\"" frontend/src/components/SubHeader.tsx` returns a match
    - `rg -n "location === \"/sales\" \\|\\| location === \"/hr\"|isDashboard" frontend/src/components/SubHeader.tsx` returns at least one match (dashboard guard)
    - `rg -n "nav.sales|nav.hr" frontend/src/components/SubHeader.tsx` returns at least 2 matches (Toggle labels)
    - `rg -n "h-12|top-16|z-40" frontend/src/components/SubHeader.tsx` returns at least 3 matches (chrome contract preserved)
    - `rg -n "dark:" frontend/src/components/SubHeader.tsx` returns ZERO matches
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "SubHeader.tsx" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
SubHeader renders Sales/HR Toggle (left) + AdminOnly-gated Upload link (right) on `/sales` and `/hr`; existing indicators preserved; chrome contract unchanged; dark-mode invariant preserved.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human smoke verify — visual header chrome</name>
  <files>frontend/src/components/NavBar.tsx, frontend/src/components/SubHeader.tsx</files>
  <what-built>
    - NavBar is now brand + Breadcrumb + Theme/Language toggles + UserMenu avatar.
    - SubHeader shows Sales/HR Toggle and AdminOnly Upload icon on `/sales` and `/hr`.
  </what-built>
  <action>Pause execution and present the verification steps below to the user. Wait for an explicit "approved" resume signal before marking the plan complete. If the user reports issues, open follow-up tasks rather than silently bypassing.</action>
  <how-to-verify>
    1. `cd frontend && npm run dev` — open the app.
    2. Visit `/sales`: confirm top header shows brand left, breadcrumb `Home › Sales`, and right-cluster Theme + Language + avatar. No Sales/HR toggle in top header. SubHeader shows Sales/HR Toggle (left) + Upload icon (right, visible only if admin) + freshness indicator.
    3. Click the Sales/HR Toggle in SubHeader — route changes between `/sales` and `/hr`; breadcrumb updates.
    4. Click the avatar — dropdown opens with identity row, Documentation, Settings, Sign out. Click Documentation — navigates to `/docs` WITHOUT a full page flash (Pitfall 3 verification).
    5. Visit `/settings/sensors` — breadcrumb shows 3 crumbs: Home › Settings › Sensor monitoring (or equivalent labels). SubHeader does NOT show Sales/HR Toggle on settings routes.
    6. Visit `/` (launcher) — top header shows NO breadcrumb (launcher exclusion).
    7. Use Tab from an empty page focus: confirm avatar trigger, breadcrumb links, theme toggle, language toggle are all focusable with visible focus ring.
    8. Toggle dark mode via ThemeToggle — header chrome stays clean, no contrast regressions.
  </how-to-verify>
  <verify>Human-driven smoke per the how-to-verify steps above; resume only after explicit "approved" from user.</verify>
  <done>User confirms all 8 how-to-verify steps pass and types "approved".</done>
  <resume-signal>Type "approved" or describe issues (e.g., "Docs click triggers full reload" → Pitfall 3 needs fallback path).</resume-signal>
</task>


</tasks>

<verification>
- `cd frontend && npx vitest run` — all pre-existing + new tests pass
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "(NavBar|SubHeader)\.tsx" || echo "CLEAN"` — prints `CLEAN`
- `rg -n "lastDashboard" frontend/src` — ZERO matches (repo-wide invariant, Pitfall 5)
- `rg -n "dark:" frontend/src/components/NavBar.tsx frontend/src/components/SubHeader.tsx` — zero matches
- Human smoke (Task 3) approved
</verification>

<success_criteria>
1. Top header carries only global identity (HDR-01)
2. Sales/HR Toggle, Upload icon live in SubHeader on `/sales` and `/hr` only (HDR-04 via D-07, D-08)
3. Settings/Docs/Sign-out accessible via UserMenu (HDR-04 via D-09)
4. lastDashboard sessionStorage is gone (D-10, Pitfall 5)
5. Total chrome height unchanged (64 + 48 = 112px, pt-28 in AppShell still correct)
6. No `dark:` variants introduced; dark mode remains token-driven
</success_criteria>

<output>
After completion, create `.planning/phases/56-breadcrumb-header-content-nav-relocation/56-03-SUMMARY.md`
</output>
