import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchPersonioOptions, testPersonioConnection, triggerSync } from "@/lib/api";
import { syncKeys, hrKpiKeys } from "@/lib/queryKeys";
import type { DraftFields } from "@/hooks/useSettingsDraft";

interface PersonioCardProps {
  draft: DraftFields;
  setField: <K extends keyof DraftFields>(field: K, value: DraftFields[K]) => void;
  /** True when the backend reports Personio credentials are stored (personio_has_credentials). */
  hasCredentials: boolean;
}

/**
 * Personio settings section.
 *
 * - Credential inputs are masked (type="password"), write-only.
 * - Connection test uses local state — does not affect the draft.
 * - Absence type and department dropdowns are populated live from the
 *   GET /api/settings/personio-options endpoint (staleTime: 0 per D-09).
 *   They are disabled until credentials exist (D-10).
 * - All fields are saved via the existing shared Speichern button (D-13).
 */
export function PersonioCard({ draft, setField, hasCredentials }: PersonioCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const INTERVAL_OPTIONS: Array<{ value: 0 | 1 | 6 | 24; label: string }> = [
    { value: 0, label: t("settings.personio.sync_interval.manual") },
    { value: 1, label: t("settings.personio.sync_interval.hourly") },
    { value: 6, label: t("settings.personio.sync_interval.every6h") },
    { value: 24, label: t("settings.personio.sync_interval.daily") },
  ];

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error: string | null;
  } | null>(null);

  const [syncFeedback, setSyncFeedback] = useState<"idle" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncMutation = useMutation({
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

  // Fetch Personio options only when credentials are configured (D-09)
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["personio-options"],
    queryFn: fetchPersonioOptions,
    staleTime: 0,      // always fresh per D-09
    enabled: hasCredentials,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testPersonioConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : t("settings.personio.test_connection.error_fallback"),
      });
    } finally {
      setTesting(false);
    }
  };

  const dropdownsDisabled = !hasCredentials || optionsLoading || !!options?.error;
  const noCredentialsHint = !hasCredentials ? t("settings.personio.credentials.configure_hint") : null;
  const optionsError = options?.error ?? null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{t("settings.personio.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Client-ID */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-client-id" className="text-sm font-medium">
            {t("settings.personio.client_id.label")}
          </Label>
          <Input
            id="personio-client-id"
            type="password"
            autoComplete="new-password"
            value={draft.personio_client_id}
            onChange={(e) => setField("personio_client_id", e.target.value)}
            placeholder={t("settings.personio.client_id.placeholder")}
          />
          {hasCredentials && !draft.personio_client_id && (
            <p className="text-xs text-muted-foreground">
              {t("settings.personio.client_id.saved_hint")}
            </p>
          )}
        </div>

        {/* Client-Secret */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-client-secret" className="text-sm font-medium">
            {t("settings.personio.client_secret.label")}
          </Label>
          <Input
            id="personio-client-secret"
            type="password"
            autoComplete="new-password"
            value={draft.personio_client_secret}
            onChange={(e) => setField("personio_client_secret", e.target.value)}
            placeholder={t("settings.personio.client_secret.placeholder")}
          />
          {hasCredentials && !draft.personio_client_secret && (
            <p className="text-xs text-muted-foreground">
              {t("settings.personio.client_secret.saved_hint")}
            </p>
          )}
        </div>

        {/* Verbindung testen */}
        <div className="flex flex-col gap-2 max-w-md">
          <Button
            type="button"
            variant="secondary"
            disabled={testing || (!hasCredentials && !draft.personio_client_id)}
            onClick={handleTestConnection}
          >
            {testing ? t("settings.personio.test_connection.testing") : t("settings.personio.test_connection.button")}
          </Button>
          {testResult !== null && (
            <p
              className={
                testResult.success
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-destructive"
              }
            >
              {testResult.success
                ? t("settings.personio.test_connection.success")
                : (testResult.error ?? t("settings.personio.test_connection.failure"))}
            </p>
          )}
        </div>

        {/* Sync-Intervall */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-sync-interval" className="text-sm font-medium">
            {t("settings.personio.sync_interval.label")}
          </Label>
          <select
            id="personio-sync-interval"
            value={String(draft.personio_sync_interval_h)}
            onChange={(e) =>
              setField(
                "personio_sync_interval_h",
                Number(e.target.value) as 0 | 1 | 6 | 24,
              )
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sync now */}
        <div className="flex flex-col gap-2 max-w-md">
          <button
            type="button"
            onClick={() => {
              setSyncFeedback("idle");
              setSyncError(null);
              syncMutation.mutate();
            }}
            disabled={syncMutation.isPending || !hasCredentials}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent/10 transition-colors disabled:opacity-50 w-fit"
          >
            {syncMutation.isPending ? (
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
            <p className="text-xs text-destructive">
              {t("hr.sync.error")}
              {syncError ? `: ${syncError}` : ""}
            </p>
          )}
        </div>

        {/* Krankheitstyp (absence type) */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-sick-leave" className="text-sm font-medium">
            {t("settings.personio.sick_leave_type.label")}
          </Label>
          <select
            id="personio-sick-leave"
            value={String(draft.personio_sick_leave_type_id ?? "")}
            disabled={dropdownsDisabled}
            onChange={(e) =>
              setField("personio_sick_leave_type_id", e.target.value ? Number(e.target.value) : null)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{t("settings.personio.sick_leave_type.placeholder")}</option>
            {options?.absence_types.map((at) => (
              <option key={at.id} value={String(at.id)}>
                {at.name}
              </option>
            ))}
          </select>
          {(noCredentialsHint || optionsError) && (
            <p className="text-xs text-muted-foreground">
              {noCredentialsHint ?? optionsError}
            </p>
          )}
        </div>

        {/* Produktions-Abteilung */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-dept" className="text-sm font-medium">
            {t("settings.personio.production_dept.label")}
          </Label>
          <select
            id="personio-dept"
            value={draft.personio_production_dept ?? ""}
            disabled={dropdownsDisabled}
            onChange={(e) =>
              setField("personio_production_dept", e.target.value || null)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{t("settings.personio.production_dept.placeholder")}</option>
            {options?.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {(noCredentialsHint || optionsError) && (
            <p className="text-xs text-muted-foreground">
              {noCredentialsHint ?? optionsError}
            </p>
          )}
        </div>

        {/* Skill-Attribut-Key */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-skill-key" className="text-sm font-medium">
            {t("settings.personio.skill_attr_key.label")}
          </Label>
          <Input
            id="personio-skill-key"
            value={draft.personio_skill_attr_key ?? ""}
            onChange={(e) =>
              setField("personio_skill_attr_key", e.target.value || null)
            }
            placeholder={t("settings.personio.skill_attr_key.placeholder")}
          />
        </div>

      </CardContent>
    </Card>
  );
}
