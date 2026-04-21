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
 * Phase 52 Plan 02 — destructive confirmation dialog for schedule delete.
 * Mirrors MediaDeleteDialog "confirm" mode verbatim; i18n keys under
 * signage.admin.schedules.delete.*.
 */
export interface ScheduleDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  scheduleName: string;
}

export function ScheduleDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  busy,
  scheduleName,
}: ScheduleDeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("signage.admin.schedules.delete.title")}
          </DialogTitle>
          <DialogDescription>
            {t("signage.admin.schedules.delete.body", { name: scheduleName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("signage.admin.schedules.delete.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
          >
            {t("signage.admin.schedules.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
