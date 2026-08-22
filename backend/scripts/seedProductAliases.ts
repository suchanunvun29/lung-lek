// One-off seed for Phase 11 (Module O ส่วนที่ 1 — Product Master): create exactly one ProductAlias
// per already-existing Product, per plan.md's task list and design.md's Product Master & Ranking
// Rules item 2 ("ระยะแรกยังไม่ต้องมีคิวถามผู้จัดการ ... ทะเบียนสร้างจากไฟล์เดียวกับที่ใช้จับคู่ จึงตรงกันเป๊ะ").
// normalizedKey = latinCore(product.name), reusing Module J's shared normalizer — never a second one.
//
// ProductAlias.normalizedKey is globally unique, so two Products with the same latinCore name
// under different ProductTypes (still valid per Product's @@unique([name, productTypeId])) would
// collide here. That's an edge case the schema contract doesn't resolve — this script surfaces it
// instead of silently dropping one: the first Product wins the alias, the rest are logged and left
// without one, so a later import falls back to matching by (productTypeId, name) instead of alias.
//
// Idempotent — skips any Product that already has an alias. Run once from backend/:
// `npx ts-node scripts/seedProductAliases.ts`

import { PrismaClient } from "@prisma/client";
import { latinCore } from "../src/services/nameNormalizer.util";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, productTypeId: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skippedExisting = 0;
  let skippedKeyCollision = 0;

  for (const product of products) {
    const existingForProduct = await prisma.productAlias.findFirst({ where: { productId: product.id } });
    if (existingForProduct) {
      skippedExisting++;
      continue;
    }

    const normalizedKey = latinCore(product.name);
    const collidingAlias = await prisma.productAlias.findUnique({ where: { normalizedKey } });
    if (collidingAlias) {
      console.warn(
        `Skipping alias for Product ${product.id} ("${product.name}") — normalizedKey "${normalizedKey}" already claimed by another Product's alias`
      );
      skippedKeyCollision++;
      continue;
    }

    await prisma.productAlias.create({
      data: { normalizedKey, sampleRaw: product.name, productId: product.id, source: "AUTO" },
    });
    created++;
  }

  console.log(
    `Seed complete. Created ${created}, skipped ${skippedExisting} already-aliased, skipped ${skippedKeyCollision} due to normalizedKey collision.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
