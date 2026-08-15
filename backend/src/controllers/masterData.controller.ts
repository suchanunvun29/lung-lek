import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { UpdateHospitalInput, UpdateSalespersonInput } from "../validators/masterData.validators";

export async function listHospitals(_req: Request, res: Response) {
  const hospitals = await prisma.hospital.findMany({ orderBy: { displayName: "asc" } });
  res.json({ hospitals });
}

export async function updateHospital(req: Request, res: Response) {
  const { id } = req.params;
  const { isPreExistingCustomer } = req.body as UpdateHospitalInput;

  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) {
    return res.status(404).json({ error: "Hospital not found" });
  }

  const updated = await prisma.hospital.update({ where: { id }, data: { isPreExistingCustomer } });
  res.json({ hospital: updated });
}

export async function listProductTypes(_req: Request, res: Response) {
  const productTypes = await prisma.productType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  res.json({ productTypes });
}

export async function listSalespeople(_req: Request, res: Response) {
  const salespeople = await prisma.salesperson.findMany({
    orderBy: { displayName: "asc" },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  res.json({ salespeople });
}

export async function updateSalesperson(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body as UpdateSalespersonInput;

  const salesperson = await prisma.salesperson.findUnique({ where: { id } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  if (userId !== null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const linkedSalesperson = await prisma.salesperson.findUnique({ where: { userId } });
    if (linkedSalesperson && linkedSalesperson.id !== id) {
      return res.status(409).json({ error: "This user is already linked to another salesperson" });
    }
  }

  const updated = await prisma.salesperson.update({
    where: { id },
    data: { userId },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  res.json({ salesperson: updated });
}
