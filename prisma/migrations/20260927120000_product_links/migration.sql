-- "Bought together": parts the shop recommends with another.
CREATE TABLE "ProductLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductLink_productId_linkedId_key" ON "ProductLink"("productId", "linkedId");
CREATE INDEX "ProductLink_productId_idx" ON "ProductLink"("productId");
ALTER TABLE "ProductLink" ADD CONSTRAINT "ProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductLink" ADD CONSTRAINT "ProductLink_linkedId_fkey" FOREIGN KEY ("linkedId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
