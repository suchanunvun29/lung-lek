"use client";

import { useCallback, useEffect, useState } from "react";
import { listTerritories } from "@/features/territories/api/territories.api";
import { listTargets, upsertTerritoryTarget } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { Target, Territory } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Input } from "@/components/ui/input";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function TerritoryTargetsPage() {
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");
  const [year, setYear] = useState(new Date().getFullYear());
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [territoryData, targetData] = await Promise.all([
        listTerritories(token),
        listTargets(token, year, "TERRITORY"),
      ]);
      setTerritories(territoryData.territories);
      setTargets(targetData.targets);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดเป้าระดับเขตไม่สำเร็จ"));
    }
  }, [token, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(territoryId: number, month: number, _current: Target | undefined, revenueRaw: string, customersRaw: string) {
    if (!token || !canEdit) return;
    const revenueTarget = Number(revenueRaw);
    const newCustomerTarget = Number(customersRaw);
    if (!Number.isFinite(revenueTarget) || !Number.isFinite(newCustomerTarget)) return;
    try {
      await upsertTerritoryTarget(token, territoryId, year, month, { revenueTarget, newCustomerTarget });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "บันทึกเป้าระดับเขตไม่สำเร็จ"));
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ตั้งเป้าระดับเขต</h1>
      <p className="mt-1 text-sm text-zinc-600">เป้าระดับเขตแยกจากเป้ารายคน และกรอกได้เฉพาะผู้จัดการ</p>
      <label className="mt-4 inline-flex items-center gap-2 text-sm">
        ปี
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="p-3">เขต</th>
              {MONTHS.map((month) => (
                <th key={month} className="min-w-40 p-3">
                  เดือน {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {territories
              .filter((item) => item.isActive)
              .map((territory) => (
                <tr key={territory.id} className="border-b align-top">
                  <td className="whitespace-nowrap p-3 font-medium">{territory.name}</td>
                  {MONTHS.map((month) => {
                    const target = targets.find((item) => item.territoryId === territory.id && item.month === month);
                    return (
                      <td key={month} className="p-2">
                        <TargetEditor
                          target={target}
                          disabled={!canEdit}
                          onSave={(revenue, customers) => void save(territory.id, month, target, revenue, customers)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TargetEditor({
  target,
  disabled,
  onSave,
}: {
  target?: Target;
  disabled: boolean;
  onSave: (revenue: string, customers: string) => void;
}) {
  const [revenue, setRevenue] = useState(target?.revenueTarget ?? "");
  const [customers, setCustomers] = useState(target?.newCustomerTarget?.toString() ?? "");

  return (
    <div className="space-y-1">
      <Input
        aria-label="เป้ายอดขาย"
        disabled={disabled}
        value={revenue}
        onChange={(e) => setRevenue(e.target.value)}
        onBlur={() => onSave(String(revenue), String(customers))}
        placeholder="ยอดขาย"
        className="w-full text-xs"
      />
      <Input
        aria-label="เป้าลูกค้าใหม่"
        disabled={disabled}
        value={customers}
        onChange={(e) => setCustomers(e.target.value)}
        onBlur={() => onSave(String(revenue), String(customers))}
        placeholder="ลูกค้าใหม่"
        className="w-full text-xs"
      />
    </div>
  );
}
