"use client";

import { useCallback, useEffect, useState } from "react";
import { generateCoachingInsight, getCoachingInsight } from "@/features/coaching/api/coaching.api";
import { getErrorMessage } from "@/lib/api-client";
import {
  formatDateTimeTh,
  INSIGHT_STATUS_BADGE_CLASS,
  INSIGHT_STATUS_LABEL_TH,
  providerLabelTh,
} from "@/features/coaching/utils/coachingLabels";
import { CoachingInsight, PeriodKey, ScoredKpiMetric } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Drill-down from an AI summary always starts at revenue-vs-target — it's the metric the
// rule-based/Gemini summary leads with, and it reuses the same KpiDrillDownModal ScoreCard
// already renders on this page rather than building a second drill-down UI.
const DEFAULT_DRILL_DOWN_METRIC: ScoredKpiMetric = "REVENUE_VS_TARGET";

export interface CoachingInsightPanelProps {
  salespersonId: number;
  period: PeriodKey;
  onDrillDown: (metric: ScoredKpiMetric) => void;
}

export function CoachingInsightPanel({
  salespersonId,
  period,
  onDrillDown,
}: CoachingInsightPanelProps) {
  const token = useAuthStore((state) => state.token);

  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);

  const loadInsight = useCallback(async () => {
    if (!token || !salespersonId) return;
    setLoading(true);
    try {
      const data = await getCoachingInsight(token, salespersonId, period);
      setInsight(data.insight);
      setCanGenerate(data.canGenerate);
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
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text-muted">สรุปจุดแข็ง–จุดที่ควรพัฒนา (AI Coaching)</h2>
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

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || generating || loading}
          size="sm"
        >
          {generating ? "กำลังสร้าง..." : insight ? "สร้างใหม่" : "สร้างสรุป"}
        </Button>
      </div>

      {!canGenerate && (
        <p className="mt-2 text-xs text-text-muted">
          คุณไม่มีสิทธิ์สั่งสร้างสรุปนี้
        </p>
      )}

      {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}
      {generateError && <p className="mt-3 text-sm text-danger">{generateError}</p>}

      {loading && <p className="mt-4 text-text-muted">กำลังโหลด...</p>}

      {!loading && !insight && !loadError && (
        <p className="mt-4 text-sm text-text-muted">ยังไม่มีสรุปสำหรับงวดนี้</p>
      )}

      {!loading && insight && (
        <div className="mt-4 space-y-3">
          {insight.status === "FAILED" && (
            <p className="rounded-md bg-warning-subtle border border-warning/30 px-3 py-2 text-xs text-warning">
              เรียก AI ไม่สำเร็จ{insight.errorMessage ? `: ${insight.errorMessage}` : ""} — แสดงสรุปที่คำนวณจากกฎแทน
            </p>
          )}

          <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
            {insight.contentTh ?? "ยังไม่มีเนื้อหาสรุป"}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-text-muted">
              สร้างโดย {providerLabelTh(insight.provider)} · {formatDateTimeTh(insight.generatedAt)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDrillDown(DEFAULT_DRILL_DOWN_METRIC)}
              className="text-xs px-2.5 py-1"
            >
              ดูที่มาของตัวเลข
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default CoachingInsightPanel;
