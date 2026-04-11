import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";

export function NavBar() {
  const { t } = useTranslation();
  const [location] = useLocation();

  const linkClass = (active: boolean) =>
    "text-sm " +
    (active
      ? "text-primary font-semibold border-b-2 border-primary pb-1"
      : "text-foreground hover:text-primary");

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        <span className="text-sm font-semibold">{t("nav.brand")}</span>
        <Link href="/" className={linkClass(location === "/")}>
          {t("nav.dashboard")}
        </Link>
        <Link href="/upload" className={linkClass(location === "/upload")}>
          {t("nav.upload")}
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <FreshnessIndicator />
          <LanguageToggle />
        </div>
      </div>
    </nav>
  );
}
