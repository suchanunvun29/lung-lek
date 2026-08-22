-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('SALES_HISTORY', 'CATALOG');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "code" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'SALES_HISTORY';

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "sampleRaw" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "NameDecisionSource" NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_normalizedKey_key" ON "ProductAlias"("normalizedKey");

-- CreateIndex
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

