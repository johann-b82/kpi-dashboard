import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { DropZone } from "@/components/DropZone";
import { ErrorList } from "@/components/ErrorList";
import { UploadHistory } from "@/components/UploadHistory";
import type { ValidationErrorDetail } from "@/lib/api";

export function UploadPage() {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<ValidationErrorDetail[]>([]);

  return (
    <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
      <h1 className="text-xl font-semibold">{t("page_title")}</h1>

      {errors.length > 0 && <ErrorList errors={errors} />}

      <Separator className="my-8" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <DropZone
            onUploadSuccess={() => setErrors([])}
            onUploadError={(data) => setErrors(data.errors)}
          />
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("history_title")}</h2>
          <UploadHistory />
        </div>
      </div>
    </div>
  );
}
