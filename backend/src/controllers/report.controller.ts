import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as reportService from "../services/report.service";
import { PeriodQuery, SalespersonIdParams } from "../validators/kpi.validators";
import { canViewSalesperson, resolveViewerScope, visibleSalespersonIds } from "../services/viewerScope.service";

async function findSalespersonOrNull(salespersonId: string) {
  return prisma.salesperson.findUnique({ where: { id: salespersonId } });
}

export async function getIndividualReport(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.query as unknown as PeriodQuery;
  if (!(await canViewSalesperson(req.user!, salespersonId))) return res.status(403).json({ error: "Forbidden" });

  const salesperson = await findSalespersonOrNull(salespersonId);
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const report = await reportService.getIndividualReport(salespersonId, period);
  res.json(report);
}

export async function exportIndividualReport(req: Request, res: Response) {
  const { salespersonId } = req.params as unknown as SalespersonIdParams;
  const period = req.query as unknown as PeriodQuery;
  if (!(await canViewSalesperson(req.user!, salespersonId))) return res.status(403).json({ error: "Forbidden" });

  const salesperson = await findSalespersonOrNull(salespersonId);
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const report = await reportService.getIndividualReport(salespersonId, period);
  const workbook = await reportService.buildIndividualReportWorkbook(report);

  const fileName = `coaching-report-${salesperson.displayName}-${period.periodType}-${period.year}-${period.periodNumber}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);

  await workbook.xlsx.write(res);
  res.end();
}

export async function getTeamOverviewReport(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;
  const scope = await resolveViewerScope(req.user!); const ids = await visibleSalespersonIds(scope); const report = await reportService.getTeamOverviewReport(period, ids ?? undefined);
  res.json(report);
}

export async function exportTeamOverviewReport(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;
  const scope = await resolveViewerScope(req.user!); const ids = await visibleSalespersonIds(scope); const report = await reportService.getTeamOverviewReport(period, ids ?? undefined);
  const workbook = await reportService.buildTeamOverviewWorkbook(report);

  const fileName = `team-overview-${period.periodType}-${period.year}-${period.periodNumber}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);

  await workbook.xlsx.write(res);
  res.end();
}
