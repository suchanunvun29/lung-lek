"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkMoveHospitalsByProvince,
  listTerritories,
  moveHospitalToTerritory,
} from "@/features/territories/api/territories.api";
import { listHospitals } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { Hospital, Territory } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const MAX_SEARCH_RESULTS = 50;

export default function HospitalMovesPage() {
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [singleTerritoryId, setSingleTerritoryId] = useState("");
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);

  const [province, setProvince] = useState("");
  const [bulkTerritoryId, setBulkTerritoryId] = useState("");
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [hospitalData, territoryData] = await Promise.all([listHospitals(token), listTerritories(token)]);
      setHospitals(hospitalData.hospitals);
      setTerritories(territoryData.territories);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดข้อมูลโรงพยาบาลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The bulk endpoint matches Hospital.province by exact equality, so the selector offers the
  // province values that actually exist on hospital rows instead of the canonical mapping list.
  const provinces = useMemo(
    () => Array.from(new Set(hospitals.map((item) => item.province).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "th")),
    [hospitals]
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return hospitals
      .filter((item) => item.displayName.toLowerCase().includes(needle) || item.nameInFile.toLowerCase().includes(needle))
      .slice(0, MAX_SEARCH_RESULTS);
  }, [hospitals, query]);

  const selectedHospital = hospitals.find((item) => item.id === selectedHospitalId);
  const bulkHospitalCount = hospitals.filter((item) => item.province === province).length;
  const territoryName = (territoryId: string) => territories.find((item) => item.id === territoryId)?.name ?? "";

  function selectHospital(item: Hospital) {
    setSelectedHospitalId(item.id);
    setSingleSuccess(null);
  }

  async function submitSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedHospitalId || !singleTerritoryId) return;
    const hospitalName = selectedHospital?.displayName ?? "";
    try {
      await moveHospitalToTerritory(token, selectedHospitalId, singleTerritoryId);
      setSingleSuccess(`ย้าย ${hospitalName} เข้าเขต ${territoryName(singleTerritoryId)} แล้ว`);
      setSelectedHospitalId("");
      setQuery("");
      setSingleTerritoryId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ย้ายโรงพยาบาลไม่สำเร็จ"));
    }
  }

  function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!province || !bulkTerritoryId) return;
    setBulkSuccess(null);
    setConfirmingBulk(true);
  }

  async function confirmBulk() {
    if (!token || !province || !bulkTerritoryId) return;
    try {
      const { updatedCount } = await bulkMoveHospitalsByProvince(token, province, bulkTerritoryId);
      setBulkSuccess(`ย้ายแล้ว ${updatedCount} แห่งในจังหวัด${province} เข้าเขต ${territoryName(bulkTerritoryId)}`);
      setConfirmingBulk(false);
      setProvince("");
      setBulkTerritoryId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ย้ายโรงพยาบาลทั้งจังหวัดไม่สำเร็จ"));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">ย้ายโรงพยาบาลเข้าเขต</h1>
        <p className="mt-1 text-sm text-zinc-600">ย้ายทีละแห่งหรือยกทั้งจังหวัด — การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>
      </header>
      {!canEdit && <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">คุณดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-zinc-400">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">ย้ายรายแห่ง</h2>
            <form onSubmit={submitSingle} className="mt-3 space-y-3">
              <label className="block text-sm">
                ค้นหาโรงพยาบาล
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ชื่อโรงพยาบาล"
                  className="mt-1"
                />
              </label>
              <div className="max-h-64 overflow-y-auto rounded border border-zinc-200">
                {matches.length === 0 ? (
                  <p className="p-3 text-sm text-zinc-500">{query.trim() ? "ไม่พบโรงพยาบาล" : "พิมพ์ชื่อเพื่อค้นหา"}</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 text-sm">
                    {matches.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectHospital(item)}
                          className={`flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-50 cursor-pointer ${
                            selectedHospitalId === item.id ? "bg-zinc-100" : ""
                          }`}
                        >
                          <span className="font-medium">{item.displayName}</span>
                          <span className="text-zinc-500">{item.province ?? "—"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {matches.length === MAX_SEARCH_RESULTS && (
                <p className="text-xs text-zinc-400">แสดง {MAX_SEARCH_RESULTS} รายการแรก กรุณาค้นหาให้เจาะจงขึ้น</p>
              )}
              <label className="block text-sm">
                เขตเป้าหมาย
                <Select
                  required
                  value={singleTerritoryId}
                  onChange={(event) => setSingleTerritoryId(event.target.value)}
                  className="mt-1"
                >
                  <option value="">เลือกเขต</option>
                  {territories
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
              </label>
              <Button
                type="submit"
                disabled={!selectedHospitalId}
                className="bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                size="sm"
              >
                ย้ายโรงพยาบาล
              </Button>
              {selectedHospital && (
                <p className="text-sm text-zinc-600">
                  เลือกอยู่: <span className="font-medium">{selectedHospital.displayName}</span>
                  {selectedHospital.province ? ` · ${selectedHospital.province}` : ""}
                </p>
              )}
              {singleSuccess && <p className="text-sm text-emerald-700">{singleSuccess}</p>}
            </form>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">ย้ายยกทั้งจังหวัด</h2>
            <form onSubmit={submitBulk} className="mt-3 space-y-3">
              <label className="block text-sm">
                จังหวัด
                <Select
                  required
                  value={province}
                  onChange={(event) => {
                    setProvince(event.target.value);
                    setConfirmingBulk(false);
                  }}
                  className="mt-1"
                >
                  <option value="">เลือกจังหวัด</option>
                  {provinces.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                เขตเป้าหมาย
                <Select
                  required
                  value={bulkTerritoryId}
                  onChange={(event) => {
                    setBulkTerritoryId(event.target.value);
                    setConfirmingBulk(false);
                  }}
                  className="mt-1"
                >
                  <option value="">เลือกเขต</option>
                  {territories
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
              </label>
              {province && <p className="text-sm text-zinc-600">โรงพยาบาลในจังหวัดนี้ {bulkHospitalCount} แห่ง</p>}
              {!confirmingBulk ? (
                <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800" size="sm">
                  ไปยืนยันการย้าย
                </Button>
              ) : (
                <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">
                    ยืนยันย้ายโรงพยาบาลจังหวัด{province} ทั้งหมด ({bulkHospitalCount} แห่ง) เข้าเขต {territoryName(bulkTerritoryId)}?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void confirmBulk()}
                    >
                      ยืนยันย้ายทั้งจังหวัด
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingBulk(false)}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              )}
              {bulkSuccess && <p className="text-sm text-emerald-700">{bulkSuccess}</p>}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
