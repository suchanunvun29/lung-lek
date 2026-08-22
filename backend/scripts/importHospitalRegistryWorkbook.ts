import { readFileSync } from "fs";
import { basename } from "path";
import { prisma } from "../src/lib/prisma";
import { importRegistry } from "../src/services/registryImport.service";

async function main() {
  const workbookPath = process.argv[2];
  if (!workbookPath) throw new Error("Usage: ts-node scripts/importHospitalRegistryWorkbook.ts <workbook-path>");

  const manager = await prisma.user.findFirst({
    where: { role: "MANAGER", isActive: true },
    select: { id: true },
  });
  if (!manager) throw new Error("No active manager account found");

  const buffer = readFileSync(workbookPath);
  const result = await importRegistry(buffer, basename(workbookPath), buffer.byteLength, manager.id);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
