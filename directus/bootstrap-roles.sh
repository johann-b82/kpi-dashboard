#!/bin/sh
# bootstrap-roles.sh — idempotent roles-as-code for Directus 11 via REST API.
#
# Replaces the v10-style snapshot.yml approach (Plan 02) which was rejected by
# Directus 11's stricter schema apply (policies/access tables and role↔policy
# decoupling introduced in v11 made the v10 snapshot shape invalid).
#
# Flow:
#   1. POST /auth/login           -> access_token
#   2. Ensure "Viewer Read" policy exists (fixed UUID)
#   3. Ensure "Viewer" role exists (fixed UUID)
#   4. Ensure access row links Viewer role <-> Viewer Read policy (fixed UUID)
#
# Admin role is NOT created here — Directus ships a built-in "Administrator"
# role (seeded by ADMIN_EMAIL/ADMIN_PASSWORD env bootstrap). Downstream code
# should key on the name "Administrator" for admin access.
#
# Re-running this script on a populated DB is a no-op (GET-before-POST).

set -eu

: "${DIRECTUS_URL:?DIRECTUS_URL not set}"
: "${DIRECTUS_ADMIN_EMAIL:?DIRECTUS_ADMIN_EMAIL not set}"
: "${DIRECTUS_ADMIN_PASSWORD:?DIRECTUS_ADMIN_PASSWORD not set}"

VIEWER_POLICY_ID="a2222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
VIEWER_ROLE_ID="a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
VIEWER_ACCESS_ID="a2222222-cccc-cccc-cccc-cccccccccccc"

log() { printf '[bootstrap-roles] %s\n' "$*"; }

# curl helper that prints body and captures HTTP status to a file descriptor.
# Usage: http_status=$(api GET /roles/xxx) ; body in /tmp/api.body
api() {
  method="$1"; path="$2"; body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -o /tmp/api.body -w '%{http_code}' \
      -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body" \
      "${DIRECTUS_URL}${path}"
  else
    curl -sS -o /tmp/api.body -w '%{http_code}' \
      -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      "${DIRECTUS_URL}${path}"
  fi
}

log "Logging in as ${DIRECTUS_ADMIN_EMAIL} at ${DIRECTUS_URL}"
LOGIN_RESP=$(curl -sS -X POST \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${DIRECTUS_ADMIN_EMAIL}\",\"password\":\"${DIRECTUS_ADMIN_PASSWORD}\"}" \
  "${DIRECTUS_URL}/auth/login")

# crude token extraction — busybox sh + no jq available in directus image base.
# We pipe via python3 if present (directus image has node but not jq/python).
# Fall back to sed-based extraction.
TOKEN=$(printf '%s' "$LOGIN_RESP" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  log "ERROR: failed to parse access_token from login response:"
  printf '%s\n' "$LOGIN_RESP"
  exit 1
fi
log "Login OK — token acquired"

# --- 1. Ensure Viewer Read policy ---
status=$(api GET "/policies/${VIEWER_POLICY_ID}")
if [ "$status" = "200" ]; then
  log "Viewer Read policy exists (${VIEWER_POLICY_ID}) — skipping"
elif [ "$status" = "403" ] || [ "$status" = "404" ]; then
  log "Creating Viewer Read policy (${VIEWER_POLICY_ID})"
  status=$(api POST "/policies" "{
    \"id\":\"${VIEWER_POLICY_ID}\",
    \"name\":\"Viewer Read\",
    \"icon\":\"visibility\",
    \"description\":\"Read-only dashboard access — no admin, no app access to private data.\",
    \"admin_access\":false,
    \"app_access\":true
  }")
  if [ "$status" != "200" ] && [ "$status" != "204" ]; then
    log "ERROR: creating policy returned HTTP ${status}"
    cat /tmp/api.body; exit 1
  fi
  log "Viewer Read policy created"
else
  log "ERROR: unexpected GET /policies status ${status}"
  cat /tmp/api.body; exit 1
fi

# --- 2. Ensure Viewer role ---
status=$(api GET "/roles/${VIEWER_ROLE_ID}")
if [ "$status" = "200" ]; then
  log "Viewer role exists (${VIEWER_ROLE_ID}) — skipping"
elif [ "$status" = "403" ] || [ "$status" = "404" ]; then
  log "Creating Viewer role (${VIEWER_ROLE_ID})"
  status=$(api POST "/roles" "{
    \"id\":\"${VIEWER_ROLE_ID}\",
    \"name\":\"Viewer\",
    \"icon\":\"visibility\",
    \"description\":\"Read-only dashboard access.\"
  }")
  if [ "$status" != "200" ] && [ "$status" != "204" ]; then
    log "ERROR: creating role returned HTTP ${status}"
    cat /tmp/api.body; exit 1
  fi
  log "Viewer role created"
else
  log "ERROR: unexpected GET /roles status ${status}"
  cat /tmp/api.body; exit 1
fi

# --- 3. Ensure access row linking Viewer role <-> Viewer Read policy ---
# The /access collection uses role+policy composite semantics in v11.
# We use a fixed UUID for the access row so re-runs are idempotent.
status=$(api GET "/access/${VIEWER_ACCESS_ID}")
if [ "$status" = "200" ]; then
  log "Viewer access row exists (${VIEWER_ACCESS_ID}) — skipping"
elif [ "$status" = "403" ] || [ "$status" = "404" ]; then
  log "Creating access row linking Viewer role <-> Viewer Read policy"
  status=$(api POST "/access" "{
    \"id\":\"${VIEWER_ACCESS_ID}\",
    \"role\":\"${VIEWER_ROLE_ID}\",
    \"policy\":\"${VIEWER_POLICY_ID}\",
    \"sort\":1
  }")
  if [ "$status" != "200" ] && [ "$status" != "204" ]; then
    log "ERROR: creating access row returned HTTP ${status}"
    cat /tmp/api.body; exit 1
  fi
  log "Access row created"
else
  log "ERROR: unexpected GET /access status ${status}"
  cat /tmp/api.body; exit 1
fi

# --- 4. Confirm built-in Administrator role exists (sanity check) ---
status=$(api GET "/roles?filter%5Bname%5D%5B_eq%5D=Administrator&limit=1")
if [ "$status" = "200" ]; then
  if grep -q '"name":"Administrator"' /tmp/api.body; then
    log "Built-in Administrator role present (OK — used for admin access)"
  else
    log "WARN: Administrator role lookup returned no results — first-boot bootstrap may still be in progress"
  fi
else
  log "WARN: GET /roles?filter=Administrator returned HTTP ${status}"
fi

log "Bootstrap complete."
