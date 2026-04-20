#!/usr/bin/env bash
# Runs inside the image chroot. No systemd running. No /proc/device-tree.
set -euo pipefail

export SIGNAGE_BUILD_CONTEXT="chroot"

# Source the shared installer library (copied by prerun.sh)
# shellcheck source=/dev/null
source /tmp/lib/signage-install.sh

# Packages were installed by 00-packages-nr; verify key ones are present
command -v chromium-browser >/dev/null 2>&1 || { echo "ERROR: chromium-browser not found"; exit 1; }
command -v labwc            >/dev/null 2>&1 || { echo "ERROR: labwc not found"; exit 1; }

# Create signage user and directory layout
create_signage_user
create_signage_directories

# Set up sidecar venv (sources from /opt/signage/pi-sidecar which was copied by prerun.sh)
setup_sidecar_venv

# Deploy unit files with PLACEHOLDER URL (firstboot replaces it)
SIGNAGE_UID=$(id -u signage)
deploy_systemd_units "__SIGNAGE_API_URL__" "${SIGNAGE_UID}"

# Enable linger via file touch (loginctl doesn't work in chroot)
enable_linger_signage

# Pre-create /etc/signage/ directory for firstboot to write config into
install -d -m 0755 /etc/signage
chown root:root /etc/signage

# Enable firstboot service (Plan 49-02 creates signage-firstboot.service)
# Guard: if the service file is missing (Plan 49-02 not yet merged), skip the symlink
if [ -f /etc/systemd/system/signage-firstboot.service ]; then
  mkdir -p /etc/systemd/system/multi-user.target.wants
  ln -sf /etc/systemd/system/signage-firstboot.service \
         /etc/systemd/system/multi-user.target.wants/signage-firstboot.service
else
  echo "WARN: signage-firstboot.service not found (Plan 49-02 not yet merged); skipping symlink"
fi

# Set file ownership on all signage-owned paths
chown -R signage:signage /opt/signage
chown -R signage:signage /home/signage
chown -R signage:signage /var/lib/signage

echo "[stage-signage] chroot setup complete."
