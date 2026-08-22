CREATE TABLE "ProvinceMapping" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProvinceMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProvinceMapping_canonicalName_key" ON "ProvinceMapping"("canonicalName");

CREATE TABLE "ProvinceAlias" (
    "id" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "sampleRaw" TEXT NOT NULL,
    "provinceMappingId" TEXT NOT NULL,
    "isDistrictLevel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProvinceAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProvinceAlias_normalizedAlias_key" ON "ProvinceAlias"("normalizedAlias");

CREATE TYPE "HospitalCategory" AS ENUM ('GOVERNMENT_GENERAL', 'UNIVERSITY', 'PRIVATE', 'OTHER');
CREATE TYPE "PotentialMetricKey" AS ENUM ('BEDS', 'CMI', 'SUM_ADJ_RW', 'OCCUPANCY_RATE', 'PATIENTS', 'VISITS');
CREATE TYPE "RegistryLinkStatus" AS ENUM ('UNREVIEWED', 'LINKED', 'CONFIRMED_ABSENT');
CREATE TYPE "RegistryLinkMethod" AS ENUM ('EXACT', 'NORMALIZED', 'FUZZY', 'MANUAL');

CREATE TABLE "HospitalRegistry" (
    "id" TEXT NOT NULL,
    "sourceCode" TEXT,
    "nameInFile" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provinceMappingId" TEXT,
    "provinceRaw" TEXT NOT NULL,
    "regionId" TEXT,
    "healthZone" TEXT,
    "tier" TEXT,
    "category" "HospitalCategory" NOT NULL DEFAULT 'GOVERNMENT_GENERAL',
    "potentialAdjustment" DECIMAL(6,3) NOT NULL DEFAULT 1.000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceFile" TEXT,
    "territoryId" TEXT,
    "territorySource" "TerritoryLinkSource" NOT NULL DEFAULT 'INFERRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HospitalRegistry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HospitalRegistry_sourceCode_key" ON "HospitalRegistry"("sourceCode");
CREATE UNIQUE INDEX "HospitalRegistry_nameInFile_provinceRaw_key" ON "HospitalRegistry"("nameInFile", "provinceRaw");
CREATE INDEX "HospitalRegistry_regionId_idx" ON "HospitalRegistry"("regionId");
CREATE INDEX "HospitalRegistry_category_tier_idx" ON "HospitalRegistry"("category", "tier");

CREATE TABLE "HospitalPotentialMetric" (
    "id" TEXT NOT NULL,
    "hospitalRegistryId" TEXT NOT NULL,
    "metric" "PotentialMetricKey" NOT NULL,
    "value" DECIMAL(16,4) NOT NULL,
    "periodYear" INTEGER,
    "periodMonth" INTEGER,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HospitalPotentialMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HospitalPotentialMetric_hospitalRegistryId_metric_periodYear_periodMonth_key" ON "HospitalPotentialMetric"("hospitalRegistryId", "metric", "periodYear", "periodMonth");

CREATE TABLE "HospitalRegistryLink" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "hospitalRegistryId" TEXT,
    "status" "RegistryLinkStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "method" "RegistryLinkMethod",
    "confidence" DECIMAL(5,4),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HospitalRegistryLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HospitalRegistryLink_hospitalId_key" ON "HospitalRegistryLink"("hospitalId");
CREATE INDEX "HospitalRegistryLink_status_idx" ON "HospitalRegistryLink"("status");

ALTER TABLE "Hospital" ADD COLUMN "provinceMappingId" TEXT;
ALTER TABLE "ProvinceMapping" ADD CONSTRAINT "ProvinceMapping_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProvinceAlias" ADD CONSTRAINT "ProvinceAlias_provinceMappingId_fkey" FOREIGN KEY ("provinceMappingId") REFERENCES "ProvinceMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_provinceMappingId_fkey" FOREIGN KEY ("provinceMappingId") REFERENCES "ProvinceMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistry" ADD CONSTRAINT "HospitalRegistry_provinceMappingId_fkey" FOREIGN KEY ("provinceMappingId") REFERENCES "ProvinceMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistry" ADD CONSTRAINT "HospitalRegistry_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistry" ADD CONSTRAINT "HospitalRegistry_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalPotentialMetric" ADD CONSTRAINT "HospitalPotentialMetric_hospitalRegistryId_fkey" FOREIGN KEY ("hospitalRegistryId") REFERENCES "HospitalRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistryLink" ADD CONSTRAINT "HospitalRegistryLink_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistryLink" ADD CONSTRAINT "HospitalRegistryLink_hospitalRegistryId_fkey" FOREIGN KEY ("hospitalRegistryId") REFERENCES "HospitalRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HospitalRegistryLink" ADD CONSTRAINT "HospitalRegistryLink_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
