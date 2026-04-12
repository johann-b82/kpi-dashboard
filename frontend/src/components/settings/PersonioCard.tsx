import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchPersonioOptions, testPersonioConnection } from "@/lib/api";
import type { DraftFields } from "@/hooks/useSettingsDraft";

interface PersonioCardProps {
  draft: DraftFields;
  setField: <K extends keyof DraftFields>(field: K, value: DraftFields[K]) => void;
  /** True when the backend reports Personio credentials are stored (personio_has_credentials). */
  hasCredentials: boolean;
}

const INTERVAL_OPTIONS: Array<{ value: 0 | 1 | 6 | 24; label: string }> = [
  { value: 0, label: "Nur manuell" },
  { value: 1, label: "Stuendlich" },
  { value: 6, label: "Alle 6 Stunden" },
  { value: 24, label: "Taeglich" },
];

/**
 * Personio settings section.
 *
 * - Credential inputs are masked (type="password"), write-only.
 * - Connection test uses local state — does not affect the draft.
 * - Absence type and department dropdowns are populated live from the
 *   GET /api/settings/personio-options endpoint (staleTime: 0 per D-09).
 *   They are disabled until credentials exist (D-10).
 * - All fields are saved via the existing shared Speichern button (D-13).
 */
export function PersonioCard({ draft, setField, hasCredentials }: PersonioCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error: string | null;
  } | null>(null);

  // Fetch Personio options only when credentials are configured (D-09)
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["personio-options"],
    queryFn: fetchPersonioOptions,
    staleTime: 0,      // always fresh per D-09
    enabled: hasCredentials,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testPersonioConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const dropdownsDisabled = !hasCredentials || optionsLoading || !!options?.error;
  const noCredentialsHint = !hasCredentials ? "Personio-Zugangsdaten konfigurieren" : null;
  const optionsError = options?.error ?? null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Personio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Client-ID */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-client-id" className="text-sm font-medium">
            Client-ID
          </Label>
          <Input
            id="personio-client-id"
            type="password"
            autoComplete="new-password"
            value={draft.personio_client_id}
            onChange={(e) => setField("personio_client_id", e.target.value)}
            placeholder="Client-ID eingeben"
          />
          {hasCredentials && !draft.personio_client_id && (
            <p className="text-xs text-muted-foreground">
              Gespeichert - zum Aendern neuen Wert eingeben
            </p>
          )}
        </div>

        {/* Client-Secret */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-client-secret" className="text-sm font-medium">
            Client-Secret
          </Label>
          <Input
            id="personio-client-secret"
            type="password"
            autoComplete="new-password"
            value={draft.personio_client_secret}
            onChange={(e) => setField("personio_client_secret", e.target.value)}
            placeholder="Client-Secret eingeben"
          />
          {hasCredentials && !draft.personio_client_secret && (
            <p className="text-xs text-muted-foreground">
              Gespeichert - zum Aendern neuen Wert eingeben
            </p>
          )}
        </div>

        {/* Verbindung testen */}
        <div className="flex flex-col gap-2 max-w-md">
          <Button
            type="button"
            variant="secondary"
            disabled={testing || (!hasCredentials && !draft.personio_client_id)}
            onClick={handleTestConnection}
          >
            {testing ? "Teste..." : "Verbindung testen"}
          </Button>
          {testResult !== null && (
            <p
              className={
                testResult.success
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-destructive"
              }
            >
              {testResult.success
                ? "Verbindung erfolgreich"
                : (testResult.error ?? "Verbindung fehlgeschlagen")}
            </p>
          )}
        </div>

        {/* Sync-Intervall */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-sync-interval" className="text-sm font-medium">
            Sync-Intervall
          </Label>
          <select
            id="personio-sync-interval"
            value={String(draft.personio_sync_interval_h)}
            onChange={(e) =>
              setField(
                "personio_sync_interval_h",
                Number(e.target.value) as 0 | 1 | 6 | 24,
              )
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Krankheitstyp (absence type) */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-sick-leave" className="text-sm font-medium">
            Krankheitstyp
          </Label>
          <select
            id="personio-sick-leave"
            value={String(draft.personio_sick_leave_type_id ?? "")}
            disabled={dropdownsDisabled}
            onChange={(e) =>
              setField("personio_sick_leave_type_id", e.target.value ? Number(e.target.value) : null)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Abwesenheitstyp waehlen</option>
            {options?.absence_types.map((at) => (
              <option key={at.id} value={String(at.id)}>
                {at.name}
              </option>
            ))}
          </select>
          {(noCredentialsHint || optionsError) && (
            <p className="text-xs text-muted-foreground">
              {noCredentialsHint ?? optionsError}
            </p>
          )}
        </div>

        {/* Produktions-Abteilung */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-dept" className="text-sm font-medium">
            Produktions-Abteilung
          </Label>
          <select
            id="personio-dept"
            value={draft.personio_production_dept ?? ""}
            disabled={dropdownsDisabled}
            onChange={(e) =>
              setField("personio_production_dept", e.target.value || null)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Abteilung waehlen</option>
            {options?.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {(noCredentialsHint || optionsError) && (
            <p className="text-xs text-muted-foreground">
              {noCredentialsHint ?? optionsError}
            </p>
          )}
        </div>

        {/* Skill-Attribut-Key */}
        <div className="flex flex-col gap-2 max-w-md">
          <Label htmlFor="personio-skill-key" className="text-sm font-medium">
            Skill Custom Attribute Key
          </Label>
          <Input
            id="personio-skill-key"
            value={draft.personio_skill_attr_key ?? ""}
            onChange={(e) =>
              setField("personio_skill_attr_key", e.target.value || null)
            }
            placeholder="z.B. dynamic_12345"
          />
        </div>

      </CardContent>
    </Card>
  );
}
