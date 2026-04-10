import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isDE = i18n.language === "de";

  function handleToggle() {
    i18n.changeLanguage(isDE ? "en" : "de");
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleToggle} className="text-sm">
      {isDE ? (
        <>
          <span className="font-semibold">DE</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="text-slate-500">EN</span>
        </>
      ) : (
        <>
          <span className="text-slate-500">DE</span>
          <span className="mx-1 text-slate-400">/</span>
          <span className="font-semibold">EN</span>
        </>
      )}
    </Button>
  );
}
