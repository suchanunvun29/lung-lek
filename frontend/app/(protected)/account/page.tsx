"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { User, Shield, Mail } from "lucide-react";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ (Manager)",
  SALESPERSON: "พนักงานขาย (Salesperson)",
};

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const [changeSuccess, setChangeSuccess] = useState(false);

  if (!user) return null;

  return (
    <PageContainer width="standard">
      <PageHeader
        title="บัญชีของฉัน"
        description="ข้อมูลประจำตัวและสิทธิ์การเข้าใช้งาน พร้อมส่วนจัดการเปลี่ยนรหัสผ่าน"
      />

      <div className="space-y-6">
        {/* Profile Card */}
        <Card className="p-5 border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">
            ข้อมูลบัญชีผู้ใช้
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)]">
              <dt className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <User size={14} className="text-[var(--primary)]" />
                ชื่อที่แสดง
              </dt>
              <dd className="font-semibold text-sm text-[var(--text-primary)]">
                {user.displayName}
              </dd>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)]">
              <dt className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <Mail size={14} className="text-[var(--primary)]" />
                อีเมลเข้าสู่ระบบ
              </dt>
              <dd className="font-semibold text-sm text-[var(--text-primary)]">
                {user.email}
              </dd>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)]">
              <dt className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                <Shield size={14} className="text-[var(--primary)]" />
                บทบาทในระบบ
              </dt>
              <dd className="font-semibold text-sm text-[var(--text-primary)]">
                {ROLE_LABEL_TH[user.role] ?? user.role}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Change Password Card */}
        <Card className="p-5 border-[var(--border)]">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              เปลี่ยนรหัสผ่าน
            </CardTitle>
            {changeSuccess && (
              <div className="mt-2 rounded-[var(--radius-md)] bg-[var(--success-subtle)] border border-[var(--border)] p-3 text-xs font-medium text-[var(--success)]">
                เปลี่ยนรหัสผ่านสำเร็จแล้ว คุณสามารถใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป
              </div>
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
