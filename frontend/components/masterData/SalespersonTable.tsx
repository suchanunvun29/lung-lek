"use client";

import { useState } from "react";
import { AppUser, Salesperson } from "@/lib/types";

interface SalespersonTableProps {
  salespeople: Salesperson[];
  linkableUsers: AppUser[];
  canEdit: boolean;
  onLink: (salesperson: Salesperson, userId: string | null) => Promise<void>;
  onEmploymentDate: (salesperson: Salesperson, employmentEndedAt: string | null) => Promise<void>;
}

const UNLINKED_VALUE = "";

export default function SalespersonTable({
  salespeople,
  linkableUsers,
  canEdit,
  onLink,
  onEmploymentDate,
}: SalespersonTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleChange(salesperson: Salesperson, value: string) {
    setBusyId(salesperson.id);
    try {
      await onLink(salesperson, value === UNLINKED_VALUE ? null : value);
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmploymentChange(salesperson: Salesperson, value: string) {
    setBusyId(salesperson.id);
    try {
      // OQ20: manager fills the real departure date in themselves; empty = unknown/still employed.
      await onEmploymentDate(salesperson, value === "" ? null : value);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">
        การกรอกวันที่พ้นสภาพเป็นข้อมูลแสดงผลเท่านั้น — ไม่ปิดการเป็นผู้ดูแลเขตอัตโนมัติ (ปิดได้ในหน้าจัดการผู้ดูแลเขต)
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">ชื่อพนักงานขาย</th>
              <th className="px-4 py-3">ชื่อในไฟล์นำเข้า</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">วันที่พ้นสภาพ</th>
              <th className="px-4 py-3">บัญชีผู้ใช้ที่ผูก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {salespeople.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  ยังไม่มีข้อมูลพนักงานขาย
                </td>
              </tr>
            )}
            {salespeople.map((salesperson) => {
              const availableOptions = linkableUsers.filter(
                (u) => u.role === "SALESPERSON" && (!u.salesperson || u.salesperson.id === salesperson.id)
              );
              const ended = salesperson.employmentEndedAt;
              return (
                <tr key={salesperson.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{salesperson.displayName}</td>
                  <td className="px-4 py-3 text-zinc-500">{salesperson.nameInFile}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        salesperson.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {salesperson.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                    {ended && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        พ้นสภาพ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <input
                        type="date"
                        value={ended ?? ""}
                        disabled={busyId === salesperson.id}
                        onChange={(e) => void handleEmploymentChange(salesperson, e.target.value)}
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-50"
                      />
                    ) : (
                      <span className="text-zinc-600">{ended ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        value={salesperson.userId ?? UNLINKED_VALUE}
                        disabled={busyId === salesperson.id}
                        onChange={(e) => void handleChange(salesperson, e.target.value)}
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value={UNLINKED_VALUE}>— ยังไม่ผูกบัญชี —</option>
                        {availableOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.email})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-zinc-600">
                        {salesperson.user
                          ? `${salesperson.user.displayName} (${salesperson.user.email})`
                          : "ยังไม่ผูกบัญชี"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
