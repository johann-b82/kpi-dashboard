---
phase: 46-admin-ui
plan: 06
type: execute
wave: 2
depends_on:
  - "46-01"
  - "46-02"
files_modified:
  - frontend/src/App.tsx
  - frontend/src/signage/pages/DevicesPage.tsx
  - frontend/src/signage/pages/PairPage.tsx
  - frontend/src/signage/components/DeviceEditDialog.tsx
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements:
  - SGN-ADM-06
  - SGN-ADM-07
  - SGN-ADM-08
  - SGN-ADM-09
must_haves:
  truths:
    - "Admin lands on /signage/devices and sees a table of devices with green/amber/red/grey status chips (derived from last_seen_at, auto-refreshing every 30s)"
    - "Admin clicks Edit on a device row and can change name + tags, Save persists, table refreshes"
    - "Admin clicks Revoke on a device and after a confirm dialog the device token is revoked (POST /api/signage/pair/{id}/revoke)"
    - "Admin clicks Pair new device and lands on /signage/pair; entering a 6-digit code + device name + tags successfully claims the pending pairing session via POST /api/signage/pair/claim"
    - "The code input auto-formats to XXX-XXX (hyphen auto-inserted after position 3)"
    - "DeviceEditDialog dirty guard blocks the dialog's implicit close when unsaved — Discard proceeds, Stay cancels"
  artifacts:
    - path: frontend/src/signage/pages/DevicesPage.tsx
      provides: "Full devices table with status chips + edit + revoke + pair-new CTA"
    - path: frontend/src/signage/pages/PairPage.tsx
      provides: "Claim-code form with XXX-XXX auto-format + error mapping"
    - path: frontend/src/signage/components/DeviceEditDialog.tsx
      provides: "Edit device name + tags dialog with dirty guard"
    - path: frontend/src/App.tsx
      contains: "/signage/pair"
  key_links:
    - from: frontend/src/signage/pages/DevicesPage.tsx
      to: "/api/signage/devices"
      via: "useQuery with refetchInterval 30000 (D-13)"
      pattern: "refetchInterval: 30"
    - from: frontend/src/signage/pages/PairPage.tsx
      to: "/api/signage/pair/claim"
      via: "POST with {code, device_name, tag_ids}"
      pattern: "/pair/claim"
    - from: frontend/src/signage/pages/DevicesPage.tsx
      to: frontend/src/signage/components/DeviceStatusChip.tsx
      via: "<DeviceStatusChip lastSeenAt={d.last_seen_at} />"
      pattern: "DeviceStatusChip"
---

<objective>
Close SGN-ADM-06 (device table with live status), SGN-ADM-07 (/signage/pair claim page), SGN-ADM-08 (tag picker reused in both), and SGN-ADM-09 (dirty guard for device edit).

Purpose: Last feature of Phase 46 — completes the admin device lifecycle (pair, edit, revoke). After this plan, all 11 SGN-ADM-* requirements are implemented and the phase is ready for verification.

Output: `/signage/devices` + `/signage/pair` fully working end-to-end against the Phase 42/43 backend.
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
- `<DeviceStatusChip lastSeenAt />`
- `<TagPicker value onChange />`
- `signageApi.listDevices()`, `signageApi.listTags()`, `signageApi.createTag(name)`

From backend (verified — see 46-RESEARCH §Code Examples + backend/app/routers/signage_pair.py + backend/app/routers/signage_admin/devices.py):
- `GET /api/signage/devices` returns `SignageDeviceRead[]`
- `PATCH /api/signage/devices/{id}` (or `PUT` — verify in backend router) accepts `{name?, tag_ids?}` → updated device
- `POST /api/signage/pair/{device_id}/revoke` (or `DELETE /api/signage/devices/{id}/revoke` — verify path in backend/app/routers/signage_pair.py around the revoke endpoint) flips `revoked_at`, returns 204
- `POST /api/signage/pair/claim` accepts body `{code: str (min 6 max 7), device_name: str (max 128), tag_ids: list[int] | null}` → 204 on success, 404 on invalid/expired code
- Existing SignagePairingClaimRequest schema: `{code, device_name, tag_ids}` — NO plain `tags` string field; client must resolve tag names → IDs before claim (same create-on-submit dance as 46-05 Task 3)

Note on device edit endpoint shape: read `backend/app/routers/signage_admin/devices.py` to confirm method (PATCH vs PUT) and exact body schema before wiring. Phase 43 `SignageDeviceUpdate` schema has fields `name: str | None`, potentially `tag_ids: list[int] | None` (or `tags: list[SignageDeviceTag]`). Use whichever shape the router accepts.

From wouter: `import { useLocation, Redirect } from "wouter";`.

From react-hook-form + zod:
- Device edit form: `{ name: string, tags: string[] }` validated by `z.object({ name: z.string().min(1).max(128), tags: z.array(z.string()) })`.
- Pair form: `{ code: string, device_name: string, tags: string[] }` validated by `z.object({ code: z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, "format: XXX-XXX"), device_name: z.string().min(1).max(128), tags: z.array(z.string()) })`.

From 46-UI-SPEC section "6. Devices Table" and "8. Pair Page":
- DevicesPage: shadcn <Table>, columns Name | Status | Tags | Current playlist | Last seen | Actions; Pair-new CTA top-right; 30s refetchInterval.
- PairPage: centered card; pair code input styled `text-4xl font-mono font-semibold tracking-widest text-center w-full`; auto-format XXX-XXX on input; uppercase.
- Revoke confirm: destructive button using `signage.admin.device.revoke_title` / `revoke_confirm_body` / `revoke_confirm` / `revoke_cancel`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend signageApi, register /signage/pair route, build DeviceEditDialog</name>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/App.tsx
    - backend/app/routers/signage_admin/devices.py (device update endpoint shape)
    - backend/app/routers/signage_pair.py (revoke + claim endpoint shapes)
    - frontend/src/signage/components/UnsavedChangesDialog.tsx (from 46-05 — reuse)
  </read_first>
  <files>
    - frontend/src/signage/lib/signageApi.ts (EXTEND)
    - frontend/src/App.tsx
    - frontend/src/signage/components/DeviceEditDialog.tsx (CREATE)
  </files>
  <action>
    1a. Extend `frontend/src/signage/lib/signageApi.ts` — append to `signageApi` object:
    ```
    updateDevice: (id: string, body: { name?: string; tag_ids?: number[] }) =>
      apiClient<SignageDevice>(`/api/signage/devices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    revokeDevice: (id: string) =>
      apiClient<null>(`/api/signage/pair/${id}/revoke`, { method: "POST" }),
    claimPairingCode: (body: { code: string; device_name: string; tag_ids: number[] | null }) =>
      apiClient<null>("/api/signage/pair/claim", { method: "POST", body: JSON.stringify(body) }),
    ```
    Verify exact method + path against backend router sources before final write. If the update endpoint is PUT instead of PATCH, use PUT. If revoke lives on `/api/signage/devices/{id}/revoke` instead of `/api/signage/pair/{id}/revoke`, use that.

    1b. `App.tsx` — INSERT route (location: alongside other /signage routes; order: it's `/signage/pair`, not under /:id, so position doesn't conflict with `/signage/playlists/:id`. Place AFTER the `/signage/media` route added by 46-01 and BEFORE the catch-all `/signage` redirect):
    ```
    <Route path="/signage/pair">
      <AdminOnly><PairPage /></AdminOnly>
    </Route>
    ```
    Add import: `import { PairPage } from "@/signage/pages/PairPage";`.

    1c. `DeviceEditDialog.tsx` — controlled dialog with dirty-guard.

    Props:
    ```
    interface DeviceEditDialogProps {
      open: boolean;
      onOpenChange: (o: boolean) => void;
      device: SignageDevice | null;
    }
    ```

    Implementation notes:
    - react-hook-form + zod: `{ name: string, tags: string[] }` with `z.object({ name: z.string().min(1).max(128), tags: z.array(z.string()) })`.
    - Reset form defaults when `device` prop changes: `useEffect(() => { if (device) form.reset({ name: device.name, tags: device.tags.map(t => t.name) }); }, [device])`.
    - Save mutation: resolve tag names → IDs (create unknown tags via `signageApi.createTag`), then `signageApi.updateDevice(device.id, { name, tag_ids })`. Invalidate `signageKeys.devices()` + `signageKeys.tags()`. Toast `signage.admin.device.saved`. Close dialog.
    - Dirty-guard inside dialog: when `form.formState.isDirty && open`, clicking the X or overlay should NOT instantly close — instead show `<UnsavedChangesDialog>` layered on top. On confirm discard: `form.reset()` + `onOpenChange(false)`.
    - Implement by intercepting `onOpenChange`: wrap as `handleOpenChange(next) { if (!next && form.formState.isDirty) { setUnsavedOpen(true); } else { onOpenChange(next); } }` and pass `handleOpenChange` to `<Dialog open onOpenChange={handleOpenChange}>`.
    - The inner UnsavedChangesDialog (imported from 46-05's `components/UnsavedChangesDialog.tsx`) controls `unsavedOpen` state; onConfirm → `form.reset(); setUnsavedOpen(false); onOpenChange(false);`.

    Copy keys: `signage.admin.device.edit_title`, `signage.admin.device.saved`, `signage.admin.device.save_error`, plus labels for name input (`signage.admin.pair.name_label`) and tag picker (`signage.admin.pair.tags_label` — both are reusable, already seeded).
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "updateDevice" src/signage/lib/signageApi.ts &amp;&amp; grep -q "revokeDevice" src/signage/lib/signageApi.ts &amp;&amp; grep -q "claimPairingCode" src/signage/lib/signageApi.ts &amp;&amp; grep -q "/signage/pair" src/App.tsx &amp;&amp; test -f src/signage/components/DeviceEditDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `updateDevice` in `frontend/src/signage/lib/signageApi.ts` is at least 1
    - grep count of `revokeDevice` in signageApi.ts is at least 1
    - grep count of `claimPairingCode` in signageApi.ts is at least 1
    - grep count of `path="/signage/pair"` in `frontend/src/App.tsx` is exactly 1
    - grep count of `<PairPage` or `PairPage />` in App.tsx is at least 1
    - `test -f frontend/src/signage/components/DeviceEditDialog.tsx` succeeds
    - grep count of `export function DeviceEditDialog` in DeviceEditDialog.tsx is exactly 1
    - grep count of `signageApi.updateDevice` in DeviceEditDialog.tsx is at least 1
    - grep count of `signageApi.createTag` in DeviceEditDialog.tsx is at least 1 (tag create-on-submit)
    - grep count of `UnsavedChangesDialog` in DeviceEditDialog.tsx is at least 1
    - grep count of `signage.admin.device.edit_title` in DeviceEditDialog.tsx is at least 1
    - grep count of `signage.admin.device.saved` in DeviceEditDialog.tsx is at least 1
    - grep count of `dark:` in changed files is 0
    - grep count of `fetch(` in changed files (excluding lib/) is 0
  </acceptance_criteria>
  <done>API extended, /signage/pair registered, DeviceEditDialog renders with dirty-guard.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build DevicesPage (table + 30s refetch + revoke + pair CTA)</name>
  <read_first>
    - frontend/src/signage/components/DeviceStatusChip.tsx (Task 2 of 46-02 — already built)
    - frontend/src/signage/components/DeviceEditDialog.tsx (Task 1 of this plan)
    - frontend/src/components/ui/table.tsx (shadcn Table API)
    - 46-UI-SPEC.md section "6. Devices Table"
  </read_first>
  <files>
    - frontend/src/signage/pages/DevicesPage.tsx (REPLACE 46-01 stub)
  </files>
  <action>
    Implementation:
    - `useQuery({ queryKey: signageKeys.devices(), queryFn: signageApi.listDevices, refetchInterval: 30_000 })` — D-13 30-second live update.
    - Header: Pair-new CTA button aligned right: `<Button onClick={() => setLocation("/signage/pair")}>{t("signage.admin.devices.pair_button")}</Button>`.
    - shadcn `<Table>` with `<TableHeader>` + `<TableHead>` cells for: col_name, col_status, col_tags, col_playlist, col_last_seen, col_actions (all from i18n keys already seeded).
    - For each device row:
      - Name cell: `<span className="text-sm font-semibold">{d.name}</span>`
      - Status cell: `<DeviceStatusChip lastSeenAt={d.last_seen_at} />`
      - Tags cell: `<div className="flex flex-wrap gap-1">{d.tags.map(t => <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>)}</div>`
      - Playlist cell: `{d.current_playlist_name ?? "—"}` (if not provided by endpoint, just `{d.current_playlist_id ?? "—"}`)
      - Last seen cell: `d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : "—"` using date-fns.
      - Actions cell: two icon buttons — Edit (Pencil icon, opens DeviceEditDialog with this device), Revoke (ShieldOff icon, opens revoke confirm).
    - Revoke flow:
      - Local state `revokeTarget: SignageDevice | null`.
      - Clicking Revoke sets the target, opens a `<Dialog>` with `signage.admin.device.revoke_title` + `revoke_confirm_body` (with `{name}`) + destructive "Revoke access" button + outline "Keep access" button.
      - `revokeMutation = useMutation({ mutationFn: (id) => signageApi.revokeDevice(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: signageKeys.devices() }); toast.success(t("signage.admin.device.revoked")); setRevokeTarget(null); }, onError: (err) => toast.error(t("signage.admin.device.revoke_error", { detail: (err as Error).message })) })`.
    - Empty state: centered card with `signage.admin.devices.empty_title` + `empty_body` + `empty_cta` button (navigates to /signage/pair).
    - Render DeviceEditDialog controlled by local `editTarget: SignageDevice | null` state.

    NO `refetchInterval: 30` written as a raw number with the value hidden in a constant inline — the literal must appear so the acceptance criterion can match.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "refetchInterval" src/signage/pages/DevicesPage.tsx &amp;&amp; grep -q "DeviceStatusChip" src/signage/pages/DevicesPage.tsx &amp;&amp; grep -q "revokeDevice" src/signage/pages/DevicesPage.tsx &amp;&amp; grep -q "DeviceEditDialog" src/signage/pages/DevicesPage.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `signageApi.listDevices` in `frontend/src/signage/pages/DevicesPage.tsx` is at least 1
    - grep count of `refetchInterval` in that file is at least 1
    - grep count of `30_000` or `30000` in that file is at least 1 (D-13 cadence)
    - grep count of `<DeviceStatusChip` in that file is at least 1
    - grep count of `signageApi.revokeDevice` in that file is at least 1
    - grep count of `<DeviceEditDialog` in that file is at least 1
    - grep count of `signage.admin.devices.pair_button` in that file is at least 1
    - grep count of `setLocation("/signage/pair")` in that file is at least 1
    - grep count of `signage.admin.device.revoke_confirm_body` in that file is at least 1
    - grep count of `signage.admin.device.revoked` in that file is at least 1
    - grep count of `signage.admin.devices.col_name\|col_status\|col_tags` in that file is at least 3 (all column header keys)
    - grep count of `signageKeys.devices()` in that file is at least 2 (query + invalidation)
    - grep count of `dark:` in that file is 0
    - grep count of `fetch(` in that file is 0
  </acceptance_criteria>
  <done>DevicesPage renders table with live 30s-refetch status chips; edit + revoke + pair-new all wire correctly.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build PairPage with XXX-XXX auto-format and error mapping</name>
  <read_first>
    - 46-UI-SPEC.md section "8. Pair Page"
    - 46-RESEARCH.md "Claim form — PairPage.tsx" section
    - backend/app/routers/signage_pair.py (claim endpoint — 404 vs 409 vs 400 error codes)
    - frontend/src/signage/lib/signageApi.ts (claimPairingCode from Task 1)
  </read_first>
  <files>
    - frontend/src/signage/pages/PairPage.tsx (CREATE)
  </files>
  <action>
    Full implementation of the claim form:

    Layout:
    - Centered card container: `<div className="max-w-xl mx-auto px-6 pt-8 pb-16">` + `<Card className="p-6 space-y-6">`.
    - Header: `<h1 className="text-2xl font-semibold">{t("signage.admin.pair.title")}</h1>` + `<p className="text-sm text-muted-foreground">{t("signage.admin.pair.subtitle")}</p>`.
    - Back button: `<Button variant="ghost" onClick={() => setLocation("/signage/devices")}>{t("signage.admin.pair.cancel")}</Button>` (top-right of card or bottom-left of footer — choose per visual balance; bottom-left alongside submit is fine).

    Form (react-hook-form + zod):
    ```
    const schema = z.object({
      code: z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, "format: XXX-XXX"),
      device_name: z.string().min(1).max(128),
      tags: z.array(z.string()),
    });
    ```

    Code input auto-format (uncontrolled through RHF's `register` with a manual transform):
    ```
    const [rawCode, setRawCode] = useState("");
    function handleCodeChange(e) {
      // strip non-alphanumeric, uppercase, limit to 6
      const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
      // re-insert hyphen after position 3
      const formatted = cleaned.length > 3 ? cleaned.slice(0, 3) + "-" + cleaned.slice(3) : cleaned;
      setRawCode(formatted);
      form.setValue("code", formatted, { shouldValidate: true, shouldDirty: true });
    }
    <Input
      value={rawCode}
      onChange={handleCodeChange}
      placeholder={t("signage.admin.pair.code_placeholder")}
      maxLength={7}
      className="text-4xl font-mono font-semibold tracking-widest text-center w-full uppercase"
      aria-label={t("signage.admin.pair.code_label")}
      autoComplete="off"
      autoFocus
    />
    ```

    Device name input: standard `<Input {...form.register("device_name")} placeholder={t("signage.admin.pair.name_placeholder")} />`.

    Tags: `<Controller name="tags" control={form.control} render={({ field }) => <TagPicker value={field.value} onChange={field.onChange} placeholder={t("signage.admin.pair.tags_placeholder")} />} />`.

    Submit mutation:
    ```
    const claimMutation = useMutation({
      mutationFn: async (values) => {
        // Resolve tags (create-on-submit)
        const existingTags = await signageApi.listTags();
        const nameToId = new Map(existingTags.map(t => [t.name, t.id]));
        const tag_ids: number[] = [];
        for (const name of values.tags) {
          let id = nameToId.get(name);
          if (id === undefined) { const c = await signageApi.createTag(name); id = c.id; }
          tag_ids.push(id);
        }
        return signageApi.claimPairingCode({ code: values.code, device_name: values.device_name, tag_ids });
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: signageKeys.devices() });
        queryClient.invalidateQueries({ queryKey: signageKeys.tags() });
        toast.success(t("signage.admin.pair.success", { name: variables.device_name }));
        setLocation("/signage/devices");
      },
      onError: (err: unknown) => {
        const msg = (err as Error).message ?? "";
        // Map backend detail strings to specific i18n error keys
        if (msg.includes("invalid") || msg.includes("expired")) {
          form.setError("code", { message: t("signage.admin.pair.error_not_found") });
        } else if (msg.includes("claimed")) {
          form.setError("code", { message: t("signage.admin.pair.error_claimed") });
        } else {
          toast.error(t("signage.admin.pair.error_generic", { detail: msg }));
        }
      },
    });

    const onSubmit = form.handleSubmit((values) => claimMutation.mutate(values));
    ```

    Submit button: `<Button type="submit" disabled={claimMutation.isPending}>{t("signage.admin.pair.submit")}</Button>`.

    Inline code error: `{form.formState.errors.code && <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>}`.

    Exact 404/409 mapping from backend: per backend/app/routers/signage_pair.py, the claim endpoint raises `HTTPException(status_code=404, detail="pairing code invalid, expired, or already claimed")` for all three failure modes — so the client cannot distinguish them from status code alone. Use substring matching on the detail message as shown above; if the backend ever splits the codes, revisit. This is acceptable for v1.16 per 46-RESEARCH "Open Questions §3".
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "claimPairingCode" src/signage/pages/PairPage.tsx &amp;&amp; grep -q "text-4xl font-mono" src/signage/pages/PairPage.tsx &amp;&amp; grep -q "replace(/\[\^A-Za-z0-9\]/g" src/signage/pages/PairPage.tsx &amp;&amp; cd frontend &amp;&amp; node scripts/check-signage-invariants.mjs &amp;&amp; node --experimental-strip-types scripts/check-locale-parity.mts</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `signageApi.claimPairingCode` in `frontend/src/signage/pages/PairPage.tsx` is at least 1
    - grep count of `signage.admin.pair.title` in that file is at least 1
    - grep count of `signage.admin.pair.subtitle` in that file is at least 1
    - grep count of `signage.admin.pair.code_placeholder` in that file is at least 1
    - grep count of `signage.admin.pair.name_placeholder` in that file is at least 1
    - grep count of `signage.admin.pair.submit` in that file is at least 1
    - grep count of `signage.admin.pair.success` in that file is at least 1
    - grep count of `signage.admin.pair.error_not_found` in that file is at least 1
    - grep count of `signage.admin.pair.error_claimed` in that file is at least 1
    - grep count of `text-4xl` and `font-mono` in that file (combined) is at least 2
    - grep count of `tracking-widest` in that file is at least 1
    - grep count of `replace(/[^A-Za-z0-9]/g` or equivalent auto-format regex is at least 1
    - grep count of `maxLength={7}` in that file is at least 1
    - grep count of `TagPicker` in that file is at least 1
    - grep count of `signageApi.createTag` in that file is at least 1 (tag create-on-submit)
    - grep count of `setLocation("/signage/devices")` in that file is at least 1 (success redirect)
    - grep count of `dark:` in that file is 0
    - grep count of `fetch(` in that file is 0
    - `cd frontend && node scripts/check-signage-invariants.mjs` exits 0
    - `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` exits 0 and prints PARITY OK
  </acceptance_criteria>
  <done>PairPage renders, code auto-formats to XXX-XXX, tags create-on-submit, claim redirects to /signage/devices with toast; errors map to inline code-field messages.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && npm run lint` exits 0.
3. `cd frontend && node scripts/check-signage-invariants.mjs` prints SIGNAGE INVARIANTS OK.
4. `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` prints PARITY OK.
5. Manual E2E:
   - Log in as admin. Launcher shows Digital Signage tile. Click → lands on /signage/media. Click Devices tab.
   - Click Pair new device → /signage/pair. On a Pi (or with a manually seeded pairing session in the backend), type the displayed code → device name → tags → Claim. Toast fires, redirect to /signage/devices, new row visible.
   - Within 30s the status chip updates based on device heartbeat.
   - Click Edit on a device → change tags → Save → table refreshes.
   - Click Revoke → confirm → device token revoked (Pi's next poll returns 401).
   - Navigate back to /signage/media. Everything works; no console errors.
6. Log in as viewer → no launcher tile, visiting /signage/* falls through AdminOnly.
</verification>

<success_criteria>
- SGN-ADM-06 (device table, status chips, edit, revoke) — complete.
- SGN-ADM-07 (/signage/pair claim page) — complete.
- SGN-ADM-08 (TagPicker reused in device edit + pair) — complete.
- SGN-ADM-09 (dirty guard for DeviceEditDialog) — complete.
- Phase 46 overall: all 11 requirements closed across 46-01..46-06.
- All CI gates (locale parity, signage invariants) green.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-06-SUMMARY.md`.
</output>
