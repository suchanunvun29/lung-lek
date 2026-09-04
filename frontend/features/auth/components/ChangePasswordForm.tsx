"use client";

import { FormEvent, useState } from "react";
import { changePassword } from "@/features/auth/api/auth.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form/FormField";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { announce } from "@/components/shared/feedback/LiveRegion";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    let hasFieldError = false;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setNewPasswordError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      hasFieldError = true;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน");
      hasFieldError = true;
    }

    if (hasFieldError) {
      return;
    }

    if (!token) {
      setFormError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
      return;
    }

    setLoading(true);
    announce("กำลังเปลี่ยนรหัสผ่าน...", "polite");
    try {
      await changePassword(token, currentPassword, newPassword);
      updateUser({ mustChangePassword: false });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      announce("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", "polite");
      onSuccess();
    } catch (err) {
      const msg = getErrorMessage(err, "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
      setFormError(msg);
      announce(msg, "assertive");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        id="currentPassword"
        label="รหัสผ่านปัจจุบัน"
        required
      >
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            if (formError) setFormError(null);
          }}
          className="h-11 sm:h-9"
        />
      </FormField>

      <FormField
        id="newPassword"
        label="รหัสผ่านใหม่"
        hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
        error={newPasswordError}
        required
      >
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            if (newPasswordError) setNewPasswordError(null);
          }}
          className="h-11 sm:h-9"
        />
      </FormField>

      <FormField
        id="confirmPassword"
        label="ยืนยันรหัสผ่านใหม่"
        error={confirmPasswordError}
        required
      >
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            if (confirmPasswordError) setConfirmPasswordError(null);
          }}
          className="h-11 sm:h-9"
        />
      </FormField>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 text-sm">{formError}</div>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="mt-2 w-full min-h-[44px] sm:min-h-[36px]"
      >
        {loading ? "กำลังบันทึก..." : submitLabel}
      </Button>
    </form>
  );
}

export default ChangePasswordForm;
