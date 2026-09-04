"use client";

import { FormEvent, useState } from "react";
import { UpdateUserInput } from "@/features/users/api/users.api";
import { getErrorMessage } from "@/lib/api-client";
import { AppUser, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface EditUserFormProps {
  user: AppUser;
  onSubmit: (input: UpdateUserInput) => Promise<void>;
  onCancel: () => void;
}

export function EditUserForm({ user, onSubmit, onCancel }: EditUserFormProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitChanges(input: UpdateUserInput) {
    setError(null);
    setLoading(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(getErrorMessage(err, "บันทึกไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitChanges({ displayName, role, isActive });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-displayName" className="text-sm font-medium text-text-primary">
          ชื่อที่แสดง
        </label>
        <Input
          id="edit-displayName"
          type="text"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-role" className="text-sm font-medium text-text-primary">
          บทบาท
        </label>
        <Select
          id="edit-role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          <option value="SALESPERSON">พนักงานขาย</option>
          <option value="MANAGER">ผู้จัดการ</option>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
        />
        เปิดใช้งานบัญชีนี้
      </label>

      <div className="rounded-md border border-border bg-surface-subtle p-3">
        <p className="text-sm text-text-primary">
          ผูกกับพนักงานขาย:{" "}
          <span className="font-medium">
            {user.salesperson ? user.salesperson.displayName : "ยังไม่ได้ผูก"}
          </span>
        </p>
        {user.salesperson ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void submitChanges({ salespersonId: null })}
            className="mt-2 text-sm text-danger hover:underline disabled:opacity-50 cursor-pointer"
          >
            ยกเลิกการผูก
          </button>
        ) : (
          <p className="mt-1 text-xs text-text-muted">
            จะเลือกผูกได้หลังนำเข้าข้อมูลการขาย เมื่อรายชื่อพนักงานขายเข้าระบบแล้ว
          </p>
        )}
      </div>

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
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}

export default EditUserForm;
