"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  requireTypedConfirmation?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  consequence,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "default",
  requireTypedConfirmation,
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmDialogProps) {
  const [typedInput, setTypedInput] = React.useState("");
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  const isConfirmedAllowed =
    !pending &&
    (!requireTypedConfirmation || typedInput === requireTypedConfirmation);

  const handleConfirm = async () => {
    if (!isConfirmedAllowed) return;
    await onConfirm();
  };

  return (
    <Modal
      title={title}
      onClose={pending ? () => {} : onCancel}
      initialFocusRef={tone === "danger" ? cancelButtonRef : confirmButtonRef}
      closeOnBackdrop={!pending}
      widthClassName="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{description}</p>

        {consequence && (
          <div className="rounded-md border border-danger/20 bg-danger-subtle p-3 text-xs text-danger">
            <span className="font-semibold">ข้อควรระวัง: </span>
            {consequence}
          </div>
        )}

        {requireTypedConfirmation && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-text-secondary">
              พิมพ์คำว่า <span className="font-bold select-all text-text-primary">{requireTypedConfirmation}</span> เพื่อยืนยัน:
            </label>
            <Input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={requireTypedConfirmation}
              disabled={pending}
              className="font-mono text-sm"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={() => void handleConfirm()}
            disabled={!isConfirmedAllowed}
            className="w-full sm:w-auto"
          >
            {pending ? "กำลังดำเนินการ..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}