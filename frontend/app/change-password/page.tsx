"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import FullScreenLoading from "@/components/FullScreenLoading";

// The forced first-login flow (design.md: mustChangePassword blocks every
// other page until this is completed). Voluntary password changes later on
// go through /account instead, reusing the same ChangePasswordForm.
export default function ForcedChangePasswordPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const shouldShowForm = hasHydrated && !!token && !!user && user.mustChangePassword;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    if (!user.mustChangePassword) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, token, user, router]);

  if (!shouldShowForm) {
    return <FullScreenLoading />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-zinc-900">ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน</h1>
        <p className="mt-1 text-sm text-zinc-500">
          บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ กรุณาตั้งรหัสผ่านใหม่เพื่อดำเนินการต่อ
        </p>
        <div className="mt-6">
          <ChangePasswordForm
            submitLabel="เปลี่ยนรหัสผ่านและเข้าใช้งาน"
            onSuccess={() => router.replace("/dashboard")}
          />
        </div>
      </div>
    </div>
  );
}
