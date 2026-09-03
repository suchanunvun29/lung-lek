"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { FullScreenLoading } from "@/components/shared/layout/FullScreenLoading";

export default function RootPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    router.replace(user.mustChangePassword ? "/change-password" : "/dashboard");
  }, [hasHydrated, token, user, router]);

  return <FullScreenLoading />;
}
