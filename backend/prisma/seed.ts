import { PrismaClient, KpiMetric } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 10;

const SCORING_WEIGHTS: { metric: KpiMetric; weight: number }[] = [
  { metric: "REVENUE_VS_TARGET", weight: 50 },
  { metric: "NEW_CUSTOMERS", weight: 15 },
  { metric: "PRODUCT_GROUP", weight: 15 },
  { metric: "RETENTION", weight: 10 },
  { metric: "CONSISTENCY", weight: 10 },
];

const SEED_MANAGERS = [
  { email: "manager1@example.com", displayName: "Manager One", password: "Passw0rd!" },
  { email: "manager2@example.com", displayName: "Manager Two", password: "Passw0rd!" },
];

async function main() {
  await prisma.evaluationSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  for (const { metric, weight } of SCORING_WEIGHTS) {
    await prisma.scoringWeight.upsert({
      where: { metric },
      update: { weight },
      create: { metric, weight },
    });
  }

  for (const manager of SEED_MANAGERS) {
    const passwordHash = await bcrypt.hash(manager.password, BCRYPT_SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: manager.email },
      update: {},
      create: {
        email: manager.email,
        passwordHash,
        displayName: manager.displayName,
        role: "MANAGER",
        mustChangePassword: true,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
