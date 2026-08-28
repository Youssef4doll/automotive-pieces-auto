-- Product photos stored as bytes in Postgres and served by /api/images/[id].
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImage_productId_order_idx" ON "ProductImage"("productId", "order");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
