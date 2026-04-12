import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsDraftStatus } from "@/contexts/SettingsDraftContext";
import {
  updateSettings,
  type Settings,
  type SettingsUpdatePayload,
} from "@/lib/api";

/**
 * NavBar language toggle. Persists the selected UI language via PUT /api/settings
 * with the full 8-field payload (D-15), then pessimistically updates the runtime
 * language only on success. Disabled when the Settings page has a dirty draft
 * (D-13) so there is only ever one settings writer at a time.
 *
 * Design notes:
 * - Reads current settings from the TanStack cache (queryClient.getQueryData) —
 *   no fallback to hardcoded defaults, so we never overwrite other user-edited
 *   fields with baseline values. If cache is empty the mutation throws and the error
 *   toast fires (the ThemeProvider already gates render on isLoading so this
 *   is effectively unreachable in practice).
 * - Does NOT read the current route — `useSettingsDraftStatus().isDirty` is the
 *   single source of truth. SettingsPage clears dirty on unmount (D-14), so on
 *   any non-Settings route the toggle is enabled automatically.
 * - Pessimistic: we do NOT call i18n.changeLanguage before the server acks. If
 *   PUT fails the runtime language stays where it was.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  // Subscribe so the bold/muted visual state reflects cache updates from any
  // other writer (SettingsPage save, bootstrap cold-start).
  useSettings();

  const draftStatus = useSettingsDraftStatus();
  const isDirty = draftStatus?.isDirty === true;

  const mutation = useMutation({
    mutationFn: async (nextLang: "DE" | "EN"): Promise<Settings> => {
      const current = queryClient.getQueryData<Settings>(["settings"]);
      if (!current) {
        throw new Error("Settings not loaded");
      }
      const payload: SettingsUpdatePayload = {
        color_primary: current.color_primary,
        color_accent: current.color_accent,
        color_background: current.color_background,
        color_foreground: current.color_foreground,
        color_muted: current.color_muted,
        color_destructive: current.color_destructive,
        app_name: current.app_name,
        default_language: nextLang,
      };
      return updateSettings(payload);
    },
    onSuccess: async (response, nextLang) => {
      queryClient.setQueryData(["settings"], response);
      await i18n.changeLanguage(nextLang.toLowerCase());
    },
    onError: (err) => {
      const detail = err instanceof Error ? err.message : "Unknown error";
      toast.error(t("settings.toasts.save_error", { detail }));
    },
  });

  const isDE = i18n.language === "de";
  const isDisabled = isDirty || mutation.isPending;

  return (
    <SegmentedControl<"DE" | "EN">
      segments={[
        { value: "DE", label: "DE" },
        { value: "EN", label: "EN" },
      ]}
      value={isDE ? "DE" : "EN"}
      onChange={(lang) => mutation.mutate(lang)}
      disabled={isDisabled}
      aria-label="Language"
      title={isDirty ? t("settings.preferences.toggle_disabled_tooltip") : undefined}
    />
  );
}
