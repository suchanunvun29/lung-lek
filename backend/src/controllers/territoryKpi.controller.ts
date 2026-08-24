import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { PeriodQuery } from "../validators/kpi.validators";
import { buildFullTerritoryRows, getTerritoryBuckets, serializeTerritoryRows } from "../services/territoryKpi.service";
import { resolveViewerTerritoryIds } from "../services/viewerTerritoryScope.service";
import { monthsInPeriod, monthsWhereOr } from "../services/period.util";

export async function getTerritoryKpi(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;
  const territory = await prisma.territory.findUnique({ where: { id: req.params.territoryId } });
  if (!territory) return res.status(404).json({ error: "Territory not found" });
  const visible = await resolveViewerTerritoryIds(req.user!);
  const [serialized] = serializeTerritoryRows(await buildFullTerritoryRows(period), visible).filter((row) => row.territoryId === territory.id);
  res.json({ period, territory: serialized });
}

export async function getTeamTerritoryKpi(req: Request, res: Response) {
  const period = req.query as unknown as PeriodQuery;
  const visible = await resolveViewerTerritoryIds(req.user!);
  const territories = serializeTerritoryRows(await buildFullTerritoryRows(period), visible);
  const buckets = req.user!.role === "MANAGER" ? await getTerritoryBuckets(period) : undefined;
  res.json({ period, territories, ...(buckets ? { buckets } : {}) });
}

// Territory KPI Rules ข้อ 7 drill-down — product types sold and hospitals sold to with amounts,
// through SalesLineCredit only. TERRITORY_FULL viewers only (Data Visibility Rules ข้อ 6).
export async function territoryDrillDown(req: Request, res: Response) {
  const territory = await prisma.territory.findUnique({ where: { id: req.params.territoryId } });
  if (!territory) return res.status(404).json({ error: "Territory not found" });
  const permitted = await resolveViewerTerritoryIds(req.user!);
  if (permitted !== null && !permitted.has(territory.id)) return res.status(403).json({ error: "Forbidden" });
  const period = req.query as unknown as PeriodQuery;
  const credits = await prisma.salesLineCredit.findMany({ where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospital: { territoryId: territory.id }, OR: monthsWhereOr(monthsInPeriod(period)) } }, select: { sharePercent: true, salesLine: { select: { total: true, hospital: { select: { id: true, displayName: true } }, productType: { select: { id: true, name: true } } } } } });
  const totals = new Map<string, { id: string; name: string; revenue: number }>();
  const hospitals = new Map<string, { id: string; name: string; revenue: number }>();
  for (const credit of credits) {
    const revenue = Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
    const type = credit.salesLine.productType;
    const hospital = credit.salesLine.hospital;
    totals.set(type.id, { id: type.id, name: type.name, revenue: (totals.get(type.id)?.revenue ?? 0) + revenue });
    hospitals.set(hospital.id, { id: hospital.id, name: hospital.displayName, revenue: (hospitals.get(hospital.id)?.revenue ?? 0) + revenue });
  }
  res.json({ territory: { id: territory.id, name: territory.name }, metric: req.params.metric, productTypes: [...totals.values()].sort((a, b) => b.revenue - a.revenue), hospitals: [...hospitals.values()].sort((a, b) => b.revenue - a.revenue) });
}
