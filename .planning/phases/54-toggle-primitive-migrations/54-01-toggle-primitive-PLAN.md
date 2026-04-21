---
phase: 54-toggle-primitive-migrations
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/toggle.tsx
  - frontend/src/components/ui/toggle.test.tsx
autonomous: true
requirements:
  - TOGGLE-01
  - TOGGLE-05
must_haves:
  truths:
    - "A pill-shaped Toggle component exists at frontend/src/components/ui/toggle.tsx with an animated indicator that slides under the active label."
    - "Toggle exposes role=radiogroup with two role=radio children, each carrying aria-checked."
    - "Keyboard users can move selection with Left/Up/Right/Down (wrapping) and reactivate with Enter/Space."
    - "When prefers-reduced-motion: reduce matches, the indicator swaps instantly with no translateX transition."
    - "Type/runtime constraint enforces exactly two segments."
  artifacts:
    - path: "frontend/src/components/ui/toggle.tsx"
      provides: "Toggle primitive component"
      contains: 'role="radiogroup"'
    - path: "frontend/src/components/ui/toggle.tsx"
      provides: "Reduced-motion branch"
      contains: "prefers-reduced-motion"
    - path: "frontend/src/components/ui/toggle.test.tsx"
      provides: "Unit tests for render + keyboard"
      contains: "describe"
  key_links:
    - from: "frontend/src/components/ui/toggle.tsx"
      to: "Tailwind token palette (bg-primary, text-primary-foreground, bg-background, border-primary)"
      via: "className composition (no dark: variants, no hardcoded colors)"
      pattern: "bg-primary|text-primary-foreground|bg-background|border-primary"
---

<objective>
Create the pill-shape `Toggle` primitive with an animated sliding indicator, radiogroup a11y, full keyboard navigation, and a `prefers-reduced-motion` fallback. Ship with unit tests covering render + keyboard interaction.

Purpose: Provides the single 2-option primitive that every subsequent migration (Plans 02, 03, 04) will consume. TOGGLE-01 (pill + animated indicator) and TOGGLE-05 (reduced-motion + keyboard + radiogroup) fully close here; TOGGLE-02/03/04 partially close at creation and fully close as migrations land.

Output: `frontend/src/components/ui/toggle.tsx` + `frontend/src/components/ui/toggle.test.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
@frontend/src/components/ui/segmented-control.tsx
@frontend/src/signage/components/UptimeBadge.test.tsx

<interfaces>
<!-- Reference pattern from segmented-control.tsx that Toggle's API mirrors -->

From frontend/src/components/ui/segmented-control.tsx:
```ts
interface SegmentedControlProps<T extends string> {
  segments: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
  className?: string;
}
```

Target Toggle contract (per CONTEXT D-02):
```ts
export interface ToggleSegment<T extends string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
}

export interface ToggleProps<T extends string> {
  // Exactly 2 segments enforced at type + runtime level (D-03)
  segments: readonly [ToggleSegment<T>, ToggleSegment<T>];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
  className?: string;
}

export function Toggle<T extends string>(props: ToggleProps<T>): JSX.Element;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Toggle primitive with animated indicator, radiogroup a11y, keyboard nav, reduced-motion fallback</name>
  <files>frontend/src/components/ui/toggle.tsx</files>
  <read_first>
    - frontend/src/components/ui/segmented-control.tsx (reference API + a11y pattern to mirror per D-02/D-06/D-07)
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md (locked decisions D-01..D-12)
    - .planning/REQUIREMENTS.md § TOGGLE-01, TOGGLE-05
  </read_first>
  <behavior>
    - Renders an outer `div[role="radiogroup"]` with two `button[role="radio"][aria-checked]` children.
    - Container pill class: `relative inline-flex items-center bg-background border border-primary rounded-full p-1 gap-0`.
    - Renders a sibling indicator element (`<span aria-hidden="true">`) absolutely positioned inside the pill with class: `absolute top-1 left-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-primary` (50% width minus the container's `p-1` padding on each side).
    - Indicator uses inline style `style={{ transform: activeIndex === 0 ? 'translateX(0)' : 'translateX(100%)', transition: reducedMotion ? 'none' : 'transform 180ms ease-out' }}`.
    - Reduced-motion detection via `window.matchMedia('(prefers-reduced-motion: reduce)')` with `useEffect` + `addEventListener('change', ...)` so toggling the OS preference at runtime updates the component.
    - Each segment button: equal-width `flex-1 relative z-10 rounded-full h-6 px-3 text-sm transition-colors inline-flex items-center justify-center gap-2`, active: `text-primary-foreground font-medium`, inactive: `text-muted-foreground font-normal hover:text-foreground`. No `bg-*` on the button itself — the indicator provides the active background.
    - Segment content: renders `segment.icon` (if provided) followed by `segment.label` (if provided). Both missing → throw at runtime.
    - Keyboard handler on each button: ArrowLeft/ArrowUp → select previous (wrap from index 0 to 1); ArrowRight/ArrowDown → select next (wrap from 1 to 0); Enter/Space → reactivate current (calls onChange with the focused segment's value). Selection follows focus (standard radiogroup per D-06). `e.preventDefault()` on arrows to stop page scroll.
    - After arrow navigation, focus moves to the newly selected button (`buttonRefs[newIndex].current?.focus()`).
    - Runtime assert: `if (segments.length !== 2) throw new Error('Toggle requires exactly 2 segments; use SegmentedControl for 3+ options.')`. Type-level: `segments: readonly [ToggleSegment<T>, ToggleSegment<T>]`.
    - Disabled: container gets `opacity-50 pointer-events-none` and `aria-disabled="true"` (mirrors segmented-control.tsx).
    - No `dark:` variants anywhere — all color comes from CSS variable-backed tokens (bg-primary, text-primary-foreground, bg-background, border-primary, text-muted-foreground, text-foreground). A11Y-03 guardrail.
  </behavior>
  <action>
    Create `frontend/src/components/ui/toggle.tsx` with the exact contract from `<interfaces>` above. Implementation notes:

    1. Imports: `import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";`
    2. Export types `ToggleSegment<T>` and `ToggleProps<T>` alongside the component.
    3. `const activeIndex = segments.findIndex(s => s.value === value);` — if `activeIndex === -1`, fall back to `0` (do not throw; matches SegmentedControl behavior).
    4. `usePrefersReducedMotion()` inline hook:
       ```ts
       const [reducedMotion, setReducedMotion] = useState(() =>
         typeof window !== 'undefined'
           && window.matchMedia('(prefers-reduced-motion: reduce)').matches
       );
       useEffect(() => {
         const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
         const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
         mql.addEventListener('change', onChange);
         return () => mql.removeEventListener('change', onChange);
       }, []);
       ```
    5. `const buttonRefs = useRef<Array<HTMLButtonElement | null>>([null, null]);`
    6. `handleKey(idx, e)`:
       ```ts
       if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
         e.preventDefault();
         const next = idx === 0 ? 1 : 0;
         onChange(segments[next].value);
         buttonRefs.current[next]?.focus();
       } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
         e.preventDefault();
         const next = idx === 1 ? 0 : 1;
         onChange(segments[next].value);
         buttonRefs.current[next]?.focus();
       } else if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         onChange(segments[idx].value);
       }
       ```
    7. Container JSX:
       ```tsx
       <div
         role="radiogroup"
         aria-label={ariaLabel}
         aria-disabled={disabled ? "true" : undefined}
         title={title}
         className={`relative inline-flex items-center bg-background border border-primary rounded-full p-1 gap-0${disabled ? " opacity-50 pointer-events-none" : ""}${extraClassName ? ` ${extraClassName}` : ""}`}
       >
         <span
           aria-hidden="true"
           className="absolute top-1 left-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-primary"
           style={{
             transform: activeIndex === 0 ? 'translateX(0)' : 'translateX(100%)',
             transition: reducedMotion ? 'none' : 'transform 180ms ease-out',
           }}
         />
         {segments.map((segment, i) => { /* button */ })}
       </div>
       ```
    8. Button JSX (per segment):
       ```tsx
       <button
         key={segment.value}
         ref={(el) => { buttonRefs.current[i] = el; }}
         type="button"
         role="radio"
         aria-checked={i === activeIndex}
         tabIndex={i === activeIndex ? 0 : -1}
         onClick={() => onChange(segment.value)}
         onKeyDown={(e) => handleKey(i, e)}
         className={
           i === activeIndex
             ? "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 transition-colors"
             : "flex-1 relative z-10 rounded-full h-6 px-3 text-sm font-normal text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2 transition-colors"
         }
       >
         {segment.icon}
         {segment.label}
       </button>
       ```
    9. `export { Toggle };` and `export type { ToggleProps, ToggleSegment };`.

    Reference CONTEXT D-01 through D-07 throughout. Do NOT add any `dark:*` classes (A11Y-03).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -q 'role="radiogroup"' src/components/ui/toggle.tsx && grep -q 'prefers-reduced-motion' src/components/ui/toggle.tsx && grep -q 'translateX' src/components/ui/toggle.tsx && ! grep -q 'dark:' src/components/ui/toggle.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/ui/toggle.tsx` exists.
    - File contains literal `role="radiogroup"`.
    - File contains literal `role="radio"`.
    - File contains literal `aria-checked`.
    - File contains literal `prefers-reduced-motion`.
    - File contains literal `translateX`.
    - File contains literal `180ms`.
    - File contains literal `bg-primary` and `text-primary-foreground` and `bg-background` and `border-primary`.
    - File exports `Toggle` (named export) and type `ToggleProps`.
    - File does NOT contain the string `dark:` (no dark variants, tokens only — A11Y-03).
    - File does NOT contain any hex color literal matching `#[0-9a-fA-F]{3,8}`.
    - `segments` type is a 2-tuple: grep matches `readonly \[ToggleSegment` in the file.
    - Runtime assert present: grep matches `segments.length !== 2`.
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>Toggle primitive file exists, compiles, is token-driven, exposes radiogroup semantics, animates via translateX with a reduced-motion fallback, and enforces exactly 2 segments at the type + runtime level.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests — render, aria, keyboard nav, reduced-motion, two-segment assert</name>
  <files>frontend/src/components/ui/toggle.test.tsx</files>
  <read_first>
    - frontend/src/components/ui/toggle.tsx (file created by Task 1 — read current state before asserting against it)
    - frontend/src/signage/components/UptimeBadge.test.tsx (reference for vitest + @testing-library pattern already in use)
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
  </read_first>
  <behavior>
    - Test 1 (render): `Toggle` with two segments renders a container with `role="radiogroup"` and two elements with `role="radio"`, the active one has `aria-checked="true"`.
    - Test 2 (click): clicking the inactive segment calls `onChange` with that segment's value.
    - Test 3 (keyboard ArrowRight): pressing ArrowRight on the active (index 0) segment calls `onChange` with segment[1].value (selection follows focus, wrap).
    - Test 4 (keyboard ArrowLeft wrap): pressing ArrowLeft on the active (index 0) segment calls `onChange` with segment[1].value (wrap 0 → 1).
    - Test 5 (Enter reactivates): pressing Enter on the active segment calls `onChange` with the current value.
    - Test 6 (reduced-motion): when `matchMedia('(prefers-reduced-motion: reduce)').matches === true`, the indicator element has inline `transition: none` style.
    - Test 7 (two-segment assert): passing 1 or 3 segments throws a runtime error matching `/exactly 2 segments/`.
    - Test 8 (icon rendering): a segment with `icon` renders the icon node inside the button.
  </behavior>
  <action>
    Create `frontend/src/components/ui/toggle.test.tsx` using vitest + @testing-library/react (already configured per `frontend/vitest.config.ts` and used in `frontend/src/signage/components/UptimeBadge.test.tsx`).

    Test file skeleton:

    ```tsx
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { render, screen, fireEvent } from "@testing-library/react";
    import { Toggle } from "./toggle";

    function setupMatchMedia(reduced: boolean) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("prefers-reduced-motion") ? reduced : false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    beforeEach(() => setupMatchMedia(false));

    describe("Toggle", () => {
      const segs = [
        { value: "a" as const, label: "A" },
        { value: "b" as const, label: "B" },
      ] as const;

      it("renders radiogroup with two radios and correct aria-checked", () => {
        render(<Toggle segments={segs} value="a" onChange={() => {}} aria-label="test" />);
        expect(screen.getByRole("radiogroup")).toBeInTheDocument();
        const radios = screen.getAllByRole("radio");
        expect(radios).toHaveLength(2);
        expect(radios[0]).toHaveAttribute("aria-checked", "true");
        expect(radios[1]).toHaveAttribute("aria-checked", "false");
      });

      it("calls onChange when inactive segment is clicked", () => {
        const onChange = vi.fn();
        render(<Toggle segments={segs} value="a" onChange={onChange} aria-label="t" />);
        fireEvent.click(screen.getAllByRole("radio")[1]);
        expect(onChange).toHaveBeenCalledWith("b");
      });

      it("ArrowRight moves selection to next segment", () => {
        const onChange = vi.fn();
        render(<Toggle segments={segs} value="a" onChange={onChange} aria-label="t" />);
        fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "ArrowRight" });
        expect(onChange).toHaveBeenCalledWith("b");
      });

      it("ArrowLeft wraps from index 0 to index 1", () => {
        const onChange = vi.fn();
        render(<Toggle segments={segs} value="a" onChange={onChange} aria-label="t" />);
        fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "ArrowLeft" });
        expect(onChange).toHaveBeenCalledWith("b");
      });

      it("Enter reactivates the focused segment", () => {
        const onChange = vi.fn();
        render(<Toggle segments={segs} value="a" onChange={onChange} aria-label="t" />);
        fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("a");
      });

      it("honors prefers-reduced-motion by disabling indicator transition", () => {
        setupMatchMedia(true);
        const { container } = render(
          <Toggle segments={segs} value="a" onChange={() => {}} aria-label="t" />
        );
        const indicator = container.querySelector('[aria-hidden="true"]') as HTMLElement;
        expect(indicator).not.toBeNull();
        expect(indicator.style.transition).toBe("none");
      });

      it("throws when not exactly 2 segments", () => {
        // Suppress React's error boundary noise during this test
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => {
          // @ts-expect-error deliberate bad input for runtime assert
          render(<Toggle segments={[segs[0]]} value="a" onChange={() => {}} />);
        }).toThrow(/exactly 2 segments/);
        spy.mockRestore();
      });

      it("renders segment icon when provided", () => {
        const segsWithIcon = [
          { value: "x" as const, icon: <svg data-testid="icon-x" /> },
          { value: "y" as const, icon: <svg data-testid="icon-y" /> },
        ] as const;
        render(<Toggle segments={segsWithIcon} value="x" onChange={() => {}} aria-label="t" />);
        expect(screen.getByTestId("icon-x")).toBeInTheDocument();
        expect(screen.getByTestId("icon-y")).toBeInTheDocument();
      });
    });
    ```

    Run `cd frontend && npx vitest run src/components/ui/toggle.test.tsx` — all 8 tests must pass.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/ui/toggle.test.tsx --reporter=default</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/ui/toggle.test.tsx` exists.
    - `cd frontend && npx vitest run src/components/ui/toggle.test.tsx` exits 0 with 8 passing tests.
    - Test file references `prefers-reduced-motion` (grep).
    - Test file asserts on `role="radiogroup"` and `role="radio"` (grep for `"radiogroup"` and `"radio"`).
    - Test file asserts on `ArrowRight` and `ArrowLeft` and `Enter` keyboard events (grep).
    - Test file includes a runtime-assert test for the 2-segment constraint (grep for `exactly 2 segments`).
  </acceptance_criteria>
  <done>Toggle unit test file runs 8 passing tests covering render, aria, click, keyboard (ArrowLeft/Right/Enter + wrap), reduced-motion, 2-segment assert, and icon rendering.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` exits 0 (no type errors introduced).
- `cd frontend && npx vitest run src/components/ui/toggle.test.tsx` passes all tests.
- `grep -n 'dark:' frontend/src/components/ui/toggle.tsx` returns no matches (A11Y-03 guardrail).
- `grep -n '#[0-9a-fA-F]\{3,8\}' frontend/src/components/ui/toggle.tsx` returns no matches (no hardcoded color literals).
- `grep -n 'prefers-reduced-motion' frontend/src/components/ui/toggle.tsx` returns at least 1 match (TOGGLE-05).
</verification>

<success_criteria>
- Toggle primitive file + test file both exist.
- TypeScript compiles; 8 tests pass.
- Radiogroup + radio + aria-checked semantics in place.
- Sliding indicator implemented via CSS `transform: translateX(...)` with 180ms ease-out transition.
- `prefers-reduced-motion: reduce` disables the transition at runtime.
- Exactly-2-segments constraint enforced at type and runtime level.
- No `dark:` variants, no hardcoded color literals — all tokens.
- Downstream migrations (Plans 02, 03, 04) can `import { Toggle } from "@/components/ui/toggle"` and use the same prop shape as SegmentedControl with an optional `icon` on each segment.
</success_criteria>

<output>
After completion, create `.planning/phases/54-toggle-primitive-migrations/54-01-SUMMARY.md` using the summary template.
</output>
