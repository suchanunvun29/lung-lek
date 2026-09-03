"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listTerritories,
  listUnassignedTerritoryHospitals,
  moveHospitalToTerritory,
} from "@/features/territories/api/territories.api";
import { getErrorMessage } from "@/lib/api-client";
import { Territory, UnassignedTerritoryHospital } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Select } from "@/components/ui/select";

export default function UnassignedTerritoriesPage() {
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");
  const [hospitals, setHospitals] = useState<UnassignedTerritoryHospital[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [bucket, setBucket] = useState(0);
  const [hospitalCount, setHospitalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [hospitalData, territoryData] = await Promise.all([
        listUnassignedTerritoryHospitals(token),
        listTerritories(token),
      ]);
      setHospitals(hospitalData.hospitals);
      setBucket(hospitalData.unassignedBucket);
      setHospitalCount(hospitalData.hospitalCount);
      setTerritories(territoryData.territories);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดโรงพยาบาลที่ยังไม่ผูกเขตไม่สำเร็จ"));
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function assign(hospitalId: string, territoryId: string) {
    if (!token || !territoryId) return;
    try {
      await moveHospitalToTerritory(token, hospitalId, territoryId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ผูกเขตให้โรงพยาบาลไม่สำเร็จ"));
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">โรงพยาบาลที่ยังไม่ผูกเขต</h1>
      <p className="mt-1 text-sm text-zinc-600">
        จำนวน {hospitalCount} แห่ง · ยอดรวมที่ยังไม่จัดเขต (unassignedBucket): ฿{bucket.toLocaleString("th-TH")}
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-600">
            <tr>
              <th className="p-3">โรงพยาบาล</th>
              <th className="p-3">จังหวัด</th>
              <th className="p-3">ยอดขายที่ยังไม่จัดเขต</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3">ผูกเขตอย่างเร็ว</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map((hospital) => (
              <tr key={hospital.id} className="border-b">
                <td className="p-3 font-medium">{hospital.displayName}</td>
                <td className="p-3">{hospital.province ?? "—"}</td>
                <td className="p-3">฿{hospital.unassignedBucket.toLocaleString("th-TH")}</td>
                <td className="p-3">
                  {hospital.ambiguous && (
                    <span className="rounded bg-amber-100 px-2 py-1 text-amber-800 text-xs font-medium">
                      กำกวม: อันดับ 2 ≥ 30%
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {canEdit ? (
                    <Select
                      defaultValue=""
                      onChange={(event) => void assign(hospital.id, event.target.value)}
                      className="w-auto text-xs"
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
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {hospitals.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-500">
                  ไม่มีโรงพยาบาลค้างผูกเขต
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
