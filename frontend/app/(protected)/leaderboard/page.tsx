"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LeaderboardPeopleModal,
  LeaderboardUnitRow,
  exportTerritoryLeaderboard,
  getTerritoryLeaderboard,
} from "@/features/leaderboard";
import { PeriodSelector } from "@/features/kpi";
import { getErrorMessage } from "@/lib/api-client";
import { LEADERBOARD_CRITERIA_LABEL_TH, LEADERBOARD_CRITERIA_ORDER } from "@/lib/kpiLabels";
import { LeaderboardCriteria, LeaderboardUnit, PeriodKey, TerritoryLeaderboardResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { ExportButton } from "@/components/shared/export/ExportButton";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

/** Module F2 — the leaderboard ranks "target units" (territories / territory groups), replacing
 *  Phase 5's person-ranked leaderboard entirely (Territory KPI Rules ข้อ 12). Rendering follows
 *  the server's visibility level per unit; no role checks live here. */
export default function LeaderboardPage() {
  const token = useAuthStore((state) => state.token);

  const [criteria, setCriteria] = useState<LeaderboardCriteria>("COMPOSITE");
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [data, setData] = useState<TerritoryLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drillDownUnit, setDrillDownUnit] = useState<LeaderboardUnit | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getTerritoryLeaderboard(token, criteria, period);
      setData(response);
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error, "โหลด Leaderboard ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, criteria, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function exportBoard() {
    if (!token) return;
    // Same route, params and filename as before — ExportButton only owns the
    // pending/success/failure presentation (WACC-P0-019).
    await exportTerritoryLeaderboard(token, criteria, period);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Leaderboard ระดับเขต</h1>
          <p className="mt-1 text-sm text-zinc-600">จัดอันดับหน่วยเป้า (เขต/กลุ่มเขต) — เลือกเกณฑ์และช่วงเวลาได้</p>
        </div>
        <ExportButton onExport={exportBoard} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="เกณฑ์จัดอันดับ">
        {LEADERBOARD_CRITERIA_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCriteria(option)}
            className={`rounded px-3 py-1.5 text-sm font-medium cursor-pointer ${
              option === criteria ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {LEADERBOARD_CRITERIA_LABEL_TH[option]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {data && !loading && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-900">อันดับ</h2>
            <ul className="space-y-2">
              {data.ranked.length === 0 && <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-400">ยังไม่มีหน่วยเป้าที่คำนวณเกณฑ์นี้ได้</li>}
              {data.ranked.map((unit) => (
                <LeaderboardUnitRow key={`${unit.unitType}-${unit.territoryId}`} unit={unit} onDrillDown={setDrillDownUnit} />
              ))}
            </ul>
          </section>

          {data.unranked.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-zinc-900">คำนวณเกณฑ์ที่เลือกไม่ได้</h2>
              <ul className="space-y-2">
                {data.unranked.map((unit) => (
                  <li key={`${unit.unitType}-${unit.territoryId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-amber-900">{unit.name}</p>
                      <p className="text-xs text-amber-700">{unit.ownerNames.join(", ")}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-800">{unit.visibility === "TERRITORY_FULL" ? unit.criterionReason ?? "คำนวณไม่ได้" : "ไม่มีสิทธิ์เห็นตัวเลขของหน่วยนี้"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Buckets render only when the server sends them (MANAGER-only per Data Visibility Rules ข้อ 6). */}
          {data.buckets && (
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold text-zinc-900">ยอดนอกการจัดอันดับเขต</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">ยอดส่วนบุคคล</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">{data.buckets.personalBucket.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">ยอดที่ยังไม่กำหนดเขต ({data.buckets.unassignedHospitalCount} โรงพยาบาล)</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">{data.buckets.unassignedBucket.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      )}

      {drillDownUnit && token && (
        <LeaderboardPeopleModal token={token} criteria={criteria} period={period} unit={drillDownUnit} onClose={() => setDrillDownUnit(null)} />
      )}
    </div>
  );
}
