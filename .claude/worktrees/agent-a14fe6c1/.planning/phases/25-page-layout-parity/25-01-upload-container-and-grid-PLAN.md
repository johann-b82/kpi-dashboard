---
phase: 25-page-layout-parity
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/UploadPage.tsx
autonomous: true
requirements: [UC-06, UC-08, UC-09]
must_haves:
  truths:
    - "/upload outer wrapper visually matches dashboard container width"
    - "DropZone and UploadHistory appear side-by-side on wide viewports (>= lg)"
    - "DropZone and UploadHistory stack vertically on narrow viewports (< lg)"
    - "ErrorList still spans full width above the two-column grid when present"
    - "The <Separator> divider between error surface and two-column body is preserved"
  artifacts:
    - path: "frontend/src/pages/UploadPage.tsx"
      provides: "Upload page using dashboard container and two-column body grid"
      contains: "max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8"
  key_links:
    - from: "frontend/src/pages/UploadPage.tsx"
      to: "dashboard container token"
      via: "outer <div> className"
      pattern: "max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8"
    - from: "frontend/src/pages/UploadPage.tsx"
      to: "responsive two-column grid"
      via: "grid wrapper className"
      pattern: "grid grid-cols-1 lg:grid-cols-2"
---

<objective>
Restructure `/upload` page to adopt the dashboard container token (`max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`) and lay out DropZone + UploadHistory in a responsive two-column grid with ErrorList spanning full width above.

Purpose: UC-06 (container parity), UC-08 (wider canvas used sensibly), UC-09 (padding rhythm consistency).
Output: Updated UploadPage.tsx visually aligned with Sales/HR dashboards.
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
@frontend/src/pages/UploadPage.tsx

<interfaces>
Reference container (from DashboardPage.tsx and HRPage.tsx):

```tsx
<div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
  {/* children */}
</div>
```

Current UploadPage.tsx structure (to be replaced):
- Outer: `max-w-[800px] mx-auto px-4 py-12`
- h1 page_title, DropZone, ErrorList (conditional), `<Separator className="my-8" />`, h2 history_title, UploadHistory

Components in use (unchanged imports):
- `DropZone` from `@/components/DropZone` — props: `onUploadSuccess`, `onUploadError`
- `ErrorList` from `@/components/ErrorList` — props: `errors`
- `UploadHistory` from `@/components/UploadHistory` — no props
- `Separator` from `@/components/ui/separator`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap outer wrapper to dashboard container and restructure body into two-column grid</name>
  <files>frontend/src/pages/UploadPage.tsx</files>
  <read_first>
    - frontend/src/pages/UploadPage.tsx (the file being modified)
    - frontend/src/pages/DashboardPage.tsx (reference container — copy token verbatim)
    - frontend/src/pages/HRPage.tsx (second reference — confirms token shape)
    - .planning/phases/25-page-layout-parity/25-CONTEXT.md (locked decisions 1 and 3)
  </read_first>
  <action>
Replace the entire return block of `UploadPage.tsx` with the structure below. Do NOT change imports, state, or the `useState<ValidationErrorDetail[]>` hook — only the JSX.

Exact outer wrapper className (copy verbatim, per UC-06 and CONTEXT.md decision #1):
`max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`

Exact body grid className (per CONTEXT.md decision #1 — side-by-side on lg+, stacked below):
`grid grid-cols-1 lg:grid-cols-2 gap-8`

Keep the `<Separator className="my-8" />` between the error surface and the two-column body (per CONTEXT.md decision #3). The separator's own `my-8` margins provide its own vertical rhythm — wrapper `space-y-8` handles cadence between sibling blocks at the wrapper level; there is no conflict because the separator is the only visual divider between `ErrorList` (or the DropZone group if ErrorList is empty) and the grid.

Replace the JSX with exactly this structure:

```tsx
return (
  <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
    <h1 className="text-xl font-semibold">{t("page_title")}</h1>

    {errors.length > 0 && <ErrorList errors={errors} />}

    <Separator className="my-8" />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <DropZone
          onUploadSuccess={() => setErrors([])}
          onUploadError={(data) => setErrors(data.errors)}
        />
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t("history_title")}</h2>
        <UploadHistory />
      </div>
    </div>
  </div>
);
```

Notes on what changed vs. current file:
- Outer wrapper token swap per UC-06
- `mb-6` removed from h1 (wrapper `space-y-8` handles spacing)
- ErrorList's `<div className="mt-4">` wrapper removed (wrapper `space-y-8` handles spacing; ErrorList sits between h1 and Separator as a direct child of the wrapper)
- `mb-4` removed from h2 (replaced with inner `space-y-4` on the column so heading + UploadHistory get consistent rhythm)
- DropZone and UploadHistory each live in their own column div
- `history_title` heading now sits above its own column, not above a divider (per CONTEXT.md decision #1)

Do NOT add any `max-w-*` constraint on inner columns — the 7xl wrapper + two-column split is the intended canvas. Do NOT remove the Separator. Do NOT change the `<Separator className="my-8" />` token.
  </action>
  <acceptance_criteria>
    - grep finds exactly one occurrence of `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` in UploadPage.tsx
    - grep finds zero occurrences of `max-w-[800px]` in UploadPage.tsx
    - grep finds zero occurrences of `px-4 py-12` in UploadPage.tsx
    - grep finds `grid grid-cols-1 lg:grid-cols-2 gap-8` in UploadPage.tsx
    - grep finds `<Separator className="my-8" />` in UploadPage.tsx (separator preserved)
    - grep finds `<ErrorList errors={errors} />` in UploadPage.tsx (conditional render intact)
    - grep finds `<UploadHistory />` in UploadPage.tsx
    - grep finds both `t("page_title")` and `t("history_title")` in UploadPage.tsx
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npm run build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>
UploadPage.tsx uses the dashboard container token, ErrorList still shows above the divider when errors exist, DropZone and UploadHistory render side-by-side on `lg` and above and stack below that breakpoint, build is green.
  </done>
</task>

</tasks>

<verification>
- Visual check (belongs in Plan 03 UAT): open `/upload` at lg+ viewport — two columns; resize to below `lg` — stacks vertically.
- Functional check: upload a bad file — ErrorList appears full-width above Separator; upload a good file — entry appears in UploadHistory in the right column.
- Grep parity with dashboards: `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` appears in DashboardPage.tsx, HRPage.tsx, and now UploadPage.tsx.
</verification>

<success_criteria>
UC-06 satisfied (container token literal match). UC-08 satisfied (DropZone + UploadHistory two-column layout on wide viewports, stacked below `lg`). UC-09 satisfied for `/upload` (padding rhythm `pt-4 pb-8` and vertical spacing `space-y-8` now match dashboards). Build green.
</success_criteria>

<output>
After completion, create `.planning/phases/25-page-layout-parity/25-01-upload-container-and-grid-SUMMARY.md`
</output>
