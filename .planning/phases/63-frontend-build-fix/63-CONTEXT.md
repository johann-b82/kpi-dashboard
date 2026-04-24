# Phase 63: Frontend Build Fix — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Fast path — scope locked from ROADMAP + live npm registry inspection

## Goal

`docker compose build --no-cache frontend` exits 0 without any manual workaround. `npm run dev` + `npm run build` continue to work on host unchanged. No regression in the dev inner loop.

## The problem, captured on `main@<head>`

Live npm registry check (2026-04-24):

```
$ npm view vite-plugin-pwa versions --json
[..., "1.0.0", ..., "1.2.0"]               # 1.2.0 is the latest release

$ npm view vite-plugin-pwa@1.2.0 peerDependencies
{
  vite: '^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0',
  ...
}

$ grep '"vite"' frontend/package.json
    "vite": "^8.0.4",
    "vite-plugin-pwa": "^1.2.0",
```

**No upstream version of `vite-plugin-pwa` accepts `vite@8` today.** Path (b) "upgrade the plugin" doesn't exist.

## Locked decisions

### D-01: Use `--legacy-peer-deps`

Dockerfile `npm install` becomes `npm install --legacy-peer-deps`. This is the only viable path given the upstream gap. Documented rationale in SUMMARY.

### D-02: Do NOT pin vite back to 7

Vite 8 is the shipped baseline (v1.18+). Regressing to vite@7 would impact the player bundle, HMR semantics, Tailwind v4 integration, and tsc-check pipeline. Out of scope.

### D-03: Do NOT swap the PWA plugin

`vite-plugin-pwa` is already integrated for the `/player/*` kiosk bundle (precached shell, workbox). Swapping for a different plugin or inlining workbox is a multi-day refactor. Out of scope.

### D-04: Root `.npmrc` carries `legacy-peer-deps=true`

So host `npm install` matches container behaviour. Prevents silent drift where `docker compose build` works but a fresh `npm install` on a dev machine errors. File lives at `frontend/.npmrc` to scope to the frontend workspace.

### D-05: Document the workaround as transitional

SUMMARY + a `TODO-UPSTREAM.md` (or equivalent comment at the top of `.npmrc` / Dockerfile) must cite the blocker (`vite-plugin-pwa` peer range) and link a monitoring hook — revisit when `vite-plugin-pwa@1.3+` (or equivalent) adds vite@8 to peer-deps.

### D-06: Verify BOTH container + host builds

Phase done condition: 3 commands exit 0 in sequence:

1. `docker compose build --no-cache frontend` (covers BUILD-01)
2. `cd frontend && npm install --legacy-peer-deps && npm run build` (covers BUILD-03 host build)
3. `cd frontend && npm run dev` starts and serves `/` in dev mode (covers BUILD-03 dev server — spot-check, no E2E)

### D-07: One plan, one wave, autonomous

Small and well-defined. No human-verify checkpoint.

## Claude's discretion

- Whether `frontend/.npmrc` goes under the frontend workspace or at the repo root. **Guidance:** `frontend/.npmrc` is cleaner — keeps the workaround scoped.
- Whether to also add a comment pointing to the tracking issue inside the Dockerfile `RUN` line, or leave that only in SUMMARY. Either is fine — prefer minimal Dockerfile pollution.
- Whether existing `package-lock.json` needs regeneration after the flag change. If lockfile already encodes `vite@8`, probably not — but test both fresh-install and incremental-install paths.

## Requirements

| Req ID | Plan |
|---|---|
| BUILD-01 `docker compose build` succeeds | 63-01 |
| BUILD-02 chosen path documented in SUMMARY | 63-01 |
| BUILD-03 dev + host build unchanged | 63-01 |

## Dependencies

- **Upstream:** none (independent of Phase 62).
- **Downstream:** clean build unblocks `/gsd:complete-milestone 1.21`.

## Non-goals (explicit)

- No `vite-plugin-pwa` upgrade (none available).
- No `vite` downgrade.
- No PWA plugin swap.
- No broader CI refactor.
- No lockfile regeneration for its own sake — only if testing shows it's required.

## Canonical refs

- `frontend/Dockerfile` (line 4 — the `RUN npm install` that fails)
- `frontend/package.json` (`vite` + `vite-plugin-pwa` deps)
- `frontend/.npmrc` — create if absent
- `.planning/milestones/v1.20-MILESTONE-AUDIT.md` § "Infrastructure hygiene" — origin of this carry-forward
