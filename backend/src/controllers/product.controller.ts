import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { UpdateProductInput } from "../validators/product.validators";

export async function listProducts(_req: Request, res: Response) {
  const products = await prisma.product.findMany({
    orderBy: [{ productType: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      displayName: true,
      source: true,
      isActive: true,
      productType: { select: { id: true, name: true } },
    },
  });
  res.json({ products });
}

export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;
  const { code, displayName, isActive } = req.body as UpdateProductInput;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const data: Prisma.ProductUpdateInput = {};
  if (code !== undefined) data.code = code;
  if (displayName !== undefined) data.displayName = displayName;
  if (isActive !== undefined) data.isActive = isActive;

  try {
    const updated = await prisma.product.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        displayName: true,
        source: true,
        isActive: true,
        productType: { select: { id: true, name: true } },
      },
    });
    res.json({ product: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "รหัสสินค้านี้ถูกใช้กับสินค้าอื่นแล้ว" });
    }
    throw error;
  }
}
