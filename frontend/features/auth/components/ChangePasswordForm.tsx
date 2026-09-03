"use client";

import { FormEvent, useState } from "react";
import { changePassword } from "@/features/auth/api/auth.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Matches MIN_PASSWORD_LENGTH in backend/src/validators/auth.validators.ts
const MIN_PASSWORD_LENGTH = 8;

export interface ChangePasswordFormProps {
  onSuccess: () => void;
  submitLabel: string;
}

export function ChangePasswordForm({ onSuccess, submitLabel }: ChangePasswordFormProps) {
  const token = useAuthStore((state) => state.token);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน");
      return;
    }
    if (!token) {
      setError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    setLoading(true);
    try {
      await changePassword(token, currentPassword, newPassword);
      updateUser({ mustChangePassword: false });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-medium text-zinc-700">
          รหัสผ่านปัจจุบัน
        </label>
        <Input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-zinc-700">
          รหัสผ่านใหม่
        </label>
        <Input
          id="newPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <p className="text-xs text-zinc-500">อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
          ยืนยันรหัสผ่านใหม่
        </label>
        <Input
          id="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="bg-zinc-900 text-white hover:bg-zinc-800"
      >
        {loading ? "กำลังบันทึก..." : submitLabel}
      </Button>
    </form>
  );
}

export default ChangePasswordForm;
