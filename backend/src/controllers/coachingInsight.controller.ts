import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as coachingInsightService from "../services/coachingInsight.service";
import { GenerateInsightBody } from "../validators/coachingInsight.validators";
import { PeriodQuery, SalespersonIdParams } from "../validators/kpi.validators";
import { canViewSalesperson, resolveViewerScope } from "../services/viewerScope.service";

export async function getInsight(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.query as unknown as PeriodQuery;
  if (!(await canViewSalesperson(req.user!, salespersonId))) return res.status(403).json({ error: "Forbidden" });

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const insight = await prisma.coachingInsight.findUnique({
    where: {
      salespersonId_periodType_year_periodNumber: {
        salespersonId,
        periodType: period.periodType,
        year: period.year,
        periodNumber: period.periodNumber,
      },
    },
  });
  const scope = await resolveViewerScope(req.user!);
  const canGenerate = scope.canSeeEveryone || (scope.supervisedTerritoryIds.length > 0 && Boolean(await prisma.territoryAssignment.findFirst({ where: { salespersonId, territoryId: { in: scope.supervisedTerritoryIds }, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] } })));

  res.json({
    salesperson: { id: salesperson.id, displayName: salesperson.displayName },
    period,
    insight,
    canGenerate,
  });
}

export async function generateInsight(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.body as unknown as GenerateInsightBody;
  const scope = await resolveViewerScope(req.user!);
  if (!scope.canSeeEveryone && !scope.supervisedTerritoryIds.length) return res.status(403).json({ error: "Forbidden" });
  if (!scope.canSeeEveryone) {
    const targetInSupervisedTerritory = await prisma.territoryAssignment.findFirst({ where: { salespersonId, territoryId: { in: scope.supervisedTerritoryIds }, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] } });
    if (!targetInSupervisedTerritory) return res.status(403).json({ error: "Forbidden" });
  }

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const insight = await coachingInsightService.generateInsight(salespersonId, period, req.user!.id);
  res.status(201).json({ insight });
}
