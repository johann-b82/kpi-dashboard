import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Phase 40-02 — sensor-specific confirmation dialog replacing the
 * window.confirm() stub from Plan 40-01. Uses the already-landed
 * `sensors.admin.remove_confirm.*` i18n keys (EN + DE).
 *
 * We deliberately do NOT generalize `DeleteConfirmDialog.tsx` — its
 * UploadPage consumer depends on the batch-specific prop shape.
 * A parallel component is the lower-blast-radius path.
 */
export interface SensorRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sensorName: string;
  onConfirm: () => void;
}

export function SensorRemoveDialog({
  open,
  onOpenChange,
  sensorName,
  onConfirm,
}: SensorRemoveDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sensors.admin.remove_confirm.title")}</DialogTitle>
          <DialogDescription>
            {t("sensors.admin.remove_confirm.body", { name: sensorName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("sensors.admin.remove_confirm.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("sensors.admin.remove_confirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
