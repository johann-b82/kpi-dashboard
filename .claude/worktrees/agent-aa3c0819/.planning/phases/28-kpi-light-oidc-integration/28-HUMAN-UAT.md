---
status: partial
phase: 28-kpi-light-oidc-integration
source: [28-VERIFICATION.md]
started: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Unauthenticated browser visit redirects to Dex and login returns to dashboard with user name in NavBar
expected: Visiting https://kpi.internal while logged out 303-redirects to Dex, completing login lands on / with user's display name visible in NavBar
result: [pending]

### 2. Session persists across page refresh; logout clears session and returns to unauthenticated state
expected: After login, browser refresh still shows authenticated UI; clicking Logout (POST form) clears kpi_session cookie and triggers re-auth on next visit
result: [pending]

### 3. DISABLE_AUTH=true boots app without Dex, shows synthetic dev user in NavBar, emits startup warning
expected: With DISABLE_AUTH=true, docker compose logs show ⚠ warning; /api/auth/me returns {sub:dev-user,...}; NavBar shows Dev User; /api/auth/login returns 503
result: [pending]

### 4. All six business routers return 401 without session cookie
expected: curl without cookie to /api/settings, /api/uploads, /api/kpis, /api/hr/*, /api/sync, /api/data/* returns 401 each
result: [pending]

### 5. app_users row upserted on Dex callback with fresh last_seen_at
expected: After login, SELECT * FROM app_users WHERE sub=... shows email/name/last_seen_at matching IdP claims; second login bumps last_seen_at
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
