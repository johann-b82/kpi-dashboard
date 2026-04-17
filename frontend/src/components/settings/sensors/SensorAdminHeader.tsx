import { useTranslation } from "react-i18next";
import { Link } from "wouter";

/**
 * Phase 40-01 — sub-page header for /settings/sensors.
 * Mirrors the SettingsPage.tsx <header> pattern: one H1, one subtitle,
 * one back-link. Token-only Tailwind (no hex literals, no dark: variants).
 */
export function SensorAdminHeader() {
  const { t } = useTranslation();
  return (
    <header className="mb-12 space-y-2">
      <h1 className="text-3xl font-semibold leading-tight">
        {t("sensors.admin.title")}
      </h1>
      <p className="text-base text-muted-foreground">
        {t("sensors.admin.subtitle")}
      </p>
      <Link
        href="/settings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t("sensors.admin.back_to_settings")}
      </Link>
    </header>
  );
}
