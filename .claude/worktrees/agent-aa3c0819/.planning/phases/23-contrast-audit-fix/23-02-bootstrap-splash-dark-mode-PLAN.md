---
phase: 23-contrast-audit-fix
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/index.html
autonomous: true
requirements: [DM-09]

must_haves:
  truths:
    - "Bootstrap-splash background respects active theme — no white flash in dark mode"
    - "Splash dot color maintains ≥4.5:1 contrast against splash background in both modes"
  artifacts:
    - path: "frontend/index.html"
      provides: "Pre-hydration IIFE setting --splash-bg and --splash-dot CSS variables; <style> consuming them"
      contains: "--splash-bg"
  key_links:
    - from: "frontend/index.html pre-hydration IIFE (lines 8-30)"
      to: "frontend/index.html bootstrap-splash <style> block (lines 31-58)"
      via: "CSS custom properties --splash-bg and --splash-dot set on document.documentElement"
      pattern: "--splash-bg"
---

<objective>
Eliminate the white-flash-in-dark-mode bug in the bootstrap-splash that was deferred from Phase 22 UAT Scenario E (per D-10).

Purpose: The splash renders BEFORE React hydrates AND BEFORE `index.css` (with `:root`/`.dark` token blocks) loads, so the splash `<style>` cannot consume the project's design tokens. Solution: extend the existing pre-hydration IIFE (already runs first and detects light/dark) to also set inline CSS variables on `documentElement`, then have the splash `<style>` consume those variables.

Output: Splash background and dot color follow the resolved theme (OS preference or stored localStorage value) — no white flash on first paint in dark mode.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/23-contrast-audit-fix/23-CONTEXT.md
@.planning/phases/23-contrast-audit-fix/23-RESEARCH.md
@frontend/index.html

<interfaces>
<!-- Existing pre-hydration IIFE in frontend/index.html lines 8-30 — DO NOT BREAK ITS LOGIC. -->
<!-- It already determines isDark from localStorage > OS preference and adds/removes the 'dark' class on <html>. -->
<!-- The fix EXTENDS it to also set CSS custom properties before the <style> block runs. -->

<!-- Current splash <style> in frontend/index.html lines 31-58: -->
```html
<style>
  #root > .bootstrap-splash {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.875rem;
    color: #64748b;        /* slate-500 — dot color */
    background: #ffffff;   /* HARDCODED — flashes white in dark mode */
  }
  /* ... .bootstrap-splash__dot rules unchanged ... */
</style>
```

<!-- Target colors (per 23-RESEARCH.md §6 Option D and §9 Example C): -->
- Light mode: bg #ffffff, dot #64748b (current values — preserve) → contrast 4.76:1 PASS
- Dark mode: bg #1a1a1a, dot #94a3b8 (slate-400) → contrast ≈ 7.0:1 PASS
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend pre-hydration IIFE to set --splash-bg and --splash-dot CSS variables</name>
  <files>frontend/index.html</files>
  <read_first>
    - frontend/index.html (full file, lines 1-70 — read all of it)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §6 (Bootstrap-Splash Location) and §9 Example C (exact code snippet)
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md D-10 (legacy hardcoded colors must be fixed in this phase)
  </read_first>
  <action>
    Edit `frontend/index.html`. Two surgical changes:

    **Change 1 — Extend the IIFE (lines 8-30) to set CSS variables BEFORE the splash `<style>` is parsed by the browser. Insert AFTER the `if (isDark) { ... } else { ... }` classList block, BEFORE the closing `} catch (e) {`:**

    Find this (lines 21-25):
    ```js
              if (isDark) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
    ```

    Replace with:
    ```js
              if (isDark) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              var splashBg = isDark ? '#1a1a1a' : '#ffffff';
              var splashDot = isDark ? '#94a3b8' : '#64748b';
              document.documentElement.style.setProperty('--splash-bg', splashBg);
              document.documentElement.style.setProperty('--splash-dot', splashDot);
    ```

    Hex value rationale (do NOT add as a code comment):
    - `#1a1a1a` matches the dark `--background` value (oklch(0.145 0 0) ≈ #1a1a1a from RESEARCH.md §1)
    - `#94a3b8` is Tailwind slate-400 — gives ~7.0:1 contrast against #1a1a1a
    - Light values (`#ffffff`, `#64748b`) preserve current passing colors (4.76:1)

    **Change 2 — Update the `<style>` block (lines 31-58). Replace the two color/background lines (lines 40-41):**

    Find this (lines 40-41):
    ```css
            color: #64748b;
            background: #ffffff;
    ```

    Replace with:
    ```css
            color: var(--splash-dot, #64748b);
            background: var(--splash-bg, #ffffff);
    ```

    The fallback values (`#64748b`, `#ffffff`) preserve light-mode rendering if the IIFE somehow fails (e.g., JS disabled — though the rest of the app would also fail). Do NOT touch other lines in the `<style>` block (`.bootstrap-splash__dot` rules, `@keyframes`, etc.).

    Do NOT modify the `<body>` or splash `<div>` markup — only the IIFE script and the `<style>` block.
  </action>
  <verify>
    <automated>grep -c "splash-bg" frontend/index.html</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "splash-bg" frontend/index.html` returns at least 3 (one in JS setProperty, one in CSS var(), one expected from naming consistency — accept ≥2 if linter merges)
    - `grep -c "splash-dot" frontend/index.html` returns at least 2
    - `grep -c "background: #ffffff" frontend/index.html` returns 0 (the hardcoded white background is gone from the splash style)
    - `grep -c "color: #64748b;" frontend/index.html` returns 0 (the hardcoded dot color is replaced with var())
    - `grep -c "var(--splash-bg" frontend/index.html` returns 1
    - `grep -c "var(--splash-dot" frontend/index.html` returns 1
    - `grep -c "document.documentElement.style.setProperty('--splash-bg'" frontend/index.html` returns 1
    - The IIFE's existing dark-class logic (`classList.add('dark')` / `classList.remove('dark')`) is preserved (`grep -c "classList.add('dark')" frontend/index.html` returns 1)
    - Manual smoke: `cd frontend && npm run dev`, hard-refresh in dark mode (set localStorage `theme = "dark"` then reload) — splash background must be dark, NOT a white flash
    - Manual smoke: hard-refresh in light mode — splash background remains white as before
  </acceptance_criteria>
  <done>IIFE sets `--splash-bg` and `--splash-dot` CSS variables on `documentElement` before the splash `<style>` is parsed; splash `<style>` consumes them via `var()`; no hardcoded `#ffffff` or `#64748b` background/color remain in the splash style block.</done>
</task>

</tasks>

<verification>
After the task:

1. `grep -E "#(ffffff|64748b)" frontend/index.html` should still find some hits (the IIFE literals and CSS var fallbacks) — confirm those occurrences are inside the IIFE branches and `var(..., fallback)` only, NOT in raw `background:` or `color:` declarations.
2. Boot the app in dark mode (set `localStorage.setItem('theme', 'dark')` then reload) — splash should appear with dark background and lighter dots, NO white flash.
3. Boot in light mode (clear localStorage then reload on a system in light OS preference) — splash should appear with white background and slate dots (unchanged from current behavior).
4. With OS preference dark and no localStorage value (first visit on a dark-themed OS), splash should also follow dark mode.
</verification>

<success_criteria>
- Splash background follows resolved theme (no white flash on first paint in dark mode)
- Light mode: splash unchanged visually (#64748b on #ffffff, 4.76:1)
- Dark mode: splash uses #94a3b8 dot on #1a1a1a background (~7.0:1)
- Pre-hydration IIFE remains the single source of truth for theme resolution (no duplication of localStorage/matchMedia logic)
</success_criteria>

<output>
After completion, create `.planning/phases/23-contrast-audit-fix/23-02-SUMMARY.md` documenting:
- Exact lines edited in IIFE and `<style>`
- Closes Phase 22 UAT Scenario E (deferred white-flash item)
</output>
