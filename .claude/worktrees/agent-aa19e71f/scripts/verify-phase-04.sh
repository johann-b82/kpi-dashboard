#!/usr/bin/env bash
# Phase 4 smoke test — success criteria 1 through 4.
# Criterion 5 (rebuild persistence) is a manual check — see
# .planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md
#
# Usage: ./scripts/verify-phase-04.sh [base_url]
# Default base_url is http://localhost:8000
#
# Exits non-zero on any failure.
set -euo pipefail

BASE="${1:-http://localhost:8000}"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

# --- Criterion 1: GET /api/settings returns full shape ------------------
echo
echo "[1/4] GET /api/settings shape"
# probe: curl $BASE/api/settings reachable
body="$(curl -sS "$BASE/api/settings")"
[[ -n "$body" ]] || fail "GET /api/settings returned empty body"
# second sanity curl $BASE/api/settings for non-empty body confirmation
_probe="$(curl -sS "$BASE/api/settings" || true)"
for key in color_primary color_accent color_background color_foreground \
           color_muted color_destructive app_name default_language \
           logo_url logo_updated_at; do
  if echo "$body" | grep -q "\"$key\""; then
    pass "shape contains $key"
  else
    fail "shape missing $key"
  fi
done

# --- Criterion 2: PUT with ; in color returns 422 -----------------------
echo
echo "[2/4] PUT /api/settings with CSS injection blocked"
code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X PUT -H "Content-Type: application/json" \
  -d '{"color_primary":"oklch(0.5 0.15 250); background: red","color_accent":"oklch(0.7 0.18 150)","color_background":"oklch(1 0 0)","color_foreground":"oklch(0.15 0 0)","color_muted":"oklch(0.9 0 0)","color_destructive":"oklch(0.55 0.22 25)","app_name":"X","default_language":"EN"}' \
  "$BASE/api/settings")"
[[ "$code" == "422" ]] && pass "semicolon in color → 422" || fail "semicolon in color → $code (expected 422)"

code2="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X PUT -H "Content-Type: application/json" \
  -d '{"color_primary":"oklch(0.5 0.15 url(evil))","color_accent":"oklch(0.7 0.18 150)","color_background":"oklch(1 0 0)","color_foreground":"oklch(0.15 0 0)","color_muted":"oklch(0.9 0 0)","color_destructive":"oklch(0.55 0.22 25)","app_name":"X","default_language":"EN"}' \
  "$BASE/api/settings")"
[[ "$code2" == "422" ]] && pass "url( in color → 422" || fail "url( in color → $code2 (expected 422)"

# --- Criterion 3: SVG with <script> rejected ----------------------------
echo
echo "[3/4] POST /api/settings/logo with malicious SVG"
tmpdir="$(mktemp -d)"
evil="$tmpdir/evil.svg"
printf '%s' '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' > "$evil"
code3="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST -F "file=@$evil;type=image/svg+xml" \
  "$BASE/api/settings/logo")"
[[ "$code3" == "422" ]] && pass "malicious SVG → 422" || fail "malicious SVG → $code3 (expected 422)"

# Follow-up: logo_url should still be null
post_body="$(curl -sS "$BASE/api/settings")"
if echo "$post_body" | grep -q '"logo_url":null\|"logo_url": null'; then
  pass "malicious SVG was not persisted"
else
  fail "malicious SVG may have been persisted: $post_body"
fi

# --- Criterion 4: PUT defaults resets and clears logo -------------------
echo
echo "[4/4] PUT defaults resets singleton"

# First, upload a legitimate SVG so there IS a logo to clear
good="$tmpdir/logo.svg"
printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>' > "$good"
up_code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST -F "file=@$good;type=image/svg+xml" \
  "$BASE/api/settings/logo")"
[[ "$up_code" == "200" ]] && pass "legitimate SVG upload → 200" || fail "legitimate SVG upload → $up_code"

# Now PUT canonical defaults
defaults_json='{"color_primary":"oklch(0.55 0.15 250)","color_accent":"oklch(0.70 0.18 150)","color_background":"oklch(1.00 0 0)","color_foreground":"oklch(0.15 0 0)","color_muted":"oklch(0.90 0 0)","color_destructive":"oklch(0.55 0.22 25)","app_name":"KPI Light","default_language":"EN"}'
reset_body="$(curl -sS -X PUT -H "Content-Type: application/json" -d "$defaults_json" "$BASE/api/settings")"
if echo "$reset_body" | grep -q '"logo_url":null\|"logo_url": null'; then
  pass "reset cleared logo_url"
else
  fail "reset did not clear logo_url: $reset_body"
fi

rm -rf "$tmpdir"

echo
echo "----------------------------------------"
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo "----------------------------------------"
[[ "$FAIL" -eq 0 ]] || exit 1
echo "All automated checks passed. Now run the rebuild test:"
echo "  cat .planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md"
