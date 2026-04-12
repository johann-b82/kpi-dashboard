import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { fetchSyncMeta, triggerSync } from "@/lib/api";
import { syncKeys, hrKpiKeys } from "@/lib/queryKeys";
import { HrKpiCardGrid } from "@/components/dashboard/HrKpiCardGrid";

export function HRPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data: meta } = useQuery({
    queryKey: syncKeys.meta(),
    queryFn: fetchSyncMeta,
  });

  const [syncFeedback, setSyncFeedback] = useState<"idle" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncKeys.meta() });
      queryClient.invalidateQueries({ queryKey: hrKpiKeys.all() });
      setSyncFeedback("success");
      setTimeout(() => setSyncFeedback("idle"), 3000);
    },
    onError: (err: Error) => {
      setSyncFeedback("error");
      setSyncError(err.message);
    },
  });

  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const formatted =
    meta?.last_synced_at != null
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(meta.last_synced_at))
      : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Sync toolbar row */}
      <div className="flex justify-end items-center gap-3 mb-8">
        {meta?.last_synced_at == null ? (
          <span className="text-xs text-muted-foreground">
            {t("hr.sync.never")} —{" "}
            <Link href="/settings" className="underline">
              {t("hr.sync.configureHint")}
            </Link>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("hr.sync.lastSynced")} {formatted}
          </span>
        )}

        <button
          onClick={() => {
            setSyncFeedback("idle");
            setSyncError(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent/10 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("hr.sync.button")}
            </>
          ) : syncFeedback === "success" ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t("hr.sync.success")}
            </>
          ) : (
            t("hr.sync.button")
          )}
        </button>

        {syncFeedback === "error" && (
          <span className="text-xs text-destructive">
            {t("hr.sync.error")}
            {syncError ? `: ${syncError}` : ""}
          </span>
        )}
      </div>

      {/* HR KPI card grid */}
      <HrKpiCardGrid />
    </div>
  );
}
