import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon } from "lucide-react";

/**
 * NavBar theme toggle — single icon button. Shows the icon for the mode
 * clicking will switch TO (Moon while light, Sun while dark).
 * Persists to localStorage.theme and toggles the .dark class on <html>.
 * Live-tracks OS prefers-color-scheme until the user clicks once (D-06, D-07).
 */
type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const applyMode = (next: ThemeMode, persist: boolean) => {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (persist) localStorage.setItem("theme", next);
    setMode(next);
  };

  const handleClick = () => {
    applyMode(mode === "dark" ? "light" : "dark", true);
  };

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onOsChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("theme");
      // D-07: localStorage wins permanently once set
      if (stored === "light" || stored === "dark") return;
      applyMode(e.matches ? "dark" : "light", false);
    };
    mql.addEventListener("change", onOsChange);
    return () => mql.removeEventListener("change", onOsChange);
  }, []);

  const Icon = mode === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("theme.toggle.aria_label")}
      className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors text-foreground"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
