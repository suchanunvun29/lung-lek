"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getErrorMessage, updateTargetProductGroups } from "@/lib/api";
import { formatTargetMoney } from "@/lib/targetLabels";
import { EntitySummary, Target } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface ProductGroupRow {
  productTypeId: string;
  revenueTarget: string;
}

interface ProductGroupTargetsModalProps {
  target: Target;
  productTypes: EntitySummary[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (target: Target) => void;
}

export default function ProductGroupTargetsModal({
  target,
  productTypes,
  canEdit,
  onClose,
  onSaved,
}: ProductGroupTargetsModalProps) {
  const token = useAuthStore((state) => state.token);
  const [rows, setRows] = useState<ProductGroupRow[]>(
    target.productGroupTargets.map((pg) => ({ productTypeId: pg.productTypeId, revenueTarget: pg.revenueTarget }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameById = new Map(productTypes.map((pt) => [pt.id, pt.displayName]));
  const availableToAdd = productTypes.filter((pt) => !rows.some((r) => r.productTypeId === pt.id));

  function addRow() {
    if (availableToAdd.length === 0) return;
    setRows((prev) => [...prev, { productTypeId: availableToAdd[0].id, revenueTarget: "0" }]);
  }

  function removeRow(productTypeId: string) {
    setRows((prev) => prev.filter((r) => r.productTypeId !== productTypeId));
  }

  function updateRow(index: number, partial: Partial<ProductGroupRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  }

  async function handleSave() {
    if (!token) return;
    const parsed = rows.map((r) => ({ productTypeId: r.productTypeId, revenueTarget: Number(r.revenueTarget) }));
    if (parsed.some((r) => Number.isNaN(r.revenueTarget) || r.revenueTarget < 0)) {
      setError("ยอดขายเป้าต้องเป็นตัวเลขไม่ติดลบ");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await updateTargetProductGroups(token, target.id, parsed);
      onSaved(data.target);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "บันทึกเป้ากลุ่มสินค้าไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="เป้ากลุ่มสินค้า" onClose={onClose}>
      <div className="space-y-3 text-sm">
        {canEdit && <p className="text-xs text-zinc-500">เลือกเฉพาะกลุ่มสินค้าที่ต้องการผลักดัน ไม่ต้องตั้งครบทุกกลุ่ม</p>}

        {rows.length === 0 && <p className="text-zinc-400">ยังไม่มีเป้ากลุ่มสินค้า</p>}

        <div className="space-y-2">
          {rows.map((row, index) =>
            canEdit ? (
              <div key={row.productTypeId} className="flex items-center gap-2">
                <select
                  value={row.productTypeId}
                  onChange={(e) => updateRow(index, { productTypeId: e.target.value })}
                  className="flex-1 rounded border border-zinc-300 px-2 py-1.5"
                >
                  <option value={row.productTypeId}>{nameById.get(row.productTypeId) ?? row.productTypeId}</option>
                  {availableToAdd.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={row.revenueTarget}
                  onChange={(e) => updateRow(index, { revenueTarget: e.target.value })}
                  className="w-32 rounded border border-zinc-300 px-2 py-1.5"
                />
                <button type="button" onClick={() => removeRow(row.productTypeId)} className="text-xs text-red-600 hover:underline">
                  ลบ
                </button>
              </div>
            ) : (
              <div key={row.productTypeId} className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2">
                <span>{nameById.get(row.productTypeId) ?? row.productTypeId}</span>
                <span className="font-medium">{formatTargetMoney(row.revenueTarget)} บาท</span>
              </div>
            )
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={addRow}
            disabled={availableToAdd.length === 0}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-40"
          >
            + เพิ่มกลุ่มสินค้า
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700">
            {canEdit ? "ยกเลิก" : "ปิด"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
