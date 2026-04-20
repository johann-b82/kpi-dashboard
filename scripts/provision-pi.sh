#!/usr/bin/env bash
# Phase 48 D-3: idempotent Pi bootstrap. Run as root on a fresh Bookworm Lite 64-bit image.
# Usage: sudo SIGNAGE_API_URL=host:port ./scripts/provision-pi.sh
#    or: sudo ./scripts/provision-pi.sh <api-host:port>
set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

info()  { echo -e "${GREEN}[provision-pi]${NC} $*"; }
warn()  { echo -e "${YELLOW}[provision-pi] WARN:${NC} $*"; }
error() { echo -e "${RED}[provision-pi] ERROR:${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Step 0: Pre-flight checks
# ---------------------------------------------------------------------------
info "=== Phase 48 Pi Provisioning Bootstrap ==="

# Root check
if [ "$(id -u)" != "0" ]; then
  error "This script must be run as root (sudo)."
  exit 1
fi

# Architecture check
ARCH="$(uname -m)"
if [ "${ARCH}" != "aarch64" ]; then
  warn "Architecture is '${ARCH}', expected 'aarch64' (64-bit ARM)."
  warn "Bookworm Lite 64-bit is the only officially supported image."
  warn "Continuing anyway — set SIGNAGE_SKIP_ARCH_CHECK=1 to silence this."
fi

# apt check
if ! command -v apt-get >/dev/null 2>&1; then
  error "apt-get not found — this script requires Debian/Raspberry Pi OS."
  exit 1
fi

# SIGNAGE_API_URL: accept as env var OR positional arg
if [ "${1:-}" != "" ]; then
  SIGNAGE_API_URL="${1}"
fi
if [ -z "${SIGNAGE_API_URL:-}" ]; then
  error "SIGNAGE_API_URL is required."
  echo ""
  echo "Usage:"
  echo "  sudo SIGNAGE_API_URL=<api-host:port> ${BASH_SOURCE[0]}"
  echo "  sudo ${BASH_SOURCE[0]} <api-host:port>"
  echo ""
  echo "Example:"
  echo "  sudo SIGNAGE_API_URL=192.168.1.100:80 ${BASH_SOURCE[0]}"
  exit 1
fi

# Print banner for operator confirmation
echo ""
echo "  SIGNAGE_API_URL = ${SIGNAGE_API_URL}"
echo "  Kiosk URL       = http://${SIGNAGE_API_URL}/player/"
echo "  Repo root       = ${REPO_ROOT}"
echo ""

# systemd version check (Pitfall 7: loginctl enable-linger requires systemd 219+)
SYSTEMD_VER=$(systemctl --version | head -1 | awk '{print $2}')
if [ "${SYSTEMD_VER}" -lt 219 ] 2>/dev/null; then
  error "systemd version ${SYSTEMD_VER} is too old; loginctl enable-linger requires 219+."
  exit 1
fi
info "systemd ${SYSTEMD_VER} — linger support confirmed."

# ---------------------------------------------------------------------------
# Step 0.5: RPi archive check (Pitfall 2)
# chromium-browser comes from archive.raspberrypi.com — NOT Debian main.
# If raspi.list is missing, apt will install the wrong chromium package.
# ---------------------------------------------------------------------------
info "Step 0.5: Checking Raspberry Pi archive configuration..."
if [ ! -f /etc/apt/sources.list.d/raspi.list ]; then
  error "/etc/apt/sources.list.d/raspi.list is missing."
  error "chromium-browser is only available from the Raspberry Pi archive:"
  error "  https://archive.raspberrypi.com/debian/"
  error "This script must be run on a genuine Raspberry Pi OS Bookworm image."
  error "Stock Debian does not include this repository."
  exit 2
fi
info "raspi.list found — RPi archive configured."

# ---------------------------------------------------------------------------
# Step 1: System packages
# ---------------------------------------------------------------------------
info "Step 1: Installing system packages..."
apt-get update -qq

PACKAGES=(
  chromium-browser
  unclutter-xfixes
  git
  python3-venv
  python3-pip
  labwc
  seatd
  fonts-crosextra-carlito
  fonts-crosextra-caladea
  fonts-noto-core
  fonts-dejavu-core
  ca-certificates
  curl
  network-manager
)

apt-get install -y --no-install-recommends "${PACKAGES[@]}" || {
  error "apt-get install failed — check the package list and network connectivity."
  exit 2
}
info "System packages installed."

# ---------------------------------------------------------------------------
# Step 2: Create 'signage' user (Pitfalls 8 and 10)
# Never assume 'pi' user exists. Must be in video,audio,render,input groups.
# ---------------------------------------------------------------------------
info "Step 2: Creating 'signage' user..."
if id signage >/dev/null 2>&1; then
  info "User 'signage' already exists — ensuring group membership."
  usermod -aG video,audio,render,input signage
else
  useradd -m -s /bin/bash -G video,audio,render,input signage
  info "User 'signage' created."
fi

# ---------------------------------------------------------------------------
# Step 3: Create cache and config directories
# ---------------------------------------------------------------------------
info "Step 3: Creating directories..."
install -d -m 0700 -o signage -g signage /var/lib/signage
install -d -m 0700 -o signage -g signage /var/lib/signage/media
install -d -m 0755 -o signage -g signage /opt/signage

# systemd user service directory
install -d -m 0755 -o signage -g signage /home/signage/.config
install -d -m 0755 -o signage -g signage /home/signage/.config/systemd
install -d -m 0755 -o signage -g signage /home/signage/.config/systemd/user
info "Directories created."

# ---------------------------------------------------------------------------
# Step 4: Clone or update the repo
# The script assumes it is being run from an already-cloned repo at REPO_ROOT.
# If /opt/signage is not yet populated, clone from the origin remote.
# ---------------------------------------------------------------------------
info "Step 4: Setting up repo at /opt/signage..."
if [ -d /opt/signage/.git ]; then
  info "Repo already present — pulling latest changes."
  git -C /opt/signage pull --ff-only || {
    warn "git pull failed (detached HEAD or dirty tree). Continuing with current code."
  }
elif [ "${REPO_ROOT}" = "/opt/signage" ]; then
  info "Already running from /opt/signage — no clone needed."
else
  # Not at /opt/signage — try to copy from the location we were invoked from
  ORIGIN_URL=$(git -C "${REPO_ROOT}" config --get remote.origin.url 2>/dev/null || echo "")
  if [ -n "${ORIGIN_URL}" ]; then
    info "Cloning repo from ${ORIGIN_URL} to /opt/signage..."
    git clone "${ORIGIN_URL}" /opt/signage || {
      error "git clone failed. Clone manually: git clone ${ORIGIN_URL} /opt/signage"
      exit 3
    }
  else
    warn "No remote origin found. Copying repo from ${REPO_ROOT} to /opt/signage..."
    rsync -a --exclude='.git' "${REPO_ROOT}/" /opt/signage/ 2>/dev/null || \
      cp -r "${REPO_ROOT}/." /opt/signage/ || {
        error "Could not populate /opt/signage. Clone manually and re-run."
        exit 3
      }
  fi
fi
chown -R signage:signage /opt/signage
info "Repo ready at /opt/signage."

# ---------------------------------------------------------------------------
# Step 5: Set up sidecar venv
# Install from pi-sidecar/requirements.txt (written by Plan 48-01).
# ---------------------------------------------------------------------------
info "Step 5: Setting up sidecar Python venv..."
SIDECAR_DIR="/opt/signage/pi-sidecar"
VENV_DIR="${SIDECAR_DIR}/.venv"
REQUIREMENTS="${SIDECAR_DIR}/requirements.txt"

if [ ! -f "${SIDECAR_DIR}/sidecar.py" ]; then
  warn "${SIDECAR_DIR}/sidecar.py not found — Plan 48-01 may not have been committed yet."
  warn "Continuing to set up venv; sidecar.py must be present before first boot."
fi

if [ ! -d "${VENV_DIR}" ]; then
  python3 -m venv "${VENV_DIR}" || {
    error "python3 -m venv failed."
    exit 4
  }
fi

if [ -f "${REQUIREMENTS}" ]; then
  "${VENV_DIR}/bin/pip" install --no-cache-dir -r "${REQUIREMENTS}" || {
    error "pip install from requirements.txt failed."
    exit 4
  }
else
  warn "requirements.txt not found at ${REQUIREMENTS} — installing defaults."
  "${VENV_DIR}/bin/pip" install --no-cache-dir \
    fastapi==0.115.12 \
    uvicorn==0.34.0 \
    httpx==0.28.1 || {
    error "pip install failed."
    exit 4
  }
fi
chown -R signage:signage "${VENV_DIR}"
info "Sidecar venv ready."

# ---------------------------------------------------------------------------
# Step 5.5: Pre-compile venv (Pitfall 6)
# ProtectSystem=strict makes /opt/signage read-only at runtime.
# Python must not need to write .pyc files during operation.
# ---------------------------------------------------------------------------
info "Step 5.5: Pre-compiling venv bytecode..."
"${VENV_DIR}/bin/python" -m compileall "${VENV_DIR}/lib" -q 2>/dev/null || \
  warn "compileall returned non-zero (may be harmless for some .py files)."
info "Venv bytecode compiled."

# ---------------------------------------------------------------------------
# Step 6: Write systemd unit files (with token substitution)
# Pitfall 4: compute SIGNAGE_UID from actual signage user, not hardcoded.
# ---------------------------------------------------------------------------
info "Step 6: Writing systemd unit files..."
SIGNAGE_UID=$(id -u signage)
UNIT_SRC_DIR="${REPO_ROOT}/scripts/systemd"
UNIT_DEST_DIR="/home/signage/.config/systemd/user"

for UNIT_NAME in labwc.service signage-sidecar.service signage-player.service; do
  SRC="${UNIT_SRC_DIR}/${UNIT_NAME}"
  if [ ! -f "${SRC}" ]; then
    error "Unit template not found: ${SRC}"
    error "Ensure scripts/systemd/*.service files are present in the repo."
    exit 3
  fi
  sed \
    -e "s|__SIGNAGE_API_URL__|${SIGNAGE_API_URL}|g" \
    -e "s|__SIGNAGE_UID__|${SIGNAGE_UID}|g" \
    "${SRC}" > "${UNIT_DEST_DIR}/${UNIT_NAME}"
  chmod 0644 "${UNIT_DEST_DIR}/${UNIT_NAME}"
  info "  Wrote ${UNIT_DEST_DIR}/${UNIT_NAME}"
done

chown -R signage:signage /home/signage/.config/systemd
info "Systemd unit files written."

# ---------------------------------------------------------------------------
# Step 7: Enable linger (Pitfall 7 — idempotent)
# ---------------------------------------------------------------------------
info "Step 7: Enabling systemd linger for signage user..."
loginctl enable-linger signage
info "Linger enabled."

# ---------------------------------------------------------------------------
# Step 8: Enable and start services as the signage user
# ---------------------------------------------------------------------------
info "Step 8: Enabling and starting systemd user services..."
XDG_RUNTIME_DIR_SIGNAGE="/run/user/${SIGNAGE_UID}"

# On a freshly-provisioned host, `loginctl enable-linger` alone does not
# spawn user@UID.service before the next boot — which means the user-scope
# dbus/systemd socket under /run/user/<UID>/ does not yet exist, so
# `systemctl --user` fails with "Failed to connect to user scope bus via
# local transport: No such file or directory". Start the user manager
# explicitly so the socket is materialised, then wait a beat for dbus.
info "  Starting user@${SIGNAGE_UID}.service (materialises user-scope bus)..."
systemctl start "user@${SIGNAGE_UID}.service"

# Wait up to 10s for /run/user/<UID>/bus to appear.
for _ in $(seq 1 20); do
  if [ -S "${XDG_RUNTIME_DIR_SIGNAGE}/bus" ]; then
    break
  fi
  sleep 0.5
done

if [ ! -S "${XDG_RUNTIME_DIR_SIGNAGE}/bus" ]; then
  warn "User-scope bus socket still missing at ${XDG_RUNTIME_DIR_SIGNAGE}/bus"
  warn "Attempting systemctl --user anyway; may fail until reboot."
fi

sudo -u signage XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR_SIGNAGE}" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR_SIGNAGE}/bus" \
  systemctl --user daemon-reload || {
    warn "daemon-reload failed; services will still be enabled on next boot."
  }

sudo -u signage XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR_SIGNAGE}" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR_SIGNAGE}/bus" \
  systemctl --user enable --now labwc.service signage-sidecar.service signage-player.service || {
    warn "systemctl enable --now returned non-zero (labwc may need a reboot to start)."
    warn "Services are enabled — they will start on next boot."
  }
info "Services enabled."

# ---------------------------------------------------------------------------
# Step 9: Force Wayland on Pi 3B if detected (LOW confidence — best-effort)
# ---------------------------------------------------------------------------
info "Step 9: Checking Pi model for Wayland configuration..."
PI_MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr '\0' '\n' | head -1 || echo "unknown")
if echo "${PI_MODEL}" | grep -q "Raspberry Pi 3"; then
  info "Pi 3B detected — attempting to force Wayland via raspi-config..."
  raspi-config nonint do_wayland W2 2>/dev/null || {
    warn "raspi-config nonint do_wayland W2 failed (may not be available on this image)."
    warn "If Wayland does not start, run: sudo raspi-config → Advanced Options → Wayland."
  }
else
  info "Model: ${PI_MODEL} — no Pi 3B-specific Wayland override needed."
fi

# ---------------------------------------------------------------------------
# Step 10: Completion banner
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "=== Provisioning complete ==="
echo "========================================"
echo ""
echo "  Kiosk URL:    http://${SIGNAGE_API_URL}/player/"
echo "  Pairing URL:  http://${SIGNAGE_API_URL}/signage/pair"
echo ""
echo "  Pairing code should appear on screen within 30s of first boot."
echo "  Use the admin UI at http://${SIGNAGE_API_URL}/signage/pair to claim this device."
echo ""
echo "  Logs:"
echo "    sudo -u signage journalctl --user -u signage-player -f"
echo "    sudo -u signage journalctl --user -u signage-sidecar -f"
echo "    sudo -u signage journalctl --user -u labwc -f"
echo ""
echo "  Sidecar health: curl http://localhost:8080/health"
echo ""
echo "  If kiosk does not appear after 30s, reboot: sudo reboot"
echo "========================================"
