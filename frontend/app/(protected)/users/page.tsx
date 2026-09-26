"use client";

import { useState } from "react";
import { MoreVertical, KeyRound, UserX, UserCheck } from "lucide-react";
import {
  CreateUserInput,
  UpdateUserInput,
  createUser,
  listUsersPage,
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
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Breadcrumb } from "@/components/shared/navigation/Breadcrumb";
import { DataTable, DataTableColumn } from "@/components/shared/data-table/DataTable";
import { FilterBar, FilterChip } from "@/components/shared/filters/FilterBar";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/shared/navigation/DropdownMenu";
import { InlineMessage } from "@/components/shared/feedback/InlineMessage";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { Input } from "@/components/ui/input";
import { useAbortableEffect } from "@/lib/useAbortableEffect";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SUPERVISOR: "หัวหน้างาน",
  SALESPERSON: "พนักงานขาย",
};

const PAGE_SIZE = 25; // T-UX-025 — server pagination (declared default on the endpoint)

interface TemporaryPasswordState {
  email: string;
  temporaryPassword: string;
}

export default function UsersPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetUserTarget, setResetUserTarget] = useState<AppUser | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<TemporaryPasswordState | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  // Server-side filters (T-UX-025) — filtering must compose with pagination,
  // so role/unlinked/search live on the endpoint, not on the fetched page.
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  useAbortableEffect(
    async (signal) => {
      // UX-022: Gate before fetch to eliminate 403 network noise for non-manager roles
      if (!token || currentUser?.role !== "MANAGER") return;
      setLoading(true);
      try {
        const [pageData, unlinkedData] = await Promise.all([
          listUsersPage(
            token,
            {
              page,
              pageSize: PAGE_SIZE,
              role: roleFilter !== "ALL" ? roleFilter : undefined,
              unlinkedOnly: onlyUnlinked || undefined,
              q: searchQuery || undefined,
            },
            signal
          ),
          // The chip shows the unlinked count across the whole set, not the page.
          listUsersPage(token, { page: 1, pageSize: 1, unlinkedOnly: true }, signal),
        ]);
        if (signal.aborted) return;
        setUsers(pageData.items);
        setTotal(pageData.total);
        setUnlinkedCount(unlinkedData.total);
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [token, currentUser?.role, reloadNonce, page, roleFilter, onlyUnlinked, searchQuery]
  );

  if (currentUser?.role !== "MANAGER") {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  async function handleCreate(input: CreateUserInput) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await createUser(token, input);
      setTempPassword({ email: data.user.email, temporaryPassword: data.temporaryPassword });
      setCreateOpen(false);
      // Server pagination (T-UX-025): refetch instead of appending to a page slice.
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "สร้างบัญชีผู้ใช้ไม่สำเร็จ"));
    }
  }

  async function handleUpdate(id: number, input: UpdateUserInput) {
    if (!token) return;
    setActionError(null);
    try {
      await updateUser(token, id, input);
      setEditingUser(null);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "บันทึกการแก้ไขไม่สำเร็จ"));
    }
  }

  async function handleToggleActive(target: AppUser) {
    if (!token) return;
    setBusyUserId(target.id);
    setActionError(null);
    try {
      await updateUser(token, target.id, { isActive: !target.isActive });
      setToggleActiveTarget(null);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "ทำรายการไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResetPassword(target: AppUser) {
    if (!token) return;
    setBusyUserId(target.id);
    setActionError(null);
    try {
      const data = await resetUserPassword(token, target.id);
      setTempPassword({ email: target.email, temporaryPassword: data.temporaryPassword });
      setResetUserTarget(null);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "รีเซ็ตรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusyUserId(null);
    }
  }

  // Filter logic lives server-side (T-UX-025) — the client only resets it and
  // sends the values with the page request.

  const filterChips: FilterChip[] = [];
  if (roleFilter !== "ALL") {
    filterChips.push({
      key: "role",
      label: `บทบาท: ${ROLE_LABEL_TH[roleFilter] ?? roleFilter}`,
      onRemove: () => {
        setRoleFilter("ALL");
        setPage(1);
      },
    });
  }
  if (onlyUnlinked) {
    filterChips.push({
      key: "unlinked",
      label: `ยังไม่ผูกพนักงานขาย (${unlinkedCount})`,
      onRemove: () => {
        setOnlyUnlinked(false);
        setPage(1);
      },
    });
  }
  if (searchQuery.trim() !== "") {
    filterChips.push({
      key: "q",
      label: `ค้นหา: "${searchQuery.trim()}"`,
      onRemove: () => {
        setSearchQuery("");
        setPage(1);
      },
    });
  }

  const columns: DataTableColumn<AppUser>[] = [
    {
      key: "displayName",
      header: "ชื่อที่แสดง",
      priority: 1,
      mobileRole: "identity",
      sortable: true,
      sortValue: (u) => u.displayName,
      render: (u) => (
        <button
          type="button"
          onClick={() => setEditingUser(u)}
          className="font-semibold text-text-primary hover:text-primary hover:underline text-left cursor-pointer transition-colors"
        >
          {u.displayName}
        </button>
      ),
    },
    {
      key: "email",
      header: "อีเมล",
      priority: 2, // Retained on tablet, hidden below 768px
      mobileRole: "meta",
      sortable: true,
      sortValue: (u) => u.email,
      render: (u) => <span className="text-text-secondary">{u.email}</span>,
    },
    {
      key: "role",
      header: "บทบาท",
      priority: 1,
      mobileRole: "identity",
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => (
        <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-text-secondary border border-border">
          {ROLE_LABEL_TH[u.role] ?? u.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "สถานะ",
      priority: 1,
      mobileRole: "metric",
      sortable: true,
      sortValue: (u) => (u.isActive ? 1 : 0),
      render: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
              u.isActive
                ? "bg-success-subtle border-success/30 text-success-text"
                : "bg-surface-subtle border-border text-text-secondary"
            }`}
          >
            {u.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
          </span>
          {u.mustChangePassword && (
            <span className="rounded-full bg-warning-subtle border border-warning/30 px-2 py-0.5 text-xs font-medium text-warning-text">
              รอเปลี่ยนรหัสผ่าน
            </span>
          )}
        </div>
      ),
    },
    {
      key: "salesperson",
      header: "พนักงานขายที่ผูก",
      priority: 3, // Hidden on tablet
      mobileRole: "meta",
      sortable: true,
      sortValue: (u) => u.salesperson?.displayName ?? "",
      render: (u) => {
        if (u.salesperson) {
          return <span className="text-text-primary">{u.salesperson.displayName}</span>;
        }
        if (u.role === "SALESPERSON" || u.role === "SUPERVISOR") {
          return (
            <button
              type="button"
              onClick={() => setEditingUser(u)}
              className="text-warning-text text-xs font-medium bg-warning-subtle hover:bg-warning/20 px-2 py-0.5 rounded border border-warning/30 underline cursor-pointer transition-colors"
            >
              ยังไม่ผูกข้อมูล (คลิกเพื่อผูก)
            </button>
          );
        }
        return <span className="text-text-muted">-</span>;
      },
    },
    {
      key: "lastLoginAt",
      header: "เข้าสู่ระบบล่าสุด",
      priority: 3, // Hidden on tablet
      mobileRole: "meta",
      sortable: true,
      sortValue: (u) => u.lastLoginAt ?? "",
      render: (u) => (
        <span className="text-xs text-text-muted">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH") : "ยังไม่เคยเข้าใช้งาน"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">การจัดการ</span>,
      align: "right",
      priority: 1,
      mobileRole: "meta",
      render: (u) => (
        <div className="flex items-center justify-end gap-2">
          {/* One primary action per row: Edit */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditingUser(u)}
            className="text-xs px-2.5 py-1"
          >
            แก้ไข
          </Button>

          {/* Secondary actions in accessible DropdownMenu */}
          <DropdownMenu>
            <DropdownTrigger
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border cursor-pointer"
            >
              <MoreVertical size={16} aria-hidden="true" />
              <span className="sr-only">เมนูเพิ่มเติมสำหรับ {u.displayName}</span>
            </DropdownTrigger>
            <DropdownContent align="right">
              <DropdownItem
                onClick={() => setResetUserTarget(u)}
                className="gap-2 text-xs"
              >
                <KeyRound size={14} aria-hidden="true" />
                รีเซ็ตรหัสผ่าน
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                onClick={() => setToggleActiveTarget(u)}
                dangerous={u.isActive}
                className="gap-2 text-xs"
              >
                {u.isActive ? (
                  <>
                    <UserX size={14} aria-hidden="true" />
                    ปิดใช้งานบัญชี
                  </>
                ) : (
                  <>
                    <UserCheck size={14} aria-hidden="true" />
                    เปิดใช้งานบัญชี
                  </>
                )}
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <PageContainer width="standard">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          segments={[
            { label: "การตั้งค่า" },
            { label: "จัดการบัญชีผู้ใช้งาน" },
          ]}
        />
      </div>

      <PageHeader
        title="จัดการบัญชีผู้ใช้งาน"
        description="สร้าง แก้ไข รีเซ็ตรหัสผ่าน และควบคุมการเข้าถึงระบบของผู้ใช้งานในองค์กร"
        primaryAction={
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            size="sm"
          >
            + สร้างบัญชีใหม่
          </Button>
        }
      />

      {tempPassword && (
        <div className="mb-6">
          <TemporaryPasswordNotice
            email={tempPassword.email}
            temporaryPassword={tempPassword.temporaryPassword}
            onDismiss={() => setTempPassword(null)}
          />
        </div>
      )}

      {loadError && users.length === 0 && (
        <div className="mb-6">
          <EmptyState
            variant="error"
            title="โหลดรายชื่อผู้ใช้ไม่สำเร็จ"
            description={loadError}
            onRetry={() => setReloadNonce((n) => n + 1)}
            isRetrying={loading}
          />
        </div>
      )}

      {actionError && (
        <div className="mb-6">
          <InlineMessage variant="destructive">{actionError}</InlineMessage>
        </div>
      )}

      {/* FilterBar — role filter, unlinked chip and search, all sent server-side (T-UX-025) */}
      <div className="mb-4">
        <FilterBar
          chips={filterChips}
          onReset={() => {
            setRoleFilter("ALL");
            setOnlyUnlinked(false);
            setSearchQuery("");
            setPage(1);
          }}
        >
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-secondary">บทบาท</span>
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-auto text-sm"
            >
              <option value="ALL">ทุกลำดับ/บทบาท</option>
              <option value="MANAGER">ผู้จัดการ</option>
              <option value="SUPERVISOR">หัวหน้างาน</option>
              <option value="SALESPERSON">พนักงานขาย</option>
            </Select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">ค้นหาผู้ใช้</span>
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาชื่อ, อีเมล, พนักงานขาย…"
              aria-label="ค้นหาชื่อ, อีเมล หรือพนักงานขาย"
              className="w-full max-w-xs text-sm"
            />
          </label>

          {unlinkedCount > 0 && (
            <Button
              type="button"
              variant={onlyUnlinked ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setOnlyUnlinked((v) => !v);
                setPage(1);
              }}
              className="text-xs"
            >
              ยังไม่ผูกพนักงานขาย ({unlinkedCount})
            </Button>
          )}
        </FilterBar>
      </div>

      {/* DataTable — server-paginated (T-UX-025); sort/search UI disabled by design,
          the pager shows the server total and requests one page at a time. */}
      <DataTable<AppUser>
        caption="รายชื่อบัญชีผู้ใช้งานในระบบ"
        columns={columns}
        rows={users}
        getRowId={(u) => u.id}
        loading={loading}
        serverPaginated
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        rowAction={(u) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditingUser(u)}
            className="w-full min-h-[44px]"
          >
            แก้ไขบัญชี
          </Button>
        )}
        emptyTitle="ไม่พบข้อมูลผู้ใช้"
        emptyDescription="ไม่มีรายชื่อผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรองในขณะนี้"
      />

      {/* ConfirmDialog on Reset Password */}
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

      {/* ConfirmDialog on Deactivate / Activate */}
      {toggleActiveTarget && (
        <ConfirmDialog
          title={toggleActiveTarget.isActive ? "ยืนยันปิดใช้งานบัญชี" : "ยืนยันเปิดใช้งานบัญชี"}
          description={
            toggleActiveTarget.isActive
              ? `คุณต้องการปิดใช้งานบัญชีของ ${toggleActiveTarget.displayName} (${toggleActiveTarget.email}) หรือไม่?`
              : `คุณต้องการเปิดใช้งานบัญชีของ ${toggleActiveTarget.displayName} (${toggleActiveTarget.email}) หรือไม่?`
          }
          consequence={
            toggleActiveTarget.isActive
              ? "ผู้ใช้รายนี้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง"
              : undefined
          }
          confirmLabel={toggleActiveTarget.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          cancelLabel="ยกเลิก"
          tone={toggleActiveTarget.isActive ? "danger" : "default"}
          pending={busyUserId === toggleActiveTarget.id}
          onConfirm={() => handleToggleActive(toggleActiveTarget)}
          onCancel={() => setToggleActiveTarget(null)}
        />
      )}

      {/* Modal for Create User */}
      {isCreateOpen && (
        <Modal title="สร้างบัญชีใหม่" onClose={() => setCreateOpen(false)}>
          <CreateUserForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </Modal>
      )}

      {/* Modal for Edit User */}
      {editingUser && (
        <Modal title={`แก้ไขบัญชี: ${editingUser.displayName}`} onClose={() => setEditingUser(null)}>
          <EditUserForm
            user={editingUser}
            onSubmit={(input) => handleUpdate(editingUser.id, input)}
            onCancel={() => setEditingUser(null)}
          />
        </Modal>
      )}
    </PageContainer>
  );
}
