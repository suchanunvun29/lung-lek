"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SALESPERSON: "พนักงานขาย",
};

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const [changeSuccess, setChangeSuccess] = useState(false);

  if (!user) return null;

  return (
    <PageContainer width="standard">
      <PageHeader title="บัญชีของฉัน" />

      <div className="space-y-6">
        <Card className="p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">ชื่อที่แสดง</dt>
              <dd className="font-medium text-zinc-900">{user.displayName}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">อีเมล</dt>
              <dd className="font-medium text-zinc-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">บทบาท</dt>
              <dd className="font-medium text-zinc-900">{ROLE_LABEL_TH[user.role]}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-semibold text-zinc-900">เปลี่ยนรหัสผ่าน</CardTitle>
            {changeSuccess && (
              <p className="mt-2 text-sm text-emerald-600">เปลี่ยนรหัสผ่านสำเร็จแล้ว</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ChangePasswordForm
              submitLabel="บันทึกรหัสผ่านใหม่"
              onSuccess={() => setChangeSuccess(true)}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
