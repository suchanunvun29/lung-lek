-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('TERRITORY', 'TERRITORY_GROUP', 'SALESPERSON');

-- CreateEnum
CREATE TYPE "TerritoryLinkSource" AS ENUM ('INFERRED', 'MANUAL');

-- AlterTable
ALTER TABLE "Salesperson" ADD COLUMN "employmentEndedAt" DATE,
ADD COLUMN "excludedFromTerritoryTotals" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "territoryId" TEXT,
ADD COLUMN "territorySource" "TerritoryLinkSource" NOT NULL DEFAULT 'INFERRED';

-- AlterTable
ALTER TABLE "Target" DROP CONSTRAINT "Target_salespersonId_fkey",
ADD COLUMN "scope" "TargetScope" NOT NULL DEFAULT 'SALESPERSON',
ADD COLUMN "territoryGroupId" TEXT,
ADD COLUMN "territoryId" TEXT,
ALTER COLUMN "salespersonId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "regionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryAssignment" (
    "id" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "isSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "assignedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerritoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalTerritoryChange" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "registryId" TEXT,
    "fromTerritoryId" TEXT,
    "toTerritoryId" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "HospitalTerritoryChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TerritoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerritoryGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");
CREATE UNIQUE INDEX "Territory_name_key" ON "Territory"("name");
CREATE UNIQUE INDEX "Territory_code_key" ON "Territory"("code");
CREATE UNIQUE INDEX "TerritoryAssignment_territoryId_salespersonId_effectiveFrom_key" ON "TerritoryAssignment"("territoryId", "salespersonId", "effectiveFrom");
CREATE INDEX "TerritoryAssignment_territoryId_effectiveTo_idx" ON "TerritoryAssignment"("territoryId", "effectiveTo");
CREATE INDEX "TerritoryAssignment_salespersonId_effectiveTo_idx" ON "TerritoryAssignment"("salespersonId", "effectiveTo");
CREATE INDEX "TerritoryAssignment_salespersonId_isSupervisor_effectiveTo_idx" ON "TerritoryAssignment"("salespersonId", "isSupervisor", "effectiveTo");
CREATE INDEX "HospitalTerritoryChange_hospitalId_changedAt_idx" ON "HospitalTerritoryChange"("hospitalId", "changedAt");
CREATE INDEX "HospitalTerritoryChange_registryId_changedAt_idx" ON "HospitalTerritoryChange"("registryId", "changedAt");
CREATE UNIQUE INDEX "TerritoryGroup_name_key" ON "TerritoryGroup"("name");
CREATE UNIQUE INDEX "TerritoryGroupMember_groupId_territoryId_effectiveFrom_key" ON "TerritoryGroupMember"("groupId", "territoryId", "effectiveFrom");
CREATE INDEX "TerritoryGroupMember_territoryId_effectiveTo_idx" ON "TerritoryGroupMember"("territoryId", "effectiveTo");
CREATE INDEX "TerritoryGroupMember_groupId_effectiveTo_idx" ON "TerritoryGroupMember"("groupId", "effectiveTo");
CREATE UNIQUE INDEX "Target_territoryId_year_month_key" ON "Target"("territoryId", "year", "month");
CREATE UNIQUE INDEX "Target_territoryGroupId_year_month_key" ON "Target"("territoryGroupId", "year", "month");

-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Target" ADD CONSTRAINT "Target_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Target" ADD CONSTRAINT "Target_territoryGroupId_fkey" FOREIGN KEY ("territoryGroupId") REFERENCES "TerritoryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Target" ADD CONSTRAINT "Target_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerritoryGroupMember" ADD CONSTRAINT "TerritoryGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TerritoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerritoryGroupMember" ADD CONSTRAINT "TerritoryGroupMember_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "TerritoryGroupMember"
ADD CONSTRAINT "TerritoryGroupMember_territoryId_effective_range_excl"
EXCLUDE USING GIST (
  "territoryId" WITH =,
  daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
);
