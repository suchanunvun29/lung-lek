"use client";

import { useCallback, useEffect, useState } from "react";
import { exportTeamOverviewReport, getTeamOverviewReport } from "@/features/reports";
import { PeriodSelector } from "@/features/kpi";
import { getErrorMessage } from "@/lib/api-client";
import { formatScore } from "@/lib/kpiLabels";
import { PeriodKey, TeamOverviewEntry } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

export default function TeamOverviewReportPage() {
  const token = useAuthStore((state) => state.token);

  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [results, setResults] = useState<TeamOverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getTeamOverviewReport(token, period);
      setResults(data.results);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดภาพรวมทีมไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportTeamOverviewReport(token, period);
    } catch (err) {
      setExportError(getErrorMessage(err, "ดาวน์โหลดรายงานไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ภาพรวมทีม</h1>
      <p className="mt-1 text-sm text-zinc-600">
        เรียงจากผู้ที่ควรได้รับการช่วยเหลือก่อน (คะแนนรวมต่ำสุดก่อน) — ผู้ที่ยังไม่มีคะแนนรวมจะแสดงต่อท้าย
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <PeriodSelector value={period} onChange={setPeriod} />
        <Button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className="bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          size="sm"
        >
          {exporting ? "กำลังดาวน์โหลด..." : "Export Excel"}
        </Button>
      </div>

      {exportError && <p className="mt-3 text-sm text-red-600">{exportError}</p>}
      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !loadError && (
        <ul className="mt-6 space-y-2">
          {results.length === 0 && <li className="text-zinc-400">ไม่มีข้อมูล</li>}
          {results.map((entry, index) => (
            <li
              key={entry.salesperson.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 text-center text-lg font-semibold text-zinc-500">
                  {entry.composite.composite !== null ? index + 1 : "-"}
                </span>
                <span className="truncate font-medium text-zinc-900">{entry.salesperson.displayName}</span>
              </div>
              <div className="shrink-0 text-right">
                {entry.composite.composite !== null ? (
                  <>
                    <span className="font-semibold text-zinc-900">{formatScore(entry.composite.composite)} / 100</span>
                    <p className="text-xs text-zinc-500">{entry.composite.computedFromLabel}</p>
                  </>
                ) : (
                  <span className="text-xs text-amber-700">{entry.composite.message ?? "คำนวณไม่ได้"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
