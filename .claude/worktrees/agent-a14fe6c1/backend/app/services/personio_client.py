"""Async Personio API client with TTL-based token caching.

This is the single integration point with the Personio API. Phase 13 (sync
service) depends on this module to fetch employees, attendances, and absences.

Decisions:
  D-09 / D-10: Custom exception hierarchy with user-facing error messages.
  D-12: Token cached in-memory (not persisted to DB) — lost on container restart.
  D-13: Proactive token refresh if <60 s remaining on current token.
"""
import time
import httpx

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PERSONIO_BASE_URL = "https://api.personio.de/v1"
TOKEN_TTL_SECONDS = 86400   # 24 hours (Personio default)
TOKEN_REFRESH_BUFFER = 60   # Re-auth if <60s remaining (D-13)


# ---------------------------------------------------------------------------
# Exception hierarchy (D-09, D-10)
# ---------------------------------------------------------------------------


class PersonioAPIError(Exception):
    """Base class for all Personio client errors."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PersonioAuthError(PersonioAPIError):
    """Raised on HTTP 401 — invalid or expired credentials."""


class PersonioRateLimitError(PersonioAPIError):
    """Raised on HTTP 429 — rate limit exceeded."""

    def __init__(self, message: str, retry_after: int = 60) -> None:
        super().__init__(message, status_code=429)
        self.retry_after = retry_after


class PersonioNetworkError(PersonioAPIError):
    """Raised on timeout or connection failure — Personio unreachable."""


# ---------------------------------------------------------------------------
# PersonioClient
# ---------------------------------------------------------------------------


class PersonioClient:
    """Async HTTP client for the Personio v1 API.

    Usage:
        client = PersonioClient(client_id="...", client_secret="...")
        token = await client._get_valid_token()
        # ... make API calls using client._http with token in Authorization header
        await client.close()
    """

    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._token: str | None = None
        self._expires_at: float = 0.0
        self._http = httpx.AsyncClient(
            base_url=PERSONIO_BASE_URL,
            timeout=30.0,
        )

    async def close(self) -> None:
        """Close the underlying HTTP client. Call on app shutdown."""
        await self._http.aclose()

    async def authenticate(self) -> str:
        """POST /auth with credentials, cache and return the bearer token.

        Raises:
            PersonioAuthError: HTTP 401 — invalid credentials.
            PersonioRateLimitError: HTTP 429 — rate limited, with retry_after.
            PersonioNetworkError: Timeout or connection failure.
            PersonioAPIError: Any other non-success HTTP status.
        """
        try:
            resp = await self._http.post(
                "/auth",
                json={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
        except httpx.TimeoutException as exc:
            raise PersonioNetworkError(
                f"Personio unreachable (timeout): {exc}"
            ) from exc
        except httpx.RequestError as exc:
            raise PersonioNetworkError(
                f"Personio unreachable: {exc}"
            ) from exc

        if resp.status_code == 401:
            raise PersonioAuthError("Invalid credentials", status_code=401)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            raise PersonioRateLimitError(
                f"Rate limited, retry in {retry_after}s",
                retry_after=retry_after,
            )

        if resp.is_error:
            raise PersonioAPIError(
                f"Personio auth failed with status {resp.status_code}",
                status_code=resp.status_code,
            )

        token: str = resp.json()["data"]["token"]
        self._token = token
        self._expires_at = time.monotonic() + TOKEN_TTL_SECONDS
        return token

    async def _get_valid_token(self) -> str:
        """Return a cached token, re-authenticating if missing or near expiry.

        Proactively refreshes when <TOKEN_REFRESH_BUFFER seconds remain (D-13).
        """
        if (
            self._token is None
            or time.monotonic() > self._expires_at - TOKEN_REFRESH_BUFFER
        ):
            await self.authenticate()

        # authenticate() always sets self._token; assertion for type narrowing
        assert self._token is not None
        return self._token

    async def fetch_employees(self) -> list[dict]:
        """Paginated GET /company/employees. Returns list of raw employee dicts.

        Uses offset-based pagination with limit=50. Loops until response is
        smaller than the limit (i.e., last page).
        """
        token = await self._get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        results: list[dict] = []
        offset = 0
        limit = 50
        while True:
            try:
                resp = await self._http.get(
                    "/company/employees",
                    headers=headers,
                    params={"limit": limit, "offset": offset},
                )
            except httpx.TimeoutException as exc:
                raise PersonioNetworkError(f"Personio unreachable (timeout): {exc}") from exc
            except httpx.RequestError as exc:
                raise PersonioNetworkError(f"Personio unreachable: {exc}") from exc
            if resp.status_code == 401:
                raise PersonioAuthError("Invalid credentials", status_code=401)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "60"))
                raise PersonioRateLimitError(f"Rate limited, retry in {retry_after}s", retry_after=retry_after)
            if resp.is_error:
                raise PersonioAPIError(f"Personio API error {resp.status_code}", status_code=resp.status_code)
            data = resp.json()["data"]
            results.extend(data)
            if len(data) < limit:
                break
            offset += limit
        return results

    async def fetch_attendances(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict]:
        """Paginated GET /company/attendances. Returns list of raw attendance dicts.

        Personio requires start_date and end_date (YYYY-MM-DD). Defaults to a
        13-month rolling window to cover current + previous month + previous year
        for KPI delta comparisons.
        """
        if not start_date or not end_date:
            from datetime import date, timedelta
            today = date.today()
            end_date = today.isoformat()
            start_date = (today.replace(day=1) - timedelta(days=395)).isoformat()
        token = await self._get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        results: list[dict] = []
        offset = 0
        limit = 50
        while True:
            try:
                resp = await self._http.get(
                    "/company/attendances",
                    headers=headers,
                    params={
                        "limit": limit,
                        "offset": offset,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )
            except httpx.TimeoutException as exc:
                raise PersonioNetworkError(f"Personio unreachable (timeout): {exc}") from exc
            except httpx.RequestError as exc:
                raise PersonioNetworkError(f"Personio unreachable: {exc}") from exc
            if resp.status_code == 401:
                raise PersonioAuthError("Invalid credentials", status_code=401)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "60"))
                raise PersonioRateLimitError(f"Rate limited, retry in {retry_after}s", retry_after=retry_after)
            if resp.is_error:
                raise PersonioAPIError(f"Personio API error {resp.status_code}", status_code=resp.status_code)
            data = resp.json()["data"]
            results.extend(data)
            if len(data) < limit:
                break
            offset += limit
        return results

    async def fetch_absences(self) -> list[dict]:
        """Paginated GET /company/absence-periods. Returns list of raw absence dicts."""
        token = await self._get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        results: list[dict] = []
        offset = 0
        limit = 50
        while True:
            try:
                resp = await self._http.get(
                    "/company/absence-periods",
                    headers=headers,
                    params={"limit": limit, "offset": offset},
                )
            except httpx.TimeoutException as exc:
                raise PersonioNetworkError(f"Personio unreachable (timeout): {exc}") from exc
            except httpx.RequestError as exc:
                raise PersonioNetworkError(f"Personio unreachable: {exc}") from exc
            if resp.status_code == 401:
                raise PersonioAuthError("Invalid credentials", status_code=401)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "60"))
                raise PersonioRateLimitError(f"Rate limited, retry in {retry_after}s", retry_after=retry_after)
            if resp.is_error:
                raise PersonioAPIError(f"Personio API error {resp.status_code}", status_code=resp.status_code)
            data = resp.json()["data"]
            results.extend(data)
            if len(data) < limit:
                break
            offset += limit
        return results

    async def fetch_absence_types(self) -> list[dict]:
        """Paginated GET /company/time-off-types. Returns list of absence type dicts.

        Uses the correct v1 endpoint path (not /company/absence-types, which
        returns 404).
        """
        token = await self._get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            resp = await self._http.get(
                "/company/time-off-types",
                headers=headers,
            )
        except httpx.TimeoutException as exc:
            raise PersonioNetworkError(f"Personio unreachable (timeout): {exc}") from exc
        except httpx.RequestError as exc:
            raise PersonioNetworkError(f"Personio unreachable: {exc}") from exc
        if resp.status_code == 401:
            raise PersonioAuthError("Invalid credentials", status_code=401)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            raise PersonioRateLimitError(f"Rate limited, retry in {retry_after}s", retry_after=retry_after)
        if resp.is_error:
            raise PersonioAPIError(f"Personio API error {resp.status_code}", status_code=resp.status_code)
        return resp.json()["data"]
