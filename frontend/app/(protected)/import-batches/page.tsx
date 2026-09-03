"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listImportBatches } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { ImportBatch } from "@/lib/types";
import { IMPORT_STATUS_BADGE_CLASS, IMPORT_STATUS_LABEL_TH, formatFileSize } from "@/lib/importLabels";
import { useAuthStore } from "@/store/useAuthStore";

export default function ImportBatchesPage() {
  const token = useAuthStore((state) => state.token);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listImportBatches(token);
      setBatches(data.importBatches);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดประวัติการนำเข้าไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBatches();
  }, [loadBatches]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ประวัติการนำเข้าข้อมูล</h1>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">ไฟล์</th>
              <th className="px-4 py-3">อัปโหลดโดย</th>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3 text-right">นำเข้า/อัปเดต/ผิดพลาด</th>
              <th className="px-4 py-3 text-right">ลบออก</th>
              <th className="px-4 py-3 text-right">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && batches.length === 0 && !loadError && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  ยังไม่มีประวัติการนำเข้า
                </td>
              </tr>
            )}
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{batch.fileName}</p>
                  <p className="text-xs text-zinc-500">{formatFileSize(batch.fileSizeBytes)}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600">{batch.uploadedBy.displayName}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {new Date(batch.startedAt).toLocaleString("th-TH")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${IMPORT_STATUS_BADGE_CLASS[batch.status]}`}
                  >
                    {IMPORT_STATUS_LABEL_TH[batch.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {batch.insertedRows} / {batch.updatedRows} / {batch.errorRows}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">{batch.removedRows}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/import-batches/${batch.id}`} className="text-zinc-700 hover:underline">
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
