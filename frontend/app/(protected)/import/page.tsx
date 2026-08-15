"use client";

import Link from "next/link";
import { useState } from "react";
import { getErrorMessage, uploadImportFile } from "@/lib/api";
import { ImportBatch } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import UploadForm from "@/components/import/UploadForm";
import ImportBatchSummary from "@/components/import/ImportBatchSummary";
import ImportIssueTable from "@/components/import/ImportIssueTable";

export default function ImportPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [result, setResult] = useState<ImportBatch | null>(null);

  if (currentUser?.role !== "MANAGER") {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          หน้านี้สำหรับผู้จัดการเท่านั้น
        </p>
      </div>
    );
  }

  async function handleUpload(file: File) {
    if (!token) return;
    setResult(null);
    try {
      const data = await uploadImportFile(token, file);
      setResult(data.importBatch);
    } catch (err) {
      throw new Error(getErrorMessage(err, "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่"));
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">นำเข้าข้อมูลการขายจาก Excel</h1>
        <Link href="/import-batches" className="text-sm font-medium text-zinc-700 hover:underline">
          ดูประวัติการนำเข้า
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        อัปโหลดไฟล์ .xlsx รายงานการขาย ระบบจะนำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น
        และอัปเดตแถวเดิมอัตโนมัติหากอัปโหลดไฟล์ที่มีรายการซ้ำ
      </p>

      <div className="mt-6">
        <UploadForm onUpload={handleUpload} />
      </div>

      {result && (
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900">ผลการนำเข้า</h2>
          <ImportBatchSummary batch={result} />
          {result.issues && <ImportIssueTable issues={result.issues} />}
        </div>
      )}
    </div>
  );
}
