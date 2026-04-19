---
phase: 46-admin-ui
plan: 04
type: execute
wave: 2
depends_on:
  - "46-01"
  - "46-02"
files_modified:
  - frontend/src/signage/pages/MediaPage.tsx
  - frontend/src/signage/components/MediaUploadDropZone.tsx
  - frontend/src/signage/components/MediaRegisterUrlDialog.tsx
  - frontend/scripts/check-signage-invariants.mjs
  - frontend/package.json
autonomous: true
requirements:
  - SGN-ADM-04
must_haves:
  truths:
    - "Admin drops a JPG file and sees a new row appear in the Media grid after Directus upload + backend register"
    - "Admin drops a PPTX file and the grid row shows MediaStatusPill auto-polling to done"
    - "Admin clicks Register URL / HTML and a small form POSTs to /api/signage/media with kind=url or kind=html"
    - "Admin clicks Delete on unused media and the row is removed after a confirm dialog"
    - "Admin clicks Delete on in-use media and the 409 body is caught; MediaDeleteDialog shows the correct playlist count"
    - "CI script check-signage-invariants.mjs fails if any fetch( appears in signage pages, components, or player (lib is exempt)"
  artifacts:
    - path: frontend/src/signage/pages/MediaPage.tsx
      provides: "Full Media tab - upload dropzone, register URL dialog, grid, delete flows"
    - path: frontend/src/signage/components/MediaUploadDropZone.tsx
      provides: "PPTX-vs-Directus routing dropzone"
    - path: frontend/src/signage/components/MediaRegisterUrlDialog.tsx
      provides: "URL/HTML register form"
    - path: frontend/scripts/check-signage-invariants.mjs
      provides: "CI script enforcing no fetch / no dark: in signage UI"
  key_links:
    - from: frontend/src/signage/components/MediaUploadDropZone.tsx
      to: "@directus/sdk uploadFiles"
      via: "directus.request(uploadFiles(formData))"
      pattern: "uploadFiles"
    - from: frontend/src/signage/pages/MediaPage.tsx
      to: "/api/signage/media"
      via: "signageApi.listMedia and signageApi.deleteMedia via apiClient/apiClientWithBody"
      pattern: "signageApi"
---

<objective>
Flesh out the Media tab end-to-end: upload dropzone that routes PPTX vs Directus (D-01/D-02), URL/HTML register form (D-03), thumbnail grid with per-item tags and delete, and the in-use-by-N delete flow that extracts `playlist_ids.length` from the 409 body. Also ship the CI grep-guard script that enforces the signage invariants going forward.

Purpose: Closes SGN-ADM-04. Establishes the Directus-upload-then-register pattern. Installs the CI safety net for the rest of Phase 46.

Output: Working `/signage/media` route end-to-end; CI script in place and wired into `npm run lint` or an explicit script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-admin-ui/46-CONTEXT.md
@.planning/phases/46-admin-ui/46-RESEARCH.md
@.planning/phases/46-admin-ui/46-UI-SPEC.md
@.planning/phases/46-admin-ui/46-01-SUMMARY.md
@.planning/phases/46-admin-ui/46-02-SUMMARY.md

<interfaces>
From 46-02 (dependency):
- `signageApi.listMedia()`, `signageApi.getMedia(id)`, `signageApi.deleteMedia(id)` exported from `frontend/src/signage/lib/signageApi.ts`
- `ApiErrorWithBody` class: has `.status: number` and `.body: unknown`
- `<MediaStatusPill mediaId=... initialStatus=... initialError=... />`
- `<MediaDeleteDialog open onOpenChange mode onConfirm />` where `mode` is `{ kind: "confirm", title } | { kind: "in_use", title, playlistCount }`

From backend (verified from reading backend/app/routers/signage_admin/media.py and backend/app/schemas/signage.py):
- `POST /api/signage/media` accepts JSON body `{kind, title, directus_file_id?, url?, tags: list[int], metadata?}` returns 201 SignageMediaRead. `tags` is a list of tag IDs. HTML content is stored in `metadata` (field name: verify during implementation via `grep -n "metadata\|html" backend/app/schemas/signage.py`).
- `POST /api/signage/media/pptx` accepts multipart form with field `file` returns 202 SignageMediaRead with `conversion_status="pending"`.
- `DELETE /api/signage/media/{id}` returns 204 on success; returns 409 JSONResponse body `{"detail": "media in use by playlists", "playlist_ids": ["uuid", ...]}` when any playlist_item still references the media (ON DELETE RESTRICT).
- `GET /api/signage/media` returns list of SignageMediaRead.

From @directus/sdk v21.2.2:
```
import { uploadFiles } from "@directus/sdk";
import { directus } from "@/lib/directusClient";
const res = await directus.request(uploadFiles(formData));
const fileId = Array.isArray(res) ? res[0].id : (res as { id: string }).id;
```
Pitfall 8: the SDK may return an object or an array depending on server response; handle both.

FormData keys for Directus: `file` (the File). Optional `title`. Cookie auth automatic via directusClient's credentials:'include'.

From frontend/src/components/DropZone.tsx (reference-only — not reused): shows the `useDropzone` + `useMutation` + `toast.success/error` pattern to mirror.

From frontend/src/lib/apiClient.ts: confirm whether FormData bodies preserve the browser-set `Content-Type: multipart/form-data; boundary=...` header (the header must NOT be overridden to `application/json`). If apiClient unconditionally sets `application/json`, the PPTX upload must go through `apiClientWithBody` (which sets JSON only when the body is not FormData — see its implementation). Executor confirms at plan time by reading `frontend/src/lib/apiClient.ts` header-setting code and chooses the correct function.

Tags field note: the media POST's `tags` field is `list[int]`. The Media tab upload flow in THIS plan starts uploads with `tags: []` (new media ships tag-less; tagging is a future edit). This avoids the TagPicker tag-creation dance for the upload path. Media editing (adding tags via a per-media Edit dialog) is out of scope for 46-04 and can be added as an enhancement later; SGN-ADM-04 only mandates upload, list, delete.

From 46-UI-SPEC §"3. Media Library" — exact class lists:
- Grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`
- Dropzone idle: `bg-muted border-2 border-dashed border-border min-h-[120px]`
- Dropzone drag active: `bg-primary/5 border-solid border-primary`
- Dropzone accepts: `image/*`, `video/*`, `application/pdf`, `.pptx`
- Thumbnail: `h-32 object-cover`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build MediaUploadDropZone (Directus + PPTX routing) and MediaRegisterUrlDialog</name>
  <read_first>
    - frontend/src/components/DropZone.tsx
    - frontend/src/lib/directusClient.ts
    - frontend/src/lib/apiClient.ts (header-setting for FormData)
    - backend/app/routers/signage_admin/media.py (POST /media and POST /media/pptx signatures)
    - backend/app/schemas/signage.py (SignageMediaBase field types esp tags)
    - 46-UI-SPEC.md section "3. Media Library"
  </read_first>
  <files>
    - frontend/src/signage/components/MediaUploadDropZone.tsx (CREATE)
    - frontend/src/signage/components/MediaRegisterUrlDialog.tsx (CREATE)
  </files>
  <action>
    1a. MediaUploadDropZone.tsx — react-dropzone shell, routes by extension. Kind inference helper:
    ```
    function inferKind(file) { if file.name.toLowerCase ends with .pptx return "pptx"; if file.type starts "image/" return "image"; if starts "video/" return "video"; if file.type == "application/pdf" or name endsWith .pdf return "pdf"; else throw. }
    ```

    PPTX path: build FormData with field `file`, POST to `/api/signage/media/pptx` via `apiClient` (or `apiClientWithBody` if apiClient forces JSON Content-Type — executor decides after reading apiClient.ts).

    Non-PPTX path: call `directus.request(uploadFiles(formData))` with `directusClient` (cookie auth). Normalize result via `Array.isArray(res) ? res[0].id : (res as { id: string }).id`. Then POST JSON to `/api/signage/media` with body `{kind: inferKind(file), title: file.name, directus_file_id: fileId, tags: []}` via `apiClient<SignageMedia>`.

    useDropzone with `accept: { "image/*": [], "video/*": [], "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] }`.

    UI per UI-SPEC:
    - Idle: `bg-muted border-2 border-dashed border-border min-h-[120px] rounded-md flex flex-col items-center justify-center text-center p-6`
    - Drag active adds: `bg-primary/5 border-solid border-primary`
    - Render `<p className="text-sm font-semibold text-foreground">{t("signage.admin.media.upload_title")}</p>`, `<p className="text-xs text-muted-foreground">{t("signage.admin.media.upload_or")}</p>`, `<Button variant="outline" size="sm" type="button" onClick={(e) => { e.stopPropagation(); open(); }}>{t("signage.admin.media.browse_button")}</Button>`, `<p className="text-xs text-muted-foreground">{t("signage.admin.media.accepted_formats")}</p>`
    - When uploading, replace content with `<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />` + processing text.

    On mutation success: `queryClient.invalidateQueries({ queryKey: signageKeys.media() })` and `toast.success(t("signage.admin.media.upload_title"))`. On error: `toast.error(t("signage.admin.error.generic", { detail: err.message }))`.

    1b. MediaRegisterUrlDialog.tsx — small form (react-hook-form + zod) inside a `<Dialog>`.

    Props: `{ open: boolean; onOpenChange: (o: boolean) => void }`.

    Fields: kind (radio: "url" or "html"), title (required string), content (required string — interpreted as URL when kind=url, HTML string when kind=html).

    Zod schema:
    ```
    z.object({ kind: z.enum(["url","html"]), title: z.string().min(1), content: z.string().min(1) })
    ```

    On submit POST JSON to `/api/signage/media` via `apiClient`:
    - kind=url: body `{kind: "url", title, url: content, tags: []}`
    - kind=html: body `{kind: "html", title, metadata: { html: content }, tags: []}` — if backend field is different (e.g. `url: content` for html with a `metadata: { html: true }` flag), adjust per the actual schema read in Task 1 read_first.

    Copy keys (all already seeded by 46-01 Task 2): `signage.admin.media.register_url_title`, `register_url_label`, `register_url_cta`, `register_url_button`.

    Success: invalidate `signageKeys.media()`, toast, `onOpenChange(false)`.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -20 &amp;&amp; grep -q "uploadFiles" src/signage/components/MediaUploadDropZone.tsx &amp;&amp; grep -q "\.pptx" src/signage/components/MediaUploadDropZone.tsx &amp;&amp; test -f src/signage/components/MediaRegisterUrlDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `uploadFiles` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1
    - grep count of `from "@directus/sdk"` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is exactly 1
    - grep count of `Array.isArray` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1 (Pitfall 8)
    - grep count of `.pptx` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1
    - grep count of `/api/signage/media/pptx` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is exactly 1
    - grep count of `useDropzone` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is exactly 1
    - grep count of `signageKeys.media()` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1
    - grep count of `signage.admin.media.upload_title` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1
    - grep count of `signage.admin.media.browse_button` in `frontend/src/signage/components/MediaUploadDropZone.tsx` is at least 1
    - `test -f frontend/src/signage/components/MediaRegisterUrlDialog.tsx` succeeds
    - grep count of `export function MediaRegisterUrlDialog` in that file is exactly 1
    - grep count of `signage.admin.media.register_url_title` in that file is at least 1
    - grep count of `signage.admin.media.register_url_cta` in that file is at least 1
    - grep count of `kind: "url"` or `kind: "html"` (combined) in `MediaRegisterUrlDialog.tsx` is at least 2
    - `grep -rn "dark:" frontend/src/signage/components/MediaUploadDropZone.tsx frontend/src/signage/components/MediaRegisterUrlDialog.tsx` returns no matches
  </acceptance_criteria>
  <done>Dropzone uploads files (Directus for non-PPTX, multipart direct for PPTX); URL/HTML dialog creates kind=url/html entries; both invalidate media list on success.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build MediaPage with grid, tag chips, delete flow (in-use detection)</name>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (ApiErrorWithBody, signageApi.deleteMedia)
    - frontend/src/signage/lib/signageTypes.ts (SignageMedia)
    - frontend/src/signage/components/MediaDeleteDialog.tsx (mode shape)
    - frontend/src/signage/components/MediaStatusPill.tsx (props)
    - frontend/src/lib/directusClient.ts (for thumbnail URL base)
    - 46-UI-SPEC.md section "3. Media Library"
  </read_first>
  <files>
    - frontend/src/signage/pages/MediaPage.tsx (REPLACE stub from 46-01)
  </files>
  <action>
    Full component. Top-level sections in order:
    1. MediaUploadDropZone
    2. "Register URL / HTML" button that opens MediaRegisterUrlDialog (local open state)
    3. Grid of media cards

    Data: `useQuery({ queryKey: signageKeys.media(), queryFn: signageApi.listMedia })`.

    Thumbnail URL resolution (image/video only): read `VITE_DIRECTUS_URL` from `import.meta.env` with fallback to `http://localhost:8055`, build `${DIRECTUS_URL}/assets/${media.directus_file_id}`. For pdf/url/html/pptx use a lucide placeholder icon (`FileText`, `Link`, `Code`, `Presentation`) inside the h-32 thumbnail area with `bg-muted` background.

    Card markup template:
    ```
    <article className="rounded-md border border-border bg-card overflow-hidden flex flex-col">
      <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
        {thumbnail or icon}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold truncate">{media.title}</h3>
          <Badge variant="outline" className="text-xs shrink-0">{media.kind}</Badge>
        </div>
        {media.kind === "pptx" && <MediaStatusPill mediaId={media.id} initialStatus={media.conversion_status} initialError={media.conversion_error} />}
        {media.tags.length > 0 && <div className="flex flex-wrap gap-1">{media.tags.map(tag => <Badge key={tag.id} variant="secondary" className="text-xs">{tag.name}</Badge>)}</div>}
        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={() => onClickDelete(media)} aria-label={t("signage.admin.media.delete_title")}>
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </article>
    ```

    Delete flow with ApiErrorWithBody 409 handling:
    - Local state: `deleteMode: MediaDeleteDialogMode | null`, `pendingDeleteId: string | null`, `dialogOpen: boolean`.
    - `onClickDelete(media)`: set `pendingDeleteId=media.id`, set `deleteMode={kind:"confirm", title: media.title}`, set `dialogOpen=true`.
    - `onConfirmDelete()`: `if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId)`.
    - `deleteMutation = useMutation({ mutationFn: id => signageApi.deleteMedia(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: signageKeys.media() }); toast.success(t("signage.admin.media.delete_title")); setDialogOpen(false); setPendingDeleteId(null); }, onError: (err) => { if (err instanceof ApiErrorWithBody && err.status === 409) { const body = err.body as { playlist_ids?: string[] } | null; const count = body?.playlist_ids?.length ?? 0; const prevTitle = deleteMode?.kind === "confirm" ? deleteMode.title : ""; setDeleteMode({ kind: "in_use", title: prevTitle, playlistCount: count }); setDialogOpen(true); } else { toast.error(t("signage.admin.error.generic", { detail: (err as Error).message })); setDialogOpen(false); } } })`.
    - Render `<MediaDeleteDialog open={dialogOpen} onOpenChange={setDialogOpen} mode={deleteMode} onConfirm={onConfirmDelete} />` at the bottom of the page.

    Loading state (`isLoading`): render a 4-card `grid` of `<div className="h-48 rounded-md bg-muted animate-pulse" />`.

    Error state (`isError`): render `<p className="text-sm text-destructive">{t("signage.admin.error.loading")}</p>`.

    Empty state (data length 0): full-width `<div className="rounded-md border border-border bg-card p-12 text-center"><h2 className="text-xl font-semibold">{t("signage.admin.media.empty_title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("signage.admin.media.empty_body")}</p></div>`.

    NO direct `fetch()`. NO `dark:` variants.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "signageApi.listMedia" src/signage/pages/MediaPage.tsx &amp;&amp; grep -q "signageApi.deleteMedia" src/signage/pages/MediaPage.tsx &amp;&amp; grep -q "ApiErrorWithBody" src/signage/pages/MediaPage.tsx &amp;&amp; grep -q "playlist_ids" src/signage/pages/MediaPage.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `signageApi.listMedia` in `frontend/src/signage/pages/MediaPage.tsx` is at least 1
    - grep count of `signageApi.deleteMedia` in that file is at least 1
    - grep count of `ApiErrorWithBody` in that file is at least 1
    - grep count of `err.status === 409` or `status === 409` in that file is at least 1
    - grep count of `playlist_ids` in that file is at least 1
    - grep count of `<MediaDeleteDialog` in that file is at least 1
    - grep count of `<MediaStatusPill` in that file is at least 1
    - grep count of `<MediaUploadDropZone` in that file is exactly 1
    - grep count of `<MediaRegisterUrlDialog` in that file is exactly 1
    - grep count of `signageKeys.media()` in that file is at least 1
    - grep count of `signage.admin.media.empty_title` in that file is at least 1
    - grep count of `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4` in that file is exactly 1
    - grep count of `dark:` in that file is 0
    - grep count of `fetch(` in that file is 0
  </acceptance_criteria>
  <done>/signage/media lists media, routes PPTX vs Directus on upload, registers URL/HTML, deletes with correct 409 in-use handling.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create CI grep-guard script for signage invariants</name>
  <read_first>
    - frontend/scripts/check-locale-parity.mts (existing pattern reference)
    - frontend/package.json (scripts block)
    - ROADMAP.md "v1.16 Cross-Cutting Hazards" (invariants 2 and 3)
  </read_first>
  <files>
    - frontend/scripts/check-signage-invariants.mjs (CREATE)
    - frontend/package.json (add npm script)
  </files>
  <action>
    Create `frontend/scripts/check-signage-invariants.mjs` (plain ESM JS, no TS strip):
    ```
    // Enforces v1.16 cross-cutting invariants for the signage admin UI.
    //   Invariant 2: No direct fetch() in signage pages/components/player (apiClient only).
    //                Exemption: frontend/src/signage/lib/ (contains ApiErrorWithBody, which
    //                IS the project's sanctioned signage-specific apiClient variant).
    //   Invariant 3: No dark: Tailwind variants anywhere in signage (token-only styling).
    //
    // Exits 0 on clean scan, 1 on any violation.
    ```

    Implementation approach:
    - Use `node:fs` + recursive readdir to walk `frontend/src/signage/pages`, `frontend/src/signage/components`, `frontend/src/signage/player`.
    - For each `.ts` or `.tsx` file, read content.
    - Check for `\bfetch(` regex (word boundary to avoid `prefetch(` etc). Also ignore comment lines starting with `//` or inside `/* */` if trivial — simple line-based check with a comment prefix strip is acceptable; report line number + file.
    - Check for `dark:` string literal in any file under those three directories (all of `frontend/src/signage/` except `lib/`).
    - Print violations and exit 1 if any; else print `SIGNAGE INVARIANTS OK: <N> files scanned` and exit 0.

    Template:
    ```
    import { readFileSync, readdirSync, statSync } from "node:fs";
    import { join, resolve } from "node:path";

    const repoRoot = resolve(import.meta.dirname, "..", "..");
    const ROOTS = [
      "frontend/src/signage/pages",
      "frontend/src/signage/components",
      "frontend/src/signage/player",
    ];

    function walk(dir) {
      const out = [];
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        const s = statSync(p);
        if (s.isDirectory()) out.push(...walk(p));
        else if (/\.(ts|tsx|js|jsx)$/.test(p)) out.push(p);
      }
      return out;
    }

    const files = ROOTS.flatMap((rel) => {
      try { return walk(resolve(repoRoot, rel)); } catch { return []; }
    });

    let violations = 0;
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // strip single-line comments naively for fetch check
        const stripped = line.replace(/\/\/.*$/, "");
        if (/\bfetch\(/.test(stripped)) {
          console.error(`FETCH_VIOLATION: ${f}:${i + 1}: ${line.trim()}`);
          violations++;
        }
        if (/\bdark:/.test(stripped)) {
          console.error(`DARK_VARIANT_VIOLATION: ${f}:${i + 1}: ${line.trim()}`);
          violations++;
        }
      });
    }

    if (violations > 0) {
      console.error(`\nFAIL: ${violations} invariant violation(s) across ${files.length} file(s).`);
      process.exit(1);
    }
    console.log(`SIGNAGE INVARIANTS OK: ${files.length} files scanned`);
    ```

    Add npm script to `frontend/package.json` under `"scripts"`:
    ```
    "check:signage": "node scripts/check-signage-invariants.mjs"
    ```

    Do NOT change the existing `"lint"` script — the invariant check is separate. Plans 46-05 and 46-06 and any future CI integration can run it explicitly.

    Run it once now to confirm it passes: `cd frontend && node scripts/check-signage-invariants.mjs` — since 46-01, 46-02, 46-03 and this plan's Tasks 1-2 all enforce the invariants, it should output `SIGNAGE INVARIANTS OK`.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; node scripts/check-signage-invariants.mjs &amp;&amp; grep -q "check:signage" package.json</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/scripts/check-signage-invariants.mjs` succeeds
    - `cd frontend && node scripts/check-signage-invariants.mjs` exits 0 and prints `SIGNAGE INVARIANTS OK`
    - grep count of `"check:signage"` in `frontend/package.json` is exactly 1
    - grep count of `check-signage-invariants.mjs` in `frontend/package.json` is exactly 1
    - grep count of `fetch(` detection pattern in `frontend/scripts/check-signage-invariants.mjs` is at least 1 (script actually checks for fetch)
    - grep count of `dark:` detection pattern in the script is at least 1
    - Script walks `frontend/src/signage/pages`, `components`, `player` (grep for all three substrings in the script source)
    - Script does NOT walk `frontend/src/signage/lib` (grep for `"signage/lib"` should return 0 — lib is the explicit exemption)
  </acceptance_criteria>
  <done>CI guard script present, passes on current tree, npm script registered.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && npm run lint` exits 0.
3. `cd frontend && node scripts/check-locale-parity.mts` prints PARITY OK.
4. `cd frontend && node scripts/check-signage-invariants.mjs` prints SIGNAGE INVARIANTS OK.
5. Manual: log in as admin, go to /signage/media, drop an image file — card appears. Drop a .pptx — card shows Processing pill that auto-transitions to Done. Click Delete on a media referenced by a playlist — see the in-use dialog with correct count.
</verification>

<success_criteria>
- All three SGN-ADM-04 sub-flows (upload, list, delete) work end-to-end.
- 409 delete returns `{playlist_ids}` and the dialog shows that count.
- PPTX status pill auto-polls and stops on terminal.
- CI grep-guard script exists and is green.
- No direct `fetch()` in pages/components/player (lib exempt).
- No `dark:` variants anywhere in `frontend/src/signage/`.
- Locale parity script still passes.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-04-SUMMARY.md`.
</output>
