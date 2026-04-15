# API Reference

The FastAPI backend exposes a JSON API at `https://kpi.internal/api/*`. **The always-current spec lives at `https://kpi.internal/api/docs` (Swagger UI).** This page documents the organizing model only — tag groups, auth pattern, error shape — which doesn't rot between releases.

## Tag groups

| Tag | Purpose |
| --- | --- |
| `auth` | OIDC login / callback / logout / current-user endpoints. Session-cookie based. |
| `settings` | Workspace-level settings (branding, colors, logo, Personio config, HR targets). |
| `uploads` | File upload (tab-delimited ERP exports), upload history, deletion. |
| `kpis` | Sales KPI card summaries + chart time series. |
| `hr-kpis` | HR KPI aggregates over Personio-synced data. |
| `sync` | Manual trigger + status for the Personio sync job. |
| `data` | Raw table data for the sales + employee tables. |

For per-endpoint request/response shape, method, and example payloads, open [Swagger UI](https://kpi.internal/api/docs).

## Auth pattern

- Every route under `/api/*` except `/api/auth/login|callback|me|logout` and `/health` requires an authenticated session.
- Unauthenticated requests return **`401 Unauthenticated`** with body `{"detail":"Unauthenticated"}`.
- Session is carried in an `httpOnly` `kpi_session` cookie; 8 h absolute lifetime, `SameSite=Lax`, `Secure` (set by SessionMiddleware).
- Claims stored in the session: `{sub, email, name}` only — no raw ID tokens or access tokens.
- Bypass: set `DISABLE_AUTH=true` for local-only dev. The backend logs a warning at startup and returns a synthetic `dev-user` from `/api/auth/me`; `/api/auth/login` returns 503.

## Error shape

FastAPI default: `HTTPException(status_code, detail)` serializes as:

```json
{ "detail": "Human-readable reason" }
```

Pydantic validation errors (422) return the structured FastAPI validation payload:

```json
{ "detail": [ { "loc": [...], "msg": "...", "type": "..." } ] }
```

Business-logic errors use 4xx with a `detail` string; 5xx indicate an unhandled server-side failure (surfaced in `docker compose logs api`).

## Versioning

The API is unversioned. KPI Dashboard is an internal single-tenant tool; breaking changes land with a backend + frontend deploy together, coordinated via the roadmap.
