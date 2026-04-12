import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface PreferencesCardProps {
  value: "DE" | "EN";
  onChange: (v: "DE" | "EN") => void;
}

const LANGS: Array<"DE" | "EN"> = ["DE", "EN"];

/**
 * General preferences card with a DE/EN segmented language picker.
 *
 * The picker is a WAI-ARIA radiogroup (two plain <button> elements with
 * role="radio" / aria-checked). Per the single-writer invariant for i18n,
 * this component does NOT call i18n.changeLanguage itself — it only reports
 * the new value via onChange, and useSettingsDraft.setField handles the
 * live-preview side effect.
 *
 * No shadcn asChild usage — CLAUDE.md forbids it (project uses base-ui,
 * not Radix, and shadcn wraps via the `render` prop).
 */
export function PreferencesCard({ value, onChange }: PreferencesCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          {t("settings.preferences.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 max-w-md">
          <Label className="text-sm font-medium">
            {t("settings.preferences.language.label")}
          </Label>
          <SegmentedControl<"DE" | "EN">
            segments={LANGS.map((lang) => ({
              value: lang,
              label: lang,
            }))}
            value={value}
            onChange={onChange}
            aria-label={t("settings.preferences.language.label")}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.preferences.language.help")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
