-- CreateTable
CREATE TABLE "SalesmanNameReview" (
    "id" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "sampleRaw" TEXT NOT NULL,
    "status" "NameReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdSalespersonId" TEXT,
    "mergedIntoId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesmanNameReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesmanNameReview_personKey_key" ON "SalesmanNameReview"("personKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalesmanNameReview_createdSalespersonId_key" ON "SalesmanNameReview"("createdSalespersonId");

-- CreateIndex
CREATE INDEX "SalesmanNameReview_status_idx" ON "SalesmanNameReview"("status");

-- AddForeignKey
ALTER TABLE "SalesmanNameReview" ADD CONSTRAINT "SalesmanNameReview_createdSalespersonId_fkey" FOREIGN KEY ("createdSalespersonId") REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesmanNameReview" ADD CONSTRAINT "SalesmanNameReview_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesmanNameReview" ADD CONSTRAINT "SalesmanNameReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
