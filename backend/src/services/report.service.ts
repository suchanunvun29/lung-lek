import { CoachingInsight } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { METRIC_LABEL_TH } from "./coachingInsight.service";
import * as kpiService from "./kpi.service";
import { CompositeScoreResult, SupplementaryKpis } from "./kpi.service";
import { PeriodKey, previousPeriod } from "./period.util";

const PERIOD_TYPE_LABEL_TH: Record<PeriodKey["periodType"], string> = {
  MONTH: "เดือน",
  QUARTER: "ไตรมาส",
  YEAR: "ปี",
};

export function periodLabel(period: PeriodKey): string {
  if (period.periodType === "YEAR") {
    return `ปี ${period.year}`;
  }
  return `${PERIOD_TYPE_LABEL_TH[period.periodType]} ${period.periodNumber}/${period.year}`;
}

export interface IndividualReportData {
  salesperson: { id: string; displayName: string };
  period: PeriodKey;
  previousPeriod: PeriodKey;
  composite: CompositeScoreResult;
  previousComposite: CompositeScoreResult;
  supplementary: SupplementaryKpis;
  coachingInsight: CoachingInsight | null;
}

// Composes the numbers Phase 4's kpi.service already computes with the coaching text Phase 6's
// coachingInsight.service already generated — no calculation logic lives here. The insight is
// only ever fetched, never generated, per plan.md Phase 7: generation is a deliberate user action.
export async function getIndividualReport(salespersonId: string, period: PeriodKey): Promise<IndividualReportData> {
  const salesperson = await prisma.salesperson.findUniqueOrThrow({
    where: { id: salespersonId },
    select: { id: true, displayName: true },
  });

  const prevPeriod = previousPeriod(period);
  const settings = await kpiService.getEvaluationSettings();

  const [composite, previousComposite, supplementary, coachingInsight] = await Promise.all([
    kpiService.computeCompositeScore(salespersonId, period),
    kpiService.computeCompositeScore(salespersonId, prevPeriod),
    kpiService.computeSupplementaryKpis(salespersonId, period, settings),
    prisma.coachingInsight.findUnique({
      where: {
        salespersonId_periodType_year_periodNumber: {
          salespersonId,
          periodType: period.periodType,
          year: period.year,
          periodNumber: period.periodNumber,
        },
      },
    }),
  ]);

  return {
    salesperson,
    period,
    previousPeriod: prevPeriod,
    composite,
    previousComposite,
    supplementary,
    coachingInsight,
  };
}

export interface TeamOverviewEntry {
  salesperson: { id: string; displayName: string };
  composite: CompositeScoreResult;
}

export interface TeamOverviewData {
  period: PeriodKey;
  results: TeamOverviewEntry[];
}

// Sorted ascending by composite score — lowest score (most in need of coaching) first, matching
// plan.md's "เรียงตามผู้ที่ควรได้รับการช่วยเหลือก่อน". Salespeople with no computable composite
// can't be meaningfully ranked on this axis, so they're appended after the ranked group —
// consistent with the Leaderboard's rank:null handling for the same case (design.md Module F).
export async function getTeamOverviewReport(period: PeriodKey): Promise<TeamOverviewData> {
  const salespeople = await prisma.salesperson.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const entries = await Promise.all(
    salespeople.map(async (sp) => ({
      salesperson: { id: sp.id, displayName: sp.displayName },
      composite: await kpiService.computeCompositeScore(sp.id, period),
    }))
  );

  const ranked = entries
    .filter((e) => e.composite.composite !== null)
    .sort((a, b) => (a.composite.composite as number) - (b.composite.composite as number));
  const unranked = entries.filter((e) => e.composite.composite === null);

  return { period, results: [...ranked, ...unranked] };
}

function scoreCell(score: number | null): number | string {
  return score === null ? "N/A" : Math.round(score * 100) / 100;
}

function metricDetailCells(metric: CompositeScoreResult["metrics"][number]): { actual: number | string; target: number | string } {
  const actual = metric.detail.actual;
  const target = metric.detail.target;
  return {
    actual: typeof actual === "number" ? actual : "-",
    target: typeof target === "number" ? target : "-",
  };
}

export async function buildIndividualReportWorkbook(data: IndividualReportData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("รายงานรายบุคคล");

  sheet.columns = [
    { key: "a", width: 32 },
    { key: "b", width: 20 },
    { key: "c", width: 20 },
    { key: "d", width: 20 },
    { key: "e", width: 40 },
  ];

  sheet.addRow([`รายงาน Coaching: ${data.salesperson.displayName}`]);
  sheet.addRow([`งวด: ${periodLabel(data.period)}`]);
  sheet.addRow([]);

  sheet.addRow(["คะแนนรวม", scoreCell(data.composite.composite), data.composite.computedFromLabel]);
  sheet.addRow([
    `คะแนนรวมงวดก่อน (${periodLabel(data.previousPeriod)})`,
    scoreCell(data.previousComposite.composite),
    data.previousComposite.computedFromLabel,
  ]);
  sheet.addRow([]);

  sheet.addRow(["ตัวชี้วัด (KPI)", "คะแนน", "ผลจริง", "เป้า", "หมายเหตุ"]);
  for (const metric of data.composite.metrics) {
    const { actual, target } = metricDetailCells(metric);
    sheet.addRow([
      METRIC_LABEL_TH[metric.metric] ?? metric.metric,
      scoreCell(metric.score),
      actual,
      target,
      metric.reason ?? "",
    ]);
  }
  sheet.addRow([]);

  sheet.addRow(["ข้อมูลเสริม", ""]);
  sheet.addRow(["ลูกค้าที่ยัง active", data.supplementary.activeCustomers.count]);
  sheet.addRow(["ลูกค้าที่หายไป (churn)", data.supplementary.churnedCustomers.count]);
  sheet.addRow([
    "จำนวนกลุ่มสินค้าเฉลี่ยต่อลูกค้า",
    Math.round(data.supplementary.productPenetration.avgDistinctProductTypesPerCustomer * 100) / 100,
  ]);
  sheet.addRow([]);

  sheet.addRow(["จุดแข็ง / จุดที่ควรพัฒนา"]);
  if (data.coachingInsight?.contentTh) {
    sheet.addRow([data.coachingInsight.contentTh]);
    if (data.coachingInsight.isStale) {
      sheet.addRow(["(ข้อมูลอัปเดตแล้ว — สรุปนี้อาจไม่ตรงกับตัวเลขล่าสุด)"]);
    }
  } else {
    sheet.addRow(["ยังไม่ได้สร้างสรุปจุดแข็ง/จุดที่ควรพัฒนาสำหรับงวดนี้"]);
  }

  return workbook;
}

export async function buildTeamOverviewWorkbook(data: TeamOverviewData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ภาพรวมทีม");

  sheet.columns = [
    { key: "a", width: 8 },
    { key: "b", width: 28 },
    { key: "c", width: 16 },
    { key: "d", width: 30 },
  ];

  sheet.addRow([`ภาพรวมทีม — งวด ${periodLabel(data.period)}`]);
  sheet.addRow(["เรียงจากผู้ที่ควรได้รับการช่วยเหลือก่อน (คะแนนรวมต่ำสุดก่อน)"]);
  sheet.addRow([]);
  sheet.addRow(["ลำดับ", "ชื่อ", "คะแนนรวม", "หมายเหตุ"]);

  data.results.forEach((entry, index) => {
    sheet.addRow([
      entry.composite.composite === null ? "-" : index + 1,
      entry.salesperson.displayName,
      scoreCell(entry.composite.composite),
      entry.composite.composite === null ? entry.composite.message ?? "" : entry.composite.computedFromLabel,
    ]);
  });

  return workbook;
}
