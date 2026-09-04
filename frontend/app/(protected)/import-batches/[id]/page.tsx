"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { ImportBatchSummary, ImportIssueTable, getImportBatch } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { ImportBatch } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Breadcrumb } from "@/components/shared/navigation/Breadcrumb";

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
    setLoading(true);
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

  const hasNameReviewIssues = Boolean(
    batch?.issues?.some(
      (issue) =>
        issue.code === "UNKNOWN_SALESMAN" ||
        issue.code === "NEW_HOSPITAL" ||
        issue.message.includes("ยืนยันชื่อซ้ำ")
    )
  );

  return (
    <PageContainer width="standard">
      {/* Pattern C: Breadcrumb override with filename */}
      <div className="mb-4">
        <Breadcrumb
          segments={[
            { label: "ข้อมูลการขาย" },
            { label: "ประวัติการนำเข้า", href: "/import-batches" },
            { label: batch?.fileName ?? `รายการที่ #${id}` },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <PageHeader
          title="รายละเอียดการนำเข้า"
          description={batch ? `รหัสงาน #${batch.id} · ${batch.fileName}` : undefined}
        />
        <Link
          href="/import-batches"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปประวัติการนำเข้า
        </Link>
      </div>

      {loading && <p className="text-text-muted">กำลังโหลด...</p>}
      {loadError && <p className="text-sm text-status-danger">{loadError}</p>}

      {batch && (
        <div className="space-y-6">
          {/* Conditional callout to /name-reviews when batch generated review items */}
          {hasNameReviewIssues && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-950">
                    พบรายการชื่อที่ต้องยืนยันในระบบ
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    ไฟล์นี้นำเข้าพนักงานขายหรือโรงพยาบาลใหม่ที่ต้องให้ผู้จัดการตรวจสอบในคิวยืนยันชื่อซ้ำ
                  </p>
                </div>
              </div>
              <Link
                href="/name-reviews"
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors shadow-xs"
              >
                ไปที่คิวยืนยันชื่อซ้ำ
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <ImportBatchSummary batch={batch} />

          {batch.issues && <ImportIssueTable issues={batch.issues} />}
        </div>
      )}
    </PageContainer>
  );
}
