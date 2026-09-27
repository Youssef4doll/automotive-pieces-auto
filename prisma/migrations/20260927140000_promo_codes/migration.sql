-- Promo codes, priced by the server only.
CREATE TYPE "PromoKind" AS ENUM ('PERCENT', 'AMOUNT');

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minSubtotal" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

ALTER TABLE "Order" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "promoCode" TEXT,
ADD COLUMN "promoCodeId" TEXT;

CREATE INDEX "Order_promoCodeId_idx" ON "Order"("promoCodeId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
