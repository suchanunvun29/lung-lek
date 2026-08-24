import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Data Visibility Rules ข้อ 2 — the ONE viewer→territory resolution in the system.
// Module N uses it via resolveViewerTerritoryIds(); Phase 17's resolveViewerScope()
// (viewerScope.service.ts) composes it for supervisedTerritoryIds/memberTerritoryIds.
export interface ViewerTerritoryScope {
  canSeeAllTerritories: boolean;
  selfSalespersonId: string | null;
  supervisedTerritoryIds: string[];
  memberTerritoryIds: string[];
}

// Rights are "as of today", never per viewed period (Data Visibility Rules ข้อ 2).
export async function resolveViewerTerritoryScope(user: { id: string; role: UserRole }): Promise<ViewerTerritoryScope> {
  const salesperson = await prisma.salesperson.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (user.role === "MANAGER") {
    return { canSeeAllTerritories: true, selfSalespersonId: salesperson?.id ?? null, supervisedTerritoryIds: [], memberTerritoryIds: [] };
  }
  if (!salesperson) return { canSeeAllTerritories: false, selfSalespersonId: null, supervisedTerritoryIds: [], memberTerritoryIds: [] };
  const today = new Date();
  const rows = await prisma.territoryAssignment.findMany({
    where: { salespersonId: salesperson.id, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] },
    select: { territoryId: true, isSupervisor: true },
  });
  return {
    canSeeAllTerritories: false,
    selfSalespersonId: salesperson.id,
    supervisedTerritoryIds: rows.filter((row) => row.isSupervisor).map((row) => row.territoryId),
    memberTerritoryIds: rows.map((row) => row.territoryId),
  };
}

/** Set of territories the viewer sees TERRITORY_FULL on; null = MANAGER (all territories).
 *  Data Visibility Rules ข้อ 6 grants FULL to members AND supervisors of a territory. */
export async function resolveViewerTerritoryIds(user: { id: string; role: UserRole }): Promise<Set<string> | null> {
  const scope = await resolveViewerTerritoryScope(user);
  if (scope.canSeeAllTerritories) return null;
  return new Set([...scope.memberTerritoryIds, ...scope.supervisedTerritoryIds]);
}
