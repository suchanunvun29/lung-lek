"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useDialogA11y } from "@/lib/useDialogA11y";

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the modal panel — defaults to a small form-sized modal. */
  widthClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
}

const emptySubscribe = () => () => {};

export function Modal({
  title,
  onClose,
  children,
  widthClassName = "max-w-md",
  initialFocusRef,
  closeOnBackdrop = true,
}: ModalProps) {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Trap + Escape + initial focus + restore (T-UX-005) — shared with
  // FilterDrawer and the Sidebar mobile drawer.
  useDialogA11y(modalRef, { isOpen: mounted, onClose, initialFocusRef });

  if (!mounted) return null;

  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
     TODO(a11y): the scrim click is pointer-only convenience for dismissing the dialog;
     the keyboard path out is Escape (useDialogA11y) and the dialog's own buttons. */
  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "w-full rounded-lg bg-surface p-6 shadow-elevation-2 border border-border outline-none max-h-[90vh] flex flex-col my-auto",
          widthClassName
        )}
      >
        <div className="mb-4 flex items-center justify-between shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary rounded-md p-1.5 transition-colors cursor-pointer min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 flex items-center justify-center"
            aria-label="ปิด"
          >
            <span aria-hidden="true" className="text-base font-semibold">✕</span>
          </button>
        </div>
        <div className="overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
  /* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */

  return createPortal(content, document.body);
}

export default Modal;

