-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'SALESPERSON');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportIssueLevel" AS ENUM ('WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "TargetChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "KpiMetric" AS ENUM ('REVENUE_VS_TARGET', 'NEW_CUSTOMERS', 'PRODUCT_GROUP', 'RETENTION', 'CONSISTENCY');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salesperson" (
    "id" TEXT NOT NULL,
    "nameInFile" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "nameInFile" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "province" TEXT,
    "isPreExistingCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLine" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "poNo" TEXT,
    "invoiceDate" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "lot" TEXT,
    "expiryDate" DATE,
    "province" TEXT,
    "qty" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "vat" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "rowKey" TEXT NOT NULL,
    "sourceSheetName" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "sheetsFound" JSONB,
    "sheetsImported" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "insertedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "periodsTouched" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportIssue" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sheetName" TEXT,
    "rowNumber" INTEGER,
    "columnName" TEXT,
    "level" "ImportIssueLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rawRow" JSONB,

    CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "revenueTarget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "newCustomerTarget" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProductGroup" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "revenueTarget" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "TargetProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetRevision" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "changeType" "TargetChangeType" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "TargetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringWeight" (
    "id" TEXT NOT NULL,
    "metric" "KpiMetric" NOT NULL,
    "weight" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringWeightRevision" (
    "id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ScoringWeightRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "churnMonths" INTEGER NOT NULL DEFAULT 6,
    "minMonthsForChurn" INTEGER NOT NULL DEFAULT 6,
    "minMonthsForConsistency" INTEGER NOT NULL DEFAULT 6,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiAnonymize" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingInsight" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "year" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "kpiSnapshot" JSONB NOT NULL,
    "contentTh" TEXT,
    "status" "InsightStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "errorMessage" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Salesperson_nameInFile_key" ON "Salesperson"("nameInFile");

-- CreateIndex
CREATE UNIQUE INDEX "Salesperson_userId_key" ON "Salesperson"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_nameInFile_key" ON "Hospital"("nameInFile");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "ProductType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_productTypeId_key" ON "Product"("name", "productTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLine_rowKey_key" ON "SalesLine"("rowKey");

-- CreateIndex
CREATE INDEX "SalesLine_salespersonId_year_month_idx" ON "SalesLine"("salespersonId", "year", "month");

-- CreateIndex
CREATE INDEX "SalesLine_hospitalId_invoiceDate_idx" ON "SalesLine"("hospitalId", "invoiceDate");

-- CreateIndex
CREATE INDEX "SalesLine_productTypeId_year_month_idx" ON "SalesLine"("productTypeId", "year", "month");

-- CreateIndex
CREATE INDEX "SalesLine_year_month_idx" ON "SalesLine"("year", "month");

-- CreateIndex
CREATE INDEX "SalesLine_invoiceNo_idx" ON "SalesLine"("invoiceNo");

-- CreateIndex
CREATE INDEX "ImportIssue_importBatchId_level_idx" ON "ImportIssue"("importBatchId", "level");

-- CreateIndex
CREATE INDEX "Target_year_month_idx" ON "Target"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Target_salespersonId_year_month_key" ON "Target"("salespersonId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "TargetProductGroup_targetId_productTypeId_key" ON "TargetProductGroup"("targetId", "productTypeId");

-- CreateIndex
CREATE INDEX "TargetRevision_targetId_changedAt_idx" ON "TargetRevision"("targetId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringWeight_metric_key" ON "ScoringWeight"("metric");

-- CreateIndex
CREATE INDEX "CoachingInsight_year_periodType_idx" ON "CoachingInsight"("year", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingInsight_salespersonId_periodType_year_periodNumber_key" ON "CoachingInsight"("salespersonId", "periodType", "year", "periodNumber");

-- AddForeignKey
ALTER TABLE "Salesperson" ADD CONSTRAINT "Salesperson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProductGroup" ADD CONSTRAINT "TargetProductGroup_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProductGroup" ADD CONSTRAINT "TargetProductGroup_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetRevision" ADD CONSTRAINT "TargetRevision_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetRevision" ADD CONSTRAINT "TargetRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringWeightRevision" ADD CONSTRAINT "ScoringWeightRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSetting" ADD CONSTRAINT "EvaluationSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingInsight" ADD CONSTRAINT "CoachingInsight_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingInsight" ADD CONSTRAINT "CoachingInsight_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
