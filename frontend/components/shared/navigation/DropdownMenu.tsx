"use client";

/**
 * DropdownMenu — WACC-P0-015
 *
 * A minimal, keyboard-accessible dropdown primitive used by the profile menu.
 * Features: arrow keys to move focus, Escape to close, focus returns to trigger on close.
 * Built without any external dependency — plain HTML + CSS + React.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ── Context ───────────────────────────────────────────────── */

interface DropdownCtx {
  open: boolean;
  triggerId: string;
  menuId: string;
  open_: () => void;
  close: () => void;
  toggle: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownCtx | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu parts must be used inside <DropdownMenu>");
  return ctx;
}

/* ── Root ──────────────────────────────────────────────────── */

export function DropdownMenu({ children }: { children: ReactNode }) {
  const uid = useId();
  const triggerId = `dropdown-trigger-${uid}`;
  const menuId = `dropdown-menu-${uid}`;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open_ = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to trigger on close.
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const menu = document.getElementById(menuId);
      const trigger = document.getElementById(triggerId);
      if (!menu?.contains(e.target as Node) && !trigger?.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, menuId, triggerId, close]);

  return (
    <DropdownContext.Provider value={{ open, triggerId, menuId, open_, close, toggle, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

/* ── Trigger ───────────────────────────────────────────────── */

export function DropdownTrigger({
  children,
  className,
  asChild,
}: {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  const { open, toggle, triggerId, menuId, triggerRef } = useDropdown();

  if (asChild && typeof children === "object" && children !== null && "type" in (children as object)) {
    // Pass through to child button — not supported in this minimal impl; render as-is.
  }

  return (
    <button
      id={triggerId}
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={toggle}
      className={className}
    >
      {children}
    </button>
  );
}

/* ── Content ───────────────────────────────────────────────── */

export function DropdownContent({
  children,
  align = "right",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  const { open, menuId, close } = useDropdown();
  const menuRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const items = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])")
    );
    if (items.length > 0) items[0].focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const focused = document.activeElement as HTMLElement;
      const idx = items.indexOf(focused);
      let next = idx;
      if (e.key === "ArrowDown") next = Math.min(idx + 1, items.length - 1);
      if (e.key === "ArrowUp") next = Math.max(idx - 1, 0);
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = items.length - 1;
      items[next]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      id={menuId}
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className={[
        "absolute top-full z-50 mt-1 min-w-[200px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elevation-2)]",
        "py-1 focus:outline-none",
        align === "right" ? "right-0" : "left-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* ── Item ──────────────────────────────────────────────────── */

export function DropdownItem({
  children,
  onClick,
  href,
  className,
  dangerous,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  dangerous?: boolean;
}) {
  const { close } = useDropdown();
  const base =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left rounded-none transition-colors focus:outline-none focus-visible:bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle)] cursor-pointer";
  const color = dangerous
    ? "text-[var(--danger)]"
    : "text-[var(--text-primary)]";

  function handleClick() {
    close();
    onClick?.();
  }

  if (href) {
    return (
      <a
        href={href}
        role="menuitem"
        className={[base, color, className].filter(Boolean).join(" ")}
        onClick={close}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={[base, color, className].filter(Boolean).join(" ")}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

/* ── Separator ─────────────────────────────────────────────── */

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-[var(--border)]" />;
}

/* ── Label ─────────────────────────────────────────────────── */

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </p>
  );
}
