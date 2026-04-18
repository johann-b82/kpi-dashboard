---
phase: 25-page-layout-parity
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/SettingsPage.tsx
autonomous: true
requirements: [UC-07, UC-09]
must_haves:
  truths:
    - "/settings outer wrapper visually matches dashboard container width"
    - "Sticky ActionBar still clears final card content (pb-32 preserved)"
    - "Inner Cards (Identity, Colors, PersonioCard, HrTargetsCard) expand to the 7xl wrapper — no inner 5xl cap"
    - "Individual input `max-w-md` constraints on Settings fields remain unchanged"
    - "Error-state fallback wrapper also uses the 7xl container token"
  artifacts:
    - path: "frontend/src/pages/SettingsPage.tsx"
      provides: "Settings page using dashboard container with pb-32 ActionBar clearance"
      contains: "max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8"
  key_links:
    - from: "frontend/src/pages/SettingsPage.tsx main return"
      to: "dashboard container token (with pb-32 swap)"
      via: "outer <div> className"
      pattern: "max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8"
    - from: "frontend/src/pages/SettingsPage.tsx error-state return"
      to: "dashboard container token"
      via: "error-state <div> className"
      pattern: "max-w-7xl mx-auto px-6"
---

<objective>
Swap the `/settings` page outer wrappers (main render and error-state fallback) from the narrow `max-w-5xl` container to the dashboard-parity `max-w-7xl` container with `pb-32` preserved for sticky ActionBar clearance and `space-y-8` added for rhythm.

Purpose: UC-07 (container parity with pb-32 preserved), UC-09 (padding rhythm consistency). Per CONTEXT.md decision #2: cards expand with the wrapper — no inner 5xl cap, component-internal `max-w-md` on individual inputs stays.
Output: Updated SettingsPage.tsx visually aligned with Sales/HR dashboards at the container level.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25-page-layout-parity/25-CONTEXT.md
@frontend/src/pages/DashboardPage.tsx
@frontend/src/pages/SettingsPage.tsx

<interfaces>
Reference container: `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` (DashboardPage.tsx).

Settings deviates on the bottom padding only — `pb-32` (not `pb-8`) is retained for sticky ActionBar clearance, per UC-07 literal spec.

Two locations in SettingsPage.tsx must change:
1. Error-state fallback — currently `max-w-5xl mx-auto px-6 py-8` (line ~72)
2. Main return — currently `max-w-5xl mx-auto px-6 pt-4 pb-32` (line ~152)

Component-internal constraint to KEEP unchanged (per CONTEXT.md decision #2):
- The `max-w-md` on the app-name input wrapper (around line 171). Do not touch.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap both SettingsPage outer wrappers to dashboard-parity container</name>
  <files>frontend/src/pages/SettingsPage.tsx</files>
  <read_first>
    - frontend/src/pages/SettingsPage.tsx (the file being modified)
    - frontend/src/pages/DashboardPage.tsx (reference container)
    - .planning/phases/25-page-layout-parity/25-CONTEXT.md (locked decision #2)
  </read_first>
  <action>
Make exactly two className swaps in `frontend/src/pages/SettingsPage.tsx`. Do NOT touch anything else in the file — no JSX additions, no Card wrapper changes, no input-level class changes.

Change 1 — Error-state fallback wrapper (currently near line 72):

Replace:
```tsx
<div className="max-w-5xl mx-auto px-6 py-8">
```

With:
```tsx
<div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
```

Rationale: aligns the error-state surface with the dashboard container (UC-07 + UC-09). Uses `pb-8` (not `pb-32`) because the error state has no sticky ActionBar to clear.

Change 2 — Main return wrapper (currently near line 152):

Replace:
```tsx
<div className="max-w-5xl mx-auto px-6 pt-4 pb-32">
```

With:
```tsx
<div className="max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8">
```

Rationale: adopts the dashboard container width (UC-07) and `space-y-8` rhythm (UC-09) while preserving `pb-32` for sticky ActionBar clearance (UC-07 literal spec).

Do NOT:
- Add inner `max-w-*` wrappers around any Card (PersonioCard, HrTargetsCard, Identity Card, Colors Card) — per CONTEXT.md decision #2, cards expand with the wrapper.
- Touch the `max-w-md` on the app-name input wrapper around line 171 — that is component-internal per-field readability and stays.
- Remove the `mb-6` / `mb-12` margins currently on `<header>` and individual Cards in the main return. `space-y-8` affects sibling-to-sibling gaps; the existing intra-child margins are owned by the cards and are not in scope.
- Modify the `{/* pb-32 reserves... */}` inline comment — leave it in place since `pb-32` is still present.
  </action>
  <acceptance_criteria>
    - grep finds exactly one occurrence of `max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8` in SettingsPage.tsx
    - grep finds exactly one occurrence of `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` in SettingsPage.tsx (the error-state wrapper)
    - grep finds zero occurrences of `max-w-5xl` in SettingsPage.tsx
    - grep finds `max-w-md` still present in SettingsPage.tsx (component-internal input constraint preserved)
    - grep finds `pb-32` still present in SettingsPage.tsx (ActionBar clearance preserved)
    - grep finds `<PersonioCard` and `<HrTargetsCard` still present, unmodified (no inner wrapper added)
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npm run build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>
Both SettingsPage wrappers use the 7xl container token, `pb-32` preserved on main return for ActionBar clearance, `max-w-md` on individual inputs preserved, no inner 5xl cap introduced, build green.
  </done>
</task>

</tasks>

<verification>
- Visual check (belongs in Plan 03 UAT): open `/settings` — width matches dashboards; all cards flow to 7xl width; ActionBar sticky still clears the last card; individual inputs with `max-w-md` (Personio URL, app name) remain readable.
- Error-state check: temporarily simulate error state — wrapper matches dashboard container width too.
- Grep parity: `max-w-7xl` token appears in all four page wrappers (DashboardPage, HRPage, UploadPage, SettingsPage).
</verification>

<success_criteria>
UC-07 satisfied (`max-w-7xl mx-auto px-6 pt-4 space-y-8` present with `pb-32` preserved — literal token match). UC-09 satisfied for `/settings` (padding rhythm and vertical spacing now match dashboards). No inner 5xl cap. `max-w-md` per-field constraints preserved. Build green.
</success_criteria>

<output>
After completion, create `.planning/phases/25-page-layout-parity/25-02-settings-container-SUMMARY.md`
</output>
