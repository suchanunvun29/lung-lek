"use client";

import * as React from "react";

/**
 * useDialogA11y — T-UX-005
 *
 * The one focus-management behavior for every modal overlay in the app
 * (Modal, FilterDrawer, the Sidebar mobile drawer): focus trap, Escape to
 * close, initial focus, and focus restore on close.
 *
 * Nested overlays register on a module-level stack. Only the TOPMOST open
 * overlay responds to Escape and Tab, so a ConfirmDialog over a Modal — or
 * the Sidebar drawer over the FilterDrawer — never both close on one Escape
 * and never fight over focus. Body scroll is locked by the first overlay
 * and unlocked only when the last one closes.
 *
 * Focus restore: when the top overlay closes, focus returns to the element
 * that was focused before it opened (or `returnFocusRef`), guarded against
 * a target that has since unmounted. A non-top overlay closing underneath
 * a newer one does not steal focus.
 */

export interface UseDialogA11yOptions {
  /** Whether the overlay is currently shown. */
  isOpen: boolean;
  /** Called on Escape — only when this overlay is the topmost one. */
  onClose: () => void;
  /** Element to focus on open. Defaults to the first focusable inside the container, else the container itself. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Element to restore focus to on close. Defaults to the element focused before the overlay opened. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focusable AND actually rendered — display:none / hidden elements match the
 * selector but can never receive focus, and counting them breaks the wrap. */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => el.getClientRects().length > 0);
}

/** Stack of currently open overlays; the last entry is the topmost. */
const openOverlays: object[] = [];
let scrollLockOwner: object | null = null;
let scrollLockPreviousOverflow = "";

export function useDialogA11y(
  containerRef: React.RefObject<HTMLElement | null>,
  { isOpen, onClose, initialFocusRef, returnFocusRef }: UseDialogA11yOptions
) {
  // Latest onClose without resubscribing the document listener on every render.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const token = {};
    const isTopWhenOpened = openOverlays.length === 0;
    openOverlays.push(token);

    const previouslyFocused =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    if (isTopWhenOpened) {
      scrollLockOwner = token;
      scrollLockPreviousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    // Initial focus — refs are attached before effects run, so the container
    // and any conditionally rendered children exist at this point.
    const container = containerRef.current;
    if (container) {
      const target =
        initialFocusRef?.current ??
        getFocusableElements(container)[0] ??
        container;
      target.focus();
    }

    function isTopOverlay(): boolean {
      return openOverlays[openOverlays.length - 1] === token;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isTopOverlay()) return;
      const container = containerRef.current;
      if (!container) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const focusable = getFocusableElements(container);
        if (focusable.length === 0) {
          event.preventDefault();
          container.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;
        if (event.shiftKey) {
          if (current === first || !container.contains(current)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (current === last || !container.contains(current)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      const wasTop = openOverlays[openOverlays.length - 1] === token;
      const index = openOverlays.indexOf(token);
      if (index !== -1) openOverlays.splice(index, 1);

      if (scrollLockOwner === token) {
        document.body.style.overflow = scrollLockPreviousOverflow;
        scrollLockOwner = null;
        scrollLockPreviousOverflow = "";
      }

      // Reading the ref at cleanup time is the point: the restore target is
      // whatever the consumer points at when the dialog CLOSES, not when it opens.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const restoreTarget = returnFocusRef?.current ?? previouslyFocused;
      if (
        wasTop &&
        restoreTarget &&
        document.contains(restoreTarget) &&
        typeof restoreTarget.focus === "function"
      ) {
        restoreTarget.focus();
      }
    };
  }, [isOpen, containerRef, initialFocusRef, returnFocusRef]);
}
