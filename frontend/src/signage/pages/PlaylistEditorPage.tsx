// Phase 46 Plan 46-05 Task 1 — placeholder so App.tsx route registration
// type-checks. Full implementation lands in Task 3 of this plan.
import { useTranslation } from "react-i18next";

export function PlaylistEditorPage() {
  const { t } = useTranslation();
  return (
    <section className="rounded-md border border-border bg-card p-6 m-6">
      <p className="text-sm text-muted-foreground">
        {t("signage.admin.error.loading")}
      </p>
    </section>
  );
}
