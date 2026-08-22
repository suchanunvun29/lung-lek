import { KpiMetric } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CompositeScoreResult, MetricResult, getDataCoverageMonths, getEvaluationSettings, getScoringWeights } from "./kpi.service";
import { PeriodKey, lastMonthOfPeriod, monthsInPeriod, monthsWhereOr, previousPeriod, trailingMonths } from "./period.util";

export const TERRITORY_RANK_ONLY_FIELDS = ["territoryId", "name", "ownerNames", "rank", "compositeScore", "computedMetricLabel"] as const;

type TerritoryLine = { hospitalId: string; productTypeId: string; year: number; month: number; total: number };
async function lines(territoryId: string, period: PeriodKey): Promise<TerritoryLine[]> {
  const rows = await prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospital: { territoryId }, OR: monthsWhereOr(monthsInPeriod(period)) } }, select: { sharePercent: true, salesLine: { select: { hospitalId: true, productTypeId: true, year: true, month: true, total: true } } } });
  return rows.map((r) => ({ ...r.salesLine, total: Number(r.salesLine.total) * Number(r.sharePercent) / 100 }));
}
function unavailable(metric: KpiMetric, reason: string, detail: Record<string, unknown> = {}): MetricResult { return { metric, computable: false, score: null, reason, detail }; }

export async function computeTerritoryKpi(territoryId: string, period: PeriodKey): Promise<CompositeScoreResult & { revenue: number; target: number; achievementPercent: number | null }> {
  const [periodLines, targetRows, settings, weights, coverage] = await Promise.all([
    lines(territoryId, period), prisma.target.findMany({ where: { territoryId, scope: "TERRITORY", OR: monthsWhereOr(monthsInPeriod(period)) }, include: { productGroupTargets: { include: { productType: true } } } }), getEvaluationSettings(), getScoringWeights(), getDataCoverageMonths(),
  ]);
  const revenue = periodLines.reduce((s, row) => s + row.total, 0);
  const target = targetRows.reduce((s, row) => s + Number(row.revenueTarget), 0);
  const revenueMetric: MetricResult = target > 0 ? { metric: "REVENUE_VS_TARGET", computable: true, score: Math.min(revenue / target * 100, 100), reason: null, detail: { actual: revenue, target, achievementPercent: revenue / target * 100 } } : unavailable("REVENUE_VS_TARGET", "ยังไม่ได้ตั้งเป้า หรือเป้าเป็น 0", { actual: revenue, target });
  const newTarget = targetRows.reduce((s, row) => s + row.newCustomerTarget, 0);
  let newActual = 0;
  if (newTarget > 0) {
    const periodKeys = new Set(monthsInPeriod(period).map((m) => `${m.year}-${m.month}`));
    const firstSales = await prisma.salesLine.findMany({ where: { hospital: { territoryId, isPreExistingCustomer: false }, credits: { some: { salesperson: { excludedFromTerritoryTotals: false } } } }, orderBy: [{ year: "asc" }, { month: "asc" }, { invoiceDate: "asc" }, { createdAt: "asc" }], select: { hospitalId: true, year: true, month: true }, distinct: ["hospitalId"] });
    newActual = firstSales.filter((row) => periodKeys.has(`${row.year}-${row.month}`)).length;
  }
  const newMetric = newTarget > 0 ? { metric: "NEW_CUSTOMERS" as const, computable: true, score: Math.min(newActual / newTarget * 100, 100), reason: null, detail: { actual: newActual, target: newTarget } } : unavailable("NEW_CUSTOMERS", "ยังไม่ได้ตั้งเป้าลูกค้าใหม่", { actual: 0, target: newTarget });
  const groups = targetRows.flatMap((targetRow) => targetRow.productGroupTargets);
  const groupMetric = groups.length ? (() => { const totalTarget = groups.reduce((s, g) => s + Number(g.revenueTarget), 0); if (!totalTarget) return unavailable("PRODUCT_GROUP", "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0"); const actual = new Map<string, number>(); for (const row of periodLines) actual.set(row.productTypeId, (actual.get(row.productTypeId) ?? 0) + row.total); const capped = groups.reduce((s, group) => s + Math.min(actual.get(group.productTypeId) ?? 0, Number(group.revenueTarget)), 0); return { metric: "PRODUCT_GROUP" as const, computable: true, score: capped / totalTarget * 100, reason: null, detail: { totalTarget, capped } }; })() : unavailable("PRODUCT_GROUP", "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้");
  const insufficient = `ข้อมูลยังไม่เพียงพอ ต้องการ ${settings.minMonthsForChurn} เดือน ปัจจุบันมี ${coverage} เดือน`;
  const retention = coverage < settings.minMonthsForChurn ? unavailable("RETENTION", insufficient) : await retentionMetric(territoryId, period);
  const consistency = coverage < settings.minMonthsForConsistency ? unavailable("CONSISTENCY", `ข้อมูลยังไม่เพียงพอ ต้องการ ${settings.minMonthsForConsistency} เดือน ปัจจุบันมี ${coverage} เดือน`) : await consistencyMetric(territoryId, period, settings.minMonthsForConsistency);
  const metrics = [revenueMetric, newMetric, groupMetric, retention, consistency]; const available = metrics.filter((m) => m.computable); const weightSum = available.reduce((s, m) => s + (weights.get(m.metric) ?? 0), 0); const composite = weightSum ? available.reduce((s, m) => s + (weights.get(m.metric) ?? 0) * (m.score ?? 0), 0) / weightSum : null;
  return { composite: composite === null ? null : Math.round(composite * 100) / 100, computedFromCount: available.length, computedFromLabel: `คิดจาก ${available.length} จาก 5 เกณฑ์`, message: composite === null ? "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้" : null, metrics, revenue, target, achievementPercent: target ? revenue / target * 100 : null };
}
async function retentionMetric(territoryId: string, period: PeriodKey): Promise<MetricResult> { const [prev, current] = await Promise.all([lines(territoryId, previousPeriod(period)), lines(territoryId, period)]); const prevIds = new Set(prev.map((r) => r.hospitalId)); if (!prevIds.size) return unavailable("RETENTION", "ไม่มีลูกค้าในงวดก่อนหน้า"); const currentIds = new Set(current.map((r) => r.hospitalId)); const actual = [...prevIds].filter((id) => currentIds.has(id)).length; return { metric: "RETENTION", computable: true, score: actual / prevIds.size * 100, reason: null, detail: { previousHospitalCount: prevIds.size, retainedHospitalCount: actual } }; }
async function consistencyMetric(territoryId: string, period: PeriodKey, count: number): Promise<MetricResult> { const end = lastMonthOfPeriod(period); const months = trailingMonths(end.year, end.month, count); const value = await Promise.all(months.map((m) => lines(territoryId, { periodType: "MONTH", year: m.year, periodNumber: m.month }))); const values = value.map((rows) => rows.reduce((s, row) => s + row.total, 0)); const mean = values.reduce((s, v) => s + v, 0) / values.length; if (!mean) return unavailable("CONSISTENCY", "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0", { monthlyValues: values }); const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length; return { metric: "CONSISTENCY", computable: true, score: Math.max(0, 1 - Math.sqrt(variance) / mean) * 100, reason: null, detail: { monthlyValues: values, mean } }; }

export async function getTerritoryBuckets(period: PeriodKey) { const where = { OR: monthsWhereOr(monthsInPeriod(period)) }; const [company, personal, unassigned] = await Promise.all([prisma.salesLine.aggregate({ where, _sum: { total: true } }), prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: true }, salesLine: where }, select: { sharePercent: true, salesLine: { select: { total: true } } } }), prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { ...where, hospital: { territoryId: null } } }, select: { sharePercent: true, salesLine: { select: { total: true } } } })]); const sum = (rows: typeof personal) => rows.reduce((s, row) => s + Number(row.salesLine.total) * Number(row.sharePercent) / 100, 0); return { companyTotal: Number(company._sum.total ?? 0), personalBucket: sum(personal), unassignedBucket: sum(unassigned) }; }
