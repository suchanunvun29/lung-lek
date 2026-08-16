import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { HospitalNameReviewIdParams, PatchHospitalNameReviewBody } from "../validators/hospitalNameReview.validators";

export async function listPendingHospitalNameReviews(_req: Request, res: Response) {
  const reviews = await prisma.hospitalNameReview.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  res.json({ hospitalNameReviews: reviews });
}

export async function decideHospitalNameReview(req: Request, res: Response) {
  const { id } = req.params as unknown as HospitalNameReviewIdParams;
  const body = req.body as PatchHospitalNameReviewBody;

  const review = await prisma.hospitalNameReview.findUnique({ where: { id } });
  if (!review) {
    return res.status(404).json({ error: "Hospital name review not found" });
  }
  if (review.status !== "PENDING") {
    return res.status(409).json({ error: `รายการนี้ถูกตัดสินไปแล้ว (${review.status})` });
  }

  const decidedById = req.user!.id;
  const decidedAt = new Date();

  if (body.decision === "KEPT_SEPARATE") {
    const updated = await prisma.hospitalNameReview.update({
      where: { id },
      data: { status: "KEPT_SEPARATE", decidedById, decidedAt, note: body.note },
    });
    return res.json({ hospitalNameReview: updated });
  }

  const [aliasA, aliasB] = await Promise.all([
    prisma.hospitalAlias.findUnique({ where: { normalizedKey: review.normalizedKeyA } }),
    prisma.hospitalAlias.findUnique({ where: { normalizedKey: review.normalizedKeyB } }),
  ]);
  if (!aliasA || !aliasB) {
    return res.status(500).json({ error: "ไม่พบ HospitalAlias ที่สอดคล้องกับคู่ที่รอตัดสิน — ข้อมูลไม่สอดคล้องกัน" });
  }
  if (aliasA.hospitalId === aliasB.hospitalId) {
    // Already merged by a previous decision on an overlapping alias — just record this decision too.
    const updated = await prisma.hospitalNameReview.update({
      where: { id },
      data: { status: "MERGED", mergedIntoId: aliasA.hospitalId, decidedById, decidedAt, note: body.note },
    });
    return res.json({ hospitalNameReview: updated });
  }

  const canonicalId = body.mergedIntoId ?? aliasA.hospitalId;
  if (canonicalId !== aliasA.hospitalId && canonicalId !== aliasB.hospitalId) {
    return res.status(400).json({ error: "mergedIntoId ต้องเป็นหนึ่งในสองโรงพยาบาลที่รอตัดสินเท่านั้น" });
  }
  const duplicateId = canonicalId === aliasA.hospitalId ? aliasB.hospitalId : aliasA.hospitalId;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.hospitalAlias.updateMany({ where: { hospitalId: duplicateId }, data: { hospitalId: canonicalId } });
    await tx.salesLine.updateMany({ where: { hospitalId: duplicateId }, data: { hospitalId: canonicalId } });
    await tx.hospital.delete({ where: { id: duplicateId } });

    return tx.hospitalNameReview.update({
      where: { id },
      data: { status: "MERGED", mergedIntoId: canonicalId, decidedById, decidedAt, note: body.note },
    });
  });

  res.json({ hospitalNameReview: updated });
}
