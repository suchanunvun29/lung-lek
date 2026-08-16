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

  // Only a manager may trigger generation, per requirement.md's 2026-08-16 decision —
  // salespeople can only read an insight a manager already generated, never their own.
  if (req.user!.role !== "MANAGER") {
    return res.status(403).json({ error: "เฉพาะผู้จัดการเท่านั้นที่สั่งสร้างสรุป AI ได้" });
  }

  const insight = await coachingInsightService.generateInsight(salespersonId, period, req.user!.id);
  res.status(201).json({ insight });
}
