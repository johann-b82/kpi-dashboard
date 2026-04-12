import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * NavBar language toggle. Persists to localStorage and switches i18n runtime.
 * No server round-trip — language is frontend-only.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();

  const isDE = i18n.language === "de";

  return (
    <SegmentedControl<"DE" | "EN">
      segments={[
        { value: "DE", label: "DE" },
        { value: "EN", label: "EN" },
      ]}
      value={isDE ? "DE" : "EN"}
      onChange={(lang) => void i18n.changeLanguage(lang.toLowerCase())}
      aria-label="Language"
    />
  );
}
