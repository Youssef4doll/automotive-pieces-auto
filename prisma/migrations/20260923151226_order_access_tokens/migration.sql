-- Prisma's diff also proposed dropping "Product_refsNormalized_idx" and
-- "Product_searchText_trgm_idx". Both were created in raw SQL by the search
-- migrations (a GIN array index and a trigram index), which the schema file
-- cannot express, so every future `migrate dev` will offer to drop them.
-- Removed by hand: applying it would silently turn every search into a
-- sequential scan. Check any generated migration for the same two lines.

-- CreateTable
CREATE TABLE "OrderAccessToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "OrderAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderAccessToken_tokenHash_key" ON "OrderAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrderAccessToken_orderId_idx" ON "OrderAccessToken"("orderId");

-- AddForeignKey
ALTER TABLE "OrderAccessToken" ADD CONSTRAINT "OrderAccessToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
