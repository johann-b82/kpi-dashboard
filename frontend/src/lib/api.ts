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
