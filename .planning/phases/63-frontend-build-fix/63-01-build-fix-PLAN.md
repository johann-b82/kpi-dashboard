---
phase: 63-frontend-build-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/Dockerfile
  - frontend/.npmrc
autonomous: true
requirements:
  - BUILD-01
  - BUILD-02
  - BUILD-03

must_haves:
  truths:
    - "`docker compose build --no-cache frontend` exits 0 from a clean state without manual workarounds (BUILD-01)"
    - "A fresh host `cd frontend && npm install` succeeds without requiring the developer to pass `--legacy-peer-deps` on the CLI (it is read from `frontend/.npmrc`)"
    - "`cd frontend && npm run build` exits 0 and produces the expected `dist/` (admin) + `dist/player/index.html` artifacts (BUILD-03 host build)"
    - "`cd frontend && npm run dev` boots and serves `/` over HTTP on the expected port (BUILD-03 dev loop)"
    - "The workaround is documented in-file (comment in `.npmrc`) so the next developer immediately understands why the flag exists and when to remove it (BUILD-02 doc trail)"
  artifacts:
    - path: "frontend/Dockerfile"
      provides: "Container image build step that installs npm deps with --legacy-peer-deps"
      contains: "npm install --legacy-peer-deps"
    - path: "frontend/.npmrc"
      provides: "Host-side npm config that mirrors the container flag, with a tracking comment"
      contains: "legacy-peer-deps=true"
  key_links:
    - from: "frontend/Dockerfile line 4"
      to: "npm's peer-dep resolver"
      via: "--legacy-peer-deps CLI flag"
      pattern: "npm install --legacy-peer-deps"
    - from: "frontend/.npmrc"
      to: "host `npm install` invocations"
      via: "npm auto-loads workspace .npmrc"
      pattern: "legacy-peer-deps=true"
    - from: "frontend/.npmrc comment"
      to: "vite-plugin-pwa peer-dep issue (vite@8 not yet in peer range)"
      via: "inline tracking note for future removal"
      pattern: "vite-plugin-pwa"
---

<objective>
Unblock `docker compose build --no-cache frontend` (currently failing on line 4 `RUN npm install` because `vite-plugin-pwa@1.2.0`'s peerDependencies cap vite at `^7.0.0` and this repo pins `vite@^8.0.4`) by applying `npm install --legacy-peer-deps` in both the container and host install paths.

Purpose: Clean builds unblock `/gsd:complete-milestone 1.21`. The workaround is transitional — live npm-registry inspection on 2026-04-24 confirmed no released `vite-plugin-pwa` version accepts `vite@8`, so "upgrade the plugin" is not available (CONTEXT D-01). Downgrading vite (D-02) and swapping the PWA plugin (D-03) are both out of scope.

Output: Two file edits — `frontend/Dockerfile` (line 4 flag addition) and a new `frontend/.npmrc` carrying `legacy-peer-deps=true` plus a tracking comment. Nothing else changes.
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
@.planning/phases/63-frontend-build-fix/63-CONTEXT.md
@frontend/Dockerfile
@frontend/package.json

<interfaces>
<!-- Evidence captured live from npm registry on 2026-04-24 (see 63-CONTEXT.md): -->
<!-- -->
<!-- $ npm view vite-plugin-pwa versions --json -->
<!-- latest = 1.2.0 (no newer release accepts vite@8) -->
<!-- -->
<!-- $ npm view vite-plugin-pwa@1.2.0 peerDependencies -->
<!-- { vite: '^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0', ... } -->
<!-- -->
<!-- frontend/package.json pins: -->
<!--   "vite": "^8.0.4"          (do NOT touch — D-02) -->
<!--   "vite-plugin-pwa": "^1.2.0"  (do NOT swap — D-03) -->
<!-- -->
<!-- Current failing line (frontend/Dockerfile:4): -->
<!--   RUN npm install -->
<!-- -->
<!-- Target line: -->
<!--   RUN npm install --legacy-peer-deps -->
<!-- -->
<!-- package.json already has a `//vite-plugin-pwa` comment-field noting the -->
<!-- workaround — the Dockerfile and .npmrc must align with that note. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply --legacy-peer-deps to container + host install paths</name>
  <files>frontend/Dockerfile, frontend/.npmrc</files>
  <action>
    Two surgical changes. Nothing else.

    **1. Edit `frontend/Dockerfile` line 4.**

    Change:
    ```
    RUN npm install
    ```
    to:
    ```
    RUN npm install --legacy-peer-deps
    ```

    Do NOT add a verbose comment to the Dockerfile (per CONTEXT Claude's-discretion guidance: "prefer minimal Dockerfile pollution"). The tracking note lives in `frontend/.npmrc` (next step) and in the existing `//vite-plugin-pwa` comment-field in `frontend/package.json` (already present — do not duplicate). Do NOT change any other Dockerfile line — base image, WORKDIR, COPY steps, EXPOSE, and CMD remain exactly as-is. Implements D-01, satisfies BUILD-01.

    **2. Create `frontend/.npmrc`** (the file does not currently exist — confirmed via `ls frontend/.npmrc` → ENOENT). File contents:

    ```
    # Transitional workaround: vite-plugin-pwa@1.2.0 peerDependencies cap at
    # vite ^7.0.0, but this project ships on vite@^8.0.4. Live npm registry
    # check on 2026-04-24 confirmed no released vite-plugin-pwa version
    # accepts vite@8. Remove this file when vite-plugin-pwa publishes a
    # release with vite ^8.0.0 in peerDependencies (track upstream issue #918).
    # Mirrors the Dockerfile `npm install --legacy-peer-deps` flag so host
    # installs do not diverge from container installs. See
    # .planning/phases/63-frontend-build-fix/63-CONTEXT.md (D-01, D-04, D-05).
    legacy-peer-deps=true
    ```

    Place the file at `frontend/.npmrc` (scoped to the workspace — NOT at repo root) per D-04. Implements D-04 + D-05, satisfies BUILD-02.

    **Do NOT:**
    - Touch `frontend/package.json` (vite pin stays at `^8.0.4` per D-02; vite-plugin-pwa pin stays at `^1.2.0` per D-03; the existing `//vite-plugin-pwa` comment-field is already correct).
    - Regenerate `frontend/package-lock.json` eagerly. Only regenerate if Task 2's fresh-install verification shows it's required.
    - Create a repo-root `.npmrc` (D-04 explicitly scopes this to `frontend/`).
    - Add `--legacy-peer-deps` anywhere beyond the Dockerfile line 4 + the `.npmrc` file.
  </action>
  <verify>
    <automated>test "$(grep -c -- '--legacy-peer-deps' frontend/Dockerfile)" -ge 1 && test -f frontend/.npmrc && grep -q '^legacy-peer-deps=true$' frontend/.npmrc && grep -q 'vite-plugin-pwa' frontend/.npmrc && grep -q '"vite": "\^8' frontend/package.json && grep -q '"vite-plugin-pwa": "\^1.2.0"' frontend/package.json && docker compose build --no-cache frontend</automated>
  </verify>
  <done>
    - `frontend/Dockerfile` line 4 reads `RUN npm install --legacy-peer-deps`; all other lines unchanged.
    - `frontend/.npmrc` exists, contains `legacy-peer-deps=true`, and contains a comment mentioning `vite-plugin-pwa` as the tracking reason.
    - `frontend/package.json` `vite` pin still `^8.x` and `vite-plugin-pwa` pin still `^1.2.0` (neither downgraded nor swapped).
    - `docker compose build --no-cache frontend` exits 0 — BUILD-01 satisfied.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify host dev + host build paths are unregressed</name>
  <files>frontend/package-lock.json (only if clean-slate install regenerates it — otherwise no file changes)</files>
  <action>
    Confirm BUILD-03: the developer's host-side inner loop (`npm install` → `npm run build` → `npm run dev`) still works after the Task 1 changes.

    **1. Clean-slate install.** Remove any existing `frontend/node_modules` so the install runs from scratch:
    ```
    rm -rf frontend/node_modules
    ```
    Do NOT delete `frontend/package-lock.json` up front — we want to first verify the existing lockfile is compatible with the new flag. Only regenerate if npm rejects it.

    **2. Run host install WITHOUT passing the flag on the CLI.** The `.npmrc` created in Task 1 must supply it:
    ```
    cd frontend && npm install
    ```
    Expected: exit 0. If it errors with a peer-dep complaint, the `.npmrc` is not being picked up — fix before proceeding (likely a typo in the filename or content).

    **3. Run host production build.** Covers admin + player bundles (the build script runs `tsc -b && vite build && vite build --mode player && node -e "...rename player.html to index.html"`):
    ```
    cd frontend && npm run build
    ```
    Expected: exit 0. Confirms tsc, admin vite build, player vite build, and the player-index rename step all pass.

    **4. Spot-check the dev server boots.** Start `npm run dev` in the background, wait until it serves `/`, then kill it. One pragmatic invocation (adjust port if project convention differs):
    ```
    cd frontend && (npm run dev >/tmp/phase63-dev.log 2>&1 &) ; DEV_PID=$! ; \
      for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
        curl -sSf -o /dev/null http://localhost:5173/ && break ; sleep 1 ; \
      done ; \
      curl -sSf -o /dev/null http://localhost:5173/ ; RC=$? ; \
      pkill -f "vite" || true ; \
      test $RC -eq 0
    ```
    Expected: `curl` eventually gets HTTP 200 on `/`, then the server is torn down. The dev command itself must not crash with a peer-dep error at boot.

    **If clean-slate install in step 2 requires the lockfile to be regenerated** (npm prints something like "lockfile has conflicting peer deps"), then and only then delete `frontend/package-lock.json`, rerun `npm install`, and commit the regenerated lockfile. CONTEXT non-goals are explicit: "No lockfile regeneration for its own sake — only if testing shows it's required." Document the decision in the SUMMARY.

    **Do NOT:**
    - Change `frontend/package.json` scripts, deps, or devDeps.
    - Run E2E / Playwright — out of scope for this phase (dev server boot + production build exit code are enough, per D-06).
    - Skip the clean-slate `rm -rf node_modules` (an incremental install can hide the regression we're actually guarding against).
  </action>
  <verify>
    <automated>rm -rf frontend/node_modules && cd frontend && npm install && npm run build && (npm run dev >/tmp/phase63-dev.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -sSf -o /dev/null http://localhost:5173/ && break; sleep 1; done && curl -sSf -o /dev/null http://localhost:5173/ && pkill -f "vite" || true</automated>
  </verify>
  <done>
    - `rm -rf frontend/node_modules && cd frontend && npm install` exits 0 on a clean slate, with the `--legacy-peer-deps` behaviour coming from `frontend/.npmrc` (no CLI flag passed).
    - `npm run build` exits 0 and produces `frontend/dist/` (admin) + `frontend/dist/player/index.html` (the player rename step ran).
    - `npm run dev` boots far enough to serve HTTP 200 on `/` within ~15s.
    - `frontend/package.json` still pins `vite` to `^8.x` and `vite-plugin-pwa` to `^1.2.0` — no silent drift.
    - BUILD-03 satisfied (dev + host build unchanged). Combined with Task 1, BUILD-01 + BUILD-02 + BUILD-03 are all green.
  </done>
</task>

</tasks>

<verification>
All three BUILD-* requirements must be independently demonstrable:

- **BUILD-01 (container):** `docker compose build --no-cache frontend` exits 0. Gated by Task 1 `<verify>`.
- **BUILD-02 (documented path):** `frontend/.npmrc` contains `legacy-peer-deps=true` + a comment citing `vite-plugin-pwa`'s peer-dep range as the tracking reason; the SUMMARY for this plan will expand on rationale + link back to the 2026-04-24 npm-registry evidence in 63-CONTEXT.md (D-05). Gated by Task 1 `<verify>` (grep checks the `.npmrc` contents).
- **BUILD-03 (host unchanged):** Clean-slate `npm install` + `npm run build` + `npm run dev` all succeed on the host. Gated by Task 2 `<verify>`.

Final sanity grep (run after both tasks):
```
grep -- '--legacy-peer-deps' frontend/Dockerfile && \
  grep '^legacy-peer-deps=true$' frontend/.npmrc && \
  grep '"vite": "\^8' frontend/package.json && \
  grep '"vite-plugin-pwa": "\^1.2.0"' frontend/package.json
```
Must print all four lines — confirms the flag is present in both install paths AND neither pin was touched.
</verification>

<success_criteria>
- [ ] `frontend/Dockerfile` line 4 is `RUN npm install --legacy-peer-deps`; rest of the file byte-identical to pre-change.
- [ ] `frontend/.npmrc` exists with `legacy-peer-deps=true` and a tracking comment mentioning `vite-plugin-pwa`.
- [ ] `frontend/package.json` untouched (vite `^8.x`, vite-plugin-pwa `^1.2.0`).
- [ ] `docker compose build --no-cache frontend` exits 0 on a clean Docker state.
- [ ] `rm -rf frontend/node_modules && cd frontend && npm install && npm run build` exits 0.
- [ ] `npm run dev` serves HTTP 200 on `/` within 15s of start.
- [ ] SUMMARY cites the upstream tracking reason (`vite-plugin-pwa` peer range stops at vite ^7) and notes the removal trigger (upstream release accepting vite ^8).
- [ ] Milestone v1.21 is unblocked for `/gsd:complete-milestone 1.21`.
</success_criteria>

<output>
After completion, create `.planning/phases/63-frontend-build-fix/63-01-build-fix-SUMMARY.md`. The SUMMARY must:

1. Cite the upstream tracking reason per D-05: `vite-plugin-pwa@1.2.0` peerDependencies = `vite: ^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`, which rejects `vite@^8.0.4`.
2. Note the live npm-registry evidence date (2026-04-24) so a future reader can re-check quickly.
3. State why the other two paths were rejected: D-02 (no vite downgrade) + D-03 (no PWA plugin swap) per CONTEXT.
4. Document the removal trigger: when `vite-plugin-pwa` publishes a release whose peerDependencies include `vite ^8.0.0`, delete `frontend/.npmrc` and drop `--legacy-peer-deps` from `frontend/Dockerfile`. Re-run the Task 2 verification chain to confirm.
5. Record whether `frontend/package-lock.json` was regenerated during Task 2 (and if so, why).
6. Confirm BUILD-01 / BUILD-02 / BUILD-03 status (all green) with the exact verification commands used.
</output>
