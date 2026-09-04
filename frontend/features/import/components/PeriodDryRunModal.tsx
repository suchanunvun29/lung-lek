"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { PeriodDryRunPreview } from "@/lib/types";
import { Button } from "@/components/ui/button";

export interface PeriodDryRunModalProps {
  action: "REPLACE_PERIOD" | "PERIOD_DELETE";
  preview: PeriodDryRunPreview;
  isConfirming: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function CountCard({ label, value, tone = "text-text-primary" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

export function PeriodDryRunModal({
  action,
  preview,
  isConfirming,
  error,
  onClose,
  onConfirm,
}: PeriodDryRunModalProps) {
  const isDelete = action === "PERIOD_DELETE";
  const [finalStepArmed, setFinalStepArmed] = useState(false);
  const requiresDoubleConfirm = preview.willDeletePeriodWithoutReplacement;
  const atFinalStep = !requiresDoubleConfirm || finalStepArmed;

  return (
    <Modal title={isDelete ? "ยืนยันการลบข้อมูลตามงวด" : "ยืนยันการแทนที่ข้อมูลตามงวด"} onClose={onClose} widthClassName="max-w-3xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <p className="text-sm text-text-secondary">
          ตรวจสอบผลจำลองก่อนยืนยัน การดำเนินการนี้จะเก็บสำเนาแถวที่ถูกลบไว้สำหรับทีมพัฒนา แต่ไม่มีปุ่มกู้คืนบนหน้าจอนี้
        </p>

        <div>
          <p className="text-sm font-medium text-text-primary">งวดที่จะถูกแตะ</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {preview.targetPeriods.map((period) => (
              <span key={`${period.year}-${period.month}`} className="rounded-full bg-surface-subtle px-3 py-1 text-sm text-text-secondary">
                {formatThaiMonth(period.month)} {period.year}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium text-text-muted">ข้อมูลเดิมในงวด</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{preview.existingRows.toLocaleString("th-TH")} แถว</p>
            <p className="text-sm text-text-secondary">ยอดรวม {formatMoney(preview.existingTotal)} บาท</p>
          </div>
          <CountCard label="แถวที่จะลบออก" value={preview.removedRows} tone="text-danger" />
          {!isDelete && <CountCard label="แถวที่จะนำเข้าใหม่" value={preview.insertedRows} tone="text-success" />}
          {!isDelete && <CountCard label="แถวที่จะอัปเดต" value={preview.updatedRows} tone="text-primary" />}
        </div>

        {requiresDoubleConfirm && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">
            การยืนยันจะลบข้อมูลของงวดนี้ทั้งงวดโดยไม่มีข้อมูลใหม่มาแทน
            {!atFinalStep && (
              <p className="mt-2 text-sm font-normal text-red-700">ต้องกดยืนยันซ้ำอีกชั้น — กดปุ่มด้านล่างเพื่อไปขั้นยืนยันสุดท้าย</p>
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-text-primary">ตัวอย่างแถวที่จะถูกลบ</p>
          {preview.removalSamples.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">ไม่มีแถวที่จะถูกลบ</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">โรงพยาบาล</th>
                    <th className="px-3 py-2 text-right">ยอด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.removalSamples.map((sample, index) => (
                    <tr key={`${sample.invoiceNo}-${sample.hospitalName}-${index}`}>
                      <td className="px-3 py-2 text-text-secondary">{sample.invoiceNo}</td>
                      <td className="px-3 py-2 text-text-secondary">{sample.hospitalName}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{formatMoney(sample.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isConfirming}
          >
            ยกเลิก
          </Button>
          {!atFinalStep && (
            <Button
              type="button"
              onClick={() => setFinalStepArmed(true)}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              ไปขั้นยืนยันสุดท้าย
            </Button>
          )}
          {atFinalStep && (
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              variant="destructive"
            >
              {isConfirming ? "กำลังยืนยัน..." : isDelete ? "ยืนยันลบข้อมูลตามงวด" : "ยืนยันแทนที่ข้อมูลตามงวด"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default PeriodDryRunModal;
