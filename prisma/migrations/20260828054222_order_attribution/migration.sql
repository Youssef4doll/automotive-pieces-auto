-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" TEXT,
ADD COLUMN "medium" TEXT,
ADD COLUMN "campaign" TEXT;

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");
