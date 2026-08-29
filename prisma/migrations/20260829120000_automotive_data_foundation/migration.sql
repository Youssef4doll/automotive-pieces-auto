-- Automotive data foundation: structured part position, engine identity,
-- the reference (OEM / aftermarket / equivalent) lookup table, fitment
-- confidence, and reversible import batches.

CREATE TYPE "Axle" AS ENUM ('AVANT', 'ARRIERE');
CREATE TYPE "Side" AS ENUM ('GAUCHE', 'DROITE');
CREATE TYPE "ReferenceType" AS ENUM ('OEM', 'AFTERMARKET', 'EQUIVALENT');
CREATE TYPE "FitmentConfidence" AS ENUM ('VERIFIED', 'DERIVED');
CREATE TYPE "ImportStatus" AS ENUM ('DRAFT', 'APPLIED', 'ROLLED_BACK', 'FAILED');

ALTER TABLE "Product"
  ADD COLUMN "axle" "Axle",
  ADD COLUMN "side" "Side",
  ADD COLUMN "importBatchId" TEXT;
CREATE INDEX "Product_importBatchId_idx" ON "Product"("importBatchId");

ALTER TABLE "VehicleEngine"
  ADD COLUMN "engineCode" TEXT,
  ADD COLUMN "displacementCc" INTEGER,
  ADD COLUMN "yearFrom" INTEGER,
  ADD COLUMN "yearTo" INTEGER;
CREATE INDEX "VehicleEngine_engineCode_idx" ON "VehicleEngine"("engineCode");

ALTER TABLE "ProductFitment"
  ADD COLUMN "confidence" "FitmentConfidence" NOT NULL DEFAULT 'VERIFIED',
  ADD COLUMN "note" TEXT,
  ADD COLUMN "source" TEXT;

CREATE TABLE "PartReference" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ReferenceType" NOT NULL,
    "brand" TEXT,
    "raw" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartReference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartReference_productId_type_normalized_key"
    ON "PartReference"("productId", "type", "normalized");
CREATE INDEX "PartReference_normalized_idx" ON "PartReference"("normalized");
CREATE INDEX "PartReference_productId_idx" ON "PartReference"("productId");
ALTER TABLE "PartReference" ADD CONSTRAINT "PartReference_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'DRAFT',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '[]',
    "report" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");
