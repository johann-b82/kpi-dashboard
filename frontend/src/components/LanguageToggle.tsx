import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

/**
 * NavBar language toggle — single icon button. Clicking flips between DE and EN.
 * Shows the target language code next to the globe so current state is visible.
 * Persists via i18next language-detector; no server round-trip.
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
      className="inline-flex items-center justify-center gap-1 rounded-md p-2 hover:bg-accent/10 transition-colors text-foreground"
    >
      <Globe className="h-5 w-5" />
      <span className="text-xs font-medium">{target}</span>
    </button>
  );
}
