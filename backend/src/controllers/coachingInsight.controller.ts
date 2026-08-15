import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as coachingInsightService from "../services/coachingInsight.service";
import { GenerateInsightBody } from "../validators/coachingInsight.validators";
import { PeriodQuery, SalespersonIdParams } from "../validators/kpi.validators";

export async function getInsight(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.query as unknown as PeriodQuery;

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

  res.json({
    salesperson: { id: salesperson.id, displayName: salesperson.displayName },
    period,
    insight,
  });
}

export async function generateInsight(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.body as unknown as GenerateInsightBody;

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  // A salesperson may only regenerate their own coaching insight — matches requirement.md's
  // "salesperson reads their own summary" scope; a manager may generate for anyone.
  if (req.user!.role === "SALESPERSON" && salesperson.userId !== req.user!.id) {
    return res.status(403).json({ error: "พนักงานขายสร้างสรุปได้เฉพาะของตัวเองเท่านั้น" });
  }

  const insight = await coachingInsightService.generateInsight(salespersonId, period, req.user!.id);
  res.status(201).json({ insight });
}
