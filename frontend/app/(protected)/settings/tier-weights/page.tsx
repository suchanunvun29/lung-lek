"use client";

import { useCallback, useEffect, useState } from "react";
import { TierWeightsForm, getTierWeights, updateTierWeights } from "@/features/settings";
import { getErrorMessage } from "@/lib/api-client";
import { TierWeightRow } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";

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
  }

  if (!isManager) {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">น้ำหนักตามระดับโรงพยาบาล</h1>
      <p className="mt-1 text-sm text-zinc-600">
        น้ำหนักที่ถ่วงค่าตัวชี้วัดศักยภาพของโรงพยาบาลแต่ละระดับ (TierWeight) — ค่าเริ่มต้น 1.000 ทุกระดับ
        เพื่อให้วันแรกผลลัพธ์เท่ากับผลรวมค่าดิบพอดี
      </p>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {savedNotice && <p className="mt-4 text-sm text-emerald-700">{savedNotice}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !loadError && (
        <div className="mt-6">
          {weights.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
              ยังไม่มีระดับโรงพยาบาลในทะเบียน — นำเข้าไฟล์ทะเบียนก่อนจึงจะมีระดับให้ตั้งค่า
            </p>
          ) : (
            <TierWeightsForm weights={weights} onSubmit={handleSubmit} />
          )}
        </div>
      )}
    </div>
  );
}
