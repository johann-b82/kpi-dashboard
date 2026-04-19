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
 * Two-mode dialog driven by the caller (MediaPage in 46-04):
 *   - "confirm": initial confirm with Delete / Keep buttons
 *   - "in_use": post-409 follow-up showing how many playlists block deletion
 *
 * The 409 response body shape is `{ detail, playlist_ids: string[] }` —
 * the caller extracts `playlist_ids.length` and re-opens this dialog in
 * "in_use" mode (Pitfall 6 in 46-RESEARCH.md). Component itself is
 * presentational and stateless apart from i18n.
 */
export type MediaDeleteDialogMode =
  | { kind: "confirm"; title: string }
  | { kind: "in_use"; title: string; playlistCount: number };

export interface MediaDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MediaDeleteDialogMode | null;
  /** Called only in "confirm" mode when the user clicks the destructive action. */
  onConfirm: () => void;
}

export function MediaDeleteDialog({
  open,
  onOpenChange,
  mode,
  onConfirm,
}: MediaDeleteDialogProps) {
  const { t } = useTranslation();
  if (!mode) return null;

  if (mode.kind === "confirm") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("signage.admin.media.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("signage.admin.media.delete_body", { title: mode.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("signage.admin.media.delete_cancel")}
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              {t("signage.admin.media.delete_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // in_use — close-only, no destructive action
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("signage.admin.media.delete_in_use_title")}
          </DialogTitle>
          <DialogDescription>
            {t("signage.admin.media.delete_in_use_body", {
              count: mode.playlistCount,
            })}
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
