import { useTranslation } from "react-i18next";

/**
 * Phase 46 Plan 46-01 stub. Expanded by Plan 46-05.
 */
export function PlaylistsPage() {
  const { t } = useTranslation();
  return (
    <section className="rounded-md border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{t("signage.admin.playlists.empty_title")}</p>
    </section>
  );
}
