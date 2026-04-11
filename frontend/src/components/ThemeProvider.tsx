import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS, THEME_TOKEN_MAP } from "@/lib/defaults";
import type { Settings } from "@/lib/api";

function applyTheme(settings: Settings) {
  const root = document.documentElement;
  (Object.keys(THEME_TOKEN_MAP) as Array<keyof typeof THEME_TOKEN_MAP>).forEach(
    (key) => {
      const cssVar = THEME_TOKEN_MAP[key];
      root.style.setProperty(cssVar, settings[key]);
    },
  );
  document.title = settings.app_name;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useSettings();
  const { t } = useTranslation();
  const errorToastFired = useRef(false);

  // Effective settings: data when present, DEFAULT_SETTINGS on error, undefined while loading
  const effective: Settings | undefined =
    data ?? (error ? DEFAULT_SETTINGS : undefined);

  useEffect(() => {
    if (effective) {
      applyTheme(effective);
    }
  }, [effective]);

  useEffect(() => {
    if (error && !errorToastFired.current) {
      toast.error(t("theme.error_toast"));
      errorToastFired.current = true;
    }
  }, [error, t]);

  if (isLoading) {
    // Neutral skeleton — NO text, NO brand, NO children (D-02)
    // bg-muted maps to --muted which starts at oklch(0.97 0 0) in index.css defaults
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-muted"
        aria-hidden="true"
        data-testid="theme-skeleton"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
