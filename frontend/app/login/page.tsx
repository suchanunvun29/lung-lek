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
import { FormField } from "@/components/shared/form/FormField";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
    <main aria-label="เข้าสู่ระบบ" className="flex min-h-screen items-center justify-center bg-[var(--surface-sunken)] p-4">
      <Card className="w-full max-w-sm p-6 shadow-[var(--shadow-elevation-1)] border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            เข้าสู่ระบบ
          </CardTitle>
          <CardDescription className="text-sm text-[var(--text-secondary)]">
            ระบบประเมินและสนับสนุนพนักงานขาย
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField id="email" label="อีเมล" required>
              <Input
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                className="h-11 sm:h-9"
              />
            </FormField>

            <FormField id="password" label="รหัสผ่าน" required>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                className="h-11 sm:h-9"
              />
            </FormField>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <div className="ml-2 text-sm">{error}</div>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 min-h-[44px] sm:min-h-[36px]"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-[var(--text-muted)] leading-relaxed">
            ไม่มีบัญชี? ติดต่อผู้จัดการฝ่ายขายเพื่อขอให้สร้างบัญชีให้ — ระบบนี้ไม่เปิดให้สมัครเอง
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
