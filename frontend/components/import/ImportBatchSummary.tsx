import { ImportBatch } from "@/lib/types";
import {
  IMPORT_STATUS_BADGE_CLASS,
  IMPORT_STATUS_LABEL_TH,
  formatFileSize,
  formatThaiMonth,
} from "@/lib/importLabels";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-zinc-900",
  warning: "text-amber-600",
  danger: "text-red-600",
};

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONE_CLASS[tone]}`}>{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

interface ImportBatchSummaryProps {
  batch: ImportBatch;
}

export default function ImportBatchSummary({ batch }: ImportBatchSummaryProps) {
  const ignoredSheets = (batch.sheetsFound ?? []).filter(
    (sheet) => !(batch.sheetsImported ?? []).includes(sheet)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-900">{batch.fileName}</p>
          <p className="text-xs text-zinc-500">
            {formatFileSize(batch.fileSizeBytes)} · อัปโหลดโดย {batch.uploadedBy.displayName} ·{" "}
            {new Date(batch.startedAt).toLocaleString("th-TH")}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${IMPORT_STATUS_BADGE_CLASS[batch.status]}`}
        >
          {IMPORT_STATUS_LABEL_TH[batch.status]}
        </span>
      </div>

      {batch.errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {batch.errorMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="ทั้งหมด" value={batch.totalRows} />
        <StatCard label="นำเข้าใหม่" value={batch.insertedRows} />
        <StatCard label="อัปเดต" value={batch.updatedRows} />
        <StatCard label="ข้าม" value={batch.skippedRows} tone="warning" />
        <StatCard label="ผิดพลาด" value={batch.errorRows} tone="danger" />
      </div>

      {batch.periodsTouched && batch.periodsTouched.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">งวดที่มีการแก้ไขข้อมูล</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {batch.periodsTouched.map((period) => (
              <span
                key={`${period.year}-${period.month}`}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
              >
                {formatThaiMonth(period.month)} {period.year}
              </span>
            ))}
          </div>
        </div>
      )}

      {ignoredSheets.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ไฟล์นี้มี sheet อื่นที่ไม่ได้ถูกนำเข้า (นำเข้าเฉพาะ sheet แรกเท่านั้น): {ignoredSheets.join(", ")}
        </p>
      )}
    </div>
  );
}
