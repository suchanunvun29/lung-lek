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

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  NAV_GROUPS,
  isGroupActive,
  isItemActive,
} from "./navigation.config";
import { useQueueCounts, type QueueBadgeKey } from "./useQueueCounts";
import { useDialogA11y } from "@/lib/useDialogA11y";
import type { UserRole } from "@/lib/types";
import { docsUrl } from "@/lib/docs";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 64;

export interface SidebarProps {
  role: UserRole;
  /** Controlled by AppShell for mobile drawer. */
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
}

// Collapse state — persisted in localStorage, only relevant at ≥1280px.
// Read as an external store (T-UX-020 / UX-031): hydration renders the server
// snapshot (expanded) first, then the stored value applies after mount — no
// hydration mismatch and no setState-in-effect. Cross-tab changes propagate
// via the native `storage` event; in-tab toggles dispatch a local event.
const SIDEBAR_COLLAPSED_CHANGE = "sidebar-collapsed-change";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(SIDEBAR_COLLAPSED_CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getCollapsedSnapshot(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function Sidebar({ role, drawerOpen = false, onDrawerClose }: SidebarProps) {
  const pathname = usePathname();
  // WACC-P1-015 — lazy queue counts (fetched once after first paint, MANAGER only).
  const queueCounts = useQueueCounts(role);

  function badgeValueFor(badgeKey?: string): number | undefined {
    if (!badgeKey || !(badgeKey in queueCounts)) return undefined;
    const value = queueCounts[badgeKey as QueueBadgeKey];
    return typeof value === "number" ? value : undefined;
  }

  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, () => false);

  // Close drawer on route change.
  useEffect(() => {
    onDrawerClose?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Mobile drawer dialog behavior — trap, Escape, initial focus, restore to
  // the hamburger (T-UX-005). The desktop <aside> below is NOT a dialog and
  // never goes through this hook.
  const drawerPanelRef = useRef<HTMLElement>(null);
  useDialogA11y(drawerPanelRef, {
    isOpen: drawerOpen,
    onClose: () => onDrawerClose?.(),
  });

  function toggleCollapse() {
    const next = !collapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE));
  }

  // Visible items for this role.
  function isVisible(managerOnly?: boolean) {
    return !managerOnly || role === "MANAGER";
  }

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Brand / logo row */}
      <div
        className="flex h-14 shrink-0 items-center border-b border-[var(--border)] px-4"
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
              {/* TODO(a11y): role="list" is deliberate — Tailwind preflight strips list-style,
                  which removes list semantics from Safari/VoiceOver; the role restores them. */}
              {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
              <ul role="list" className="space-y-0.5 px-1.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item, pathname);
                  const Icon = item.icon;
                  const badge = badgeValueFor(item.badgeKey);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={
                          badge !== undefined
                            ? `${item.label} มี ${badge.toLocaleString("th-TH")} รายการรอจัดการ`
                            : undefined
                        }
                        title={
                          collapsed
                            ? badge !== undefined
                              ? `${item.label} (${badge.toLocaleString("th-TH")})`
                              : item.label
                            : undefined
                        }
                        className={[
                          "relative flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm font-medium transition-colors",
                          "min-h-[40px]",
                          active
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : groupActive
                            ? "text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        <span className="relative shrink-0">
                          <Icon size={18} aria-hidden="true" />
                          {/* Collapsed: a dot carries the signal; the count lives in the
                              accessible name (aria-label / title) above. */}
                          {collapsed && badge !== undefined && (
                            <span
                              className="absolute -right-1.5 -top-1 flex h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-[var(--surface)]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && badge !== undefined && (
                          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold leading-none text-danger-foreground">
                            {badge > 99 ? "99+" : badge.toLocaleString("th-TH")}
                          </span>
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

      <div className="shrink-0 border-t border-[var(--border)] p-1.5">
        <a
          href={docsUrl("/")}
          target="_blank"
          rel="noopener"
          onClick={onDrawerClose}
          title={collapsed ? "คู่มือการใช้งาน" : undefined}
          className="flex min-h-[40px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
        >
          <BookOpen size={16} aria-hidden="true" />
          {!collapsed && <span>คู่มือการใช้งาน</span>}
        </a>
      </div>

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
            className="fixed inset-0 z-(--z-drawer) bg-scrim lg:hidden"
            aria-hidden="true"
            onClick={onDrawerClose}
          />
          {/* Drawer panel — dialog semantics only while it is an overlay (<1024px).
              Only rendered when drawerOpen, so the role never reaches desktop. */}
          <aside
            ref={drawerPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="เมนูหลัก"
            tabIndex={-1}
            className="fixed inset-y-0 left-0 z-(--z-drawer) flex flex-col bg-[var(--surface)] shadow-[var(--elevation-2)] outline-none lg:hidden"
            style={{ width: EXPANDED_WIDTH }}
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
