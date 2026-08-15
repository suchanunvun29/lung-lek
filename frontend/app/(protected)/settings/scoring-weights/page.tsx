"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoringWeightInput, getErrorMessage, getScoringWeights, updateScoringWeights } from "@/lib/api";
import { ScoringWeight, ScoringWeightRevision } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import ScoringWeightsForm from "@/components/settings/ScoringWeightsForm";
import ScoringWeightsReadOnly from "@/components/settings/ScoringWeightsReadOnly";
import ScoringWeightRevisionsList from "@/components/settings/ScoringWeightRevisionsList";

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
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ตั้งค่าน้ำหนักคะแนน</h1>
      <p className="mt-1 text-sm text-zinc-600">
        น้ำหนักที่ใช้ถ่วงคะแนนรวม 0–100 จากทั้ง 5 เกณฑ์ รวมกันต้องเท่ากับ 100
        {!canEdit && " — คุณสามารถดูได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ"}
      </p>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !loadError && (
        <div className="mt-6 space-y-8">
          {canEdit ? (
            <ScoringWeightsForm weights={weights} onSubmit={handleSubmit} />
          ) : (
            <ScoringWeightsReadOnly weights={weights} />
          )}

          <div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">ประวัติการแก้ไข</h2>
            <ScoringWeightRevisionsList revisions={revisions} />
          </div>
        </div>
      )}
    </div>
  );
}
