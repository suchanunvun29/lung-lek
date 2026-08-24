import { KpiMetric } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CompositeScoreResult, MetricResult, getDataCoverageMonths, getEvaluationSettings, getScoringWeights } from "./kpi.service";
import { PeriodKey, firstDayOfPeriod, lastDayOfPeriod, lastMonthOfPeriod, monthsInPeriod, monthsWhereOr, previousPeriod, trailingMonths } from "./period.util";

// Data Visibility Rules ข้อ 6 — the single whitelist constant of the system.
// Module N (this file) owns it; Phase 18 / Module F2 must import it, never redeclare it.
export const TERRITORY_RANK_ONLY_FIELDS = ["territoryId", "name", "ownerNames", "rank", "compositeScore", "computedMetricLabel"] as const;

type TerritoryLine = { hospitalId: string; productTypeId: string; year: number; month: number; total: number };

// Territory KPI Rules ข้อ 2: Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100)
// where hospital.territoryId = T, salesperson NOT excludedFromTerritoryTotals, period matches.
// Always through SalesLineCredit — never through SalesLine.salespersonId.
async function lines(territoryId: string, period: PeriodKey): Promise<TerritoryLine[]> {
  const rows = await prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospital: { territoryId }, OR: monthsWhereOr(monthsInPeriod(period)) } }, select: { sharePercent: true, salesLine: { select: { hospitalId: true, productTypeId: true, year: true, month: true, total: true } } } });
  return rows.map((r) => ({ ...r.salesLine, total: Number(r.salesLine.total) * Number(r.sharePercent) / 100 }));
}

export async function getTerritoryRevenue(territoryId: string, period: PeriodKey): Promise<number> {
  return (await lines(territoryId, period)).reduce((s, row) => s + row.total, 0);
}

function unavailable(metric: KpiMetric, reason: string, detail: Record<string, unknown> = {}): MetricResult { return { metric, computable: false, score: null, reason, detail }; }

// Territory KPI Rules ข้อ 5 label formats — never 0%, never a hidden criterion.
export function insufficientDataLabel(required: number, current: number): string {
  return `ข้อมูลยังไม่เพียงพอ (ต้องการ ${required} เดือน ปัจจุบันมี ${current} เดือน)`;
}

const NO_TARGET_LABEL = "ยังไม่ได้ตั้งเป้า";

export interface TerritoryKpiComputation extends CompositeScoreResult {
  revenue: number;
  target: number | null;
  achievementPercent: number | null;
  targetLabel: string | null;
  targetUnitGroupId: string | null;
}

export async function computeTerritoryKpi(territoryId: string, period: PeriodKey): Promise<TerritoryKpiComputation> {
  const [periodLines, targetRows, settings, weights, coverage] = await Promise.all([
    lines(territoryId, period), prisma.target.findMany({ where: { territoryId, scope: "TERRITORY", OR: monthsWhereOr(monthsInPeriod(period)) }, include: { productGroupTargets: { include: { productType: true } } } }), getEvaluationSettings(), getScoringWeights(), getDataCoverageMonths(),
  ]);
  // Territory KPI Rules ข้อ 6: a member territory of a TerritoryGroup (effective in this period)
  // has no separate target — its target column shows the group label and REVENUE_VS_TARGET is
  // not computable. Month-edge membership ranges make whole-period membership exact.
  const membership = await prisma.territoryGroupMember.findFirst({
    where: { territoryId, effectiveFrom: { lte: lastDayOfPeriod(period) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(period) } }] },
    include: { group: { select: { id: true, name: true } } },
  });
  const revenue = periodLines.reduce((s, row) => s + row.total, 0);
  const groupLabel = membership ? `ไม่ได้ตั้งเป้าแยก (อยู่ในเป้ารวมของกลุ่ม ${membership.group.name})` : null;
  const revenueMetric: MetricResult = membership
    ? unavailable("REVENUE_VS_TARGET", groupLabel!, { actual: revenue })
    : (() => { const target = targetRows.reduce((s, row) => s + Number(row.revenueTarget), 0); return target > 0 ? { metric: "REVENUE_VS_TARGET" as const, computable: true, score: Math.min(revenue / target * 100, 100), reason: null, detail: { actual: revenue, target, achievementPercent: revenue / target * 100 } } : unavailable("REVENUE_VS_TARGET", NO_TARGET_LABEL, { actual: revenue, target }); })();
  const target = membership ? null : targetRows.reduce((s, row) => s + Number(row.revenueTarget), 0);
  const newTarget = targetRows.reduce((s, row) => s + row.newCustomerTarget, 0);
  let newActual = 0;
  if (newTarget > 0) {
    const periodKeys = new Set(monthsInPeriod(period).map((m) => `${m.year}-${m.month}`));
    const firstSales = await prisma.salesLine.findMany({ where: { hospital: { territoryId, isPreExistingCustomer: false }, credits: { some: { salesperson: { excludedFromTerritoryTotals: false } } } }, orderBy: [{ year: "asc" }, { month: "asc" }, { invoiceDate: "asc" }, { createdAt: "asc" }], select: { hospitalId: true, year: true, month: true }, distinct: ["hospitalId"] });
    newActual = firstSales.filter((row) => periodKeys.has(`${row.year}-${row.month}`)).length;
  }
  const newMetric = newTarget > 0 ? { metric: "NEW_CUSTOMERS" as const, computable: true, score: Math.min(newActual / newTarget * 100, 100), reason: null, detail: { actual: newActual, target: newTarget } } : unavailable("NEW_CUSTOMERS", NO_TARGET_LABEL, { actual: newActual, target: newTarget });
  const groups = targetRows.flatMap((targetRow) => targetRow.productGroupTargets);
  const groupMetric = groups.length ? (() => { const totalTarget = groups.reduce((s, g) => s + Number(g.revenueTarget), 0); if (!totalTarget) return unavailable("PRODUCT_GROUP", "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0"); const actual = new Map<string, number>(); for (const row of periodLines) actual.set(row.productTypeId, (actual.get(row.productTypeId) ?? 0) + row.total); const capped = groups.reduce((s, group) => s + Math.min(actual.get(group.productTypeId) ?? 0, Number(group.revenueTarget)), 0); return { metric: "PRODUCT_GROUP" as const, computable: true, score: capped / totalTarget * 100, reason: null, detail: { totalTarget, capped } }; })() : unavailable("PRODUCT_GROUP", "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้");
  const retention = coverage < settings.minMonthsForChurn ? unavailable("RETENTION", insufficientDataLabel(settings.minMonthsForChurn, coverage)) : await retentionMetric(territoryId, period);
  const consistency = coverage < settings.minMonthsForConsistency ? unavailable("CONSISTENCY", insufficientDataLabel(settings.minMonthsForConsistency, coverage)) : await consistencyMetric(territoryId, period, settings.minMonthsForConsistency);
  const metrics = [revenueMetric, newMetric, groupMetric, retention, consistency]; const available = metrics.filter((m) => m.computable); const weightSum = available.reduce((s, m) => s + (weights.get(m.metric) ?? 0), 0); const composite = weightSum ? available.reduce((s, m) => s + (weights.get(m.metric) ?? 0) * (m.score ?? 0), 0) / weightSum : null;
  return { composite: composite === null ? null : Math.round(composite * 100) / 100, computedFromCount: available.length, computedFromLabel: `คิดจาก ${available.length} จาก 5 เกณฑ์`, message: composite === null ? "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้" : null, metrics, revenue, target, achievementPercent: target ? revenue / target * 100 : null, targetLabel: groupLabel, targetUnitGroupId: membership?.group.id ?? null };
}

async function retentionMetric(territoryId: string, period: PeriodKey): Promise<MetricResult> { const [prev, current] = await Promise.all([lines(territoryId, previousPeriod(period)), lines(territoryId, period)]); const prevIds = new Set(prev.map((r) => r.hospitalId)); if (!prevIds.size) return unavailable("RETENTION", "ไม่มีลูกค้าในงวดก่อนหน้า"); const currentIds = new Set(current.map((r) => r.hospitalId)); const actual = [...prevIds].filter((id) => currentIds.has(id)).length; return { metric: "RETENTION", computable: true, score: actual / prevIds.size * 100, reason: null, detail: { previousHospitalCount: prevIds.size, retainedHospitalCount: actual } }; }
async function consistencyMetric(territoryId: string, period: PeriodKey, count: number): Promise<MetricResult> { const end = lastMonthOfPeriod(period); const months = trailingMonths(end.year, end.month, count); const value = await Promise.all(months.map((m) => lines(territoryId, { periodType: "MONTH", year: m.year, periodNumber: m.month }))); const values = value.map((rows) => rows.reduce((s, row) => s + row.total, 0)); const mean = values.reduce((s, v) => s + v, 0) / values.length; if (!mean) return unavailable("CONSISTENCY", "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0", { monthlyValues: values }); const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length; return { metric: "CONSISTENCY", computable: true, score: Math.max(0, 1 - Math.sqrt(variance) / mean) * 100, reason: null, detail: { monthlyValues: values, mean } }; }

export interface PersonalBucketEntry { salespersonId: string; displayName: string; revenue: number; personalTarget: number; achievementPercent: number | null; }

// Territory KPI Rules ข้อ 3 — the three-bucket equation:
// Σ revenue(every territory) + personalBucket + unassignedBucket = Σ SalesLine.total (companyTotal).
// All three chunks plus companyTotal come out together so qa-engineer can check the equation directly.
export async function getTerritoryBuckets(period: PeriodKey) {
  const monthsWhere = { OR: monthsWhereOr(monthsInPeriod(period)) };
  const [company, credits] = await Promise.all([
    prisma.salesLine.aggregate({ where: monthsWhere, _sum: { total: true } }),
    prisma.salesLineCredit.findMany({
      where: { salesLine: monthsWhere },
      select: { sharePercent: true, salesperson: { select: { excludedFromTerritoryTotals: true } }, salesLine: { select: { total: true, hospitalId: true, hospital: { select: { territoryId: true } } } } },
    }),
  ]);
  let personalBucket = 0;
  let unassignedBucket = 0;
  const unassignedHospitalIds = new Set<string>();
  const revenueByTerritory = new Map<string, number>();
  for (const credit of credits) {
    const amount = Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
    if (credit.salesperson.excludedFromTerritoryTotals) personalBucket += amount;
    else {
      const territoryId = credit.salesLine.hospital.territoryId;
      if (territoryId === null) { unassignedBucket += amount; unassignedHospitalIds.add(credit.salesLine.hospitalId); }
      else revenueByTerritory.set(territoryId, (revenueByTerritory.get(territoryId) ?? 0) + amount);
    }
  }
  const territorySum = [...revenueByTerritory.values()].reduce((s, v) => s + v, 0);
  const personalEntries = await getPersonalBucketEntries(period);
  return { companyTotal: Number(company._sum.total ?? 0), territorySum, personalBucket, unassignedBucket, personalBucketEntries: personalEntries, unassignedHospitalCount: unassignedHospitalIds.size };
}

// Territory KPI Rules ข้อ 7: the personalBucket row carries the name(s) measured by their own
// personal target, with that target and their own %to-target.
async function getPersonalBucketEntries(period: PeriodKey): Promise<PersonalBucketEntry[]> {
  const monthsWhere = { OR: monthsWhereOr(monthsInPeriod(period)) };
  const credits = await prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: true }, salesLine: monthsWhere }, select: { sharePercent: true, salesperson: { select: { id: true, displayName: true } }, salesLine: { select: { total: true } } } });
  if (!credits.length) return [];
  const bySalesperson = new Map<string, { displayName: string; revenue: number }>();
  for (const credit of credits) {
    const entry = bySalesperson.get(credit.salesperson.id) ?? { displayName: credit.salesperson.displayName, revenue: 0 };
    entry.revenue += Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
    bySalesperson.set(credit.salesperson.id, entry);
  }
  const targets = await prisma.target.findMany({ where: { scope: "SALESPERSON", salespersonId: { in: [...bySalesperson.keys()] }, ...monthsWhere }, select: { salespersonId: true, revenueTarget: true } });
  const targetBySalesperson = new Map<string, number>();
  for (const row of targets) if (row.salespersonId !== null) targetBySalesperson.set(row.salespersonId, (targetBySalesperson.get(row.salespersonId) ?? 0) + Number(row.revenueTarget));
  return [...bySalesperson.entries()].map(([salespersonId, entry]) => { const personalTarget = targetBySalesperson.get(salespersonId) ?? 0; return { salespersonId, displayName: entry.displayName, revenue: entry.revenue, personalTarget, achievementPercent: personalTarget ? entry.revenue / personalTarget * 100 : null }; });
}

// ---------- Shared row assembly (team endpoint, single endpoint and territory-overview all use this one path) ----------

export interface FullTerritoryKpiRow {
  territoryId: string;
  name: string;
  ownerNames: string[];
  rank: number;
  revenue: number;
  target: number | null;
  targetLabel: string | null;
  achievementPercent: number | null;
  compositeScore: number | null;
  computedMetricLabel: string;
  message: string | null;
  metrics: MetricResult[];
}

// Owner display follows the same period-effective window as activeOwnerCount
// (Territory KPI Rules ข้อ 6): effectiveFrom ≤ last day of period, effectiveTo null or ≥ first day.
// Shared with Module O's ranking (Product Master & Ranking Rules ข้อ 3) so both show the same names.
export async function ownerNamesFor(territoryId: string, period: PeriodKey): Promise<string[]> {
  const owners = await prisma.territoryAssignment.findMany({
    where: { territoryId, effectiveFrom: { lte: lastDayOfPeriod(period) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(period) } }] },
    include: { salesperson: { select: { displayName: true } } },
    orderBy: { effectiveFrom: "asc" },
  });
  return owners.map((owner) => owner.salesperson.displayName);
}

export async function buildFullTerritoryRows(period: PeriodKey): Promise<FullTerritoryKpiRow[]> {
  const territories = await prisma.territory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const rows = await Promise.all(territories.map(async (territory) => {
    const result = await computeTerritoryKpi(territory.id, period);
    return {
      territoryId: territory.id,
      name: territory.name,
      ownerNames: await ownerNamesFor(territory.id, period),
      rank: 0,
      revenue: result.revenue,
      target: result.target,
      targetLabel: result.targetLabel,
      achievementPercent: result.achievementPercent,
      compositeScore: result.composite,
      computedMetricLabel: result.computedFromLabel,
      message: result.message,
      metrics: result.metrics,
    };
  }));
  assignStandardCompetitionRanks(rows);
  return rows;
}

// Standard competition ranking on compositeScore desc (1, 2, 2, 4); territories whose score is
// not computable keep their reason label and take the tail positions without sharing ranks.
export function assignStandardCompetitionRanks<T extends { compositeScore: number | null; rank: number }>(rows: T[]): void {
  const sorted = [...rows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  let previousScore: number | null = null;
  let previousRank = 0;
  sorted.forEach((row, index) => {
    if (row.compositeScore !== null && previousScore === row.compositeScore) row.rank = previousRank;
    else {
      row.rank = index + 1;
      previousScore = row.compositeScore;
      previousRank = index + 1;
    }
  });
}

export type SerializedTerritoryKpiRow = { visibility: "TERRITORY_FULL" } & FullTerritoryKpiRow | { visibility: "TERRITORY_RANK_ONLY"; territoryId: string; name: string; ownerNames: string[]; rank: number; compositeScore: number | null; computedMetricLabel: string };

// Data Visibility Rules ข้อ 6: everything is always computed (rank comes from all territories),
// then fields are stripped before sending — never sent in full for the frontend to hide.
export function serializeTerritoryRows(rows: FullTerritoryKpiRow[], visibleTerritoryIds: Set<string> | null): SerializedTerritoryKpiRow[] {
  return rows.map((row) => {
    if (visibleTerritoryIds === null || visibleTerritoryIds.has(row.territoryId)) return { ...row, visibility: "TERRITORY_FULL" as const };
    const restricted: Record<string, unknown> = {};
    for (const field of TERRITORY_RANK_ONLY_FIELDS) restricted[field] = row[field];
    return { ...restricted, visibility: "TERRITORY_RANK_ONLY" } as Extract<SerializedTerritoryKpiRow, { visibility: "TERRITORY_RANK_ONLY" }>;
  });
}

// ---------- Territory-group rows (shared by 10.7 overview and Module F2 leaderboard) ----------

export interface TerritoryGroupKpiRowData {
  territoryId: string; // id of the group unit
  name: string;
  ownerNames: string[];
  memberTerritoryIds: string[];
  rank: number;
  revenue: number;
  revenueTarget: number | null;
  achievementPercent: number | null;
  compositeScore: number | null;
  computedMetricLabel: string;
}

// Territory KPI Rules ข้อ 6: member territories keep their own rows (grain unchanged), the group
// gets its own block. Group aggregates are computed from FULL rows always — stripping happens only
// at serialization time. Group totals are a separate block and are never added into the
// territory-table sums.
export async function buildTerritoryGroupRows(fullRows: FullTerritoryKpiRow[], period: PeriodKey): Promise<TerritoryGroupKpiRowData[]> {
  const groups = await prisma.territoryGroup.findMany({
    where: { isActive: true, members: { some: { effectiveFrom: { lte: lastDayOfPeriod(period) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(period) } }] } } },
    include: { members: { where: { effectiveFrom: { lte: lastDayOfPeriod(period) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(period) } }] }, select: { territoryId: true } } },
  });
  const rows: TerritoryGroupKpiRowData[] = [];
  for (const group of groups) {
    const memberTerritoryIds = group.members.map((member) => member.territoryId);
    const memberRows = fullRows.filter((row) => memberTerritoryIds.includes(row.territoryId));
    const revenue = memberRows.reduce((sum, row) => sum + row.revenue, 0);
    const targetAggregate = await prisma.target.aggregate({ where: { scope: "TERRITORY_GROUP", territoryGroupId: group.id, OR: monthsWhereOr(monthsInPeriod(period)) }, _sum: { revenueTarget: true } });
    const revenueTarget = Number(targetAggregate._sum.revenueTarget ?? 0);
    const achievementPercent = revenueTarget ? revenue / revenueTarget * 100 : null;
    const ownerRows = await prisma.territoryAssignment.findMany({ where: { territoryId: { in: memberTerritoryIds }, effectiveFrom: { lte: lastDayOfPeriod(period) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(period) } }] }, include: { salesperson: { select: { displayName: true } } } });
    const ownerNames = [...new Set(ownerRows.map((row) => row.salesperson.displayName))];
    rows.push({ territoryId: group.id, name: group.name, ownerNames: ownerNames.length ? ownerNames : ["ยังไม่มีผู้ดูแล"], memberTerritoryIds, rank: 0, revenue, revenueTarget, achievementPercent, compositeScore: achievementPercent === null ? null : Math.min(achievementPercent, 100), computedMetricLabel: "คิดจาก 1 จาก 5 เกณฑ์" });
  }
  assignStandardCompetitionRanks(rows);
  return rows;
}

export type SerializedGroupFullRow = TerritoryGroupKpiRowData & { visibility: "TERRITORY_FULL" };
export type SerializedGroupRankOnlyRow = Pick<TerritoryGroupKpiRowData, "territoryId" | "name" | "ownerNames" | "rank" | "compositeScore" | "computedMetricLabel"> & { visibility: "TERRITORY_RANK_ONLY" };
export type SerializedGroupRow = SerializedGroupFullRow | SerializedGroupRankOnlyRow;

export function serializeGroupRows(rows: TerritoryGroupKpiRowData[], visibleTerritoryIds: Set<string> | null): SerializedGroupRow[] {
  return rows.map((row): SerializedGroupRow => {
    // Strictest reading of Data Visibility Rules ข้อ 6 for group units: money fields of the group
    // aggregate every member territory's figures, so the group is TERRITORY_FULL only when the
    // viewer has FULL on all of its members.
    if (visibleTerritoryIds === null || row.memberTerritoryIds.every((id) => visibleTerritoryIds.has(id))) return { ...row, visibility: "TERRITORY_FULL" };
    const restricted: Record<string, unknown> = {};
    for (const field of ["territoryId", "name", "ownerNames", "rank", "compositeScore", "computedMetricLabel"] as const) restricted[field] = row[field];
    return { ...restricted, visibility: "TERRITORY_RANK_ONLY" } as SerializedGroupRankOnlyRow;
  });
}
