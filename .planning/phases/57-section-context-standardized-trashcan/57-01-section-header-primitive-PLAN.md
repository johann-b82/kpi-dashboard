---
phase: 57-section-context-standardized-trashcan
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/section-header.tsx
  - frontend/src/components/ui/__tests__/section-header.test.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01]

must_haves:
  truths:
    - "SectionHeader primitive exists under components/ui/ and renders an h2 title + p description"
    - "Primitive attaches lang={i18n.language} on description for browser hyphenation"
    - "Primitive renders nothing when title is empty (null-safety)"
    - "Primitive carries no dark: variants and no hardcoded colors"
  artifacts:
    - path: "frontend/src/components/ui/section-header.tsx"
      provides: "SectionHeader component (title, description, className, children never)"
      contains: "export function SectionHeader"
    - path: "frontend/src/components/ui/__tests__/section-header.test.tsx"
      provides: "unit tests for SectionHeader shape + null-handling + lang attribute"
      contains: "describe(\"SectionHeader\""
  key_links:
    - from: "frontend/src/components/ui/section-header.tsx"
      to: "react-i18next useTranslation"
      via: "i18n.language on <p lang=...>"
      pattern: "useTranslation|i18n\\.language"
---

<objective>
Extract the Playlist-editor heading+description pattern into a reusable
`SectionHeader` primitive under `components/ui/`. Pure, non-interactive,
null-safe. Harmonizes to `font-medium` per UI-SPEC typography contract
(not `font-semibold`).

Purpose: Every admin section will consume this primitive (Wave B) to satisfy
SECTION-01. Ship the primitive first so Wave B migrations are drop-in.
Output: One new primitive file + one test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-CONTEXT.md
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/signage/pages/PlaylistEditorPage.tsx
@frontend/src/components/ui/toggle.tsx

<interfaces>
<!-- SOTT pattern to standardize (PlaylistEditorPage.tsx:330-336) -->
```tsx
<section>
  <h2 className="text-base font-semibold">{t("…preview_title")}</h2>
  <p className="text-xs text-muted-foreground mb-2" lang={i18n.language}>{t("…preview_help")}</p>
</section>
```

<!-- Primitive contract (per UI-SPEC §Interaction Contract) -->
```ts
interface SectionHeaderProps {
  title: string;
  description: string;
  className?: string;
  children?: never;
}
```

<!-- Rhythm per UI-SPEC §SectionHeader rhythm: wrapper mb-6, mt-1 between h2/p -->
<!-- Harmonization: font-semibold -> font-medium (per UI-SPEC Typography) -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for SectionHeader</name>
  <files>frontend/src/components/ui/__tests__/section-header.test.tsx</files>
  <behavior>
    - Test 1: renders h2 with title text and font-medium class
    - Test 2: renders p with description text and text-muted-foreground + text-xs
    - Test 3: p carries lang attribute matching i18n.language
    - Test 4: returns null when title is empty string
    - Test 5: applies consumer className to wrapper section
    - Test 6: does not render dark: variants (sanity — source file grep would catch; test asserts classList has no 'dark:' literal)
  </behavior>
  <action>
    Create frontend/src/components/ui/__tests__/section-header.test.tsx.

    Use vitest + @testing-library/react (already configured from Phase 55 — see
    vitest.config.ts). Wrap render in an I18nextProvider using the project's
    test-utils pattern (mirror any existing ui/__tests__ test for setup; if none
    exists, inline a minimal i18next init with resources={en:{translation:{}}}
    and i18n.language='en').

    Import: `import { SectionHeader } from "@/components/ui/section-header"`.

    Run `npm --prefix frontend test -- section-header` — tests MUST fail
    (module not found / no export) to confirm RED.

    Commit: `test(57-01): add failing tests for SectionHeader primitive`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- section-header 2>&1 | grep -E "FAIL|Cannot find module"</automated>
  </verify>
  <done>Test file exists; `npm test -- section-header` fails because the primitive module is not yet exported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement SectionHeader primitive (GREEN)</name>
  <files>frontend/src/components/ui/section-header.tsx</files>
  <action>
    Create the primitive per UI-SPEC §Interaction Contract + §Typography:

    ```tsx
    import { useTranslation } from "react-i18next";
    import { cn } from "@/lib/utils";

    interface SectionHeaderProps {
      title: string;
      description: string;
      className?: string;
      children?: never;
    }

    export function SectionHeader({ title, description, className }: SectionHeaderProps) {
      const { i18n } = useTranslation();
      if (!title) return null;
      return (
        <section className={cn("mb-6", className)}>
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground" lang={i18n.language}>
            {description}
          </p>
        </section>
      );
    }
    ```

    Key points (per D-03 + UI-SPEC):
    - `font-medium` NOT `font-semibold` (harmonization from Playlist-editor SOTT)
    - `mb-6` wrapper, `mt-1` title→description rhythm
    - `lang={i18n.language}` for browser hyphenation
    - Non-interactive; `children?: never` (type-level block on children)
    - Null-return when title is empty
    - Zero `dark:` variants, all colors via tokens (--foreground, --muted-foreground)

    Confirm `cn` import path matches project (check frontend/src/components/ui/toggle.tsx
    for canonical import style).

    Run `npm --prefix frontend test -- section-header` — all tests MUST pass (GREEN).

    Commit: `feat(57-01): implement SectionHeader primitive`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- section-header</automated>
  </verify>
  <done>
    - All 6 tests pass (GREEN)
    - `rg "dark:" frontend/src/components/ui/section-header.tsx` returns 0 matches
    - `rg "font-semibold" frontend/src/components/ui/section-header.tsx` returns 0 matches (harmonization)
    - `rg "font-medium" frontend/src/components/ui/section-header.tsx` returns 1 match
  </done>
</task>

</tasks>

<verification>
- SectionHeader primitive exists and is consumable via `@/components/ui/section-header`
- No dark: variants; all colors token-driven
- font-medium harmonization applied (not font-semibold)
- Unit tests green
</verification>

<success_criteria>
1. `frontend/src/components/ui/section-header.tsx` exists, exports `SectionHeader`
2. `npm --prefix frontend test -- section-header` passes
3. `rg "dark:" frontend/src/components/ui/section-header.tsx` → 0 matches
4. Tests cover: h2 render, p render, lang attribute, null-on-empty-title, className pass-through
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-01-SUMMARY.md`
</output>
