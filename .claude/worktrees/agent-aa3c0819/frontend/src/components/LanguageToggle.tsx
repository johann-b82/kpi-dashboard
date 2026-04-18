import { useTranslation } from "react-i18next";

/**
 * NavBar language toggle — compact text button showing the target language.
 * Click flips between DE and EN. Persists via i18next; no server round-trip.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isDE = i18n.language === "de";
  const target = isDE ? "EN" : "DE";

  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(target.toLowerCase())}
      aria-label={`Switch language to ${target}`}
      className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/10 transition-colors text-foreground"
    >
      {target}
    </button>
  );
}
