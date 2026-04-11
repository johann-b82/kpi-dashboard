import { useTranslation } from "react-i18next";

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold leading-tight">
        {t("settings.page_title_stub")}
      </h1>
      <p className="mt-4 text-base leading-normal text-muted-foreground">
        {t("settings.stub_body")}
      </p>
    </div>
  );
}
