"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const TODAY = new Date().toISOString().slice(0, 10);

export default function TerritoriesPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === "MANAGER";
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [assignments, setAssignments] = useState<TerritoryAssignment[]>([]);
  const [groups, setGroups] = useState<TerritoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [assignment, setAssignment] = useState({ territoryId: "", salespersonId: "", effectiveFrom: TODAY, isSupervisor: false });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [territoryData, salespersonData, assignmentData, groupData] = await Promise.all([
        listTerritories(token), listSalespeople(token), listTerritoryAssignments(token), listTerritoryGroups(token),
      ]);
      setTerritories(territoryData.territories);
      setSalespeople(salespersonData.salespeople);
      setAssignments(assignmentData.territoryAssignments);
      setGroups(groupData.territoryGroups);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดข้อมูลเขตไม่สำเร็จ"));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submitTerritory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !name.trim()) return;
    try {
      await createTerritory(token, { name: name.trim(), code: code.trim() || null });
      setName("");
      setCode("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "สร้างเขตไม่สำเร็จ"));
    }
  }

  async function toggleTerritory(territory: Territory) {
    if (!token) return;
    try {
      await updateTerritory(token, territory.id, { isActive: !territory.isActive });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "แก้ไขเขตไม่สำเร็จ"));
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !assignment.territoryId || !assignment.salespersonId) return;
    try {
      await saveTerritoryAssignment(token, assignment);
      setAssignment({ territoryId: "", salespersonId: "", effectiveFrom: TODAY, isSupervisor: false });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "มอบหมายผู้ดูแลไม่สำเร็จ"));
    }
  }

  async function closeAssignment(item: TerritoryAssignment) {
    if (!token) return;
    try {
      await withdrawTerritoryAssignment(token, { territoryId: item.territoryId, salespersonId: item.salespersonId, effectiveTo: TODAY });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ถอนผู้ดูแลไม่สำเร็จ"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">จัดการเขตและผู้ดูแล</h1>
            <p className="mt-1 text-sm text-zinc-600">Region เป็นป้ายอ้างอิงเท่านั้น ไม่ใช้แทน Region ในสูตรศักยภาพ</p>
          </div>
          <div className="flex gap-2">
            <Link href="/territories/targets" className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">ตั้งเป้าเขต</Link>
            <Link href="/territories/moves" className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">ย้ายโรงพยาบาล</Link>
            <Link href="/territories/unassigned" className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">โรงพยาบาลที่ยังไม่ผูกเขต</Link>
          </div>
        </div>
      </header>
      {!canEdit && <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">คุณดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-zinc-400">กำลังโหลด...</p>
      ) : (
        <>
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">เขต</h2>
              {canEdit && (
                <form onSubmit={submitTerritory} className="flex flex-wrap gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเขต" className="w-auto" />
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="รหัส (ถ้ามี)" className="w-auto" />
                  <Button type="submit" size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800">สร้างเขต</Button>
                </form>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-zinc-500">
                  <tr>
                    <th className="p-2">เขต</th>
                    <th className="p-2">Region</th>
                    <th className="p-2">ผู้ดูแลปัจจุบัน</th>
                    <th className="p-2">โรงพยาบาล</th>
                    <th className="p-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {territories.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2 font-medium">{item.name}{item.code ? ` (${item.code})` : ""}</td>
                      <td className="p-2">{item.region?.name ?? "—"}</td>
                      <td className="p-2">{item.activeOwnerCount}</td>
                      <td className="p-2">{item.hospitalCount}</td>
                      <td className="p-2">
                        {canEdit ? (
                          <button type="button" onClick={() => void toggleTerritory(item)} className="rounded border px-2 py-1 cursor-pointer">
                            {item.isActive ? "ใช้งาน" : "ปิดใช้"}
                          </button>
                        ) : (
                          item.isActive ? "ใช้งาน" : "ปิดใช้"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">ผู้ดูแลเขต</h2>
            {canEdit && (
              <form onSubmit={submitAssignment} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
                <label className="flex items-center gap-1">
                  เขต
                  <Select required value={assignment.territoryId} onChange={(e) => setAssignment({ ...assignment, territoryId: e.target.value })} className="w-auto">
                    <option value="">เลือก</option>
                    {territories.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </label>
                <label className="flex items-center gap-1">
                  พนักงาน
                  <Select required value={assignment.salespersonId} onChange={(e) => setAssignment({ ...assignment, salespersonId: e.target.value })} className="w-auto">
                    <option value="">เลือก</option>
                    {salespeople.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
                  </Select>
                </label>
                <label className="flex items-center gap-1">
                  มีผล
                  <Input type="date" value={assignment.effectiveFrom} onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })} className="w-auto" />
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={assignment.isSupervisor} onChange={(e) => setAssignment({ ...assignment, isSupervisor: e.target.checked })} /> supervisor
                </label>
                <Button type="submit" size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800">มอบหมาย</Button>
              </form>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-zinc-500">
                  <tr>
                    <th className="p-2">เขต</th>
                    <th className="p-2">ผู้ดูแล</th>
                    <th className="p-2">มีผล</th>
                    <th className="p-2">สิ้นสุด</th>
                    <th className="p-2">บทบาท</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.territory.name}</td>
                      <td className="p-2">{item.salesperson.displayName}</td>
                      <td className="p-2">{item.effectiveFrom.slice(0, 10)}</td>
                      <td className="p-2">{item.effectiveTo?.slice(0, 10) ?? "ACTIVE"}</td>
                      <td className="p-2">{item.isSupervisor ? "supervisor" : "ผู้ดูแล"}</td>
                      <td className="p-2">
                        {canEdit && !item.effectiveTo && (
                          <button type="button" onClick={() => void closeAssignment(item)} className="text-red-700 underline cursor-pointer">
                            ถอน
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <TerritoryGroupManager canEdit={canEdit} groups={groups} territories={territories} token={token} onChanged={load} onError={setError} />
        </>
      )}
    </div>
  );
}
