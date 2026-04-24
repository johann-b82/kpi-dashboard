# Phase 66: Kill `me.py` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 66-kill-me-py
**Areas discussed:** Role mapping, User shape, Failure mode, CI guard, Name map normalization, Profile slice location

---

## Role mapping — How should the frontend map Directus role → 'admin' | 'viewer'?

| Option | Description | Selected |
|--------|-------------|----------|
| readMe role.name → lowercase | readMe({fields:['id','email','first_name','last_name','avatar','role.name']}). Map role.name.toLowerCase() → 'admin'|'viewer'. No new env vars, resilient to UUID drift. | ✓ |
| UUID match via new VITE envs | Add VITE_DIRECTUS_ADMIN_ROLE_UUID + VITE_DIRECTUS_VIEWER_ROLE_UUID; mirror backend exactly but expand env surface. | |
| Runtime config fetch | Backend config endpoint returning role UUIDs; adds a round-trip and a new endpoint. | |

**User's choice:** readMe role.name → lowercase (Recommended)
**Notes:** Refined in follow-up — Directus roles are literally "Administrator" and "Viewer", so a lowercase transform doesn't land on 'admin'/'viewer'. Replaced with an explicit switch (see "Name map normalization" below).

---

## User shape — Should AuthUser expand to include first_name, last_name, avatar?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand AuthUser to full shape | { id, email, first_name, last_name, role, avatar }. Simple, single source of truth. | |
| Keep AuthUser minimal, add separate profile slice | AuthContext stays { id, email, role }; separate hook for profile fields. | ✓ |
| Keep minimal, ignore extra fields for now | Under-delivers on roadmap success criterion #1. | |

**User's choice:** Keep AuthUser minimal, add separate profile slice
**Notes:** Drove the follow-up on where the slice lives — landed on a dedicated React Query hook.

---

## Failure mode — What should happen if readMe fails after silent refresh succeeds?

| Option | Description | Selected |
|--------|-------------|----------|
| Match current behavior: clear auth → /login | Same try/catch as today's /api/me path. | ✓ |
| Retry once with backoff, then clear | Friendlier UX; adds code; diverges from today. | |
| Keep token, surface error banner | Risk of half-authenticated UI. | |

**User's choice:** Match current behavior: clear auth → /login (Recommended)
**Notes:** One-to-one swap with the existing behavior; no new failure semantics.

---

## CI guard — What should the `/api/me` CI guard look like and where should it live?

| Option | Description | Selected |
|--------|-------------|----------|
| New frontend-guard step in existing workflow | Inline grep step in .github/workflows/ci.yml; fails on literal '/api/me' in frontend/src. | ✓ |
| Shell script in scripts/ci/ invoked by workflow | Reusable pattern for future endpoint-kill phases. | |
| Broader pattern: grep + backend router absence | Most defensive; most code. | |

**User's choice:** New frontend-guard step in existing workflow (Recommended)
**Notes:** Reusable `scripts/ci/no-api-*.sh` pattern deferred for after Phase 67/68 prove the shape.

---

## Name map normalization (follow-up)

Directus roles are literally "Administrator" and "Viewer" (per `directus/bootstrap-roles.sh`). The generic lowercase transform from the first choice would yield "administrator"/"viewer", not the internal "admin"/"viewer" values the app uses.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit switch: 'Administrator'→'admin', 'Viewer'→'viewer' | Readable 1:1 map; unknown name = unauthenticated. | ✓ |
| Lowercase + startsWith | Tolerant but defaults viewer by omission (unsafe). | |
| Compare role.id UUID to bootstrap-roles.sh literals | Hardcode Viewer UUID; drops the name-based readability. | |

**User's choice:** Explicit switch (Recommended)
**Notes:** Unknown role → treated as unauthenticated (no silent fallback).

---

## Profile slice location (follow-up)

Given AuthContext stays minimal but roadmap criterion #1 says AuthContext populates the full identity, where do first_name/last_name/avatar live?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate React Query hook useCurrentUserProfile() | AuthContext = {id,email,role}; hook does full readMe. | ✓ |
| Single readMe in AuthContext, full shape | Reverts the prior pick. | |
| Defer profile fields entirely | Under-delivers on criterion #1. | |

**User's choice:** Separate React Query hook useCurrentUserProfile() (Recommended)
**Notes:** Satisfies criterion #1 at the app level without fattening AuthContext state.

---

## Claude's Discretion

- `useCurrentUserProfile` exact filename / return type naming.
- React Query staleTime / gcTime for profile hook (project defaults unless a reason).
- Inline grep vs dedicated `scripts/ci/` script for the guard.
- Whether UserMenu.test.tsx needs updating in this phase.

## Deferred Ideas

- UserMenu redesign consuming avatar + name.
- Reusable `scripts/ci/no-api-*.sh` guard pattern for Phases 67–71.
- Broader backend-surface absence assertion in CI.
- Rollback E2E (lives in Phase 71).
- Profile prefetch on signIn to warm the query cache.
