---
phase: 59-a11y-parity-sweep
plan: 3
type: execute
wave: 2
depends_on:
  - 59-01-locale-parity-tooling
files_modified:
  - frontend/scripts/check-phase-59-guards.mts
  - frontend/package.json
autonomous: true
requirements:
  - A11Y-02
  - A11Y-03

must_haves:
  truths:
    - "A single `npm run check:phase-59` script fails CI on any of: locale parity drift, du-tone regression, hardcoded color literal in a .tsx className/style, icon-only Button missing aria-label."
    - "The color-literal scan scopes ONLY to `.tsx/.jsx` files (NOT `.css`) and allowlists `ColorPicker.tsx` per D-05 (Pitfall 4)."
    - "The aria-label scan covers `<Button size='icon*'>` patterns without aria-label per Pitfall 8."
  artifacts:
    - path: "frontend/scripts/check-phase-59-guards.mts"
      provides: "NEW — node fs walker enforcing (a) color-literal ban in .tsx/.jsx with ColorPicker allowlist, (b) icon-only Button missing aria-label."
    - path: "frontend/package.json"
      provides: "check:phase-59 upgraded to chain: parity → du-tone → phase-59-guards (replaces the Plan 01 two-script chain)."
  key_links:
    - from: "frontend/package.json scripts.check:phase-59"
      to: "check-phase-59-guards.mts"
      via: "npm run chain"
      pattern: "check-phase-59-guards.mts"
---

<objective>
Lock in two static-analysis gates for A11Y-02 (accessible names on icon-only controls) and A11Y-03 (zero hardcoded color literals on migrated surfaces), both expressed as a single new Node fs walker following the Phase 57 guard-runner template.

Purpose: Make A11Y-02 and A11Y-03 regression-proof. Any future PR that reintroduces a hex literal in a .tsx className or ships an icon-only Button without aria-label will fail `npm run check:phase-59`.
Output: One new script + one package.json wiring update that re-chains `check:phase-59` to include the guards.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/59-a11y-parity-sweep/59-CONTEXT.md
@.planning/phases/59-a11y-parity-sweep/59-RESEARCH.md
@frontend/scripts/check-phase-57-guards.mts

<interfaces>
<!-- Walker template to copy verbatim from Phase 57 -->

From frontend/scripts/check-phase-57-guards.mts (verified shipped):
```ts
// SCAN_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/
// SRC_ROOT = frontend/src
// SELF_PATH exempts the guard script itself
// walk(dir) recursively returns file paths matching SCAN_EXTS
// scan(...) reads each file, strips `// single-line comments` before pattern test,
//           emits Violation { guard, file, line, text }
// At end: if violations.length > 0 print each, exit 1; else exit 0 with "PHASE-57 GUARDS OK".
```

Baseline counts (verified 2026-04-22):
- Hex literals in `.tsx` (`#[0-9a-fA-F]{3,8}`): exactly 1 hit — `frontend/src/components/settings/ColorPicker.tsx` (allowlisted per D-05).
- `.hljs` hex literals in `frontend/src/index.css`: ~18 — OUT of scope (D-05 scope is `.tsx`/`.jsx` only; Pitfall 4).
- Known legitimate inline `style={{ gridTemplateColumns: ... }}` use exists — NOT a color literal; regex must distinguish.

Allowlist entry (required):
- `frontend/src/components/settings/ColorPicker.tsx` — renders user-chosen hex as preview swatch (D-05 acknowledged exception).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create check-phase-59-guards.mts with color-literal + icon-aria guards</name>
  <files>frontend/scripts/check-phase-59-guards.mts</files>
  <read_first>
    - frontend/scripts/check-phase-57-guards.mts (full file — copy walker/scan/SELF_PATH/Violation pattern)
    - frontend/src/components/settings/ColorPicker.tsx (confirm the hex literal is in className/style context so the allowlist by path is correct)
    - .planning/phases/59-a11y-parity-sweep/59-CONTEXT.md §D-05 (color-literal policy) and §D-01 (scope)
    - .planning/phases/59-a11y-parity-sweep/59-RESEARCH.md §Common Pitfalls (4, 8)
  </read_first>
  <action>
    Create `frontend/scripts/check-phase-59-guards.mts` that mirrors the structure of `check-phase-57-guards.mts` but enforces two Phase-59 invariants. Use this exact skeleton (fill in the walker/scan helpers identically to Phase 57):

    ```ts
    // Phase 59 CI grep guards — A11Y-02 + A11Y-03 lock-in.
    //
    // Exits 0 with "PHASE-59 GUARDS OK" when every invariant holds.
    // Exits 1 and prints file:line per violation.
    //
    // Invariants enforced:
    //   1. No hex/rgb/hsl/oklch/oklab color literal inside className= or className={`...`}
    //      or inside inline style={{...}} in .tsx/.jsx. Allowlist:
    //        - frontend/src/components/settings/ColorPicker.tsx (D-05 user-chosen swatch)
    //   2. <Button ... size="icon" | "icon-xs" | "icon-sm" | "icon-lg"> that lacks an
    //      aria-label attribute on the SAME element. (Pitfall 8)
    //
    // Scope: frontend/src recursively, extensions .ts|.tsx|.js|.jsx|.mjs|.cjs.
    // Scope EXPLICITLY EXCLUDES .css files — Pitfall 4. The hljs hex literals in
    // index.css are syntax-highlighting theme colors, not component style.

    import { readFileSync, readdirSync, statSync } from "node:fs";
    import { join, resolve } from "node:path";

    const repoRoot = resolve(import.meta.dirname, "..", "..");
    const SRC_ROOT = resolve(repoRoot, "frontend/src");
    const SCAN_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
    const SELF_PATH = resolve(import.meta.filename);

    const COLOR_LITERAL_ALLOWLIST = new Set<string>([
      resolve(repoRoot, "frontend/src/components/settings/ColorPicker.tsx"),
    ]);

    // Hex 3-8 digits, or css color functions. Named colors (red/blue/…) would
    // produce too many false-positives in prose so we deliberately skip them —
    // D-05's spirit is about static surface colors, and hex/rgb/hsl captures all
    // the real risks.
    const HEX = /#[0-9a-fA-F]{3,8}\b/;
    const COLOR_FN = /\b(rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/;

    // Only flag when the literal sits inside a className or style context. We
    // approximate by requiring the line also contains `className` or `style=` or
    // is inside a string assigned to one of those (catches both inline
    // `className="…#fff…"` and `style={{ color: "#fff" }}`).
    const CONTEXT_HINT = /className\s*=|style\s*=\s*\{\{/;

    // Button icon-size without aria-label on the same tag.
    // Match opening <Button … size={"icon(-xs|-sm|-lg)?"} … > and require aria-label
    // to appear before the closing `>`. Multiline-safe via dotall substitution on
    // the captured span.
    const BUTTON_ICON = /<Button\b[^>]*\bsize\s*=\s*\{?\s*["'](icon(?:-xs|-sm|-lg)?)["']\s*\}?[^>]*>/g;

    interface Violation { guard: string; file: string; line: number; text: string; }
    const violations: Violation[] = [];

    function walk(dir: string): string[] {
      const out: string[] = [];
      let entries: string[];
      try { entries = readdirSync(dir); } catch { return out; }
      for (const entry of entries) {
        const p = join(dir, entry);
        const s = statSync(p);
        if (s.isDirectory()) out.push(...walk(p));
        else if (SCAN_EXTS.test(p)) out.push(p);
      }
      return out;
    }

    function stripLineComment(line: string): string {
      // Same heuristic as Phase 57 — strip `// …` tail but preserve strings.
      // Simple: only strip when `//` occurs outside a string quote count.
      const idx = line.indexOf("//");
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      const dq = (before.match(/"/g) || []).length;
      const sq = (before.match(/'/g) || []).length;
      const bt = (before.match(/`/g) || []).length;
      if (dq % 2 === 0 && sq % 2 === 0 && bt % 2 === 0) return before;
      return line;
    }

    for (const file of walk(SRC_ROOT)) {
      if (file === SELF_PATH) continue;
      const src = readFileSync(file, "utf8");

      // Guard 1: color literals
      if (!COLOR_LITERAL_ALLOWLIST.has(file)) {
        const lines = src.split("\n");
        lines.forEach((raw, i) => {
          const line = stripLineComment(raw);
          if ((HEX.test(line) || COLOR_FN.test(line)) && CONTEXT_HINT.test(line)) {
            violations.push({
              guard: "color-literal",
              file, line: i + 1, text: raw.trim(),
            });
          }
        });
      }

      // Guard 2: icon-size Button missing aria-label on the same element.
      // We scan the whole file text with the regex; for each match check whether
      // aria-label is present in the captured opening tag.
      let m: RegExpExecArray | null;
      BUTTON_ICON.lastIndex = 0;
      while ((m = BUTTON_ICON.exec(src)) !== null) {
        const tag = m[0];
        if (!/\baria-label\s*=/.test(tag)) {
          // Derive line number
          const pre = src.slice(0, m.index);
          const line = pre.split("\n").length;
          violations.push({
            guard: "icon-button-aria-label",
            file, line, text: tag.slice(0, 120),
          });
        }
      }
    }

    if (violations.length === 0) {
      console.log("PHASE-59 GUARDS OK");
      process.exit(0);
    }
    for (const v of violations) {
      console.log(`[${v.guard}] ${v.file}:${v.line}  ${v.text}`);
    }
    console.log(`PHASE-59 GUARDS FAIL: ${violations.length} violation(s)`);
    process.exit(1);
    ```

    Implementation constraints:
    - MUST exclude `.css` files (Pitfall 4). SCAN_EXTS regex does this — do NOT add `|css`.
    - MUST allowlist `frontend/src/components/settings/ColorPicker.tsx` by absolute path.
    - MUST skip the script itself via SELF_PATH.
    - MUST use the Phase 57 walker pattern (Node fs, no external shell).
    - If running the script against current repo produces any non-allowlisted violation, the current codebase itself has a real A11Y-02/03 finding — DO NOT silence by adding to the allowlist. Instead, STOP and surface as a Plan-04 manual-audit input. (This is unlikely per RESEARCH baseline: 1 hex hit = ColorPicker = allowlisted; icon-Button aria-label baseline already widely covered.)
  </action>
  <verify>
    <automated>cd frontend && node --experimental-strip-types scripts/check-phase-59-guards.mts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `frontend/scripts/check-phase-59-guards.mts`.
    - `grep -c 'COLOR_LITERAL_ALLOWLIST' frontend/scripts/check-phase-59-guards.mts` returns `>= 1`.
    - `grep -c 'ColorPicker.tsx' frontend/scripts/check-phase-59-guards.mts` returns `>= 1`.
    - `grep -c 'icon-button-aria-label' frontend/scripts/check-phase-59-guards.mts` returns `>= 1`.
    - `grep -c 'SCAN_EXTS' frontend/scripts/check-phase-59-guards.mts` returns `>= 1` and the regex does NOT include `css`: `grep -c 'SCAN_EXTS = /\\\\.(ts|tsx|js|jsx|mjs|cjs)\\$/' frontend/scripts/check-phase-59-guards.mts` returns `1`.
    - Running `cd frontend && node --experimental-strip-types scripts/check-phase-59-guards.mts` exits `0` and stdout ends with `PHASE-59 GUARDS OK`.
    - If exit is non-zero, executor halts and does NOT add new allowlist entries — real findings are Plan-04 inputs.
  </acceptance_criteria>
  <done>
    Script exists, scans `.tsx/.jsx` only, allowlists ColorPicker, enforces both invariants, exits 0 against current repo, prints PHASE-59 GUARDS OK.
  </done>
</task>

<task type="auto">
  <name>Task 2: Chain check-phase-59-guards into the check:phase-59 npm script</name>
  <files>frontend/package.json</files>
  <read_first>
    - frontend/package.json (read current scripts block — Plan 01 added check:i18n-parity, check:i18n-du-tone, check:phase-59)
  </read_first>
  <action>
    Edit `frontend/package.json`. Find the existing script entry (added by Plan 59-01):
    ```json
    "check:phase-59": "npm run check:i18n-parity && npm run check:i18n-du-tone"
    ```

    Replace its VALUE (keep the key name) with:
    ```json
    "check:phase-59": "npm run check:i18n-parity && npm run check:i18n-du-tone && node --experimental-strip-types scripts/check-phase-59-guards.mts"
    ```

    Also add a dedicated alias entry immediately before `check:phase-59` for individual invocation:
    ```json
    "check:phase-59-guards": "node --experimental-strip-types scripts/check-phase-59-guards.mts",
    ```

    Rules:
    - Keep JSON valid (comma hygiene — `check:phase-59-guards` ends in `,`; `check:phase-59` stays last, no trailing comma).
    - Do NOT touch existing scripts (`dev`, `build`, `test`, `check:signage`, `check:player-*`, `check:phase-57`, `check:i18n-parity`, `check:i18n-du-tone`).
  </action>
  <verify>
    <automated>cd frontend && npm run check:phase-59</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '"check:phase-59-guards":' frontend/package.json` returns `1`.
    - `grep -c 'check-phase-59-guards.mts' frontend/package.json` returns `>= 2` (in both the alias and the chained check:phase-59 entry).
    - `grep -c '"check:phase-59":' frontend/package.json` returns `1` (no accidental duplicate).
    - `cd frontend && npm run check:phase-59-guards` exits `0` and prints `PHASE-59 GUARDS OK`.
    - `cd frontend && npm run check:phase-59` exits `0` and prints (in order) `PARITY OK`, `DU_TONE OK`, `PHASE-59 GUARDS OK`.
    - `cd frontend && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits `0` (valid JSON).
    - `cd frontend && npm run check:phase-57` still exits 0 (unbroken).
  </acceptance_criteria>
  <done>
    check:phase-59 now chains parity → du-tone → phase-59-guards; individual alias check:phase-59-guards exists; existing scripts unbroken; package.json is valid JSON.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npm run check:phase-59` exits 0 and prints three OK banners in sequence.
- `grep -c 'SCAN_EXTS = /\\\\.(ts|tsx|js|jsx|mjs|cjs)\\$/' frontend/scripts/check-phase-59-guards.mts` returns 1 (no `.css` scope leak).
- No existing check:* npm script is broken.
</verification>

<success_criteria>
1. A PR adding `className="bg-[#ff0000]"` to any non-ColorPicker .tsx file fails `npm run check:phase-59`.
2. A PR adding `<Button size="icon"><Icon /></Button>` without an `aria-label` fails `npm run check:phase-59`.
3. The guard does NOT flag `.hljs` hex literals in `frontend/src/index.css` (Pitfall 4 protection holds).
</success_criteria>

<output>
After completion, create `.planning/phases/59-a11y-parity-sweep/59-03-SUMMARY.md` using the summary template.
</output>
