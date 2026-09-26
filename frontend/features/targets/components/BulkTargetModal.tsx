"use client";

import { useId, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/shared/feedback/toast/ToastProvider";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { EntitySummary, Target, TargetScope } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  bulkDistributeTargets,
  BulkDistributeMode,
  BulkDistributeTargetsResult,
  BulkOverwriteMode,
  ProductGroupTargetInput,
} from "../api/targets.api";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface BulkTargetModalProps {
  year: number;
  scope: TargetScope;
  entities: { id: number; displayName: string }[];
  existingTargets?: Target[];
  productTypes?: EntitySummary[];
  onClose: () => void;
  onSaved: (result: BulkDistributeTargetsResult) => void;
}

export function BulkTargetModal({
  year,
  scope,
  entities,
  existingTargets = [],
  productTypes = [],
  onClose,
  onSaved,
}: BulkTargetModalProps) {
  const token = useAuthStore((state) => state.token);
  const [selectedEntityId, setSelectedEntityId] = useState<number>(
    entities[0]?.id ?? 0
  );
  const [mode, setMode] = useState<BulkDistributeMode>("ANNUAL_TOTAL");
  const [revenueTargetInput, setRevenueTargetInput] = useState<string>("");
  const [newCustomerInput, setNewCustomerInput] = useState<string>("");
  const [productGroupInputs, setProductGroupInputs] = useState<
    Record<number, string>
  >({});
  const [showProductGroups, setShowProductGroups] = useState(false);
  const [overwriteMode, setOverwriteMode] =
    useState<BulkOverwriteMode>("OVERWRITE_ALL");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entitySelectId = useId();
  const revenueInputId = useId();
  const customerInputId = useId();

  // Find existing targets for selected entity in the given year
  const entityTargets = useMemo(() => {
    return existingTargets.filter((t) => {
      if (scope === "SALESPERSON") {
        return t.salespersonId === selectedEntityId && t.year === year;
      }
      return t.territoryId === selectedEntityId && t.year === year;
    });
  }, [existingTargets, selectedEntityId, scope, year]);

  const existingMonthMap = useMemo(() => {
    const map = new Map<number, Target>();
    entityTargets.forEach((t) => {
      map.set(t.month, t);
    });
    return map;
  }, [entityTargets]);

  const existingMonthsCount = existingMonthMap.size;

  // Real-time calculation for 12-month preview table
  const previewRows = useMemo(() => {
    const revNum = parseFloat(revenueTargetInput) || 0;
    const custNum = parseInt(newCustomerInput, 10) || 0;

    const pgList: ProductGroupTargetInput[] = [];
    Object.entries(productGroupInputs).forEach(([idStr, valStr]) => {
      const val = parseFloat(valStr) || 0;
      if (val > 0) {
        pgList.push({ productTypeId: Number(idStr), revenueTarget: val });
      }
    });

    const rows = [];

    if (mode === "ANNUAL_TOTAL") {
      const baseRev = Math.round((revNum / 12) * 100) / 100;
      const baseCust = Math.floor(custNum / 12);

      for (let m = 1; m <= 12; m++) {
        const isMonth12 = m === 12;
        const rev = isMonth12 ? revNum - baseRev * 11 : baseRev;
        const cust = isMonth12 ? custNum - baseCust * 11 : baseCust;

        // Product groups calculation
        const pgs = pgList.map((pg) => {
          const basePg = Math.round((pg.revenueTarget / 12) * 100) / 100;
          const pgRev = isMonth12 ? pg.revenueTarget - basePg * 11 : basePg;
          return {
            productTypeId: pg.productTypeId,
            revenue: pgRev,
          };
        });

        rows.push({
          month: m,
          revenue: rev,
          newCustomers: cust,
          productGroups: pgs,
          hasPennyAdjustment: isMonth12 && revNum > 0 && rev !== baseRev,
          existingTarget: existingMonthMap.get(m),
        });
      }
    } else {
      // MONTHLY_BASE
      for (let m = 1; m <= 12; m++) {
        rows.push({
          month: m,
          revenue: revNum,
          newCustomers: custNum,
          productGroups: pgList.map((pg) => ({
            productTypeId: pg.productTypeId,
            revenue: pg.revenueTarget,
          })),
          hasPennyAdjustment: false,
          existingTarget: existingMonthMap.get(m),
        });
      }
    }

    return rows;
  }, [
    revenueTargetInput,
    newCustomerInput,
    productGroupInputs,
    mode,
    existingMonthMap,
  ]);

  const totalPlannedRevenue = useMemo(() => {
    return previewRows.reduce((acc, r) => acc + r.revenue, 0);
  }, [previewRows]);

  function handleProductGroupChange(productTypeId: number, value: string) {
    setProductGroupInputs((prev) => ({
      ...prev,
      [productTypeId]: value,
    }));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const revNum = parseFloat(revenueTargetInput);
    if (isNaN(revNum) || revNum < 0) {
      setError("กรุณากรอกยอดขายเป้าหมายที่ถูกต้อง (ต้องไม่ติดลบ)");
      return;
    }

    // If overwriting and there are existing months, require confirmation
    if (overwriteMode === "OVERWRITE_ALL" && existingMonthsCount > 0) {
      setConfirmingOverwrite(true);
      return;
    }

    await executeBulkDistribute();
  }

  async function executeBulkDistribute() {
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const revNum = parseFloat(revenueTargetInput) || 0;
      const custNum = newCustomerInput ? parseInt(newCustomerInput, 10) : null;

      const pgs: ProductGroupTargetInput[] = [];
      Object.entries(productGroupInputs).forEach(([idStr, valStr]) => {
        const val = parseFloat(valStr) || 0;
        if (val > 0) {
          pgs.push({ productTypeId: Number(idStr), revenueTarget: val });
        }
      });

      const payload = {
        scope,
        targetScopeId: selectedEntityId,
        year,
        mode,
        revenueTarget: revNum,
        newCustomerTarget: custNum,
        productGroupTargets: pgs.length > 0 ? pgs : undefined,
        overwriteMode,
      };

      const result = await bulkDistributeTargets(token, payload);
      toast.success(
        `ตั้งเป้าหมายแบบกลุ่มสำเร็จ: สร้างใหม่ ${result.createdCount} เดือน · อัปเดต ${result.updatedCount} เดือน · ข้าม ${result.skippedCount} เดือน`
      );
      onSaved(result);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "ตั้งเป้าหมายแบบกลุ่มไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
      setConfirmingOverwrite(false);
    }
  }

  const scopeNoun = scope === "SALESPERSON" ? "พนักงานขาย" : "เขตการขาย";

  return (
    <Modal
      title={`ตั้งเป้าหมายแบบกลุ่ม (Bulk Target Setup) — ปี ${year}`}
      onClose={onClose}
    >
      <form onSubmit={handleFormSubmit} className="space-y-4 text-sm">
        {/* 1. Target Entity Selection */}
        <div>
          <label
            htmlFor={entitySelectId}
            className="mb-1 block text-xs font-medium text-text-secondary"
          >
            เลือก{scopeNoun}
          </label>
          <Select
            id={entitySelectId}
            value={String(selectedEntityId)}
            onChange={(e) => setSelectedEntityId(Number(e.target.value))}
            className="w-full"
          >
            {entities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </Select>
        </div>

        {/* 2. Distribution Mode */}
        <div>
          <span className="mb-1 block text-xs font-medium text-text-secondary">
            รูปแบบการกระจายเป้าหมาย (Distribution Mode)
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                mode === "ANNUAL_TOTAL"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-surface-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="distributionMode"
                  checked={mode === "ANNUAL_TOTAL"}
                  onChange={() => setMode("ANNUAL_TOTAL")}
                  className="h-4 w-4 text-primary"
                />
                <span className="font-semibold text-text-primary">
                  ยอดรวมทั้งปี (Annual Total)
                </span>
              </div>
              <span className="mt-1 text-xs text-text-secondary">
                กรอกยอดรวมทั้งปี หาร 12 เดือนเฉลี่ยเท่ากัน พร้อมปรับเศษสตางค์ (Penny Adjustment) ในเดือนสุดท้าย
              </span>
            </label>

            <label
              className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                mode === "MONTHLY_BASE"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-surface-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="distributionMode"
                  checked={mode === "MONTHLY_BASE"}
                  onChange={() => setMode("MONTHLY_BASE")}
                  className="h-4 w-4 text-primary"
                />
                <span className="font-semibold text-text-primary">
                  ยอดมาตรฐานต่อเดือน (Monthly Base)
                </span>
              </div>
              <span className="mt-1 text-xs text-text-secondary">
                กรอกยอดมาตรฐานต่อเดือน ระบบจะคัดลอกค่าเดียวกันลงครบทั้ง 12 เดือน
              </span>
            </label>
          </div>
        </div>

        {/* 3. Three Dimensions Inputs */}
        <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-3">
          <span className="block text-xs font-semibold text-text-primary">
            ระบุเป้าหมาย 3 มิติ
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={revenueInputId}
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                1. เป้ายอดขายรวม (บาท){" "}
                <span className="text-danger">*</span>
                <span className="ml-1 text-[11px] text-text-tertiary">
                  ({mode === "ANNUAL_TOTAL" ? "ยอดรวมทั้งปี" : "ยอดต่อเดือน"})
                </span>
              </label>
              <Input
                id={revenueInputId}
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="เช่น 1200000"
                value={revenueTargetInput}
                onChange={(e) => setRevenueTargetInput(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor={customerInputId}
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                2. เป้าหมายลูกค้าใหม่ (ราย)
                <span className="ml-1 text-[11px] text-text-tertiary">
                  ({mode === "ANNUAL_TOTAL" ? "รวมทั้งปี" : "ต่อเดือน"})
                </span>
              </label>
              <Input
                id={customerInputId}
                type="number"
                step="1"
                min="0"
                placeholder="เช่น 12"
                value={newCustomerInput}
                onChange={(e) => setNewCustomerInput(e.target.value)}
              />
            </div>
          </div>

          {/* Dimension 3: Product Groups */}
          {productTypes.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">
                  3. เป้าหมายแยกตามกลุ่มสินค้า (บาท)
                </span>
                <button
                  type="button"
                  onClick={() => setShowProductGroups((prev) => !prev)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {showProductGroups ? "ซ่อนกลุ่มสินค้า" : "+ กำหนดเป้ากลุ่มสินค้า"}
                </button>
              </div>

              {showProductGroups && (
                <div className="mt-2 space-y-2 rounded border border-border bg-surface p-2.5">
                  <p className="text-[11px] text-text-tertiary">
                    กำหนดเป้าหมายสำหรับกลุ่มสินค้าที่ต้องการผลักดัน ({mode === "ANNUAL_TOTAL" ? "ยอดรวมทั้งปี" : "ยอดต่อเดือน"})
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {productTypes.map((pt) => (
                      <div key={pt.id} className="flex items-center gap-2">
                        <span className="w-1/2 truncate text-xs text-text-secondary" title={pt.displayName}>
                          {pt.displayName}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={productGroupInputs[pt.id] ?? ""}
                          onChange={(e) => handleProductGroupChange(pt.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Conflict & Overwrite Handling */}
        {existingMonthsCount > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              ตรวจพบเป้าหมายเดิมในระบบ {existingMonthsCount} เดือน
            </div>
            <p className="mt-1 text-xs text-amber-800">
              พนักงาน/เขตนี้มีเป้าหมายที่เคยบันทึกไว้แล้ว กรุณาเลือกวิธีจัดการ:
            </p>

            <div className="mt-2 space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="overwriteMode"
                  checked={overwriteMode === "OVERWRITE_ALL"}
                  onChange={() => setOverwriteMode("OVERWRITE_ALL")}
                  className="h-4 w-4 text-primary"
                />
                <span>
                  <strong>เขียนทับทั้งหมด (Overwrite All)</strong> — อัปเดตทับเป้าเดิมครบทั้ง 12 เดือน
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="overwriteMode"
                  checked={overwriteMode === "KEEP_CUSTOM"}
                  onChange={() => setOverwriteMode("KEEP_CUSTOM")}
                  className="h-4 w-4 text-primary"
                />
                <span>
                  <strong>คงค่าเดิมเฉพาะเดือนที่เคยปรับแก้ (Keep Custom)</strong> — ปรับเฉพาะเดือนที่ยังไม่มีเป้า และคงค่าเดิมไว้
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 5. Live 12-Month Preview Table (FE-302) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">
              ตัวอย่างการกระจาย 12 เดือน (12-Month Live Preview)
            </span>
            <span className="text-xs text-text-secondary">
              ยอดรวมทั้งปีที่วางแผน: <strong>฿{formatMoney(totalPlannedRevenue)}</strong>
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-border bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="p-2">เดือน</th>
                  <th className="p-2 text-right">ยอดขาย (บาท)</th>
                  <th className="p-2 text-right">ลูกค้าใหม่ (ราย)</th>
                  <th className="p-2">กลุ่มสินค้า</th>
                  <th className="p-2">สถานะเป้าเดิม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {previewRows.map((r) => {
                  const pgCount = r.productGroups.length;
                  const pgSum = r.productGroups.reduce((acc, pg) => acc + pg.revenue, 0);

                  return (
                    <tr
                      key={r.month}
                      className={
                        r.existingTarget
                          ? "bg-amber-50/40 hover:bg-amber-50/70"
                          : "hover:bg-surface-secondary/50"
                      }
                    >
                      <td className="p-2 font-medium">
                        {formatThaiMonth(r.month)}
                        {r.hasPennyAdjustment && (
                          <span
                            className="ml-1.5 inline-block rounded bg-amber-100 px-1 py-0.2 text-[10px] font-semibold text-amber-800"
                            title="ปรับเศษสตางค์ (Penny Adjustment) ให้ยอดรวมทั้งปีตรงพอดี"
                          >
                            +Penny Adj
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-medium">
                        ฿{formatMoney(r.revenue)}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {r.newCustomers > 0 ? r.newCustomers : "—"}
                      </td>
                      <td className="p-2 text-text-secondary">
                        {pgCount > 0 ? `฿${formatMoney(pgSum)} (${pgCount} กลุ่ม)` : "—"}
                      </td>
                      <td className="p-2">
                        {r.existingTarget ? (
                          <span
                            className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800"
                            title={`เป้าเดิม: ฿${formatMoney(r.existingTarget.revenueTarget)}`}
                          >
                            มีเป้าเดิม ({formatMoney(r.existingTarget.revenueTarget)})
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-tertiary">ยังไม่มีเป้า</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !revenueTargetInput}
          >
            {submitting ? "กำลังบันทึก..." : "ยืนยันและบันทึกเป้าหมาย"}
          </Button>
        </div>
      </form>

      {/* Confirmation Dialog for Overwriting Existing Targets */}
      {confirmingOverwrite && (
        <ConfirmDialog
          title="ยืนยันการเขียนทับเป้าหมายเดิม?"
          description={`ตรวจพบเป้าหมายที่เคยบันทึกไว้แล้ว ${existingMonthsCount} เดือนในระบบ การเลือก "เขียนทับทั้งหมด" จะแทนที่ข้อมูลเป้าหมายเดิมด้วยตัวเลขชุดใหม่`}
          confirmLabel="ยืนยันเขียนทับ"
          cancelLabel="ยกเลิก"
          tone="danger"
          onConfirm={executeBulkDistribute}
          onCancel={() => setConfirmingOverwrite(false)}
        />
      )}
    </Modal>
  );
}
