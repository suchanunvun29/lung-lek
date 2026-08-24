"use client";

import Link from "next/link";
import { useState } from "react";
import PeriodDryRunModal from "@/components/import/PeriodDryRunModal";
import PeriodPicker from "@/components/import/PeriodPicker";
import ImportBatchSummary from "@/components/import/ImportBatchSummary";
import ImportIssueTable from "@/components/import/ImportIssueTable";
import UploadForm from "@/components/import/UploadForm";
import { deleteImportPeriods, getErrorMessage, uploadImportFile } from "@/lib/api";
import { ImportBatch, ImportMode, PeriodDryRunPreview, PeriodTouched } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface DryRunState {
  action: "REPLACE_PERIOD" | "PERIOD_DELETE";
  preview: PeriodDryRunPreview;
  file?: File;
}

const IMPORT_MODE_OPTIONS: { value: Extract<ImportMode, "APPEND" | "REPLACE_PERIOD">; label: string; description: string }[] = [
  { value: "APPEND", label: "เพิ่มข้อมูลตามปกติ", description: "ใช้เมื่อนำเข้างวดใหม่ ระบบจะไม่ลบข้อมูลของงวดก่อนหน้า" },
  { value: "REPLACE_PERIOD", label: "แทนที่ข้อมูลของงวดเดิม", description: "ใช้เมื่อแก้ไขไฟล์ของงวดเดิม ต้องตรวจสอบผลจำลองและยืนยันอีกครั้งก่อนดำเนินการ" },
];

export default function ImportPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [mode, setMode] = useState<Extract<ImportMode, "APPEND" | "REPLACE_PERIOD">>("APPEND");
  const [replacePeriods, setReplacePeriods] = useState<PeriodTouched[]>([]);
  const [deletePeriods, setDeletePeriods] = useState<PeriodTouched[]>([]);
  const [dryRun, setDryRun] = useState<DryRunState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (currentUser?.role !== "MANAGER") {
    return <div className="mx-auto max-w-2xl p-6"><p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">หน้านี้สำหรับผู้จัดการเท่านั้น</p></div>;
  }

  async function handleUpload(file: File) {
    if (!token) return;
    setResult(null);
    setConfirmError(null);
    if (mode === "APPEND") {
      try {
        const data = await uploadImportFile(token, file);
        if ("importBatch" in data) setResult(data.importBatch);
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

  async function checkPeriodDelete() {
    if (!token) return;
    if (deletePeriods.length === 0) {
      setDeleteError("เลือกงวดที่ต้องการลบก่อนดำเนินการ");
      return;
    }
    setIsCheckingDelete(true);
    setDeleteError(null);
    setResult(null);
    setConfirmError(null);
    try {
      const data = await deleteImportPeriods(token, { targetPeriods: deletePeriods, confirm: false });
      if (!data.dryRun) throw new Error("ผลลัพธ์การตรวจสอบไม่ถูกต้อง");
      setDryRun({ action: "PERIOD_DELETE", preview: data.preview });
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
      } else {
        const data = await deleteImportPeriods(token, { targetPeriods: dryRun.preview.targetPeriods, confirm: true });
        if (data.dryRun) throw new Error("ผลลัพธ์การยืนยันไม่ถูกต้อง");
        setResult(data.importBatch);
      }
      setDryRun(null);
    } catch (err) {
      setConfirmError(getErrorMessage(err, "ยืนยันการดำเนินการไม่สำเร็จ"));
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">นำเข้าข้อมูลการขายจาก Excel</h1>
        <Link href="/import-batches" className="text-sm font-medium text-zinc-700 hover:underline">ดูประวัติการนำเข้า</Link>
      </div>
      <p className="mt-1 text-sm text-zinc-600">อัปโหลดไฟล์ .xlsx รายงานการขาย ระบบจะนำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น</p>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
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

      <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">ลบข้อมูลตามงวด</h2>
        <p className="mt-1 text-sm text-red-800">ใช้เมื่อต้องการล้างข้อมูลทั้งงวดโดยยังไม่มีไฟล์ใหม่มาแทน ระบบจะให้ตรวจสอบผลจำลองก่อนยืนยันอีกครั้ง</p>
        <div className="mt-4"><PeriodPicker value={deletePeriods} onChange={setDeletePeriods} disabled={isCheckingDelete} /></div>
        {deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}
        <div className="mt-4 flex justify-end"><button type="button" onClick={() => void checkPeriodDelete()} disabled={isCheckingDelete} className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{isCheckingDelete ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนลบข้อมูล"}</button></div>
      </section>

      {result && <div className="mt-8 space-y-6"><h2 className="text-lg font-semibold text-zinc-900">ผลการนำเข้า</h2><ImportBatchSummary batch={result} />{result.issues && <ImportIssueTable issues={result.issues} />}</div>}
      {dryRun && <PeriodDryRunModal action={dryRun.action} preview={dryRun.preview} isConfirming={isConfirming} error={confirmError} onClose={() => setDryRun(null)} onConfirm={() => void confirmDryRun()} />}
    </div>
  );
}
