#!/usr/bin/env bash
# generate-certs.sh — Produce a local TLS cert+key for the v1.11 *.internal hostnames
# via mkcert. Output goes to ./certs/ at the repo root.
#
# Usage (from repo root):
#     ./scripts/generate-certs.sh
#
# Requires: mkcert installed on PATH and `mkcert -install` already run once
# on this machine (one-time CA trust step — see Phase 26 setup runbook).

set -euo pipefail

if ! command -v mkcert >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[generate-certs] ERROR: `mkcert` not found on PATH.

Install it once per machine, then re-run this script:
  - macOS:   brew install mkcert
  - Linux:   sudo apt install libnss3-tools && \
             see https://github.com/FiloSottile/mkcert#linux for the mkcert binary

After installing, run `mkcert -install` once to trust the local CA in your
system + browser trust stores. This script does NOT install mkcert or run
`mkcert -install` for you — both are interactive / sudo-requiring steps.
EOF
  exit 1
fi

CERT_DIR="./certs"
mkdir -p "${CERT_DIR}"

CERT_FILE="${CERT_DIR}/internal.crt"
KEY_FILE="${CERT_DIR}/internal.key"

# Single SAN cert covering all three v1.11 hostnames + the *.internal wildcard.
# (D-01 leaves wildcard-vs-individual to the implementer; SAN is the simpler path.)
mkcert \
  -cert-file "${CERT_FILE}" \
  -key-file  "${KEY_FILE}" \
  kpi.internal wiki.internal auth.internal "*.internal"

cat <<EOF

[generate-certs] Success. Wrote:
  ${CERT_FILE}
  ${KEY_FILE}

Reminder: run \`mkcert -install\` once per machine (if you have not already)
so your browser + system trust the local mkcert CA. Without that step you
will still see a "not trusted" browser warning even though the cert is valid.
EOF
