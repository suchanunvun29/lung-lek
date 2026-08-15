"use client";

import { useState } from "react";
import { Hospital } from "@/lib/types";

interface HospitalTableProps {
  hospitals: Hospital[];
  canEdit: boolean;
  onToggle: (hospital: Hospital, isPreExistingCustomer: boolean) => Promise<void>;
}

export default function HospitalTable({ hospitals, canEdit, onToggle }: HospitalTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(hospital: Hospital) {
    setBusyId(hospital.id);
    try {
      await onToggle(hospital, !hospital.isPreExistingCustomer);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">ชื่อโรงพยาบาล</th>
            <th className="px-4 py-3">จังหวัด</th>
            <th className="px-4 py-3">ชื่อในไฟล์นำเข้า</th>
            <th className="px-4 py-3">เป็นลูกค้าเดิมก่อนใช้ระบบ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {hospitals.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                ยังไม่มีข้อมูลโรงพยาบาล
              </td>
            </tr>
          )}
          {hospitals.map((hospital) => (
            <tr key={hospital.id}>
              <td className="px-4 py-3 font-medium text-zinc-900">{hospital.displayName}</td>
              <td className="px-4 py-3 text-zinc-600">{hospital.province ?? "-"}</td>
              <td className="px-4 py-3 text-zinc-500">{hospital.nameInFile}</td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hospital.isPreExistingCustomer}
                    disabled={!canEdit || busyId === hospital.id}
                    onChange={() => void handleToggle(hospital)}
                    className="h-4 w-4 rounded border-zinc-300 disabled:opacity-50"
                  />
                  <span className="text-zinc-700">
                    {hospital.isPreExistingCustomer ? "ใช่ (ลูกค้าเดิม)" : "ไม่ใช่ (นับเป็นลูกค้าใหม่ได้)"}
                  </span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
