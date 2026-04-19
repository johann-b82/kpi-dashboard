import { apiClient, getAccessToken } from "@/lib/apiClient";
import type {
  SignageTag,
  SignageMedia,
  SignageDevice,
  SignagePlaylist,
  SignagePlaylistItem,
} from "./signageTypes";

/**
 * Error subclass that preserves both the HTTP status and the JSON response body
 * so callers can extract structured fields (e.g. `playlist_ids` from a 409 on
 * media delete). The shared `apiClient` discards the body and only surfaces
 * `body.detail` as `Error.message`, which is insufficient for the in-use UX.
 */
export class ApiErrorWithBody extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiErrorWithBody";
    this.status = status;
    this.body = body;
  }
}

/**
 * Signage-specific apiClient variant that preserves the full JSON body on
 * error, needed for the 409 `playlist_ids` extraction on media delete
 * (Pitfall 6 in 46-RESEARCH.md). Honors the same bearer + credentials
 * contract as the shared apiClient; no `fetch()` elsewhere in signage
 * (CI grep guard added in 46-04).
 */
export async function apiClientWithBody<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const resp = await fetch(path, { ...init, headers, credentials: "include" });
  const contentType = resp.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await resp.json().catch(() => null)
    : null;
  if (!resp.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${resp.status}`;
    throw new ApiErrorWithBody(resp.status, body, detail);
  }
  return body as T;
}

// Typed GETs — reused by primitives + sub-pages. Use apiClient (not
// apiClientWithBody) for anything that does NOT need 409-body extraction.
export const signageApi = {
  listTags: () => apiClient<SignageTag[]>("/api/signage/tags"),
  createTag: (name: string) =>
    apiClient<SignageTag>("/api/signage/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listMedia: () => apiClient<SignageMedia[]>("/api/signage/media"),
  getMedia: (id: string) =>
    apiClient<SignageMedia>(`/api/signage/media/${id}`),
  deleteMedia: (id: string) =>
    apiClientWithBody<null>(`/api/signage/media/${id}`, { method: "DELETE" }),
  listPlaylists: () => apiClient<SignagePlaylist[]>("/api/signage/playlists"),
  getPlaylist: (id: string) =>
    apiClient<SignagePlaylist & { items: SignagePlaylistItem[] }>(
      `/api/signage/playlists/${id}`,
    ),
  listDevices: () => apiClient<SignageDevice[]>("/api/signage/devices"),
};
