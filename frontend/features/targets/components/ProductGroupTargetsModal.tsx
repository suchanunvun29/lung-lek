"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { updateTargetProductGroups } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { EntitySummary, Target } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ProductGroupRow {
  productTypeId: number;
  revenueTarget: string;
}

export interface ProductGroupTargetsModalProps {
  target: Target;
  productTypes: EntitySummary[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (target: Target) => void;
}

export function ProductGroupTargetsModal({
  target,
  productTypes,
  canEdit,
  onClose,
  onSaved,
}: ProductGroupTargetsModalProps) {
  const token = useAuthStore((state) => state.token);
  const [rows, setRows] = useState<ProductGroupRow[]>(
    target.productGroupTargets.map((pg) => ({ productTypeId: pg.productTypeId, revenueTarget: String(pg.revenueTarget) }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameById = new Map(productTypes.map((pt) => [pt.id, pt.displayName]));
  const availableToAdd = productTypes.filter((pt) => !rows.some((r) => r.productTypeId === pt.id));

  function addRow() {
    if (availableToAdd.length === 0) return;
    setRows((prev) => [...prev, { productTypeId: availableToAdd[0].id, revenueTarget: "0" }]);
  }

  function removeRow(productTypeId: number) {
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
        {canEdit && <p className="text-xs text-text-muted">เลือกเฉพาะกลุ่มสินค้าที่ต้องการผลักดัน ไม่ต้องตั้งครบทุกกลุ่ม</p>}

        {rows.length === 0 && <p className="text-text-muted">ยังไม่มีเป้ากลุ่มสินค้า</p>}

        <div className="space-y-2">
          {rows.map((row, index) =>
            canEdit ? (
              <div key={row.productTypeId} className="flex items-center gap-2">
                <Select
                  value={row.productTypeId}
                  onChange={(e) => updateRow(index, { productTypeId: Number(e.target.value) })}
                  className="flex-1"
                >
                  <option value={row.productTypeId}>{nameById.get(row.productTypeId) ?? row.productTypeId}</option>
                  {availableToAdd.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.displayName}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={row.revenueTarget}
                  onChange={(e) => updateRow(index, { revenueTarget: e.target.value })}
                  className="w-32"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.productTypeId)}
                  className="text-xs text-danger hover:underline cursor-pointer"
                >
                  ลบ
                </button>
              </div>
            ) : (
              <div key={row.productTypeId} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <span>{nameById.get(row.productTypeId) ?? row.productTypeId}</span>
                <span className="font-medium">{formatTargetMoney(row.revenueTarget)} บาท</span>
              </div>
            )
          )}
        </div>

        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={availableToAdd.length === 0}
            className="text-xs"
          >
            + เพิ่มกลุ่มสินค้า
          </Button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {canEdit ? "ยกเลิก" : "ปิด"}
          </Button>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ProductGroupTargetsModal;
