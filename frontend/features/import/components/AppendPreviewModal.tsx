"use client";

/**
 * T-UX-027 — dry-run preview for the APPEND import. Shown between upload and commit:
 * the backend parsed + validated the file inside a rolled-back transaction, so closing
 * this modal leaves nothing behind, and confirming re-uploads the file for the real run.
 */

import { Modal } from "@/components/ui/modal";
import { formatThaiMonth } from "@/lib/importLabels";
import { AppendDryRunPreview, PeriodTouched } from "@/lib/types";
import { Button } from "@/components/ui/button";

export interface AppendPreviewModalProps {
  preview: AppendDryRunPreview;
  fileName: string;
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

function PeriodChips({ periods }: { periods: PeriodTouched[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {periods.map((period) => (
        <span key={`${period.year}-${period.month}`} className="rounded-full bg-surface-subtle px-3 py-1 text-sm text-text-secondary">
          {formatThaiMonth(period.month)} {period.year}
        </span>
      ))}
    </div>
  );
}

export function AppendPreviewModal({
  preview,
  fileName,
  isConfirming,
  error,
  onClose,
  onConfirm,
}: AppendPreviewModalProps) {
  const unreadable = preview.fatalError !== null;
  const warningCount = preview.issueCounts.find((c) => c.level === "WARNING")?.count ?? 0;
  const errorCount = preview.issueCounts.find((c) => c.level === "ERROR")?.count ?? 0;

  return (
    <Modal title="ตรวจสอบผลจำลองก่อนนำเข้าข้อมูล" onClose={onClose} widthClassName="max-w-2xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <p className="text-sm text-text-secondary">
          ไฟล์ <span className="font-medium text-text-primary">{fileName}</span> ผ่านการตรวจสอบแล้ว (ยังไม่บันทึกลงระบบ) —
          กดยืนยันเพื่อนำเข้าจริง หรือยกเลิกเพื่อไม่บันทึกอะไรทั้งสิ้น
        </p>

        {unreadable ? (
          <p className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger-text">
            อ่านไฟล์ไม่สำเร็จ: {preview.fatalError} — ไม่มีอะไรถูกบันทึก
          </p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-text-primary">งวดที่พบในไฟล์</p>
              <PeriodChips periods={preview.periodsFound} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CountCard label="แถวทั้งหมดในไฟล์" value={preview.totalRows} />
              <CountCard label="จะเพิ่มใหม่" value={preview.insertedRows} tone="text-success-text" />
              <CountCard label="จะอัปเดต (Inv ซ้ำ)" value={preview.updatedRows} tone="text-info-text" />
              <CountCard label="แถวที่จะถูกข้าม" value={preview.errorRows} tone={preview.errorRows > 0 ? "text-danger-text" : "text-text-primary"} />
            </div>

            {(warningCount > 0 || errorCount > 0) && (
              <div className="space-y-2">
                {warningCount > 0 && (
                  <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-text">
                    มีข้อควรระวัง {warningCount.toLocaleString("th-TH")} รายการ (เช่น ยอดรวมไม่ตรง, สร้างชื่อใหม่) — ระบบจะนำเข้าแถวเหล่านี้ตามกติกา ดูรายละเอียดได้หลังยืนยัน
                  </p>
                )}
                {errorCount > 0 && (
                  <p className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger-text">
                    มีแถวที่ข้อมูลไม่ครบ {errorCount.toLocaleString("th-TH")} รายการ — แถวเหล่านี้จะถูกข้าม ดูรายละเอียดได้หลังยืนยัน
                  </p>
                )}
              </div>
            )}

            {preview.errorRows === preview.totalRows && preview.totalRows > 0 && (
              <p className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm font-medium text-danger-text">
                ทุกแถวในไฟล์มีปัญหา — การยืนยันจะไม่นำเข้าข้อมูลใด
              </p>
            )}
          </>
        )}

        {error && <p className="rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-text">{error}</p>}

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            ยกเลิก
          </Button>
          {!unreadable && (
            <Button type="button" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? "กำลังนำเข้า..." : "ยืนยันนำเข้าข้อมูล"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default AppendPreviewModal;
