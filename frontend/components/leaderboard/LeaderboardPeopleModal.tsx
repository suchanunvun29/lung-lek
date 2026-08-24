"use client";

import { useEffect, useState } from "react";
import { getErrorMessage, getTerritoryLeaderboardPeople } from "@/lib/api";
import { LeaderboardCriteria, LeaderboardPeopleOrSummary, LeaderboardUnit, PeriodKey } from "@/lib/types";

interface Props {
  token: string;
  criteria: LeaderboardCriteria;
  period: PeriodKey;
  unit: LeaderboardUnit;
  onClose: () => void;
}

/** Tier-2 drill-down. Which version renders is decided entirely by the server's response mode —
 *  FULL (MANAGER/supervisor) gets every person's composite; SELF_SUMMARY gets exactly
 *  { rank, totalRanked, ownValue, teamAverage } (Data Visibility Rules ข้อ 7). */
export default function LeaderboardPeopleModal({ token, criteria, period, unit, onClose }: Props) {
  const [data, setData] = useState<LeaderboardPeopleOrSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTerritoryLeaderboardPeople(token, unit.territoryId, criteria, period)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getErrorMessage(loadError, "โหลดข้อมูลรายบุคคลไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, unit.territoryId, criteria, period]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            รายบุคคลใน{unit.unitType === "GROUP" ? "กลุ่มเขตของ " : "เขต "}
            {unit.name}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="ปิด">
            ✕
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {loading && !error && <p className="mt-4 text-sm text-zinc-400">กำลังโหลด...</p>}

        {data?.mode === "FULL" && (
          <ul className="mt-4 space-y-2">
            {data.results.length === 0 && <li className="text-sm text-zinc-400">ยังไม่มีผู้ดูแลที่มีผลอยู่</li>}
            {data.results.map((row) => (
              <li key={row.salesperson.id} className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">{row.salesperson.displayName}</span>
                  <span className="font-semibold">{row.composite.composite !== null ? `${row.composite.composite.toFixed(2)} คะแนน` : "—"}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{row.composite.computedFromLabel}</p>
              </li>
            ))}
          </ul>
        )}

        {data?.mode === "SELF_SUMMARY" && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p>สิทธิ์การดูของคุณจำกัดเฉพาะอันดับและสถิติของตัวเองเทียบค่าเฉลี่ยทีม</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-amber-700">อันดับของคุณตามเกณฑ์</dt>
                <dd className="font-semibold">{data.rank !== null ? `${data.rank} จาก ${data.totalRanked}` : data.reason ?? "คำนวณไม่ได้"}</dd>
              </div>
              <div>
                <dt className="text-amber-700">ค่าของคุณตามเกณฑ์</dt>
                <dd className="font-semibold">{data.ownComputable && data.ownValue !== null ? data.ownValue.toFixed(2) : data.reason ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-amber-700">คะแนนรวมเฉลี่ยทีม</dt>
                <dd className="font-semibold">{data.teamAverage !== null ? data.teamAverage.toFixed(2) : "—"}</dd>
              </div>
              <div>
                <dt className="text-amber-700">จำนวนคนที่คำนวณเกณฑ์นี้ได้จริง</dt>
                <dd className="font-semibold">{data.totalRanked}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
