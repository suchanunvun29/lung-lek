-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('APPEND', 'REPLACE_PERIOD', 'PERIOD_DELETE');

-- CreateEnum
CREATE TYPE "ArchiveReason" AS ENUM ('SUPERSEDED_BY_REIMPORT', 'MANUAL_PERIOD_DELETE');

-- AlterTable
ALTER TABLE "ImportBatch"
  ADD COLUMN "mode" "ImportMode" NOT NULL DEFAULT 'APPEND',
  ADD COLUMN "targetPeriods" JSONB,
  ADD COLUMN "removedRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "confirmedById" TEXT;

-- CreateTable
CREATE TABLE "SalesLineArchive" (
  "id" TEXT NOT NULL,
  "salesLineId" TEXT NOT NULL,
  "rowKey" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "reason" "ArchiveReason" NOT NULL,
  "removedByBatchId" TEXT NOT NULL,
  "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  CONSTRAINT "SalesLineArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesLineArchive_year_month_idx" ON "SalesLineArchive"("year", "month");
CREATE INDEX "SalesLineArchive_removedByBatchId_idx" ON "SalesLineArchive"("removedByBatchId");

-- AddForeignKey
ALTER TABLE "SalesLineArchive" ADD CONSTRAINT "SalesLineArchive_removedByBatchId_fkey"
  FOREIGN KEY ("removedByBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
