-- Module L: TierWeight + 6 new EvaluationSetting columns (all additive, all defaulted)
-- Ref: design.md Data Model — "EvaluationSetting เพิ่ม 6 คอลัมน์ (มี default ทั้งหมด)"

CREATE TABLE "TierWeight" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL DEFAULT 1.000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierWeight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TierWeight_tier_key" ON "TierWeight"("tier");

ALTER TABLE "EvaluationSetting" ADD COLUMN "potentialMetric" "PotentialMetricKey" NOT NULL DEFAULT 'BEDS';
ALTER TABLE "EvaluationSetting" ADD COLUMN "minRegionCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0.50;
ALTER TABLE "EvaluationSetting" ADD COLUMN "targetSuggestionAlpha" DECIMAL(6,3) NOT NULL DEFAULT 1.000;
ALTER TABLE "EvaluationSetting" ADD COLUMN "targetLookbackMonths" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "EvaluationSetting" ADD COLUMN "targetOutlierThreshold" DECIMAL(5,4) NOT NULL DEFAULT 0.40;
ALTER TABLE "EvaluationSetting" ADD COLUMN "targetGrowthRate" DECIMAL(6,3) NOT NULL DEFAULT 1.000;
