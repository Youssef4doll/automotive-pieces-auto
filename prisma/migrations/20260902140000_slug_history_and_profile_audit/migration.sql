-- Addresses a product used to live at, so renaming a part redirects instead of
-- 404ing everyone holding the old link.
CREATE TABLE "ProductSlugHistory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSlugHistory_slug_key" ON "ProductSlugHistory"("slug");
CREATE INDEX "ProductSlugHistory_productId_idx" ON "ProductSlugHistory"("productId");

ALTER TABLE "ProductSlugHistory" ADD CONSTRAINT "ProductSlugHistory_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every edit to a customer's own details, kept as a record: who the account
-- used to be, when it changed, and whether the customer or the shop did it.
CREATE TABLE "UserProfileChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'SELF',
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProfileChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserProfileChange_userId_createdAt_idx" ON "UserProfileChange"("userId", "createdAt");

ALTER TABLE "UserProfileChange" ADD CONSTRAINT "UserProfileChange_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
