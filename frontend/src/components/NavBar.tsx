import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Upload as UploadIcon, Settings as SettingsIcon, ArrowLeft, LogOut, Library } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { AdminOnly } from "@/auth/AdminOnly";

type Dashboard = "/" | "/hr";

function getLastDashboard(): Dashboard {
  try {
    const v = sessionStorage.getItem("lastDashboard");
    if (v === "/hr") return "/hr";
  } catch {
    /* sessionStorage unavailable — fall through to default */
  }
  return "/";
}
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function NavBar() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const isLauncher = location === "/home";
  const { data } = useSettings();
  const { signOut } = useAuth();

  // Fallback chain: cached data > frontend defaults.
  // ThemeProvider gates render while isLoading, so by the time NavBar renders,
  // data is present OR ThemeProvider is in error-fallback mode (data undefined).
  const settings = data ?? DEFAULT_SETTINGS;

  // Track the last visited dashboard (Sales or HR) so the back button on
  // /settings and /upload can always return to where the user came from.
  useEffect(() => {
    if (location === "/" || location === "/hr") {
      try {
        sessionStorage.setItem("lastDashboard", location);
      } catch {
        /* sessionStorage unavailable — back button falls back to "/" */
      }
    }
  }, [location]);

  const lastDashboard = getLastDashboard();
  const backLabel = lastDashboard === "/hr" ? t("nav.back_to_hr") : t("nav.back_to_sales");

  // Upload icon link — styled Link directly (no nested <Button> to avoid invalid <a><button>)
  const uploadLinkClass =
    "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
    (location === "/upload" ? "text-primary" : "text-foreground");

  // Gear link — styled <Link> directly (no nested <Button> to avoid invalid <a><button>)
  const settingsLinkClass =
    "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
    (location === "/settings" ? "text-primary" : "text-foreground");

  const docsLinkClass =
    "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
    (location === "/docs" || location.startsWith("/docs/") ? "text-primary" : "text-foreground");

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        {/* Brand slot — mutually exclusive logo OR text (D-05, BRAND-03 + BRAND-06) */}
        <div className="flex items-center gap-2">
          {settings.logo_url != null && (
            <img
              src={settings.logo_url}
              alt={settings.app_name}
              className="max-h-8 max-w-8 object-contain"
            />
          )}
          <span className="text-sm font-medium">{settings.app_name}</span>
        </div>

        {!isLauncher && (
          location === "/settings" || location === "/upload" || location.startsWith("/docs") ? (
            <button
              type="button"
              onClick={() => navigate(lastDashboard)}
              className="inline-flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/10 transition-colors text-foreground text-sm"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{backLabel}</span>
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
          )
        )}

        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <LanguageToggle />
          {!isLauncher && (
            <>
              <Link
                href="/docs"
                aria-label={t("docs.nav.docsLabel")}
                className={docsLinkClass}
              >
                <Library className="h-5 w-5" />
              </Link>
              <AdminOnly>
                <Link
                  href="/upload"
                  aria-label={t("nav.upload")}
                  className={uploadLinkClass}
                >
                  <UploadIcon className="h-5 w-5" />
                </Link>
              </AdminOnly>
              <Link
                href="/settings"
                aria-label={t("nav.settings")}
                className={settingsLinkClass}
              >
                <SettingsIcon className="h-5 w-5" />
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
