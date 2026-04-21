---
phase: 54-toggle-primitive-migrations
plan: 05
type: execute
wave: 2
depends_on: ["54-01"]
files_modified:
  - frontend/src/components/LanguageToggle.tsx
autonomous: true
requirements:
  - TOGGLE-02
must_haves:
  truths:
    - "The EN/DE language switch in the top header renders via the new Toggle primitive."
    - "Clicking or keyboard-activating the inactive segment switches i18next language between 'de' and 'en'."
    - "Language preference still persists via i18next's existing persistence (no new persistence layer introduced)."
    - "LanguageToggle no longer renders a raw `<button>` as its root."
    - "No new i18n keys are added; no existing keys renamed."
  artifacts:
    - path: "frontend/src/components/LanguageToggle.tsx"
      provides: "Language switch rendered via Toggle with DE/EN text segments"
      contains: "from \"@/components/ui/toggle\""
    - path: "frontend/src/components/LanguageToggle.tsx"
      provides: "Preserved i18next language-switch call"
      contains: "i18n.changeLanguage"
  key_links:
    - from: "frontend/src/components/LanguageToggle.tsx"
      to: "frontend/src/components/ui/toggle.tsx"
      via: "import { Toggle } from '@/components/ui/toggle'"
      pattern: "@/components/ui/toggle"
    - from: "frontend/src/components/LanguageToggle.tsx"
      to: "i18next language state"
      via: "i18n.changeLanguage(next) on Toggle onChange"
      pattern: "i18n\\.changeLanguage"
---

<objective>
Migrate `LanguageToggle` from a single `<button>` that shows the *target* language to a 2-segment `Toggle` that shows BOTH "DE" and "EN" with the current language as the active segment. Preserves the existing i18next-based language switch + persistence; only the visual layer changes (mirrors the D-11 pattern used for ThemeToggle in Plan 04). Closes TOGGLE-02.

Purpose: Fifth production call site for the Toggle primitive; the only text-label 2-segment Toggle in the top header. Addresses the checker blocker that TOGGLE-02 ("The EN/DE language switch in the top header uses the new Toggle") was previously uncovered.

Output: Updated `frontend/src/components/LanguageToggle.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
@frontend/src/components/LanguageToggle.tsx
@frontend/src/components/ui/toggle.tsx
@frontend/src/components/ui/segmented-control.tsx
@frontend/src/components/NavBar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap LanguageToggle JSX to 2-segment Toggle (DE/EN); preserve i18next switch logic</name>
  <files>frontend/src/components/LanguageToggle.tsx</files>
  <read_first>
    - frontend/src/components/LanguageToggle.tsx (current state — 22-line component with a single `<button>` that renders the *target* language label and calls `i18n.changeLanguage(target.toLowerCase())` on click)
    - frontend/src/components/ui/toggle.tsx (API created by Plan 01 — confirm Toggle export, 2-tuple segments requirement, and `onChange` signature)
    - frontend/src/components/ui/segmented-control.tsx (reference a11y pattern)
    - frontend/src/components/NavBar.tsx (confirms LanguageToggle is rendered inline in the header's right cluster — no prop changes, no parent wrapper changes expected)
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md § D-11 (mirrors the "preserve logic, swap visual layer only" pattern used for ThemeToggle)
    - .planning/REQUIREMENTS.md § TOGGLE-02
  </read_first>
  <action>
    Rewrite `frontend/src/components/LanguageToggle.tsx` as follows. The component's contract changes from "show the target language" to "show both languages with the current one active" — this is the whole point of switching to a Toggle primitive.

    ```tsx
    import { useTranslation } from "react-i18next";
    import { Toggle } from "@/components/ui/toggle";

    /**
     * NavBar language toggle — 2-segment Toggle showing DE and EN,
     * with the currently-active language highlighted. Click or keyboard-activate
     * the inactive segment to switch. Persists via i18next (no server round-trip).
     *
     * Phase 54 D-11 pattern: visual layer migrated to Toggle; language-switch
     * logic (i18n.changeLanguage) preserved verbatim. TOGGLE-02 acceptance.
     */
    type Language = "de" | "en";

    export function LanguageToggle() {
      const { i18n } = useTranslation();
      const current: Language = i18n.language === "de" ? "de" : "en";

      return (
        <Toggle<Language>
          segments={[
            { value: "de", label: "DE" },
            { value: "en", label: "EN" },
          ] as const}
          value={current}
          onChange={(next) => void i18n.changeLanguage(next)}
          aria-label="Language"
        />
      );
    }
    ```

    Key points (mirrors Plan 04 / D-11):
    - `i18n.changeLanguage(next)` is called byte-for-byte unchanged from the existing `i18n.changeLanguage(target.toLowerCase())` — the `onChange` callback receives `"de"` or `"en"` directly, so no `.toLowerCase()` is needed. Persistence is unchanged (i18next handles it internally; this file did not manage persistence before and does not manage it now).
    - Segment LABELS are the literal uppercase strings "DE" and "EN" — these are visual glyphs (language codes), not translatable copy. The previous component also hardcoded "DE"/"EN" as visual labels. **No new i18n keys are introduced** (per instructions and CONTEXT deferred: "Any new `toggle.*` i18n namespace — deferred").
    - `aria-label="Language"` is a hardcoded English string, consistent with the existing NavBar.tsx patterns (`aria-label="Navigation"` at line 104, `aria-label="Sign out"` at line 144). The previous component used a hardcoded English aria-label (`` `Switch language to ${target}` ``). This preserves the hardcoded-English aria-label approach — NOT a regression, a direct continuation.
    - `as const` on segments ensures Toggle's 2-tuple type requirement (D-03).
    - Keyboard navigation (ArrowLeft/Right/Up/Down, Enter/Space) is inherited from the Toggle primitive (D-06). No local handler needed.
    - The explicit `<Toggle<Language>` generic is required because `segments` uses the narrowed tuple `["de", "en"]` literal types; without the generic, TypeScript may widen `value` to `string`.
    - `void i18n.changeLanguage(next)` preserves the existing "fire and forget" pattern (the previous component used `void i18n.changeLanguage(target.toLowerCase())`).

    Do NOT:
    - Introduce ANY new i18n keys (no `language.toggle.aria_label`, no `toggle.language.de`, etc.). The previous component used raw strings for the target-language glyph and a hardcoded English aria-label; we preserve both.
    - Modify `NavBar.tsx` — LanguageToggle is consumed with no props (`<LanguageToggle />`) and that call site remains identical. Visual size differences (the new Toggle is wider than the old 1-letter button) may shift header spacing slightly; this is acceptable and a direct consequence of TOGGLE-02 (the whole point is that the user SEES both options now).
    - Add `dark:*` variants or hex colors (A11Y-03 guardrail inherited from Toggle primitive's token palette).
    - Change the `useTranslation` import (still needed for `i18n.language` read + `i18n.changeLanguage` call).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -q 'from "@/components/ui/toggle"' src/components/LanguageToggle.tsx && grep -q 'i18n.changeLanguage' src/components/LanguageToggle.tsx && grep -q '<Toggle' src/components/LanguageToggle.tsx && ! grep -q '<button' src/components/LanguageToggle.tsx && grep -q '"DE"' src/components/LanguageToggle.tsx && grep -q '"EN"' src/components/LanguageToggle.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/components/LanguageToggle.tsx` imports `Toggle` from `@/components/ui/toggle`.
    - File contains `<Toggle<Language>` (or `<Toggle` with the generic applied).
    - File contains both literal `"DE"` and literal `"EN"` as segment labels.
    - File retains literal `i18n.changeLanguage` (language-switch logic preserved).
    - File does NOT contain the string `<button` (no raw button remains; the Toggle's buttons are internal to that primitive).
    - File does NOT import from `@/components/ui/segmented-control` (LanguageToggle never used SegmentedControl and must not start now).
    - File does NOT contain `dark:` (A11Y-03 — no dark-variant classes; tokens inherited from Toggle).
    - File does NOT contain any hex color literal matching `#[0-9a-fA-F]{3,8}`.
    - File does NOT contain any new i18n key read (no `t("language.` or `t("toggle.` appears; `useTranslation` is used only for `i18n.language` and `i18n.changeLanguage`).
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npm run build` exits 0.
    - NavBar.tsx is unchanged (grep confirms `<LanguageToggle />` still the only call site and no other edits): `grep -c '<LanguageToggle' frontend/src/components/NavBar.tsx` returns `1`.
  </acceptance_criteria>
  <done>LanguageToggle renders a 2-segment Toggle with "DE" and "EN" labels. The active segment reflects `i18n.language`. Clicking or keyboard-activating the inactive segment calls `i18n.changeLanguage(next)`, which preserves the existing persistence path. No new i18n keys added; NavBar.tsx untouched; types compile; full build passes.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` exits 0.
- `cd frontend && npm run build` exits 0.
- `grep -n 'dark:' frontend/src/components/LanguageToggle.tsx` returns no matches (A11Y-03).
- `grep -n '#[0-9a-fA-F]\{3,8\}' frontend/src/components/LanguageToggle.tsx` returns no matches (no hex literals).
- Manual smoke (deferred to user): opening the app, clicking the "EN" segment when in DE switches the UI to English; reload persists the choice; keyboard ArrowRight/ArrowLeft on the DE segment also flips language.
</verification>

<success_criteria>
- TOGGLE-02 closed: the EN/DE language switch in the top header renders via the new `Toggle`.
- `i18n.changeLanguage` persistence path byte-for-byte preserved — only the visual layer changed.
- Zero new i18n keys added; no existing keys renamed.
- NavBar.tsx call site (`<LanguageToggle />`) unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/54-toggle-primitive-migrations/54-05-SUMMARY.md` using the summary template.
</output>
