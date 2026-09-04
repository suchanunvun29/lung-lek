"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  TerritoryGroupManager,
  createTerritory,
  listTerritories,
  listTerritoryAssignments,
  listTerritoryGroups,
  saveTerritoryAssignment,
  updateTerritory,
  withdrawTerritoryAssignment,
} from "@/features/territories";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { Salesperson, Territory, TerritoryAssignment, TerritoryGroup } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const TODAY = new Date().toISOString().slice(0, 10);

type TerritoryTab = "territories" | "assignments" | "groups";

function readInitialTab(): TerritoryTab {
  if (typeof window === "undefined") return "territories";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "assignments" || value === "groups" ? value : "territories";
}

function setTabInUrl(tab: TerritoryTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url.toString());
}

export default function TerritoriesPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === "MANAGER";

  const [tab, setTabState] = useState<TerritoryTab>(readInitialTab);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [assignments, setAssignments] = useState<TerritoryAssignment[]>([]);
  const [groups, setGroups] = useState<TerritoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creatingTerritory, setCreatingTerritory] = useState(false);

  const [assignment, setAssignment] = useState({
    territoryId: "",
    salespersonId: "",
    effectiveFrom: TODAY,
    isSupervisor: false,
  });
  const [assigning, setAssigning] = useState(false);

  // Confirmation dialog state for closing an assignment
  const [assignmentToClose, setAssignmentToClose] = useState<TerritoryAssignment | null>(null);
  const [closingPending, setClosingPending] = useState(false);

  function setTab(nextTab: TerritoryTab) {
    setTabState(nextTab);
    setTabInUrl(nextTab);
  }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [territoryData, salespersonData, assignmentData, groupData] = await Promise.all([
        listTerritories(token),
        listSalespeople(token),
        listTerritoryAssignments(token),
        listTerritoryGroups(token),
      ]);
      setTerritories(territoryData.territories);
      setSalespeople(salespersonData.salespeople);
      setAssignments(assignmentData.territoryAssignments);
      setGroups(groupData.territoryGroups);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดข้อมูลเขตไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submitTerritory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !name.trim() || creatingTerritory) return;
    setCreatingTerritory(true);
    try {
      await createTerritory(token, { name: name.trim(), code: code.trim() || null });
      setName("");
      setCode("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "สร้างเขตไม่สำเร็จ"));
    } finally {
      setCreatingTerritory(false);
    }
  }

  const toggleTerritory = useCallback(
    async (item: Territory) => {
      if (!token) return;
      try {
        await updateTerritory(token, item.id, { isActive: !item.isActive });
        await load();
      } catch (err) {
        setError(getErrorMessage(err, "แก้ไขเขตไม่สำเร็จ"));
      }
    },
    [token, load]
  );

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !assignment.territoryId || !assignment.salespersonId || assigning) return;
    setAssigning(true);
    try {
      await saveTerritoryAssignment(token, {
        ...assignment,
        territoryId: Number(assignment.territoryId),
        salespersonId: Number(assignment.salespersonId),
      });
      setAssignment({ territoryId: "", salespersonId: "", effectiveFrom: TODAY, isSupervisor: false });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "มอบหมายผู้ดูแลไม่สำเร็จ"));
    } finally {
      setAssigning(false);
    }
  }

  async function handleConfirmCloseAssignment() {
    if (!token || !assignmentToClose) return;
    setClosingPending(true);
    try {
      await withdrawTerritoryAssignment(token, {
        territoryId: assignmentToClose.territoryId,
        salespersonId: assignmentToClose.salespersonId,
        effectiveTo: TODAY,
      });
      setAssignmentToClose(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ถอนผู้ดูแลไม่สำเร็จ"));
    } finally {
      setClosingPending(false);
    }
  }

  // Columns for Tab 1: เขต (Territories)
  const territoryColumns: DataTableColumn<Territory>[] = useMemo(
    () => [
      {
        key: "name",
        header: "เขต",
        render: (item) => (
          <span className="font-medium">
            {item.name}
            {item.code ? ` (${item.code})` : ""}
          </span>
        ),
        sortable: true,
        sortValue: (item) => item.name,
        priority: 1,
        mobileRole: "identity",
      },
      {
        key: "region",
        header: "Region",
        render: (item) => item.region?.name ?? "—",
        sortable: true,
        sortValue: (item) => item.region?.name ?? "",
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "activeOwnerCount",
        header: "ผู้ดูแลปัจจุบัน",
        render: (item) => item.activeOwnerCount.toLocaleString("th-TH"),
        numeric: true,
        sortable: true,
        sortValue: (item) => item.activeOwnerCount,
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "hospitalCount",
        header: "โรงพยาบาล",
        render: (item) => item.hospitalCount.toLocaleString("th-TH"),
        numeric: true,
        sortable: true,
        sortValue: (item) => item.hospitalCount,
        priority: 1,
        mobileRole: "metric",
      },
      {
        key: "isActive",
        header: "สถานะ",
        align: "center",
        render: (item) =>
          canEdit ? (
            <Button
              type="button"
              size="sm"
              variant={item.isActive ? "outline" : "secondary"}
              onClick={() => void toggleTerritory(item)}
              className="h-7 text-xs"
            >
              {item.isActive ? "ใช้งาน" : "ปิดใช้"}
            </Button>
          ) : (
            <Badge variant={item.isActive ? "default" : "secondary"}>
              {item.isActive ? "ใช้งาน" : "ปิดใช้"}
            </Badge>
          ),
        priority: 1,
        mobileRole: "meta",
      },
    ],
    [canEdit, toggleTerritory]
  );

  // Columns for Tab 2: การมอบหมาย (Assignments)
  const assignmentColumns: DataTableColumn<TerritoryAssignment>[] = useMemo(
    () => [
      {
        key: "territory",
        header: "เขต",
        render: (item) => <span className="font-medium">{item.territory.name}</span>,
        sortable: true,
        sortValue: (item) => item.territory.name,
        priority: 1,
        mobileRole: "identity",
      },
      {
        key: "salesperson",
        header: "ผู้ดูแล",
        render: (item) => item.salesperson.displayName,
        sortable: true,
        sortValue: (item) => item.salesperson.displayName,
        priority: 1,
        mobileRole: "identity",
      },
      {
        key: "effectiveFrom",
        header: "มีผล",
        render: (item) => item.effectiveFrom.slice(0, 10),
        sortable: true,
        sortValue: (item) => item.effectiveFrom,
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "effectiveTo",
        header: "สิ้นสุด",
        render: (item) => item.effectiveTo?.slice(0, 10) ?? "ACTIVE",
        sortable: true,
        sortValue: (item) => item.effectiveTo ?? "9999",
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "role",
        header: "บทบาท",
        render: (item) => (item.isSupervisor ? "Supervisor" : "ผู้ดูแล"),
        priority: 1,
        mobileRole: "meta",
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (item) =>
          canEdit && !item.effectiveTo ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAssignmentToClose(item)}
              className="h-7 text-xs text-danger hover:bg-danger/10 hover:text-danger"
            >
              ถอนผู้ดูแล
            </Button>
          ) : null,
        priority: 1,
        mobileRole: "meta",
      },
    ],
    [canEdit]
  );

  return (
    <PageContainer width="standard" className="space-y-6">
      <PageHeader
        title="จัดการเขตและผู้ดูแล"
        description="Region เป็นป้ายอ้างอิงเท่านั้น ไม่ใช้แทน Region ในสูตรศักยภาพ"
        secondaryActions={[
          <Link
            key="targets"
            href="/territories/targets"
            className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            ตั้งเป้าเขต
          </Link>,
          <Link
            key="moves"
            href="/territories/moves"
            className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            ย้ายโรงพยาบาล
          </Link>,
          <Link
            key="unassigned"
            href="/territories/unassigned"
            className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            โรงพยาบาลไม่มีเขต
          </Link>,
        ]}
      />

      {!canEdit && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning">
          คุณดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TerritoryTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="territories">
            เขต ({territories.length.toLocaleString("th-TH")})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            การมอบหมาย ({assignments.length.toLocaleString("th-TH")})
          </TabsTrigger>
          <TabsTrigger value="groups">
            กลุ่มเขต ({groups.length.toLocaleString("th-TH")})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: เขต (Territories) */}
        <TabsContent value="territories" className="space-y-4">
          {canEdit && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-primary">สร้างเขตการขายใหม่</h2>
              <form onSubmit={submitTerritory} className="flex flex-wrap items-center gap-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อเขต"
                  className="w-full sm:w-60"
                  required
                />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="รหัสเขต (ถ้ามี)"
                  className="w-full sm:w-44"
                />
                <Button type="submit" size="sm" disabled={creatingTerritory}>
                  {creatingTerritory ? "กำลังสร้าง..." : "สร้างเขต"}
                </Button>
              </form>
            </div>
          )}

          <DataTable
            columns={territoryColumns}
            rows={territories}
            getRowId={(item) => item.id}
            caption="รายการเขตการขาย"
            loading={loading}
            searchable
            searchPlaceholder="ค้นหาชื่อเขต รหัส หรือ Region…"
            searchPredicate={(item, q) =>
              item.name.toLowerCase().includes(q) ||
              Boolean(item.code?.toLowerCase().includes(q)) ||
              Boolean(item.region?.name.toLowerCase().includes(q))
            }
            emptyTitle="ยังไม่มีข้อมูลเขต"
            emptyDescription="เพิ่มเขตการขายใหม่ผ่านฟอร์มด้านบน"
          />
        </TabsContent>

        {/* Tab 2: การมอบหมาย (Assignments) */}
        <TabsContent value="assignments" className="space-y-4">
          {canEdit && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-primary">มอบหมายผู้ดูแลเขต</h2>
              <form onSubmit={submitAssignment} className="flex flex-wrap items-end gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">เขต</span>
                  <Select
                    required
                    value={assignment.territoryId}
                    onChange={(e) => setAssignment({ ...assignment, territoryId: e.target.value })}
                    className="w-44"
                  >
                    <option value="">เลือกเขต</option>
                    {territories
                      .filter((t) => t.isActive)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </Select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">พนักงาน</span>
                  <Select
                    required
                    value={assignment.salespersonId}
                    onChange={(e) => setAssignment({ ...assignment, salespersonId: e.target.value })}
                    className="w-48"
                  >
                    <option value="">เลือกพนักงาน</option>
                    {salespeople
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.displayName}
                        </option>
                      ))}
                  </Select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">มีผล</span>
                  <Input
                    type="date"
                    value={assignment.effectiveFrom}
                    onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })}
                    className="w-40"
                    required
                  />
                </label>

                <label className="flex h-10 items-center gap-2 cursor-pointer pb-0.5 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={assignment.isSupervisor}
                    onChange={(e) => setAssignment({ ...assignment, isSupervisor: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <span>เป็น Supervisor</span>
                </label>

                <Button type="submit" size="sm" disabled={assigning}>
                  {assigning ? "กำลังบันทึก..." : "มอบหมาย"}
                </Button>
              </form>
            </div>
          )}

          <DataTable
            columns={assignmentColumns}
            rows={assignments}
            getRowId={(item) => item.id}
            caption="รายการมอบหมายผู้ดูแลเขต"
            loading={loading}
            searchable
            searchPlaceholder="ค้นหาชื่อเขต หรือ ผู้ดูแล…"
            searchPredicate={(item, q) =>
              item.territory.name.toLowerCase().includes(q) ||
              item.salesperson.displayName.toLowerCase().includes(q)
            }
            emptyTitle="ยังไม่มีประวัติการมอบหมายผู้ดูแล"
            emptyDescription="มอบหมายผู้ดูแลเขตผ่านฟอร์มด้านบน"
          />
        </TabsContent>

        {/* Tab 3: กลุ่มเขต (Territory Groups) */}
        <TabsContent value="groups" className="space-y-4">
          <TerritoryGroupManager
            canEdit={canEdit}
            groups={groups}
            territories={territories}
            token={token}
            onChanged={load}
            onError={setError}
          />
        </TabsContent>
      </Tabs>

      {/* Confirmation dialog for closing an assignment */}
      {assignmentToClose && (
        <ConfirmDialog
          title="ยืนยันการถอนผู้ดูแลเขต"
          description={`คุณต้องการถอนคุณ ${assignmentToClose.salesperson.displayName} ออกจากการดูแลเขต ${assignmentToClose.territory.name} ใช่หรือไม่?`}
          consequence="ผู้ดูแลรายนี้จะหมดสิทธิ์เข้าถึงข้อมูลของเขตนี้ทันที เนื่องจากระบบคำนวณสิทธิ์การเข้าถึงข้อมูลตามสถานะปัจจุบัน (วันนี้)"
          tone="danger"
          confirmLabel="ถอนผู้ดูแล"
          cancelLabel="ยกเลิก"
          pending={closingPending}
          onConfirm={handleConfirmCloseAssignment}
          onCancel={() => {
            if (!closingPending) setAssignmentToClose(null);
          }}
        />
      )}
    </PageContainer>
  );
}
