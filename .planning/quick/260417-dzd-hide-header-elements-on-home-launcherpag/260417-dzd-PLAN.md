---
phase: quick
plan: 260417-dzd
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/NavBar.tsx
  - frontend/src/components/SubHeader.tsx
  - frontend/src/App.tsx
autonomous: false
requirements: [QUICK-260417-dzd]
must_haves:
  truths:
    - "On /home, the NavBar shows only: brand slot, ThemeToggle, LanguageToggle, sign-out button"
    - "On /home, the NavBar does NOT render the SALES/HR SegmentedControl"
    - "On /home, the NavBar does NOT render the docs (Library), upload, or settings Links"
    - "On /home, the SubHeader does not render at all (returns null)"
    - "On /home, the main content sits at pt-16 (no 48px gap under a non-existent SubHeader)"
    - "On /, /hr, /upload, /settings, /docs (non-/home routes) the NavBar and SubHeader behave exactly as before"
  artifacts:
    - path: "frontend/src/components/NavBar.tsx"
      provides: "Conditional rendering guarded by location === '/home'"
    - path: "frontend/src/components/SubHeader.tsx"
      provides: "Early return null on /home"
    - path: "frontend/src/App.tsx"
      provides: "Conditional main padding: pt-16 on /home, pt-28 elsewhere"
  key_links:
    - from: "frontend/src/App.tsx"
      to: "main element className"
      via: "useLocation() result compared to '/home'"
      pattern: "pt-16|pt-28"
---

<objective>
Hide the KPI Dashboard header chrome on the App Launcher (`/home`) so the iOS-style launcher grid reads as a clean, standalone surface without navigation clutter.

Purpose: Finishing touch for v1.14 Phase 37 — the launcher is meant to be an app-home, not a nested view inside the Sales dashboard chrome. Hiding the dashboard-centric controls (SALES/HR toggle, docs/upload/settings links, sub-header date filter) matches iOS-launcher mental model.

Output: Conditional rendering in NavBar, SubHeader, and App.tsx that keys off `location === "/home"`. Non-/home routes are unaffected.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/NavBar.tsx
@frontend/src/components/SubHeader.tsx
@frontend/src/App.tsx
@frontend/src/pages/LauncherPage.tsx

<interfaces>
<!-- Current rendering contract the executor needs to preserve for non-/home routes. -->

NavBar.tsx (current structure, as of this plan):
- Always renders: `<nav class="fixed top-0 ... h-16 ...">` with brand slot on left
- Center slot (mutually exclusive):
  - If `location` is `/settings | /upload | /docs | /docs/*` → back button
  - Else → SegmentedControl (SALES / HR)
- Right slot (always, in order): ThemeToggle, LanguageToggle, docs Link, AdminOnly(upload Link), settings Link, sign-out button

SubHeader.tsx (current structure):
- Always renders `<div class="fixed top-16 ... h-12 ...">`
- Left cell: DateRangeFilter on `/` only, empty otherwise
- Right cell: HrFreshnessIndicator on `/hr`, FreshnessIndicator otherwise

App.tsx AppShell (current):
- `isLogin = location === "/login"`
- If not login: renders `<NavBar /> <SubHeader />`
- `<main className={isLogin ? "" : "pt-28"}>` — 28 = 16 (nav) + 12 (sub-header)

After this plan, `/home` must behave like a third variant: NavBar with center slot empty and right slot reduced, no SubHeader, and `main` using `pt-16` (nav only).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Conditionally hide NavBar center + nav Links on /home</name>
  <files>frontend/src/components/NavBar.tsx</files>
  <action>
    Modify `frontend/src/components/NavBar.tsx` so that when `location === "/home"`:
    1. The center slot renders nothing — neither the back-button branch nor the SegmentedControl. (The existing back-button condition `/settings | /upload | /docs*` already excludes /home, so the else-branch would currently render the SegmentedControl. We need to suppress that.)
    2. The right-side group does NOT render the docs (Library) Link, the AdminOnly upload Link, or the settings Link.
    3. ThemeToggle, LanguageToggle, and the sign-out button MUST still render. Brand slot MUST still render.

    Implementation approach:
    - Introduce a local `const isLauncher = location === "/home";` near the top of the component (after `const [location, navigate] = useLocation();`).
    - Wrap the existing center-slot ternary in `{!isLauncher && (...)}` so the entire back-button-or-segmented-control block is skipped on /home. (Alternative: expand the ternary to a three-way expression — either is fine; pick the wrapper pattern for readability.)
    - In the right-side `<div className="ml-auto flex items-center gap-4">` group, wrap the three `<Link>` elements (docs, upload via AdminOnly, settings) in `{!isLauncher && (<>...</>)}` — or individually gate each with `{!isLauncher && ...}`. Use a single fragment wrapper for the three links to keep diff small.
    - Leave ThemeToggle, LanguageToggle, and the sign-out `<button>` unconditional.

    Do NOT change any className strings, icon sizes, aria-labels, or the useEffect that tracks `lastDashboard`. Do NOT add any new imports.

    Addresses user request item 1.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit</automated>
  </verify>
  <done>
    - `frontend/src/components/NavBar.tsx` compiles with no TypeScript errors.
    - On /home, only brand + ThemeToggle + LanguageToggle + sign-out render; center slot is empty and docs/upload/settings links are absent.
    - On /, /hr, /upload, /settings, /docs (and /docs/*) the NavBar renders identically to before (SegmentedControl on /, /hr; back button on /upload, /settings, /docs*; all three right-side links present).
  </done>
</task>

<task type="auto">
  <name>Task 2: SubHeader returns null on /home + main padding collapses to pt-16</name>
  <files>frontend/src/components/SubHeader.tsx, frontend/src/App.tsx</files>
  <action>
    Make two coordinated edits:

    (A) `frontend/src/components/SubHeader.tsx` — early return:
    - After the `const [location] = useLocation();` line (and before `const { preset, range, handleFilterChange } = useDateRange();`), add:
      ```ts
      if (location === "/home") return null;
      ```
    - Do NOT change any other logic. The `useDateRange()` hook call is still reached on every non-/home render, preserving existing behavior.
    - Addresses user request item 2.

    (B) `frontend/src/App.tsx` — conditional main padding:
    - In `AppShell()`, add a second boolean alongside `isLogin`:
      ```ts
      const isLauncher = location === "/home";
      ```
    - Change the main element's className from:
      ```tsx
      <main className={isLogin ? "" : "pt-28"}>
      ```
      to a three-way expression:
      ```tsx
      <main className={isLogin ? "" : isLauncher ? "pt-16" : "pt-28"}>
      ```
    - The `{!isLogin && (<><NavBar /><SubHeader /></>)}` block stays unchanged — NavBar is still rendered on /home (it's just leaner), and SubHeader is rendered but returns null internally. This keeps App.tsx shell logic simple and centralizes the /home chrome-hiding decisions in each component.
    - Addresses user request item 3.

    No new imports in either file.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit</automated>
  </verify>
  <done>
    - Both files compile with no TypeScript errors.
    - SubHeader renders nothing on /home (returns null before any JSX).
    - main uses pt-16 on /home, pt-28 on all other non-login routes, and no padding class on /login.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    NavBar is stripped down on /home (no SALES/HR toggle, no docs/upload/settings links — only brand, theme, language, sign-out). SubHeader returns null on /home. Main content sits at pt-16 instead of pt-28 on /home. All other routes unchanged.
  </what-built>
  <how-to-verify>
    The user's dev server is running at http://localhost:5173 with HMR (frontend container) — no restart needed.

    1. Open http://localhost:5173/home in the browser (log in first if prompted; use existing credentials).
    2. Confirm the NavBar shows: brand on the left, and on the right only — theme toggle, language toggle, sign-out button. No SALES/HR segmented control in the middle. No book/library (docs) icon, no upload arrow (admin only — would only appear if logged in as admin anyway), no gear/settings icon.
    3. Confirm there is no 48px "second bar" under the NavBar — the launcher heading ("KPI Light" app name from Settings) should appear directly under the 64px NavBar with no empty strip between them.
    4. Confirm the tile grid (KPI Dashboard tile + 3 coming-soon tiles) is not visibly pushed down by extra padding — layout should look cleaner than before.
    5. Click the KPI Dashboard tile — it should navigate to `/` (Sales Dashboard). On `/`, confirm the full header is back: SALES/HR segmented control visible, docs/upload/settings icons visible, and the SubHeader (date-range filter + freshness indicator) visible at top-16.
    6. Navigate back to /home (via browser back or by typing /home in the address bar) and confirm the stripped-down header returns.
    7. Visit `/hr`, `/upload`, `/settings`, and `/docs` and confirm each shows the full NavBar (SegmentedControl on /hr; back button on /upload, /settings, /docs) plus SubHeader — i.e. no regressions on non-/home routes.
    8. Sign-out button should still work from /home.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles cleanly: `cd frontend && npx tsc --noEmit` exits 0
- Visual verification at http://localhost:5173/home passes all 8 checkpoint steps
- No regressions on /, /hr, /upload, /settings, /docs, /login
</verification>

<success_criteria>
- On /home: NavBar shows brand + ThemeToggle + LanguageToggle + sign-out only; SubHeader not rendered; main content sits at pt-16
- On all other non-login routes: unchanged behavior (SegmentedControl or back button in NavBar center; docs/upload/settings links present; SubHeader rendered; main at pt-28)
- On /login: unchanged (no NavBar, no SubHeader, no main padding)
- `npx tsc --noEmit` in frontend/ exits 0
- Human verification approved
</success_criteria>

<output>
After completion, create `.planning/quick/260417-dzd-hide-header-elements-on-home-launcherpag/260417-dzd-SUMMARY.md`
</output>
