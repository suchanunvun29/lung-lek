"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ScoringWeightInput,
  ScoringWeightRevisionsList,
  ScoringWeightsForm,
  ScoringWeightsReadOnly,
  getScoringWeights,
  updateScoringWeights,
} from "@/features/settings";
import { getErrorMessage } from "@/lib/api-client";
import { ScoringWeight, ScoringWeightRevision } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/shared/feedback/Skeleton";

export default function ScoringWeightsSettingsPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const [weights, setWeights] = useState<ScoringWeight[]>([]);
  const [revisions, setRevisions] = useState<ScoringWeightRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getScoringWeights(token);
      setWeights(data.weights);
      setRevisions(data.revisions);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดน้ำหนักคะแนนไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSubmit(input: ScoringWeightInput[], note: string | null) {
    if (!token) return;
    const data = await updateScoringWeights(token, input, note);
    setWeights(data.weights);
    void load();
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="ตั้งค่าน้ำหนักคะแนน"
        description={
          canEdit
            ? "กำหนดค่าน้ำหนักถ่วงคะแนน 0–100 จากเกณฑ์การประเมิน 5 ด้าน"
            : "ค่าน้ำหนักถ่วงคะแนน 0–100 จากเกณฑ์การประเมิน (ดูได้อย่างเดียว — สิทธิ์แก้ไขสำหรับผู้จัดการเท่านั้น)"
        }
      />

      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 text-sm">{loadError}</div>
        </Alert>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && !loadError && (
        <div className="space-y-6">
          {canEdit ? (
            <ScoringWeightsForm weights={weights} onSubmit={handleSubmit} />
          ) : (
            <ScoringWeightsReadOnly weights={weights} />
          )}

          <div className="pt-2">
            <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">
              ประวัติการแก้ไขน้ำหนัก
            </h2>
            <ScoringWeightRevisionsList revisions={revisions} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
