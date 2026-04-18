import { createDirectus, authentication, rest } from "@directus/sdk";

const DIRECTUS_URL =
  (import.meta.env.VITE_DIRECTUS_URL as string | undefined) ??
  "http://localhost:8055";

/**
 * Singleton Directus SDK client.
 *
 * Cookie-mode auth: the SDK stores the refresh token in an httpOnly cookie
 * set by Directus. `credentials: 'include'` is required for the cookie to
 * travel with refresh requests — matches the Directus CORS_CREDENTIALS=true
 * setting configured in docker-compose.yml (Plan 01).
 *
 * The short-lived access token returned by `login()` / `refresh()` is pulled
 * via `directus.getToken()` and handed to the module-singleton in
 * `apiClient.ts` (see Pattern 1 in 29-RESEARCH.md).
 */
export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication("cookie", { credentials: "include" }))
  .with(rest({ credentials: "include" }));
