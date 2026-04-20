# Pi Image Signing — Key Ceremony and Rotation

KPI Dashboard Pi signage images are signed with [minisign](https://jedisct1.github.io/minisign/)
(Ed25519). Operators verify downloaded images against the committed public key before flashing.

## Key pair

- **Public key (committed):** `pi-image/minisign.pub` — 88 bytes, starts with `RWS`.
- **Private key (NEVER committed):** stored as GitHub Actions secret `MINISIGN_SECRET_KEY` +
  a copy in the project password manager (see "Backup" below).

> **PENDING:** `pi-image/minisign.pub` has not yet been committed. The operator must complete
> the one-time generation ceremony below, then commit the public key in a separate commit.

## One-time generation ceremony

Performed by: **\<operator name\>**
Performed on: **\<date\>**
Platform: **\<OS/host\>**

1. Install minisign (`apt install minisign` / `brew install minisign` / download from
   <https://github.com/jedisct1/minisign/releases>).
2. Generate with an EMPTY passphrase (RESEARCH Pitfall 12 — a non-empty passphrase hangs CI):
   ```bash
   cd <repo-root>
   minisign -G -p pi-image/minisign.pub -s /tmp/minisign.sec
   # Press Enter TWICE when prompted for passphrase (empty passphrase)
   ```
   The file `pi-image/minisign.pub` is ~88 bytes starting with `untrusted comment:` and a
   base64 payload prefixed `RWS`.
3. Commit the public key:
   ```bash
   git add pi-image/minisign.pub
   git commit --no-verify -m "feat(49-03): add minisign public key for Pi image release signing"
   ```
4. Copy the contents of `/tmp/minisign.sec` into the GitHub Actions secret
   `MINISIGN_SECRET_KEY`:
   - GitHub repo → Settings → Secrets and variables → Actions → New repository secret.
   - Name: `MINISIGN_SECRET_KEY`
   - Value: paste the ENTIRE file contents of `/tmp/minisign.sec` (5–10 lines).
   - Save.
5. Back up the private key to the project password manager (see "Backup" below).
6. Securely delete `/tmp/minisign.sec`:
   ```bash
   shred -u /tmp/minisign.sec    # Linux
   # or: rm -P /tmp/minisign.sec  # macOS
   ```

## Backup

Primary backup: \<1Password vault entry, team shared\> (item: "KPI Dashboard minisign secret key").
Secondary backup: \<offline encrypted USB / Yubikey / etc.\>

**If the private key is lost, all future releases use a different key and operators who have
downloaded the old `minisign.pub` will see verification failures when upgrading.** In that case,
rotate (below) and publish a v1.17.z patch release that bumps `minisign.pub`.

## Rotation

1. Run the generation ceremony again with a fresh key pair.
2. Update `pi-image/minisign.pub` (commit).
3. Overwrite the `MINISIGN_SECRET_KEY` GitHub Actions secret.
4. Cut a new release (`v1.17.<next>`) and ship a `ROTATION.md` alongside the release notes
   telling operators to download the new `minisign.pub` from the repo (or from the release
   assets).

## CI usage

`.github/workflows/pi-image.yml` step "Sign with minisign" writes the secret to
`/tmp/minisign.sec`, signs the `.img.xz`, and immediately removes the file. The signature is
uploaded to the GitHub Release as `.img.xz.minisig`. Keys never persist on the runner filesystem
between jobs.

## Operator verification

```bash
sha256sum -c <image>.img.xz.sha256
minisign -Vm <image>.img.xz -p minisign.pub
# Expected output: Signature and comment signature verified
```

### Cross-platform minisign install

- **Linux:** `apt install minisign` (Debian/Ubuntu) or download from GitHub releases
- **macOS:** `brew install minisign`
- **Windows:** download `minisign-windows-x86_64.zip` from
  <https://github.com/jedisct1/minisign/releases> and extract; or via package managers:
  - Scoop: `scoop install minisign`
  - Chocolatey: `choco install minisign`
