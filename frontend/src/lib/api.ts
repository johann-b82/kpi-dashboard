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
