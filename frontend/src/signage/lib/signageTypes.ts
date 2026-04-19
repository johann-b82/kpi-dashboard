// Signage admin TypeScript types — narrow mirrors of backend Pydantic schemas.
// Only fields consumed by the admin UI are modeled here.

export type SignageMediaKind =
  | "image"
  | "video"
  | "pdf"
  | "pptx"
  | "url"
  | "html";

export type SignageConversionStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed";

export interface SignageTag {
  id: number;
  name: string;
}

export interface SignageMedia {
  id: string; // uuid as string over JSON
  kind: SignageMediaKind;
  title: string;
  directus_file_id: string | null;
  url: string | null;
  tags: SignageTag[]; // backend returns tag objects
  metadata: Record<string, unknown> | null;
  conversion_status: SignageConversionStatus | null;
  conversion_error: string | null;
  slide_paths: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SignageDevice {
  id: string;
  name: string;
  status: "pending" | "online" | "offline";
  last_seen_at: string | null; // ISO-8601 or null
  revoked_at: string | null;
  tags: SignageTag[];
  current_playlist_id: string | null;
  current_playlist_name?: string | null; // optional; filled by admin list endpoint if present
  created_at: string;
  updated_at: string;
}

export interface SignagePlaylist {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  // Backend SignagePlaylistRead does not currently embed tag objects on
  // the list/detail responses; `tag_ids` may be present (number[]) or null
  // depending on the route. `tags` is reserved for a future enhancement.
  tag_ids: number[] | null;
  tags?: SignageTag[];
  created_at: string;
  updated_at: string;
}

export interface SignagePlaylistItem {
  id?: string; // optional client-side for drag keys
  media_id: string;
  position: number;
  duration_s: number;
  transition: string | null; // "fade" | "cut" | null
}

// 409 response shape from DELETE /api/signage/media/{id} when RESTRICT fires.
export interface MediaInUseError {
  detail: string;
  playlist_ids: string[];
}
