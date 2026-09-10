"use client";

import { useCallback, useMemo, useState } from "react";
import { Hospital } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Input } from "@/components/ui/input";

export interface HospitalTableProps {
  hospitals: Hospital[];
  canEdit: boolean;
  onToggle: (hospital: Hospital, isPreExistingCustomer: boolean) => Promise<void>;
  /** T-UX-025 — server pagination, owned by the screen. */
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function HospitalTable({
  hospitals,
  canEdit,
  onToggle,
  loading = false,
  page,
  pageSize,
  total,
  onPageChange,
  search,
  onSearchChange,
}: HospitalTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleToggle = useCallback(async (hospital: Hospital) => {
    setBusyId(hospital.id);
    try {
      await onToggle(hospital, !hospital.isPreExistingCustomer);
    } finally {
      setBusyId(null);
    }
  }, [onToggle]);

  const columns = useMemo<DataTableColumn<Hospital>[]>(() => [
    {
      key: "displayName",
      header: "ชื่อโรงพยาบาล",
      priority: 1,
      mobileRole: "identity",
      sortable: true,
      sortValue: (h) => h.displayName,
      render: (hospital) => (
        <span className="font-medium text-text-primary">{hospital.displayName}</span>
      ),
    },
    {
      key: "province",
      header: "จังหวัด",
      priority: 2,
      mobileRole: "meta",
      sortable: true,
      sortValue: (h) => h.province ?? "",
      render: (hospital) => (
        <span className="text-text-secondary">{hospital.province ?? "—"}</span>
      ),
    },
    {
      key: "nameInFile",
      header: "ชื่อในไฟล์นำเข้า",
      priority: 3,
      mobileRole: "meta",
      sortable: true,
      sortValue: (h) => h.nameInFile,
      render: (hospital) => (
        <span className="text-text-muted">{hospital.nameInFile}</span>
      ),
    },
    {
      key: "isPreExistingCustomer",
      header: "เป็นลูกค้าเดิมก่อนใช้ระบบ",
      priority: 1,
      mobileRole: "meta",
      sortable: true,
      sortValue: (h) => (h.isPreExistingCustomer ? 1 : 0),
      render: (hospital) => (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hospital.isPreExistingCustomer}
            disabled={!canEdit || busyId === hospital.id}
            onChange={() => void handleToggle(hospital)}
            aria-label={`สถานะลูกค้าเดิมของ ${hospital.displayName}`}
            className="h-4 w-4 rounded border-border text-primary disabled:opacity-50 cursor-pointer"
          />
          <span className="text-text-secondary text-sm">
            {hospital.isPreExistingCustomer ? "ใช่ (ลูกค้าเดิม)" : "ไม่ใช่ (นับเป็นลูกค้าใหม่ได้)"}
          </span>
        </label>
      ),
    },
  ], [canEdit, busyId, handleToggle]);

  const serverPaginated = typeof page === "number" && typeof pageSize === "number" && typeof total === "number" && !!onPageChange;

  return (
    <div>
      {/* Server-paginated mode: DataTable hides its own search UI, so the screen
          provides the input and sends `q` with the page request (T-UX-025). */}
      {serverPaginated && onSearchChange && (
        <div className="mb-3">
          <Input
            type="search"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อโรงพยาบาล, จังหวัด หรือชื่อในไฟล์…"
            aria-label="ค้นหาชื่อโรงพยาบาล, จังหวัด หรือชื่อในไฟล์"
            className="w-full max-w-xs"
          />
        </div>
      )}
      <DataTable
        caption="ตารางโรงพยาบาล"
        density="comfortable"
        columns={columns}
        rows={hospitals}
        getRowId={(h) => h.id}
        loading={loading}
        serverPaginated={serverPaginated}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        searchable={!serverPaginated}
        searchPlaceholder="ค้นหาชื่อโรงพยาบาล, จังหวัด หรือชื่อในไฟล์…"
        searchPredicate={(h, query) =>
          h.displayName.toLowerCase().includes(query) ||
          h.nameInFile.toLowerCase().includes(query) ||
          (h.province?.toLowerCase().includes(query) ?? false)
        }
        emptyTitle="ยังไม่มีข้อมูลโรงพยาบาล"
        emptyDescription="ยังไม่พบข้อมูลโรงพยาบาลในระบบ"
      />
    </div>
  );
}

export default HospitalTable;
