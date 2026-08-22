import { Prisma, Target, TargetProductGroup } from "@prisma/client";
import { prisma } from "../lib/prisma";

type TargetWithProductGroups = Target & { productGroupTargets: TargetProductGroup[] };

// TargetRevision.before/after are JSON snapshots — Prisma's Decimal class isn't a plain JSON
// value, so every Decimal field must be converted before it can be written to a Json column.
function toTargetSnapshot(target: TargetWithProductGroups) {
  return {
    id: target.id,
    salespersonId: target.salespersonId,
    year: target.year,
    month: target.month,
    revenueTarget: Number(target.revenueTarget),
    newCustomerTarget: target.newCustomerTarget,
    note: target.note,
    productGroupTargets: target.productGroupTargets
      .map((pg) => ({ productTypeId: pg.productTypeId, revenueTarget: Number(pg.revenueTarget) }))
      .sort((a, b) => a.productTypeId.localeCompare(b.productTypeId)),
  };
}

interface UpsertMonthlyTargetParams {
  salespersonId: string;
  year: number;
  month: number;
  revenueTarget: number;
  newCustomerTarget: number;
  note: string | null | undefined;
  changedById: string;
}

export async function upsertMonthlyTarget({
  salespersonId,
  year,
  month,
  revenueTarget,
  newCustomerTarget,
  note,
  changedById,
}: UpsertMonthlyTargetParams) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.target.findUnique({
      where: { salespersonId_year_month: { salespersonId, year, month } },
      include: { productGroupTargets: true },
    });

    if (!existing) {
      const created = await tx.target.create({
        data: { salespersonId, year, month, revenueTarget, newCustomerTarget, note: note ?? null },
        include: { productGroupTargets: true },
      });
      await tx.targetRevision.create({
        data: {
          targetId: created.id,
          changeType: "CREATE",
          before: Prisma.JsonNull,
          after: toTargetSnapshot(created),
          changedById,
        },
      });
      return created;
    }

    const before = toTargetSnapshot(existing);
    const updated = await tx.target.update({
      where: { id: existing.id },
      data: {
        revenueTarget,
        newCustomerTarget,
        ...(note !== undefined ? { note } : {}),
      },
      include: { productGroupTargets: true },
    });
    await tx.targetRevision.create({
      data: {
        targetId: updated.id,
        changeType: "UPDATE",
        before,
        after: toTargetSnapshot(updated),
        changedById,
      },
    });
    return updated;
  });
}

interface ProductGroupInput {
  productTypeId: string;
  revenueTarget: number;
}

export async function setProductGroupTargets(
  targetId: string,
  productGroups: ProductGroupInput[],
  changedById: string
): Promise<TargetWithProductGroups | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.target.findUnique({
      where: { id: targetId },
      include: { productGroupTargets: true },
    });
    if (!existing) return null;

    const before = toTargetSnapshot(existing);

    await tx.targetProductGroup.deleteMany({ where: { targetId } });
    if (productGroups.length > 0) {
      await tx.targetProductGroup.createMany({
        data: productGroups.map((pg) => ({
          targetId,
          productTypeId: pg.productTypeId,
          revenueTarget: pg.revenueTarget,
        })),
      });
    }

    const updated = await tx.target.findUniqueOrThrow({
      where: { id: targetId },
      include: { productGroupTargets: true },
    });

    await tx.targetRevision.create({
      data: {
        targetId,
        changeType: "UPDATE",
        before,
        after: toTargetSnapshot(updated),
        changedById,
      },
    });

    return updated;
  });
}

interface CopyTargetsParams {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  overwrite: boolean;
  changedById: string;
}

export async function copyTargets({ fromYear, fromMonth, toYear, toMonth, overwrite, changedById }: CopyTargetsParams) {
  return prisma.$transaction(async (tx) => {
    const sourceTargets = await tx.target.findMany({
      where: { year: fromYear, month: fromMonth, scope: "SALESPERSON" },
      include: { productGroupTargets: true },
    });

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const revisionNote = `คัดลอกจากเป้าเดือน ${fromMonth}/${fromYear}`;

    for (const source of sourceTargets) {
      const salespersonId = source.salespersonId;
      if (!salespersonId) continue;
      const destination = await tx.target.findUnique({
        where: { salespersonId_year_month: { salespersonId, year: toYear, month: toMonth } },
        include: { productGroupTargets: true },
      });

      if (destination && !overwrite) {
        skipped.push(salespersonId);
        continue;
      }

      if (!destination) {
        const newTarget = await tx.target.create({
          data: {
            salespersonId,
            scope: "SALESPERSON",
            year: toYear,
            month: toMonth,
            revenueTarget: source.revenueTarget,
            newCustomerTarget: source.newCustomerTarget,
            note: source.note,
            productGroupTargets: {
              create: source.productGroupTargets.map((pg) => ({
                productTypeId: pg.productTypeId,
                revenueTarget: pg.revenueTarget,
              })),
            },
          },
          include: { productGroupTargets: true },
        });
        await tx.targetRevision.create({
          data: {
            targetId: newTarget.id,
            changeType: "CREATE",
            before: Prisma.JsonNull,
            after: toTargetSnapshot(newTarget),
            changedById,
            note: revisionNote,
          },
        });
        created.push(salespersonId);
        continue;
      }

      const before = toTargetSnapshot(destination);
      await tx.targetProductGroup.deleteMany({ where: { targetId: destination.id } });
      const updatedTarget = await tx.target.update({
        where: { id: destination.id },
        data: {
          revenueTarget: source.revenueTarget,
          newCustomerTarget: source.newCustomerTarget,
          note: source.note,
          productGroupTargets: {
            create: source.productGroupTargets.map((pg) => ({
              productTypeId: pg.productTypeId,
              revenueTarget: pg.revenueTarget,
            })),
          },
        },
        include: { productGroupTargets: true },
      });
      await tx.targetRevision.create({
        data: {
          targetId: updatedTarget.id,
          changeType: "UPDATE",
          before,
          after: toTargetSnapshot(updatedTarget),
          changedById,
          note: revisionNote,
        },
      });
      updated.push(salespersonId);
    }

    return { sourceCount: sourceTargets.length, created, updated, skipped };
  });
}
