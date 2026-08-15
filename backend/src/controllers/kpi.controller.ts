import { KpiMetric } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as kpiService from "../services/kpi.service";
import { DrillDownParams, DrillDownQuery, PeriodQuery, SCORED_METRIC_SET, SalespersonIdParams } from "../validators/kpi.validators";

export async function getSalespersonKpi(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.query as unknown as PeriodQuery;

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const settings = await kpiService.getEvaluationSettings();
  const [composite, supplementary] = await Promise.all([
    kpiService.computeCompositeScore(salespersonId, period),
    kpiService.computeSupplementaryKpis(salespersonId, period, settings),
  ]);

  res.json({
    salesperson: { id: salesperson.id, displayName: salesperson.displayName },
    period,
    composite,
    supplementary,
  });
}

export async function getTeamKpi(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;

  const salespeople = await prisma.salesperson.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const results = await Promise.all(
    salespeople.map(async (sp) => ({
      salesperson: { id: sp.id, displayName: sp.displayName },
      composite: await kpiService.computeCompositeScore(sp.id, period),
    }))
  );

  res.json({ period, results });
}

export async function getDrillDown(req: Request, res: Response) {
  const { salespersonId, metric } = req.params as unknown as DrillDownParams;
  const { hospitalId, ...period } = req.query as unknown as DrillDownQuery;

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const isScoredMetric = SCORED_METRIC_SET.has(metric);
  const result = isScoredMetric
    ? await kpiService.getScoredMetricDrillDown(salespersonId, metric as KpiMetric, period)
    : await kpiService.getSupplementaryDrillDown(
        salespersonId,
        metric as kpiService.SupplementaryMetric,
        period,
        hospitalId
      );

  res.json({ salesperson: { id: salesperson.id, displayName: salesperson.displayName }, period, ...result });
}
