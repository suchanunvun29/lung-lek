"use client";

/**
 * /territories/targets — WACC-P1-014
 *
 * Territory targets migrated onto the shared TargetsGrid (one grid, three owner
 * types), saving through PUT /targets/territory/{id}/{year}/{month} restored by
 * WACC-P0-003. Read-open like /targets: SALESPERSON sees a read-only grid,
 * editing is MANAGER-only (canEdit). Product-group targets do not apply to the
 * territory scope, so no product-group action is offered here.
 *
 * Business rules preserved: a written Target carries territoryId only with
 * Scope = TERRITORY (rule E), and a territory with no active owner stays
 * flagged Unassigned downstream (rule D) — neither is computed on this screen.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listTerritories } from "@/features/territories/api/territories.api";
import { TargetsGrid, targetKey, listTargets, upsertTerritoryTarget } from "@/features/targets";
import { Target, Territory } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { Select } from "@/components/ui/select";

const YEAR_OFFSETS = [-1, 0, 1];

export default function TerritoryTargetsPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [territoryData, targetData] = await Promise.all([
        listTerritories(token),
        listTargets(token, year, "TERRITORY"),
      ]);
      setTerritories(territoryData.territories);
      setTargets(targetData.targets);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดเป้าระดับเขตไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const targetsByKey = useMemo(() => {
    const map = new Map<string, Target>();
    targets.forEach((t) => {
      if (t.territoryId) map.set(targetKey(t.territoryId, t.month), t);
    });
    return map;
  }, [targets]);

  async function handleSaveTarget(
    territoryId: number,
    month: number,
    input: { revenueTarget: number; newCustomerTarget: number }
  ): Promise<boolean> {
    if (!token) return false;
    const key = targetKey(territoryId, month);
    setSavingKey(key);
    setActionError(null);
    try {
      const data = await upsertTerritoryTarget(token, territoryId, year, month, input);
      const territory = territories.find((item) => item.id === territoryId);
      setTargets((prev) => [
        ...prev.filter((t) => !(t.territoryId === territoryId && t.month === month)),
        {
          ...data.target,
          territory: territory ? { id: territory.id, name: territory.name } : undefined,
        },
      ]);
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err, "บันทึกเป้าระดับเขตไม่สำเร็จ"));
      return false;
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">เป้ารายเขต</h1>
      <p className="mt-1 text-sm text-zinc-600">
        เป้าระดับเขตแยกจากเป้ารายคน — พนักงานขายที่ไม่ได้ตั้งเป้าเองจะได้เป้าจากเขตที่รับผิดชอบ
        {!canEdit && " (ดูได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ)"}
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <label className="font-medium text-zinc-600">ปี</label>
        <Select
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-auto"
        >
          {YEAR_OFFSETS.map((offset) => {
            const y = currentYear + offset;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </Select>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-zinc-400">กำลังโหลด...</p>
        ) : (
          <TargetsGrid
            key={year}
            ownerNoun="เขต"
            owners={territories
              .filter((territory) => territory.isActive)
              .map((territory) => ({ id: territory.id, displayName: territory.name }))}
            targetsByKey={targetsByKey}
            canEdit={canEdit}
            savingKey={savingKey}
            onSave={handleSaveTarget}
            onViewHistory={(target) => router.push(`/targets/${target.id}/revisions`)}
          />
        )}
      </div>
    </div>
  );
}
