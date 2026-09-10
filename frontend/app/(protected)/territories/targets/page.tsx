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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listTerritories } from "@/features/territories/api/territories.api";
import { TargetsGrid, targetKey, listTargets, upsertTerritoryTarget } from "@/features/targets";
import { Target, Territory } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { SkeletonTable } from "@/components/shared/feedback/Skeleton";

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
  // Unsaved-cell count reported by TargetsGrid; used to guard the year switch.
  const [gridDirtyCount, setGridDirtyCount] = useState(0);
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const [territoryData, targetData] = await Promise.all([
          listTerritories(token, signal),
          listTargets(token, year, "TERRITORY", signal),
        ]);
        if (signal.aborted) return;
        setTerritories(territoryData.territories);
        setTargets(targetData.targets);
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลดเป้าระดับเขตไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [token, year, reloadNonce]
  );

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

  function handleYearChange(nextYear: number) {
    if (nextYear === year) return;
    if (gridDirtyCount > 0) {
      setPendingYear(nextYear);
      return;
    }
    setGridDirtyCount(0);
    setYear(nextYear);
  }

  function confirmPendingYear() {
    if (pendingYear === null) return;
    setGridDirtyCount(0);
    setYear(pendingYear);
    setPendingYear(null);
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-text-primary">เป้ารายเขต</h1>
      <p className="mt-1 text-sm text-text-secondary">
        เป้าระดับเขตแยกจากเป้ารายคน — พนักงานขายที่ไม่ได้ตั้งเป้าเองจะได้เป้าจากเขตที่รับผิดชอบ
        {!canEdit && " (ดูได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ)"}
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <label htmlFor="territory-targets-year-select" className="font-medium text-text-secondary">ปี</label>
        <Select
          id="territory-targets-year-select"
          value={String(year)}
          onChange={(e) => handleYearChange(Number(e.target.value))}
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

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      <div className="mt-4">
        {loading ? (
          <SkeletonTable rows={8} columns={14} />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title="เกิดข้อผิดพลาดในการโหลดเป้าระดับเขต"
            description={loadError}
            onRetry={() => setReloadNonce((n) => n + 1)}
            isRetrying={loading}
          />
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
            onDirtyCountChange={setGridDirtyCount}
          />
        )}
      </div>

      {pendingYear !== null && (
        <ConfirmDialog
          title="เปลี่ยนปีระหว่างมีการแก้ไขที่ยังไม่บันทึก?"
          description={`มีการแก้ไขที่ยังไม่บันทึก ${gridDirtyCount.toLocaleString("th-TH")} ช่อง — เปลี่ยนปีแล้วข้อมูลที่กรอกจะหาย`}
          confirmLabel="เปลี่ยนปี"
          cancelLabel="ยกเลิก"
          tone="danger"
          onConfirm={confirmPendingYear}
          onCancel={() => setPendingYear(null)}
        />
      )}
    </div>
  );
}
