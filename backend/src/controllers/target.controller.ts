import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as targetService from "../services/target.service";
import {
  CopyTargetsBody,
  ProductGroupTargetsBody,
  TargetIdParams,
  TargetUpsertBody,
  TargetUpsertParams,
  TargetsQuery,
} from "../validators/target.validators";

export async function listTargets(req: Request, res: Response) {
  const { year, scope } = req.query as unknown as TargetsQuery;

  const targets = await prisma.target.findMany({
    where: { year, scope },
    include: {
      salesperson: { select: { id: true, displayName: true } },
      productGroupTargets: { include: { productType: { select: { id: true, name: true } } } },
    },
    orderBy: [{ salesperson: { displayName: "asc" } }, { month: "asc" }],
  });

  res.json({ targets });
}

export async function upsertTarget(req: Request, res: Response) {
  const { salespersonId, year, month } = req.params as unknown as TargetUpsertParams;
  const { revenueTarget, newCustomerTarget, note } = req.body as TargetUpsertBody;

  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const target = await targetService.upsertMonthlyTarget({
    salespersonId,
    year,
    month,
    revenueTarget,
    newCustomerTarget,
    note,
    changedById: req.user!.id,
  });

  res.json({ target });
}

export async function updateProductGroupTargets(req: Request, res: Response) {
  const { targetId } = req.params as unknown as TargetIdParams;
  const { productGroups } = req.body as ProductGroupTargetsBody;

  const productTypeIds = productGroups.map((pg) => pg.productTypeId);
  const uniqueProductTypeIds = new Set(productTypeIds);
  if (uniqueProductTypeIds.size !== productTypeIds.length) {
    return res.status(400).json({ error: "productGroups มีกลุ่มสินค้าซ้ำกัน" });
  }
  if (uniqueProductTypeIds.size > 0) {
    const foundCount = await prisma.productType.count({ where: { id: { in: [...uniqueProductTypeIds] } } });
    if (foundCount !== uniqueProductTypeIds.size) {
      return res.status(400).json({ error: "พบ productTypeId ที่ไม่มีอยู่ในระบบ" });
    }
  }

  const updated = await targetService.setProductGroupTargets(targetId, productGroups, req.user!.id);
  if (!updated) {
    return res.status(404).json({ error: "Target not found" });
  }

  res.json({ target: updated });
}

export async function copyTargets(req: Request, res: Response) {
  const body = req.body as CopyTargetsBody;

  const result = await targetService.copyTargets({ ...body, changedById: req.user!.id });
  res.json(result);
}

export async function getTargetRevisions(req: Request, res: Response) {
  const { targetId } = req.params as unknown as TargetIdParams;

  const target = await prisma.target.findUnique({ where: { id: targetId } });
  if (!target) {
    return res.status(404).json({ error: "Target not found" });
  }

  const revisions = await prisma.targetRevision.findMany({
    where: { targetId },
    orderBy: { changedAt: "desc" },
    include: { changedBy: { select: { id: true, displayName: true, email: true } } },
  });

  res.json({ revisions });
}
