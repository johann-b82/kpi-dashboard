import { apiClient, getAccessToken } from "@/lib/apiClient";
import type {
  SignageTag,
  SignageMedia,
  SignageDevice,
  SignagePlaylist,
  SignagePlaylistItem,
  SignageSchedule,
  SignageScheduleCreate,
  SignageScheduleUpdate,
  SignageDeviceAnalytics,
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
    apiClient<SignagePlaylist>(`/api/signage/playlists/${id}`),
  // 46-05 — playlist mutations.
  //
  // Backend contract notes (verified against
  // backend/app/routers/signage_admin/{playlists,playlist_items}.py):
  //   - createPlaylist: POST body is SignagePlaylistCreate; the router calls
  //     `payload.model_dump(exclude={"tag_ids"})`, so tags MUST be assigned
  //     via replacePlaylistTags() AFTER create.
  //   - updatePlaylist: PATCH (NOT PUT). Accepts only
  //     {name, description, priority, enabled}; tags also flow through
  //     replacePlaylistTags().
  //   - replacePlaylistTags: PUT /playlists/{id}/tags — atomic bulk replace.
  //   - bulkReplaceItems: PUT /playlists/{id}/items, body
  //     { items: [{ media_id, position, duration_s, transition }] }.
  //   - listPlaylistItems: GET /playlists/{id}/items — authoritative path
  //     for editor item hydration (the GET /playlists/{id} response does
  //     NOT include items).
  createPlaylist: (body: {
    name: string;
    description?: string | null;
    priority?: number;
    enabled?: boolean;
  }) =>
    apiClient<SignagePlaylist>("/api/signage/playlists", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePlaylist: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      priority?: number;
      enabled?: boolean;
    },
  ) =>
    apiClient<SignagePlaylist>(`/api/signage/playlists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  // Phase 52 D-13: uses apiClientWithBody so callers can read the 409
  // response body { detail, schedule_ids } when a playlist is blocked by
  // active schedules (FK RESTRICT from signage_schedules.playlist_id).
  deletePlaylist: (id: string) =>
    apiClientWithBody<null>(`/api/signage/playlists/${id}`, {
      method: "DELETE",
    }),
  replacePlaylistTags: (id: string, tag_ids: number[]) =>
    apiClient<{ tag_ids: number[] }>(`/api/signage/playlists/${id}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tag_ids }),
    }),
  listPlaylistItems: (id: string) =>
    apiClient<SignagePlaylistItem[]>(
      `/api/signage/playlists/${id}/items`,
    ),
  bulkReplaceItems: (
    id: string,
    items: Array<{
      media_id: string;
      position: number;
      duration_s: number;
      transition: string | null;
    }>,
  ) =>
    apiClient<SignagePlaylistItem[]>(
      `/api/signage/playlists/${id}/items`,
      { method: "PUT", body: JSON.stringify({ items }) },
    ),
  listDevices: () => apiClient<SignageDevice[]>("/api/signage/devices"),
  // Phase 53 SGN-ANA-01 — Analytics-lite. Separate query from listDevices
  // so the two data streams can poll/invalidate independently (D-11).
  // Backend: backend/app/routers/signage_admin/analytics.py
  listDeviceAnalytics: () =>
    apiClient<SignageDeviceAnalytics[]>("/api/signage/analytics/devices"),
  // 46-06 — device admin + pairing claim
  // Backend SignageDeviceAdminUpdate accepts {name?} only; tags are bulk-replaced
  // via the separate PUT /devices/{id}/tags endpoint. updateDevice() filters the
  // body so callers can pass {name, tag_ids} for ergonomics — tag_ids is forwarded
  // to replaceDeviceTags() by DeviceEditDialog (sequenced PATCH then PUT).
  updateDevice: (id: string, body: { name?: string; tag_ids?: number[] }) =>
    apiClient<SignageDevice>(`/api/signage/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: body.name }),
    }),
  replaceDeviceTags: (id: string, tag_ids: number[]) =>
    apiClient<{ tag_ids: number[] }>(`/api/signage/devices/${id}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tag_ids }),
    }),
  // Phase 62 — CAL-UI-03. PATCH /api/signage/devices/{id}/calibration. Body is
  // partial; backend applies only provided fields (exclude_unset=True) and
  // emits a `calibration-changed` SSE event. Returns the updated device so the
  // admin UI can reconcile without a second GET (backend returns
  // SignageDeviceRead with resolved playlist + tags). 422 on invalid rotation.
  updateDeviceCalibration: (
    id: string,
    body: Partial<{
      rotation: 0 | 90 | 180 | 270;
      hdmi_mode: string | null;
      audio_enabled: boolean;
    }>,
  ) =>
    apiClient<SignageDevice>(`/api/signage/devices/${id}/calibration`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  // Revoke lives on the pair router per backend/app/routers/signage_pair.py
  // (`POST /api/signage/pair/devices/{device_id}/revoke`).
  revokeDevice: (id: string) =>
    apiClient<null>(`/api/signage/pair/devices/${id}/revoke`, {
      method: "POST",
    }),
  claimPairingCode: (body: {
    code: string;
    device_name: string;
    tag_ids: number[] | null;
  }) =>
    apiClient<null>("/api/signage/pair/claim", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Phase 52 SGN-SCHED-UI-01/02 — Schedules CRUD.
  // Backend router: backend/app/routers/signage_admin/schedules.py.
  // All methods use the shared apiClient (hard gate 2 — no raw fetch).
  listSchedules: () =>
    apiClient<SignageSchedule[]>("/api/signage/schedules"),
  createSchedule: (body: SignageScheduleCreate) =>
    apiClient<SignageSchedule>("/api/signage/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSchedule: (id: string, body: SignageScheduleUpdate) =>
    apiClient<SignageSchedule>(`/api/signage/schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteSchedule: (id: string) =>
    apiClient<null>(`/api/signage/schedules/${id}`, { method: "DELETE" }),
};
