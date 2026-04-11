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

export interface KpiSummary {
  total_revenue: number;
  avg_order_value: number;
  total_orders: number;
}

export interface ChartPoint {
  date: string; // ISO date string "YYYY-MM-DD"
  revenue: number;
}

export interface LatestUploadResponse {
  uploaded_at: string | null;
}

export async function fetchKpiSummary(
  start?: string,
  end?: string,
): Promise<KpiSummary> {
  const params = new URLSearchParams();
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  const qs = params.toString();
  const res = await fetch(`/api/kpis${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch KPI summary");
  return res.json();
}

export async function fetchChartData(
  start: string | undefined,
  end: string | undefined,
  granularity: "daily" | "weekly" | "monthly" = "monthly",
): Promise<ChartPoint[]> {
  const params = new URLSearchParams({ granularity });
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
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
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

/**
 * Payload for PUT /api/settings. Exactly 8 fields — logo bytes have their
 * own endpoint (Phase 4 D-05). All color_* fields must be in canonical
 * `oklch(L C H)` format; the backend's _OKLCH_RE regex rejects hex and
 * any string containing `;`, `}`, `{`, `url(`, `expression(`, or quotes.
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
