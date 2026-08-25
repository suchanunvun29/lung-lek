import { Prisma, TargetScope } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { assertTargetScopeXor } from "./target.service";
import { creditedRevenueByHospital, hasAmbiguousRunnerUp, rankContributors } from "./hospitalCreditRanking.util";

type TargetInput = { revenueTarget: number; newCustomerTarget: number; note?: string | null };
type MembershipPeriod = { effectiveFrom: Date; effectiveTo: Date | null };
type Transaction = Prisma.TransactionClient;
const periodBounds = (year: number, month: number) => ({ first: new Date(Date.UTC(year, month - 1, 1)), last: new Date(Date.UTC(year, month, 0)) });
const activeAssignments = (year: number, month: number) => { const { first, last } = periodBounds(year, month); return { effectiveFrom: { lte: last }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: first } }] }; };
const membershipOverlaps = (period: MembershipPeriod) => ({
  effectiveFrom: { lte: period.effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") },
  OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.effectiveFrom } }],
});
const activeMembership = (year: number, month: number) => ({ ...activeAssignments(year, month) });
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });
const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });
const dayBefore = (value: Date) => { const previous = new Date(value); previous.setUTCDate(previous.getUTCDate() - 1); return previous; };
const formatPeriod = (period: MembershipPeriod) => `${period.effectiveFrom.toISOString().slice(0, 10)} ถึง ${period.effectiveTo?.toISOString().slice(0, 10) ?? "ไม่มีกำหนด"}`;

function mapMembershipConstraintError(error: unknown, territoryId: string, period: MembershipPeriod): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2004" || error.code === "P2010")) {
    throw conflict(`เขต ${territoryId} มีช่วงสมาชิกกลุ่มที่ทับกันกับ ${formatPeriod(period)}`);
  }
  throw error;
}

function snapshot(target: { id: string; scope: TargetScope; territoryId: string | null; territoryGroupId: string | null; salespersonId: string | null; year: number; month: number; revenueTarget: Prisma.Decimal; newCustomerTarget: number; note: string | null }) {
  return { id: target.id, scope: target.scope, territoryId: target.territoryId, territoryGroupId: target.territoryGroupId, salespersonId: target.salespersonId, year: target.year, month: target.month, revenueTarget: Number(target.revenueTarget), newCustomerTarget: target.newCustomerTarget, note: target.note };
}

export async function ensureTerritoryCanHaveTarget(tx: Transaction, territoryId: string, year: number, month: number) {
  const membership = await tx.territoryGroupMember.findFirst({ where: { territoryId, ...activeMembership(year, month) }, select: { groupId: true } });
  if (membership) throw conflict(`เขตนี้อยู่ในกลุ่มเขตในงวด ${year}-${String(month).padStart(2, "0")} จึงตั้งเป้าแยกไม่ได้`);
}

export async function upsertScopedTarget(scope: TargetScope, ownerId: string, year: number, month: number, input: TargetInput, changedById: string) {
  const owner = scope === "TERRITORY" ? { territoryId: ownerId } : scope === "TERRITORY_GROUP" ? { territoryGroupId: ownerId } : { salespersonId: ownerId };
  assertTargetScopeXor(scope, owner);
  const unique = scope === "TERRITORY" ? { territoryId_year_month: { territoryId: ownerId, year, month } } : scope === "TERRITORY_GROUP" ? { territoryGroupId_year_month: { territoryGroupId: ownerId, year, month } } : { salespersonId_year_month: { salespersonId: ownerId, year, month } };
  return prisma.$transaction(async (tx) => {
    if (scope === "TERRITORY") await ensureTerritoryCanHaveTarget(tx, ownerId, year, month);
    const existing = await tx.target.findUnique({ where: unique });
    const target = existing ? await tx.target.update({ where: { id: existing.id }, data: input }) : await tx.target.create({ data: { ...owner, scope, year, month, ...input } });
    await tx.targetRevision.create({ data: { targetId: target.id, changeType: existing ? "UPDATE" : "CREATE", before: existing ? snapshot(existing) : Prisma.JsonNull, after: snapshot(target), changedById } });
    return target;
  });
}

async function ensureMembershipHasNoTerritoryTargets(tx: Transaction, territoryId: string, period: MembershipPeriod) {
  const targets = await tx.target.findMany({
    where: { scope: "TERRITORY", territoryId },
    select: { year: true, month: true },
  });
  const conflictingTarget = targets.find((target) => {
    const bounds = periodBounds(target.year, target.month);
    return bounds.first <= (period.effectiveTo ?? new Date("9999-12-31T00:00:00.000Z")) && bounds.last >= period.effectiveFrom;
  });
  if (conflictingTarget) throw conflict(`เขตนี้มีเป้ารายเขตในงวด ${conflictingTarget.year}-${String(conflictingTarget.month).padStart(2, "0")} ซึ่งชนกับช่วงสมาชิกกลุ่ม`);
}

async function ensureMembershipDoesNotOverlap(tx: Transaction, territoryId: string, period: MembershipPeriod, excludedMemberId?: string) {
  const existing = await tx.territoryGroupMember.findFirst({
    where: { territoryId, ...membershipOverlaps(period), ...(excludedMemberId ? { id: { not: excludedMemberId } } : {}) },
    select: { id: true },
  });
  if (existing) throw conflict(`เขต ${territoryId} เป็นสมาชิกของกลุ่มเขตอื่นในช่วง ${formatPeriod(period)} ที่ทับกัน`);
}

export async function addGroupMember(groupId: string, territoryId: string, period: MembershipPeriod) {
  try {
    return await prisma.$transaction(async (tx) => {
      const group = await tx.territoryGroup.findUnique({ where: { id: groupId } });
      if (!group) return null;
      await ensureMembershipDoesNotOverlap(tx, territoryId, period);
      await ensureMembershipHasNoTerritoryTargets(tx, territoryId, period);
      return tx.territoryGroupMember.create({ data: { groupId, territoryId, ...period } });
    });
  } catch (error) {
    return mapMembershipConstraintError(error, territoryId, period);
  }
}

export async function updateGroupMember(groupId: string, memberId: string, update: Partial<MembershipPeriod>) {
  let memberPeriod: MembershipPeriod | undefined;
  let territoryId: string | undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      const member = await tx.territoryGroupMember.findFirst({ where: { id: memberId, groupId } });
      if (!member) return null;
      const effectiveFrom = update.effectiveFrom ?? member.effectiveFrom;
      const effectiveTo = update.effectiveTo === undefined ? member.effectiveTo : update.effectiveTo;
      if (effectiveTo && effectiveTo < effectiveFrom) throw conflict("effectiveTo ต้องไม่ก่อน effectiveFrom");
      territoryId = member.territoryId;
      memberPeriod = { effectiveFrom, effectiveTo };
      await ensureMembershipDoesNotOverlap(tx, member.territoryId, memberPeriod, member.id);
      await ensureMembershipHasNoTerritoryTargets(tx, member.territoryId, memberPeriod);
      return tx.territoryGroupMember.update({ where: { id: member.id }, data: memberPeriod });
    });
  } catch (error) {
    if (territoryId && memberPeriod) return mapMembershipConstraintError(error, territoryId, memberPeriod);
    throw error;
  }
}

export async function withdrawAssignment(input: { territoryId: string; salespersonId: string; effectiveTo: Date }) {
  return prisma.$transaction(async (tx) => {
    const openRows = await tx.territoryAssignment.findMany({ where: { territoryId: input.territoryId, salespersonId: input.salespersonId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    if (!openRows.length) return null;
    const earliestOpenFrom = openRows[openRows.length - 1].effectiveFrom;
    if (input.effectiveTo < earliestOpenFrom) throw badRequest("effectiveTo ต้องไม่ก่อน effectiveFrom");
    await tx.territoryAssignment.updateMany({ where: { territoryId: input.territoryId, salespersonId: input.salespersonId, effectiveTo: null }, data: { effectiveTo: input.effectiveTo } });
    return openRows[0];
  });
}

type AssignTerritoryInput = { territoryId: string; salespersonId: string; effectiveFrom: Date; isSupervisor?: boolean; note?: string | null };

export async function assignTerritory(input: AssignTerritoryInput, assignedById: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Territory KPI Rules ข้อ 6.2: effectiveFrom ≤ effectiveFrom ของแถวเปิดอยู่เร็วสุด ทำให้ dayBefore ปิดแถวเดิมก่อนวันเริ่มของมันเอง (ช่วงกลับหัว) — ปฏิเสธก่อนเขียน
      const earliestOpen = await tx.territoryAssignment.findFirst({ where: { territoryId: input.territoryId, salespersonId: input.salespersonId, effectiveTo: null }, orderBy: { effectiveFrom: "asc" }, select: { effectiveFrom: true } });
      if (earliestOpen && input.effectiveFrom <= earliestOpen.effectiveFrom) throw badRequest(`effectiveFrom ต้องไม่เร็วกว่าหรือเท่ากับ effectiveFrom ของแถวที่ยังเปิดอยู่ (${input.effectiveFrom.toISOString().slice(0, 10)} ≤ ${earliestOpen.effectiveFrom.toISOString().slice(0, 10)})`);
      // plan ~240 (มอบ/ถอน — ไม่มีตารางประวัติแยก): เปิดแถวใหม่ = ปิดแถวเปิดอยู่ด้วยวันก่อน effectiveFrom ของแถวใหม่เสมอ
      await tx.territoryAssignment.updateMany({ where: { territoryId: input.territoryId, salespersonId: input.salespersonId, effectiveTo: null }, data: { effectiveTo: dayBefore(input.effectiveFrom) } });
      return tx.territoryAssignment.create({
        data: {
          territoryId: input.territoryId,
          salespersonId: input.salespersonId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          isSupervisor: input.isSupervisor ?? false,
          note: input.note ?? null,
          assignedById,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2004")) {
      throw conflict(`พนักงานขายนี้มีรายการมอบหมายเขตที่มีผลตั้งแต่วันที่ ${input.effectiveFrom.toISOString().slice(0, 10)} อยู่แล้ว`);
    }
    throw error;
  }
}

export async function getDerivedTarget(salespersonId: string, year: number, month: number) {
  const personal = await prisma.target.findUnique({ where: { salespersonId_year_month: { salespersonId, year, month } } });
  if (personal?.scope === "SALESPERSON") return { revenueTarget: Number(personal.revenueTarget), newCustomerTarget: personal.newCustomerTarget, source: "MANUAL", items: [] };
  const assignments = await prisma.territoryAssignment.findMany({
    where: { salespersonId, ...activeAssignments(year, month) },
    select: {
      territoryId: true,
      territory: {
        select: {
          name: true,
          groupMemberships: { where: activeMembership(year, month), select: { groupId: true, group: { select: { name: true } } } },
        },
      },
    },
  });
  const territoryIds = assignments.map((a) => a.territoryId);
  const groupIds = [...new Set(assignments.flatMap((assignment) => assignment.territory.groupMemberships.map((membership) => membership.groupId)))];
  const targets = await prisma.target.findMany({ where: { year, month, OR: [{ scope: "TERRITORY", territoryId: { in: territoryIds } }, { scope: "TERRITORY_GROUP", territoryGroupId: { in: groupIds } }] } });
  const assignmentRows = await prisma.territoryAssignment.findMany({ where: { ...activeAssignments(year, month), territoryId: { in: territoryIds } }, select: { territoryId: true, salespersonId: true } });
  const ownersByTerritory = new Map<string, Set<string>>(); for (const row of assignmentRows) (ownersByTerritory.get(row.territoryId) ?? ownersByTerritory.set(row.territoryId, new Set()).get(row.territoryId)!).add(row.salespersonId);
  const items: Array<Record<string, unknown>> = []; let revenueTarget = 0; let newCustomerTarget = 0;
  for (const target of targets) {
    if (target.scope === "TERRITORY" && target.territoryId) { const owners = ownersByTerritory.get(target.territoryId) ?? new Set(); if (!owners.size) { items.push({ territoryId: target.territoryId, unassigned: true, revenueTarget: Number(target.revenueTarget) }); continue; } revenueTarget += Number(target.revenueTarget) / owners.size; newCustomerTarget += target.newCustomerTarget / owners.size; items.push({ territoryId: target.territoryId, revenueTarget: Number(target.revenueTarget) / owners.size }); }
    if (target.scope === "TERRITORY_GROUP" && target.territoryGroupId) {
      // activeOwnerCount(G) spans every period-active member territory of G, deduped by person —
      // never just the caller's own territories (Territory KPI Rules ข้อ 6 extension).
      const members = await prisma.territoryGroupMember.findMany({ where: { groupId: target.territoryGroupId, ...activeMembership(year, month) }, select: { territoryId: true } });
      const ownerRows = await prisma.territoryAssignment.findMany({ where: { ...activeAssignments(year, month), territoryId: { in: members.map((member) => member.territoryId) } }, select: { salespersonId: true } });
      const owners = new Set(ownerRows.map((row) => row.salespersonId));
      if (!owners.size) { items.push({ territoryGroupId: target.territoryGroupId, unassigned: true, revenueTarget: Number(target.revenueTarget) }); continue; }
      revenueTarget += Number(target.revenueTarget) / owners.size; newCustomerTarget += target.newCustomerTarget / owners.size; items.push({ territoryGroupId: target.territoryGroupId, revenueTarget: Number(target.revenueTarget) / owners.size });
    }
  }
  return { revenueTarget, newCustomerTarget, source: groupIds.length ? "TERRITORY_GROUP" : "TERRITORY", items };
}

export async function listUnassignedTerritoryHospitals() {
  const hospitals = await prisma.hospital.findMany({ where: { territoryId: null }, orderBy: { displayName: "asc" } });
  const credits = await prisma.salesLineCredit.findMany({
    where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospitalId: { in: hospitals.map((hospital) => hospital.id) } } },
    select: { salespersonId: true, sharePercent: true, salesLine: { select: { hospitalId: true, total: true } } },
  });
  const revenueByHospitalPerson = creditedRevenueByHospital(credits);
  const rows = hospitals.map((hospital) => {
    const byPerson = revenueByHospitalPerson.get(hospital.id) ?? new Map<string, number>();
    return {
      ...hospital,
      unassignedBucket: [...byPerson.values()].reduce((sum, revenue) => sum + revenue, 0),
      ambiguous: hasAmbiguousRunnerUp(rankContributors(byPerson)),
    };
  });
  return {
    hospitals: rows,
    unassignedBucket: rows.reduce((sum, row) => sum + row.unassignedBucket, 0),
    hospitalCount: rows.length,
  };
}
