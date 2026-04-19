#!/usr/bin/env node
// Enforces v1.16 cross-cutting invariants for the signage admin UI.
//   Invariant 2: No direct fetch() in signage pages/components/player
//                (apiClient only). Exemption: frontend/src/signage/lib/
//                contains ApiErrorWithBody, the project's sanctioned
//                signage-specific apiClient variant.
//   Invariant 3: No dark: Tailwind variants anywhere in signage
//                (token-only styling).
//
// Exits 0 on clean scan, 1 on any violation.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const ROOTS = [
  "frontend/src/signage/pages",
  "frontend/src/signage/components",
  "frontend/src/signage/player",
];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((rel) => walk(resolve(repoRoot, rel)));

let violations = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    // strip trailing single-line comments naively for both checks
    const stripped = line.replace(/\/\/.*$/, "");
    if (/\bfetch\(/.test(stripped)) {
      console.error(
        `FETCH_VIOLATION: ${f}:${i + 1}: ${line.trim()}`,
      );
      violations++;
    }
    if (/\bdark:/.test(stripped)) {
      console.error(
        `DARK_VARIANT_VIOLATION: ${f}:${i + 1}: ${line.trim()}`,
      );
      violations++;
    }
  });
}

if (violations > 0) {
  console.error(
    `\nFAIL: ${violations} invariant violation(s) across ${files.length} file(s).`,
  );
  process.exit(1);
}

console.log(`SIGNAGE INVARIANTS OK: ${files.length} files scanned`);
