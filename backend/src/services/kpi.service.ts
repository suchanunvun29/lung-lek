import { EvaluationSetting, KpiMetric } from "@prisma/client";
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
  const [actualAgg, targets] = await Promise.all([
    prisma.salesLine.aggregate({
      where: { salespersonId, OR: monthsWhereOr(months) },
      _sum: { total: true },
    }),
    prisma.target.findMany({
      where: { salespersonId, OR: monthsWhereOr(months) },
      select: { revenueTarget: true },
    }),
  ]);

  const actual = Number(actualAgg._sum.total ?? 0);
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
    where: { salespersonId, OR: monthsWhereOr(months) },
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
  const actual = creditedLines.length;

  return {
    metric: "NEW_CUSTOMERS",
    computable: true,
    score: Math.min((actual / target) * 100, 100),
    reason: null,
    detail: { actual, target, hospitalIds: creditedLines.map((l) => l.hospitalId) },
  };
}

// The first-ever sale of each non-pre-existing hospital, system-wide, determines who gets the
// "new customer" credit and which period it lands in — independent of who is asking.
async function getFirstSalePerHospital() {
  const lines = await prisma.salesLine.findMany({
    where: { hospital: { isPreExistingCustomer: false } },
    select: {
      id: true,
      hospitalId: true,
      salespersonId: true,
      year: true,
      month: true,
      invoiceDate: true,
      createdAt: true,
    },
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

async function getNewCustomerCreditedLines(salespersonId: string, period: PeriodKey) {
  const months = monthsInPeriod(period);
  const periodKeys = new Set(months.map(monthKey));
  const firstSaleByHospital = await getFirstSalePerHospital();

  return [...firstSaleByHospital.values()].filter(
    (line) => line.salespersonId === salespersonId && periodKeys.has(monthKey(line))
  );
}

// Actual new-customer count regardless of whether a target is set — computeNewCustomers()
// short-circuits to a hardcoded 0 when there's no target, which is correct for scoring but
// wrong for the Leaderboard's "new customers" ranking criterion (design.md Module F), which
// needs the real count even for salespeople with no target configured.
export async function getNewCustomerActualCount(salespersonId: string, period: PeriodKey): Promise<number> {
  const creditedLines = await getNewCustomerCreditedLines(salespersonId, period);
  return creditedLines.length;
}

export async function computeProductGroup(salespersonId: string, period: PeriodKey): Promise<MetricResult> {
  const months = monthsInPeriod(period);
  const targetGroups = await prisma.targetProductGroup.findMany({
    where: { target: { salespersonId, OR: monthsWhereOr(months) } },
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

  const actualGroups = await prisma.salesLine.groupBy({
    by: ["productTypeId"],
    where: { salespersonId, productTypeId: { in: [...targetByType.keys()] }, OR: monthsWhereOr(months) },
    _sum: { total: true },
  });
  const actualByType = new Map(actualGroups.map((g) => [g.productTypeId, Number(g._sum.total ?? 0)]));

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

  const [prevHospitals, curHospitals] = await Promise.all([
    prisma.salesLine.findMany({
      where: { salespersonId, OR: monthsWhereOr(prevMonths) },
      select: { hospitalId: true },
      distinct: ["hospitalId"],
    }),
    prisma.salesLine.findMany({
      where: { salespersonId, OR: monthsWhereOr(curMonths) },
      select: { hospitalId: true },
      distinct: ["hospitalId"],
    }),
  ]);

  if (prevHospitals.length === 0) {
    return {
      metric: "RETENTION",
      computable: false,
      score: null,
      reason: "ไม่มีลูกค้าในงวดก่อนหน้า",
      detail: {},
    };
  }

  const curSet = new Set(curHospitals.map((h) => h.hospitalId));
  const retainedHospitalIds = prevHospitals.map((h) => h.hospitalId).filter((id) => curSet.has(id));

  return {
    metric: "RETENTION",
    computable: true,
    score: (retainedHospitalIds.length / prevHospitals.length) * 100,
    reason: null,
    detail: {
      previousHospitalCount: prevHospitals.length,
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

  const sums = await prisma.salesLine.groupBy({
    by: ["year", "month"],
    where: { salespersonId, OR: monthsWhereOr(trailing) },
    _sum: { total: true },
  });
  const sumMap = new Map(sums.map((s) => [monthKey(s), Number(s._sum.total ?? 0)]));
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

  const [activeHospitals, revenueByHospitalGroups, penetrationLines, trendSums] = await Promise.all([
    prisma.salesLine.findMany({
      where: { salespersonId, OR: monthsWhereOr(months) },
      select: { hospitalId: true },
      distinct: ["hospitalId"],
    }),
    prisma.salesLine.groupBy({
      by: ["hospitalId"],
      where: { salespersonId, OR: monthsWhereOr(months) },
      _sum: { total: true },
    }),
    prisma.salesLine.findMany({
      where: { salespersonId, OR: monthsWhereOr(months) },
      select: {
        hospitalId: true,
        productTypeId: true,
        total: true,
        productType: { select: { name: true } },
      },
    }),
    prisma.salesLine.groupBy({
      by: ["year", "month"],
      where: { salespersonId, OR: monthsWhereOr(trailingMonths(periodEnd.year, periodEnd.month, 12)) },
      _sum: { total: true },
    }),
  ]);

  const activeCustomers = {
    count: activeHospitals.length,
    hospitalIds: activeHospitals.map((h) => h.hospitalId),
  };

  const churnedCustomers = await computeChurnedCustomers(salespersonId, periodEnd, settings.churnMonths, activeCustomers.hospitalIds);

  const distinctProductTypesByHospital = new Map<string, Set<string>>();
  const revenueByProductType = new Map<string, { name: string; revenue: number }>();
  for (const line of penetrationLines) {
    const set = distinctProductTypesByHospital.get(line.hospitalId) ?? new Set<string>();
    set.add(line.productTypeId);
    distinctProductTypesByHospital.set(line.hospitalId, set);

    const entry = revenueByProductType.get(line.productTypeId) ?? { name: line.productType.name, revenue: 0 };
    entry.revenue += Number(line.total);
    revenueByProductType.set(line.productTypeId, entry);
  }
  const totalRevenueForPenetration = [...revenueByProductType.values()].reduce((sum, r) => sum + r.revenue, 0);
  const avgDistinctProductTypesPerCustomer =
    distinctProductTypesByHospital.size === 0
      ? 0
      : [...distinctProductTypesByHospital.values()].reduce((sum, set) => sum + set.size, 0) /
        distinctProductTypesByHospital.size;

  const productPenetration = {
    avgDistinctProductTypesPerCustomer,
    productTypeGroupsSold: [...revenueByProductType.entries()].map(([productTypeId, { name, revenue }]) => ({
      productTypeId,
      name,
      revenueShare: totalRevenueForPenetration > 0 ? (revenue / totalRevenueForPenetration) * 100 : 0,
    })),
  };

  const hospitalNames = await prisma.hospital.findMany({
    where: { id: { in: revenueByHospitalGroups.map((g) => g.hospitalId) } },
    select: { id: true, displayName: true },
  });
  const hospitalNameById = new Map(hospitalNames.map((h) => [h.id, h.displayName]));
  const totalRevenue = revenueByHospitalGroups.reduce((sum, g) => sum + Number(g._sum.total ?? 0), 0);
  const revenueShareByHospital = revenueByHospitalGroups
    .map((g) => {
      const revenue = Number(g._sum.total ?? 0);
      return {
        hospitalId: g.hospitalId,
        hospitalName: hospitalNameById.get(g.hospitalId) ?? g.hospitalId,
        revenue,
        sharePercent: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const trendSumMap = new Map(trendSums.map((s) => [monthKey(s), Number(s._sum.total ?? 0)]));
  const monthlyRevenueTrend = trailingMonths(periodEnd.year, periodEnd.month, 12).map((m) => ({
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

  const linesUpToPeriodEnd = await prisma.salesLine.findMany({
    where: {
      salespersonId,
      OR: [{ year: { lt: periodEnd.year } }, { year: periodEnd.year, month: { lte: periodEnd.month } }],
    },
    select: { hospitalId: true, year: true, month: true },
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
      where: { salespersonId, OR: monthsWhereOr(months) },
      include: { hospital: { select: { displayName: true } }, product: { select: { name: true } } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { invoiceDate: "asc" }],
    });
    return { metric, salesLines };
  }

  if (metric === "NEW_CUSTOMERS") {
    const creditedLines = await getNewCustomerCreditedLines(salespersonId, period);
    const salesLines = await prisma.salesLine.findMany({
      where: { id: { in: creditedLines.map((l) => l.id) } },
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
      where: { salespersonId, productTypeId: { in: productTypeIds }, OR: monthsWhereOr(months) },
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
        salespersonId,
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
    where: { salespersonId, OR: monthsWhereOr(trailing) },
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
      where: { salespersonId, OR: monthsWhereOr(trailing) },
      include: { hospital: { select: { displayName: true } } },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    return { metric, salesLines };
  }

  if (metric === "CHURNED_CUSTOMERS") {
    const settings = await getEvaluationSettings();
    const linesUpToPeriodEnd = await prisma.salesLine.findMany({
      where: {
        salespersonId,
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
    where: { salespersonId, OR: monthsWhereOr(months), ...(hospitalId ? { hospitalId } : {}) },
    include: {
      hospital: { select: { displayName: true } },
      product: { select: { name: true } },
      productType: { select: { name: true } },
    },
    orderBy: [{ hospitalId: "asc" }, { year: "asc" }, { month: "asc" }],
  });
  return { metric, salesLines };
}
