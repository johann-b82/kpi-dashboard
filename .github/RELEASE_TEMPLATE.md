# KPI Dashboard vX.Y.Z Pi Signage Image

## Downloads

| Asset | SHA256 |
|-------|--------|
| `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz` | `<sha256>` |
| `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.sha256` | — |
| `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.minisig` | — |
| `minisign.pub` | (identity file; verify against repo copy) |

## Verification

```bash
sha256sum -c raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.sha256
minisign -Vm raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz -p minisign.pub
```

## Base

- **OS:** Raspberry Pi OS Bookworm Lite 64-bit
- **pi-gen commit:** `<abbrev-sha>` on branch `arm64`
- **Build date:** YYYY-MM-DD (UTC)
- **pi-sidecar commit:** `<abbrev-sha>`
- **Runner:** self-hosted arm64 (Hetzner CAX21)

## Apt package versions (from `dpkg -l` inside the built image)

<!-- Populated by CI in a future enhancement; hand-filled for first release -->

| Package | Version |
|---------|---------|
| chromium-browser | `<version>` |
| unclutter-xfixes | `<version>` |
| labwc | `<version>` |
| seatd | `<version>` |
| python3-venv | `<version>` |
| git | `<version>` |
| network-manager | `<version>` |

## Hardware matrix

- **Recommended:** Raspberry Pi 4 (2+ GB RAM)
- **Supported:** Raspberry Pi 5
- **Supported (slower):** Raspberry Pi 3B / 3B+ (Wayland forced via raspi-config)
- **Not supported:** Pi Zero 2 W (insufficient RAM for Chromium)

## Preseed (operator edits on SD after flash, before first boot)

See `pi-image/README.md` for the `/boot/firmware/signage.conf` schema.

## Rollback

To roll back, re-flash the previous release's `.img.xz`.
