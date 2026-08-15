"use client";

import { useCallback, useEffect, useState } from "react";
import { EvaluationSettingUpdateInput, getErrorMessage, getEvaluationSetting, updateEvaluationSetting } from "@/lib/api";
import { EvaluationSetting } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import EvaluationSettingForm from "@/components/settings/EvaluationSettingForm";
import EvaluationSettingReadOnly from "@/components/settings/EvaluationSettingReadOnly";

export default function EvaluationSettingsPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const [setting, setSetting] = useState<EvaluationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getEvaluationSetting(token);
      setSetting(data.setting);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดค่าคงที่ของการประเมินไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSubmit(input: EvaluationSettingUpdateInput) {
    if (!token) return;
    const data = await updateEvaluationSetting(token, input);
    setSetting(data.setting);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ตั้งค่าคงที่ของการประเมิน</h1>
      <p className="mt-1 text-sm text-zinc-600">
        ค่าที่ใช้ตัดสินว่าลูกค้าหายไปเมื่อไหร่ และข้อมูลย้อนหลังต้องมีกี่เดือนก่อนคำนวณบางเกณฑ์ได้
        {!canEdit && " — คุณสามารถดูได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ"}
      </p>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !loadError && setting && (
        <div className="mt-6">
          {canEdit ? (
            <EvaluationSettingForm setting={setting} onSubmit={handleSubmit} />
          ) : (
            <EvaluationSettingReadOnly setting={setting} />
          )}
        </div>
      )}
    </div>
  );
}
