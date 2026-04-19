---
phase: 47-player-bundle
plan: 05
type: execute
wave: 4
depends_on: [47-01, 47-02, 47-03, 47-04]
files_modified:
  - frontend/scripts/check-player-isolation.mjs
  - frontend/scripts/check-player-bundle-size.mjs
  - frontend/scripts/check-player-strings-parity.mjs
  - frontend/scripts/check-signage-invariants.mjs
  - .planning/phases/47-player-bundle/47-UAT.md
  - .planning/phases/47-player-bundle/47-VERIFICATION.md
autonomous: false
requirements: [SGN-PLY-01, SGN-PLY-05]
must_haves:
  truths:
    - "check-player-isolation.mjs greps frontend/src/player/** for forbidden imports (D-5 list) AND raw fetch( calls; exempts playerApi.ts, useSidecarStatus.ts, PairingScreen.tsx"
    - "check-player-bundle-size.mjs gzips dist/player/assets/*.js and asserts total < 200_000 bytes"
    - "check-player-strings-parity.mjs verifies frontend/src/player/lib/strings.ts has the same key set for 'en' and 'de' (Path B parity gate)"
    - "check-signage-invariants.mjs ROOTS array extended to include frontend/src/player so the no-`dark:` rule covers the player tree"
    - "47-VERIFICATION.md documents: SGN-PLY-05 deferral (heartbeat is Phase 48 sidecar's job per D-8) and SGN-PLY-08/09 amendment (SW caches playlist metadata only; sidecar caches media)"
    - "47-UAT.md provides a manual E2E checklist a human can run in a desktop browser to validate the full pairing → playback → SSE → polling fallback → 401 → re-pair loop"
    - "Full build (`npm run build`) + all three CI scripts pass cleanly"
  artifacts:
    - path: frontend/scripts/check-player-isolation.mjs
      provides: "D-5 import-boundary + raw-fetch guard"
    - path: frontend/scripts/check-player-bundle-size.mjs
      provides: "<200KB gz assertion (Pitfall P11 deterministic gzip)"
    - path: frontend/scripts/check-player-strings-parity.mjs
      provides: "EN/DE parity for strings.ts (Path B i18n gate)"
    - path: frontend/scripts/check-signage-invariants.mjs
      provides: "extended ROOTS to cover frontend/src/player"
    - path: .planning/phases/47-player-bundle/47-VERIFICATION.md
      provides: "documented amendments + deferrals (SGN-PLY-05, SGN-PLY-08/09)"
    - path: .planning/phases/47-player-bundle/47-UAT.md
      provides: "manual end-to-end checklist"
  key_links:
    - from: frontend/scripts/check-player-isolation.mjs
      to: frontend/src/player/**/*.{ts,tsx}
      via: "fs walk + regex match"
      pattern: "PLAYER_ROOT"
    - from: frontend/scripts/check-player-bundle-size.mjs
      to: frontend/dist/player/assets/*.js
      via: "zlib.gzipSync(level 9)"
      pattern: "200_000"
---

<objective>
Land the CI guard suite, verify the <200KB bundle gate, document the requirement amendments (SGN-PLY-05 deferred to Phase 48; SGN-PLY-08/09 SW scope re-scoped to playlist metadata only per CONTEXT D-1), and run the human UAT.

Purpose: Locks in Phase 47's invariants so future phases can't silently break them. Provides the hand-off documentation Phase 48 needs (sidecar contract, heartbeat ownership). Gates phase closure on the human-verified UAT.
Output: 4 new/modified scripts, 2 documentation files, one human checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/47-player-bundle/47-CONTEXT.md
@.planning/phases/47-player-bundle/47-RESEARCH.md
@.planning/phases/47-player-bundle/47-UI-SPEC.md
@frontend/scripts/check-signage-invariants.mjs
@frontend/package.json
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: check-player-isolation.mjs (D-5 import boundary + raw fetch guard)</name>
  <files>frontend/scripts/check-player-isolation.mjs</files>
  <read_first>
    - frontend/scripts/check-signage-invariants.mjs (mirror style — fs walk + regex match)
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-5 — exact forbidden + allowed import lists)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (Pat6 + Pitfall P9 — raw fetch exemptions)
  </read_first>
  <action>
    Create `frontend/scripts/check-player-isolation.mjs`:

    ```js
    #!/usr/bin/env node
    // Phase 47 D-5: enforces the player bundle's import boundary + raw-fetch policy.
    //
    // Rule 1: frontend/src/player/** MUST NOT import from admin-only paths:
    //   ^@/signage/pages/
    //   ^@/signage/components/Media
    //   ^@/signage/components/Playlist
    //   ^@/signage/components/Device
    //   ^@/components/admin/
    //
    // Rule 2: frontend/src/player/** MUST NOT call raw fetch() except in these exempt files:
    //   - frontend/src/player/lib/playerApi.ts (the documented apiClient exception per ROADMAP hazard #2)
    //   - frontend/src/player/hooks/useSidecarStatus.ts (200ms localhost probe per Pitfall P10)
    //   - frontend/src/player/PairingScreen.tsx (anonymous /pair/request + /pair/status — no token to attach)
    //
    // Rule 3: frontend/src/player/** MUST NOT contain `dark:` Tailwind variants
    //   (also covered by check-signage-invariants.mjs after its ROOTS extension in Task 4 — duplicate is OK).

    import { readFileSync, readdirSync, statSync } from "node:fs";
    import { join, resolve, relative, dirname } from "node:path";
    import { fileURLToPath } from "node:url";

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(__dirname, "..");
    const PLAYER_ROOT = resolve(repoRoot, "src/player");

    const FORBIDDEN_IMPORTS = [
      /from\s+["']@\/signage\/pages\//,
      /from\s+["']@\/signage\/components\/Media/,
      /from\s+["']@\/signage\/components\/Playlist/,
      /from\s+["']@\/signage\/components\/Device/,
      /from\s+["']@\/components\/admin\//,
    ];

    const RAW_FETCH = /\bfetch\s*\(/;
    const FETCH_EXEMPT = new Set([
      resolve(PLAYER_ROOT, "lib/playerApi.ts"),
      resolve(PLAYER_ROOT, "hooks/useSidecarStatus.ts"),
      resolve(PLAYER_ROOT, "PairingScreen.tsx"),
    ]);

    const DARK_VARIANT = /\bdark:[a-z-]+/;

    function walk(dir) {
      const out = [];
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        const s = statSync(p);
        if (s.isDirectory()) out.push(...walk(p));
        else if (/\.(ts|tsx)$/.test(p)) out.push(p);
      }
      return out;
    }

    let violations = 0;
    let filesScanned = 0;

    for (const f of walk(PLAYER_ROOT)) {
      filesScanned++;
      const src = readFileSync(f, "utf8");
      const isExempt = FETCH_EXEMPT.has(f);
      const lines = src.split("\n");

      lines.forEach((line, i) => {
        // Skip comment-only lines for fetch/dark checks (block comments not handled — keep simple).
        const trimmed = line.trim();
        const isCommentLine = trimmed.startsWith("//") || trimmed.startsWith("*");

        for (const re of FORBIDDEN_IMPORTS) {
          if (re.test(line)) {
            console.error(
              `PLAYER_ISOLATION_VIOLATION (forbidden import): ${relative(repoRoot, f)}:${i + 1}: ${trimmed}`,
            );
            violations++;
          }
        }
        if (!isExempt && !isCommentLine && RAW_FETCH.test(line)) {
          console.error(
            `PLAYER_ISOLATION_VIOLATION (raw fetch in non-exempt file): ${relative(repoRoot, f)}:${i + 1}: ${trimmed}`,
          );
          violations++;
        }
        if (DARK_VARIANT.test(line)) {
          console.error(
            `PLAYER_ISOLATION_VIOLATION (dark: tailwind variant): ${relative(repoRoot, f)}:${i + 1}: ${trimmed}`,
          );
          violations++;
        }
      });
    }

    console.log(`check-player-isolation: scanned ${filesScanned} files, ${violations} violations`);
    process.exit(violations > 0 ? 1 : 0);
    ```

    Run from `frontend/`:
    ```bash
    cd frontend && node scripts/check-player-isolation.mjs
    ```

    Expected: exit 0; output `check-player-isolation: scanned <N> files, 0 violations`.

    If violations are reported in files OTHER than the three FETCH_EXEMPT files, the executing plan introduced a regression — STOP and fix the source (don't expand the exempt list silently).
  </action>
  <verify>
    <automated>test -f frontend/scripts/check-player-isolation.mjs && cd frontend && node scripts/check-player-isolation.mjs</automated>
  </verify>
  <done>
    Script exits 0. Output reports `0 violations`. The three exempt files (playerApi.ts, useSidecarStatus.ts, PairingScreen.tsx) are correctly allowlisted; all other player files have no raw fetch.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: check-player-bundle-size.mjs (<200KB gz assertion — Pitfall P11)</name>
  <files>frontend/scripts/check-player-bundle-size.mjs</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-RESEARCH.md (Pitfall P11 — deterministic gzip via Node zlib level 9)
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-5 — <200KB gz target)
  </read_first>
  <action>
    Create `frontend/scripts/check-player-bundle-size.mjs`:

    ```js
    #!/usr/bin/env node
    // Phase 47 SGN-PLY-01: assert dist/player/assets/*.js gzipped total < 200_000 bytes.
    // Deterministic via Node zlib (Pitfall P11) — no system gzip dependency.
    //
    // Run AFTER `npm run build` (or `npm run build:player`).

    import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
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
    ```

    Run from `frontend/`:
    ```bash
    cd frontend && (npm run build || (rm -rf dist && npx vite build && npx vite build --mode player)) && node scripts/check-player-bundle-size.mjs
    ```

    If FAIL (total > 200_000): the breakdown shows which chunk is fattest. Common culprits + remediation:
    - `vendor-react` chunk dominates → expected; verify `manualChunks` is splitting correctly. If it's >100KB, something is wrong with the chunk extraction.
    - `index-*.js` (the player entry chunk) is huge → check for accidental admin imports leaking through (rerun check-player-isolation.mjs).
    - `pdf-worker` or pdfjs-dist chunk is large → the worker itself is loaded via `?url` (NOT bundled into the JS chunk) — if it's bundled, the `pdfWorker.ts` import path is wrong.

    DO NOT raise the limit to "make CI green" — that defeats the SGN-PLY-01 contract.
  </action>
  <verify>
    <automated>test -f frontend/scripts/check-player-bundle-size.mjs && cd frontend && (npm run build || (rm -rf dist && npx vite build && npx vite build --mode player)) && node scripts/check-player-bundle-size.mjs</automated>
  </verify>
  <done>
    Script outputs per-file breakdown + total + PASS line. Exit 0. Total < 200_000 bytes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: check-player-strings-parity.mjs (Path B i18n gate)</name>
  <files>frontend/scripts/check-player-strings-parity.mjs</files>
  <read_first>
    - frontend/src/player/lib/strings.ts (Plan 47-01 — STRINGS shape with en + de keys)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (Pitfall P9 Path B — custom parity test required)
  </read_first>
  <action>
    Create `frontend/scripts/check-player-strings-parity.mjs`:

    ```js
    #!/usr/bin/env node
    // Phase 47 — Path B i18n parity gate (Pitfall P9 resolution).
    // Asserts that frontend/src/player/lib/strings.ts has the SAME set of keys for 'en' and 'de'.
    // Replaces the JSON-locale parity check (scripts/check-i18n-parity.mjs) for the player bundle's
    // 5 hard-coded strings.

    import { readFileSync } from "node:fs";
    import { resolve, dirname } from "node:path";
    import { fileURLToPath } from "node:url";

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(__dirname, "..");
    const STRINGS_FILE = resolve(repoRoot, "src/player/lib/strings.ts");

    const src = readFileSync(STRINGS_FILE, "utf8");

    // Extract the keys for each locale by scanning the literal STRINGS object.
    // Simple regex parse — works because the file is hand-authored with predictable shape.
    function extractKeys(localeTag) {
      // Match e.g.   en: { ... }   then capture string keys inside.
      const blockRe = new RegExp(`${localeTag}\\s*:\\s*\\{([\\s\\S]*?)\\}\\s*,?\\s*(?:de|en|\\}\\s*;?)`, "m");
      const m = src.match(blockRe);
      if (!m) {
        console.error(`check-player-strings-parity: could not locate '${localeTag}' block in strings.ts`);
        process.exit(2);
      }
      const body = m[1];
      const keyRe = /["']([a-z_.]+)["']\s*:/g;
      const keys = new Set();
      let km;
      while ((km = keyRe.exec(body))) keys.add(km[1]);
      return keys;
    }

    const enKeys = extractKeys("en");
    const deKeys = extractKeys("de");

    const onlyEn = [...enKeys].filter((k) => !deKeys.has(k));
    const onlyDe = [...deKeys].filter((k) => !enKeys.has(k));

    console.log(`check-player-strings-parity: en=${enKeys.size} keys, de=${deKeys.size} keys`);

    if (onlyEn.length > 0) {
      console.error("check-player-strings-parity: keys present in 'en' but missing in 'de':");
      for (const k of onlyEn) console.error(`  - ${k}`);
    }
    if (onlyDe.length > 0) {
      console.error("check-player-strings-parity: keys present in 'de' but missing in 'en':");
      for (const k of onlyDe) console.error(`  - ${k}`);
    }

    if (onlyEn.length > 0 || onlyDe.length > 0) {
      console.error("check-player-strings-parity: FAIL");
      process.exit(1);
    }
    console.log("check-player-strings-parity: PASS");
    process.exit(0);
    ```

    Run from `frontend/`:
    ```bash
    cd frontend && node scripts/check-player-strings-parity.mjs
    ```

    Expected: 5 keys for each locale (`pair.headline`, `pair.hint`, `pair.code_placeholder`, `offline.label`, `offline.aria_label`); PASS.

    Add to `package.json` scripts (the entry was reserved in Plan 47-01 Task 1; if it's missing, add it now):
    ```json
    "check:player-strings": "node scripts/check-player-strings-parity.mjs"
    ```
  </action>
  <verify>
    <automated>test -f frontend/scripts/check-player-strings-parity.mjs && cd frontend && node scripts/check-player-strings-parity.mjs</automated>
  </verify>
  <done>
    Script exits 0; reports `en=5 keys, de=5 keys` and PASS.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Extend check-signage-invariants.mjs ROOTS to cover frontend/src/player</name>
  <files>frontend/scripts/check-signage-invariants.mjs</files>
  <read_first>
    - frontend/scripts/check-signage-invariants.mjs (find the ROOTS array constant)
  </read_first>
  <action>
    Read the existing `frontend/scripts/check-signage-invariants.mjs`. Locate the `ROOTS` (or equivalent) constant — it currently lists the signage admin paths under `frontend/src/signage/`.

    Add `"src/player"` to the ROOTS array so the existing no-`dark:` invariant (and any other rules in that script) automatically covers the player tree.

    Example shape (executor adapts to the actual file):
    ```js
    // BEFORE
    const ROOTS = [
      "src/signage",
      // ...other admin paths
    ];

    // AFTER
    const ROOTS = [
      "src/signage",
      "src/player",  // Phase 47: extend invariant coverage to the player bundle
      // ...other admin paths
    ];
    ```

    Then run from `frontend/`:
    ```bash
    cd frontend && node scripts/check-signage-invariants.mjs
    ```

    Expected: exit 0. The script's existing rules (no `dark:`, no admin-only imports outside signage tree, etc.) should pass — Plan 47-02/03/04 were authored to comply with these invariants.

    If a violation surfaces in the player tree, fix the player file (don't relax the rule). The player exempt-list for raw fetch lives in `check-player-isolation.mjs` (Task 1) — `check-signage-invariants.mjs` should NOT be modified to add player-specific exemptions; keep its semantic single-purpose.
  </action>
  <verify>
    <automated>grep -q '"src/player"\|"src\/player"' frontend/scripts/check-signage-invariants.mjs && cd frontend && node scripts/check-signage-invariants.mjs</automated>
  </verify>
  <done>
    `ROOTS` (or equivalent) array includes `"src/player"`. The script passes against the current state of the codebase.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Write 47-VERIFICATION.md (documented amendments + deferrals)</name>
  <files>.planning/phases/47-player-bundle/47-VERIFICATION.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (SGN-PLY-05, SGN-PLY-08, SGN-PLY-09 — original wording)
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-1 amendment, D-8 — heartbeat deferral)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§Phase Requirements table — researcher's amendments)
  </read_first>
  <action>
    Create `.planning/phases/47-player-bundle/47-VERIFICATION.md`:

    ```markdown
    # Phase 47 — Verification & Requirement Amendments

    **Date:** <today>
    **Status:** Phase 47 closure documentation — amendments to original requirement wording, with rationale.

    ## Summary

    Phase 47 closes 11 requirements (SGN-PLY-01..10 + SGN-DIFF-03). Three of those requirements have their literal wording amended, with each amendment locked in CONTEXT and validated by RESEARCH:

    | Requirement | Original wording | Amendment | Rationale |
    |-------------|------------------|-----------|-----------|
    | SGN-PLY-05 | "Heartbeat — POST /api/signage/player/heartbeat every 60s with current_item_id" | **Deferred to Phase 48 (Pi sidecar)** — NOT shipped in the player JS bundle | CONTEXT D-8: heartbeat is the sidecar's job. Browser tabs throttle setInterval when backgrounded; the sidecar is the more reliable liveness signal for the systemd healthcheck. Backend `/heartbeat` endpoint (Phase 43) is unchanged and ready to receive from the sidecar in Phase 48. |
    | SGN-PLY-08 | "Service Worker + Cache API for media (stale-while-revalidate for playlist metadata, cache-first for media assets)" | **SW caches playlist METADATA only**; media caching deferred to Phase 48 sidecar | CONTEXT D-1 (hybrid offline cache): per PITFALLS Pitfall 18, browser SW cache evicts under memory pressure and on nightly Pi reboots → black screen. Sidecar writing to `/var/lib/signage/media/` is the durable layer. Phase 47 ships `window.signageSidecarReady` detector + `resolveMediaUrl()` rewrite hook so the swap is plug-and-play when Phase 48 lands. |
    | SGN-PLY-09 | "Offline cache-and-loop — when network drops, keep looping last-cached playlist; SW serves cached media" | **Achieved via 3-layer cache: TanStack Query in-memory (gcTime: Infinity) + SW SWR for /playlist + sidecar (Phase 48) for media** | Same root cause as SGN-PLY-08 amendment. Phase 47 architectural pieces: `gcTime: Infinity` in main.tsx QueryClient + Workbox StaleWhileRevalidate for `/api/signage/player/playlist` + sidecar URL rewrite hook. End-to-end offline-with-media validation lands in Phase 48 E2E walkthrough. |

    ## Verification Matrix

    | Req ID | Implemented in plan | Verified by |
    |--------|--------------------|-----|
    | SGN-PLY-01 | 47-01 (Vite multi-entry, manualChunks, package.json), 47-04 (backend mount) | `check-player-bundle-size.mjs` PASS (<200KB gz); `dist/player/index.html` exists |
    | SGN-PLY-02 | 47-02 (useDeviceToken) | localStorage key `signage_device_token` set/read/cleared; URL → localStorage → null priority |
    | SGN-PLY-03 | 47-02 (PairingScreen) | `/pair/request` on mount, `/pair/status` every 3s, `XXX-XXX` rendered at 16rem |
    | SGN-PLY-04 | 47-03 (PlaybackShell + useSseWithPollingFallback) | `/playlist` on boot + on SSE event; 30s polling on watchdog fire |
    | SGN-PLY-05 | **DEFERRED to Phase 48** (see amendment above) | n/a in Phase 47; Phase 48 sidecar systemd unit owns this |
    | SGN-PLY-06 | 47-03 (useSseWithPollingFallback) | EventSource `?token=`, 45s watchdog, reconnect grace 5s |
    | SGN-PLY-07 | 47-03 (PlaybackShell wrapping PlayerRenderer + VideoPlayer loop prop) | All 6 handlers reused from Phase 46-03; video plays once via onEnded |
    | SGN-PLY-08 | 47-01 (vite-plugin-pwa Workbox SWR for /playlist) + AMENDED scope | SW registers; cacheName `signage-playlist-v1`; media intentionally NOT precached |
    | SGN-PLY-09 | 47-01 (PWA) + 47-03 (gcTime: Infinity) + AMENDED scope | TanStack Query retains last-known playlist; media offline = sidecar (Phase 48) |
    | SGN-PLY-10 | 47-01 (overrides + pdfWorker.ts) + 47-04 (main.tsx import order) | `npm ls pdfjs-dist` shows single 5.6.205; pdfWorker import is first |
    | SGN-DIFF-03 | 47-03 (PdfPlayer crossfade) | Two-layer Page render with `transition-opacity duration-200` |

    ## Open questions resolved during planning

    | OQ | Resolution | Source |
    |----|------------|--------|
    | OQ1 — i18n: i18next vs hard-coded | **Path B (hard-coded strings)** — locked in 47-01 strings.ts; gated by `check-player-strings-parity.mjs` (47-05 Task 3) | RESEARCH §"Open Questions" + Pitfall P9; ~25KB savings on the <200KB budget |
    | OQ2 — vendor-react chunk dedup across outDirs | **Accepted limitation** — two physical copies (one per outDir); CONTEXT D-5's "shared cache benefit" reframed as "per-route bundle-size discipline" | RESEARCH Pitfall P4; no real user visits both surfaces from the same browser |
    | OQ3 — sidecar handshake protocol | **Hybrid detector** — window flag (sync) + 200ms localhost:8080/health probe fallback | RESEARCH Pitfall P10; implemented in 47-03 useSidecarStatus.ts |
    | OQ4 — `/stream?token=` query auth | Resolved per `47-OQ4-RESOLUTION.md` (Plan 47-01 Task 0) | If FAIL, the 47-OQ4-RESOLUTION file flags the required backend tweak; if PASS, no further action |

    ## Hand-off to Phase 48

    Phase 48 (Pi Provisioning + E2E + Docs) inherits these contracts from Phase 47:

    1. **Sidecar discovery contract:** the player reads `window.signageSidecarReady === true` synchronously and, as a hybrid fallback, probes `http://localhost:8080/health` with a 200ms timeout. Phase 48 sidecar must:
       - Set `window.signageSidecarReady = true` via injected script (or HTML wrapper) BEFORE the player bundle script loads.
       - Serve `GET http://localhost:8080/health` returning `{ "online": true | false }` based on its WAN connectivity probe.
       - Dispatch `window.dispatchEvent(new Event("signage:sidecar-status"))` whenever the online/offline state changes.
       - Serve media at `http://localhost:8080/media/<media_id>` (the `resolveMediaUrl()` rewrite target).

    2. **Heartbeat ownership:** the Pi sidecar (or systemd healthcheck) is responsible for `POST /api/signage/player/heartbeat` every 60s. The player JS bundle does NOT POST heartbeats. Backend endpoint shape is unchanged from Phase 43 D-11.

    3. **PWA runtime cache name:** `signage-playlist-v1`. If Phase 48 changes the `/playlist` envelope shape, BUMP this to `v2` in `vite.config.ts` (Pitfall P8).

    4. **Token transport:** device JWT travels in `Authorization: Bearer <token>` for `/playlist` + `/heartbeat`, and as `?token=<token>` query string for `/stream` (EventSource limitation, accepted per Pitfall P7).
    ```

    Replace `<today>` with the actual date.
  </action>
  <verify>
    <automated>test -f .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "SGN-PLY-05" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "DEFERRED to Phase 48" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "signageSidecarReady" .planning/phases/47-player-bundle/47-VERIFICATION.md && grep -q "signage-playlist-v1" .planning/phases/47-player-bundle/47-VERIFICATION.md</automated>
  </verify>
  <done>
    `47-VERIFICATION.md` exists with the amendments table, the verification matrix per requirement ID, the OQ resolutions, and the Phase 48 hand-off contract.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Write 47-UAT.md — manual end-to-end checklist</name>
  <files>.planning/phases/47-player-bundle/47-UAT.md</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (all three surfaces — pairing/playback/offline)
    - .planning/phases/47-player-bundle/47-CONTEXT.md
  </read_first>
  <action>
    Create `.planning/phases/47-player-bundle/47-UAT.md`:

    ```markdown
    # Phase 47 — Manual UAT Checklist

    **Purpose:** Validate the full player bundle end-to-end in a desktop browser before Phase 48 ships the Pi/sidecar/systemd layer. Pi-hardware E2E is Phase 48 success criterion 1.

    **Prerequisites:**
    - Backend stack running (`docker compose up`).
    - Frontend built (`cd frontend && npm run build`) so the backend serves `dist/player/`.
    - At least one Directus admin user exists.
    - At least one playlist with ≥1 enabled item exists, targeting tag X.

    ## Scenario A: First-boot pairing → claim → playback

    | # | Action | Expected |
    |---|--------|----------|
    | A1 | Open Chrome DevTools → Application → clear `localStorage` for the API origin. Navigate to `http://<api-host>/player/`. | Pairing screen renders. Headline + 256px monospace `XXX-XXX` code + hint visible on `bg-neutral-950`. |
    | A2 | Open a second tab; log in as admin; go to `/signage/pair`; enter the displayed code + a device name + tag X; submit. | Admin tab shows successful claim. |
    | A3 | Wait ≤3s in the player tab. | Player tab transitions to `/player/<token>` and starts rendering the playlist (image, video, etc. depending on items). `localStorage.signage_device_token` is set. |
    | A4 | Reload the player tab (no token in URL). | Player resumes playback at `/player/` (token recovered from localStorage). |

    ## Scenario B: SSE update propagation

    | # | Action | Expected |
    |---|--------|----------|
    | B1 | While Scenario A is in playback, in admin tab edit the playlist (e.g., reorder items or change duration). Save. | Within ≤2s, the player tab's playlist updates without refresh. DevTools → Network → EventSource shows messages received. |
    | B2 | DevTools → Network → throttle to "Offline". Wait 50s. | Within 45s of going offline, DevTools → Network shows EventSource closes. After ~50s, polling fetches to `/api/signage/player/playlist` start (and fail because offline). |
    | B3 | Restore network to "Online". | Within 30s, a successful poll fires. SSE reconnects. Playback continues with any updates that happened during the outage. |

    ## Scenario C: 401 device-revoked recovery

    | # | Action | Expected |
    |---|--------|----------|
    | C1 | While in playback, in the admin tab revoke the device. | Within ≤30s (next poll/SSE attempt), player returns 401. |
    | C2 | Player auto-handles: localStorage token cleared; navigates to `/player/`; pairing screen renders with a fresh code. | Confirmed visually. |

    ## Scenario D: Service Worker + offline cache

    | # | Action | Expected |
    |---|--------|----------|
    | D1 | DevTools → Application → Service Workers. | A SW for `/player/` scope is registered (via `vite-plugin-pwa`). |
    | D2 | DevTools → Application → Cache Storage → `signage-playlist-v1`. | After at least one successful playlist fetch, an entry for `/api/signage/player/playlist` is present. |
    | D3 | DevTools → Network → throttle to "Offline". Reload the player page. | Player loads (HTML/JS/CSS from SW precache); pairing or playback surface renders depending on token state. |
    | D4 | Confirm: NO entry for media URLs in Cache Storage (intentional — media is sidecar's job per VERIFICATION.md). | Confirmed. |

    ## Scenario E: PDF crossfade (SGN-DIFF-03)

    | # | Action | Expected |
    |---|--------|----------|
    | E1 | Configure a playlist with a multi-page PDF item with `duration_s` < `pageCount * 6`. | When PDF is reached, pages auto-flip with a visible 200ms opacity crossfade between consecutive pages (NOT a hard cut). |

    ## Scenario F: Format handler smoke

    | # | Format | Action | Expected |
    |---|--------|--------|----------|
    | F1 | image | Add image item; play. | `<img>` with `object-contain`; advances after `duration_s` (default 10s). |
    | F2 | video | Add video item; play. | `<video muted autoplay playsinline>` (NO `loop`); advances on natural end. |
    | F3 | pdf | Add multi-page PDF; play. | Pages crossfade; total = `pageCount × 6s`. |
    | F4 | iframe (URL) | Add URL item; play. | `<iframe sandbox="allow-scripts allow-same-origin">` mounted; 30s default duration. |
    | F5 | html | Add HTML snippet; play. | `<iframe srcdoc=… sandbox="allow-scripts">` mounted; 30s default duration. |
    | F6 | pptx | Upload PPTX (via admin); wait for conversion to complete; add to playlist; play. | Image sequence cycles; `slide_paths.length × 8s` total. |

    ## Scenario G: Bundle isolation invariants

    | # | Action | Expected |
    |---|--------|----------|
    | G1 | `cd frontend && npm run check:player-isolation` | Exit 0; "0 violations". |
    | G2 | `cd frontend && npm run check:player-size` | Exit 0; PASS (gz total < 200KB). |
    | G3 | `cd frontend && npm run check:player-strings` (or `node scripts/check-player-strings-parity.mjs`) | Exit 0; "en=5 keys, de=5 keys; PASS". |
    | G4 | `cd frontend && npm run check:signage` | Exit 0 (pre-existing signage invariants still pass after ROOTS extension). |

    ## Sign-off

    - [ ] All scenarios A–G pass.
    - [ ] No console errors in the player tab during any scenario.
    - [ ] No CORS or cookie-related errors in DevTools.

    Reviewer: __________________________  Date: ____________
    ```
  </action>
  <verify>
    <automated>test -f .planning/phases/47-player-bundle/47-UAT.md && grep -q "Scenario A" .planning/phases/47-player-bundle/47-UAT.md && grep -q "Scenario E: PDF crossfade" .planning/phases/47-player-bundle/47-UAT.md && grep -q "check-player-bundle-size" .planning/phases/47-player-bundle/47-UAT.md</automated>
  </verify>
  <done>
    `47-UAT.md` exists with Scenarios A–G covering pairing, SSE propagation, 401 recovery, SW caching, PDF crossfade, all 6 format handlers, and CI invariant gates. Includes a sign-off block.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 7: Full build + run all CI guards back-to-back (final gate)</name>
  <files>(no files written; verification only)</files>
  <read_first>
    - frontend/package.json (script names from Plan 47-01 Task 1)
  </read_first>
  <action>
    Run the full Phase 47 close-out gate sequence from `frontend/`:

    ```bash
    cd frontend
    rm -rf dist
    # Full build (admin + player). Tsc-failure workaround documented in 47-01-SUMMARY.
    npm run build || (rm -rf dist && npx vite build && npx vite build --mode player)

    # All four invariant scripts MUST exit 0:
    node scripts/check-signage-invariants.mjs
    node scripts/check-player-isolation.mjs
    node scripts/check-player-strings-parity.mjs
    node scripts/check-player-bundle-size.mjs
    ```

    All commands must exit 0 in sequence. If any fails, fix the offending source (do NOT relax the rules). Common fixes:
    - check-player-isolation FAIL → revisit the offending file's imports or move raw fetch into one of the three exempt files
    - check-player-bundle-size FAIL → inspect the per-file breakdown in the script's output; usually a chunk leak
    - check-player-strings-parity FAIL → add the missing key to the other locale block in `strings.ts`
    - check-signage-invariants FAIL → most likely a `dark:` variant slipped in

    Backend smoke:
    ```bash
    cd backend && python -c "from app.main import app; print('routes:', len(app.routes))"
    ```
    Should print a route count without errors.
  </action>
  <verify>
    <automated>cd frontend && (npm run build || (rm -rf dist && npx vite build && npx vite build --mode player)) && node scripts/check-signage-invariants.mjs && node scripts/check-player-isolation.mjs && node scripts/check-player-strings-parity.mjs && node scripts/check-player-bundle-size.mjs && cd ../backend && python -c "from app.main import app"</automated>
  </verify>
  <done>
    Full build succeeds (with or without the tsc workaround). All four CI guard scripts exit 0 sequentially. Backend imports cleanly.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 8: Human UAT — run 47-UAT.md scenarios A–G</name>
  <files>.planning/phases/47-player-bundle/47-UAT.md</files>
  <action>Walk through Scenarios A–G in 47-UAT.md and record outcomes inline in that file.</action>
  <verify>Human reviewer signs off the checklist (or returns specific failing scenario numbers for remediation).</verify>
  <done>All seven scenarios marked complete; sign-off line filled in.</done>
  <what-built>
    - Phase 47 player bundle: separate Vite entry served at `/player/<token>`, pairing screen, SSE+watchdog+polling lifecycle, PDF crossfade, OfflineChip, SW with playlist SWR cache.
    - Backend static-mount + SPA fallback for `/player/*`.
    - Four CI guard scripts (signage invariants, player isolation, bundle size <200KB, strings parity).
    - Documentation: 47-VERIFICATION.md (amendments + Phase 48 hand-off), 47-UAT.md (this checklist).
  </what-built>
  <how-to-verify>
    1. `docker compose up` to bring the stack up.
    2. `cd frontend && npm run build` to ensure `dist/player/` is fresh.
    3. Open `.planning/phases/47-player-bundle/47-UAT.md` and walk through Scenarios A–G in a Chrome DevTools session.
    4. Record any failing scenario number(s) below. If all 7 scenarios pass, sign off the checklist.

    Critical visual gates (don't skip):
    - Pairing code is visibly large (≥256px / 16rem) and readable from across the room.
    - PDF crossfade between pages is smooth (200ms opacity), not a hard cut.
    - Offline chip is amber (NOT red), bottom-right, only visible when sidecar reports offline (test by manually setting `window.signageSidecarReady = true; window.dispatchEvent(new Event("signage:sidecar-status"))` in DevTools console — but no real sidecar exists so chip will likely stay hidden in dev; that's the correct degraded behavior).
    - SSE update propagates within ≤2s (Scenario B1).
    - Bundle size script reports total < 200KB.
  </how-to-verify>
  <resume-signal>
    Type "approved" if all 47-UAT.md scenarios pass.
    Or describe failing scenario(s): "B2 fails: SSE didn't reconnect after 30s online" etc.
  </resume-signal>
</task>

</tasks>

<verification>
- All 4 scripts exist and exit 0.
- 47-VERIFICATION.md and 47-UAT.md exist.
- Final build passes; all CI guards pass.
- Human UAT signed off.
</verification>

<success_criteria>
- SGN-PLY-01: <200KB gz bundle gate enforced by `check-player-bundle-size.mjs`.
- SGN-PLY-05: documented as deferred to Phase 48 in 47-VERIFICATION.md (no JS heartbeat per D-8).
- All five plans (47-01..05) close with green CI + signed UAT.
- Phase 48 has clear hand-off contract (sidecar discovery, heartbeat ownership, SW cache name versioning).
</success_criteria>

<output>
After completion, create `.planning/phases/47-player-bundle/47-05-SUMMARY.md` with:
- Files created (4 scripts + 2 docs)
- All-green CI guard results (with bundle size byte count)
- UAT outcome (signed-off / failures noted)
- Final phase 47 status: ready for `/gsd:plan-phase 48` if all UAT scenarios passed
</output>
