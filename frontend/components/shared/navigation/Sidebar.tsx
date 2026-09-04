"use client";

/**
 * Sidebar — WACC-P0-014
 *
 * Three modes driven by breakpoint and user interaction:
 *  - Desktop (≥1280px): expanded (256px) or collapsed to icons (64px), persisted in localStorage.
 *  - Tablet (1024–1279px): always collapsed to icons; collapse toggle unavailable.
 *  - Mobile / narrow tablet (<1024px): hidden; opened as a drawer from the header hamburger.
 *
 * Active state uses startsWith on the group's base path + exact match on the leaf item,
 * so `/territories/moves` highlights the "พื้นที่และลูกค้า" group even though it was
 * previously an orphan route.
 *
 * Role filter is applied per-item. The `managerOnly` flag is copied verbatim from
 * NavBar.tsx — no entry's rule is changed here.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  NAV_GROUPS,
  isGroupActive,
  isItemActive,
} from "./navigation.config";
import type { UserRole } from "@/lib/types";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 64;

export interface SidebarProps {
  role: UserRole;
  /** Controlled by AppShell for mobile drawer. */
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
}

export function Sidebar({ role, drawerOpen = false, onDrawerClose }: SidebarProps) {
  const pathname = usePathname();

  // Collapse state — persisted, only relevant at ≥1280px.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  // Close drawer on route change.
  useEffect(() => {
    onDrawerClose?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  // Visible items for this role.
  function isVisible(managerOnly?: boolean) {
    return !managerOnly || role === "MANAGER";
  }

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Brand / logo row */}
      <div
        className="flex h-14 shrink-0 items-center border-b border-[var(--border)] px-3"
        style={{ minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      >
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            ระบบประเมินพนักงานขาย
          </span>
        )}
        {collapsed && (
          <span className="mx-auto text-lg font-bold text-[var(--primary)]">SE</span>
        )}
      </div>

      {/* Nav groups */}
      <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => isVisible(item.managerOnly));
          if (visibleItems.length === 0) return null;
          if (group.managerOnly && !isVisible(group.managerOnly)) return null;

          const groupActive = isGroupActive(group, pathname);
          // Divider before ตั้งค่า group (last group)
          const showDivider = gi === NAV_GROUPS.length - 1;

          return (
            <div key={group.label}>
              {showDivider && (
                <div className="my-2 border-t border-[var(--border)]" />
              )}
              {!collapsed && (
                <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.label}
                </p>
              )}
              <ul role="list" className="space-y-0.5 px-1.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item, pathname);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={[
                          "flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm font-medium transition-colors",
                          "min-h-[40px]",
                          active
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : groupActive
                            ? "text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        <Icon
                          size={18}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only (hidden below 1280px via parent) */}
      <div className="hidden shrink-0 border-t border-[var(--border)] p-1.5 xl:block">
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>ย่อเมนู</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop / large tablet sidebar (≥1024px) ── */}
      <aside
        className="hidden lg:flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200"
        style={{
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        }}
        aria-label="แถบเมนูด้านข้าง"
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile drawer (< 1024px) ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-hidden="true"
            onClick={onDrawerClose}
          />
          {/* Drawer panel */}
          <aside
            className="fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--surface)] shadow-[var(--elevation-2)] lg:hidden"
            style={{ width: EXPANDED_WIDTH }}
            aria-label="แถบเมนูด้านข้าง"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onDrawerClose}
              aria-label="ปิดเมนู"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

export default Sidebar;
