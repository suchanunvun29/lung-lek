"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import FullScreenLoading from "./FullScreenLoading";

interface AuthGuardProps {
  children: React.ReactNode;
}

// Guards every page under app/(protected) — requires a logged-in user who has
// already completed the forced first-login password change (design.md: no way
// to reach any other page while mustChangePassword is true).
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const isReady = hasHydrated && !!token && !!user && !user.mustChangePassword;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token || !user) {
      router.replace("/login");
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
