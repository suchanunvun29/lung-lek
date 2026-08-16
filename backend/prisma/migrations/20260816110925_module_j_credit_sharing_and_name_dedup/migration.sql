-- CreateEnum
CREATE TYPE "NameDecisionSource" AS ENUM ('AUTO', 'MANAGER');

-- CreateEnum
CREATE TYPE "NameReviewStatus" AS ENUM ('PENDING', 'MERGED', 'KEPT_SEPARATE');

-- CreateTable
CREATE TABLE "SalesLineCredit" (
    "id" TEXT NOT NULL,
    "salesLineId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "sharePercent" DECIMAL(6,3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesLineCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesmanNameRule" (
    "id" TEXT NOT NULL,
    "normalizedRaw" TEXT NOT NULL,
    "sampleRaw" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesmanNameRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesmanNameRuleMember" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "sharePercent" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "SalesmanNameRuleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAlias" (
    "id" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "sampleRaw" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "source" "NameDecisionSource" NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalNameReview" (
    "id" TEXT NOT NULL,
    "normalizedKeyA" TEXT NOT NULL,
    "normalizedKeyB" TEXT NOT NULL,
    "sampleRawA" TEXT NOT NULL,
    "sampleRawB" TEXT NOT NULL,
    "similarity" DECIMAL(5,4),
    "status" "NameReviewStatus" NOT NULL DEFAULT 'PENDING',
    "mergedIntoId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalNameReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesLineCredit_salespersonId_idx" ON "SalesLineCredit"("salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLineCredit_salesLineId_salespersonId_key" ON "SalesLineCredit"("salesLineId", "salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesmanNameRule_normalizedRaw_key" ON "SalesmanNameRule"("normalizedRaw");

-- CreateIndex
CREATE UNIQUE INDEX "SalesmanNameRuleMember_ruleId_salespersonId_key" ON "SalesmanNameRuleMember"("ruleId", "salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalAlias_normalizedKey_key" ON "HospitalAlias"("normalizedKey");

-- CreateIndex
CREATE INDEX "HospitalAlias_hospitalId_idx" ON "HospitalAlias"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalNameReview_status_idx" ON "HospitalNameReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalNameReview_normalizedKeyA_normalizedKeyB_key" ON "HospitalNameReview"("normalizedKeyA", "normalizedKeyB");

-- AddForeignKey
ALTER TABLE "SalesLineCredit" ADD CONSTRAINT "SalesLineCredit_salesLineId_fkey" FOREIGN KEY ("salesLineId") REFERENCES "SalesLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLineCredit" ADD CONSTRAINT "SalesLineCredit_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesmanNameRule" ADD CONSTRAINT "SalesmanNameRule_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesmanNameRuleMember" ADD CONSTRAINT "SalesmanNameRuleMember_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SalesmanNameRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesmanNameRuleMember" ADD CONSTRAINT "SalesmanNameRuleMember_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAlias" ADD CONSTRAINT "HospitalAlias_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAlias" ADD CONSTRAINT "HospitalAlias_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNameReview" ADD CONSTRAINT "HospitalNameReview_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNameReview" ADD CONSTRAINT "HospitalNameReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
