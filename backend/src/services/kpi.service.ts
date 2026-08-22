import { EvaluationSetting, KpiMetric, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  PeriodKey,
  YearMonth,
  lastMonthOfPeriod,
  monthKey,
  monthsInPeriod,
  monthsWhereOr,
  previousPeriod,
  trailingMonths,
} from "./period.util";

export interface MetricResult {
  metric: KpiMetric;
  computable: boolean;
  score: number | null;
  reason: string | null;
  detail: Record<string, unknown>;
}

// ---------- Credit-weighted sales access ----------
//
// design.md (KPI & Scoring Rules, ส่วนขยาย 2026-08-16): a salesperson's per-period figures are
// now `Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100)` read through SalesLineCredit —
// never `SalesLine.salespersonId` directly. Every per-person aggregation in this file goes
// through this helper so there is exactly one code path, per the same reasoning design.md gives
// for not making SalesLineCredit optional.

interface CreditedLine {
  salesLineId: string;
  hospitalId: string;
  productTypeId: string;
  year: number;
  month: number;
  invoiceDate: Date;
  creditedTotal: number; // SalesLine.total × sharePercent ÷ 100
}

async function getCreditedSalesLines(salespersonId: string, salesLineWhere: Prisma.SalesLineWhereInput): Promise<CreditedLine[]> {
  const credits = await prisma.salesLineCredit.findMany({
    where: { salespersonId, salesLine: salesLineWhere },
    select: {
      sharePercent: true,
      salesLine: {
        select: { id: true, hospitalId: true, productTypeId: true, year: true, month: true, invoiceDate: true, total: true },
      },
    },
  });

  return credits.map((c) => ({
    salesLineId: c.salesLine.id,
    hospitalId: c.salesLine.hospitalId,
    productTypeId: c.salesLine.productTypeId,
    year: c.salesLine.year,
    month: c.salesLine.month,
    invoiceDate: c.salesLine.invoiceDate,
    creditedTotal: Number(c.salesLine.total) * (Number(c.sharePercent) / 100),
  }));
}

function getCreditedSalesLinesInMonths(salespersonId: string, months: YearMonth[]): Promise<CreditedLine[]> {
  return getCreditedSalesLines(salespersonId, { OR: monthsWhereOr(months) });
}

/** WHERE clause matching every SalesLine whose credited salesperson filter this file uses for drill-downs. */
function creditedToSalesperson(salespersonId: string): Prisma.SalesLineWhereInput {
  return { credits: { some: { salespersonId } } };
}

export async function getDataCoverageMonths(): Promise<number> {
  const distinctMonths = await prisma.salesLine.findMany({
    select: { year: true, month: true },
    distinct: ["year", "month"],
  });
  return distinctMonths.length;
}

export async function getEvaluationSettings(): Promise<EvaluationSetting> {
  const settings = await prisma.evaluationSetting.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    throw new Error("EvaluationSetting singleton row is missing — re-run the seed script");
  }
  return settings;
}

export async function getScoringWeights(): Promise<Map<KpiMetric, number>> {
  const rows = await prisma.scoringWeight.findMany();
  return new Map(rows.map((row) => [row.metric, row.weight]));
}

function insufficientDataReason(required: number, current: number): string {
  return `ข้อมูลยังไม่เพียงพอ ต้องการ ${required} เดือน ปัจจุบันมี ${current} เดือน`;
}

export async function computeRevenueVsTarget(salespersonId: string, period: PeriodKey): Promise<MetricResult> {
  const months = monthsInPeriod(period);
  const [creditedLines, targets] = await Promise.all([
    getCreditedSalesLinesInMonths(salespersonId, months),
    prisma.target.findMany({
      where: { salespersonId, scope: "SALESPERSON", OR: monthsWhereOr(months) },
      select: { revenueTarget: true },
    }),
  ]);

  const actual = creditedLines.reduce((sum, l) => sum + l.creditedTotal, 0);
  const target = targets.reduce((sum, t) => sum + Number(t.revenueTarget), 0);

  if (target === 0) {
    return {
      metric: "REVENUE_VS_TARGET",
      computable: false,
      score: null,
      reason: "ยังไม่ได้ตั้งเป้า หรือเป้าเป็น 0",
      detail: { actual, target },
    };
  }

  const achievementPercent = (actual / target) * 100;
  return {
    metric: "REVENUE_VS_TARGET",
    computable: true,
    score: Math.min(achievementPercent, 100),
    reason: null,
    detail: { actual, target, achievementPercent },
  };
}

export async function computeNewCustomers(salespersonId: string, period: PeriodKey): Promise<MetricResult> {
  const months = monthsInPeriod(period);
  const targets = await prisma.target.findMany({
    where: { salespersonId, scope: "SALESPERSON", OR: monthsWhereOr(months) },
    select: { newCustomerTarget: true },
  });
  const target = targets.reduce((sum, t) => sum + t.newCustomerTarget, 0);

  if (target === 0) {
    return {
      metric: "NEW_CUSTOMERS",
      computable: false,
      score: null,
      reason: "ยังไม่ได้ตั้งเป้าลูกค้าใหม่",
      detail: { actual: 0, target },
    };
  }

  const creditedLines = await getNewCustomerCreditedLines(salespersonId, period);
  const actual = creditedLines.reduce((sum, l) => sum + l.sharePercent / 100, 0);

  return {
    metric: "NEW_CUSTOMERS",
    computable: true,
    score: Math.min((actual / target) * 100, 100),
    reason: null,
    detail: {
      actual: Math.round(actual * 10) / 10,
      target,
      hospitalIds: creditedLines.map((l) => l.hospitalId),
    },
  };
}

// The first-ever sale of each non-pre-existing hospital, system-wide, determines which period
// the "new customer" credit lands in — independent of who is asking. Company-wide identity of
// the first sale doesn't depend on credit sharing; only who gets *how much* of the credit does.
async function getFirstSalePerHospital() {
  const lines = await prisma.salesLine.findMany({
    where: { hospital: { isPreExistingCustomer: false } },
    select: { id: true, hospitalId: true, year: true, month: true, invoiceDate: true, createdAt: true },
    orderBy: [{ year: "asc" }, { month: "asc" }, { invoiceDate: "asc" }, { createdAt: "asc" }],
  });

  const firstSaleByHospital = new Map<string, (typeof lines)[number]>();
  for (const line of lines) {
    if (!firstSaleByHospital.has(line.hospitalId)) {
      firstSaleByHospital.set(line.hospitalId, line);
    }
  }
  return firstSaleByHospital;
}

interface NewCustomerCredit {
  hospitalId: string;
  salesLineId: string;
  sharePercent: number;
}

// A hospital's first-sale line is credited to whichever salesperson(s) hold a SalesLineCredit
// on it, split by sharePercent (design.md: a 50/50 shared deal counts as 0.5 new customers each).
async function getNewCustomerCreditedLines(salespersonId: string, period: PeriodKey): Promise<NewCustomerCredit[]> {
  const months = monthsInPeriod(period);
  const periodKeys = new Set(months.map(monthKey));
  const firstSaleByHospital = await getFirstSalePerHospital();

  const firstSaleLinesInPeriod = [...firstSaleByHospital.values()].filter((line) => periodKeys.has(monthKey(line)));
  if (firstSaleLinesInPeriod.length === 0) return [];

  const credits = await prisma.salesLineCredit.findMany({
    where: { salespersonId, salesLineId: { in: firstSaleLinesInPeriod.map((l) => l.id) } },
    select: { salesLineId: true, sharePercent: true },
  });
  const salesLineById = new Map(firstSaleLinesInPeriod.map((l) => [l.id, l]));

  return credits.map((c) => ({
    hospitalId: salesLineById.get(c.salesLineId)!.hospitalId,
    salesLineId: c.salesLineId,
    sharePercent: Number(c.sharePercent),
  }));
}

// Actual new-customer count regardless of whether a target is set — computeNewCustomers()
// short-circuits to a hardcoded 0 when there's no target, which is correct for scoring but
// wrong for the Leaderboard's "new customers" ranking criterion (design.md Module F), which
// needs the real count even for salespeople with no target configured.
export async function getNewCustomerActualCount(salespersonId: string, period: PeriodKey): Promise<number> {
  const creditedLines = await getNewCustomerCreditedLines(salespersonId, period);
  const actual = creditedLines.reduce((sum, l) => sum + l.sharePercent / 100, 0);
  return Math.round(actual * 10) / 10;
}

export async function computeProductGroup(salespersonId: string, period: PeriodKey): Promise<MetricResult> {
  const months = monthsInPeriod(period);
  const targetGroups = await prisma.targetProductGroup.findMany({
    where: { target: { salespersonId, scope: "SALESPERSON", OR: monthsWhereOr(months) } },
    select: { productTypeId: true, revenueTarget: true, productType: { select: { name: true } } },
  });

  if (targetGroups.length === 0) {
    return {
      metric: "PRODUCT_GROUP",
      computable: false,
      score: null,
      reason: "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้",
      detail: { groups: [] },
    };
  }

  const targetByType = new Map<string, { target: number; name: string }>();
  for (const g of targetGroups) {
    const existing = targetByType.get(g.productTypeId);
    targetByType.set(g.productTypeId, {
      target: (existing?.target ?? 0) + Number(g.revenueTarget),
      name: g.productType.name,
    });
  }

  const totalTarget = [...targetByType.values()].reduce((sum, g) => sum + g.target, 0);
  if (totalTarget === 0) {
    return {
      metric: "PRODUCT_GROUP",
      computable: false,
      score: null,
      reason: "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0",
      detail: { groups: [] },
    };
  }

  const creditedLines = await getCreditedSalesLinesInMonths(salespersonId, months);
  const actualByType = new Map<string, number>();
  for (const l of creditedLines) {
    if (!targetByType.has(l.productTypeId)) continue;
    actualByType.set(l.productTypeId, (actualByType.get(l.productTypeId) ?? 0) + l.creditedTotal);
  }

  let cappedSum = 0;
  const groups = [...targetByType.entries()].map(([productTypeId, { target, name }]) => {
    const actual = actualByType.get(productTypeId) ?? 0;
    const cappedActual = Math.min(actual, target);
    cappedSum += cappedActual;
    return { productTypeId, name, actual, target, cappedActual };
  });

  return {
    metric: "PRODUCT_GROUP",
    computable: true,
    score: (cappedSum / totalTarget) * 100,
    reason: null,
    detail: { groups, totalTarget, cappedSum },
  };
}

export async function computeRetention(
  salespersonId: string,
  period: PeriodKey,
  settings: EvaluationSetting,
  dataCoverageMonths: number
): Promise<MetricResult> {
  if (dataCoverageMonths < settings.minMonthsForChurn) {
    return {
      metric: "RETENTION",
      computable: false,
      score: null,
      reason: insufficientDataReason(settings.minMonthsForChurn, dataCoverageMonths),
      detail: {},
    };
  }

  const prevMonths = monthsInPeriod(previousPeriod(period));
  const curMonths = monthsInPeriod(period);

  const [prevCreditedLines, curCreditedLines] = await Promise.all([
    getCreditedSalesLinesInMonths(salespersonId, prevMonths),
    getCreditedSalesLinesInMonths(salespersonId, curMonths),
  ]);
  const prevHospitalIds = [...new Set(prevCreditedLines.map((l) => l.hospitalId))];

  if (prevHospitalIds.length === 0) {
    return {
      metric: "RETENTION",
      computable: false,
      score: null,
      reason: "ไม่มีลูกค้าในงวดก่อนหน้า",
      detail: {},
    };
  }

  const curSet = new Set(curCreditedLines.map((l) => l.hospitalId));
  const retainedHospitalIds = prevHospitalIds.filter((id) => curSet.has(id));

  return {
    metric: "RETENTION",
    computable: true,
    score: (retainedHospitalIds.length / prevHospitalIds.length) * 100,
    reason: null,
    detail: {
      previousHospitalCount: prevHospitalIds.length,
      retainedHospitalCount: retainedHospitalIds.length,
      retainedHospitalIds,
      previousPeriod: previousPeriod(period),
    },
  };
}

export async function computeConsistency(
  salespersonId: string,
  period: PeriodKey,
  settings: EvaluationSetting,
  dataCoverageMonths: number
): Promise<MetricResult> {
  if (dataCoverageMonths < settings.minMonthsForConsistency) {
    return {
      metric: "CONSISTENCY",
      computable: false,
      score: null,
      reason: insufficientDataReason(settings.minMonthsForConsistency, dataCoverageMonths),
      detail: {},
    };
  }

  const { year: endYear, month: endMonth } = lastMonthOfPeriod(period);
  const trailing = trailingMonths(endYear, endMonth, settings.minMonthsForConsistency);

  const creditedLines = await getCreditedSalesLinesInMonths(salespersonId, trailing);
  const sumMap = new Map<string, number>();
  for (const l of creditedLines) {
    const key = monthKey(l);
    sumMap.set(key, (sumMap.get(key) ?? 0) + l.creditedTotal);
  }
  const monthlyValues = trailing.map((m) => sumMap.get(monthKey(m)) ?? 0);

  const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
  if (mean === 0) {
    return {
      metric: "CONSISTENCY",
      computable: false,
      score: null,
      reason: "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0",
      detail: { trailing, monthlyValues },
    };
  }

  const variance = monthlyValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / monthlyValues.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean;

  return {
    metric: "CONSISTENCY",
    computable: true,
    score: Math.max(0, 1 - cv) * 100,
    reason: null,
    detail: { trailing, monthlyValues, mean, stddev, cv },
  };
}

export interface CompositeScoreResult {
  composite: number | null;
  computedFromCount: number;
  computedFromLabel: string;
  message: string | null;
  metrics: MetricResult[];
}

const METRIC_ORDER: KpiMetric[] = ["REVENUE_VS_TARGET", "NEW_CUSTOMERS", "PRODUCT_GROUP", "RETENTION", "CONSISTENCY"];

export async function computeCompositeScore(salespersonId: string, period: PeriodKey): Promise<CompositeScoreResult> {
  const [settings, weights, dataCoverageMonths] = await Promise.all([
    getEvaluationSettings(),
    getScoringWeights(),
    getDataCoverageMonths(),
  ]);

  const results = await Promise.all([
    computeRevenueVsTarget(salespersonId, period),
    computeNewCustomers(salespersonId, period),
    computeProductGroup(salespersonId, period),
    computeRetention(salespersonId, period, settings, dataCoverageMonths),
    computeConsistency(salespersonId, period, settings, dataCoverageMonths),
  ]);

  const orderedResults = METRIC_ORDER.map((metric) => results.find((r) => r.metric === metric)!);
  const computable = orderedResults.filter((r) => r.computable);

  if (computable.length === 0) {
    return {
      composite: null,
      computedFromCount: 0,
      computedFromLabel: "คิดจาก 0 จาก 5 เกณฑ์",
      message: "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้",
      metrics: orderedResults,
    };
  }

  const weightedSum = computable.reduce((sum, r) => sum + (weights.get(r.metric) ?? 0) * (r.score ?? 0), 0);
  const weightSum = computable.reduce((sum, r) => sum + (weights.get(r.metric) ?? 0), 0);

  const composite = weightSum > 0 ? weightedSum / weightSum : null;

  return {
    composite: composite !== null ? Math.round(composite * 100) / 100 : null,
    computedFromCount: computable.length,
    computedFromLabel: `คิดจาก ${computable.length} จาก 5 เกณฑ์`,
    message:
      composite === null
        ? "ยังไม่มีคะแนนรวม เนื่องจากน้ำหนักรวมของเกณฑ์ที่คำนวณได้เป็น 0"
        : null,
    metrics: orderedResults,
  };
}

// ---------- Supplementary KPIs (shown but not scored) ----------

export interface SupplementaryKpis {
  activeCustomers: { count: number; hospitalIds: string[] };
  churnedCustomers: {
    count: number;
    hospitals: { hospitalId: string; lastOrderYear: number; lastOrderMonth: number; monthsSinceLastOrder: number }[];
  };
  productPenetration: {
    avgDistinctProductTypesPerCustomer: number;
    productTypeGroupsSold: { productTypeId: string; name: string; revenueShare: number }[];
  };
  revenueShareByHospital: { hospitalId: string; hospitalName: string; revenue: number; sharePercent: number }[];
  monthlyRevenueTrend: { year: number; month: number; revenue: number }[];
}

export async function computeSupplementaryKpis(
  salespersonId: string,
  period: PeriodKey,
  settings: EvaluationSetting
): Promise<SupplementaryKpis> {
  const months = monthsInPeriod(period);
  const periodEnd = lastMonthOfPeriod(period);
  const trailing12 = trailingMonths(periodEnd.year, periodEnd.month, 12);

  const [periodCreditedLines, trendCreditedLines] = await Promise.all([
    getCreditedSalesLinesInMonths(salespersonId, months),
    getCreditedSalesLinesInMonths(salespersonId, trailing12),
  ]);

  const activeHospitalIds = [...new Set(periodCreditedLines.map((l) => l.hospitalId))];
  const activeCustomers = { count: activeHospitalIds.length, hospitalIds: activeHospitalIds };

  const churnedCustomers = await computeChurnedCustomers(salespersonId, periodEnd, settings.churnMonths, activeHospitalIds);

  const distinctProductTypesByHospital = new Map<string, Set<string>>();
  const revenueByProductTypeId = new Map<string, number>();
  for (const line of periodCreditedLines) {
    const set = distinctProductTypesByHospital.get(line.hospitalId) ?? new Set<string>();
    set.add(line.productTypeId);
    distinctProductTypesByHospital.set(line.hospitalId, set);

    revenueByProductTypeId.set(line.productTypeId, (revenueByProductTypeId.get(line.productTypeId) ?? 0) + line.creditedTotal);
  }
  const productTypeNames = await prisma.productType.findMany({
    where: { id: { in: [...revenueByProductTypeId.keys()] } },
    select: { id: true, name: true },
  });
  const productTypeNameById = new Map(productTypeNames.map((p) => [p.id, p.name]));

  const totalRevenueForPenetration = [...revenueByProductTypeId.values()].reduce((sum, r) => sum + r, 0);
  const avgDistinctProductTypesPerCustomer =
    distinctProductTypesByHospital.size === 0
      ? 0
      : [...distinctProductTypesByHospital.values()].reduce((sum, set) => sum + set.size, 0) /
        distinctProductTypesByHospital.size;

  const productPenetration = {
    avgDistinctProductTypesPerCustomer,
    productTypeGroupsSold: [...revenueByProductTypeId.entries()].map(([productTypeId, revenue]) => ({
      productTypeId,
      name: productTypeNameById.get(productTypeId) ?? productTypeId,
      revenueShare: totalRevenueForPenetration > 0 ? (revenue / totalRevenueForPenetration) * 100 : 0,
    })),
  };

  const revenueByHospitalId = new Map<string, number>();
  for (const line of periodCreditedLines) {
    revenueByHospitalId.set(line.hospitalId, (revenueByHospitalId.get(line.hospitalId) ?? 0) + line.creditedTotal);
  }
  const hospitalNames = await prisma.hospital.findMany({
    where: { id: { in: [...revenueByHospitalId.keys()] } },
    select: { id: true, displayName: true },
  });
  const hospitalNameById = new Map(hospitalNames.map((h) => [h.id, h.displayName]));
  const totalRevenue = [...revenueByHospitalId.values()].reduce((sum, r) => sum + r, 0);
  const revenueShareByHospital = [...revenueByHospitalId.entries()]
    .map(([hospitalId, revenue]) => ({
      hospitalId,
      hospitalName: hospitalNameById.get(hospitalId) ?? hospitalId,
      revenue,
      sharePercent: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const trendSumMap = new Map<string, number>();
  for (const l of trendCreditedLines) {
    const key = monthKey(l);
    trendSumMap.set(key, (trendSumMap.get(key) ?? 0) + l.creditedTotal);
  }
  const monthlyRevenueTrend = trailing12.map((m) => ({
    year: m.year,
    month: m.month,
    revenue: trendSumMap.get(monthKey(m)) ?? 0,
  }));

  return { activeCustomers, churnedCustomers, productPenetration, revenueShareByHospital, monthlyRevenueTrend };
}

async function computeChurnedCustomers(
  salespersonId: string,
  periodEnd: YearMonth,
  churnMonths: number,
  activeHospitalIdsInPeriod: string[]
) {
  const activeSet = new Set(activeHospitalIdsInPeriod);

  const linesUpToPeriodEnd = await getCreditedSalesLines(salespersonId, {
    OR: [{ year: { lt: periodEnd.year } }, { year: periodEnd.year, month: { lte: periodEnd.month } }],
  });

  const lastOrderByHospital = new Map<string, YearMonth>();
  for (const line of linesUpToPeriodEnd) {
    const current = lastOrderByHospital.get(line.hospitalId);
    if (!current || line.year > current.year || (line.year === current.year && line.month > current.month)) {
      lastOrderByHospital.set(line.hospitalId, { year: line.year, month: line.month });
    }
  }

  const hospitals: {
    hospitalId: string;
    lastOrderYear: number;
    lastOrderMonth: number;
    monthsSinceLastOrder: number;
  }[] = [];

  for (const [hospitalId, lastOrder] of lastOrderByHospital) {
    if (activeSet.has(hospitalId)) continue;
    const monthsSinceLastOrder =
      (periodEnd.year - lastOrder.year) * 12 + (periodEnd.month - lastOrder.month);
    if (monthsSinceLastOrder > churnMonths) {
      hospitals.push({
        hospitalId,
        lastOrderYear: lastOrder.year,
        lastOrderMonth: lastOrder.month,
        monthsSinceLastOrder,
      });
    }
  }

  return { count: hospitals.length, hospitals };
}

// ---------- Drill-down ----------

export async function getScoredMetricDrillDown(salespersonId: string, metric: KpiMetric, period: PeriodKey) {
  const months = monthsInPeriod(period);

  if (metric === "REVENUE_VS_TARGET") {
    const salesLines = await prisma.salesLine.findMany({
      where: { ...creditedToSalesperson(salespersonId), OR: monthsWhereOr(months) },
      include: { hospital: { select: { displayName: true } }, product: { select: { name: true } } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { invoiceDate: "asc" }],
    });
    return { metric, salesLines };
  }

  if (metric === "NEW_CUSTOMERS") {
    const creditedLines = await getNewCustomerCreditedLines(salespersonId, period);
    const salesLines = await prisma.salesLine.findMany({
      where: { id: { in: creditedLines.map((l) => l.salesLineId) } },
      include: { hospital: { select: { displayName: true } }, product: { select: { name: true } } },
    });
    return { metric, salesLines };
  }

  if (metric === "PRODUCT_GROUP") {
    const targetGroups = await prisma.targetProductGroup.findMany({
      where: { target: { salespersonId, OR: monthsWhereOr(months) } },
      select: { productTypeId: true },
    });
    const productTypeIds = [...new Set(targetGroups.map((g) => g.productTypeId))];
    const salesLines = await prisma.salesLine.findMany({
      where: { ...creditedToSalesperson(salespersonId), productTypeId: { in: productTypeIds }, OR: monthsWhereOr(months) },
      include: { hospital: { select: { displayName: true } }, product: { select: { name: true } }, productType: true },
      orderBy: [{ productTypeId: "asc" }, { year: "asc" }, { month: "asc" }],
    });
    return { metric, salesLines };
  }

  if (metric === "RETENTION") {
    const settings = await getEvaluationSettings();
    const dataCoverageMonths = await getDataCoverageMonths();
    const result = await computeRetention(salespersonId, period, settings, dataCoverageMonths);
    const retainedHospitalIds = (result.detail.retainedHospitalIds as string[] | undefined) ?? [];
    const prevMonths = monthsInPeriod(previousPeriod(period));
    const salesLines = await prisma.salesLine.findMany({
      where: {
        ...creditedToSalesperson(salespersonId),
        hospitalId: { in: retainedHospitalIds },
        OR: [...monthsWhereOr(months), ...monthsWhereOr(prevMonths)],
      },
      include: { hospital: { select: { displayName: true } } },
      orderBy: [{ hospitalId: "asc" }, { year: "asc" }, { month: "asc" }],
    });
    return { metric, salesLines, retainedHospitalIds };
  }

  // CONSISTENCY
  const settings = await getEvaluationSettings();
  const { year: endYear, month: endMonth } = lastMonthOfPeriod(period);
  const trailing = trailingMonths(endYear, endMonth, settings.minMonthsForConsistency);
  const salesLines = await prisma.salesLine.findMany({
    where: { ...creditedToSalesperson(salespersonId), OR: monthsWhereOr(trailing) },
    include: { hospital: { select: { displayName: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  return { metric, salesLines, trailingMonths: trailing };
}

export type SupplementaryMetric =
  | "ACTIVE_CUSTOMERS"
  | "CHURNED_CUSTOMERS"
  | "PRODUCT_PENETRATION"
  | "REVENUE_BY_HOSPITAL"
  | "MONTHLY_TREND";

export async function getSupplementaryDrillDown(
  salespersonId: string,
  metric: SupplementaryMetric,
  period: PeriodKey,
  hospitalId?: string
) {
  const months = monthsInPeriod(period);
  const periodEnd = lastMonthOfPeriod(period);

  if (metric === "MONTHLY_TREND") {
    const trailing = trailingMonths(periodEnd.year, periodEnd.month, 12);
    const salesLines = await prisma.salesLine.findMany({
      where: { ...creditedToSalesperson(salespersonId), OR: monthsWhereOr(trailing) },
      include: { hospital: { select: { displayName: true } } },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    return { metric, salesLines };
  }

  if (metric === "CHURNED_CUSTOMERS") {
    const settings = await getEvaluationSettings();
    const linesUpToPeriodEnd = await prisma.salesLine.findMany({
      where: {
        ...creditedToSalesperson(salespersonId),
        ...(hospitalId ? { hospitalId } : {}),
        OR: [{ year: { lt: periodEnd.year } }, { year: periodEnd.year, month: { lte: periodEnd.month } }],
      },
      include: { hospital: { select: { displayName: true } } },
      orderBy: [{ hospitalId: "asc" }, { year: "desc" }, { month: "desc" }],
    });
    return { metric, salesLines: linesUpToPeriodEnd, churnMonths: settings.churnMonths };
  }

  // ACTIVE_CUSTOMERS, PRODUCT_PENETRATION, REVENUE_BY_HOSPITAL all reduce to the period's sales lines
  const salesLines = await prisma.salesLine.findMany({
    where: { ...creditedToSalesperson(salespersonId), OR: monthsWhereOr(months), ...(hospitalId ? { hospitalId } : {}) },
    include: {
      hospital: { select: { displayName: true } },
      product: { select: { name: true } },
      productType: { select: { name: true } },
    },
    orderBy: [{ hospitalId: "asc" }, { year: "asc" }, { month: "asc" }],
  });
  return { metric, salesLines };
}
