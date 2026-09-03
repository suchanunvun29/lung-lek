import { AuthGuard } from "@/components/shared/auth/AuthGuard";
import { NavBar } from "@/components/shared/navigation/NavBar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 bg-zinc-50">{children}</main>
      </div>
    </AuthGuard>
  );
}
