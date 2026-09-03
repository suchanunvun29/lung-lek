"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/features/auth/api/auth.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { FullScreenLoading } from "@/components/shared/layout/FullScreenLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (token && user) {
      router.replace(user.mustChangePassword ? "/change-password" : "/dashboard");
    }
  }, [hasHydrated, token, user, router]);

  if (!hasHydrated || (token && user)) {
    return <FullScreenLoading />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      setAuth(data.token, data.user);
      router.replace(data.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-sm p-6 shadow">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-semibold text-zinc-900">เข้าสู่ระบบ</CardTitle>
          <CardDescription className="text-sm text-zinc-500">ระบบประเมินและสนับสนุนพนักงานขาย</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                อีเมล
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700">
                รหัสผ่าน
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
          <p className="mt-6 text-xs text-zinc-400">
            ไม่มีบัญชี? ติดต่อผู้จัดการฝ่ายขายเพื่อขอให้สร้างบัญชีให้ — ระบบนี้ไม่เปิดให้สมัครเอง
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
