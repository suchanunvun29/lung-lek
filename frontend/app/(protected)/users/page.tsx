"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreateUserInput,
  UpdateUserInput,
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  CreateUserForm,
  EditUserForm,
  TemporaryPasswordNotice,
} from "@/features/users";
import { AppUser } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SALESPERSON: "พนักงานขาย",
};

interface TemporaryPasswordState {
  email: string;
  temporaryPassword: string;
}

export default function UsersPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetUserTarget, setResetUserTarget] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<TemporaryPasswordState | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const unlinkedSalespersonUsers = users.filter((user) => user.role === "SALESPERSON" && !user.isSalespersonLinked);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listUsers(token);
      setUsers(data.users);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  if (currentUser?.role !== "MANAGER") {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          หน้านี้สำหรับผู้จัดการเท่านั้น
        </p>
      </div>
    );
  }

  async function handleCreate(input: CreateUserInput) {
    if (!token) return;
    const data = await createUser(token, input);
    setUsers((prev) => [...prev, data.user]);
    setTempPassword({ email: data.user.email, temporaryPassword: data.temporaryPassword });
    setCreateOpen(false);
  }

  async function handleUpdate(id: number, input: UpdateUserInput) {
    if (!token) return;
    const data = await updateUser(token, id, input);
    setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
    setEditingUser(null);
  }

  async function handleToggleActive(target: AppUser) {
    if (!token) return;
    const action = target.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน";
    if (!window.confirm(`ยืนยัน${action}บัญชีของ ${target.displayName}?`)) return;

    setBusyUserId(target.id);
    try {
      const data = await updateUser(token, target.id, { isActive: !target.isActive });
      setUsers((prev) => prev.map((u) => (u.id === target.id ? data.user : u)));
    } catch (err) {
      window.alert(getErrorMessage(err, "ทำรายการไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResetPassword(target: AppUser) {
    if (!token) return;

    setBusyUserId(target.id);
    try {
      const data = await resetUserPassword(token, target.id);
      setTempPassword({ email: target.email, temporaryPassword: data.temporaryPassword });
      setResetUserTarget(null);
      void loadUsers();
    } catch (err) {
      window.alert(getErrorMessage(err, "รีเซ็ตรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">จัดการบัญชีผู้ใช้งาน</h1>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-zinc-900 text-white hover:bg-zinc-800"
          size="sm"
        >
          + สร้างบัญชีใหม่
        </Button>
      </div>

      {tempPassword && (
        <div className="mt-4">
          <TemporaryPasswordNotice
            email={tempPassword.email}
            temporaryPassword={tempPassword.temporaryPassword}
            onDismiss={() => setTempPassword(null)}
          />
        </div>
      )}

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {unlinkedSalespersonUsers.length > 0 && (
        <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">บัญชีพนักงานขายที่ยังไม่ผูกข้อมูลพนักงาน</h2>
          <p className="mt-1 text-sm text-amber-800">บัญชีเหล่านี้จะยังเปิดดูข้อมูลส่วนตัวไม่ได้จนกว่าจะผูกกับพนักงานขาย</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {unlinkedSalespersonUsers.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{user.displayName} · {user.email}</span>
                <button type="button" onClick={() => setEditingUser(user)} className="font-medium underline cursor-pointer">ไปผูกพนักงานขาย</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">ชื่อที่แสดง</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">บทบาท</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">พนักงานขายที่ผูก</th>
              <th className="px-4 py-3">เข้าสู่ระบบล่าสุด</th>
              <th className="px-4 py-3 text-right">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && !loadError && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  ยังไม่มีผู้ใช้ในระบบ
                </td>
              </tr>
            )}
            {users.map((rowUser) => (
              <tr key={rowUser.id}>
                <td className="px-4 py-3 font-medium text-zinc-900">{rowUser.displayName}</td>
                <td className="px-4 py-3 text-zinc-600">{rowUser.email}</td>
                <td className="px-4 py-3 text-zinc-600">{ROLE_LABEL_TH[rowUser.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rowUser.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {rowUser.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                  {rowUser.mustChangePassword && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      รอเปลี่ยนรหัสผ่าน
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {rowUser.salesperson ? rowUser.salesperson.displayName : "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {rowUser.lastLoginAt ? new Date(rowUser.lastLoginAt).toLocaleString("th-TH") : "ยังไม่เคยเข้าใช้งาน"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setEditingUser(rowUser)}
                      className="text-zinc-700 hover:underline cursor-pointer"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      disabled={busyUserId === rowUser.id}
                      onClick={() => setResetUserTarget(rowUser)}
                      className="text-zinc-700 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      รีเซ็ตรหัสผ่าน
                    </button>
                    <button
                      type="button"
                      disabled={busyUserId === rowUser.id || rowUser.id === currentUser?.id}
                      onClick={() => void handleToggleActive(rowUser)}
                      title={rowUser.id === currentUser?.id ? "ไม่สามารถปิดใช้งานบัญชีตัวเองได้" : undefined}
                      className="text-red-600 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {rowUser.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetUserTarget && (
        <ConfirmDialog
          title="ยืนยันรีเซ็ตรหัสผ่าน"
          description={`คุณต้องการรีเซ็ตรหัสผ่านของ ${resetUserTarget.displayName} (${resetUserTarget.email}) หรือไม่?`}
          consequence="รหัสผ่านปัจจุบันจะถูกยกเลิกทันที และระบบจะสร้างรหัสผ่านชั่วคราวใหม่ให้ผู้ใช้นำไปเปลี่ยนในการเข้าสู่ระบบครั้งถัดไป"
          confirmLabel="รีเซ็ตรหัสผ่าน"
          cancelLabel="ยกเลิก"
          tone="danger"
          pending={busyUserId === resetUserTarget.id}
          onConfirm={() => handleResetPassword(resetUserTarget)}
          onCancel={() => setResetUserTarget(null)}
        />
      )}

      {isCreateOpen && (
        <Modal title="สร้างบัญชีใหม่" onClose={() => setCreateOpen(false)}>
          <CreateUserForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </Modal>
      )}

      {editingUser && (
        <Modal title={`แก้ไขบัญชี: ${editingUser.displayName}`} onClose={() => setEditingUser(null)}>
          <EditUserForm
            user={editingUser}
            onSubmit={(input) => handleUpdate(editingUser.id, input)}
            onCancel={() => setEditingUser(null)}
          />
        </Modal>
      )}
    </div>
  );
}

