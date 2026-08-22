// Module O ส่วนที่ 1 (Product Master) resolution logic used by import.service.ts: resolve a raw
// `Product Name` cell to a `Product` via `ProductAlias` before ever falling back to (productTypeId,
// name) lookup or creating a new row — per design.md's Product Master & Ranking Rules item 2.
// Mirrors creditResolution.service.ts's hospital-alias resolution shape (Module J) on purpose, but
// stays a separate file because it owns a different index/lookup key (global normalizedKey, not
// scoped by hospital) and belongs to a different module.
//
// Ambiguity queue (`ProductNameReview`) is explicitly out of scope for this phase — design.md:
// "ระยะแรกยังไม่ต้องมีคิวถามผู้จัดการ ... เป็นงานของระยะ 2 ห้าม implement ล่วงหน้าโดยไม่ amend".

import { Prisma } from "@prisma/client";
import { latinCore } from "./nameNormalizer.util";

type TxClient = Prisma.TransactionClient;

export interface ProductIndex {
  byAlias: Map<string, ResolvedProduct>; // normalizedKey -> Product, backed by an actual ProductAlias row
  byFallback: Map<string, ResolvedProduct>; // `${productTypeId}|${latinCore(name)}` -> Product, for products with no alias yet
}

export interface ResolvedProduct {
  id: string;
  productTypeId: string;
}

export async function buildProductIndex(tx: TxClient): Promise<ProductIndex> {
  const [products, aliases] = await Promise.all([
    tx.product.findMany({ select: { id: true, name: true, productTypeId: true } }),
    tx.productAlias.findMany({ select: { normalizedKey: true, productId: true } }),
  ]);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const byAlias = new Map(
    aliases.flatMap((alias) => {
      const product = productsById.get(alias.productId);
      return product ? [[alias.normalizedKey, product] as const] : [];
    })
  );
  const byFallback = new Map<string, ResolvedProduct>();
  for (const p of products) {
    byFallback.set(`${p.productTypeId}|${latinCore(p.name)}`, p);
  }

  return { byAlias, byFallback };
}

/**
 * Resolves (and auto-creates if genuinely unseen) a single Product via its ProductAlias.
 * A new Product is created with `source = SALES_HISTORY` per Product Master & Ranking Rules item 1,
 * with a matching AUTO alias created in the same step.
 */
export async function resolveProductViaAlias(
  tx: TxClient,
  index: ProductIndex,
  rawName: string,
  productTypeId: string
): Promise<ResolvedProduct> {
  const key = latinCore(rawName);

  const aliasedProduct = index.byAlias.get(key);
  if (aliasedProduct) return aliasedProduct;

  const fallbackKey = `${productTypeId}|${key}`;
  const fallbackProduct = index.byFallback.get(fallbackKey);
  if (fallbackProduct) {
    await tx.productAlias.create({
      data: { normalizedKey: key, sampleRaw: rawName, productId: fallbackProduct.id, source: "AUTO" },
    });
    index.byAlias.set(key, fallbackProduct);
    return fallbackProduct;
  }

  const created = await tx.product.create({
    data: { name: rawName, productTypeId, source: "SALES_HISTORY" },
  });
  await tx.productAlias.create({
    data: { normalizedKey: key, sampleRaw: rawName, productId: created.id, source: "AUTO" },
  });

  const resolvedProduct = { id: created.id, productTypeId: created.productTypeId };
  index.byAlias.set(key, resolvedProduct);
  index.byFallback.set(fallbackKey, resolvedProduct);

  return resolvedProduct;
}
