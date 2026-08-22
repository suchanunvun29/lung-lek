"use client";

import { FormEvent, useMemo, useState } from "react";
import { addTerritoryGroupMember, createTerritoryGroup, getErrorMessage, updateTerritoryGroupMember } from "@/lib/api";
import { Territory, TerritoryGroup, TerritoryGroupMember } from "@/lib/types";

interface TerritoryGroupManagerProps {
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

export default function TerritoryGroupManager({ canEdit, groups, territories, token, onChanged, onError }: TerritoryGroupManagerProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [memberForm, setMemberForm] = useState({ territoryId: "", effectiveFrom: CURRENT_MONTH, effectiveTo: "" });
  const [endingMemberId, setEndingMemberId] = useState<string | null>(null);
  const [endingMonth, setEndingMonth] = useState("");

  const territoryNames = useMemo(() => new Map(territories.map((territory) => [territory.id, territory.name])), [territories]);

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

  async function submitMember(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    if (!token || !memberForm.territoryId || !memberForm.effectiveFrom) return;
    if (memberForm.effectiveTo && memberForm.effectiveTo < memberForm.effectiveFrom) {
      onError("เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่ม");
      return;
    }
    try {
      await addTerritoryGroupMember(token, groupId, {
        territoryId: memberForm.territoryId,
        effectiveFrom: firstDayOfMonth(memberForm.effectiveFrom),
        effectiveTo: memberForm.effectiveTo ? lastDayOfMonth(memberForm.effectiveTo) : null,
      });
      setMemberForm({ territoryId: "", effectiveFrom: selectedMonth, effectiveTo: "" });
      await onChanged();
    } catch (error) {
      onError(getErrorMessage(error, "เพิ่มสมาชิกกลุ่มเขตไม่สำเร็จ"));
    }
  }

  async function endMembership(groupId: string, member: TerritoryGroupMember) {
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

  return <section className="rounded-lg border border-zinc-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">กลุ่มเขต</h2>
        <p className="mt-1 text-sm text-zinc-600">สมาชิกมีผลเต็มเดือน และประวัติจะไม่ถูกลบ</p>
      </div>
      <label className="text-sm">งวดที่กำลังตั้งเป้า <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="ml-2 rounded border p-2" /></label>
      {canEdit && <form onSubmit={submitGroup} className="flex gap-2"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="ชื่อกลุ่ม" className="rounded border px-3 py-2 text-sm" /><button className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">สร้างกลุ่ม</button></form>}
    </div>
    <div className="mt-4 space-y-4">
      {groups.map((group) => {
        const activeMembers = group.members.filter((member) => isMemberActiveInMonth(member, selectedMonth));
        return <div key={group.id} className="rounded border p-3">
          <h3 className="font-medium">{group.name}</h3>
          <div className="mt-3">
            <p className="text-sm font-medium text-zinc-700">สมาชิกที่มีผลใน {selectedMonth}</p>
            {activeMembers.length === 0 ? <p className="mt-1 text-sm text-zinc-500">ไม่มีสมาชิกในงวดนี้</p> : <ul className="mt-2 flex flex-wrap gap-2">{activeMembers.map((member) => <li key={member.id} className="rounded bg-zinc-100 px-2 py-1 text-sm">{member.territory.displayName}</li>)}</ul>}
          </div>
          {canEdit && <form onSubmit={(event) => void submitMember(event, group.id)} className="mt-4 flex flex-wrap items-end gap-2 rounded bg-zinc-50 p-3 text-sm">
            <label>เขต<select required value={memberForm.territoryId} onChange={(event) => setMemberForm({ ...memberForm, territoryId: event.target.value })} className="ml-1 rounded border p-2"><option value="">เลือก</option>{territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select></label>
            <label>เริ่มเดือน<input required type="month" value={memberForm.effectiveFrom} onChange={(event) => setMemberForm({ ...memberForm, effectiveFrom: event.target.value })} className="ml-1 rounded border p-2" /></label>
            <label>สิ้นสุดเดือน (ถ้ามี)<input type="month" value={memberForm.effectiveTo} onChange={(event) => setMemberForm({ ...memberForm, effectiveTo: event.target.value })} className="ml-1 rounded border p-2" /></label>
            <button className="rounded bg-zinc-900 px-3 py-2 text-white">เพิ่มสมาชิก</button>
          </form>}
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-sm font-medium text-zinc-700">ประวัติสมาชิก</p>
            <table className="w-full text-left text-sm"><thead className="border-b text-zinc-500"><tr><th className="p-2">เขต</th><th className="p-2">เริ่มมีผล</th><th className="p-2">สิ้นสุด</th>{canEdit && <th className="p-2" />}</tr></thead><tbody>{group.members.map((member) => <tr key={member.id} className="border-b"><td className="p-2">{territoryNames.get(member.territoryId) ?? member.territory.displayName}</td><td className="p-2">{member.effectiveFrom.slice(0, 10)}</td><td className="p-2">{member.effectiveTo?.slice(0, 10) ?? "ยังมีผล"}</td>{canEdit && <td className="p-2">{!member.effectiveTo && (endingMemberId === member.id ? <span className="flex items-center gap-2"><input aria-label="เดือนสิ้นสุด" type="month" value={endingMonth} onChange={(event) => setEndingMonth(event.target.value)} className="rounded border p-1" /><button type="button" onClick={() => void endMembership(group.id, member)} className="text-red-700 underline">ยืนยัน</button><button type="button" onClick={() => { setEndingMemberId(null); setEndingMonth(""); }} className="underline">ยกเลิก</button></span> : <button type="button" onClick={() => setEndingMemberId(member.id)} className="text-red-700 underline">สิ้นสุดการเป็นสมาชิก</button>)}</td>}</tr>)}</tbody></table>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
