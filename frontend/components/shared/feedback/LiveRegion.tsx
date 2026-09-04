"use client";

/**
 * LiveRegion — WACC-P3-009
 *
 * Provides dedicated aria-live announcement regions for asynchronous state changes
 * (e.g. "กำลังบันทึก...", "บันทึกสำเร็จ", "เกิดข้อผิดพลาด").
 *
 * Screen readers will announce polite updates when idle, and assertive updates immediately.
 */

import * as React from "react";

export type AnnouncementType = "polite" | "assertive";

interface Announcement {
  id: number;
  message: string;
  type: AnnouncementType;
}

type Listener = (announcement: Announcement) => void;
const listeners = new Set<Listener>();

let nextId = 1;

/**
 * Announce a message to screen readers via aria-live.
 * - "polite" (default): announces after current speech, suitable for status updates, loading complete, save success.
 * - "assertive": announces immediately, interrupts speech, suitable for errors or critical alerts.
 */
export function announce(message: string, type: AnnouncementType = "polite") {
  if (typeof window === "undefined" || !message) return;
  const item: Announcement = { id: nextId++, message, type };
  listeners.forEach((listener) => listener(item));
}

/**
 * React hook returning the announce function.
 */
export function useAnnounce() {
  return React.useCallback((message: string, type: AnnouncementType = "polite") => {
    announce(message, type);
  }, []);
}

export function LiveRegion() {
  const [politeMessage, setPoliteMessage] = React.useState("");
  const [assertiveMessage, setAssertiveMessage] = React.useState("");

  React.useEffect(() => {
    const handleAnnouncement: Listener = ({ message, type }) => {
      if (type === "assertive") {
        setAssertiveMessage("");
        requestAnimationFrame(() => setAssertiveMessage(message));
      } else {
        setPoliteMessage("");
        requestAnimationFrame(() => setPoliteMessage(message));
      }
    };

    listeners.add(handleAnnouncement);
    return () => {
      listeners.delete(handleAnnouncement);
    };
  }, []);

  return (
    <div aria-hidden={false} className="sr-only">
      {/* Polite live region for status updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id="a11y-live-region-polite"
      >
        {politeMessage}
      </div>

      {/* Assertive live region for critical alerts */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        id="a11y-live-region-assertive"
      >
        {assertiveMessage}
      </div>
    </div>
  );
}

export default LiveRegion;
