import { apiClient, getAccessToken } from "@/lib/apiClient";
import { directus } from "@/lib/directusClient";
import {
  readItems,
  createItem,
  createItems,
  updateItem,
  deleteItem,
  deleteItems,
} from "@directus/sdk";
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

// Phase 69-03 (D-01): mirrors SignagePlaylistItemRead 8 fields.
// Applied to every Directus playlist-items GET to keep payload shape stable.
const PLAYLIST_ITEM_FIELDS = [
  "id",
  "playlist_id",
  "media_id",
  "position",
  "duration_s",
  "transition",
  "created_at",
  "updated_at",
] as const;

// Phase 69-03: mirrors SignagePlaylistRead minus derived tag_ids
// (tag_ids is hydrated separately via signage_playlist_tag_map).
const PLAYLIST_FIELDS = [
  "id",
  "name",
  "description",
  "priority",
  "enabled",
  "created_at",
  "updated_at",
] as const;

// Phase 68-04 (D-07): field allowlist mirroring SignageSchedule (signageTypes.ts)
// — applied to every Directus schedule request to keep payload shape stable.
const SCHEDULE_FIELDS = [
  "id",
  "playlist_id",
  "weekday_mask",
  "start_hhmm",
  "end_hhmm",
  "priority",
  "enabled",
  "created_at",
  "updated_at",
] as const;

// Typed GETs — reused by primitives + sub-pages. Use apiClient (not
// apiClientWithBody) for anything that does NOT need 409-body extraction.
export const signageApi = {
  // Phase 68-04 (D-04, D-07): Tag CRUD swapped from FastAPI to Directus SDK.
  // Collection name is `signage_device_tags` (verified directus/snapshots/v1.22.yaml),
  // NOT `signage_tags`. Public signatures unchanged (D-00g).
  listTags: () =>
    directus.request(
      readItems("signage_device_tags", {
        fields: ["id", "name"],
        sort: ["id"],
        limit: -1,
      }),
    ) as Promise<SignageTag[]>,
  createTag: (name: string) =>
    directus.request(
      createItem("signage_device_tags", { name }, { fields: ["id", "name"] }),
    ) as Promise<SignageTag>,
  updateTag: (id: number, name: string) =>
    directus.request(
      updateItem("signage_device_tags", id, { name }, { fields: ["id", "name"] }),
    ) as Promise<SignageTag>,
  deleteTag: (id: number) =>
    directus.request(deleteItem("signage_device_tags", id)) as Promise<null>,
  listMedia: () => apiClient<SignageMedia[]>("/api/signage/media"),
  getMedia: (id: string) =>
    apiClient<SignageMedia>(`/api/signage/media/${id}`),
  deleteMedia: (id: string) =>
    apiClientWithBody<null>(`/api/signage/media/${id}`, { method: "DELETE" }),
  // Phase 69-03 (D-07, D-00g, D-01): playlist metadata + items GET swapped from
  // FastAPI to Directus SDK. Public signatures unchanged so consumers
  // (PlaylistsPage, PlaylistEditorPage, PlaylistEditDialog) continue to receive
  // SignagePlaylist[] / SignagePlaylist with `tag_ids` populated. tag_ids is
  // hydrated by a parallel readItems('signage_playlist_tag_map', ...) call
  // (Option A: preserve consumer contract — PlaylistEditorPage reads
  // data.playlist.tag_ids unconditionally).
  //
  // Surviving FastAPI surface (D-00 architectural lock):
  //   - deletePlaylist: keeps apiClientWithBody to preserve the 409
  //     `{detail, schedule_ids}` shape consumed by PlaylistDeleteDialog.
  //   - bulkReplaceItems: keeps apiClient PUT for atomic DELETE+INSERT.
  listPlaylists: async () => {
    const [rows, map] = await Promise.all([
      directus.request(
        readItems("signage_playlists", {
          fields: [...PLAYLIST_FIELDS],
          sort: ["name"],
          limit: -1,
        }),
      ) as Promise<Omit<SignagePlaylist, "tag_ids" | "tags">[]>,
      directus.request(
        readItems("signage_playlist_tag_map", {
          fields: ["playlist_id", "tag_id"],
          limit: -1,
        }),
      ) as Promise<{ playlist_id: string; tag_id: number }[]>,
    ]);
    const byPid = new Map<string, number[]>();
    for (const m of map) {
      const arr = byPid.get(m.playlist_id) ?? [];
      arr.push(m.tag_id);
      byPid.set(m.playlist_id, arr);
    }
    return rows.map(
      (r) => ({ ...r, tag_ids: byPid.get(r.id) ?? [] }) as SignagePlaylist,
    );
  },
  getPlaylist: async (id: string) => {
    const [row, tagRows] = await Promise.all([
      directus.request(
        readItems("signage_playlists", {
          filter: { id: { _eq: id } },
          fields: [...PLAYLIST_FIELDS],
          limit: 1,
        }),
      ) as Promise<Omit<SignagePlaylist, "tag_ids" | "tags">[]>,
      directus.request(
        readItems("signage_playlist_tag_map", {
          filter: { playlist_id: { _eq: id } },
          fields: ["tag_id"],
          limit: -1,
        }),
      ) as Promise<{ tag_id: number }[]>,
    ]);
    if (!row.length) throw new Error(`Playlist ${id} not found`);
    return {
      ...row[0],
      tag_ids: tagRows.map((t) => t.tag_id),
    } as SignagePlaylist;
  },
  createPlaylist: (body: {
    name: string;
    description?: string | null;
    priority?: number;
    enabled?: boolean;
  }) =>
    directus.request(
      createItem("signage_playlists", body, { fields: [...PLAYLIST_FIELDS] }),
    ) as Promise<SignagePlaylist>,
  updatePlaylist: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      priority?: number;
      enabled?: boolean;
    },
  ) =>
    directus.request(
      updateItem("signage_playlists", id, body, {
        fields: [...PLAYLIST_FIELDS],
      }),
    ) as Promise<SignagePlaylist>,
  // Phase 52 D-13: uses apiClientWithBody so callers can read the 409
  // response body { detail, schedule_ids } when a playlist is blocked by
  // active schedules (FK RESTRICT from signage_schedules.playlist_id).
  // PRESERVED: D-00 architectural lock — DELETE stays in FastAPI.
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
    directus.request(
      readItems("signage_playlist_items", {
        filter: { playlist_id: { _eq: id } },
        fields: [...PLAYLIST_ITEM_FIELDS],
        sort: ["position"],
        limit: -1,
      }),
    ) as Promise<SignagePlaylistItem[]>,
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
  // Phase 68-04 (D-07): Schedule CRUD swapped from FastAPI to Directus SDK.
  // Sort matches FastAPI's prior contract (priority desc, updated_at desc).
  // Inverted-range writes surface as DirectusError carrying the validation
  // hook's i18n key (Plan 02). Public signatures unchanged (D-00g).
  listSchedules: () =>
    directus.request(
      readItems("signage_schedules", {
        fields: [...SCHEDULE_FIELDS],
        sort: ["-priority", "-updated_at"],
        limit: -1,
      }),
    ) as Promise<SignageSchedule[]>,
  createSchedule: (body: SignageScheduleCreate) =>
    directus.request(
      createItem("signage_schedules", body, { fields: [...SCHEDULE_FIELDS] }),
    ) as Promise<SignageSchedule>,
  updateSchedule: (id: string, body: SignageScheduleUpdate) =>
    directus.request(
      updateItem("signage_schedules", id, body, { fields: [...SCHEDULE_FIELDS] }),
    ) as Promise<SignageSchedule>,
  deleteSchedule: (id: string) =>
    directus.request(deleteItem("signage_schedules", id)) as Promise<null>,
};
