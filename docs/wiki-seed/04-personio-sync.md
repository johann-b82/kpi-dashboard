# Personio Sync Runbook

KPI Dashboard pulls employee, attendance, and absence data from Personio on a recurring schedule. This page covers credential configuration, sync control, and recovery from common failure modes.

## Configure credentials

1. In Personio: **Settings → Integrations → API credentials** → generate a Partner ID + Client Secret pair scoped to the data you need (employees, attendances, absences).
2. In KPI Dashboard: **Settings → HR → Personio** section.
3. Paste the Partner ID into **Partner ID** and the Client Secret into **Client Secret**. Secrets are Fernet-encrypted at rest in `app_settings`.
4. Click **Test Connection**. A green status + a sample employee count confirms the credential pair is valid.
5. Set the **Sync interval** (default: 60 minutes). Minimum 5 minutes — Personio rate-limits aggressive pulls.

## Trigger a manual sync

- **UI:** Settings → HR → Personio → **Sync now** button.
- **API:** `POST /api/sync` (see [[API Reference]]).

Manual syncs do not reset the interval — the scheduled sync still runs at the configured cadence.

## What the sync does

1. Fetches employees (`GET /v1/company/employees`) and upserts by Personio ID.
2. Fetches attendances for a rolling 12-month window and upserts by (employee, date).
3. Fetches absences (approved leave) for the same window.
4. Updates the **last sync** timestamp visible in the HR dashboard SubHeader.

Records deleted in Personio are **not** retroactively deleted in KPI Dashboard — soft-retention is intentional for KPI trend stability.

## Configure HR criteria

Three multi-select fields drive HR KPI aggregation:

- **Included departments** — only these count toward company-wide HR KPIs.
- **Included employment types** — e.g. exclude contractors.
- **Included attendance types** — e.g. count "worked" hours only.

Pick one or more values per field. Empty = "include everything".

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sync silently produces zero new rows | Credential expired or rotated in Personio | Settings → HR → **Test Connection** → regenerate + paste new secret |
| HTTP 429 in `docker compose logs api` | Personio rate limit (60-min default is safe; short intervals exhaust quota) | Raise sync interval; wait for quota window |
| "Unknown department" in logs | Personio option set changed (new department added) | Settings → HR → multi-select pickers now show the new option; save to include |
| Sync stuck in "running" state | Previous sync crashed mid-run | `docker compose restart api` — the APScheduler job is stateless |
| Attendance totals off by one day | Personio returns UTC; displayed in local TZ | Expected; trend is correct. For precise daily comparison, cross-check in Personio. |

## Dev loop

To exercise the sync without hitting real Personio, point the backend at a mock server (future phase) or temporarily disable via `PERSONIO_SYNC_ENABLED=false` in `.env` and import fixture data via Alembic data migration.
