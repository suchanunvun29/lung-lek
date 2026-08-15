"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage, getLeaderboard } from "@/lib/api";
import { LEADERBOARD_CRITERIA_LABEL_TH, LEADERBOARD_CRITERIA_ORDER, formatLeaderboardValue } from "@/lib/kpiLabels";
import { LeaderboardCriteria, LeaderboardEntry, PeriodKey } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import PeriodSelector from "@/components/kpi/PeriodSelector";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const token = useAuthStore((state) => state.token);

  const [criteria, setCriteria] = useState<LeaderboardCriteria>("COMPOSITE");
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [results, setResults] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getLeaderboard(token, criteria, period);
      setResults(data.results);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลด Leaderboard ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, criteria, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Leaderboard</h1>
      <p className="mt-1 text-sm text-zinc-600">จัดอันดับพนักงานขายทั้งทีม แสดงชื่อจริง</p>

      <div className="mt-4 flex flex-wrap gap-1">
        {LEADERBOARD_CRITERIA_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCriteria(c)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              c === criteria ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {LEADERBOARD_CRITERIA_LABEL_TH[c]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !loadError && (
        <ul className="mt-6 space-y-2">
          {results.length === 0 && <li className="text-zinc-400">ไม่มีข้อมูล</li>}
          {results.map((entry) => (
            <li
              key={entry.salesperson.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 text-center text-lg font-semibold text-zinc-500">
                  {entry.rank !== null ? RANK_MEDAL[entry.rank] ?? entry.rank : "-"}
                </span>
                <span className="truncate font-medium text-zinc-900">{entry.salesperson.displayName}</span>
              </div>
              <div className="shrink-0 text-right">
                {entry.computable && entry.value !== null ? (
                  <span className="font-semibold text-zinc-900">{formatLeaderboardValue(criteria, entry.value)}</span>
                ) : (
                  <span className="text-xs text-amber-700">{entry.reason ?? "คำนวณไม่ได้"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
