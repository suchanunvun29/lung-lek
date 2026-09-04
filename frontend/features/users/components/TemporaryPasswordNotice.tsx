"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface TemporaryPasswordNoticeProps {
  email: string;
  temporaryPassword: string;
  onDismiss: () => void;
}

export function TemporaryPasswordNotice({
  email,
  temporaryPassword,
  onDismiss,
}: TemporaryPasswordNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can fail (e.g. insecure context) — the password is still shown on screen
    }
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4">
      <p className="text-sm font-medium text-warning">
        รหัสผ่านชั่วคราวสำหรับ {email} — ระบบจะแสดงครั้งนี้ครั้งเดียวเท่านั้น กรุณาคัดลอกไปให้ผู้ใช้ทันที
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="rounded bg-surface border border-border px-3 py-1.5 font-mono text-sm text-text-primary">
          {temporaryPassword}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="border-warning/40 text-warning hover:bg-warning-subtle"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-sm text-amber-700 hover:underline cursor-pointer"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

export default TemporaryPasswordNotice;
