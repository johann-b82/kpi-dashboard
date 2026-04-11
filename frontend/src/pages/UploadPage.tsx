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
    <div className="max-w-[800px] mx-auto px-4 py-12">
      <h1 className="text-xl font-semibold mb-6">{t("page_title")}</h1>

      <DropZone
        onUploadSuccess={() => setErrors([])}
        onUploadError={(data) => setErrors(data.errors)}
      />

      {errors.length > 0 && (
        <div className="mt-4">
          <ErrorList errors={errors} />
        </div>
      )}

      <Separator className="my-8" />

      <h2 className="text-xl font-semibold mb-4">{t("history_title")}</h2>

      <UploadHistory />
    </div>
  );
}
