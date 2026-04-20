#!/usr/bin/env node
// Phase 47 SGN-PLY-01: assert dist/player/assets/*.js gzipped total < 200_000 bytes.
// Deterministic via Node zlib (Pitfall P11) — no system gzip dependency.
//
// Run AFTER `npm run build` (or `npm run build:player`).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const ASSETS = resolve(repoRoot, "dist/player/assets");
const LIMIT = 200_000;

if (!existsSync(ASSETS)) {
  console.error(`check-player-bundle-size: ${ASSETS} does not exist — run \`npm run build\` first`);
  process.exit(2);
}

const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error(`check-player-bundle-size: no .js files in ${ASSETS}`);
  process.exit(2);
}

let total = 0;
const breakdown = [];
for (const f of files) {
  const buf = readFileSync(join(ASSETS, f));
  const gz = gzipSync(buf, { level: 9 }).length;
  breakdown.push({ file: f, raw: buf.length, gz });
  total += gz;
}

breakdown.sort((a, b) => b.gz - a.gz);
console.log("check-player-bundle-size: per-file (gzipped, sorted desc):");
for (const { file, raw, gz } of breakdown) {
  const rawKb = (raw / 1024).toFixed(1);
  const gzKb = (gz / 1024).toFixed(1);
  console.log(`  ${gzKb.padStart(8)} KB gz   (${rawKb.padStart(8)} KB raw)   ${file}`);
}
const totalKb = (total / 1024).toFixed(1);
const limitKb = (LIMIT / 1024).toFixed(1);
const pct = ((total / LIMIT) * 100).toFixed(1);
console.log(`check-player-bundle-size: TOTAL ${totalKb} KB gz / ${limitKb} KB limit (${pct}%)`);

if (total > LIMIT) {
  console.error(`check-player-bundle-size: FAIL — ${total} bytes > ${LIMIT} byte limit`);
  process.exit(1);
}
console.log("check-player-bundle-size: PASS");
process.exit(0);
