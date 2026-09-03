"use client";

import { useCallback, useEffect, useState } from "react";
import { getSalespersonKpi } from "@/features/kpi/api/kpi.api";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { DrillDownMetric, PeriodKey, Salesperson, SalespersonKpiResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  PeriodSelector,
  ScoreCard,
  SupplementaryKpisPanel,
  KpiDrillDownModal,
} from "@/features/kpi";
import { Select } from "@/components/ui/select";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

export default function KpiPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [kpi, setKpi] = useState<SalespersonKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null);

  useEffect(() => {
    if (!token) return;
    listSalespeople(token)
      .then((data) => {
        setSalespeople(data.salespeople);
        setSalespersonId((prev) => {
          if (prev) return prev;
          const own = data.salespeople.find((sp) => sp.user?.id === currentUser?.id);
          const id = (own ?? data.salespeople[0])?.id;
          return id !== undefined ? String(id) : "";
        });
      })
      .catch(() => {
        // salesperson dropdown is a convenience — nothing else on the page depends on it loading
      });
  }, [token, currentUser]);

  const loadKpi = useCallback(async () => {
    if (!token || !salespersonId) return;
    setLoading(true);
    try {
      const data = await getSalespersonKpi(token, Number(salespersonId), period);
      setKpi(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดผลการประเมินไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, salespersonId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadKpi();
  }, [loadKpi]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ผลการประเมิน KPI</h1>
      <p className="mt-1 text-sm text-zinc-600">
        ดูคะแนนและตัวชี้วัดของพนักงานขายแต่ละคนตามรอบเดือน/ไตรมาส/ปี
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <label className="font-medium text-zinc-600">พนักงานขาย</label>
          <Select
            value={salespersonId}
            onChange={(e) => setSalespersonId(e.target.value)}
            className="w-auto"
          >
            {salespeople.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.displayName}
              </option>
            ))}
          </Select>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && kpi && (
        <div className="mt-6 space-y-4">
          <ScoreCard composite={kpi.composite} onDrillDown={(metric) => setDrillDownMetric(metric)} />

          <div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">ตัวชี้วัดเพิ่มเติม (ไม่คิดคะแนน)</h2>
            <SupplementaryKpisPanel
              supplementary={kpi.supplementary}
              onDrillDown={(metric) => setDrillDownMetric(metric)}
            />
          </div>
        </div>
      )}

      {drillDownMetric && kpi && (
        <KpiDrillDownModal
          salespersonId={kpi.salesperson.id}
          metric={drillDownMetric}
          period={period}
          onClose={() => setDrillDownMetric(null)}
        />
      )}
    </div>
  );
}
