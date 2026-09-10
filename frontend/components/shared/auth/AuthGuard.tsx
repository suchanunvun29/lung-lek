"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { FullScreenLoading } from "@/components/shared/layout/FullScreenLoading";

export interface AuthGuardProps {
  children: React.ReactNode;
}

// Guards every page under app/(protected) — requires a logged-in user who has
// already completed the forced first-login password change (design.md: no way
// to reach any other page while mustChangePassword is true).
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const isReady = hasHydrated && !!token && !!user && !user.mustChangePassword;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token || !user) {
      // Preserve where the user was trying to go so login can send them back.
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (user.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [hasHydrated, token, user, router]);

  if (!isReady) {
    return <FullScreenLoading />;
  }

  return <>{children}</>;
}

export default AuthGuard;
