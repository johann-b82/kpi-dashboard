#!/usr/bin/env bash
# prerun.sh runs on the BUILD HOST (not in chroot) before chroot scripts execute.
# Use it to copy files INTO the chroot rootfs.
set -euo pipefail

ROOTFS="${ROOTFS_DIR}"   # set by pi-gen build system
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# Guard: signage-firstboot.service is created by Plan 49-02.
# Until 49-02 merges, skip baking it in so Plan 49-01 smoke build succeeds.
if [ ! -f "${REPO_ROOT}/pi-image/stage-signage/signage-firstboot.service" ]; then
  echo "WARN: signage-firstboot.service missing (Plan 49-02 not yet merged); continuing without firstboot bake-in"
  _SKIP_FIRSTBOOT=1
else
  _SKIP_FIRSTBOOT=0
fi

# Copy the installer library into the chroot so 01-run-chroot.sh can source it
install -d -m 0755 "${ROOTFS}/tmp/lib"
cp "${REPO_ROOT}/scripts/lib/signage-install.sh" "${ROOTFS}/tmp/lib/"

# Copy signage-packages.txt alongside so the library can read it
cp "${REPO_ROOT}/scripts/lib/signage-packages.txt" "${ROOTFS}/tmp/lib/"

# Copy the pi-sidecar source into /opt/signage/pi-sidecar in the chroot
install -d -m 0755 "${ROOTFS}/opt/signage/pi-sidecar"
cp -r "${REPO_ROOT}/pi-sidecar/." "${ROOTFS}/opt/signage/pi-sidecar/"

# Copy the systemd unit templates
install -d -m 0755 "${ROOTFS}/opt/signage/scripts/systemd"
cp "${REPO_ROOT}/scripts/systemd/"*.service "${ROOTFS}/opt/signage/scripts/systemd/"

if [ "${_SKIP_FIRSTBOOT}" = "0" ]; then
  # Bake the firstboot service (system-level, not user-level)
  install -m 0644 "${REPO_ROOT}/pi-image/stage-signage/signage-firstboot.service" \
      "${ROOTFS}/etc/systemd/system/signage-firstboot.service"

  # Bake the preseed placeholder config onto the FAT partition (boot)
  # The boot partition is mounted at ${ROOTFS}/boot/firmware during chroot
  install -m 0644 "${REPO_ROOT}/pi-image/stage-signage/signage.conf.template" \
      "${ROOTFS}/boot/firmware/signage.conf"
else
  # Still bake the preseed template even without firstboot service
  install -m 0644 "${REPO_ROOT}/pi-image/stage-signage/signage.conf.template" \
      "${ROOTFS}/boot/firmware/signage.conf" 2>/dev/null || true
fi
