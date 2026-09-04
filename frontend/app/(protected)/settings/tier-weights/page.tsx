"use client";

import { useCallback, useEffect, useState } from "react";
import { TierWeightsForm, getTierWeights, updateTierWeights } from "@/features/settings";
import { getErrorMessage } from "@/lib/api-client";
import { TierWeightRow } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/shared/feedback/Skeleton";

export default function TierWeightsSettingsPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const isManager = currentUser?.role === "MANAGER";

  const [weights, setWeights] = useState<TierWeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !isManager) return;
    setLoading(true);
    try {
      const data = await getTierWeights(token);
      setWeights(data.weights);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดน้ำหนักระดับโรงพยาบาลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, isManager]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSubmit(input: { tier: string; weight: number }[]) {
    if (!token) return;
    setSavedNotice(null);
    const data = await updateTierWeights(token, input);
    setWeights(data.weights);
    setSavedNotice("บันทึกน้ำหนักเรียบร้อยแล้ว");
    setTimeout(() => setSavedNotice(null), 4000);
  }

  if (!isManager) {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="น้ำหนักตามระดับโรงพยาบาล"
        description="ค่าน้ำหนักถ่วงตัวชี้วัดศักยภาพตามระดับโรงพยาบาล (TierWeight) เพื่อใช้ปรับเป้าหมายในเขตการขาย"
      />

      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 text-sm">{loadError}</div>
        </Alert>
      )}

      {savedNotice && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--success-subtle)] p-3 text-sm font-medium text-[var(--success)]">
          {savedNotice}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {!loading && !loadError && (
        <div>
          {weights.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
              ยังไม่มีระดับโรงพยาบาลในทะเบียน — นำเข้าไฟล์ทะเบียนก่อนจึงจะมีระดับให้ตั้งค่า
            </div>
          ) : (
            <TierWeightsForm weights={weights} onSubmit={handleSubmit} />
          )}
        </div>
      )}
    </PageContainer>
  );
}
