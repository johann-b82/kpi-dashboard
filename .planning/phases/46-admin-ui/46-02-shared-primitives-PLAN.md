---
phase: 46-admin-ui
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/components/TagPicker.tsx
  - frontend/src/signage/components/DeviceStatusChip.tsx
  - frontend/src/signage/components/MediaStatusPill.tsx
  - frontend/src/signage/components/MediaDeleteDialog.tsx
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/signage/lib/signageTypes.ts
autonomous: true
requirements:
  - SGN-ADM-08
must_haves:
  truths:
    - "TagPicker renders an array of tag chips + autocomplete input; Enter/comma commits; Backspace on empty removes last chip; dropdown filters existing tags"
    - "DeviceStatusChip shows green <2min / amber 2-5min / red >5min / grey unseen, derived client-side from last_seen_at via date-fns"
    - "MediaStatusPill auto-polls signage.media.{id} every 3s until terminal (done|failed) and stops"
    - "MediaDeleteDialog shows count of blocking playlists extracted from 409 response.playlist_ids.length"
  artifacts:
    - path: frontend/src/signage/components/TagPicker.tsx
      provides: "Token-chip autocomplete component"
      contains: "export function TagPicker"
    - path: frontend/src/signage/components/DeviceStatusChip.tsx
      provides: "Status chip derived from last_seen_at"
      contains: "differenceInMinutes"
    - path: frontend/src/signage/components/MediaStatusPill.tsx
      provides: "PPTX conversion status badge with polling"
      contains: "refetchInterval"
    - path: frontend/src/signage/components/MediaDeleteDialog.tsx
      provides: "In-use-by-N confirm dialog"
    - path: frontend/src/signage/lib/signageTypes.ts
      provides: "TypeScript types matching backend Pydantic schemas"
    - path: frontend/src/signage/lib/signageApi.ts
      provides: "Centralized apiClient wrappers (tags/media GETs) used by these primitives"
  key_links:
    - from: frontend/src/signage/components/TagPicker.tsx
      to: "/api/signage/tags"
      via: "useQuery + apiClient"
      pattern: "apiClient.*signage/tags"
    - from: frontend/src/signage/components/MediaStatusPill.tsx
      to: "/api/signage/media/{id}"
      via: "useQuery with dynamic refetchInterval"
      pattern: "refetchInterval:.*query"
---

<objective>
Build the four cross-cutting signage components + a typed API wrapper module that 46-04/05/06 all consume. These are pure presentational/data components with minimal business logic, safe to build in parallel with 46-01.

Purpose: Extract shared widgets so sub-pages are thin orchestrators. TagPicker used by playlist editor (46-05), device edit (46-06), and pair page (46-06). Status chips/pills used by devices (46-06) and media (46-04).

Output: Four reusable components + `signageApi.ts` wrapper + `signageTypes.ts` — all import-clean, no route wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-admin-ui/46-CONTEXT.md
@.planning/phases/46-admin-ui/46-RESEARCH.md
@.planning/phases/46-admin-ui/46-UI-SPEC.md

<interfaces>
From backend/app/schemas/signage.py (verified 2026-04-19 — exact field shapes):
```python
class SignageMediaBase(BaseModel):
    kind: Literal["image", "video", "pdf", "pptx", "url", "html"]
    title: str
    # other fields include directus_file_id: str | None, url: str | None, tags: list[int], metadata: dict

class SignageMediaRead(SignageMediaBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    conversion_status: Literal["pending", "processing", "done", "failed"] | None
    conversion_error: str | None
    slide_paths: list[str] | None
    # inherits title, kind, tags, ...

class SignageDeviceRead(BaseModel):
    id: uuid.UUID
    name: str
    status: str               # "pending" | "online" | "offline"
    last_seen_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # tags: list[SignageDeviceTagRead]

class SignageDeviceTagRead(BaseModel):
    id: int
    name: str
```

From backend/app/routers/signage_admin/media.py (verified — delete 409 body shape):
- DELETE /api/signage/media/{id} returns 409 JSONResponse with body:
  `{"detail": "media in use by playlists", "playlist_ids": ["<uuid>", ...]}`
- Count is derived from `playlist_ids.length` (NOT embedded in `detail` string).

From frontend/src/lib/apiClient.ts:
```ts
export async function apiClient<T>(path: string, init?: RequestInit): Promise<T>;
// Throws new Error(body.detail || `HTTP ${status}`) on non-ok.
// Attempts 401-refresh-retry once via directus.refresh().
```
The `apiClient` throws a plain `Error(body.detail)` on non-ok — the raw response body (including `playlist_ids`) is NOT attached. For 409 extraction we need a variant that exposes the body.

From frontend/src/lib/queryKeys.ts (after 46-01):
```ts
export const signageKeys = {
  tags: () => ["signage", "tags"] as const,
  mediaItem: (id: string) => ["signage", "media", id] as const,
  // ...
};
```

From shadcn installed primitives:
- `Badge` (frontend/src/components/ui/badge.tsx) — used for chips + status pills
- `Popover`, `PopoverContent`, `PopoverTrigger` — TagPicker dropdown
- `Dialog` family — MediaDeleteDialog base

From 46-UI-SPEC.md — exact class lists + keyboard contract:
- TagPicker container: `border border-input rounded-md p-2 flex flex-wrap gap-1 min-h-[40px] cursor-text`
- TagPicker chip: `<Badge variant="secondary" className="gap-1 pr-1">` + `×` button
- DeviceStatusChip thresholds (D-14): green `<2min`, amber `2-5min`, red `>5min`, grey if last_seen_at null
- MediaStatusPill color map: pending=muted, processing=amber+animate-pulse, done=green, failed=red

From date-fns:
```ts
import { differenceInMinutes } from "date-fns";
const mins = differenceInMinutes(new Date(), new Date(lastSeenAt));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create signageTypes.ts + signageApi.ts (typed wrappers + 409 body extraction)</name>
  <read_first>
    - frontend/src/lib/apiClient.ts (full file — understand error throw shape)
    - frontend/src/lib/queryKeys.ts (observe signageKeys added in 46-01; if parallel-executed and missing, create it here + coordinate)
    - backend/app/schemas/signage.py lines 25-178 (all signage schemas)
    - 46-RESEARCH.md §"Pattern 8: TanStack Query with refetchInterval"
  </read_first>
  <files>
    - frontend/src/signage/lib/signageTypes.ts (CREATE)
    - frontend/src/signage/lib/signageApi.ts (CREATE)
  </files>
  <action>
    **1a. `signageTypes.ts` — TypeScript mirrors of backend Pydantic schemas.** Keep types narrow; only fields consumed by the admin UI.

    ```ts
    // frontend/src/signage/lib/signageTypes.ts
    export type SignageMediaKind = "image" | "video" | "pdf" | "pptx" | "url" | "html";
    export type SignageConversionStatus = "pending" | "processing" | "done" | "failed";

    export interface SignageTag {
      id: number;
      name: string;
    }

    export interface SignageMedia {
      id: string;                                    // uuid as string over JSON
      kind: SignageMediaKind;
      title: string;
      directus_file_id: string | null;
      url: string | null;
      tags: SignageTag[];                            // backend returns tag objects
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
      last_seen_at: string | null;                   // ISO-8601 or null
      revoked_at: string | null;
      tags: SignageTag[];
      current_playlist_id: string | null;
      current_playlist_name?: string | null;         // optional; filled by admin list endpoint if present
      created_at: string;
      updated_at: string;
    }

    export interface SignagePlaylist {
      id: string;
      name: string;
      enabled: boolean;
      priority: number;
      tags: SignageTag[];
      created_at: string;
      updated_at: string;
    }

    export interface SignagePlaylistItem {
      id?: string;                                   // optional client-side for drag keys
      media_id: string;
      position: number;
      duration_s: number;
      transition: string | null;                     // "fade" | "cut" | null
    }

    // 409 response shape from DELETE /api/signage/media/{id} when RESTRICT fires.
    export interface MediaInUseError {
      detail: string;
      playlist_ids: string[];
    }
    ```

    **1b. `signageApi.ts` — typed apiClient wrappers + `ApiErrorWithBody` that preserves the response body.**

    The stock `apiClient<T>()` throws `Error(body.detail)` and discards `playlist_ids`. Add a second function `apiClientWithBody<T>()` that throws `ApiErrorWithBody` carrying `.status` + `.body` so `MediaDeleteDialog` can extract `playlist_ids.length`. Do NOT modify the existing `apiClient.ts` — keep the new variant local to signage.

    ```ts
    // frontend/src/signage/lib/signageApi.ts
    import { apiClient, getAccessToken } from "@/lib/apiClient";
    import type { SignageTag, SignageMedia, SignageDevice, SignagePlaylist, SignagePlaylistItem } from "./signageTypes";

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
     * Signage-specific apiClient variant that preserves the full JSON body on error,
     * needed for the 409 `playlist_ids` extraction on media delete (Pitfall 6 in
     * 46-RESEARCH.md). Honors the same bearer + credentials contract as the shared
     * apiClient; no fetch() elsewhere in signage (CI grep guard).
     */
    export async function apiClientWithBody<T>(path: string, init?: RequestInit): Promise<T> {
      const token = getAccessToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const resp = await fetch(path, { ...init, headers, credentials: "include" });
      const contentType = resp.headers.get("content-type") ?? "";
      const body: unknown = contentType.includes("application/json") ? await resp.json().catch(() => null) : null;
      if (!resp.ok) {
        const detail = (body && typeof body === "object" && "detail" in body) ? String((body as { detail: unknown }).detail) : `HTTP ${resp.status}`;
        throw new ApiErrorWithBody(resp.status, body, detail);
      }
      return body as T;
    }

    // Typed GETs — reused by primitives + sub-pages. Use apiClient (not apiClientWithBody)
    // for anything that does NOT need 409-body extraction.
    export const signageApi = {
      listTags: () => apiClient<SignageTag[]>("/api/signage/tags"),
      createTag: (name: string) => apiClient<SignageTag>("/api/signage/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
      listMedia: () => apiClient<SignageMedia[]>("/api/signage/media"),
      getMedia: (id: string) => apiClient<SignageMedia>(`/api/signage/media/${id}`),
      deleteMedia: (id: string) => apiClientWithBody<null>(`/api/signage/media/${id}`, { method: "DELETE" }),
      listPlaylists: () => apiClient<SignagePlaylist[]>("/api/signage/playlists"),
      getPlaylist: (id: string) => apiClient<SignagePlaylist & { items: SignagePlaylistItem[] }>(`/api/signage/playlists/${id}`),
      listDevices: () => apiClient<SignageDevice[]>("/api/signage/devices"),
    };
    ```

    NOTE on `fetch()` usage: this file uses `fetch` ONLY inside `apiClientWithBody` — the CI grep guard for Phase 46 must be written to exempt `frontend/src/signage/lib/signageApi.ts` (added in 46-04 as part of the media plan). Alternatively, you may re-export fetch inside the module so the grep pattern `fetch(` doesn't hit — but an explicit exemption is cleaner and matches D-18's single-exception model. For now, write `fetch(` plainly; 46-04 Task 3 adds the grep guard that scopes to signage components/pages only.

    CORRECTION to D-18 scope: `grep -rn "fetch(" frontend/src/signage` currently would fail. Scope the guard to `frontend/src/signage/components frontend/src/signage/pages frontend/src/signage/player` — `frontend/src/signage/lib/` is an explicit exemption (internal variant of apiClient, same security posture).
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | tail -20 && test -f src/signage/lib/signageTypes.ts && test -f src/signage/lib/signageApi.ts && grep -q "class ApiErrorWithBody" src/signage/lib/signageApi.ts && grep -q "playlist_ids" src/signage/lib/signageTypes.ts</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `grep -c "export interface SignageMedia\\b" frontend/src/signage/lib/signageTypes.ts` returns exactly 1
    - `grep -c "export interface SignageDevice\\b" frontend/src/signage/lib/signageTypes.ts` returns exactly 1
    - `grep -c "export interface SignagePlaylist\\b" frontend/src/signage/lib/signageTypes.ts` returns exactly 1
    - `grep -c "export interface SignagePlaylistItem" frontend/src/signage/lib/signageTypes.ts` returns exactly 1
    - `grep -c "export interface SignageTag\\b" frontend/src/signage/lib/signageTypes.ts` returns exactly 1
    - `grep -c "MediaInUseError" frontend/src/signage/lib/signageTypes.ts` returns ≥1
    - `grep -c "class ApiErrorWithBody" frontend/src/signage/lib/signageApi.ts` returns exactly 1
    - `grep -c "export const signageApi" frontend/src/signage/lib/signageApi.ts` returns exactly 1
    - `grep -c "apiClientWithBody" frontend/src/signage/lib/signageApi.ts` returns ≥2 (definition + usage)
    - `grep -c "deleteMedia" frontend/src/signage/lib/signageApi.ts` returns ≥1
  </acceptance_criteria>
  <done>Types + API wrapper exist, typecheck, ApiErrorWithBody preserves status + body for 409 extraction.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build TagPicker, DeviceStatusChip, MediaStatusPill</name>
  <read_first>
    - frontend/src/components/ui/badge.tsx (available variants)
    - frontend/src/components/ui/popover.tsx (Popover API)
    - frontend/src/components/ui/input.tsx
    - 46-UI-SPEC.md §"Interaction Contracts" items 6, 7 (DeviceStatusChip + TagPicker full anatomy)
    - 46-UI-SPEC.md §"Color" status chip / PPTX status pill color tables (EXACT class names)
    - 46-RESEARCH.md §"Pattern 9: PPTX Status Pill Polling" (refetchInterval signature)
  </read_first>
  <files>
    - frontend/src/signage/components/TagPicker.tsx (CREATE)
    - frontend/src/signage/components/DeviceStatusChip.tsx (CREATE)
    - frontend/src/signage/components/MediaStatusPill.tsx (CREATE)
  </files>
  <action>
    **2a. `TagPicker.tsx`** — Controlled `string[]` token-chip input.

    ```tsx
    import { useState, useRef, useId, type KeyboardEvent } from "react";
    import { useTranslation } from "react-i18next";
    import { useQuery } from "@tanstack/react-query";
    import { signageKeys } from "@/lib/queryKeys";
    import { signageApi } from "@/signage/lib/signageApi";
    import { Badge } from "@/components/ui/badge";
    import { X } from "lucide-react";

    export interface TagPickerProps {
      value: string[];                // tag names (create-on-submit semantic)
      onChange: (tags: string[]) => void;
      placeholder?: string;
      disabled?: boolean;
      ariaLabel?: string;
    }

    export function TagPicker({ value, onChange, placeholder, disabled, ariaLabel }: TagPickerProps) {
      const { t } = useTranslation();
      const [inputValue, setInputValue] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const inputRef = useRef<HTMLInputElement>(null);
      const listboxId = useId();

      // D-15: fetch once per session. Filter client-side.
      const { data: allTags = [] } = useQuery({
        queryKey: signageKeys.tags(),
        queryFn: signageApi.listTags,
        staleTime: Infinity,
      });

      const trimmed = inputValue.trim();
      const existingNames = new Set(allTags.map((t) => t.name.toLowerCase()));
      const suggestions = allTags
        .filter((tag) => tag.name.toLowerCase().includes(trimmed.toLowerCase()) && !value.includes(tag.name))
        .slice(0, 8);
      const showCreate = trimmed.length > 0 && !existingNames.has(trimmed.toLowerCase()) && !value.includes(trimmed);

      function commit(tag: string) {
        const t2 = tag.trim();
        if (!t2 || value.includes(t2)) return;
        onChange([...value, t2]);
        setInputValue("");
        setIsOpen(false);
      }

      function remove(tag: string) {
        onChange(value.filter((v) => v !== tag));
      }

      function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          if (trimmed) commit(trimmed);
          return;
        }
        if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
          e.preventDefault();
          remove(value[value.length - 1]);
          return;
        }
        if (e.key === "Escape") {
          setIsOpen(false);
          return;
        }
      }

      const resolvedPlaceholder = placeholder ?? t("signage.admin.tag_picker.placeholder");

      return (
        <div className="relative">
          <div
            className="border border-input rounded-md p-2 flex flex-wrap gap-1 min-h-[40px] cursor-text bg-background"
            onClick={() => inputRef.current?.focus()}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-label={ariaLabel}
          >
            {value.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(tag); }}
                  className="text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => setTimeout(() => setIsOpen(false), 150)}     // allow click on suggestion
              onKeyDown={handleKeyDown}
              placeholder={value.length === 0 ? resolvedPlaceholder : ""}
              className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
              disabled={disabled}
            />
          </div>

          {isOpen && (suggestions.length > 0 || showCreate) && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-50 mt-1 w-full min-w-[200px] bg-popover border border-border rounded-md shadow-md py-1 max-h-60 overflow-auto"
            >
              {suggestions.map((tag) => (
                <li
                  key={tag.id}
                  role="option"
                  className="text-sm px-3 py-2 hover:bg-muted cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); commit(tag.name); }}
                >
                  {tag.name}
                </li>
              ))}
              {showCreate && (
                <li
                  role="option"
                  className="text-sm px-3 py-2 text-primary hover:bg-muted cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); commit(trimmed); }}
                >
                  {t("signage.admin.tag_picker.create", { tag: trimmed })}
                </li>
              )}
            </ul>
          )}
        </div>
      );
    }
    ```

    **2b. `DeviceStatusChip.tsx`** — `last_seen_at` → green/amber/red/grey chip.

    ```tsx
    import { useTranslation } from "react-i18next";
    import { differenceInMinutes } from "date-fns";
    import { Badge } from "@/components/ui/badge";

    export interface DeviceStatusChipProps {
      lastSeenAt: string | null;
    }

    type Status = "online" | "warning" | "offline" | "unseen";

    function compute(lastSeenAt: string | null): { status: Status; minutes: number | null } {
      if (lastSeenAt === null) return { status: "unseen", minutes: null };
      const minutes = differenceInMinutes(new Date(), new Date(lastSeenAt));
      if (minutes < 2) return { status: "online", minutes };
      if (minutes < 5) return { status: "warning", minutes };
      return { status: "offline", minutes };
    }

    export function DeviceStatusChip({ lastSeenAt }: DeviceStatusChipProps) {
      const { t } = useTranslation();
      const { status, minutes } = compute(lastSeenAt);
      const classMap: Record<Status, string> = {
        online: "bg-green-100 text-green-800",
        warning: "bg-amber-100 text-amber-800",
        offline: "bg-red-100 text-red-800",
        unseen: "bg-muted text-muted-foreground",
      };
      const labelMap: Record<Status, string> = {
        online: t("signage.admin.devices.status.online"),
        warning: t("signage.admin.devices.status.warning", { minutes: minutes ?? 0 }),
        offline: t("signage.admin.devices.status.offline"),
        unseen: t("signage.admin.devices.status.unseen"),
      };
      return <Badge className={classMap[status]}>{labelMap[status]}</Badge>;
    }
    ```

    **2c. `MediaStatusPill.tsx`** — Polls media item; swaps color by status.

    ```tsx
    import { useTranslation } from "react-i18next";
    import { useQuery } from "@tanstack/react-query";
    import { signageKeys } from "@/lib/queryKeys";
    import { signageApi } from "@/signage/lib/signageApi";
    import { Badge } from "@/components/ui/badge";
    import type { SignageConversionStatus } from "@/signage/lib/signageTypes";

    export interface MediaStatusPillProps {
      mediaId: string;
      initialStatus?: SignageConversionStatus | null;
      initialError?: string | null;
    }

    export function MediaStatusPill({ mediaId, initialStatus, initialError }: MediaStatusPillProps) {
      const { t } = useTranslation();

      const { data } = useQuery({
        queryKey: signageKeys.mediaItem(mediaId),
        queryFn: () => signageApi.getMedia(mediaId),
        enabled: !!mediaId,
        // D-02 + Pattern 9: stop polling when terminal.
        refetchInterval: (query) => {
          const status = query.state.data?.conversion_status ?? initialStatus;
          if (status === "done" || status === "failed" || status === null || status === undefined) return false;
          return 3000;
        },
        refetchIntervalInBackground: false,
      });

      const status = data?.conversion_status ?? initialStatus ?? null;
      const errText = data?.conversion_error ?? initialError ?? null;
      if (!status) return null;

      const classMap: Record<SignageConversionStatus, string> = {
        pending: "bg-muted text-muted-foreground",
        processing: "bg-amber-100 text-amber-800 animate-pulse",
        done: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
      };
      const labelMap: Record<SignageConversionStatus, string> = {
        pending: t("signage.admin.media.status.pending"),
        processing: t("signage.admin.media.status.processing"),
        done: t("signage.admin.media.status.done"),
        failed: t("signage.admin.media.status.failed"),
      };

      return (
        <Badge className={classMap[status]} title={status === "failed" && errText ? errText : undefined}>
          {labelMap[status]}
        </Badge>
      );
    }
    ```

    All three components: use CSS token classes where possible; green/amber/red colors are semantic status (per UI-SPEC color table — exempt from `dark:` invariant since they're not theme accents). NO `dark:` variants. NO direct `fetch()` outside signageApi.ts.
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | tail -15 && grep -c "export function TagPicker" src/signage/components/TagPicker.tsx && grep -c "differenceInMinutes" src/signage/components/DeviceStatusChip.tsx && grep -c "refetchInterval" src/signage/components/MediaStatusPill.tsx && ! grep -rn "dark:" src/signage/components/</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `grep -c "export function TagPicker" frontend/src/signage/components/TagPicker.tsx` returns exactly 1
    - `grep -c "role=\"combobox\"" frontend/src/signage/components/TagPicker.tsx` returns ≥1
    - `grep -c "role=\"listbox\"" frontend/src/signage/components/TagPicker.tsx` returns ≥1
    - `grep -c "Backspace" frontend/src/signage/components/TagPicker.tsx` returns ≥1
    - `grep -c "signage.admin.tag_picker.create" frontend/src/signage/components/TagPicker.tsx` returns ≥1
    - `grep -c "export function DeviceStatusChip" frontend/src/signage/components/DeviceStatusChip.tsx` returns exactly 1
    - `grep -c "differenceInMinutes" frontend/src/signage/components/DeviceStatusChip.tsx` returns ≥1
    - `grep -Ec "minutes < 2|< 2" frontend/src/signage/components/DeviceStatusChip.tsx` returns ≥1
    - `grep -Ec "minutes < 5|< 5" frontend/src/signage/components/DeviceStatusChip.tsx` returns ≥1
    - `grep -c "bg-green-100\|bg-amber-100\|bg-red-100" frontend/src/signage/components/DeviceStatusChip.tsx` returns ≥3
    - `grep -c "export function MediaStatusPill" frontend/src/signage/components/MediaStatusPill.tsx` returns exactly 1
    - `grep -c "refetchInterval" frontend/src/signage/components/MediaStatusPill.tsx` returns ≥1
    - `grep -c "animate-pulse" frontend/src/signage/components/MediaStatusPill.tsx` returns ≥1
    - `grep -rn "dark:" frontend/src/signage/components/` returns no matches
    - `grep -rn "fetch(" frontend/src/signage/components/` returns no matches
  </acceptance_criteria>
  <done>All three components compile, render correctly, honor keyboard/aria contracts, no invariant violations.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build MediaDeleteDialog with 409 playlist_ids count</name>
  <read_first>
    - frontend/src/components/DeleteConfirmDialog.tsx (base pattern — reuse shadcn Dialog family)
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/signage/lib/signageTypes.ts (MediaInUseError shape)
    - 46-UI-SPEC.md §"Interaction Contracts" item 3 "In-use delete dialog"
  </read_first>
  <files>
    - frontend/src/signage/components/MediaDeleteDialog.tsx (CREATE)
  </files>
  <action>
    Build a two-mode dialog:
    - **Delete mode:** normal confirm (title + body + Delete / Keep) — triggered when caller wants to ask "Delete {{title}}?"
    - **In-use mode:** after the DELETE returns 409 with `playlist_ids`, re-open dialog in this mode showing `signage.admin.media.delete_in_use_body` with `count = playlist_ids.length` and a single "Close" button.

    The caller (MediaPage in 46-04) manages open/mode state; this dialog is presentational.

    ```tsx
    import { useTranslation } from "react-i18next";
    import {
      Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
    } from "@/components/ui/dialog";
    import { Button } from "@/components/ui/button";

    export type MediaDeleteDialogMode =
      | { kind: "confirm"; title: string }
      | { kind: "in_use"; title: string; playlistCount: number };

    export interface MediaDeleteDialogProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      mode: MediaDeleteDialogMode | null;
      onConfirm: () => void;                // called only in "confirm" mode
    }

    export function MediaDeleteDialog({ open, onOpenChange, mode, onConfirm }: MediaDeleteDialogProps) {
      const { t } = useTranslation();
      if (!mode) return null;

      if (mode.kind === "confirm") {
        return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("signage.admin.media.delete_title")}</DialogTitle>
                <DialogDescription>{t("signage.admin.media.delete_body", { title: mode.title })}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t("signage.admin.media.delete_cancel")}</Button>
                <Button variant="destructive" onClick={onConfirm}>{t("signage.admin.media.delete_confirm")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }

      // in_use
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("signage.admin.media.delete_in_use_title")}</DialogTitle>
              <DialogDescription>
                {t("signage.admin.media.delete_in_use_body", { count: mode.playlistCount })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("signage.admin.media.delete_in_use_close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    ```
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | tail -10 && grep -c "export function MediaDeleteDialog" src/signage/components/MediaDeleteDialog.tsx && grep -c "delete_in_use_title\|delete_in_use_body" src/signage/components/MediaDeleteDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `grep -c "export function MediaDeleteDialog" frontend/src/signage/components/MediaDeleteDialog.tsx` returns exactly 1
    - `grep -c "kind: \"confirm\"\\|kind: \"in_use\"" frontend/src/signage/components/MediaDeleteDialog.tsx` returns ≥2
    - `grep -c "signage.admin.media.delete_title" frontend/src/signage/components/MediaDeleteDialog.tsx` returns ≥1
    - `grep -c "signage.admin.media.delete_in_use_title" frontend/src/signage/components/MediaDeleteDialog.tsx` returns ≥1
    - `grep -c "signage.admin.media.delete_in_use_body" frontend/src/signage/components/MediaDeleteDialog.tsx` returns ≥1
    - `grep -c "playlistCount" frontend/src/signage/components/MediaDeleteDialog.tsx` returns ≥2
    - `grep -c "variant=\"destructive\"" frontend/src/signage/components/MediaDeleteDialog.tsx` returns exactly 1 (only confirm mode has destructive action)
    - `grep -rn "dark:" frontend/src/signage/components/MediaDeleteDialog.tsx` returns no matches
  </acceptance_criteria>
  <done>Dialog renders both modes; 409 flow (triggered by 46-04) can pass playlistCount and receive a Close-only dialog.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && npm run lint` exits 0.
3. `grep -rn "dark:" frontend/src/signage/` returns no matches.
4. `grep -rn "fetch(" frontend/src/signage/components/ frontend/src/signage/player/ frontend/src/signage/pages/` returns no matches (fetch in lib/signageApi.ts is the single exemption).
5. All components have `export function` declarations and TypeScript compiles.
</verification>

<success_criteria>
- TagPicker supports keyboard-only operation (Enter/comma/Backspace/Escape) and exposes combobox ARIA.
- DeviceStatusChip thresholds match D-14 exactly.
- MediaStatusPill stops polling on terminal states.
- MediaDeleteDialog surfaces `playlist_ids.length` count in i18n body.
- ApiErrorWithBody preserves response body for 409 extraction; backing types match backend schemas.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-02-SUMMARY.md`.
</output>
