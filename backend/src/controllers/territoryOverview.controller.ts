import ExcelJS from "exceljs";
import { Request, Response } from "express";
import { PeriodQuery } from "../validators/kpi.validators";
import { SCORED_METRICS } from "../validators/kpi.validators";
import { buildFullTerritoryRows, buildTerritoryGroupRows, getTerritoryBuckets, serializeGroupRows, serializeTerritoryRows } from "../services/territoryKpi.service";
import { resolveViewerTerritoryIds } from "../services/viewerTerritoryScope.service";

async function overview(req: Request, period: PeriodQuery) {
  const fullRows = await buildFullTerritoryRows(period);
  const groupRows = await buildTerritoryGroupRows(fullRows, period);
  const visible = await resolveViewerTerritoryIds(req.user!);
  return {
    period,
    territories: serializeTerritoryRows(fullRows, visible),
    territoryGroups: serializeGroupRows(groupRows, visible),
    ...(req.user!.role === "MANAGER" ? { buckets: await getTerritoryBuckets(period) } : {}),
  };
}

export async function getTerritoryOverview(req: Request, res: Response) {
  res.json(await overview(req, req.query as unknown as PeriodQuery));
}

export async function exportTerritoryOverview(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;
  const data = await overview(req, period);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Territory overview");
  sheet.columns = [
    { header: "เขต/กลุ่มเขต", key: "name", width: 28 },
    { header: "ผู้ดูแล", key: "owners", width: 30 },
    { header: "อันดับ", key: "rank", width: 8 },
    { header: "คะแนนรวม", key: "score", width: 12 },
    { header: "คิดจาก", key: "label", width: 22 },
    { header: "ยอดขาย", key: "revenue", width: 16 },
    { header: "เป้า", key: "target", width: 16 },
    { header: "% ถึงเป้า", key: "achievement", width: 12 },
    ...SCORED_METRICS.map((metric) => ({ header: metric, key: metric, width: 18 })),
  ];
  const metricCells = (metrics: { metric: string; score: number | null; reason: string | null }[] | undefined) =>
    Object.fromEntries((metrics ?? []).map((metric) => [metric.metric, metric.score !== null ? Math.round(metric.score * 100) / 100 : metric.reason ?? ""]));
  for (const row of data.territories) {
    if (row.visibility === "TERRITORY_FULL") {
      sheet.addRow({ name: row.name, owners: row.ownerNames.join(", "), rank: row.rank, score: row.compositeScore, label: row.computedMetricLabel, revenue: row.revenue, target: row.targetLabel ?? row.target ?? undefined, achievement: row.achievementPercent ?? undefined, ...metricCells(row.metrics) });
    } else {
      sheet.addRow({ name: row.name, owners: row.ownerNames.join(", "), rank: row.rank, score: row.compositeScore, label: row.computedMetricLabel });
    }
  }
  for (const row of data.territoryGroups) {
    if (row.visibility === "TERRITORY_FULL") {
      sheet.addRow({ name: `${row.name} (กลุ่มเขต)`, owners: row.ownerNames.join(", "), rank: row.rank, score: row.compositeScore, label: row.computedMetricLabel, revenue: row.revenue, target: row.revenueTarget ?? undefined, achievement: row.achievementPercent ?? undefined });
    } else {
      sheet.addRow({ name: `${row.name} (กลุ่มเขต)`, owners: row.ownerNames.join(", "), rank: row.rank, score: row.compositeScore, label: row.computedMetricLabel });
    }
  }
  // Data Visibility Rules ข้อ 6: bucket blocks are MANAGER-only, never shown to other roles even
  // as unnamed totals.
  if ("buckets" in data && data.buckets) {
    const buckets = data.buckets;
    const personalNames = buckets.personalBucketEntries.map((entry) => entry.displayName).join(", ");
    const personalTargets = buckets.personalBucketEntries.reduce((sum, entry) => sum + entry.personalTarget, 0);
    sheet.addRow({ name: "personalBucket", owners: personalNames || "—", revenue: buckets.personalBucket, ...(personalTargets > 0 ? { target: personalTargets, achievement: buckets.personalBucket / personalTargets * 100 } : {}) });
    sheet.addRow({ name: "unassignedBucket", owners: `ไม่มีเขต ${buckets.unassignedHospitalCount} โรงพยาบาล`, revenue: buckets.unassignedBucket });
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="territory-overview-${period.periodType}-${period.year}-${period.periodNumber}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}
