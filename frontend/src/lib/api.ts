export interface ValidationErrorDetail {
  row: number;
  column: string;
  message: string;
}

export interface UploadResponse {
  id: number;
  filename: string;
  row_count: number;
  error_count: number;
  status: "success" | "partial" | "failed";
  errors: ValidationErrorDetail[];
}

export interface UploadBatchSummary {
  id: number;
  filename: string;
  uploaded_at: string;
  row_count: number;
  error_count: number;
  status: "success" | "partial" | "failed";
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getUploads(): Promise<UploadBatchSummary[]> {
  const res = await fetch("/api/uploads");
  if (!res.ok) throw new Error("Failed to fetch uploads");
  return res.json();
}

export async function deleteUpload(id: number): Promise<void> {
  const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete upload");
}

/**
 * Phase 8 nullable sibling for the dual-delta KPI cards. Matches the
 * `KpiSummaryComparison` Pydantic model on the backend — three numeric
 * fields, no further nesting.
 */
export interface KpiSummaryComparison {
  total_revenue: number;
  avg_order_value: number;
  total_orders: number;
}

export interface KpiSummary {
  total_revenue: number;
  avg_order_value: number;
  total_orders: number;
  /** Null when no baseline exists (thisYear, allTime, or zero-row window). */
  previous_period: KpiSummaryComparison | null;
  /** Null when no prior-year data exists for the requested window. */
  previous_year: KpiSummaryComparison | null;
}

import type { PrevBounds } from "./prevBounds.ts";

export interface ChartPoint {
  date: string; // ISO date string "YYYY-MM-DD" (bucket-truncated by granularity)
  // `revenue` is null only in the `previous` series of ChartResponse for
  // missing trailing buckets (CHART-03). The `current` series always
  // carries concrete numeric revenues.
  revenue: number | null;
}

/**
 * Phase 8 wrapped chart response. The bare `ChartPoint[]` shape shipped in
 * v1.0/v1.1 has been replaced with `{ current, previous }` so the endpoint
 * can optionally carry an overlay series aligned positionally to `current`.
 * `previous` is null unless the caller requests a comparison via the
 * `comparison` + `prev_start` + `prev_end` query params (not yet wired in
 * this adapter — that's Phase 10's concern).
 */
export interface ChartResponse {
  current: ChartPoint[];
  previous: ChartPoint[] | null;
}

import type { ComparisonMode } from "./chartComparisonMode.ts";

export interface LatestUploadResponse {
  uploaded_at: string | null;
}

export async function fetchKpiSummary(
  start?: string,
  end?: string,
  prev?: PrevBounds,
): Promise<KpiSummary> {
  const params = new URLSearchParams();
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  if (prev?.prev_period_start)
    params.set("prev_period_start", prev.prev_period_start);
  if (prev?.prev_period_end)
    params.set("prev_period_end", prev.prev_period_end);
  if (prev?.prev_year_start)
    params.set("prev_year_start", prev.prev_year_start);
  if (prev?.prev_year_end) params.set("prev_year_end", prev.prev_year_end);
  const qs = params.toString();
  const res = await fetch(`/api/kpis${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch KPI summary");
  return res.json();
}

export async function fetchChartData(
  start: string | undefined,
  end: string | undefined,
  granularity: "daily" | "weekly" | "monthly" = "monthly",
  comparison?: ComparisonMode,
  prevStart?: string,
  prevEnd?: string,
): Promise<ChartResponse> {
  const params = new URLSearchParams({ granularity });
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  if (comparison && comparison !== "none") {
    params.set("comparison", comparison);
    if (prevStart) params.set("prev_start", prevStart);
    if (prevEnd) params.set("prev_end", prevEnd);
  }
  const res = await fetch(`/api/kpis/chart?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch chart data");
  return res.json();
}

export async function fetchLatestUpload(): Promise<LatestUploadResponse> {
  const res = await fetch("/api/kpis/latest-upload");
  if (!res.ok) throw new Error("Failed to fetch latest upload");
  return res.json();
}

export interface Settings {
  color_primary: string;
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  default_language: "DE" | "EN";
  logo_url: string | null;
  logo_updated_at: string | null;
  // Phase 13 Personio fields
  personio_has_credentials: boolean;
  personio_sync_interval_h: number;
  personio_sick_leave_type_id: number[];
  personio_production_dept: string[];
  personio_skill_attr_key: string[];
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

/**
 * Payload for PUT /api/settings. Exactly 8 required fields — logo bytes have their
 * own endpoint (Phase 4 D-05). All color_* fields must be in canonical
 * `oklch(L C H)` format; the backend's _OKLCH_RE regex rejects hex and
 * any string containing `;`, `}`, `{`, `url(`, `expression(`, or quotes.
 * Phase 13: Personio fields are optional — undefined means "don't change".
 */
export interface SettingsUpdatePayload {
  color_primary: string;
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  default_language: "DE" | "EN";
  // Phase 13 Personio fields — undefined means "don't change"
  personio_client_id?: string;
  personio_client_secret?: string;
  personio_sync_interval_h?: 0 | 1 | 6 | 24;
  personio_sick_leave_type_id?: number[];
  personio_production_dept?: string[];
  personio_skill_attr_key?: string[];
}

/**
 * PUT /api/settings — persists all 8 editable fields atomically.
 * Returns the full Settings (10 fields including logo_url, logo_updated_at).
 * On non-2xx, throws Error with the backend-provided `detail` string so
 * the caller can surface it in a toast without extra parsing.
 */
export async function updateSettings(
  payload: SettingsUpdatePayload,
): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to save settings" }));
    throw new Error(formatDetail(err.detail) || "Failed to save settings");
  }
  return res.json();
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const loc = Array.isArray((d as { loc?: unknown }).loc)
            ? ((d as { loc: unknown[] }).loc.slice(1).join(".") as string)
            : "";
          const msg = (d as { msg?: string }).msg ?? JSON.stringify(d);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(d);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "";
}

/**
 * POST /api/settings/logo — uploads a PNG or SVG (max 1 MB client-side,
 * backend re-validates with nh3 SVG sanitization + magic-byte check).
 * Returns the full Settings with updated logo_url and logo_updated_at.
 */
export async function uploadLogo(file: File): Promise<Settings> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/settings/logo", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to upload logo" }));
    throw new Error(formatDetail(err.detail) || "Failed to upload logo");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase 13 — Personio options and sync test
// ---------------------------------------------------------------------------

export interface AbsenceTypeOption {
  id: number;
  name: string;
}

export interface PersonioOptions {
  absence_types: AbsenceTypeOption[];
  departments: string[];
  skill_attributes: string[];
  error: string | null;
}

export interface SyncTestResult {
  success: boolean;
  error: string | null;
}

/**
 * GET /api/settings/personio-options — fetches live absence types and
 * departments from Personio. Only called when hasCredentials is true.
 */
export async function fetchPersonioOptions(): Promise<PersonioOptions> {
  const res = await fetch("/api/settings/personio-options");
  if (!res.ok) throw new Error("Failed to fetch Personio options");
  return res.json();
}

/**
 * POST /api/sync/test — tests the Personio connection using the stored
 * credentials. Returns { success, error } — does not throw on API-level
 * failures (only on network/parse errors).
 */
export async function testPersonioConnection(): Promise<SyncTestResult> {
  const res = await fetch("/api/sync/test", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Connection test failed" }));
    throw new Error(formatDetail(err.detail) || "Connection test failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase 14 — Sync meta and trigger
// ---------------------------------------------------------------------------

export interface SyncMetaResponse {
  last_synced_at: string | null;
  last_sync_status: "ok" | "error" | null;
  last_sync_error: string | null;
}

export async function fetchSyncMeta(): Promise<SyncMetaResponse> {
  const res = await fetch("/api/sync/meta");
  if (!res.ok) throw new Error("Failed to fetch sync meta");
  return res.json();
}

export interface SyncResult {
  employees_synced: number;
  attendance_synced: number;
  absences_synced: number;
  status: "ok" | "error";
  error_message: string | null;
}

export async function triggerSync(): Promise<SyncResult> {
  const res = await fetch("/api/sync", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Sync failed" }));
    throw new Error(formatDetail(err.detail) || "Sync failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase 15 — HR KPIs
// ---------------------------------------------------------------------------

export interface HrKpiValue {
  value: number | null;
  is_configured: boolean;
  previous_period: number | null;
  previous_year: number | null;
}

export interface HrKpiResponse {
  overtime_ratio: HrKpiValue;
  sick_leave_ratio: HrKpiValue;
  fluctuation: HrKpiValue;
  skill_development: HrKpiValue;
  revenue_per_production_employee: HrKpiValue;
}

export async function fetchHrKpis(): Promise<HrKpiResponse> {
  const res = await fetch("/api/hr/kpis");
  if (!res.ok) throw new Error("Failed to fetch HR KPIs");
  return res.json();
}
