"use client";

import { useCallback, useMemo, useState } from "react";
import { AppUser, Salesperson } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";

export interface SalespersonTableProps {
  salespeople: Salesperson[];
  linkableUsers: AppUser[];
  canEdit: boolean;
  onLink: (salesperson: Salesperson, userId: number | null) => Promise<void>;
  onEmploymentDate: (salesperson: Salesperson, employmentEndedAt: string | null) => Promise<void>;
}

const UNLINKED_VALUE = "";

export function SalespersonTable({
  salespeople,
  linkableUsers,
  canEdit,
  onLink,
  onEmploymentDate,
}: SalespersonTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleChange = useCallback(async (salesperson: Salesperson, value: string) => {
    setBusyId(salesperson.id);
    try {
      await onLink(salesperson, value === UNLINKED_VALUE ? null : Number(value));
    } finally {
      setBusyId(null);
    }
  }, [onLink]);

  const handleEmploymentChange = useCallback(async (salesperson: Salesperson, value: string) => {
    setBusyId(salesperson.id);
    try {
      // OQ20: manager fills the real departure date in themselves; empty = unknown/still employed.
      await onEmploymentDate(salesperson, value === "" ? null : value);
    } finally {
      setBusyId(null);
    }
  }, [onEmploymentDate]);

  const columns = useMemo<DataTableColumn<Salesperson>[]>(() => [
    {
      key: "displayName",
      header: "ชื่อพนักงานขาย",
      priority: 1,
      mobileRole: "identity",
      sortable: true,
      sortValue: (sp) => sp.displayName,
      render: (sp) => <span className="font-medium text-text-primary">{sp.displayName}</span>,
    },
    {
      key: "nameInFile",
      header: "ชื่อในไฟล์นำเข้า",
      priority: 2,
      mobileRole: "meta",
      sortable: true,
      sortValue: (sp) => sp.nameInFile,
      render: (sp) => <span className="text-text-muted">{sp.nameInFile}</span>,
    },
    {
      key: "status",
      header: "สถานะ",
      priority: 1,
      mobileRole: "meta",
      sortable: true,
      sortValue: (sp) => (sp.isActive ? (sp.employmentEndedAt ? 2 : 1) : 3),
      render: (sp) => {
        const ended = sp.employmentEndedAt;
        return (
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                sp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {sp.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
            </span>
            {ended && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                พ้นสภาพ
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "employmentEndedAt",
      header: "วันที่พ้นสภาพ",
      priority: 2,
      mobileRole: "meta",
      sortable: true,
      sortValue: (sp) => sp.employmentEndedAt ?? "",
      render: (sp) => {
        const ended = sp.employmentEndedAt;
        if (!canEdit) {
          return <span className="text-text-secondary">{ended ?? "—"}</span>;
        }
        return (
          <input
            type="date"
            value={ended ?? ""}
            disabled={busyId === sp.id}
            onChange={(e) => void handleEmploymentChange(sp, e.target.value)}
            aria-label={`วันที่พ้นสภาพของ ${sp.displayName}`}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary disabled:opacity-50"
          />
        );
      },
    },
    {
      key: "userLink",
      header: "บัญชีผู้ใช้ที่ผูก",
      priority: 1,
      mobileRole: "meta",
      sortable: true,
      sortValue: (sp) => sp.user?.displayName ?? "",
      render: (sp) => {
        if (!canEdit) {
          return (
            <span className="text-text-secondary">
              {sp.user
                ? `${sp.user.displayName} (${sp.user.email})`
                : "ยังไม่ผูกบัญชี"}
            </span>
          );
        }
        const availableOptions = linkableUsers.filter(
          (u) => u.role === "SALESPERSON" && (!u.salesperson || u.salesperson.id === sp.id)
        );
        return (
          <select
            value={sp.userId ?? UNLINKED_VALUE}
            disabled={busyId === sp.id}
            onChange={(e) => void handleChange(sp, e.target.value)}
            aria-label={`ผูกบัญชีผู้ใช้สำหรับ ${sp.displayName}`}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary disabled:opacity-50"
          >
            <option value={UNLINKED_VALUE}>— ยังไม่ผูกบัญชี —</option>
            {availableOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        );
      },
    },
  ], [canEdit, busyId, linkableUsers, handleChange, handleEmploymentChange]);

  return (
    <div>
      <p className="mb-2 text-xs text-text-muted">
        การกรอกวันที่พ้นสภาพเป็นข้อมูลแสดงผลเท่านั้น — ไม่ปิดการเป็นผู้ดูแลเขตอัตโนมัติ (ปิดได้ในหน้าจัดการผู้ดูแลเขต)
      </p>
      <DataTable
        caption="ตารางพนักงานขาย"
        density="comfortable"
        columns={columns}
        rows={salespeople}
        getRowId={(sp) => sp.id}
        searchable
        searchPlaceholder="ค้นหาชื่อพนักงาน หรือชื่อในไฟล์…"
        searchPredicate={(sp, query) =>
          sp.displayName.toLowerCase().includes(query) ||
          sp.nameInFile.toLowerCase().includes(query) ||
          (sp.user?.displayName?.toLowerCase().includes(query) ?? false) ||
          (sp.user?.email?.toLowerCase().includes(query) ?? false)
        }
        emptyTitle="ยังไม่มีข้อมูลพนักงานขาย"
        emptyDescription="ยังไม่พบข้อมูลพนักงานขายในระบบ"
      />
    </div>
  );
}

export default SalespersonTable;
