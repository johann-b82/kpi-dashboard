# Phase 50: Pi Polish — Research

**Researched:** 2026-04-21
**Domain:** React/Vite dynamic-import bundle splitting; single-Pi hardware E2E methodology (SSE reconnect timing, systemd sidecar-restart resilience)
**Confidence:** HIGH on bundle-split path and Scenario 5 mechanics; MEDIUM on Scenario 4 reconnect timing (no prior hardware timing data to baseline against).

## Summary

Phase 50 has two independent requirements that can be planned as two parallel plans:

1. **SGN-POL-05 (bundle).** `react-pdf` + `pdfjs-dist` are currently statically imported into the player entry chunk (`PlayerRenderer.tsx` line 5 → `PdfPlayer.tsx` line 2). The canonical fix is `React.lazy(() => import('./PdfPlayer'))` behind a `<Suspense>` boundary inside the `case "pdf":` branch of `PlayerRenderer.renderItem`. The pdf.js worker pin in `src/player/lib/pdfWorker.ts` is already a separate concern (Vite emits it to its own `pdf.worker.min-*.mjs` chunk and `check-player-bundle-size.mjs` already only scans `.js` files — the worker will not re-enter the guarded total). Expected net move: ~30–40 KB gz of `react-pdf` glue + some pdfjs-dist footprint out of `player-*.js` into a lazy-loaded `PdfPlayer-[hash].js` chunk. Reset `LIMIT = 200_000`. Build + `check:player-size` passes.

2. **SGN-POL-04 (E2E Scenarios 4+5).** Single-Pi walkthrough. Scenario 4 methodology: `nmcli device disconnect wlan0` → wait ≥ sidecar probe threshold (30 s, i.e. 3 × 10 s failures) → `nmcli device connect wlan0` → make admin mutation → stopwatch until the new item appears on screen. Target ≤ 30 s. Timing anchors come from three synchronized clocks: wall clock on the laptop, `journalctl --user -u signage-sidecar -f` on the Pi, and the admin browser's audit logs. Scenario 5 methodology: `systemctl --user restart signage-sidecar` while playback is mid-item; the Chromium player should NOT black-screen because the currently-playing media is already loaded into the `<img>/<video>/<canvas>` element — it is not re-fetched per frame. Only the next `localhost:8080/media/<id>` fetch will see a connection reset; the sidecar's `Restart=always RestartSec=5` brings it back within ~5–10 s; the `useSidecarStatus` 30 s re-probe + the `useSseWithPollingFallback` 45 s watchdog handle the re-authentication. Target: zero visible black frame, continuity preserved.

**Primary recommendation:** Plan 50-01 = SGN-POL-05 (pure frontend, ~1 hour). Plan 50-02 = SGN-POL-04 (operator runbook + results template; work is entirely documentation/methodology, no code change). Plans can run in parallel.

<user_constraints>
## User Constraints (from CONTEXT.md / REQUIREMENTS.md preamble)

### Locked Decisions (from REQUIREMENTS.md 2026-04-21 preamble + phase scope)
- **Pi provisioning path:** `scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit — single path.
- **Scope retired 2026-04-21:** No custom `.img.xz`, no minisign, no arm64 self-hosted runners, no byte-identical filesystem diff-tests. The `pi-image/` directory and `.github/workflows/pi-image.yml` are gone; do NOT re-introduce them. SGN-POL-01/02/03/06 are dropped.
- **Dynamic import approach:** `PdfPlayer` + `react-pdf` MUST be lazy-loaded; the initial payload MUST NOT fetch them when the playlist contains no `pdf`-kind items.
- **Bundle guard LIMIT:** reset from `210_000` to `200_000`. Build passes.
- **Scenarios to run:** 4 (reconnect → admin-mutation-arrives ≤ 30 s) and 5 (sidecar systemd restart → playback continuity). Recorded in `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` with numerical timings.
- **Single-Pi walkthrough:** operator has ONE physical Pi, not a fleet.

### Claude's Discretion
- Exact React pattern for lazy-loading (`React.lazy + Suspense` vs. inline `import()` in a factory registry) — recommend below.
- Suspense fallback visual (blank black vs. small spinner) — recommend blank black to avoid flashing in a signage kiosk.
- Whether to preload the PDF chunk speculatively when the playlist envelope first mentions a `pdf` item (before the fade-in transitions to it) — recommend yes via `import(/* webpackChunkName */)` hint or a targeted `<link rel="modulepreload">` from inside the handler.
- Exact commands + stopwatch/timing capture methodology for Scenario 4+5 — recommend below.
- `50-E2E-RESULTS.md` template structure — recommend below.

### Deferred Ideas (OUT OF SCOPE)
- Custom `.img.xz`, minisign signing ceremony, arm64 runners, image byte-diff tests.
- Scenario 6+ (power-cut, factory reset, etc.) — not in phase scope.
- Per-device PDF pre-render to images (would be a larger redesign).
- Touching the admin-side PlayerRenderer preview (shares the file — see Pitfall 2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-POL-04 | Hardware E2E Scenarios 4 + 5 on a `provision-pi.sh`-provisioned Pi; results in `50-E2E-RESULTS.md` with numerical timings. | §"Scenario 4 methodology", §"Scenario 5 methodology", §"50-E2E-RESULTS.md template" |
| SGN-POL-05 | `PdfPlayer` + `react-pdf` dynamic-imported so player entry chunk drops under 200 KB gz. `check-player-bundle-size.mjs` LIMIT back to 200_000. Build passes. | §"Standard Stack" (React.lazy), §"Architecture Patterns" (lazy handler), §"Don't Hand-Roll", §"Bundle Composition — current state" |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted actionable directives the planner MUST respect:

- **Stack fixed:** React 19.2.5 + Vite 8.0.8 + TypeScript + TanStack Query v5. No alternative chart/UI libs introduced.
- **apiClient-only in admin frontend** (hard gate 2). Player tree has a documented exemption list — do NOT expand it. Phase 50 requires NO new raw `fetch()` calls.
- **No `dark:` Tailwind variants.** Hard gate 3.
- **Tailwind v4 class-strategy dark mode, tokens only.** No `dark:` variants anywhere.
- **`--workers 1` invariant** preserved (unchanged by Phase 50).
- **GSD workflow enforcement.** Before editing files, start work through a GSD command. Phase 50 plans must be created via `/gsd:plan-phase 50`.

## Bundle Composition — current state (HIGH confidence, measured)

Measured on the current `dist/player/assets/` artifact (commit `bea2205`):

| File | Raw | Gz | Counted by guard? | Notes |
|------|-----|-----|-------------------|-------|
| `player-*.js` | 450.7 KB | **135.1 KB** | ✅ yes | Entry chunk. Contains PlaybackShell, PlayerRenderer, **all six format handlers statically imported**, `react-pdf`, `pdfjs-dist` glue (11 `react-pdf` refs + 3 `GlobalWorkerOptions` refs counted). |
| `vendor-react-*.js` | 207.0 KB | **64.2 KB** | ✅ yes | `react`, `react-dom`, `scheduler`, `@tanstack/react-query` (per `manualChunks` rule in `vite.config.ts`). |
| `rolldown-runtime-*.js` | 0.7 KB | **0.4 KB** | ✅ yes | Tiny module-loader runtime. |
| `pdf.worker.min-*.mjs` | 1215.1 KB | 358.7 KB | ❌ no (`.mjs` extension; guard filters `.endsWith(".js")`) | Vite `?url` import — served as a separate worker script. Not in the critical-path JS. |
| CSS (`player-*.css`) | — | — | ❌ no | Not in scope of the size guard. |

**Current counted total on disk:** 199.7 KB gz (already under 200 KB on THIS stale artifact — but CLAUDE's context + STATE.md say the current real build is 204,456 bytes / 204 KB on the latest source. A fresh `npm run build` will confirm the true starting point before the plan executes. The gap is likely the Tailwind CSS split and the DEFECT-1 addition to `main.tsx` post-dating this `dist/`.)

**The two chunks that matter:** `player-*.js` (135 KB) and `vendor-react-*.js` (64 KB). `react-pdf` lives entirely inside `player-*.js`. pdfjs-dist core APIs that `react-pdf` imports live partly in `player-*.js` (the wrapper/types) and partly in the `.mjs` worker (the heavy PDF parsing engine). Moving `PdfPlayer` + its `react-pdf` import behind a dynamic `import()` will split out a new `PdfPlayer-[hash].js` chunk holding both `PdfPlayer.tsx` and the entire `react-pdf` package (currently ~30–50 KB gz per napkin math from react-pdf@10.4.1 + its pdfjs glue surface).

**Expected post-fix counted total:** `vendor-react` (unchanged, ~64 KB) + new trimmed `player-*.js` (≈ 85–100 KB) = ~150–170 KB gz. Comfortable margin under 200 KB.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | `React.lazy` + `Suspense` for component-level code splitting | `React.lazy` is the canonical React 19 pattern for component-level dynamic imports; Suspense handles the async loading state declaratively. |
| Vite | 8.0.8 | Rollup/Rolldown-based dynamic-chunk emission | Vite automatically splits a dynamic `import()` call into a separate chunk — no config change needed. The existing `manualChunks` rule targets only `vendor-react`; it will not absorb lazy chunks. |
| `react-pdf` | ^10.4.1 | PDF rendering (unchanged) | Already chosen in Phase 46/47; just being moved into a lazy chunk. |
| `pdfjs-dist` | 5.6.205 (pinned override) | PDF.js engine (unchanged) | Pinned via `overrides` in `package.json`; worker resolution via `?url` import already lives in `src/player/lib/pdfWorker.ts` and runs at module-initialization time (in `main.tsx`). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `<Suspense>` (React) | built-in | Fallback boundary for the lazy `PdfPlayer` | Wrap the PDF case in `PlayerRenderer.renderItem`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `React.lazy(() => import('./PdfPlayer'))` | Inline `import('./PdfPlayer').then(...)` inside a handler registry object | Lazy+Suspense is the React-idiomatic choice; a hand-rolled registry would duplicate what `React.lazy` already gives you. **Recommended: React.lazy.** |
| Lazy-load ALL six handlers | Lazy-load only `PdfPlayer` | Lazy-loading image/video would delay first paint in the common case. Only `PdfPlayer` carries meaningful weight (react-pdf is the outlier). **Recommended: PdfPlayer only.** |
| Move `pdfWorker.ts` import out of `main.tsx` into `PdfPlayer.tsx` | Keep it in `main.tsx` as today | `main.tsx` eagerly imports `pdfWorker.ts` which itself does a `?url` import of `pdfjs-dist/build/pdf.worker.min.mjs`. The `?url` import only emits the worker file and returns a string; it does NOT pull the worker code into the entry bundle. **Recommended: leave `main.tsx` alone.** The worker-URL string is 100-odd bytes; the worker body (1.2 MB / 358 KB gz) ships as `pdf.worker.min-*.mjs` and is loaded by the browser only when `<Document>` mounts. |

## Architecture Patterns

### Recommended edit: `PlayerRenderer.tsx`

```tsx
// Source: React 19 docs — https://react.dev/reference/react/lazy
import { Suspense, lazy, useEffect, useState } from "react";
import type { PlayerItem } from "./types";
import { ImagePlayer } from "./ImagePlayer";
import { VideoPlayer } from "./VideoPlayer";
// REMOVED: import { PdfPlayer } from "./PdfPlayer";
import { IframePlayer } from "./IframePlayer";
import { HtmlPlayer } from "./HtmlPlayer";
import { PptxPlayer } from "./PptxPlayer";

// SGN-POL-05: lazy-loaded so react-pdf + pdfjs-dist glue ship in a separate chunk,
// fetched only when a playlist item with kind='pdf' actually renders.
const PdfPlayer = lazy(() => import("./PdfPlayer").then((m) => ({ default: m.PdfPlayer })));

function renderItem(item: PlayerItem) {
  switch (item.kind) {
    case "image":
      return <ImagePlayer uri={item.uri} />;
    case "video":
      return <VideoPlayer uri={item.uri} />;
    case "pdf":
      return (
        <Suspense fallback={<div className="w-full h-full bg-black" />}>
          <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />
        </Suspense>
      );
    case "url":
      return <IframePlayer uri={item.uri} />;
    case "html":
      return <HtmlPlayer html={item.html} />;
    case "pptx":
      return <PptxPlayer slidePaths={item.slide_paths} durationS={item.duration_s} />;
    default:
      return null;
  }
}
```

Note the `.then((m) => ({ default: m.PdfPlayer }))` adapter — `PdfPlayer.tsx` currently uses a named export, not a default export. Either add `export default PdfPlayer;` to `PdfPlayer.tsx` OR use the adapter shown. **Recommended:** adapter (leaves `PdfPlayer.tsx` touchless, easier to revert).

### Size-guard edit: `frontend/scripts/check-player-bundle-size.mjs`

Single line change:

```js
const LIMIT = 200_000;  // was 210_000 (Phase 48 Plan 48-05 amendment, reset in Phase 50 SGN-POL-05)
```

Update the header comment block to reflect the history: "Phase 48 raised to 210_000; Phase 50 resets to 200_000 after dynamic-importing PdfPlayer + react-pdf."

### Scenario 4 methodology (reconnect → admin-mutation ≤ 30 s)

**Timing contract (what we're actually measuring):**

T0 = instant of admin clicking "Save" on a playlist item edit in the admin UI.
T1 = instant of the new content visibly appearing on the Pi HDMI display.
**Target: T1 − T0 ≤ 30 s** (the SGN-POL-04 acceptance number).

But Scenario 4 has a **preamble**: the Pi must be reconnecting from an offline state, not steady-state connected. So the full sequence is:

1. Pi connected, playing playlist. Baseline known-good.
2. `ssh signage@<pi>` and run `sudo nmcli device disconnect wlan0`. Record T_disconnect.
3. Wait ≥ 40 s. Watch `journalctl --user -u signage-sidecar -f`; confirm log line `"online=false"` (3 × 10 s probe failures). Playback must continue from cache (SGN-POL-03 / Scenario 3 already validated this in Phase 48).
4. `sudo nmcli device connect wlan0`. Record T_reconnect.
5. Wait for sidecar to log `"online=true"` again (next probe tick = up to 10 s).
6. **T0:** admin performs playlist mutation. Recommended mutation: swap item 1 ↔ item 2 via drag-drop, or delete the first item (both are high-signal: visible within one playback cycle if working). Record wall-clock.
7. **T1:** stopwatch stops when the new first item appears on screen. Record wall-clock.
8. Record T1 − T0.

**The 30 s budget decomposes as:**
- SSE event propagation: sub-second if the connection is re-established (Phase 45 pings every 15 s, so EventSource reconnect is sub-ping-interval).
- Worst case SSE not yet reconnected: 30 s polling fallback tick (`POLLING_MS = 30_000` in `useSseWithPollingFallback.ts`). This is the critical path.
- Current item's remaining playback duration: 0–item.duration_s. The new playlist only swaps in when the current item's auto-advance timer fires (PlayerRenderer uses `key={current.id}` + `setTimeout(advance, durationMs)`).

**Implication for the budget:** if the current playlist item has `duration_s > 30`, the 30 s budget cannot be met on the current frame — the mutation arrives in the TanStack cache, but PlayerRenderer doesn't pick it up until the next advance. **Recommendation for the methodology:** use a test playlist with short item durations (5 s each) so the advance-to-next tick is not the bottleneck. Document this as a methodology precondition.

**Reconnect mechanics (which command to use):**
- **Recommended:** `nmcli device disconnect wlan0` / `nmcli device connect wlan0`. Clean, reproducible, reversible, reads the SSID from the saved connection. Same command pattern as Phase 48 Scenario 3.
- **Alternative:** pulling Ethernet — fast, but most Pi installs will be Wi-Fi only and this requires physical cable access.
- **Avoid:** `systemctl restart NetworkManager` — restarts more than the interface; noisier logs; does not reliably trigger the sidecar's offline → online transition cleanly.

**Clocks to synchronize:**
| Clock source | Reads from | Why |
|---|---|---|
| Wall clock (laptop) | `date +%s.%N` at each key moment | Ground-truth anchor. |
| Pi journal | `journalctl --user -u signage-sidecar -f --output=short-precise` | See `online=true/false` transitions at μs precision. |
| Admin browser | Admin UI Network tab timestamp on the PATCH /api/signage/admin/… request | Server-accepted time of T0. |
| Backend log | `docker compose logs -f api | grep notify_device` | Instant of SSE fanout. |

A single operator with a phone stopwatch is sufficient; the combination of journalctl timestamps + wall clock covers all four anchors.

### Scenario 5 methodology (sidecar restart → playback continuity)

**Timing contract:**

T0 = `systemctl --user restart signage-sidecar` issued.
T1 = sidecar `/health` returns `ready: true` again (post-restart).
T2 = first fully successful `GET /media/<id>` after restart, confirming the player has regenerated.
**Primary assertion:** NO visible black frame between T0 and T2. Playback continuity is binary (yes/no), not a numeric threshold.
**Secondary metric:** T1 − T0 expected < 15 s (Restart=always + RestartSec=5 + uvicorn cold start).

**Why playback should survive a sidecar restart (the mechanics the plan must understand):**

1. Currently-rendered media is already in the `<img>/<video>/<canvas>` DOM element. The browser does NOT re-request the URL between frames. A Chromium `<img src="http://localhost:8080/media/XYZ">` that has already finished loading holds its decoded bitmap in memory; restarting the sidecar does nothing to that frame.
2. The next `localhost:8080/media/<id>` fetch (triggered when `PlayerRenderer` advances to the next item) may land during the sidecar's cold-start window. Two possible outcomes:
   - Sidecar is back up: fetch succeeds. Continuity preserved.
   - Sidecar is still starting: fetch fails (ECONNREFUSED). `<img>` shows a broken-image icon briefly. This is the edge case the plan should try to observe and record.
3. The player's `useSidecarStatus` 30 s interval re-probes `/health`. On detecting the sidecar has returned with `online=true`, it re-POSTs the cached device token (existing Phase 48 logic in `useSidecarStatus.ts` lines 67–75). Token re-auth is transparent — the sidecar's `/token` endpoint accepts re-posts idempotently.
4. The `useSseWithPollingFallback` SSE lives at `/api/signage/player/stream` — this goes to the **backend API via the network**, NOT through the sidecar. A sidecar restart does NOT break SSE.

**Procedure:**

1. Pi connected, playing a playlist of ≥ 3 short items (5 s each). Let it loop once so all items are in the sidecar's `/var/lib/signage/media/` cache (confirm with `ls /var/lib/signage/media/`).
2. Observer watches the Pi HDMI display continuously.
3. `sudo -u signage XDG_RUNTIME_DIR=/run/user/$(id -u signage) systemctl --user restart signage-sidecar`. Record T0.
4. Observer reports: any black frame? Any broken-image icon? Any error overlay?
5. Poll `curl http://localhost:8080/health` every 1 s until `ready: true`. Record T1.
6. Let playback continue for 30 s post-restart. Confirm no visible issues.
7. Record outcome: PASS (no visible interruption) / MINOR (momentary icon but recovered) / FAIL (black screen or stuck).

**What to record in the results file:**
- T1 − T0 (sidecar cold-start duration).
- Sidecar journal lines during restart (shows `Loaded persisted device token from disk`, etc.).
- Visual outcome.
- Number of successful `GET /media/<id>` fetches post-restart within 60 s (from sidecar access log).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component-level code splitting | A manual `useState` + `import()` + conditional render | `React.lazy` + `<Suspense>` | React 19's canonical primitive; handles error boundaries cleanly; integrates with React's concurrent features. |
| Lazy chunk emission (Vite config) | Manual `manualChunks` entry for `react-pdf` | Just use `import('./PdfPlayer')` — Vite auto-splits | Any dynamic `import()` becomes its own chunk automatically. Adding it to `manualChunks` would re-merge it into the eager bundle. |
| Stopwatch instrumentation for E2E | Custom instrumentation in the player JS that writes timestamps to localStorage | `journalctl --output=short-precise` on the Pi + admin Network tab timings | Already has μs precision; no code to add; no new failure modes. |
| "Offline detection" for Scenario 4 | Checking `navigator.onLine` in JS | The sidecar's existing `/health` probe loop + 3-strikes threshold | Already implemented. `navigator.onLine` famously lies. |

**Key insight:** Every line of new code in the player bundle fights SGN-POL-05. The E2E work is entirely operator runbook + results template — no code needed.

## Runtime State Inventory

This is a bundle-split + hardware-walkthrough phase. No rename/refactor/migration. **Section intentionally minimal.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — neither requirement touches database or cache layouts. | None. |
| Live service config | None — Pi OS, systemd units, and backend are unchanged by SGN-POL-05. SGN-POL-04 exercises existing services. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | `dist/player/assets/*` — will change when the dynamic import lands (new `PdfPlayer-[hash].js` chunk, smaller `player-[hash].js`). `check-player-bundle-size.mjs` LIMIT constant changes from 210_000 → 200_000. | Existing CI builds regenerate artifacts. No manual cleanup needed. Update the LIMIT source code in-place. |

## Common Pitfalls

### Pitfall 1: Default-vs-named-export mismatch in `React.lazy`

`React.lazy()` expects a module whose default export is the component. `PdfPlayer.tsx` exports `PdfPlayer` as a named export. The adapter `.then((m) => ({ default: m.PdfPlayer }))` is required, OR add `export default PdfPlayer;` to the component file.

**Prevention:** use the adapter form in `PlayerRenderer.tsx` (one-liner, keeps `PdfPlayer.tsx` touchless).

### Pitfall 2: `PlayerRenderer.tsx` is shared with the admin preview

Read `PlayerRenderer.tsx` lines 34–47 comment block: "Admin-preview PlayerRenderer (SGN-DIFF-02 / D-09, D-10). Accepts in-memory items (form state or server state)…". This file is imported by BOTH the player bundle (`PlaybackShell.tsx` line 7) AND the admin playlist-editor preview. The lazy-loading change affects both. On the admin side this is harmless (admin already ships its own bundle and pays for react-pdf there), but the import chain means you must test BOTH bundles build + run. Run `npm run build` (not just `npm run build:player`) and verify the admin playlist editor still shows a PDF preview.

**Prevention:** in plan verification, `npm run build` (both bundles) + visual smoke-check the admin playlist editor with a PDF item selected.

### Pitfall 3: The pdf.js worker `?url` import

`src/player/lib/pdfWorker.ts` does `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";` — this runs at `main.tsx` module-init time. **Dynamic-importing PdfPlayer does NOT move this.** The worker URL is a ~100-byte string; the 1.2 MB / 358 KB gz worker body is only fetched by the browser when `new Worker(workerUrl)` runs, which happens inside pdfjs-dist only when a `<Document>` mounts. So this is already lazy by browser mechanics even with the current static import. **Leave `main.tsx` and `pdfWorker.ts` alone.** Touching them risks introducing a worker-URL resolution bug.

**Known gotcha if someone moves the worker pin into `PdfPlayer.tsx`:** the first time `PdfPlayer` mounts, `GlobalWorkerOptions.workerSrc` is still unset because pdfjs tries to resolve the worker during `<Document>`'s first render. Result: pdfjs falls back to fake-worker mode (10× slower) or throws. **Prevention:** keep the pin in `main.tsx` where it runs before any React render.

### Pitfall 4: Suspense fallback visibility in a kiosk

A spinner or "loading…" text in a signage kiosk is a UX bug — it draws attention to the loading state. Use `<div className="w-full h-full bg-black" />` (already matches the surrounding `bg-black` from `PlaybackShell`). The lazy chunk is <50 KB gz; on the LAN a Pi will fetch it in <1 s, shorter than a typical item duration.

### Pitfall 5: Scenario 4 budget blown by long item durations

`PlayerRenderer` only advances when the current item's `duration_s` timer fires. If an item has `duration_s = 60`, the new playlist won't render until up to 60 s after the mutation arrives. **Method precondition:** test playlist items must have `duration_s ≤ 5` to keep the advance-tick off the critical path.

### Pitfall 6: Scenario 5 — sidecar's `ProtectSystem=strict` + `.pyc` regeneration

Per operator-runbook §5.2, the sidecar's venv is pre-compiled in provisioning step 5.5 (`python -m compileall`). If the plan author decides to restart with a bytecode-stale venv (e.g., after an unrelated code change), the sidecar will EROFS-error on `.pyc` writes. **Prevention:** don't change sidecar source during the walkthrough; if sidecar source MUST be changed, re-run `python3 -m compileall /opt/signage/pi-sidecar` before the restart test.

### Pitfall 7: Scenario 4 — SSE ?token= auth vs. backend Authorization header

Phase 47 OQ4 resolved this: `get_current_device` accepts EITHER `Authorization: Bearer` OR `?token=` query param. Nothing to watch for in Phase 50, but if Scenario 4 shows SSE never reconnects, check that backend OQ4 patch is still live (search for `request.query_params` in `backend/app/deps/signage_auth.py` or equivalent).

## Code Examples

Verified patterns ready to drop into the plan:

### Example 1: React.lazy with named-export adapter (SGN-POL-05)
```tsx
// Source: React 19 docs — https://react.dev/reference/react/lazy#suspense-for-code-splitting
// frontend/src/signage/player/PlayerRenderer.tsx
import { Suspense, lazy } from "react";

const PdfPlayer = lazy(() =>
  import("./PdfPlayer").then((m) => ({ default: m.PdfPlayer }))
);

// In renderItem:
case "pdf":
  return (
    <Suspense fallback={<div className="w-full h-full bg-black" />}>
      <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />
    </Suspense>
  );
```

### Example 2: Scenario 4 single-command capture block
```bash
# On the Pi, in one terminal:
sudo -u signage journalctl --user -u signage-sidecar -f --output=short-precise \
  | grep -E "online=|error|reconnect"

# On the operator laptop, in a second terminal:
date +"%Y-%m-%dT%H:%M:%S.%N T_disconnect"; ssh signage@<pi> sudo nmcli device disconnect wlan0

# Wait 45 s...

date +"%Y-%m-%dT%H:%M:%S.%N T_reconnect"; ssh signage@<pi> sudo nmcli device connect wlan0

# Perform admin mutation (swap playlist items 1 and 2 in admin UI).
date +"%Y-%m-%dT%H:%M:%S.%N T0"

# Watch Pi screen. When new first item appears:
date +"%Y-%m-%dT%H:%M:%S.%N T1"

# Compute T1 - T0 from the captured timestamps.
```

### Example 3: Scenario 5 observer + assertion
```bash
# On operator laptop, SSH'd to Pi:
SIGNAGE_UID=$(id -u signage)

# Capture T0 + restart + poll /health until ready:
date +"%Y-%m-%dT%H:%M:%S.%N T0" \
  && sudo -u signage XDG_RUNTIME_DIR=/run/user/${SIGNAGE_UID} \
       systemctl --user restart signage-sidecar \
  && until curl -fs http://localhost:8080/health | grep -q '"ready":true'; do sleep 1; done \
  && date +"%Y-%m-%dT%H:%M:%S.%N T1"

# Observer manually records visual outcome (black frame y/n) for the 0–30 s window.
```

## 50-E2E-RESULTS.md template (proposed — planner copies verbatim)

The template below intentionally mirrors Phase 48's `48-E2E-RESULTS.md` structure so operators see a familiar layout. Only Scenarios 4 and 5 appear. Preconditions + summary sections are retained so the document stands alone.

```markdown
# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)

**Status:** PENDING — awaiting real Pi hardware walkthrough by operator.

**Date:** _YYYY-MM-DD_
**Hardware:** Raspberry Pi _[model]_ — _[RAM]_
**Pi OS version:** _[cat /etc/os-release VERSION_ID]_ (must be Bookworm Lite 64-bit)
**Chromium version:** _[chromium-browser --version]_
**Sidecar version:** _[git rev-parse --short HEAD of /opt/signage]_
**Backend version:** _[git rev-parse --short HEAD of deployed backend]_
**Network:** _[Wi-Fi SSID, approx distance from AP, 2.4 or 5 GHz]_

## Preconditions

- [ ] Pi provisioned via `scripts/provision-pi.sh` on fresh Bookworm Lite 64-bit (no `.img.xz` path).
- [ ] All three services active: `labwc`, `signage-sidecar`, `signage-player`.
- [ ] Device paired and playing a **test playlist** with ≥ 3 items, each `duration_s = 5`. (Short durations so PlayerRenderer advance-tick doesn't dominate Scenario 4 timing.)
- [ ] At least one loop completed so all media is cached in `/var/lib/signage/media/`.
- [ ] Baseline `curl http://localhost:8080/health` returns `{"ready":true,"online":true,"cached_items":N≥3}`.
- [ ] Operator has SSH access, admin browser window open to `/signage/playlists/<id>`, and stopwatch / wall clock synchronized.

## Scenario 4: Reconnect → Admin Change Arrives ≤ 30 s

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 4.1 `sudo nmcli device disconnect wlan0` on Pi | Succeeds; playlist keeps playing from cache | | | T_disconnect: ___ |
| 4.2 Wait 40 s; verify sidecar log shows `online=false` after ~30 s | Sidecar transitions offline | | | T_offline_confirmed: ___ |
| 4.3 `sudo nmcli device connect wlan0` on Pi | Succeeds; sidecar log shows `online=true` within 15 s | | | T_reconnect: ___, T_online_confirmed: ___ |
| 4.4 Admin performs playlist mutation (swap items 1↔2 OR delete item 1) | HTTP 200 in admin Network tab | | | T0: ___ |
| 4.5 Updated playlist visible on Pi display | New item plays within the 30 s budget | | | T1: ___ |
| 4.6 Compute T1 − T0 | ≤ 30.0 s | | | **T1 − T0: ___ s** |

**Pass criterion:** row 4.6 ≤ 30.0 s AND no black screen AND no error banner.

**Notes / anomalies:**
_(free text — SSE reconnect observed? Polling fallback fired? Any unexpected journal lines?)_

## Scenario 5: Sidecar Restart → Playback Continuity

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 5.1 `systemctl --user restart signage-sidecar` | Issued cleanly | | | T0: ___ |
| 5.2 Observer watches display continuously for 30 s | **No black frame, no broken-image icon, no error overlay** | | | — |
| 5.3 `curl localhost:8080/health` polled every 1 s until `ready:true` | Returns ready within 15 s | | | T1: ___ (T1 − T0: ___ s) |
| 5.4 Sidecar log shows `Loaded persisted device token from disk.` | Yes | | | — |
| 5.5 Next 60 s of playback | No visible interruption; items continue to advance on schedule | | | items observed: ___ |
| 5.6 SSE still working (optional: make an admin mutation now and watch) | New mutation renders on Pi ≤ 10 s | | | — |

**Pass criterion:** 5.2 PASS (zero visible interruption) AND 5.3 ≤ 15 s.

**Notes / anomalies:**

## Pass/Fail Summary

| Scenario | Result | Critical metric | Notes |
|----------|--------|-----------------|-------|
| 4: Reconnect → admin-mutation | | T1 − T0 = ___ s (≤ 30 target) | |
| 5: Sidecar restart | | Visual continuity: PASS/FAIL; cold-start: ___ s | |

## Operator sign-off

- [ ] Scenario 4 PASS with numerical T1 − T0 recorded.
- [ ] Scenario 5 PASS with visual-continuity assertion + cold-start time recorded.
- [ ] No regressions observed against Phase 48 Scenarios 1–3 baseline.

Reviewer: _________________________  Date: ______________
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ship `.img.xz` with minisign signatures | Single-path `scripts/provision-pi.sh` on stock Bookworm Lite | 2026-04-21 | Removes 4 former requirements (POL-01/02/03/06); simplifies Phase 50 to 2 requirements. |
| Static import of `PdfPlayer` in `PlayerRenderer.tsx` | Dynamic `React.lazy(() => import(...))` | Phase 50 (this phase) | Player entry drops ~30–50 KB gz; bundle back under 200 KB limit. |

**Deprecated / not to touch:**
- `pi-image/` directory — **removed 2026-04-21.** Do not reinstate.
- `.github/workflows/pi-image.yml` — **removed 2026-04-21.** Do not reinstate.
- `scripts/lib/signage-packages.txt` ↔ `00-packages-nr` drift-check — drift check is gone (former partner file deleted). The `signage-packages.txt` is still canonical for `provision-pi.sh`; just no longer mirrored.

## Open Questions

### OQ1: Fresh-build starting-point bundle size

**What we know:** STATE.md says 204,456 bytes / 204 KB gz on the last measurement (Phase 47 Plan 47-05 UAT decision). The `dist/` artifact on disk reads 199.7 KB (stale; pre-dates some post-Phase-47 changes). Phase 48 Plan 48-05 raised LIMIT to 210_000 to unblock the Tailwind CSS fix.
**What's unclear:** the precise starting-point number as of commit `bea2205` (current `main`).
**Recommendation:** Plan 50-01's first step is `rm -rf frontend/dist/player && cd frontend && npm run build:player && node scripts/check-player-bundle-size.mjs` to measure the true baseline before the dynamic-import edit. Record the before/after in the plan's SUMMARY.

### OQ2: Does the admin bundle also need attention?

**What we know:** Admin bundle is not guarded and currently ships react-pdf eagerly (used in the playlist-editor preview). Admin doesn't have a 200 KB budget.
**What's unclear:** whether the admin bundle gets bigger or smaller after the edit.
**Recommendation:** The `PlayerRenderer` change is shared with admin — the admin bundle will also lazy-load PdfPlayer. This is **neutral-to-positive** for admin (smaller initial bundle, slightly slower first preview of a PDF playlist item). Verify `npm run build` (both bundles) passes; no admin regressions expected.

### OQ3: Scenario 4 reconnect-mechanism reproducibility

**What we know:** `nmcli device disconnect wlan0 && nmcli device connect wlan0` is the cleanest path on Bookworm Lite (NetworkManager is in the provisioning apt list). Confirmed via `scripts/README-pi.md` + Phase 48 Scenario 3 precedent.
**What's unclear:** on a Pi 3B that may default to X11 + wpa_supplicant rather than NetworkManager, `nmcli` may not exist.
**Recommendation:** Scenario 4 walkthrough is for Pi 4/5 (recommended hardware per operator runbook §1). If the operator only has a Pi 3B, document `ip link set wlan0 down && ip link set wlan0 up` as a fallback. Flag in the walkthrough preconditions.

### OQ4: How often does SGN-POL-04 realistically achieve "SSE still up at reconnect" vs. "polling fallback fires"?

**What we know:** `useSseWithPollingFallback` has 45 s watchdog + 30 s polling interval. After a 40 s disconnect + reconnect, the EventSource was torn down (onerror fired on disconnect; watchdog fired ~45 s later; polling started). On reconnect, the next poll tick is within ≤ 30 s, and on success the code attempts SSE reconnect (lines 136–146). So realistic best-case reconnect → invalidate is driven by the polling tick, not the SSE.
**What's unclear:** whether we'll consistently hit the <30 s budget.
**Recommendation:** this is exactly what Scenario 4 is testing. If the measured T1 − T0 consistently exceeds 30 s, it's a genuine finding that will need a follow-up defect — NOT a reason to block the phase. Document the observed number honestly.

## Environment Availability

| Dependency | Required By | Available (on operator's laptop) | Notes |
|------------|------------|-----------|-------|
| Node.js (for `npm run build`) | SGN-POL-05 | Assumed ✓ — project already builds locally in other phases | — |
| `ssh` to Pi | SGN-POL-04 | Assumed ✓ — operator has physical Pi access | — |
| `curl` on Pi | SGN-POL-04 | ✓ — installed by `provision-pi.sh` step 1 | — |
| `nmcli` on Pi | SGN-POL-04 | ✓ — `network-manager` in provisioning apt list | — |
| `journalctl` on Pi | SGN-POL-04 | ✓ — systemd core | — |
| A physical Pi (4 or 5 preferred) | SGN-POL-04 | ✓ per phase brief (single Pi) | Pi 3B fallback noted in OQ3 |
| Admin UI access + a test playlist | SGN-POL-04 | ✓ existing milestone artifact | — |

**No blocking dependencies.** All tools required are already in the provisioning baseline.

## Sources

### Primary (HIGH confidence)
- React 19 docs on `lazy` + Suspense — https://react.dev/reference/react/lazy (well-known stable API, unchanged since React 18).
- Vite 8 docs on dynamic imports & code splitting — https://vite.dev/guide/features#dynamic-import (unchanged behavior: any `import()` becomes its own chunk automatically).
- Project source (direct inspection):
  - `frontend/src/signage/player/PlayerRenderer.tsx` — the file to edit
  - `frontend/src/signage/player/PdfPlayer.tsx` — named-export target
  - `frontend/src/player/main.tsx` + `frontend/src/player/lib/pdfWorker.ts` — why worker pin stays put
  - `frontend/vite.config.ts` — confirms no `manualChunks` entry blocks auto-splitting
  - `frontend/scripts/check-player-bundle-size.mjs` — confirms `.js`-only filter (pdf.worker `.mjs` excluded from guard total)
  - `frontend/src/player/hooks/useSseWithPollingFallback.ts` — timing constants (45 s watchdog, 30 s polling)
  - `frontend/src/player/hooks/useSidecarStatus.ts` — 30 s re-probe, token re-post on sidecar-restart transition
  - `pi-sidecar/sidecar.py` — 10 s probe loop, 3-strike offline threshold, ETag-aware playlist cache, persisted token-on-disk
  - `docs/operator-runbook.md` — §5.2 sidecar hardening + `ProtectSystem=strict`; §9.2 restart sidecar procedure
  - `scripts/README-pi.md` — provisioning contract
  - `.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md` — Phase 48 template to mirror
- Measured current bundle: see §"Bundle Composition — current state" table.

### Secondary (MEDIUM confidence)
- React.lazy default-vs-named-export adapter pattern — well-documented community idiom; verified against Phase 46/47 project patterns (no prior `React.lazy` in this repo, so no existing project convention to align with).

### Tertiary (LOW confidence)
- Exact gz-savings forecast (30–50 KB) — napkin math from react-pdf@10 known size footprint; the fresh-build measurement in Plan 50-01 step 1 will confirm.

## Metadata

**Confidence breakdown:**
- Standard stack (React.lazy + Vite auto-split): **HIGH** — canonical API, stable since React 18, well-documented.
- Bundle-composition analysis: **HIGH** — measured directly from `dist/player/assets/`.
- Scenario 5 mechanics (sidecar-restart survival): **HIGH** — source-read from `sidecar.py` + `useSidecarStatus.ts`; mechanism well-understood.
- Scenario 4 reconnect + SSE/polling timing: **MEDIUM** — code path understood, but no prior hardware timing data in Phase 48 results to anchor the 30 s budget against. Realistic assessment in OQ4.
- 50-E2E-RESULTS.md template: **HIGH** — direct adaptation of Phase 48's proven template.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable-stack research; no fast-moving dependencies). Bundle numbers should be re-measured by Plan 50-01 Task 1 against commit-of-record.
