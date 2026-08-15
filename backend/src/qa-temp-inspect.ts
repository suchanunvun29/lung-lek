import { prisma } from "./lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true, mustChangePassword: false },
    select: { id: true, email: true, role: true, displayName: true, salesperson: { select: { id: true, displayName: true } } },
  });
  console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
