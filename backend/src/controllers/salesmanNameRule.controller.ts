import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { PatchSalesmanNameRuleBody, SalesmanNameRuleIdParams } from "../validators/salesmanNameRule.validators";

export async function listSalesmanNameRules(_req: Request, res: Response) {
  const rules = await prisma.salesmanNameRule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: { include: { salesperson: { select: { id: true, displayName: true, nameInFile: true } } } },
      decidedBy: { select: { id: true, displayName: true } },
    },
  });
  res.json({ salesmanNameRules: rules });
}

export async function updateSalesmanNameRule(req: Request, res: Response) {
  const { id } = req.params as unknown as SalesmanNameRuleIdParams;
  const { members } = req.body as PatchSalesmanNameRuleBody;

  const rule = await prisma.salesmanNameRule.findUnique({ where: { id }, include: { members: true } });
  if (!rule) {
    return res.status(404).json({ error: "Salesman name rule not found" });
  }

  const existingSalespersonIds = new Set(rule.members.map((m) => m.salespersonId));
  const incomingSalespersonIds = new Set(members.map((m) => m.salespersonId));
  const sameMembership =
    existingSalespersonIds.size === incomingSalespersonIds.size &&
    [...existingSalespersonIds].every((spId) => incomingSalespersonIds.has(spId));
  if (!sameMembership) {
    return res
      .status(400)
      .json({ error: "แก้ได้เฉพาะสัดส่วนของสมาชิกเดิมเท่านั้น — เพิ่ม/ลบสมาชิกไม่ได้ผ่าน endpoint นี้" });
  }

  const decidedById = req.user!.id;
  const decidedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    for (const member of members) {
      await tx.salesmanNameRuleMember.update({
        where: { ruleId_salespersonId: { ruleId: id, salespersonId: member.salespersonId } },
        data: { sharePercent: member.sharePercent.toFixed(3) },
      });
    }
    await tx.salesmanNameRule.update({ where: { id }, data: { decidedById, decidedAt } });

    return tx.salesmanNameRule.findUniqueOrThrow({
      where: { id },
      include: {
        members: { include: { salesperson: { select: { id: true, displayName: true, nameInFile: true } } } },
        decidedBy: { select: { id: true, displayName: true } },
      },
    });
  });

  res.json({ salesmanNameRule: updated });
}
