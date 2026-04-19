import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signageKeys } from "@/lib/queryKeys";
import { signageApi } from "@/signage/lib/signageApi";
import type { SignageDevice } from "@/signage/lib/signageTypes";
import { TagPicker } from "./TagPicker";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

const schema = z.object({
  name: z.string().min(1).max(128),
  tags: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

export interface DeviceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: SignageDevice | null;
}

/**
 * Edit-device dialog with dirty-guard (SGN-ADM-09 / D-09). Save flow:
 *   1. Resolve tag names → IDs (create-on-submit via signageApi.createTag)
 *   2. PATCH /devices/{id} for name (backend SignageDeviceAdminUpdate is name-only)
 *   3. PUT  /devices/{id}/tags for tag_ids (separate endpoint per devices.py)
 *
 * Dirty-guard: when the user attempts to close the dialog with form.formState.isDirty,
 * the close is intercepted and an UnsavedChangesDialog is shown instead.
 * Discard → reset form + close. Stay → cancel close (UnsavedChangesDialog closes only).
 */
export function DeviceEditDialog({
  open,
  onOpenChange,
  device,
}: DeviceEditDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", tags: [] },
  });

  // Reset form whenever the device prop changes (dialog reopened on a new row).
  useEffect(() => {
    if (device) {
      form.reset({
        name: device.name,
        tags: device.tags.map((tag) => tag.name),
      });
    }
  }, [device, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!device) throw new Error("no device");
      // Resolve tag names → ids (create unknown tags first).
      const existing = await signageApi.listTags();
      const nameToId = new Map(existing.map((tag) => [tag.name, tag.id]));
      const tagIds: number[] = [];
      for (const name of values.tags) {
        let id = nameToId.get(name);
        if (id === undefined) {
          const created = await signageApi.createTag(name);
          id = created.id;
        }
        tagIds.push(id);
      }
      // Sequence: PATCH name, then PUT tags.
      await signageApi.updateDevice(device.id, { name: values.name });
      await signageApi.replaceDeviceTags(device.id, tagIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signageKeys.devices() });
      queryClient.invalidateQueries({ queryKey: signageKeys.tags() });
      toast.success(t("signage.admin.device.saved"));
      form.reset(form.getValues());
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(t("signage.admin.device.save_error", { detail }));
    },
  });

  // Intercept close attempts when the form is dirty: route through unsaved guard.
  function handleOpenChange(next: boolean) {
    if (!next && form.formState.isDirty) {
      setUnsavedOpen(true);
      return;
    }
    onOpenChange(next);
  }

  function discardAndClose() {
    form.reset();
    setUnsavedOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("signage.admin.device.edit_title")}</DialogTitle>
            <DialogDescription>
              {device?.name ?? ""}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-edit-name">
                {t("signage.admin.pair.name_label")}
              </Label>
              <Input
                id="device-edit-name"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
                autoComplete="off"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("signage.admin.pair.tags_label")}</Label>
              <Controller
                name="tags"
                control={form.control}
                render={({ field }) => (
                  <TagPicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("signage.admin.pair.tags_placeholder")}
                    ariaLabel={t("signage.admin.pair.tags_label")}
                  />
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                {t("signage.admin.device.revoke_cancel")}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {t("signage.admin.device.edit_title")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={unsavedOpen}
        onOpenChange={setUnsavedOpen}
        onStay={() => setUnsavedOpen(false)}
        onDiscardAndLeave={discardAndClose}
      />
    </>
  );
}
