import { apiClient } from "./apiClient";

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
  return apiClient<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getUploads(): Promise<UploadBatchSummary[]> {
  return apiClient<UploadBatchSummary[]>("/api/uploads");
}

export async function deleteUpload(id: number): Promise<void> {
  await apiClient<void>(`/api/uploads/${id}`, { method: "DELETE" });
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
  return apiClient<KpiSummary>(`/api/kpis${qs ? `?${qs}` : ""}`);
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
  return apiClient<ChartResponse>(`/api/kpis/chart?${params.toString()}`);
}

export async function fetchLatestUpload(): Promise<LatestUploadResponse> {
  return apiClient<LatestUploadResponse>("/api/kpis/latest-upload");
}

export interface Settings {
  color_primary: string;
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  logo_url: string | null;
  logo_updated_at: string | null;
  // Phase 13 Personio fields
  personio_has_credentials: boolean;
  personio_sync_interval_h: number;
  personio_sick_leave_type_id: number[];
  personio_production_dept: string[];
  personio_skill_attr_key: string[];
  // HR KPI targets
  target_overtime_ratio: number | null;
  target_sick_leave_ratio: number | null;
  target_fluctuation: number | null;
  target_revenue_per_employee: number | null;
}

export async function fetchSettings(): Promise<Settings> {
  return apiClient<Settings>("/api/settings");
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
  // Phase 13 Personio fields — undefined means "don't change"
  personio_client_id?: string;
  personio_client_secret?: string;
  personio_sync_interval_h?: 0 | 1 | 6 | 24;
  personio_sick_leave_type_id?: number[];
  personio_production_dept?: string[];
  personio_skill_attr_key?: string[];
  target_overtime_ratio?: number | null;
  target_sick_leave_ratio?: number | null;
  target_fluctuation?: number | null;
  target_revenue_per_employee?: number | null;
}

/**
 * PUT /api/settings — persists all 8 editable fields atomically.
 * apiClient preserves the legacy `err.detail` error shape so existing
 * callers (settings form toasts) keep working.
 */
export async function updateSettings(
  payload: SettingsUpdatePayload,
): Promise<Settings> {
  return apiClient<Settings>("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/settings/logo — uploads a PNG or SVG. FormData body; apiClient
 * leaves Content-Type unset so the browser writes the multipart boundary.
 */
export async function uploadLogo(file: File): Promise<Settings> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<Settings>("/api/settings/logo", {
    method: "POST",
    body: formData,
  });
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
  return apiClient<PersonioOptions>("/api/settings/personio-options");
}

/**
 * POST /api/sync/test — tests the Personio connection using the stored
 * credentials. Returns { success, error } — does not throw on API-level
 * failures (only on network/parse errors).
 */
export async function testPersonioConnection(): Promise<SyncTestResult> {
  return apiClient<SyncTestResult>("/api/sync/test", { method: "POST" });
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
  return apiClient<SyncMetaResponse>("/api/sync/meta");
}

export interface SyncResult {
  employees_synced: number;
  attendance_synced: number;
  absences_synced: number;
  status: "ok" | "error";
  error_message: string | null;
}

export async function triggerSync(): Promise<SyncResult> {
  return apiClient<SyncResult>("/api/sync", { method: "POST" });
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
  return apiClient<HrKpiResponse>("/api/hr/kpis");
}

export interface HrKpiHistoryPoint {
  month: string;
  overtime_ratio: number | null;
  sick_leave_ratio: number | null;
  fluctuation: number | null;
  revenue_per_production_employee: number | null;
}

export async function fetchHrKpiHistory(): Promise<HrKpiHistoryPoint[]> {
  return apiClient<HrKpiHistoryPoint[]>("/api/hr/kpis/history");
}

// --------------------------------------------------------------------------
// Data table types and fetchers
// --------------------------------------------------------------------------

export interface SalesRecordRow {
  id: number;
  order_number: string;
  customer_name: string | null;
  city: string | null;
  order_date: string | null;
  total_value: number | null;
  remaining_value: number | null;
  responsible_person: string | null;
  project_name: string | null;
  status_code: number | null;
}

export async function fetchSalesRecords(params?: {
  start_date?: string;
  end_date?: string;
  customer?: string;
  search?: string;
}): Promise<SalesRecordRow[]> {
  const q = new URLSearchParams();
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);
  if (params?.customer) q.set("customer", params.customer);
  if (params?.search) q.set("search", params.search);
  return apiClient<SalesRecordRow[]>(`/api/data/sales?${q}`);
}

export interface EmployeeRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  termination_date: string | null;
  weekly_working_hours: number | null;
  total_hours: number;
  overtime_hours: number;
  overtime_ratio: number | null;
}

export async function fetchEmployees(params?: {
  department?: string;
  status?: string;
  search?: string;
}): Promise<EmployeeRow[]> {
  const q = new URLSearchParams();
  if (params?.department) q.set("department", params.department);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  return apiClient<EmployeeRow[]>(`/api/data/employees?${q}`);
}
