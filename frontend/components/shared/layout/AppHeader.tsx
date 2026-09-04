"use client";

/**
 * AppHeader — WACC-P0-015
 *
 * One header row (desktop): breadcrumb left, context controls and profile menu right.
 * Mobile: hamburger + compressed breadcrumb + icon profile button + full-width context row below.
 *
 * Profile menu: display name, role badge, /account link, logout.
 * Logout calls useAuthStore.logout(), useContextStore.reset(), then redirects to /login.
 */

import { useRouter } from "next/navigation";
import { Menu, User, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { Breadcrumb } from "@/components/shared/navigation/Breadcrumb";
import { ContextBar } from "@/components/shared/layout/ContextBar";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/shared/navigation/DropdownMenu";
import type { BreadcrumbSegment } from "@/components/shared/navigation/Breadcrumb";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SALESPERSON: "พนักงานขาย",
};

export interface AppHeaderProps {
  /** Called when the hamburger button is clicked — controlled by AppShell. */
  onMenuToggle: () => void;
  /** Optional breadcrumb override for dynamic routes. */
  breadcrumbSegments?: BreadcrumbSegment[];
}

export function AppHeader({ onMenuToggle, breadcrumbSegments }: AppHeaderProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const resetContext = useContextStore((state) => state.reset);

  function handleLogout() {
    logout();
    resetContext();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
      {/* Main header row */}
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        {/* Hamburger — visible below lg breakpoint */}
        <button
          type="button"
          aria-label="เปิดเมนู"
          onClick={onMenuToggle}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {/* Breadcrumb — fills available space */}
        <div className="flex-1 overflow-hidden">
          <Breadcrumb segments={breadcrumbSegments} />
        </div>

        {/* Context controls — hidden on mobile, shown on sm+ */}
        <div className="hidden sm:flex items-center gap-3">
          <ContextBar />
        </div>

        {/* Profile menu */}
        {user && (
          <DropdownMenu>
            <DropdownTrigger
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <User size={18} aria-hidden="true" />
              <span className="sr-only">เมนูโปรไฟล์</span>
            </DropdownTrigger>
            <DropdownContent align="right">
              <DropdownLabel>
                <span className="block font-medium text-[var(--text-primary)]">{user.displayName}</span>
                <span className="block text-[var(--text-muted)]">{ROLE_LABEL_TH[user.role]}</span>
              </DropdownLabel>
              <DropdownSeparator />
              <DropdownItem href="/account">
                <Settings size={14} aria-hidden="true" />
                บัญชีของฉัน
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={handleLogout} dangerous>
                <LogOut size={14} aria-hidden="true" />
                ออกจากระบบ
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mobile context row — full-width, shown only on mobile */}
      <div className="sm:hidden border-t border-[var(--border)] px-3 py-2">
        <ContextBar />
      </div>
    </header>
  );
}

export default AppHeader;
