"use client";

import Link from "next/link";
import { useState } from "react";
import { listImportBatches } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { ImportBatch } from "@/lib/types";
import { IMPORT_STATUS_BADGE_CLASS, IMPORT_STATUS_LABEL_TH, formatFileSize } from "@/lib/importLabels";
import { useAuthStore } from "@/store/useAuthStore";
import { DataTable, DataTableColumn } from "@/components/shared/data-table/DataTable";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";

const COLUMNS: DataTableColumn<ImportBatch>[] = [
  {
    key: "fileName",
    header: "ไฟล์",
    sortable: true,
    priority: 1,
    mobileRole: "identity",
    render: (batch) => (
      <div>
        <p className="font-medium text-text-primary">{batch.fileName}</p>
        <p className="text-xs text-text-muted">{formatFileSize(batch.fileSizeBytes)}</p>
      </div>
    ),
  },
  {
    key: "uploadedBy",
    header: "อัปโหลดโดย",
    priority: 2,
    mobileRole: "meta",
    sortValue: (batch) => batch.uploadedBy.displayName,
    render: (batch) => batch.uploadedBy.displayName,
  },
  {
    key: "startedAt",
    header: "เวลา",
    sortable: true,
    priority: 2,
    mobileRole: "meta",
    render: (batch) => new Date(batch.startedAt).toLocaleString("th-TH"),
  },
  {
    key: "status",
    header: "สถานะ",
    priority: 1,
    mobileRole: "meta",
    render: (batch) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${IMPORT_STATUS_BADGE_CLASS[batch.status]}`}
      >
        {IMPORT_STATUS_LABEL_TH[batch.status]}
      </span>
    ),
  },
  {
    key: "rows",
    header: "นำเข้า/อัปเดต/ผิดพลาด",
    numeric: true,
    priority: 3,
    mobileRole: "metric",
    sortValue: (batch) => batch.insertedRows,
    render: (batch) => `${batch.insertedRows} / ${batch.updatedRows} / ${batch.errorRows}`,
  },
  {
    key: "removedRows",
    header: "ลบออก",
    numeric: true,
    priority: 3,
    mobileRole: "meta",
    render: (batch) => batch.removedRows,
  },
  {
    key: "detail",
    header: "รายละเอียด",
    priority: 1,
    mobileRole: "hidden",
    render: (batch) => (
      <Link href={`/import-batches/${batch.id}`} className="text-zinc-700 hover:underline">
        ดูรายละเอียด
      </Link>
    ),
  },
];

export default function ImportBatchesPage() {
  const token = useAuthStore((state) => state.token);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await listImportBatches(token, signal);
        if (signal.aborted) return;
        setBatches(data.importBatches);
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลดประวัติการนำเข้าไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [token, reloadKey]
  );

  return (
    <PageContainer width="wide">
      <PageHeader title="ประวัติการนำเข้าข้อมูล" />

      <DataTable
        className="mt-6"
        caption="ประวัติการนำเข้าข้อมูล"
        columns={COLUMNS}
        rows={batches}
        getRowId={(batch) => batch.id}
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoadError(null);
          setLoading(true);
          setReloadKey((key) => key + 1);
        }}
        emptyTitle="ยังไม่มีประวัติการนำเข้าข้อมูล"
        emptyDescription="เมื่อมีการอัปโหลดไฟล์นำเข้าข้อมูล รายการประวัติและผลการประมวลผลจะปรากฏที่นี่"
        searchable
        searchPlaceholder="ค้นหาชื่อไฟล์หรือผู้อัปโหลด…"
        searchPredicate={(batch, query) =>
          batch.fileName.toLowerCase().includes(query) ||
          batch.uploadedBy.displayName.toLowerCase().includes(query)
        }
        rowAction={(batch) => (
          <Link
            href={`/import-batches/${batch.id}`}
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            ดูรายละเอียด
          </Link>
        )}
      />
    </PageContainer>
  );
}
