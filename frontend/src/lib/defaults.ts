import type { Settings } from "./api";

export const DEFAULT_SETTINGS: Settings = {
  color_primary: "oklch(0.55 0.15 250)",
  color_accent: "oklch(0.70 0.18 150)",
  color_background: "oklch(1.00 0 0)",
  color_foreground: "oklch(0.15 0 0)",
  color_muted: "oklch(0.90 0 0)",
  color_destructive: "oklch(0.55 0.22 25)",
  app_name: "KPI Light",
  default_language: "EN",
  logo_url: null,
  logo_updated_at: null,
};

export const THEME_TOKEN_MAP = {
  color_primary: "--primary",
  color_accent: "--accent",
  color_background: "--background",
  color_foreground: "--foreground",
  color_muted: "--muted",
  color_destructive: "--destructive",
} as const;
