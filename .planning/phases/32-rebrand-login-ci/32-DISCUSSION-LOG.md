# Phase 32: Rebrand & Login CI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 32-rebrand-login-ci
**Areas discussed:** Login page logo handling, Login card restyling scope, Rename strategy

---

## Login Page Logo Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Public logo endpoint | Add a new unauthed GET /api/settings/logo/public that returns the logo image. Simple, always fresh, no build step needed. | ✓ |
| Hardcode /api/settings/logo path | Existing logo endpoint may already work without auth — just reference it directly. If it 401s, show no logo gracefully. | |
| You decide | Claude picks the best technical approach based on existing code patterns. | |

**User's choice:** Public logo endpoint
**Notes:** None

### Follow-up: No-logo fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Just the text title | Show 'KPI Dashboard' text only — clean, no placeholder image. Logo appears once uploaded via Settings. | ✓ |
| A generic placeholder icon | Show a default app icon (e.g., chart/bar icon from Lucide) as placeholder. | |
| You decide | Claude picks based on what looks cleanest. | |

**User's choice:** Just the text title
**Notes:** None

---

## Login Card Restyling Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal tweaks | Current Card is already close to the app aesthetic. Just ensure consistent border, shadow, and accent color tokens match Settings/Dashboard cards. No layout overhaul. | ✓ |
| Distinctive login layout | Make login feel more like a branded landing — centered card with subtle background gradient or pattern, more vertical spacing, larger logo area. | |
| You decide | Claude matches the existing app card patterns as closely as possible. | |

**User's choice:** Minimal tweaks
**Notes:** None

---

## Rename Strategy

### FastAPI title

| Option | Description | Selected |
|--------|-------------|----------|
| Rename everything | Change FastAPI title to 'KPI Dashboard' too — it shows in the auto-generated /docs page, so consistency matters. | ✓ |
| Keep FastAPI title as-is | Leave backend FastAPI(title='KPI Light') unchanged — it's internal-facing. | |

**User's choice:** Rename everything
**Notes:** None

### Alembic migration

| Option | Description | Selected |
|--------|-------------|----------|
| Leave old migration alone | Old migration is historical — don't touch it. Change default in defaults.py only. Existing DBs already have their own value. | ✓ |
| New migration to update default | Create a new Alembic migration that updates the app_name default in the DB for existing installs. | |

**User's choice:** Leave old migration alone
**Notes:** None

---

## Claude's Discretion

- Card restyling details (exact border-radius, shadow values)
- Public logo endpoint implementation details (response headers, caching, 404 handling)

## Deferred Ideas

None
