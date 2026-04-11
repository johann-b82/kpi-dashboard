import { useDropzone } from "react-dropzone";
import type { FileRejection } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/api";
import type { UploadResponse } from "@/lib/api";
import { kpiKeys } from "@/lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DropZoneProps {
  onUploadSuccess: (data: UploadResponse) => void;
  onUploadError: (data: UploadResponse) => void;
}

export function DropZone({ onUploadSuccess, onUploadError }: DropZoneProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectedExt, setRejectedExt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      const filename = data.filename;
      if (data.status === "partial") {
        toast.success(t("upload_success_title"), {
          description: t("upload_partial_body", {
            filename,
            count: data.row_count,
            errors: data.error_count,
          }),
        });
      } else {
        toast.success(t("upload_success_title"), {
          description: t("upload_success_body", {
            filename,
            count: data.row_count,
          }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: kpiKeys.all });

      if (data.status === "success") {
        onUploadSuccess(data);
      } else {
        // "partial" and "failed" both route to onUploadError so ErrorList stays visible
        onUploadError(data);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setRejectedExt(null);
      if (fileRejections.length > 0) {
        const name = fileRejections[0].file.name;
        setRejectedExt(name.split(".").pop() ?? name);
        return;
      }
      if (acceptedFiles.length > 0) {
        mutation.mutate(acceptedFiles[0]);
      }
    },
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    disabled: mutation.isPending,
    noClick: true,
    noKeyboard: true,
  });

  let containerClass =
    "flex flex-col items-center justify-center gap-3 min-h-[160px] rounded-md border-2 border-dashed transition-colors p-6";

  if (mutation.isPending) {
    containerClass += " bg-slate-100 border-slate-300 cursor-not-allowed";
  } else if (isDragActive) {
    containerClass += " bg-blue-50 border-solid border-blue-600";
  } else {
    containerClass += " bg-slate-100 border-slate-300";
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div {...getRootProps({ className: containerClass })}>
          <input {...getInputProps()} />

          {mutation.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm text-slate-500">{t("processing")}</span>
            </div>
          ) : (
            <>
              <p
                className={`text-sm font-medium ${isDragActive ? "text-blue-600" : "text-slate-600"}`}
              >
                {t("dropzone_prompt")}
              </p>
              <p className="text-xs text-slate-400">{t("dropzone_or")}</p>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={open}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {t("browse_button")}
              </Button>
              <p className="text-xs text-slate-400">{t("accepted_formats")}</p>
            </>
          )}
        </div>

        {rejectedExt && (
          <p className="px-4 py-2 text-sm text-red-600">
            {t("invalid_file_type", { ext: rejectedExt })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
