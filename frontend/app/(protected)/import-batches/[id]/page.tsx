"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ImportBatchSummary, ImportIssueTable, getImportBatch } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { ImportBatch } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface ImportBatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ImportBatchDetailPage({ params }: ImportBatchDetailPageProps) {
  const { id } = use(params);
  const token = useAuthStore((state) => state.token);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getImportBatch(token, id);
      setBatch(data.importBatch);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดรายละเอียดการนำเข้าไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">รายละเอียดการนำเข้า</h1>
        <Link href="/import-batches" className="text-sm font-medium text-zinc-700 hover:underline">
          ← กลับไปประวัติการนำเข้า
        </Link>
      </div>

      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}
      {loadError && <p className="mt-6 text-sm text-red-600">{loadError}</p>}

      {batch && (
        <div className="mt-6 space-y-6">
          <ImportBatchSummary batch={batch} />
          {batch.issues && <ImportIssueTable issues={batch.issues} />}
        </div>
      )}
    </div>
  );
}
