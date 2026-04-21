---
phase: 54-toggle-primitive-migrations
plan: 04
type: execute
wave: 2
depends_on: ["54-01"]
files_modified:
  - frontend/src/components/ThemeToggle.tsx
autonomous: true
requirements:
  - TOGGLE-03
must_haves:
  truths:
    - "The theme switch renders a 2-segment Toggle with a Sun icon for light and a Moon icon for dark."
    - "Clicking the inactive segment switches theme and persists to localStorage.theme."
    - "OS `prefers-color-scheme` live-tracking still works (only when localStorage is unset)."
    - "The `.dark` class is still toggled on `document.documentElement`."
    - "Keyboard (Arrow keys, Enter/Space) switches theme via the Toggle primitive."
  artifacts:
    - path: "frontend/src/components/ThemeToggle.tsx"
      provides: "Theme switch rendered via Toggle with icon-only segments"
      contains: "from \"@/components/ui/toggle\""
    - path: "frontend/src/components/ThemeToggle.tsx"
      provides: "Preserved localStorage persistence"
      contains: "localStorage.setItem(\"theme\""
    - path: "frontend/src/components/ThemeToggle.tsx"
      provides: "Preserved OS prefers-color-scheme live-track"
      contains: "prefers-color-scheme"
  key_links:
    - from: "frontend/src/components/ThemeToggle.tsx"
      to: "document.documentElement classList"
      via: "applyMode → root.classList.add/remove('dark')"
      pattern: "root\\.classList\\.(add|remove)"
    - from: "frontend/src/components/ThemeToggle.tsx"
      to: "frontend/src/components/ui/toggle.tsx"
      via: "import { Toggle } from '@/components/ui/toggle'"
      pattern: "@/components/ui/toggle"
---

<objective>
Migrate `ThemeToggle` from a single `<button>` with a swapping icon to a 2-segment `Toggle` with sun (light) and moon (dark) icons as the segment content. Preserve the v1.9 D-06/D-07 logic: localStorage persistence, `.dark` class toggling on `documentElement`, and OS `prefers-color-scheme` live-tracking until the user explicitly picks a theme. Closes TOGGLE-03.

Purpose: Fourth production call site for the Toggle primitive; the only one using icon-only segments (exercises the `icon` segment field from D-02).

Output: Updated `frontend/src/components/ThemeToggle.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
@frontend/src/components/ThemeToggle.tsx
@frontend/src/components/ui/toggle.tsx
@frontend/src/components/ui/segmented-control.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap ThemeToggle JSX to 2-segment Toggle with sun/moon icons; preserve OS + localStorage logic</name>
  <files>frontend/src/components/ThemeToggle.tsx</files>
  <read_first>
    - frontend/src/components/ThemeToggle.tsx (current state — preserve `applyMode`, `useEffect` matchMedia listener, and localStorage.theme wiring verbatim)
    - frontend/src/components/ui/toggle.tsx (confirm Toggle accepts `segments[i].icon` with optional `label`)
    - frontend/src/components/ui/segmented-control.tsx (reference for a11y pattern)
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md § D-11
  </read_first>
  <action>
    Rewrite `frontend/src/components/ThemeToggle.tsx` to the following shape. Preserve every line of the OS/localStorage logic — only the return JSX changes.

    ```tsx
    import { useEffect, useState } from "react";
    import { useTranslation } from "react-i18next";
    import { Sun, Moon } from "lucide-react";
    import { Toggle } from "@/components/ui/toggle";

    /**
     * Theme switch — 2-segment Toggle with sun (light) and moon (dark) icons.
     * Persists to localStorage.theme and toggles the .dark class on <html>.
     * Live-tracks OS prefers-color-scheme until the user picks a theme (D-06, D-07).
     * Phase 54 D-11: visual layer migrated to Toggle; all persistence/OS logic preserved.
     */
    type ThemeMode = "light" | "dark";

    export function ThemeToggle() {
      const { t } = useTranslation();
      const [mode, setMode] = useState<ThemeMode>(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );

      const applyMode = (next: ThemeMode, persist: boolean) => {
        const root = document.documentElement;
        if (next === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
        if (persist) localStorage.setItem("theme", next);
        setMode(next);
      };

      useEffect(() => {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onOsChange = (e: MediaQueryListEvent) => {
          const stored = localStorage.getItem("theme");
          // D-07: localStorage wins permanently once set
          if (stored === "light" || stored === "dark") return;
          applyMode(e.matches ? "dark" : "light", false);
        };
        mql.addEventListener("change", onOsChange);
        return () => mql.removeEventListener("change", onOsChange);
      }, []);

      return (
        <Toggle<ThemeMode>
          segments={[
            { value: "light", icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
            { value: "dark", icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
          ] as const}
          value={mode}
          onChange={(next) => applyMode(next, true)}
          aria-label={t("theme.toggle.aria_label")}
        />
      );
    }
    ```

    Key points:
    - The `applyMode` function, the initial `useState` read of `.dark`, and the `useEffect`-based OS listener are byte-for-byte unchanged from the current file. Only the final `return` JSX changes.
    - Segments are icon-only (no `label` field). The Toggle primitive (Plan 01) renders `segment.icon` followed by `segment.label` — when `label` is absent only the icon renders. Accessible name comes from `aria-label={t("theme.toggle.aria_label")}` on the container (`role="radiogroup"`).
    - Existing i18n key `theme.toggle.aria_label` is reused; no new keys added.
    - Icons use Tailwind token-sized `h-4 w-4` (fits inside the Toggle's 24px-high segment buttons with padding).
    - `as const` on segments ensures the 2-tuple type required by Toggle.
    - Keyboard navigation (Arrow/Enter/Space) is inherited from the Toggle primitive — no local handler needed. OnChange (from keyboard or click) calls `applyMode(next, true)` → persists to localStorage.

    Do NOT:
    - Rename `theme.toggle.aria_label`.
    - Change `applyMode`'s signature or body.
    - Remove the OS matchMedia effect.
    - Add `dark:*` variants or hex colors.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -q 'from "@/components/ui/toggle"' src/components/ThemeToggle.tsx && grep -q 'prefers-color-scheme' src/components/ThemeToggle.tsx && grep -q 'localStorage.setItem("theme"' src/components/ThemeToggle.tsx && grep -q 'root.classList.add("dark")' src/components/ThemeToggle.tsx && grep -q 'root.classList.remove("dark")' src/components/ThemeToggle.tsx && grep -q '<Sun' src/components/ThemeToggle.tsx && grep -q '<Moon' src/components/ThemeToggle.tsx && grep -q '<Toggle' src/components/ThemeToggle.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/components/ThemeToggle.tsx` imports `Toggle` from `@/components/ui/toggle`.
    - File contains `<Toggle<ThemeMode>` (or `<Toggle` with the generic applied).
    - File contains both `<Sun` and `<Moon` JSX (sun/moon icons as segment content per D-11).
    - File retains literal `prefers-color-scheme` (OS live-track preserved).
    - File retains literal `localStorage.setItem("theme"` (persistence preserved).
    - File retains `root.classList.add("dark")` AND `root.classList.remove("dark")` (`.dark` class toggling on documentElement preserved).
    - File retains `t("theme.toggle.aria_label")` (i18n key unchanged).
    - File does NOT contain `dark:` (no dark-variant classes — A11Y-03).
    - File does NOT contain any hex color literal matching `#[0-9a-fA-F]{3,8}`.
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npm run build` exits 0.
  </acceptance_criteria>
  <done>ThemeToggle renders a 2-segment Toggle with sun/moon icons. Switching segments (via click or keyboard) calls applyMode(next, true), which toggles the `.dark` class and persists to localStorage. OS `prefers-color-scheme` live-tracking still fires when localStorage is unset.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` exits 0.
- `cd frontend && npm run build` exits 0.
- Manual smoke (deferred to user): opening the app, clicking the moon icon switches to dark, reloading persists dark; in a fresh incognito window (no localStorage), OS-level theme change flips the app theme live.
</verification>

<success_criteria>
- TOGGLE-03 closed: theme switch is a Toggle with sun/moon icons.
- v1.9 D-06/D-07 behavior (OS live-track + localStorage persistence + `.dark` class toggle) is byte-for-byte preserved — only the visual layer changed.
- All four TOGGLE-04 migration surfaces (Sales/HR, HrKpiCharts area/bar, RevenueChart bar/area, ThemeToggle) are now Toggle-based across Plans 02/03/04.
</success_criteria>

<output>
After completion, create `.planning/phases/54-toggle-primitive-migrations/54-04-SUMMARY.md`.
</output>
