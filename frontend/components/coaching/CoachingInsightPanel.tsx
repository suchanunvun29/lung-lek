"use client";

import { useCallback, useEffect, useState } from "react";
import { generateCoachingInsight, getCoachingInsight, getErrorMessage } from "@/lib/api";
import { formatDateTimeTh, INSIGHT_STATUS_BADGE_CLASS, INSIGHT_STATUS_LABEL_TH, providerLabelTh } from "@/lib/coachingLabels";
import { CoachingInsight, PeriodKey, ScoredKpiMetric } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

// Drill-down from an AI summary always starts at revenue-vs-target — it's the metric the
// rule-based/Gemini summary leads with, and it reuses the same KpiDrillDownModal ScoreCard
// already renders on this page rather than building a second drill-down UI.
const DEFAULT_DRILL_DOWN_METRIC: ScoredKpiMetric = "REVENUE_VS_TARGET";

interface CoachingInsightPanelProps {
  salespersonId: string;
  period: PeriodKey;
  /** False when a SALESPERSON is viewing someone else's insight — the backend rejects generate in that case. */
  canGenerate: boolean;
  onDrillDown: (metric: ScoredKpiMetric) => void;
}

export default function CoachingInsightPanel({
  salespersonId,
  period,
  canGenerate,
  onDrillDown,
}: CoachingInsightPanelProps) {
  const token = useAuthStore((state) => state.token);

  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadInsight = useCallback(async () => {
    if (!token || !salespersonId) return;
    setLoading(true);
    try {
      const data = await getCoachingInsight(token, salespersonId, period);
      setInsight(data.insight);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดสรุป AI ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, salespersonId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInsight();
  }, [loadInsight]);

  async function handleGenerate() {
    if (!token || !salespersonId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const data = await generateCoachingInsight(token, salespersonId, period);
      setInsight(data.insight);
    } catch (err) {
      setGenerateError(getErrorMessage(err, "สร้างสรุป AI ไม่สำเร็จ"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-500">สรุปจุดแข็ง–จุดที่ควรพัฒนา (AI Coaching)</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {insight && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${INSIGHT_STATUS_BADGE_CLASS[insight.status]}`}
              >
                {INSIGHT_STATUS_LABEL_TH[insight.status]}
              </span>
            )}
            {insight?.isStale && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                ข้อมูลอัปเดตแล้ว — กด &quot;สร้างใหม่&quot; เพื่อรีเฟรชสรุป
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || generating || loading}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {generating ? "กำลังสร้าง..." : insight ? "สร้างใหม่" : "สร้างสรุป"}
        </button>
      </div>

      {!canGenerate && (
        <p className="mt-2 text-xs text-zinc-500">
          พนักงานขายสร้างสรุปได้เฉพาะของตัวเองเท่านั้น — ให้ผู้จัดการเป็นผู้สร้างสรุปนี้แทน
        </p>
      )}

      {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
      {generateError && <p className="mt-3 text-sm text-red-600">{generateError}</p>}

      {loading && <p className="mt-4 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !insight && !loadError && (
        <p className="mt-4 text-sm text-zinc-500">ยังไม่มีสรุปสำหรับงวดนี้</p>
      )}

      {!loading && insight && (
        <div className="mt-4 space-y-3">
          {insight.status === "FAILED" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              เรียก AI ไม่สำเร็จ{insight.errorMessage ? `: ${insight.errorMessage}` : ""} — แสดงสรุปที่คำนวณจากกฎแทน
            </p>
          )}

          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800">
            {insight.contentTh ?? "ยังไม่มีเนื้อหาสรุป"}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <p className="text-xs text-zinc-500">
              สร้างโดย {providerLabelTh(insight.provider)} · {formatDateTimeTh(insight.generatedAt)}
            </p>
            <button
              type="button"
              onClick={() => onDrillDown(DEFAULT_DRILL_DOWN_METRIC)}
              className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              ดูที่มาของตัวเลข
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
