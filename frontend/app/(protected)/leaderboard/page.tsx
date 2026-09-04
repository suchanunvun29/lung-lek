"use client";

/**
 * Leaderboard ระดับเขต — Pattern B — WACC-P1-008
 *
 * The leaderboard ranks "target units" (territories / territory groups); rendering
 * follows the server's per-unit `visibility` level — no role checks live here and
 * no masking decision does either. Every cell the server withholds renders
 * `RestrictedValue`, keyed strictly on `visibility === "TERRITORY_RANK_ONLY"` —
 * never on a value being null/empty (zero and "no data" are legitimate), so a
 * restricted cell is visibly and textually distinct from an empty one.
 *
 * Business rules preserved untouched:
 *  • F — standard competition ranking (1, 2, 2, 4); the row order IS the rank order,
 *    so this table adds no client-side sorting.
 *  • G — territories inside a group appear only as detail under the group row
 *    (the group's member disclosure), never as their own ranked rows.
 * The unranked block carries an explicit heading and each unit's criterion reason
 * where the payload carries one (rank-only units get the restriction marker — the
 * reason itself is withheld by the server and the UI must not guess it).
 *
 * The criterion switcher is the Tabs primitive; period comes from the shell's
 * ContextBar; Export is the header's secondary action via ExportButton.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  LeaderboardPeopleModal,
  LeaderboardUnitNameCell,
  exportTerritoryLeaderboard,
  getTerritoryLeaderboard,
} from "@/features/leaderboard";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/importLabels";
import { LEADERBOARD_CRITERIA_LABEL_TH, LEADERBOARD_CRITERIA_ORDER, periodLabelTh } from "@/lib/kpiLabels";
import { LeaderboardCriteria, LeaderboardUnit, TerritoryLeaderboardResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import {
  DataTable,
  DataTableColumn,
  ExportButton,
  MetricReason,
  PageContainer,
  PageHeader,
  RestrictedValue,
} from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankLabel(rank: number | null): string {
  if (rank === null) return "—";
  return RANK_MEDAL[rank] ?? String(rank);
}

function achievementText(unit: LeaderboardUnit): string {
  const percent = unit.visibility === "TERRITORY_FULL" ? unit.achievementPercent : undefined;
  if (percent === null || percent === undefined) return "—";
  return `${percent.toFixed(1)}%`;
}

function targetText(unit: LeaderboardUnit): string {
  if (unit.visibility !== "TERRITORY_FULL") return "";
  if (unit.targetLabel) return unit.targetLabel;
  if (unit.achievementPercent !== null && unit.achievementPercent !== undefined) {
    return `${unit.achievementPercent.toFixed(1)}% ของเป้า ${formatMoney(unit.target ?? 0)}`;
  }
  return "ยังไม่ได้ตั้งเป้า";
}

export default function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const token = useAuthStore((state) => state.token);
  const period = useContextStore((state) => state.period);

  const [criteria, setCriteria] = useState<LeaderboardCriteria>("COMPOSITE");
  const [data, setData] = useState<TerritoryLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // WACC-P3-005: drill-down driven by ?people=<territoryId>
  const peopleParam = searchParams.get("people");
  const allUnits = [...(data?.ranked ?? []), ...(data?.unranked ?? [])];
  const matchedUnit = peopleParam
    ? allUnits.find((u) => String(u.territoryId) === peopleParam) ?? null
    : null;

  // If a deep link is provided with ?people=id before data loads or if not found in list,
  // create a placeholder LeaderboardUnit so the modal can fetch or show handled response
  const drillDownUnit: LeaderboardUnit | null = peopleParam
    ? matchedUnit ?? {
        unitType: "TERRITORY",
        territoryId: Number(peopleParam),
        name: `เขต ${peopleParam}`,
        visibility: "TERRITORY_FULL",
        rank: null,
        compositeScore: null,
        computedMetricLabel: "",
        ownerNames: [],
        criterionReason: null,
      }
    : null;

  const setDrillDownUnit = (unit: LeaderboardUnit | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (unit) {
      params.set("people", String(unit.territoryId));
    } else {
      params.delete("people");
    }
    const newQuery = params.toString();
    const newUrl = newQuery ? `?${newQuery}` : window.location.pathname;
    startTransition(() => {
      router.replace(newUrl, { scroll: false });
    });
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getTerritoryLeaderboard(token, criteria, period);
      setData(response);
      setLoadError(null);
    } catch (error) {
      setData(null);
      setLoadError(getErrorMessage(error, "โหลด Leaderboard ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, criteria, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadNonce]);

  async function exportBoard() {
    if (!token) return;
    // Same route, params and filename as before — ExportButton only owns the
    // pending/success/failure presentation (WACC-P0-019).
    await exportTerritoryLeaderboard(token, criteria, period);
  }

  const rankedUnits = data?.ranked ?? [];

  const columns: DataTableColumn<LeaderboardUnit>[] = [
    {
      key: "rank",
      header: "อันดับ",
      render: (unit) => (
        <span className="font-semibold text-text-primary" aria-label={`อันดับ ${unit.rank ?? "ไม่ได้จัดอันดับ"}`}>
          {rankLabel(unit.rank)}
        </span>
      ),
      priority: 1,
      mobileRole: "identity",
    },
    {
      key: "unit",
      header: "หน่วยเป้า",
      render: (unit) => <LeaderboardUnitNameCell unit={unit} />,
      priority: 1,
      mobileRole: "identity",
    },
    {
      key: "criterionValue",
      header: "คะแนน / ค่าตามเกณฑ์",
      numeric: true,
      render: (unit) => (
        <div>
          <p className="font-semibold text-text-primary font-numeric">
            {unit.compositeScore !== null ? unit.compositeScore.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-text-muted">{unit.computedMetricLabel}</p>
        </div>
      ),
      priority: 1,
      mobileRole: "metric",
    },
    {
      key: "achievement",
      header: "% ถึงเป้า",
      numeric: true,
      render: (unit) =>
        // Keyed on the wire visibility only — a FULL unit with no percent shows "—",
        // a rank-only unit gets the restriction marker. Never inferred from the value.
        unit.visibility === "TERRITORY_FULL" ? (
          <span className="text-text-secondary">{achievementText(unit)}</span>
        ) : (
          <RestrictedValue visibility={unit.visibility} />
        ),
      priority: 2,
      mobileRole: "meta",
    },
    {
      key: "revenue",
      header: "ยอดขาย",
      numeric: true,
      render: (unit) =>
        unit.visibility === "TERRITORY_FULL" ? (
          <span className="text-text-secondary font-numeric">{formatMoney(unit.revenue ?? 0)}</span>
        ) : (
          <RestrictedValue visibility={unit.visibility} />
        ),
      priority: 3,
      mobileRole: "meta",
    },
    {
      key: "target",
      header: "เป้า",
      render: (unit) =>
        unit.visibility === "TERRITORY_FULL" ? (
          <span className="text-xs text-text-secondary">{targetText(unit)}</span>
        ) : (
          <RestrictedValue visibility={unit.visibility} />
        ),
      priority: 3,
      mobileRole: "meta",
    },
    {
      key: "owners",
      header: "ผู้ดูแล",
      render: (unit) => <span className="text-xs text-text-muted">{unit.ownerNames.join(", ")}</span>,
      priority: 3,
      mobileRole: "meta",
    },
    {
      // Desktop/tablet drill-down trigger — DataTable's rowAction only renders on
      // <768px cards, so the button is a column too ("hidden" keeps it out of the
      // card details there, where rowAction already shows it).
      key: "people",
      header: "รายบุคคล",
      align: "right",
      render: (unit) =>
        unit.unitType === "TERRITORY" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setDrillDownUnit(unit)}>
            ดูรายบุคคล
          </Button>
        ) : null,
      priority: 2,
      mobileRole: "hidden",
    },
  ];

  return (
    <PageContainer width="standard" className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="อันดับและผลการดำเนินงานเทียบเป้าหมายของแต่ละเขต"
        primaryAction={
          <ExportButton
            onExport={exportBoard}
            className="sm:items-end"
          />
        }
      />

      <Tabs value={criteria} onValueChange={(v) => setCriteria(v as LeaderboardCriteria)}>
        <TabsList className="flex-wrap">
          {LEADERBOARD_CRITERIA_ORDER.map((option) => (
            <TabsTrigger key={option} value={option}>
              {LEADERBOARD_CRITERIA_LABEL_TH[option]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="mt-4">
        <h2 className="mb-2 text-base font-semibold text-text-primary">อันดับ</h2>
        <DataTable
          columns={columns}
          rows={rankedUnits}
          getRowId={(unit) => `${unit.unitType}-${unit.territoryId}`}
          caption={`อันดับหน่วยเป้า เกณฑ์${LEADERBOARD_CRITERIA_LABEL_TH[criteria]} ${periodLabelTh(period)}`}
          loading={loading}
          error={loadError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          emptyTitle="ยังไม่มีหน่วยเป้าที่คำนวณเกณฑ์นี้ได้"
          rowAction={(unit) =>
            unit.unitType === "TERRITORY" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setDrillDownUnit(unit)}>
                ดูรายบุคคล
              </Button>
            ) : undefined
          }
        />
      </section>

      {data && !loading && data.unranked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-base font-semibold text-text-primary">คำนวณเกณฑ์ที่เลือกไม่ได้</h2>
          <p className="mb-2 text-xs text-text-muted">
            หน่วยเป้าเหล่านี้ยังไม่มีอันดับในงวดนี้ เพราะคำนวณค่าตามเกณฑ์ที่เลือกไม่ได้ — เหตุผลรายหน่วยแสดงใต้ชื่อ
          </p>
          <ul className="space-y-2">
            {data.unranked.map((unit) => (
              <li
                key={`${unit.unitType}-${unit.territoryId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
              >
                <LeaderboardUnitNameCell unit={unit} />
                {unit.visibility === "TERRITORY_FULL" ? (
                  <MetricReason reason={unit.criterionReason ?? "คำนวณไม่ได้"} className="text-xs" />
                ) : (
                  <RestrictedValue visibility={unit.visibility} label="ไม่มีสิทธิ์เห็นตัวเลขของหน่วยนี้" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Buckets render only when the server sends them (MANAGER-only per Data Visibility Rules ข้อ 6). */}
      {data && !loading && data.buckets && (
        <Card className="mt-6 p-4">
          <h2 className="text-base font-semibold text-text-primary">ยอดนอกการจัดอันดับเขต</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">ยอดส่วนบุคคล</dt>
              <dd className="mt-1 font-semibold text-text-primary font-numeric">
                {data.buckets.personalBucket.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">ยอดที่ยังไม่กำหนดเขต ({data.buckets.unassignedHospitalCount} โรงพยาบาล)</dt>
              <dd className="mt-1 font-semibold text-text-primary font-numeric">
                {data.buckets.unassignedBucket.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {drillDownUnit && token && (
        <LeaderboardPeopleModal
          token={token}
          criteria={criteria}
          period={period}
          unit={drillDownUnit}
          onClose={() => setDrillDownUnit(null)}
        />
      )}
    </PageContainer>
  );
}
