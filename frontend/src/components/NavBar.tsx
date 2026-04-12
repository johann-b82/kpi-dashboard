import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Upload as UploadIcon, Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function NavBar() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { data } = useSettings();

  // Fallback chain: cached data > frontend defaults.
  // ThemeProvider gates render while isLoading, so by the time NavBar renders,
  // data is present OR ThemeProvider is in error-fallback mode (data undefined).
  const settings = data ?? DEFAULT_SETTINGS;

  // Upload icon link — styled Link directly (no nested <Button> to avoid invalid <a><button>)
  const uploadLinkClass =
    "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
    (location === "/upload" ? "text-primary" : "text-foreground");

  // Gear link — styled <Link> directly (no nested <Button> to avoid invalid <a><button>)
  const settingsLinkClass =
    "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
    (location === "/settings" ? "text-primary" : "text-foreground");

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        {/* Brand slot — mutually exclusive logo OR text (D-05, BRAND-03 + BRAND-06) */}
        {settings.logo_url != null ? (
          <img
            src={settings.logo_url}
            alt={settings.app_name}
            className="max-h-8 max-w-8 object-contain"
          />
        ) : (
          <span className="text-xs font-semibold">{settings.app_name}</span>
        )}

        {location === "/settings" || location === "/upload" ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors text-foreground"
            aria-label={t("nav.back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <SegmentedControl
            segments={[
              { value: "/", label: t("nav.sales") },
              { value: "/hr", label: t("nav.hr") },
            ]}
            value={location === "/hr" ? "/hr" : "/"}
            onChange={(path) => navigate(path)}
            aria-label="Navigation"
            className="border-transparent"
          />
        )}

        <div className="ml-auto flex items-center gap-4">
          <LanguageToggle />
          <Link
            href="/upload"
            aria-label={t("nav.upload")}
            className={uploadLinkClass}
          >
            <UploadIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            aria-label={t("nav.settings")}
            className={settingsLinkClass}
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
