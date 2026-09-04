"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TargetsGrid,
  targetKey,
  CopyTargetsModal,
  ProductGroupTargetsModal,
  listTargets,
  upsertTarget,
} from "@/features/targets";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { fetchKnownProductTypes } from "@/features/products/utils/deriveProductTypes";
import { EntitySummary, Salesperson, Target } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const YEAR_OFFSETS = [-1, 0, 1];

export default function TargetsPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [productTypes, setProductTypes] = useState<EntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [productGroupTarget, setProductGroupTarget] = useState<Target | null>(null);

  const loadTargets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [spData, targetsData] = await Promise.all([listSalespeople(token), listTargets(token, year)]);
      setSalespeople(spData.salespeople);
      setTargets(targetsData.targets);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดข้อมูลเป้าไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setProductTypes(await fetchKnownProductTypes(token));
      } catch {
        // product-type list is a convenience for the product-group modal — grid still works without it
      }
    })();
  }, [token]);

  const targetsByKey = useMemo(() => {
    const map = new Map<string, Target>();
    targets.forEach((t) => {
      if (t.salespersonId) map.set(targetKey(t.salespersonId, t.month), t);
    });
    return map;
  }, [targets]);

  async function handleSaveTarget(
    salespersonId: number,
    month: number,
    input: { revenueTarget: number; newCustomerTarget: number }
  ): Promise<boolean> {
    if (!token) return false;
    const key = targetKey(salespersonId, month);
    setSavingKey(key);
    setActionError(null);
    try {
      const data = await upsertTarget(token, salespersonId, year, month, input);
      const salesperson = salespeople.find((sp) => sp.id === salespersonId);
      setTargets((prev) => [
        ...prev.filter((t) => !(t.salespersonId === salespersonId && t.month === month)),
        {
          ...data.target,
          salesperson: salesperson ? { id: salesperson.id, displayName: salesperson.displayName } : undefined,
        },
      ]);
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err, "บันทึกเป้าไม่สำเร็จ"));
      return false;
    } finally {
      setSavingKey(null);
    }
  }

  function handleProductGroupsSaved(updated: Target) {
    setTargets((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...updated, salesperson: t.salesperson } : t))
    );
    setProductGroupTarget((prev) => (prev && prev.id === updated.id ? { ...updated, salesperson: prev.salesperson } : prev));
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">ตั้งเป้าพนักงานขาย</h1>
        {canEdit && (
          <Button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            size="sm"
          >
            คัดลอกเป้าเดือนก่อน
          </Button>
        )}
      </div>

      {!canEdit && (
        <p className="mt-1 text-sm text-text-secondary">คุณสามารถดูเป้าได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <label className="font-medium text-text-secondary">ปี</label>
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

      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}
      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-text-muted">กำลังโหลด...</p>
        ) : (
          <TargetsGrid
            key={year}
            ownerNoun="พนักงานขาย"
            owners={salespeople.map((sp) => ({ id: sp.id, displayName: sp.displayName }))}
            targetsByKey={targetsByKey}
            canEdit={canEdit}
            savingKey={savingKey}
            onSave={handleSaveTarget}
            onOpenProductGroups={setProductGroupTarget}
            onViewHistory={(target) => router.push(`/targets/${target.id}/revisions`)}
          />
        )}
      </div>

      {copyModalOpen && (
        <CopyTargetsModal
          year={year}
          salespeople={salespeople}
          onClose={() => setCopyModalOpen(false)}
          onCopied={() => void loadTargets()}
        />
      )}

      {productGroupTarget && (
        <ProductGroupTargetsModal
          target={productGroupTarget}
          productTypes={productTypes}
          canEdit={canEdit}
          onClose={() => setProductGroupTarget(null)}
          onSaved={handleProductGroupsSaved}
        />
      )}
    </div>
  );
}
