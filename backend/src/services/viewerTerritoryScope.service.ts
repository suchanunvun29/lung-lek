import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { PeriodKey } from "./period.util";

export async function resolveViewerTerritoryIds(userId: string, role: UserRole, _period: PeriodKey) {
  void _period;
  if (role === "MANAGER") return null;
  const date = new Date();
  const salesperson = await prisma.salesperson.findUnique({ where: { userId }, select: { id: true } });
  if (!salesperson) return new Set<string>();
  const assignments = await prisma.territoryAssignment.findMany({
    where: { salespersonId: salesperson.id, effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
    select: { territoryId: true },
  });
  return new Set(assignments.map((row) => row.territoryId));
}
