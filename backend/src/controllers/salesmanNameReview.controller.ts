import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { SalesmanNameReviewIdParams, PatchSalesmanNameReviewBody } from "../validators/salesmanNameReview.validators";

export async function listPendingSalesmanNameReviews(_req: Request, res: Response) {
  const reviews = await prisma.salesmanNameReview.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      createdSalesperson: { select: { id: true, nameInFile: true, displayName: true, isActive: true } },
      mergedInto: { select: { id: true, nameInFile: true, displayName: true } },
    },
  });
  res.json({ salesmanNameReviews: reviews });
}

export async function decideSalesmanNameReview(req: Request, res: Response) {
  const { id } = req.params as unknown as SalesmanNameReviewIdParams;
  const body = req.body as PatchSalesmanNameReviewBody;

  const review = await prisma.salesmanNameReview.findUnique({
    where: { id },
    include: { createdSalesperson: { select: { id: true, nameInFile: true } } },
  });
  if (!review) {
    return res.status(404).json({ error: "Salesman name review not found" });
  }
  if (review.status !== "PENDING") {
    return res.status(409).json({ error: `รายการนี้ถูกตัดสินไปแล้ว (${review.status})` });
  }

  const decidedById = req.user!.id;
  const decidedAt = new Date();

  if (body.decision === "KEPT_SEPARATE") {
    const updated = await prisma.salesmanNameReview.update({
      where: { id },
      data: { status: "KEPT_SEPARATE", decidedById, decidedAt, note: body.note },
      include: {
        createdSalesperson: { select: { id: true, nameInFile: true, displayName: true, isActive: true } },
        mergedInto: { select: { id: true, nameInFile: true, displayName: true } },
      },
    });
    return res.json({ salesmanNameReview: updated });
  }

  // MERGED — the auto-created spelling was actually a duplicate of an existing salesperson.
  const fromId = review.createdSalespersonId;
  if (!fromId || !review.createdSalesperson) {
    return res
      .status(409)
      .json({ error: "แถวพนักงานขายที่ถูกสร้างจากชื่อนี้ไม่มีอยู่แล้ว จึงรวมไม่ได้ — กรุณาตัดสินใหม่หรือลบคิวนี้" });
  }
  if (body.mergedIntoId === fromId) {
    return res.status(400).json({ error: "mergedIntoId ต้องไม่ชี้ตัวเดิมที่ถูกสร้างซ้ำ" });
  }
  const target = await prisma.salesperson.findUnique({ where: { id: body.mergedIntoId } });
  if (!target) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // The duplicate is always a solo-created spelling (unresolved shared-deal names skip the row),
    // so no unique constraint on credits/targets/insights/assignments can collide here — a plain
    // repoint of every reference followed by deleting the duplicate row is complete.
    await tx.salesLine.updateMany({ where: { salespersonId: fromId }, data: { salespersonId: body.mergedIntoId } });
    await tx.salesLineCredit.updateMany({ where: { salespersonId: fromId }, data: { salespersonId: body.mergedIntoId } });
    await tx.target.updateMany({ where: { salespersonId: fromId }, data: { salespersonId: body.mergedIntoId } });
    await tx.coachingInsight.updateMany({ where: { salespersonId: fromId }, data: { salespersonId: body.mergedIntoId } });
    await tx.territoryAssignment.updateMany({ where: { salespersonId: fromId }, data: { salespersonId: body.mergedIntoId } });

    await tx.salesmanNameReview.update({
      where: { id },
      data: { status: "MERGED", mergedIntoId: body.mergedIntoId, decidedById, decidedAt, note: body.note },
    });

    await tx.salesperson.delete({ where: { id: fromId } });

    return tx.salesmanNameReview.findUniqueOrThrow({
      where: { id },
      include: {
        createdSalesperson: { select: { id: true, nameInFile: true, displayName: true, isActive: true } },
        mergedInto: { select: { id: true, nameInFile: true, displayName: true } },
      },
    });
  });

  res.json({ salesmanNameReview: updated });
}
