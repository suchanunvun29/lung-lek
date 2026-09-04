import { AuthGuard } from "@/components/shared/auth/AuthGuard";
import { AppShell } from "@/components/shared/layout/AppShell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
