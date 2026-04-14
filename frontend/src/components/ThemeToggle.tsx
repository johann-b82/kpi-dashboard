import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * NavBar theme toggle (Light/Dark). Persists to localStorage.theme and toggles
 * the .dark class on <html>. Phase 21's ThemeProvider observes the class change.
 * Live-tracks OS prefers-color-scheme until the user clicks once (D-06, D-07).
 */
type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const handleChange = (next: ThemeMode) => {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", next);
    setMode(next);
  };

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onOsChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("theme");
      // D-07: localStorage wins permanently once set
      if (stored === "light" || stored === "dark") return;
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
        setMode("dark");
      } else {
        root.classList.remove("dark");
        setMode("light");
      }
    };
    mql.addEventListener("change", onOsChange);
    return () => mql.removeEventListener("change", onOsChange);
  }, []);

  return (
    <SegmentedControl<ThemeMode>
      segments={[
        { value: "light", label: t("theme.toggle.light") },
        { value: "dark", label: t("theme.toggle.dark") },
      ]}
      value={mode}
      onChange={handleChange}
      aria-label={t("theme.toggle.aria_label")}
    />
  );
}
