"use client";

/**
 * ภาพรวมทีม — Pattern B — WACC-P1-006
 *
 * `PageHeader` (Export as the secondary action) → `DataTable` → footer count.
 * The endpoint (restored in WACC-P0-002) returns the full visible set for this
 * viewer's scope — not server-paginated — so sorting and searching happen
 * client-side over exactly the rows the server returned; no client-side role
 * filtering and no attempt to widen the set.
 *
 * Default order is composite descending — what this screen exists to show —
 * with the composite and name columns sortable on top. `computedFromLabel`
 * stays visible per row (business rule B), and a criterion that could not be
 * computed renders `MetricReason`, never a blank cell.
 *
 * Period comes from the shell's ContextBar (useContextStore); the local
 * PeriodSelector is gone. Ranking deliberately lives only on /leaderboard —
 * no rank column and no second ranking implementation here.
 */

import { useMemo, useState } from "react";
import { exportTeamOverviewReport, getTeamOverviewReport } from "@/features/reports/api/reports.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { formatScore, periodLabelTh, SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { TeamOverviewEntry } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { DataTable, DataTableColumn, ExportButton, PageContainer, PageHeader } from "@/components/shared";
import { MetricReason } from "@/components/shared/kpi/MetricReason";

export default function TeamOverviewReportPage() {
  const token = useAuthStore((state) => state.token);
  const period = useContextStore((state) => state.period);

  const [results, setResults] = useState<TeamOverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await getTeamOverviewReport(token, period, signal);
        if (signal.aborted) return;
        setResults(data.results);
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setResults([]);
          setLoadError(getErrorMessage(err, "โหลดภาพรวมทีมไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    // reloadNonce only changes via the error state's retry button.
    [token, period, reloadNonce]
  );

  async function handleExport() {
    if (!token) return;
    // Same parameters as the screen's own query.
    await exportTeamOverviewReport(token, period);
  }

  // Default order: composite descending, unranked (null composite) last —
  // DataTable's own sort state starts unset, so this IS the default view.
  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        const va = a.composite.composite;
        const vb = b.composite.composite;
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return vb - va;
      }),
    [results]
  );

  const columns: DataTableColumn<TeamOverviewEntry>[] = [
    {
      key: "displayName",
      header: "พนักงานขาย",
      render: (entry) => <span className="font-medium text-zinc-900">{entry.salesperson.displayName}</span>,
      sortable: true,
      sortValue: (entry) => entry.salesperson.displayName,
      priority: 1,
      mobileRole: "identity",
    },
    {
      key: "composite",
      header: "คะแนนรวม",
      numeric: true,
      sortable: true,
      sortValue: (entry) => entry.composite.composite,
      render: (entry) =>
        entry.composite.composite !== null ? (
          <span className="font-semibold text-zinc-900">
            {formatScore(entry.composite.composite)} <span className="text-xs font-normal text-zinc-400">/ 100</span>
          </span>
        ) : (
          <span className="text-xs text-amber-700">{entry.composite.message ?? "คำนวณไม่ได้"}</span>
        ),
      priority: 1,
      mobileRole: "metric",
    },
    {
      // Business rule B — "คิดจาก N จาก 5 เกณฑ์" per row.
      key: "computedFrom",
      header: "คิดจากเกณฑ์",
      render: (entry) => <span className="text-xs text-zinc-500">{entry.composite.computedFromLabel}</span>,
      priority: 2,
      mobileRole: "meta",
    },
    ...SCORED_METRIC_ORDER.map((metric, index): DataTableColumn<TeamOverviewEntry> => ({
      key: metric,
      header: SCORED_METRIC_LABEL_TH[metric],
      numeric: true,
      render: (entry) => {
        const result = entry.composite.metrics.find((m) => m.metric === metric);
        if (result?.computable && result.score !== null) {
          return <span className="text-zinc-700">{formatScore(result.score)}</span>;
        }
        // Not-computable criteria show the server's reason, never an empty cell.
        return <MetricReason reason={result?.reason ?? "คำนวณไม่ได้"} />;
      },
      priority: index === 0 ? 2 : 3,
      mobileRole: "meta",
    })),
  ];

  return (
    <PageContainer width="standard">
      <PageHeader
        title="ภาพรวมทีม"
        description="คะแนนรวมของพนักงานขายทุกคนในขอบเขตของคุณ เรียงจากคะแนนสูงสุดก่อน — กดหัวคอลัมน์เพื่อเรียงใหม่ได้"
        meta={`ทั้งหมด ${results.length.toLocaleString("th-TH")} รายการ`}
        secondaryActions={[
          <ExportButton key="export" onExport={handleExport} disabled={loading} disabledReason="รอโหลดข้อมูลก่อน" />,
        ]}
      />

      <DataTable
        columns={columns}
        rows={sortedResults}
        getRowId={(entry) => entry.salesperson.id}
        caption={`ภาพรวมทีม ${periodLabelTh(period)}`}
        loading={loading}
        error={loadError}
        onRetry={() => setReloadNonce((n) => n + 1)}
        emptyTitle="ยังไม่มีข้อมูลภาพรวมทีมในงวดนี้"
        searchable
        searchPredicate={(entry, query) =>
          entry.salesperson.displayName.toLowerCase().includes(query)
        }
        searchPlaceholder="ค้นหาชื่อพนักงานขาย…"
      />
    </PageContainer>
  );
}
