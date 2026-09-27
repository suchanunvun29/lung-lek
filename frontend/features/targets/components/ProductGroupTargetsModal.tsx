"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { updateTargetProductGroups } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { formatThaiMonth } from "@/lib/importLabels";
import { EntitySummary, Target } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ProductGroupRow {
  productTypeId: number;
  revenueTarget: string;
}

/** Dirty-close guard baseline: trimmed string values so any typed change counts as dirty. */
function rowsSnapshot(rows: ProductGroupRow[]): string {
  return JSON.stringify(rows.map((r) => ({ id: r.productTypeId, value: r.revenueTarget.trim() })));
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Dirty-close guard baseline — captured once at mount, never updated.
  const [savedRowsSnapshot] = useState<string>(() => rowsSnapshot(rows));

  const nameById = new Map(productTypes.map((pt) => [pt.id, pt.displayName]));
  const availableToAdd = productTypes.filter((pt) => !rows.some((r) => r.productTypeId === pt.id));
  const dirty = canEdit && rowsSnapshot(rows) !== savedRowsSnapshot;
  const groupTotal = rows.reduce((acc, r) => acc + (Number(r.revenueTarget) || 0), 0);

  const ownerName = target.salesperson?.displayName ?? target.territory?.name ?? target.territoryGroup?.name;

  function requestClose() {
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  function addRow() {
    if (availableToAdd.length === 0) return;
    setRows((prev) => [...prev, { productTypeId: availableToAdd[0].id, revenueTarget: "" }]);
  }

  function removeRow(productTypeId: number) {
    setRows((prev) => prev.filter((r) => r.productTypeId !== productTypeId));
  }

  function updateRow(index: number, partial: Partial<ProductGroupRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...partial } : r)));
  }

  async function handleSave() {
    if (!token) return;
    const parsed: { productTypeId: number; revenueTarget: number }[] = [];
    for (const row of rows) {
      const trimmed = row.revenueTarget.trim();
      const value = Number(trimmed);
      if (trimmed === "" || Number.isNaN(value) || value < 0) {
        setError("กรุณากรอกยอดเป้าเป็นตัวเลขไม่ติดลบให้ครบทุกแถว หรือกด ✕ เพื่อลบแถวที่ไม่ต้องการ");
        return;
      }
      parsed.push({ productTypeId: row.productTypeId, revenueTarget: value });
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
    <Modal title="เป้ากลุ่มสินค้า" onClose={requestClose}>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg bg-surface-secondary/60 p-3">
          <p className="text-sm font-medium text-text-primary">
            {ownerName ? `${ownerName} · ` : ""}เดือน{formatThaiMonth(target.month)} {target.year}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            ยอดเป้าขายเดือนนี้{" "}
            <span className="font-numeric font-medium text-text-primary">
              {formatTargetMoney(target.revenueTarget)}
            </span>{" "}
            บาท
            {rows.length > 0 && (
              <>
                {" · "}รวมเป้ากลุ่มสินค้า{" "}
                <span className="font-numeric font-medium text-text-primary">{formatTargetMoney(groupTotal)}</span> บาท
              </>
            )}
          </p>
        </div>

        {canEdit && (
          <p className="text-xs text-text-muted">เลือกเฉพาะกลุ่มสินค้าที่ต้องการผลักดันในเดือนนี้ ไม่ต้องตั้งครบทุกกลุ่ม</p>
        )}

        {rows.length === 0 ? (
          canEdit ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <p className="text-sm text-text-secondary">ยังไม่มีเป้ากลุ่มสินค้าสำหรับเดือนนี้</p>
              <p className="mt-1 text-xs text-text-muted">กดปุ่ม &quot;+ เพิ่มกลุ่มสินค้า&quot; ด้านล่างเพื่อเริ่ม</p>
            </div>
          ) : (
            <p className="text-text-muted">ยังไม่มีเป้ากลุ่มสินค้า</p>
          )
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const rowName = nameById.get(row.productTypeId) ?? `กลุ่ม #${row.productTypeId}`;
              return canEdit ? (
                <div key={index} className="rounded-lg border border-border p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={row.productTypeId}
                      onChange={(e) => updateRow(index, { productTypeId: Number(e.target.value) })}
                      aria-label={`กลุ่มสินค้า แถวที่ ${index + 1}`}
                      className="min-w-0 grow basis-40"
                    >
                      <option value={row.productTypeId}>{rowName}</option>
                      {availableToAdd.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.displayName}
                        </option>
                      ))}
                    </Select>
                    <div className="relative grow basis-36 min-w-36">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.revenueTarget}
                        onChange={(e) => updateRow(index, { revenueTarget: e.target.value })}
                        aria-label={`ยอดเป้าของ${rowName} (บาท)`}
                        className="pr-11"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-muted">
                        บาท
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.productTypeId)}
                      aria-label={`ลบ${rowName}`}
                      className="flex h-9 min-h-(--touch-target) min-w-(--touch-target) sm:min-h-9 sm:min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
                    >
                      <span aria-hidden="true" className="text-base font-semibold">
                        ✕
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div key={index} className="flex items-center justify-between rounded border border-border px-3 py-2">
                  <span>{rowName}</span>
                  <span className="font-numeric font-medium">{formatTargetMoney(row.revenueTarget)} บาท</span>
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-2">
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
            {availableToAdd.length === 0 && rows.length > 0 && (
              <span className="text-xs text-text-muted">เลือกครบทุกกลุ่มสินค้าแล้ว</span>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={requestClose}>
            {canEdit ? "ยกเลิก" : "ปิด"}
          </Button>
          {canEdit && (
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          )}
        </div>
      </div>

      {confirmingDiscard && (
        <ConfirmDialog
          title="ยกเลิกการแก้ไขเป้ากลุ่มสินค้า?"
          description="มีการแก้ไขที่ยังไม่บันทึก ออกจากหน้าต่างนี้แล้วการแก้ไขทั้งหมดจะหาย"
          confirmLabel="ออกโดยไม่บันทึก"
          cancelLabel="แก้ไขต่อ"
          tone="danger"
          onConfirm={onClose}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </Modal>
  );
}

export default ProductGroupTargetsModal;
