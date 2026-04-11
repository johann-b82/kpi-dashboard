# Phase 4 Docker Rebuild Verification (Success Criterion 5)

Criterion 5 from ROADMAP.md Phase 4:

> "Logo survives `docker compose up --build` (stored as bytea in Postgres,
> not in container filesystem)."

This cannot be exercised by pytest — it requires a real image rebuild.
Run this runbook once before marking Phase 4 complete.

## Prerequisites

- `docker compose up -d --build` has been run at least once; `alembic upgrade head`
  was applied and the API is reachable at http://localhost:8000.
- `scripts/verify-phase-04.sh` passes.

## Runbook

1. Upload a known SVG and capture its bytes hash:
   ```bash
   # NOTE: the SVG must match what nh3 html5ever produces byte-for-byte, or
   # sanitize_svg's reject-on-mutation guard will 422 the upload. Use printf
   # (no trailing newline) and the explicit close-tag form for <circle> —
   # self-closing <circle .../> is rewritten to <circle ...></circle> and
   # fails the mutation check. This matches MINIMAL_SVG in
   # backend/tests/test_logo_validation.py.
   printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>' > /tmp/phase4-logo.svg
   curl -sS -X POST -F "file=@/tmp/phase4-logo.svg;type=image/svg+xml" \
     http://localhost:8000/api/settings/logo
   LOGO_SHA_BEFORE="$(curl -sS http://localhost:8000/api/settings/logo | sha256sum)"
   echo "Before rebuild: $LOGO_SHA_BEFORE"
   ```

2. Force a full rebuild (do NOT use `docker compose down -v` — that would
   delete the volume, which is NOT the test):
   ```bash
   docker compose down
   docker compose up -d --build
   # Wait for the api container to be healthy:
   until curl -sS http://localhost:8000/health >/dev/null; do sleep 1; done
   ```

3. Fetch the logo again and compare hashes:
   ```bash
   LOGO_SHA_AFTER="$(curl -sS http://localhost:8000/api/settings/logo | sha256sum)"
   echo "After rebuild:  $LOGO_SHA_AFTER"
   [[ "$LOGO_SHA_BEFORE" == "$LOGO_SHA_AFTER" ]] && echo "PASS" || echo "FAIL"
   ```

## Expected Result

- `PASS` — the exact bytes are returned; the image rebuild did not affect
  Postgres-stored data.
- If `FAIL`: the logo is being stored somewhere other than the `app_settings`
  bytea column (filesystem, tmpfs, or the image itself). Inspect
  `backend/app/routers/settings.py` and confirm `row.logo_data = raw`.

## Why this test exists

Early drafts of the feature stored logos on disk. That approach would
silently fail this test — a rebuild wipes the container filesystem. Moving
to `bytea` is locked by D-01 and Project STATE.md.
