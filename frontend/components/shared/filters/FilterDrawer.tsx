"use client";

/**
 * FilterDrawer — WACC-P0-018
 *
 * The <768px filter surface. FilterBar collapses to a single "ตัวกรอง (N)" button
 * that opens this bottom-sheet drawer with the SAME controls the desktop bar
 * renders (they are passed as children — state stays owned by the screen, so the
 * drawer is purely presentational).
 *
 * Controls are forced to 44px targets. Apply ("ใช้ตัวกรอง") calls `onApply` (if
 * provided) and closes; Reset ("ล้างตัวกรอง") calls `onReset`, which must return
 * the screen to its documented default state — not merely "everything cleared".
 *
 * Escape closes; focus moves into the panel on open; body scroll is locked while
 * open. Rendered only below 768px (`md:hidden`) regardless of the `open` value.
 */

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called when the drawer's Apply button is pressed (the drawer closes itself). */
  onApply?: () => void;
  /** Called when the drawer's Reset button is pressed; restores documented defaults. */
  onReset?: () => void;
  /** Drawer heading, announced as the dialog's name. Default "ตัวกรอง". */
  title?: string;
  /** The same filter controls the desktop bar renders. */
  children: React.ReactNode;
}

export function FilterDrawer({
  open,
  onClose,
  onApply,
  onReset,
  title = "ตัวกรอง",
  children,
}: FilterDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-border bg-surface shadow-[var(--elevation-2)]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดตัวกรอง"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* 44px touch targets for every select inside the drawer. */}
        <div className="space-y-4 p-4 [&_select]:h-11 [&_select]:min-h-[44px]">{children}</div>

        <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface p-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={() => onReset?.()}
          >
            ล้างตัวกรอง
          </Button>
          <Button
            type="button"
            className="min-h-[44px] flex-1"
            onClick={() => {
              onApply?.();
              onClose();
            }}
          >
            ใช้ตัวกรอง
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FilterDrawer;
