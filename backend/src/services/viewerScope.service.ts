import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveViewerTerritoryScope } from "./viewerTerritoryScope.service";

export interface ViewerScope {
  canSeeEveryone: boolean;
  selfSalespersonId: string | null;
  supervisedTerritoryIds: string[];
  memberTerritoryIds: string[];
}

export async function resolveViewerScope(user: { id: string; role: UserRole }): Promise<ViewerScope> {
  const territoryScope = await resolveViewerTerritoryScope(user);
  return {
    canSeeEveryone: territoryScope.canSeeAllTerritories,
    selfSalespersonId: territoryScope.selfSalespersonId,
    supervisedTerritoryIds: territoryScope.supervisedTerritoryIds,
    memberTerritoryIds: territoryScope.memberTerritoryIds,
  };
}

function activeToday() {
  const today = new Date();
  return { effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] };
}

export async function visibleSalespersonIds(scope: ViewerScope): Promise<string[] | null> {
  if (scope.canSeeEveryone) return null;
  const rows = scope.supervisedTerritoryIds.length
    ? await prisma.territoryAssignment.findMany({ where: { territoryId: { in: scope.supervisedTerritoryIds }, ...activeToday() }, select: { salespersonId: true } })
    : [];
  return [...new Set([scope.selfSalespersonId, ...rows.map((row) => row.salespersonId)].filter((id): id is string => Boolean(id)))];
}

export async function canViewSalesperson(user: { id: string; role: UserRole }, salespersonId: string) {
  const scope = await resolveViewerScope(user);
  const ids = await visibleSalespersonIds(scope);
  return ids === null || ids.includes(salespersonId);
}
