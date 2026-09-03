"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { copyTargets, CopyTargetsResult } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatThaiMonth } from "@/lib/importLabels";
import { Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface CopyTargetsModalProps {
  year: number;
  salespeople: Salesperson[];
  onClose: () => void;
  onCopied: () => void;
}

export function CopyTargetsModal({ year, salespeople, onClose, onCopied }: CopyTargetsModalProps) {
  const token = useAuthStore((state) => state.token);
  const [fromYear, setFromYear] = useState(year);
  const [fromMonth, setFromMonth] = useState(1);
  const [toYear, setToYear] = useState(year);
  const [toMonth, setToMonth] = useState(2);
  const [overwrite, setOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopyTargetsResult | null>(null);

  const nameById = new Map(salespeople.map((sp) => [sp.id, sp.displayName]));

  function describe(ids: number[]) {
    return ids.map((id) => nameById.get(id) ?? id).join(", ");
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await copyTargets(token, { fromYear, fromMonth, toYear, toMonth, overwrite });
      setResult(data);
      onCopied();
    } catch (err) {
      setError(getErrorMessage(err, "คัดลอกเป้าไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="คัดลอกเป้าจากเดือนก่อน" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">จากปี</label>
            <Input
              type="number"
              value={fromYear}
              onChange={(e) => setFromYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">จากเดือน</label>
            <Select
              value={fromMonth}
              onChange={(e) => setFromMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {formatThaiMonth(m)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">ไปปี</label>
            <Input
              type="number"
              value={toYear}
              onChange={(e) => setToYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">ไปเดือน</label>
            <Select
              value={toMonth}
              onChange={(e) => setToMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {formatThaiMonth(m)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          เขียนทับเป้าที่มีอยู่แล้วในเดือนปลายทาง
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-1 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
            <p>ต้นทางมีเป้าทั้งหมด {result.sourceCount} คน</p>
            <p>
              สร้างใหม่ {result.created.length} คน
              {result.created.length > 0 && `: ${describe(result.created)}`}
            </p>
            <p>
              อัปเดต {result.updated.length} คน
              {result.updated.length > 0 && `: ${describe(result.updated)}`}
            </p>
            <p>
              ข้ามไป (มีเป้าอยู่แล้ว) {result.skipped.length} คน
              {result.skipped.length > 0 && `: ${describe(result.skipped)}`}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            ปิด
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {submitting ? "กำลังคัดลอก..." : "คัดลอก"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CopyTargetsModal;
