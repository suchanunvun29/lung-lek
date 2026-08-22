"use client";

import Modal from "@/components/Modal";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { PeriodDryRunPreview } from "@/lib/types";

interface PeriodDryRunModalProps {
  action: "REPLACE_PERIOD" | "PERIOD_DELETE";
  preview: PeriodDryRunPreview;
  isConfirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function CountCard({ label, value, tone = "text-zinc-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

export default function PeriodDryRunModal({
  action,
  preview,
  isConfirming,
  onClose,
  onConfirm,
}: PeriodDryRunModalProps) {
  const isDelete = action === "PERIOD_DELETE";

  return (
    <Modal title={isDelete ? "ยืนยันการลบข้อมูลตามงวด" : "ยืนยันการแทนที่ข้อมูลตามงวด"} onClose={onClose} widthClassName="max-w-3xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <p className="text-sm text-zinc-700">
          ตรวจสอบผลจำลองก่อนยืนยัน การดำเนินการนี้จะเก็บสำเนาแถวที่ถูกลบไว้สำหรับทีมพัฒนา แต่ไม่มีปุ่มกู้คืนบนหน้าจอนี้
        </p>

        <div>
          <p className="text-sm font-medium text-zinc-700">งวดที่จะถูกแตะ</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {preview.targetPeriods.map((period) => (
              <span key={`${period.year}-${period.month}`} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
                {formatThaiMonth(period.month)} {period.year}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-200 p-3">
            <p className="text-xs font-medium text-zinc-500">ข้อมูลเดิมในงวด</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{preview.existingRows.toLocaleString("th-TH")} แถว</p>
            <p className="text-sm text-zinc-600">ยอดรวม {formatMoney(String(preview.existingTotal))} บาท</p>
          </div>
          <CountCard label="แถวที่จะลบออก" value={preview.removedRows} tone="text-red-600" />
          {!isDelete && <CountCard label="แถวที่จะนำเข้าใหม่" value={preview.insertedRows} tone="text-emerald-700" />}
          {!isDelete && <CountCard label="แถวที่จะอัปเดต" value={preview.updatedRows} tone="text-sky-700" />}
        </div>

        {preview.willDeletePeriodWithoutReplacement && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">
            การยืนยันจะลบข้อมูลของงวดนี้ทั้งงวดโดยไม่มีข้อมูลใหม่มาแทน
          </p>
        )}

        <div>
          <p className="text-sm font-medium text-zinc-700">ตัวอย่างแถวที่จะถูกลบ</p>
          {preview.removalSamples.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">ไม่มีแถวที่จะถูกลบ</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">โรงพยาบาล</th>
                    <th className="px-3 py-2 text-right">ยอด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.removalSamples.map((sample, index) => (
                    <tr key={`${sample.invoiceNo}-${sample.hospitalName}-${index}`}>
                      <td className="px-3 py-2 text-zinc-700">{sample.invoiceNo}</td>
                      <td className="px-3 py-2 text-zinc-700">{sample.hospitalName}</td>
                      <td className="px-3 py-2 text-right text-zinc-700">{formatMoney(String(sample.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? "กำลังยืนยัน..." : isDelete ? "ยืนยันลบข้อมูลตามงวด" : "ยืนยันแทนที่ข้อมูลตามงวด"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
