"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EvaluationSettingForm,
  EvaluationSettingReadOnly,
  EvaluationSettingUpdateInput,
  getEvaluationSetting,
  updateEvaluationSetting,
} from "@/features/settings";
import { getErrorMessage } from "@/lib/api-client";
import { EvaluationSetting } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/shared/feedback/Skeleton";

export default function EvaluationSettingsPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const [setting, setSetting] = useState<EvaluationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    setSaveSuccess(false);
    const data = await updateEvaluationSetting(token, input);
    setSetting(data.setting);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="ตั้งค่าคงที่ของการประเมิน"
        description={
          canEdit
            ? "กำหนดค่าคงที่ 11 ตัวแปร แบ่งตามขอบเขต: การประเมิน, AI, ศักยภาพ และตัวช่วยตั้งเป้า"
            : "ค่าคงที่ของการประเมิน (ดูได้อย่างเดียว — สิทธิ์แก้ไขสำหรับผู้จัดการเท่านั้น)"
        }
      />

      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 text-sm">{loadError}</div>
        </Alert>
      )}

      {saveSuccess && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--success-subtle)] p-3 text-sm font-medium text-[var(--success)]">
          บันทึกค่าคงที่ของการประเมินเรียบร้อยแล้ว
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!loading && !loadError && setting && (
        <div>
          {canEdit ? (
            <EvaluationSettingForm setting={setting} onSubmit={handleSubmit} />
          ) : (
            <EvaluationSettingReadOnly setting={setting} />
          )}
        </div>
      )}
    </PageContainer>
  );
}
