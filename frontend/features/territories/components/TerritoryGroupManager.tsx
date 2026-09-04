"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addTerritoryGroupMember,
  createTerritoryGroup,
  updateTerritoryGroupMember,
} from "@/features/territories/api/territories.api";
import { listTargets, upsertTerritoryGroupTarget } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { Target, Territory, TerritoryGroup, TerritoryGroupMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export interface TerritoryGroupManagerProps {
  canEdit: boolean;
  groups: TerritoryGroup[];
  territories: Territory[];
  token: string | null;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function firstDayOfMonth(month: string) {
  return `${month}-01`;
}

function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function monthFromDate(value: string) {
  return value.slice(0, 7);
}

function isMemberActiveInMonth(member: TerritoryGroupMember, month: string) {
  const periodStart = firstDayOfMonth(month);
  const periodEnd = lastDayOfMonth(month);
  return member.effectiveFrom.slice(0, 10) <= periodEnd && (!member.effectiveTo || member.effectiveTo.slice(0, 10) >= periodStart);
}

function groupTargetKey(groupId: number, month: number) {
  return `${groupId}-${month}`;
}

export function TerritoryGroupManager({ canEdit, groups, territories, token, onChanged, onError }: TerritoryGroupManagerProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [memberForm, setMemberForm] = useState({ territoryId: "", effectiveFrom: CURRENT_MONTH, effectiveTo: "" });
  const [endingMemberId, setEndingMemberId] = useState<number | null>(null);
  const [endingMonth, setEndingMonth] = useState("");
  const [groupTargetsByYear, setGroupTargetsByYear] = useState<ReadonlyMap<number, ReadonlyMap<string, Target>>>(new Map());

  const territoryNames = useMemo(() => new Map(territories.map((territory) => [territory.id, territory.name])), [territories]);

  const targetYear = Number(selectedMonth.slice(0, 4));
  const targetMonth = Number(selectedMonth.slice(5, 7));
  const groupTargets = groupTargetsByYear.get(targetYear);

  // Group-scope targets are read through GET /targets?scope=TERRITORY_GROUP — the same
  // load-the-year-then-find-a-row pattern the other target editors use. Prefill only;
  // a failure here must not block membership management.
  useEffect(() => {
    if (!token || !canEdit || groupTargetsByYear.has(targetYear)) return;
    let cancelled = false;
    listTargets(token, targetYear, "TERRITORY_GROUP")
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, Target>();
        for (const item of data.targets) if (item.territoryGroupId) map.set(groupTargetKey(item.territoryGroupId, item.month), item);
        setGroupTargetsByYear((current) => new Map(current).set(targetYear, map));
      })
      .catch((error) => { if (!cancelled) onError(getErrorMessage(error, "โหลดเป้ากลุ่มเขตไม่สำเร็จ")); });
    return () => { cancelled = true; };
  }, [canEdit, groupTargetsByYear, onError, targetYear, token]);

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupName.trim()) return;
    try {
      await createTerritoryGroup(token, { name: groupName.trim() });
      setGroupName("");
      await onChanged();
    } catch (error) {
      onError(getErrorMessage(error, "สร้างกลุ่มเขตไม่สำเร็จ"));
    }
  }

  async function submitMember(event: FormEvent<HTMLFormElement>, groupId: number) {
    event.preventDefault();
    if (!token || !memberForm.territoryId || !memberForm.effectiveFrom) return;
    if (memberForm.effectiveTo && memberForm.effectiveTo < memberForm.effectiveFrom) {
      onError("เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่ม");
      return;
    }
    try {
      await addTerritoryGroupMember(token, groupId, {
        territoryId: Number(memberForm.territoryId),
        effectiveFrom: firstDayOfMonth(memberForm.effectiveFrom),
        effectiveTo: memberForm.effectiveTo ? lastDayOfMonth(memberForm.effectiveTo) : null,
      });
      setMemberForm({ territoryId: "", effectiveFrom: selectedMonth, effectiveTo: "" });
      await onChanged();
    } catch (error) {
      onError(getErrorMessage(error, "เพิ่มสมาชิกกลุ่มเขตไม่สำเร็จ"));
    }
  }

  async function endMembership(groupId: number, member: TerritoryGroupMember) {
    if (!token || !endingMonth) return;
    if (endingMonth < monthFromDate(member.effectiveFrom)) {
      onError("เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่ม");
      return;
    }
    try {
      await updateTerritoryGroupMember(token, groupId, member.id, {
        effectiveTo: lastDayOfMonth(endingMonth),
      });
      setEndingMemberId(null);
      setEndingMonth("");
      await onChanged();
    } catch (error) {
      onError(getErrorMessage(error, "สิ้นสุดการเป็นสมาชิกไม่สำเร็จ"));
    }
  }

  async function saveGroupTarget(group: TerritoryGroup, revenueRaw: string, customersRaw: string): Promise<boolean> {
    if (!token) return false;
    const revenueTarget = Number(revenueRaw);
    const newCustomerTarget = Number(customersRaw);
    if (!Number.isFinite(revenueTarget) || !Number.isFinite(newCustomerTarget)) return false;
    try {
      const { target } = await upsertTerritoryGroupTarget(token, group.id, targetYear, targetMonth, { revenueTarget, newCustomerTarget });
      setGroupTargetsByYear((current) => {
        const yearMap = new Map(current.get(targetYear) ?? []);
        yearMap.set(groupTargetKey(group.id, targetMonth), target);
        return new Map(current).set(targetYear, yearMap);
      });
      await onChanged();
      return true;
    } catch (error) {
      onError(getErrorMessage(error, "บันทึกเป้ากลุ่มเขตไม่สำเร็จ"));
      return false;
    }
  }

  return (
    <Card className="p-4 border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">กลุ่มเขต</h2>
          <p className="mt-1 text-sm text-text-muted">สมาชิกมีผลเต็มเดือน และประวัติจะไม่ถูกลบ</p>
        </div>
        <label className="text-sm text-text-secondary">
          งวดที่กำลังตั้งเป้า{" "}
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="ml-2 rounded border border-border bg-surface p-2 text-sm text-text-primary"
          />
        </label>
        {canEdit && (
          <form onSubmit={submitGroup} className="flex gap-2">
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="ชื่อกลุ่ม"
              className="w-auto"
            />
            <Button type="submit" size="sm">
              สร้างกลุ่ม
            </Button>
          </form>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const activeMembers = group.members.filter((member) => isMemberActiveInMonth(member, selectedMonth));
          return (
            <div key={group.id} className="rounded-lg border border-border bg-surface p-3">
              <h3 className="font-medium text-text-primary">{group.name}</h3>
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">สมาชิกที่มีผลใน {selectedMonth}</p>
                {activeMembers.length === 0 ? (
                  <p className="mt-1 text-sm text-text-muted">ไม่มีสมาชิกในงวดนี้</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {activeMembers.map((member) => (
                      <li key={member.id} className="rounded bg-surface-subtle px-2 py-1 text-sm text-text-secondary border border-border">
                        {member.territory.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canEdit && groupTargets && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-text-secondary">เป้ารวมของกลุ่ม ประจำ {selectedMonth}</p>
                  <GroupTargetForm
                    key={`${group.id}-${selectedMonth}-${groupTargets.get(groupTargetKey(group.id, targetMonth))?.updatedAt ?? "none"}`}
                    target={groupTargets.get(groupTargetKey(group.id, targetMonth))}
                    periodLabel={selectedMonth}
                    onSave={(revenueRaw, customersRaw) => saveGroupTarget(group, revenueRaw, customersRaw)}
                  />
                </div>
              )}
              {canEdit && (
                <form onSubmit={(event) => void submitMember(event, group.id)} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-surface-subtle p-3 text-sm border border-border">
                  <label className="text-text-secondary">
                    เขต
                    <Select
                      required
                      value={memberForm.territoryId}
                      onChange={(event) => setMemberForm({ ...memberForm, territoryId: event.target.value })}
                      className="ml-1 w-auto"
                    >
                      <option value="">เลือก</option>
                      {territories.map((territory) => (
                        <option key={territory.id} value={territory.id}>
                          {territory.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-text-secondary">
                    เริ่มเดือน
                    <input
                      required
                      type="month"
                      value={memberForm.effectiveFrom}
                      onChange={(event) => setMemberForm({ ...memberForm, effectiveFrom: event.target.value })}
                      className="ml-1 rounded border border-border bg-surface p-2 text-sm text-text-primary"
                    />
                  </label>
                  <label className="text-text-secondary">
                    สิ้นสุดเดือน (ถ้ามี)
                    <input
                      type="month"
                      value={memberForm.effectiveTo}
                      onChange={(event) => setMemberForm({ ...memberForm, effectiveTo: event.target.value })}
                      className="ml-1 rounded border border-border bg-surface p-2 text-sm text-text-primary"
                    />
                  </label>
                  <Button type="submit" size="sm">
                    เพิ่มสมาชิก
                  </Button>
                </form>
              )}
              <div className="mt-4 overflow-x-auto">
                <p className="mb-2 text-sm font-medium text-text-secondary">ประวัติสมาชิก</p>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-text-muted">
                    <tr>
                      <th className="p-2">เขต</th>
                      <th className="p-2">เริ่มมีผล</th>
                      <th className="p-2">สิ้นสุด</th>
                      {canEdit && <th className="p-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map((member) => (
                      <tr key={member.id} className="border-b border-border/60 last:border-0">
                        <td className="p-2 text-text-primary">{territoryNames.get(member.territoryId) ?? member.territory.name}</td>
                        <td className="p-2 text-text-secondary">{member.effectiveFrom.slice(0, 10)}</td>
                        <td className="p-2 text-text-secondary">{member.effectiveTo?.slice(0, 10) ?? "ยังมีผล"}</td>
                        {canEdit && (
                          <td className="p-2">
                            {!member.effectiveTo && (
                              endingMemberId === member.id ? (
                                <span className="flex items-center gap-2">
                                  <input
                                    aria-label="เดือนสิ้นสุด"
                                    type="month"
                                    value={endingMonth}
                                    onChange={(event) => setEndingMonth(event.target.value)}
                                    className="rounded border border-border bg-surface p-1 text-sm text-text-primary"
                                  />
                                  <Button type="button" size="sm" variant="destructive" onClick={() => void endMembership(group.id, member)} className="h-7 px-2 text-xs">
                                    ยืนยัน
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => { setEndingMemberId(null); setEndingMonth(""); }} className="h-7 px-2 text-xs">
                                    ยกเลิก
                                  </Button>
                                </span>
                              ) : (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEndingMemberId(member.id)} className="h-7 px-2 text-xs text-danger hover:text-danger hover:bg-danger/10">
                                  สิ้นสุดการเป็นสมาชิก
                                </Button>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GroupTargetForm({ target, periodLabel, onSave }: { target?: Target; periodLabel: string; onSave: (revenueRaw: string, customersRaw: string) => Promise<boolean> }) {
  const [revenue, setRevenue] = useState(target ? String(target.revenueTarget) : "");
  const [customers, setCustomers] = useState(target ? String(target.newCustomerTarget) : "");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const ok = await onSave(revenue, customers);
    setSaving(false);
    if (ok) setSavedMessage(`บันทึกเป้ากลุ่มประจำ ${periodLabel} แล้ว`);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-surface-subtle border border-border p-3 text-sm">
      <label className="text-text-secondary">
        เป้ายอดขาย
        <Input
          required
          type="number"
          min={0}
          value={revenue}
          onChange={(event) => { setRevenue(event.target.value); setSavedMessage(null); }}
          className="ml-1 w-40"
        />
      </label>
      <label className="text-text-secondary">
        เป้าลูกค้าใหม่
        <Input
          required
          type="number"
          min={0}
          value={customers}
          onChange={(event) => { setCustomers(event.target.value); setSavedMessage(null); }}
          className="ml-1 w-32"
        />
      </label>
      <Button type="submit" disabled={saving} size="sm">
        {saving ? "กำลังบันทึก..." : "บันทึกเป้ากลุ่ม"}
      </Button>
      {savedMessage && <span className="text-success text-sm font-medium">{savedMessage}</span>}
    </form>
  );
}

export default TerritoryGroupManager;
