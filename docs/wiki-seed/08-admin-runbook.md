# Admin Runbook

This page is for operators who need to manage the live stack without cloning the repo. For the exhaustive developer runbook, see the canonical [`docs/setup.md`](https://github.com/johann-b82/kpi-dashboard/blob/main/docs/setup.md). Sections below cover the wiki-discoverable subset: adding Dex users, rotating OIDC secrets, backing up Outline and the main DB, and onboarding additional project collections.

## Known limitation: no silent cross-app SSO

Dex's `staticPasswords` connector does not set a browser session cookie on `auth.internal`. Each OIDC client (KPI Dashboard, Outline) re-prompts for the password even in the same browser. The value delivered is *one credential set for both apps*, not *one click*. Upgrading to an upstream connector (LDAP, upstream OIDC, SAML) is the standard fix — tracked as a future backlog item.

## Add or rotate a Dex user

Dex ships no CLI for password hashing in v2.43. Use Python + bcrypt.

```bash
# Generate a bcrypt cost-10 hash for a plaintext password
docker run --rm python:3.12-alpine sh -c \
  'pip install -q bcrypt && python -c "import bcrypt; print(bcrypt.hashpw(b\"THE-PASSWORD\", bcrypt.gensalt(rounds=10)).decode())"'
```

The output is a `$2b$10$…` hash (60 characters). Paste it into `dex/config.yaml` under `staticPasswords.hash:` as a **single-quoted YAML string** (the `$` characters collide with Dex's env-var substitution otherwise):

```yaml
  - email: "alice@acm.local"
    hash: '$2b$10$... full hash ...'
    username: "alice"
    userID: "generate-with-uuidgen-or-python-uuid"   # stable forever — do NOT regenerate
```

Then:

```bash
docker compose restart dex
```

The new user can log in immediately. **Never regenerate an existing `userID:`** — it is the OIDC `sub` claim persisted by KPI Dashboard and Outline; rotating it orphans every historical reference.

## Rotate an OIDC client secret

When a DEX client secret is suspected compromised:

```bash
# 1. Generate a new 64-hex secret
openssl rand -hex 32   # → new DEX_KPI_SECRET (or DEX_OUTLINE_SECRET)

# 2. Update .env on the host with the new value (keep the old one momentarily)
vim .env

# 3. Restart dex (envsubst re-renders /tmp/config.yaml at startup)
docker compose restart dex

# 4. Restart the consuming service so it uses the new secret
docker compose restart api       # for DEX_KPI_SECRET
docker compose restart outline   # for DEX_OUTLINE_SECRET
```

Any in-flight session invalidates the moment the secret rotates — affected users re-authenticate once.

## Back up Outline

Two artifacts persist Outline state: the database + the attachment volume.

```bash
# 1. DB dump
docker compose exec -T outline-db \
  pg_dump -U outline outline > outline-db-$(date +%F).sql

# 2. Attachment volume
docker compose exec outline tar -czf - /var/lib/outline/data \
  > outline-uploads-$(date +%F).tar.gz
```

Restore is the reverse: `psql` the dump into a fresh `outline-db` and `tar -xzf` the uploads into the same container path before starting the `outline` service.

## Back up KPI Dashboard DB

```bash
docker compose exec -T db \
  pg_dump -U kpi_user kpi_db > kpi-db-$(date +%F).sql
```

Captures everything: uploaded sales data, app_settings (including logo bytes), Personio-synced data, HR targets. Restore by `psql`ing into a fresh `db` volume and running `docker compose up -d migrate api` to apply any subsequent migrations.

## Onboard another project collection

The multi-project pattern is **one Outline collection per project**. To add "Project Y":

1. Open Outline → **+ New collection** in the sidebar.
2. Name: `Project Y`, icon: book/library emoji, description: one-liner.
3. Permissions: **members read + write** — mirror the KPI Dashboard default. No per-page overrides.
4. (Optional) Clone the 9-page skeleton of this collection: landing, dev setup, architecture, api reference, sync runbook, user guides, settings, admin runbook.
5. Update the Outline workspace home to list the new collection alongside KPI Dashboard.

Each project's collection has its own URL space and permission envelope. No nested structure — flat collections scale better as the roster grows.

See [[Dev Setup]] for the underlying stack this runbook operates against.
