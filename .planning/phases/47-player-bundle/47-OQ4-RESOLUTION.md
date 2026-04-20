# OQ4 Resolution: /stream ?token= query-string device JWT auth

Date: 2026-04-20
Outcome: FAIL
Evidence:
  - backend/app/security/device_auth.py:37-43 — `get_current_device` reads only
    `Authorization: Bearer` via `HTTPBearer(auto_error=False)`; there is no
    fallback to `request.query_params.get("token")`.
  - backend/app/routers/signage_player.py:45-49 — router registers a single
    `Depends(get_current_device)` gate at the router level; `/stream` uses the
    same dep (line 109) with no alternative query-token extractor.
  - No `request.query_params` reference exists in device_auth.py.
Action required:
  - Plan 47-03 (SSE hook) is BLOCKED pending a small backend tweak to
    `get_current_device` (or a sibling dep `get_current_device_or_query`) that
    reads `request.query_params.get("token")` as a fallback when the
    `Authorization` header is absent. Browsers cannot set headers on
    `EventSource`, so the player's SSE subscription requires query-string auth
    per Phase 45 D-01 / Phase 47 RESEARCH §Pitfall P7.
  - Recommended scope: add the fallback into the existing `get_current_device`
    dep (fewer moving parts than a sibling dep) and guard it with a comment
    noting the EventSource constraint. Phase 42 already chose query-string SSE
    auth at the system level; this is the wiring catch-up.
  - Owner: planned as a prerequisite task within Plan 47-03 (it's a 6-line
    backend change + a test). If scope expands, split into a new 47-00
    prerequisite plan before 47-03 executes.
