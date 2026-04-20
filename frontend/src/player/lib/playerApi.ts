// Phase 47: device-JWT fetch adapter. THIS IS THE ONE PERMITTED RAW fetch() CALLSITE
// in frontend/src/player/**. The CI guard (Plan 47-05 check-player-isolation.mjs) exempts this file.
// Documented exception per ROADMAP "v1.16 Cross-Cutting Hazards" #2:
//   "Phase 47 player uses its own minimal fetch with device-token bearer, documented exception."

export class PlayerApiError extends Error {
  constructor(public status: number, public bodyText: string, public url: string) {
    super(`PlayerApi ${status} on ${url}: ${bodyText.slice(0, 200)}`);
    this.name = "PlayerApiError";
  }
}

export interface PlayerFetchOpts extends Omit<RequestInit, "headers"> {
  token: string;
  headers?: Record<string, string>;
  /** Called exactly once when the server returns 401 (device revoked). */
  on401?: () => void;
}

export async function playerFetch<T>(url: string, opts: PlayerFetchOpts): Promise<T> {
  const { token, on401, headers, ...rest } = opts;
  const r = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (r.status === 401) {
    on401?.();
    throw new PlayerApiError(401, await r.text().catch(() => ""), url);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new PlayerApiError(r.status, body, url);
  }
  // 204 No Content path (heartbeat-shaped responses) — caller asks for void.
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}
