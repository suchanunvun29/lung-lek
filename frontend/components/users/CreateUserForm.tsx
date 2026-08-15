"use client";

import { FormEvent, useState } from "react";
import { CreateUserInput, getErrorMessage } from "@/lib/api";
import { UserRole } from "@/lib/types";

interface CreateUserFormProps {
  onSubmit: (input: CreateUserInput) => Promise<void>;
  onCancel: () => void;
}

export default function CreateUserForm({ onSubmit, onCancel }: CreateUserFormProps) {
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
        <label htmlFor="new-email" className="text-sm font-medium text-zinc-700">
          อีเมล
        </label>
        <input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-displayName" className="text-sm font-medium text-zinc-700">
          ชื่อที่แสดง
        </label>
        <input
          id="new-displayName"
          type="text"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-role" className="text-sm font-medium text-zinc-700">
          บทบาท
        </label>
        <select
          id="new-role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="SALESPERSON">พนักงานขาย</option>
          <option value="MANAGER">ผู้จัดการ</option>
        </select>
      </div>
      <p className="text-xs text-zinc-500">
        ระบบจะสุ่มรหัสผ่านชั่วคราวให้อัตโนมัติ และบังคับให้เปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งแรก
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "กำลังสร้าง..." : "สร้างบัญชี"}
        </button>
      </div>
    </form>
  );
}
