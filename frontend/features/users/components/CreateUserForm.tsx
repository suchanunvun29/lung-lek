"use client";

import { FormEvent, useState } from "react";
import { CreateUserInput } from "@/features/users/api/users.api";
import { getErrorMessage } from "@/lib/api-client";
import { UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface CreateUserFormProps {
  onSubmit: (input: CreateUserInput) => Promise<void>;
  onCancel: () => void;
}

export function CreateUserForm({ onSubmit, onCancel }: CreateUserFormProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("SALESPERSON");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ email, displayName, role });
    } catch (err) {
      setError(getErrorMessage(err, "สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-email" className="text-sm font-medium text-text-primary">
          อีเมล
        </label>
        <Input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-displayName" className="text-sm font-medium text-text-primary">
          ชื่อที่แสดง
        </label>
        <Input
          id="new-displayName"
          type="text"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-role" className="text-sm font-medium text-text-primary">
          บทบาท
        </label>
        <Select
          id="new-role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          <option value="SALESPERSON">พนักงานขาย</option>
          <option value="MANAGER">ผู้จัดการ</option>
        </Select>
      </div>
      <p className="text-xs text-text-muted">
        ระบบจะสุ่มรหัสผ่านชั่วคราวให้อัตโนมัติ และบังคับให้เปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งแรก
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? "กำลังสร้าง..." : "สร้างบัญชี"}
        </Button>
      </div>
    </form>
  );
}

export default CreateUserForm;
