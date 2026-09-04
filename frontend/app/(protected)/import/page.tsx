"use client";

/**
 * /import — WACC-P1-013
 *
 * Pattern D: PageHeader → mode + upload → result summary → the destructive
 * "ลบข้อมูลตามงวด" zone, collapsed, last on the page.
 *
 * The dry-run flow is untouched: REPLACE_PERIOD still previews first, and a
 * period delete now requires a typed confirmation of the period(s) being
 * deleted BEFORE the existing dry-run modal — an additional gate, not a
 * replacement. After a successful import a "ขั้นตอนถัดไป" panel surfaces the
 * F1 close sequence (batch detail → name reviews → unassigned hospitals →
 * targets), which previously existed nowhere in the product.
 */

import Link from "next/link";
import { useState } from "react";
import {
  PeriodDryRunModal,
  PeriodPicker,
  ImportBatchSummary,
  ImportIssueTable,
  UploadForm,
  deleteImportPeriods,
  uploadImportFile,
} from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { ImportBatch, ImportMode, PeriodDryRunPreview, PeriodTouched } from "@/lib/types";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface DryRunState {
  action: "REPLACE_PERIOD" | "PERIOD_DELETE";
  preview: PeriodDryRunPreview;
  file?: File;
}

const IMPORT_MODE_OPTIONS: { value: Extract<ImportMode, "APPEND" | "REPLACE_PERIOD">; label: string; description: string }[] = [
  { value: "APPEND", label: "เพิ่มข้อมูลตามปกติ", description: "ใช้เมื่อนำเข้างวดใหม่ ระบบจะไม่ลบข้อมูลของงวดก่อนหน้า" },
  { value: "REPLACE_PERIOD", label: "แทนที่ข้อมูลของงวดเดิม", description: "ใช้เมื่อแก้ไขไฟล์ของงวดเดิม ต้องตรวจสอบผลจำลองและยืนยันอีกครั้งก่อนดำเนินการ" },
];

function periodKey(period: PeriodTouched) {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** The exact text the user must retype — the full scope of what will be deleted. */
function deleteConfirmationText(periods: PeriodTouched[]) {
  return periods.map(periodKey).join(", ");
}

const NEXT_STEPS: { href: (batchId: number) => string; label: string; description: string }[] = [
  {
    href: (batchId) => `/import-batches/${batchId}`,
    label: "ตรวจสอบผลการนำเข้ารายแถว",
    description: "ดูสรุปและปัญหาของงานนำเข้านี้",
  },
  {
    href: () => "/name-reviews",
    label: "ยืนยันชื่อซ้ำ",
    description: "ตัดสินชื่อโรงพยาบาล/พนักงานขายที่ระบบไม่แน่ใจ",
  },
  {
    href: () => "/territories/unassigned",
    label: "ผูกเขตให้โรงพยาบาลที่ยังไม่มีเขต",
    description: "ยอดของโรงพยาบาลที่ไม่มีเขตจะไม่ถูกนับใน KPI รายเขต",
  },
  {
    href: () => "/targets",
    label: "ตั้งเป้าพนักงานขาย",
    description: "ตรวจว่าทุกคนมีเป้าของงวดนี้ก่อนประเมิน",
  },
];

export default function ImportPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [resultKind, setResultKind] = useState<"upload" | "delete">("upload");
  const [mode, setMode] = useState<Extract<ImportMode, "APPEND" | "REPLACE_PERIOD">>("APPEND");
  const [replacePeriods, setReplacePeriods] = useState<PeriodTouched[]>([]);
  const [deletePeriods, setDeletePeriods] = useState<PeriodTouched[]>([]);
  const [dryRun, setDryRun] = useState<DryRunState | null>(null);
  const [deleteZoneOpen, setDeleteZoneOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (currentUser?.role !== "MANAGER") {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  async function handleUpload(file: File) {
    if (!token) return;
    setResult(null);
    setConfirmError(null);
    if (mode === "APPEND") {
      try {
        const data = await uploadImportFile(token, file);
        if ("importBatch" in data) {
          setResult(data.importBatch);
          setResultKind("upload");
        }
      } catch (err) {
        throw new Error(getErrorMessage(err, "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่"));
      }
      return;
    }
    if (replacePeriods.length === 0) throw new Error("เลือกงวดที่ต้องการแทนที่ก่อนอัปโหลดไฟล์");
    try {
      const data = await uploadImportFile(token, file, { mode: "REPLACE_PERIOD", targetPeriods: replacePeriods, confirm: false });
      if (!("dryRun" in data) || !data.dryRun) throw new Error("ผลลัพธ์การตรวจสอบไม่ถูกต้อง");
      setDryRun({ action: "REPLACE_PERIOD", preview: data.preview, file });
    } catch (err) {
      throw new Error(getErrorMessage(err, "ตรวจสอบการแทนที่ข้อมูลงวดไม่สำเร็จ"));
    }
  }

  function requestPeriodDelete() {
    if (deletePeriods.length === 0) {
      setDeleteError("เลือกงวดที่ต้องการลบก่อนดำเนินการ");
      return;
    }
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  async function checkPeriodDelete() {
    if (!token) return;
    setIsCheckingDelete(true);
    setDeleteError(null);
    setResult(null);
    setConfirmError(null);
    try {
      const data = await deleteImportPeriods(token, { targetPeriods: deletePeriods, confirm: false });
      if (!data.dryRun) throw new Error("ผลลัพธ์การตรวจสอบไม่ถูกต้อง");
      setDryRun({ action: "PERIOD_DELETE", preview: data.preview });
      setDeleteConfirmOpen(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err, "ตรวจสอบการลบข้อมูลงวดไม่สำเร็จ"));
    } finally {
      setIsCheckingDelete(false);
    }
  }

  async function confirmDryRun() {
    if (!token || !dryRun) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      if (dryRun.action === "REPLACE_PERIOD") {
        if (!dryRun.file) throw new Error("ไม่พบไฟล์สำหรับยืนยันการแทนที่ข้อมูล");
        const data = await uploadImportFile(token, dryRun.file, { mode: "REPLACE_PERIOD", targetPeriods: dryRun.preview.targetPeriods, confirm: true });
        if (!("importBatch" in data) || ("dryRun" in data && data.dryRun)) throw new Error("ผลลัพธ์การยืนยันไม่ถูกต้อง");
        setResult(data.importBatch);
        setResultKind("upload");
      } else {
        const data = await deleteImportPeriods(token, { targetPeriods: dryRun.preview.targetPeriods, confirm: true });
        if (data.dryRun) throw new Error("ผลลัพธ์การยืนยันไม่ถูกต้อง");
        setResult(data.importBatch);
        setResultKind("delete");
      }
      setDryRun(null);
    } catch (err) {
      setConfirmError(getErrorMessage(err, "ยืนยันการดำเนินการไม่สำเร็จ"));
    } finally {
      setIsConfirming(false);
    }
  }

  const uploadSucceeded = result !== null && resultKind === "upload";

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader
        title="นำเข้าข้อมูลการขายจาก Excel"
        description="อัปโหลดไฟล์ .xlsx รายงานการขาย ระบบจะนำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น"
        secondaryActions={[
          <Link key="batches" href="/import-batches" className="text-sm font-medium text-zinc-700 hover:underline">
            ดูประวัติการนำเข้า
          </Link>,
        ]}
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">โหมดการนำเข้า</h2>
        <div className="mt-4 space-y-3">
          {IMPORT_MODE_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer gap-3 rounded-md border border-zinc-200 p-4 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
              <input type="radio" name="import-mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1" />
              <span><span className="block text-sm font-medium text-zinc-900">{option.label}</span><span className="mt-1 block text-sm text-zinc-600">{option.description}</span></span>
            </label>
          ))}
        </div>
        {mode === "REPLACE_PERIOD" && (
          <div className="mt-5 border-t border-zinc-200 pt-5">
            <p className="text-sm font-medium text-zinc-800">เลือกงวดที่จะแทนที่</p>
            <p className="mt-1 text-sm text-zinc-600">ทุกแถวในไฟล์ต้องอยู่ในงวดที่เลือกไว้เท่านั้น</p>
            <div className="mt-3"><PeriodPicker value={replacePeriods} onChange={setReplacePeriods} /></div>
          </div>
        )}
      </section>

      <div className="mt-6"><UploadForm onUpload={handleUpload} /></div>

      {/* ขั้นตอนถัดไป — the F1 monthly-close sequence, made visible (Safe Automation:
          derived from the import result already in hand) */}
      {uploadSucceeded && (
        <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6" aria-label="ขั้นตอนถัดไป">
          <h2 className="text-lg font-semibold text-emerald-900">ขั้นตอนถัดไป</h2>
          <p className="mt-1 text-sm text-emerald-800">
            การนำเข้าสำเร็จแล้ว — ปิดงวดตามลำดับต่อไปนี้ก่อนใช้ตัวเลขประเมิน
          </p>
          <ol className="mt-4 space-y-1">
            {NEXT_STEPS.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href(result!.id)}
                  className="flex min-h-[44px] items-center gap-3 rounded-md border border-emerald-200 bg-white px-4 py-2 hover:border-emerald-400"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">{step.label}</span>
                    <span className="block text-xs text-zinc-500">{step.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900">ผลการดำเนินการ</h2>
          <ImportBatchSummary batch={result} />
          {result.issues && <ImportIssueTable issues={result.issues} />}
        </div>
      )}

      {/* ── Destructive zone — collapsed, last on the page ── */}
      <section className="mt-10 rounded-lg border border-red-200 bg-red-50">
        <button
          type="button"
          aria-expanded={deleteZoneOpen}
          onClick={() => setDeleteZoneOpen((open) => !open)}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 p-6 text-left cursor-pointer"
        >
          <span>
            <span className="block text-lg font-semibold text-red-900">ลบข้อมูลตามงวด</span>
            <span className="mt-1 block text-sm text-red-800">
              โซนอันตราย — ใช้เมื่อต้องการล้างข้อมูลทั้งงวดโดยไม่มีไฟล์ใหม่มาแทน
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-red-800 transition-transform ${deleteZoneOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {deleteZoneOpen && (
          <div className="border-t border-red-200 p-6 pt-4">
            <p className="text-sm text-red-800">
              ระบบจะให้พิมพ์ยืนยันงวด แล้วตรวจสอบผลจำลองก่อนยืนยันลบอีกครั้ง
            </p>
            <div className="mt-4"><PeriodPicker value={deletePeriods} onChange={setDeletePeriods} disabled={isCheckingDelete} /></div>
            {deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="destructive"
                onClick={requestPeriodDelete}
                disabled={isCheckingDelete}
              >
                ลบข้อมูลตามงวด…
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Typed confirmation — in addition to the dry-run below, not instead of it */}
      {deleteConfirmOpen && (
        <ConfirmDialog
          title="ต้องการลบข้อมูลทั้งงวด?"
          description={`กำลังจะลบข้อมูลการขายของงวด ${deleteConfirmationText(deletePeriods)} ทั้งงวดออกจากระบบ`}
          consequence="การลบจะทำให้ยอดขาย KPI และรายงานของงวดนี้หายทั้งหมด จนกว่าจะนำเข้าข้อมูลใหม่"
          requireTypedConfirmation={deleteConfirmationText(deletePeriods)}
          confirmLabel="ไปขั้นตรวจสอบผลจำลอง"
          tone="danger"
          pending={isCheckingDelete}
          onConfirm={() => checkPeriodDelete()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}

      {dryRun && (
        <PeriodDryRunModal
          action={dryRun.action}
          preview={dryRun.preview}
          isConfirming={isConfirming}
          error={confirmError}
          onClose={() => setDryRun(null)}
          onConfirm={() => void confirmDryRun()}
        />
      )}
    </div>
  );
}
