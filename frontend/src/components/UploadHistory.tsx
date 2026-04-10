import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { getUploads, deleteUpload } from "@/lib/api";
import type { UploadBatchSummary } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

function StatusBadge({ status }: { status: UploadBatchSummary["status"] }) {
  if (status === "success") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">
        {status}
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-yellow-400 text-slate-900 hover:bg-yellow-400">
        {status}
      </Badge>
    );
  }
  // failed
  return (
    <Badge className="bg-red-600 text-white hover:bg-red-600">
      {status}
    </Badge>
  );
}

export function UploadHistory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<UploadBatchSummary | null>(null);

  const { data: uploads, isLoading } = useQuery({
    queryKey: ["uploads"],
    queryFn: getUploads,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  const columnHeaderClass = "uppercase text-xs tracking-wider text-slate-500";

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-10 w-full rounded animate-pulse bg-slate-200"
          />
        ))}
      </div>
    );
  }

  if (!uploads || uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="text-base font-semibold text-slate-700">
          {t("empty_title")}
        </p>
        <p className="text-sm text-slate-500">{t("empty_body")}</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={columnHeaderClass}>{t("col_filename")}</TableHead>
            <TableHead className={columnHeaderClass}>{t("col_uploaded_at")}</TableHead>
            <TableHead className={columnHeaderClass}>{t("col_rows")}</TableHead>
            <TableHead className={columnHeaderClass}>{t("col_status")}</TableHead>
            <TableHead className={columnHeaderClass}>{t("col_errors")}</TableHead>
            <TableHead className={columnHeaderClass + " w-12"} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell className="text-sm font-medium">{batch.filename}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {new Date(batch.uploaded_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{batch.row_count}</TableCell>
              <TableCell>
                <StatusBadge status={batch.status} />
              </TableCell>
              <TableCell
                className={`text-sm ${batch.error_count === 0 ? "text-slate-400" : "text-slate-700"}`}
              >
                {batch.error_count}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedBatch(batch)}
                  aria-label={t("delete_title")}
                  className="hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={!!selectedBatch}
        onOpenChange={(open) => {
          if (!open) setSelectedBatch(null);
        }}
        batch={selectedBatch}
        onConfirm={() => {
          if (selectedBatch) {
            deleteMutation.mutate(selectedBatch.id);
            setSelectedBatch(null);
          }
        }}
      />
    </>
  );
}
