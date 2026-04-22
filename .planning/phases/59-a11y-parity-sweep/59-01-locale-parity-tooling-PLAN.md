---
phase: 59-a11y-parity-sweep
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/scripts/check-locale-parity.mts
  - frontend/scripts/check-de-du-tone.mts
  - frontend/package.json
autonomous: true
requirements:
  - A11Y-01

must_haves:
  truths:
    - "CI fails the build on any DE/EN key-count drift via a named npm script (D-02)."
    - "A du-tone lint heuristic exists that flags formal-German tokens (Sie/Ihnen/Ihre/Ihr) in de.json values and prints file:key:value for human review (D-03)."
    - "Both gates are reachable as discrete npm scripts and are also chained through the existing check-phase-57-guards runner."
  artifacts:
    - path: "frontend/scripts/check-locale-parity.mts"
      provides: "Flat-key parity gate (exists, extended with exit-0 banner unchanged)."
    - path: "frontend/scripts/check-de-du-tone.mts"
      provides: "NEW — du-tone lint; case-sensitive /\\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\\b/ scan over de.json values with allowlist for pre-v1.19 hits."
    - path: "frontend/package.json"
      provides: "New scripts: check:i18n-parity, check:i18n-du-tone, check:phase-59 (unions both)."
  key_links:
    - from: "frontend/package.json scripts.check:phase-59"
      to: "check:i18n-parity && check:i18n-du-tone"
      via: "npm run chain"
      pattern: "check:i18n-parity.*check:i18n-du-tone"
---

<objective>
Harden the DE/EN i18n parity infrastructure required by A11Y-01:
1. Wire the existing `check-locale-parity.mts` behind a named `check:i18n-parity` npm script (D-02 — persistent CI entrypoint, not transient under check:phase-57).
2. Add a NEW `check-de-du-tone.mts` lint that flags formal-German tokens per D-03 heuristic.
3. Union both under a new `check:phase-59` script that downstream phases/CI can invoke.

Purpose: Lock in the A11Y-01 gate so any future key drift or du-tone regression fails loudly at verification time.
Output: Two enforceable npm scripts plus one new static analysis script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/59-a11y-parity-sweep/59-CONTEXT.md
@.planning/phases/59-a11y-parity-sweep/59-RESEARCH.md

<interfaces>
<!-- Existing parity gate (DO NOT REWRITE — extend usage via package.json only) -->

From frontend/scripts/check-locale-parity.mts (verified shipped):
```ts
// Reads en.json + de.json with readFileSync + JSON.parse (no ESM json imports).
// Performs Object.keys set-diff on TOP-LEVEL keys only.
// Prints MISSING_IN_DE / MISSING_IN_EN lines, exits 1 on drift, 0 on match.
// repoRoot = resolve(import.meta.dirname, "..", "..")
// Invocation: node --experimental-strip-types frontend/scripts/check-locale-parity.mts
```

From frontend/scripts/check-phase-57-guards.mts:
```ts
// Already exec's check-locale-parity.mts as Guard 5 via execFileSync.
// We do not modify this file — Phase 59 plan owns the top-level
// package.json wiring and the new du-tone script.
```

From frontend/package.json (existing scripts — do not remove):
```json
"check:signage": "node scripts/check-signage-invariants.mjs",
"check:player-isolation": "node scripts/check-player-isolation.mjs",
"check:player-size": "node scripts/check-player-bundle-size.mjs",
"check:player-strings": "node scripts/check-player-strings-parity.mjs",
"check:phase-57": "node --experimental-strip-types scripts/check-phase-57-guards.mts"
```

Locale baseline (verified 2026-04-22):
- en.json / de.json: 527 top-level keys each, parity OK.
- Known pre-v1.19 du-tone hit (to be ALLOWLISTED by key path, not fixed):
  - key path: "empty.body"
  - value: "Dieser Artikel konnte nicht geladen werden. Versuchen Sie, die Seite zu aktualisieren."
  - git blame: commit 6bc6c275 on 2026-04-16 — predates v1.19 start (2026-04-21) → OUT of D-01 scope.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add check-de-du-tone.mts lint script with pre-v1.19 allowlist</name>
  <files>frontend/scripts/check-de-du-tone.mts</files>
  <read_first>
    - frontend/scripts/check-locale-parity.mts (copy the readFileSync + JSON.parse + repoRoot resolution pattern verbatim)
    - frontend/src/locales/de.json (confirm the `empty.body` hit exists and is nested under top-level key `empty`)
    - .planning/phases/59-a11y-parity-sweep/59-CONTEXT.md §Implementation Decisions D-03
    - .planning/phases/59-a11y-parity-sweep/59-RESEARCH.md §Locale Parity Tooling + Pitfall 7
  </read_first>
  <action>
    Create `frontend/scripts/check-de-du-tone.mts` with this exact structure (no behavioural deviation):

    ```ts
    // Du-tone lint — D-03. Scans de.json VALUES for formal-German tokens.
    //
    // Exits 0 when zero non-allowlisted hits.
    // Exits 1 and prints `DU_TONE_HIT: <key-path> | <value>` per offending entry.
    //
    // Does NOT auto-fix. Per D-03 this is a heuristic lint — humans triage.
    //
    // Run with:
    //   node --experimental-strip-types frontend/scripts/check-de-du-tone.mts

    import { readFileSync } from "node:fs";
    import { resolve } from "node:path";

    const repoRoot = resolve(import.meta.dirname, "..", "..");
    const dePath = resolve(repoRoot, "frontend/src/locales/de.json");

    // Case-sensitive per Pitfall 7 — lowercase `ihr` is legitimate possessive.
    const FORMAL = /\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\b/;

    // Allowlist: pre-v1.19 hits (out of D-01 scope). Key path = dotted path from
    // the de.json root, using Object.keys recursion. One entry per line; extend
    // only with a justification comment referencing the phase/date.
    const ALLOWLIST = new Set<string>([
      // v1.13 In-App Documentation — commit 6bc6c275 (2026-04-16); pre-dates
      // v1.19 start (2026-04-21). D-01 puts it out of scope for the sweep.
      "empty.body",
    ]);

    type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

    function walk(node: JsonVal, prefix: string, hits: Array<{ key: string; value: string }>) {
      if (typeof node === "string") {
        if (FORMAL.test(node) && !ALLOWLIST.has(prefix)) {
          hits.push({ key: prefix, value: node });
        }
        return;
      }
      if (node && typeof node === "object" && !Array.isArray(node)) {
        for (const [k, v] of Object.entries(node)) {
          walk(v, prefix ? `${prefix}.${k}` : k, hits);
        }
      }
    }

    const de = JSON.parse(readFileSync(dePath, "utf8")) as JsonVal;
    const hits: Array<{ key: string; value: string }> = [];
    walk(de, "", hits);

    for (const h of hits) console.log(`DU_TONE_HIT: ${h.key} | ${h.value}`);

    if (hits.length === 0) {
      console.log("DU_TONE OK: no non-allowlisted formal-German hits in de.json");
      process.exit(0);
    }

    console.log(`DU_TONE FAIL: ${hits.length} non-allowlisted hit(s)`);
    process.exit(1);
    ```

    Notes:
    - MUST use `readFileSync + JSON.parse` (not ESM JSON import) — matches the sibling script's explicit avoidance of `--experimental-strip-types` JSON-import inconsistencies.
    - MUST recursively walk nested objects — de.json has nested groups (e.g., `empty.body`). `check-locale-parity.mts` uses top-level `Object.keys` only; this script must NOT mimic that shallow walk.
    - Regex MUST be case-sensitive (no `i` flag) — Pitfall 7.
  </action>
  <verify>
    <automated>cd frontend && node --experimental-strip-types scripts/check-de-du-tone.mts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `frontend/scripts/check-de-du-tone.mts`.
    - `grep -c 'const FORMAL = /\\\\b(Sie|Ihnen|Ihre?|Ihrer|Ihres)\\\\b/' frontend/scripts/check-de-du-tone.mts` returns `1`.
    - `grep -c '"empty.body"' frontend/scripts/check-de-du-tone.mts` returns `>= 1` (allowlist entry present).
    - Running `node --experimental-strip-types frontend/scripts/check-de-du-tone.mts` exits `0` and prints `DU_TONE OK:` (because the only known hit is allowlisted).
    - `grep -c 'readFileSync' frontend/scripts/check-de-du-tone.mts` returns `>= 1` (no ESM JSON import).
  </acceptance_criteria>
  <done>
    Script exists, exits 0 against current de.json, allowlists exactly one pre-v1.19 entry by dotted key path, uses case-sensitive regex, uses readFileSync.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire check:i18n-parity, check:i18n-du-tone, and check:phase-59 into package.json</name>
  <files>frontend/package.json</files>
  <read_first>
    - frontend/package.json (read full scripts block — do not clobber existing entries)
    - frontend/scripts/check-locale-parity.mts (confirm relative path `scripts/check-locale-parity.mts` from frontend/)
    - .planning/phases/59-a11y-parity-sweep/59-RESEARCH.md §Open Questions Q4 (Global vs per-plan CI guard wiring)
  </read_first>
  <action>
    Edit `frontend/package.json` — add these three entries to the `"scripts"` object, positioned after `"check:phase-57"` and before the closing brace of `scripts`:

    ```json
    "check:i18n-parity": "node --experimental-strip-types scripts/check-locale-parity.mts",
    "check:i18n-du-tone": "node --experimental-strip-types scripts/check-de-du-tone.mts",
    "check:phase-59": "npm run check:i18n-parity && npm run check:i18n-du-tone"
    ```

    Rules:
    - Do NOT modify or remove any existing script (`dev`, `build`, `test`, `check:signage`, `check:player-*`, `check:phase-57`).
    - Comma placement: the line before `check:i18n-parity` (currently `check:phase-57`) must end with a comma; `check:phase-59` is the new last entry (no trailing comma).
    - Preserve JSON formatting — 2-space indent, double quotes, no trailing commas on the final script.
  </action>
  <verify>
    <automated>cd frontend && npm run check:phase-59</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '"check:i18n-parity":' frontend/package.json` returns `1`.
    - `grep -c '"check:i18n-du-tone":' frontend/package.json` returns `1`.
    - `grep -c '"check:phase-59":' frontend/package.json` returns `1`.
    - `cd frontend && npm run check:i18n-parity` exits `0` and stdout contains `PARITY OK: 527 keys`.
    - `cd frontend && npm run check:i18n-du-tone` exits `0` and stdout contains `DU_TONE OK:`.
    - `cd frontend && npm run check:phase-59` exits `0`.
    - `cd frontend && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits 0 (valid JSON).
    - `grep -c '"check:phase-57":' frontend/package.json` still returns `1` (existing script untouched).
  </acceptance_criteria>
  <done>
    Three new scripts wired, all three exit 0 under current repo state, existing scripts untouched, package.json parses as valid JSON.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npm run check:phase-59` exits 0.
- `grep -c '"check:i18n-du-tone":' frontend/package.json` = 1.
- No existing `check:*` script removed (spot-check: `grep -c '"check:phase-57":' frontend/package.json` still = 1).
</verification>

<success_criteria>
1. `npm run check:phase-59` is the single entrypoint for A11Y-01 gates.
2. Adding a formal-German value to a v1.19 key in de.json makes `npm run check:i18n-du-tone` exit 1.
3. Adding an unbalanced key to en.json (without a DE counterpart) makes `npm run check:i18n-parity` exit 1.
</success_criteria>

<output>
After completion, create `.planning/phases/59-a11y-parity-sweep/59-01-SUMMARY.md` using the summary template.
</output>
