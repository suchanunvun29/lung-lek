"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { listImportBatches } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { ImportBatch, ImportStatus } from "@/lib/types";
import { IMPORT_STATUS_LABEL_TH, formatFileSize } from "@/lib/importLabels";
import { useAuthStore } from "@/store/useAuthStore";
import { DataTable, DataTableColumn } from "@/components/shared/data-table/DataTable";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { FilterBar, type FilterChip } from "@/components/shared/filters/FilterBar";
import { StatusBadge } from "@/components/shared/status/StatusBadge";
import { Select } from "@/components/ui/select";

type StatusFilter = ImportStatus | "ALL";

const COLUMNS: DataTableColumn<ImportBatch>[] = [
  {
    key: "fileName",
    header: "ไฟล์",
    sortable: true,
    sortValue: (batch) => batch.fileName,
    priority: 1,
    mobileRole: "identity",
    render: (batch) => (
      <Link
        href={`/import-batches/${batch.id}`}
        className="group block focus:outline-none"
      >
        <p className="font-medium text-text-primary group-hover:text-primary group-hover:underline">
          {batch.fileName}
        </p>
        <p className="text-xs text-text-muted">{formatFileSize(batch.fileSizeBytes)}</p>
      </Link>
    ),
  },
  {
    key: "status",
    header: "สถานะ",
    sortable: true,
    sortValue: (batch) => batch.status,
    priority: 1,
    mobileRole: "meta",
    render: (batch) => (
      <StatusBadge status={{ type: "importStatus", value: batch.status }} />
    ),
  },
  {
    key: "startedAt",
    header: "เวลา",
    sortable: true,
    sortValue: (batch) => new Date(batch.startedAt).getTime(),
    priority: 2,
    mobileRole: "meta",
    render: (batch) => new Date(batch.startedAt).toLocaleString("th-TH"),
  },
  {
    key: "uploadedBy",
    header: "อัปโหลดโดย",
    sortable: true,
    priority: 2,
    mobileRole: "meta",
    sortValue: (batch) => batch.uploadedBy.displayName,
    render: (batch) => batch.uploadedBy.displayName,
  },
  {
    key: "rows",
    header: "นำเข้า/อัปเดต/ผิดพลาด",
    numeric: true,
    sortable: true,
    priority: 3,
    mobileRole: "metric",
    sortValue: (batch) => batch.insertedRows,
    render: (batch) => `${batch.insertedRows} / ${batch.updatedRows} / ${batch.errorRows}`,
  },
  {
    key: "removedRows",
    header: "ลบออก",
    numeric: true,
    sortable: true,
    priority: 3,
    mobileRole: "meta",
    sortValue: (batch) => batch.removedRows,
    render: (batch) => batch.removedRows,
  },
  {
    key: "detail",
    header: "รายละเอียด",
    priority: 1,
    mobileRole: "hidden",
    render: (batch) => (
      <Link
        href={`/import-batches/${batch.id}`}
        className="text-sm font-medium text-primary hover:underline"
      >
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

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

  // Safe Automation: default sort newest first
  const sortedBatches = useMemo(() => {
    return [...batches].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }, [batches]);

  const filteredBatches = useMemo(() => {
    if (statusFilter === "ALL") return sortedBatches;
    return sortedBatches.filter((batch) => batch.status === statusFilter);
  }, [sortedBatches, statusFilter]);

  const chips = useMemo<FilterChip[]>(() => {
    if (statusFilter === "ALL") return [];
    return [
      {
        key: "status",
        label: `สถานะ: ${IMPORT_STATUS_LABEL_TH[statusFilter]}`,
        onRemove: () => setStatusFilter("ALL"),
      },
    ];
  }, [statusFilter]);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="ประวัติการนำเข้าข้อมูล"
        description="ประวัติและผลการประมวลผลของไฟล์นำเข้ายอดขายทั้งหมด"
      />

      <div className="mb-6">
        <FilterBar chips={chips} onReset={() => setStatusFilter("ALL")}>
          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium text-text-muted mb-1">
              สถานะการนำเข้า
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="SUCCESS">{IMPORT_STATUS_LABEL_TH.SUCCESS}</option>
              <option value="PARTIAL">{IMPORT_STATUS_LABEL_TH.PARTIAL}</option>
              <option value="FAILED">{IMPORT_STATUS_LABEL_TH.FAILED}</option>
              <option value="PROCESSING">{IMPORT_STATUS_LABEL_TH.PROCESSING}</option>
            </Select>
          </div>
        </FilterBar>
      </div>

      <DataTable
        caption="ประวัติการนำเข้าข้อมูล"
        columns={COLUMNS}
        rows={filteredBatches}
        getRowId={(batch) => batch.id}
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoadError(null);
          setLoading(true);
          setReloadKey((key) => key + 1);
        }}
        emptyTitle="ยังไม่มีประวัติการนำเข้าข้อมูล"
        emptyDescription={
          statusFilter !== "ALL"
            ? "ไม่พบประวัติการนำเข้าที่มีสถานะตรงกับตัวกรอง"
            : "เมื่อมีการอัปโหลดไฟล์นำเข้าข้อมูล รายการประวัติและผลการประมวลผลจะปรากฏที่นี่"
        }
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
