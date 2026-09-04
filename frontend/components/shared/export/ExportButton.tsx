"use client";

/**
 * ExportButton — WACC-P0-019
 *
 * The one export control with real pending / success / failure states, replacing
 * the hand-written export button on every screen that has one. Export is the
 * deliverable of this product — a failed export must never surface as a bare red
 * paragraph or an untranslated English string.
 *
 * ── Placement rule ────────────────────────────────────────────────────────────
 * Secondary action inside PageHeader when the export is page-scoped, or the
 * tab's secondary action when the export is tab-scoped (/my-territory).
 *
 * ── Behavior ──────────────────────────────────────────────────────────────────
 * • `onExport` is an async function calling `downloadFile` — the filename comes
 *   from the response's Content-Disposition header, which downloadFile already
 *   parses; nothing here changes the file, its name, or its query parameters.
 * • While pending the button is disabled and a second click does nothing
 *   (duplicate-submit guard).
 * • Failures render through InlineMessage with `getErrorMessage`, so users read
 *   Thai, never raw English. A cancelled request (AbortError) is not a failure.
 * • Success shows a brief confirmation and clears itself after a few seconds.
 * • Export permission stays enforced server-side; the screen hides or disables
 *   this button exactly where it did before.
 *
 * Desktop/tablet: secondary action in the page header.
 * Mobile: full-width 44px button; the pending state is visible without hovering.
 */

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InlineMessage } from "@/components/shared/feedback/InlineMessage";
import { getErrorMessage, isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SUCCESS_AUTO_CLEAR_MS = 4000;

export interface ExportButtonProps {
  /** Async function that calls `downloadFile` (and resolves when it completes). */
  onExport: () => Promise<void>;
  label?: string;
  disabled?: boolean;
  /** Shown as a tooltip / screen-reader text explaining why the button is disabled. */
  disabledReason?: string;
  className?: string;
}

export function ExportButton({
  onExport,
  label = "ส่งออก Excel",
  disabled = false,
  disabledReason,
  className,
}: ExportButtonProps) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "destructive"; text: string } | null>(null);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  async function handleExport() {
    if (pending || disabled) return;
    setPending(true);
    setMessage(null);
    try {
      await onExport();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      setMessage({ tone: "success", text: "ดาวน์โหลดไฟล์สำเร็จ" });
      clearTimerRef.current = setTimeout(() => setMessage(null), SUCCESS_AUTO_CLEAR_MS);
    } catch (error) {
      if (isAbortError(error)) return; // cancelled, not failed
      setMessage({
        tone: "destructive",
        text: getErrorMessage(error, "ส่งออกไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleExport()}
        disabled={disabled || pending}
        aria-busy={pending}
        title={disabled && disabledReason ? disabledReason : undefined}
        className="min-h-[44px]"
      >
        {pending ? (
          <>
            <Spinner size="sm" className="mr-2" />
            กำลังส่งออก…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {label}
          </>
        )}
        {disabled && disabledReason && <span className="sr-only">{disabledReason}</span>}
      </Button>

      {message && (
        <InlineMessage variant={message.tone} className="max-w-sm text-sm">
          {message.text}
        </InlineMessage>
      )}
    </div>
  );
}

export default ExportButton;
