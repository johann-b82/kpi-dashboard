import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export function NavBar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { data } = useSettings();

  // Fallback chain: cached data > frontend defaults.
  // ThemeProvider gates render while isLoading, so by the time NavBar renders,
  // data is present OR ThemeProvider is in error-fallback mode (data undefined).
  const settings = data ?? DEFAULT_SETTINGS;

  const linkClass = (active: boolean) =>
    "text-sm " +
    (active
      ? "text-primary font-semibold border-b-2 border-primary pb-1"
      : "text-foreground hover:text-primary");

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
            className="max-h-14 max-w-14 object-contain"
          />
        ) : (
          <span className="text-sm font-semibold">{settings.app_name}</span>
        )}

        <Link href="/" className={linkClass(location === "/")}>
          {t("nav.dashboard")}
        </Link>
        <Link href="/upload" className={linkClass(location === "/upload")}>
          {t("nav.upload")}
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <FreshnessIndicator />
          <LanguageToggle />
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
