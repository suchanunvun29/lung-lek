"use client";

import { ImportBatch } from "@/lib/types";
import { formatFileSize, formatThaiMonth } from "@/lib/importLabels";
import { StatusBadge } from "@/components/shared/status/StatusBadge";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-text-primary",
  warning: "text-status-warning",
  danger: "text-status-danger",
};

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold font-numeric ${TONE_CLASS[tone]}`}>
        {value.toLocaleString("th-TH")}
      </p>
    </div>
  );
}

export interface ImportBatchSummaryProps {
  batch: ImportBatch;
}

export function ImportBatchSummary({ batch }: ImportBatchSummaryProps) {
  const ignoredSheets = (batch.sheetsFound ?? []).filter(
    (sheet) => !(batch.sheetsImported ?? []).includes(sheet)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{batch.fileName}</h2>
          <p className="mt-1 text-xs text-text-muted">
            {formatFileSize(batch.fileSizeBytes)} · อัปโหลดโดย {batch.uploadedBy.displayName} ·{" "}
            {new Date(batch.startedAt).toLocaleString("th-TH")}
          </p>
        </div>
        <div>
          <StatusBadge status={{ type: "importStatus", value: batch.status }} />
        </div>
      </div>

      {batch.errorMessage && (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
          {batch.errorMessage}
        </p>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <StatCard label="ทั้งหมด" value={batch.totalRows} />
        <StatCard label="นำเข้าใหม่" value={batch.insertedRows} />
        <StatCard label="อัปเดต" value={batch.updatedRows} />
        <StatCard label="ข้าม" value={batch.skippedRows} tone="warning" />
        <StatCard label="ผิดพลาด" value={batch.errorRows} tone="danger" />
        {batch.removedRows > 0 && (
          <StatCard label="ลบออก" value={batch.removedRows} tone="danger" />
        )}
      </div>

      {batch.periodsTouched && batch.periodsTouched.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            งวดที่มีการแก้ไขข้อมูล
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {batch.periodsTouched.map((period) => (
              <span
                key={`${period.year}-${period.month}`}
                className="rounded-full bg-surface-subtle border border-border px-3 py-1 text-xs font-medium text-text-secondary"
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

export default ImportBatchSummary;
