"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import ChangePasswordForm from "@/components/ChangePasswordForm";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SALESPERSON: "พนักงานขาย",
};

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const [changeSuccess, setChangeSuccess] = useState(false);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">บัญชีของฉัน</h1>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6">
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
      </div>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">เปลี่ยนรหัสผ่าน</h2>
        {changeSuccess && (
          <p className="mt-2 text-sm text-emerald-600">เปลี่ยนรหัสผ่านสำเร็จแล้ว</p>
        )}
        <div className="mt-4">
          <ChangePasswordForm
            submitLabel="บันทึกรหัสผ่านใหม่"
            onSuccess={() => setChangeSuccess(true)}
          />
        </div>
      </div>
    </div>
  );
}
