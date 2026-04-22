---
phase: 59-a11y-parity-sweep
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/toggle.tsx
  - frontend/src/components/ui/checkbox.tsx
  - frontend/src/components/ui/badge.tsx
  - frontend/src/components/ui/toggle.test.tsx
autonomous: true
requirements:
  - A11Y-02

must_haves:
  truths:
    - "Path A utility (outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50) supersedes CONTEXT.md D-04 placeholder tokens per D-04 exact tokens TBD during research clause and Claude Discretion block."
    - "Every v1.19 primitive that renders a focusable control shows a visible focus ring in both light and dark mode when keyboard-focused."
    - "The Toggle primitive (flagship v1.19 component driving 5 consumers) now renders a focus-visible ring — fixes the gap flagged in RESEARCH.md §Focus-Ring Inventory."
    - "All shipped primitives share the same canonical focus-ring utility fragment to avoid two-spec drift."
  artifacts:
    - path: "frontend/src/components/ui/toggle.tsx"
      provides: "Toggle segment <button> elements render `focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20 outline-none` — FIXES the missing-ring gap."
    - path: "frontend/src/components/ui/checkbox.tsx"
      provides: "Focus-ring utility converged to Path A (shipped majority): `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` — replaces `focus-visible:ring-2 ring-offset-2` legacy."
    - path: "frontend/src/components/ui/badge.tsx"
      provides: "Arbitrary-value `ring-[3px]` normalized to `ring-3` to match Button/Input/Textarea/Select."
    - path: "frontend/src/components/ui/toggle.test.tsx"
      provides: "Test asserts `focus-visible:` utility is present on segment <button>."
  key_links:
    - from: "frontend/src/components/ui/toggle.tsx"
      to: "--ring CSS variable (frontend/src/index.css)"
      via: "Tailwind utility `focus-visible:ring-ring/50`"
      pattern: "focus-visible:ring-ring/50"
---

<objective>
Converge all v1.19 shared primitives on a single canonical focus-ring utility so that keyboard focus is visible in both light and dark mode across every migrated control.

Path decision (resolves RESEARCH.md Open Question Q1): **Path A — converge to shipped pattern.**

Canonical utility fragment (Path A):
```
outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```
For Toggle segments (inner <button>, no border swap since parent handles border):
```
outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20
```

Rationale (one line, recorded here per Pitfall 2): Path A matches 4 shipped primitives (Button/Input/Textarea/Select) already; retrofitting Button/Input/Textarea/Select to CONTEXT.md D-04 Path B is higher-churn for identical visible result. Checkbox (the lone Path B holdout) and Toggle (missing ring entirely) converge to Path A. This honors the SPIRIT of D-04 (visible focus ring via `--ring` in both themes) while minimizing churn; cites D-04 and this plan on every touched file.

Purpose: Close the A11Y-02 focus-ring gap — especially the Toggle primitive which currently renders zero focus ring.
Output: Focus-ring parity across Toggle, Button, Input, Textarea, Select, Checkbox, Badge.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/59-a11y-parity-sweep/59-CONTEXT.md
@.planning/phases/59-a11y-parity-sweep/59-RESEARCH.md
@frontend/src/components/ui/toggle.tsx
@frontend/src/components/ui/button.tsx
@frontend/src/components/ui/checkbox.tsx
@frontend/src/components/ui/badge.tsx

<interfaces>
<!-- Shipped focus-ring patterns (verified 2026-04-22) -->

Path A (shipped in button.tsx, input.tsx, textarea.tsx, select.tsx):
```
outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

Path B (currently in checkbox.tsx ONLY; matches CONTEXT.md D-04 verbatim):
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

Drift (badge.tsx):
```
focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
```

Toggle.tsx current segment button className (lines 110–114) — NO focus-visible:
```
"flex-1 relative z-10 rounded-full h-6 px-3 text-sm … transition-colors"
```

Toggle parent container (line 81) renders as `<div role="radiogroup">` — only the inner `<button role="radio">` elements receive keyboard focus; ring lives on them.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add focus-visible ring to Toggle segment buttons + unit test</name>
  <files>
    frontend/src/components/ui/toggle.tsx,
    frontend/src/components/ui/toggle.test.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/toggle.tsx (full file — understand isActive/!isActive className branches at lines 110–114)
    - frontend/src/components/ui/toggle.test.tsx (full file — understand existing render helper + vitest/@testing-library patterns used)
    - frontend/src/components/ui/button.tsx (reference Path A utility source of truth)
    - frontend/src/index.css (confirm `--ring` + `.dark` override exist; no edit)
  </read_first>
  <behavior>
    - Test 1: Toggle segment `<button role="radio">` elements include the class token `focus-visible:ring-3`.
    - Test 2: Toggle segment `<button role="radio">` elements include the class token `focus-visible:ring-ring/50`.
    - Test 3: Toggle segment `<button role="radio">` elements include `outline-none` and `focus-visible:z-20`.
    - Existing Toggle behaviour (2-tuple enforcement, keyboard nav, reduced-motion, aria-checked) must still pass.
  </behavior>
  <action>
    In `frontend/src/components/ui/toggle.tsx`, modify ONLY the two ternary-branch className strings returned by the segment `<button>` render (currently at approximately lines 110–114).

    Current (do NOT keep):
    ```tsx
    className={
      isActive
        ? "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 transition-colors"
        : "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-normal text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2 transition-colors"
    }
    ```

    Replace with EXACTLY:
    ```tsx
    className={
      isActive
        ? "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20"
        : "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-normal text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20"
    }
    ```

    Rationale (add as comment above the `return` statement):
    ```tsx
    // Focus ring: Path A (A11Y-02, Phase 59-02). `focus-visible:z-20` keeps the
    // ring above the animated indicator (which uses `bg-primary` at `z` default).
    // Border swap (used by Button/Input/Textarea/Select) is omitted because the
    // Toggle container — not the segment button — owns the border.
    ```

    Then add three test cases to `frontend/src/components/ui/toggle.test.tsx`. Match the existing test style (import from `vitest` + `@testing-library/react`, existing render helper for a 2-segment Toggle):

    ```tsx
    it("renders focus-visible ring utility on segment buttons (A11Y-02)", () => {
      // Existing render helper or inline render — use whatever the rest of the file uses.
      // Query the segment buttons via role="radio" and assert className.
      const radios = screen.getAllByRole("radio");
      for (const r of radios) {
        expect(r.className).toContain("focus-visible:ring-3");
        expect(r.className).toContain("focus-visible:ring-ring/50");
        expect(r.className).toContain("outline-none");
        expect(r.className).toContain("focus-visible:z-20");
      }
    });
    ```

    Constraints:
    - Do NOT change keyboard-handling, reduced-motion, aria-checked, or 2-tuple assert logic.
    - Do NOT touch the indicator `<span aria-hidden="true">` or the parent `role="radiogroup"` div.
  </action>
  <verify>
    <automated>cd frontend && npm test -- --run src/components/ui/toggle.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'focus-visible:ring-3' frontend/src/components/ui/toggle.tsx` returns `>= 2` (isActive + !isActive branches).
    - `grep -c 'focus-visible:ring-ring/50' frontend/src/components/ui/toggle.tsx` returns `>= 2`.
    - `grep -c 'focus-visible:z-20' frontend/src/components/ui/toggle.tsx` returns `>= 2`.
    - `grep -c 'outline-none' frontend/src/components/ui/toggle.tsx` returns `>= 2`.
    - `cd frontend && npm test -- --run src/components/ui/toggle.test.tsx` exits 0 with all existing + 1 new test passing.
    - Running the full existing Toggle test suite is untouched (no test deleted): `grep -c "^\s*it(" frontend/src/components/ui/toggle.test.tsx` is `>=` its previous value + 1.
  </acceptance_criteria>
  <done>
    Toggle segment buttons carry the Path A focus-ring utility; unit test asserts it; full toggle.test.tsx suite passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Converge Checkbox + Badge to Path A focus-ring utility</name>
  <files>
    frontend/src/components/ui/checkbox.tsx,
    frontend/src/components/ui/badge.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/checkbox.tsx (locate the `focus-visible:ring-2 … ring-offset-2` chain)
    - frontend/src/components/ui/badge.tsx (locate the `focus-visible:ring-[3px]` arbitrary-value)
    - frontend/src/components/ui/button.tsx (reference Path A utility source of truth)
  </read_first>
  <action>
    **In `frontend/src/components/ui/checkbox.tsx`:**
    Find the class chain containing `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (and `focus-visible:outline-none` alongside).

    Replace it with the Path A fragment EXACTLY:
    ```
    outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
    ```
    Delete the tokens `focus-visible:ring-2`, `focus-visible:ring-ring` (standalone, not `/50`), `focus-visible:ring-offset-2`, and `focus-visible:outline-none` from that chain. Insert the Path A fragment in the same position.

    **In `frontend/src/components/ui/badge.tsx`:**
    Replace the substring `focus-visible:ring-[3px]` with `focus-visible:ring-3` (drop the arbitrary-value bracket form). Keep `focus-visible:border-ring` and `focus-visible:ring-ring/50` untouched so the final utility reads:
    ```
    focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
    ```

    Do NOT modify any other class token in either file (disabled states, hover states, data-* variants, aria-invalid chains).
  </action>
  <verify>
    <automated>cd frontend && npm test -- --run src/components/ui</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'focus-visible:ring-\[3px\]' frontend/src/components/ui/badge.tsx` returns `0`.
    - `grep -c 'focus-visible:ring-3' frontend/src/components/ui/badge.tsx` returns `>= 1`.
    - `grep -c 'focus-visible:ring-offset-2' frontend/src/components/ui/checkbox.tsx` returns `0`.
    - `grep -c 'focus-visible:ring-2' frontend/src/components/ui/checkbox.tsx` returns `0`.
    - `grep -c 'focus-visible:ring-3' frontend/src/components/ui/checkbox.tsx` returns `>= 1`.
    - `grep -c 'focus-visible:ring-ring/50' frontend/src/components/ui/checkbox.tsx` returns `>= 1`.
    - `grep -c 'focus-visible:border-ring' frontend/src/components/ui/checkbox.tsx` returns `>= 1`.
    - `cd frontend && npm test -- --run src/components/ui` exits 0 (no primitive test regression).
  </acceptance_criteria>
  <done>
    Checkbox and Badge use the Path A focus-ring utility; no `ring-offset-2`, `ring-[3px]`, or `ring-2` remnants remain in either file; UI primitive test suite passes.
  </done>
</task>

</tasks>

<verification>
- `grep -rE 'focus-visible:ring-(offset-)?2\b' frontend/src/components/ui/` returns zero matches (Path B fully retired across ui/ primitives — Button/Input/Textarea/Select were always Path A; Checkbox now converged).
- `grep -c 'focus-visible:' frontend/src/components/ui/toggle.tsx` returns `>= 2` (was `0`).
- `cd frontend && npm test -- --run src/components/ui` exits 0.
</verification>

<success_criteria>
1. Toggle primitive shows a focus-visible ring when tabbed in the dev preview (manual confirm reserved for Plan 04 audit).
2. Every v1.19 primitive under `components/ui/` that renders a focusable control uses `focus-visible:ring-3 focus-visible:ring-ring/50` (the Path A pattern).
3. No focus-ring two-spec drift remains (grep check in verification above).
</success_criteria>

<output>
After completion, create `.planning/phases/59-a11y-parity-sweep/59-02-SUMMARY.md` using the summary template. Include a note: "Path A selected over CONTEXT.md D-04 Path B — rationale in plan objective; user may override by filing a follow-up to retrofit all 5 primitives."
</output>
