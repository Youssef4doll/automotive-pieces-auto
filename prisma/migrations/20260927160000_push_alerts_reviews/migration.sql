-- Order status push tokens, back-in-stock alerts, order reviews.
CREATE TABLE "OrderPushToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPushToken_token_idx" ON "OrderPushToken"("token");
CREATE UNIQUE INDEX "OrderPushToken_orderId_token_key" ON "OrderPushToken"("orderId", "token");
CREATE INDEX "StockAlert_notifiedAt_idx" ON "StockAlert"("notifiedAt");
CREATE UNIQUE INDEX "StockAlert_productId_token_key" ON "StockAlert"("productId", "token");
CREATE UNIQUE INDEX "OrderReview_orderId_key" ON "OrderReview"("orderId");
CREATE INDEX "OrderReview_createdAt_idx" ON "OrderReview"("createdAt");

ALTER TABLE "OrderPushToken" ADD CONSTRAINT "OrderPushToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReview" ADD CONSTRAINT "OrderReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A rating is 1 to 5, whoever writes it.
ALTER TABLE "OrderReview" ADD CONSTRAINT "OrderReview_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
