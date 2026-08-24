import { CoachingInsight, InsightStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as kpiService from "../services/kpi.service";
import { PeriodKey, previousPeriod } from "./period.util";
import { callGemini } from "./gemini.service";

const TOP_HOSPITALS_LIMIT = 5;
const SALESPERSON_ANONYMIZED_LABEL = "พนักงานขาย A";

export const METRIC_LABEL_TH: Record<string, string> = {
  REVENUE_VS_TARGET: "ยอดขายเทียบเป้า",
  NEW_CUSTOMERS: "ลูกค้าใหม่",
  PRODUCT_GROUP: "การขายตามกลุ่มสินค้าที่ตั้งเป้า",
  RETENTION: "การรักษาลูกค้าเดิม",
  CONSISTENCY: "ความสม่ำเสมอของยอดขาย",
};

export interface KpiSummaryPayload {
  salesperson: { name: string };
  period: PeriodKey;
  composite: {
    score: number | null;
    computedFromLabel: string;
    message: string | null;
  };
  metrics: {
    metric: string;
    computable: boolean;
    score: number | null;
    reason: string | null;
  }[];
  vsTeamAverage: {
    compositeScore: number | null;
    teamAverageComposite: number | null;
  };
  vsPreviousPeriod: {
    compositeScore: number | null;
    previousCompositeScore: number | null;
    revenueActual: number;
    previousRevenueActual: number;
  };
  revenue: { actual: number; target: number; achievementPercent: number | null };
  newCustomers: { actual: number; target: number };
  supplementary: {
    activeCustomersCount: number;
    churnedCustomersCount: number;
    avgDistinctProductTypesPerCustomer: number;
    topHospitalsByRevenue: { hospitalName: string; revenue: number; sharePercent: number }[];
  };
}

// Everything here is numbers/labels already computed in-system by kpi.service.ts — never raw
// SalesLine rows — per design.md's "AI coaching" contract (KPI & Scoring Rules section).
export async function buildKpiSummaryPayload(salespersonId: string, period: PeriodKey): Promise<KpiSummaryPayload> {
  const salesperson = await prisma.salesperson.findUniqueOrThrow({ where: { id: salespersonId } });
  const settings = await kpiService.getEvaluationSettings();
  const prevPeriod = previousPeriod(period);

  const [composite, supplementary, previousComposite, previousRevenue] = await Promise.all([
    kpiService.computeCompositeScore(salespersonId, period),
    kpiService.computeSupplementaryKpis(salespersonId, period, settings),
    kpiService.computeCompositeScore(salespersonId, prevPeriod),
    kpiService.computeRevenueVsTarget(salespersonId, prevPeriod),
  ]);

  const teamAverageComposite = kpiService.teamAverageComposite(await kpiService.computeActiveSalespersonComposites(period));

  const revenueMetric = composite.metrics.find((m) => m.metric === "REVENUE_VS_TARGET")!;
  const newCustomersMetric = composite.metrics.find((m) => m.metric === "NEW_CUSTOMERS")!;

  return {
    salesperson: { name: salesperson.displayName },
    period,
    composite: {
      score: composite.composite,
      computedFromLabel: composite.computedFromLabel,
      message: composite.message,
    },
    metrics: composite.metrics.map((m) => ({
      metric: m.metric,
      computable: m.computable,
      score: m.score,
      reason: m.reason,
    })),
    vsTeamAverage: {
      compositeScore: composite.composite,
      teamAverageComposite,
    },
    vsPreviousPeriod: {
      compositeScore: composite.composite,
      previousCompositeScore: previousComposite.composite,
      revenueActual: (revenueMetric.detail.actual as number | undefined) ?? 0,
      previousRevenueActual: (previousRevenue.detail.actual as number | undefined) ?? 0,
    },
    revenue: {
      actual: (revenueMetric.detail.actual as number | undefined) ?? 0,
      target: (revenueMetric.detail.target as number | undefined) ?? 0,
      achievementPercent: (revenueMetric.detail.achievementPercent as number | undefined) ?? null,
    },
    newCustomers: {
      actual: (newCustomersMetric.detail.actual as number | undefined) ?? 0,
      target: (newCustomersMetric.detail.target as number | undefined) ?? 0,
    },
    supplementary: {
      activeCustomersCount: supplementary.activeCustomers.count,
      churnedCustomersCount: supplementary.churnedCustomers.count,
      avgDistinctProductTypesPerCustomer: supplementary.productPenetration.avgDistinctProductTypesPerCustomer,
      topHospitalsByRevenue: supplementary.revenueShareByHospital.slice(0, TOP_HOSPITALS_LIMIT).map((h) => ({
        hospitalName: h.hospitalName,
        revenue: h.revenue,
        sharePercent: h.sharePercent,
      })),
    },
  };
}

// Consistent within one request only — design.md doesn't require the mapping to be stable
// across different insight generations, just that names never leave the system unmasked.
export function anonymizePayload(payload: KpiSummaryPayload): KpiSummaryPayload {
  const hospitalLabelByName = new Map<string, string>();
  let nextHospitalIndex = 1;

  function anonymizedHospitalName(name: string): string {
    let label = hospitalLabelByName.get(name);
    if (!label) {
      label = `โรงพยาบาล ${nextHospitalIndex}`;
      hospitalLabelByName.set(name, label);
      nextHospitalIndex += 1;
    }
    return label;
  }

  return {
    ...payload,
    salesperson: { name: SALESPERSON_ANONYMIZED_LABEL },
    supplementary: {
      ...payload.supplementary,
      topHospitalsByRevenue: payload.supplementary.topHospitalsByRevenue.map((h) => ({
        ...h,
        hospitalName: anonymizedHospitalName(h.hospitalName),
      })),
    },
  };
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${Math.round(value)}%`;
}

// Real Thai sentences built from the same numeric payload sent to Gemini — this is the path
// that actually runs whenever Gemini is disabled or unreachable, so it has to stand on its own.
export function buildRuleBasedSummary(payload: KpiSummaryPayload): string {
  const parts: string[] = [];

  if (payload.revenue.achievementPercent !== null) {
    parts.push(`งวดนี้ทำยอดขายได้ ${formatPercent(payload.revenue.achievementPercent)} ของเป้า`);
  } else {
    parts.push("งวดนี้ยังไม่ได้ตั้งเป้ายอดขาย จึงยังสรุปเทียบเป้าไม่ได้");
  }

  if (payload.composite.score !== null && payload.vsTeamAverage.teamAverageComposite !== null) {
    const comparisonWord = payload.composite.score >= payload.vsTeamAverage.teamAverageComposite ? "สูงกว่า" : "ต่ำกว่า";
    parts.push(
      `คะแนนรวมอยู่ที่ ${payload.composite.score.toFixed(1)} ${comparisonWord}ค่าเฉลี่ยทีมที่ ${payload.vsTeamAverage.teamAverageComposite.toFixed(1)}`
    );
  }

  const computableMetrics = payload.metrics.filter(
    (m): m is typeof m & { score: number } => m.computable && m.score !== null
  );
  if (computableMetrics.length > 0) {
    const best = computableMetrics.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = computableMetrics.reduce((a, b) => (b.score < a.score ? b : a));
    parts.push(`จุดแข็ง: ${METRIC_LABEL_TH[best.metric] ?? best.metric} ทำได้ ${best.score.toFixed(0)} คะแนน`);
    if (worst.metric !== best.metric) {
      parts.push(`จุดที่ควรพัฒนา: ${METRIC_LABEL_TH[worst.metric] ?? worst.metric} ทำได้เพียง ${worst.score.toFixed(0)} คะแนน`);
    }
  }

  if (payload.newCustomers.target > 0) {
    parts.push(`ลูกค้าใหม่ ${payload.newCustomers.actual} ราย จากเป้า ${payload.newCustomers.target} ราย`);
  }

  if (payload.vsPreviousPeriod.previousCompositeScore !== null && payload.composite.score !== null) {
    const trend = payload.composite.score - payload.vsPreviousPeriod.previousCompositeScore;
    const TREND_THRESHOLD = 1;
    if (Math.abs(trend) >= TREND_THRESHOLD) {
      parts.push(trend > 0 ? "แนวโน้มดีขึ้นจากงวดก่อน" : "แนวโน้มลดลงจากงวดก่อน");
    }
  }

  if (parts.length === 0) {
    return "ยังไม่มีข้อมูลเพียงพอสำหรับสรุปจุดแข็ง-จุดที่ควรพัฒนาในงวดนี้";
  }

  return parts.join(" · ");
}

function buildGeminiPrompt(payload: KpiSummaryPayload): string {
  return [
    "คุณเป็นโค้ชฝ่ายขายให้กับทีมขายเครื่องมือแพทย์ B2B",
    "จากข้อมูลสรุป KPI ที่คำนวณไว้แล้วด้านล่างนี้ (เป็น JSON) ให้เรียบเรียงเป็นคำแนะนำเชิงโค้ชภาษาไทย 2-4 ประโยค",
    "ระบุจุดแข็งอย่างน้อย 1 ข้อ และจุดที่ควรพัฒนาอย่างน้อย 1 ข้อ พร้อมอ้างอิงตัวเลขจากข้อมูลที่ให้มา",
    "ห้ามเดาหรือเพิ่มตัวเลขที่ไม่มีอยู่ในข้อมูล ห้ามใส่คำอธิบายอื่นนอกเหนือจากคำแนะนำ ตอบเป็นข้อความล้วน ไม่ต้องใส่ markdown",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

// Generates once and caches in CoachingInsight (upsert on the salespersonId+period unique key) —
// the "regenerate" button calls this same function again rather than auto-generating per view.
export async function generateInsight(
  salespersonId: string,
  period: PeriodKey,
  generatedById: string
): Promise<CoachingInsight> {
  const settings = await kpiService.getEvaluationSettings();
  const rawPayload = await buildKpiSummaryPayload(salespersonId, period);
  const outboundPayload = settings.aiAnonymize ? anonymizePayload(rawPayload) : rawPayload;
  const fallbackContent = buildRuleBasedSummary(rawPayload);

  let status: InsightStatus = "SUCCESS";
  let contentTh = fallbackContent;
  let provider: string | null = "rule-based";
  let model: string | null = null;
  let errorMessage: string | null = null;
  let sentToGemini = false;

  if (settings.aiEnabled) {
    try {
      const result = await callGemini(buildGeminiPrompt(outboundPayload));
      contentTh = result.contentTh;
      provider = "gemini";
      model = result.model;
      sentToGemini = true;
    } catch (error) {
      status = "FAILED";
      contentTh = fallbackContent;
      provider = null;
      model = null;
      errorMessage = error instanceof Error ? error.message : "เรียก Gemini API ไม่สำเร็จ";
    }
  }

  const kpiSnapshot = { payload: outboundPayload, sentToGemini } as unknown as Prisma.InputJsonValue;

  return prisma.coachingInsight.upsert({
    where: {
      salespersonId_periodType_year_periodNumber: {
        salespersonId,
        periodType: period.periodType,
        year: period.year,
        periodNumber: period.periodNumber,
      },
    },
    create: {
      salespersonId,
      periodType: period.periodType,
      year: period.year,
      periodNumber: period.periodNumber,
      kpiSnapshot,
      contentTh,
      status,
      provider,
      model,
      errorMessage,
      isStale: false,
      generatedById,
    },
    update: {
      kpiSnapshot,
      contentTh,
      status,
      provider,
      model,
      errorMessage,
      isStale: false,
      generatedById,
      generatedAt: new Date(),
    },
  });
}
