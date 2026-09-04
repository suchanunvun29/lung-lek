"use client";

/**
 * AppShell — WACC-P0-014 / WACC-P0-015
 *
 * Sidebar + header + <main> wrapper that replaces the flat NavBar.
 * Every page under app/(protected) gains sidebar, breadcrumb and context for free.
 * No page file is edited — the swap is in app/(protected)/layout.tsx only.
 *
 * Skip link: "ข้ามไปยังเนื้อหาหลัก" moves focus to #main-content on activation.
 * Page background uses --surface-sunken (matches bg-surface-sunken).
 */

import { useState } from "react";
import { Sidebar } from "@/components/shared/navigation/Sidebar";
import { AppHeader } from "@/components/shared/layout/AppHeader";
import { useAuthStore } from "@/store/useAuthStore";
import type { BreadcrumbSegment } from "@/components/shared/navigation/Breadcrumb";

export interface AppShellProps {
  children: React.ReactNode;
  /** Optional breadcrumb override for dynamic-route pages (passed down to AppHeader). */
  breadcrumbSegments?: BreadcrumbSegment[];
}

export function AppShell({ children, breadcrumbSegments }: AppShellProps) {
  const user = useAuthStore((state) => state.user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleDrawer() {
    setDrawerOpen((v) => !v);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <>
      {/* Skip link — hidden until focused */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[var(--radius-md)] focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--primary-foreground)] focus:shadow-[var(--elevation-1)]"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <div className="flex min-h-screen">
        {/* Sidebar (desktop persistent + mobile drawer) */}
        <Sidebar
          role={user?.role ?? "SALESPERSON"}
          drawerOpen={drawerOpen}
          onDrawerClose={closeDrawer}
        />

        {/* Right column: header + main */}
        <div className="flex flex-1 min-w-0 flex-col">
          <AppHeader
            onMenuToggle={toggleDrawer}
            breadcrumbSegments={breadcrumbSegments}
          />

          <main
            id="main-content"
            className="flex-1 bg-[var(--surface-sunken)]"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

export default AppShell;
