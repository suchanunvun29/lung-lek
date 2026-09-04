"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { FullScreenLoading } from "@/components/shared/layout/FullScreenLoading";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-sunken)] p-4">
      <Card className="w-full max-w-sm p-6 shadow-[var(--shadow-elevation-1)] border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน
          </CardTitle>
          <CardDescription className="text-sm text-[var(--text-secondary)]">
            บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ กรุณาตั้งรหัสผ่านใหม่เพื่อดำเนินการต่อ
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-2">
          <ChangePasswordForm
            submitLabel="เปลี่ยนรหัสผ่านและเข้าใช้งาน"
            onSuccess={() => router.replace("/dashboard")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
