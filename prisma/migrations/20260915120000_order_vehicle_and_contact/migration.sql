-- The car an order was placed for, and a place to keep what customers write in.
--
-- Written by hand and applied with `prisma db execute` rather than through
-- `migrate dev`, which wanted to reset the development database to get here.
-- Every column is nullable or defaulted, so existing orders stay valid: an
-- order placed before this migration honestly says it was placed without a
-- vehicle, which is exactly what happened.

CREATE TYPE "OrderItemFit" AS ENUM ('VERIFIED', 'DERIVED', 'UNLISTED');
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'HANDLED');

ALTER TABLE "Order" ADD COLUMN "vehicleEngineId" TEXT;
ALTER TABLE "Order" ADD COLUMN "vehicleLabel" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "fit" "OrderItemFit";

CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "userId" TEXT,
    "orderRef" TEXT,
    "productSku" TEXT,
    "vehicle" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
CREATE INDEX "ContactMessage_userId_idx" ON "ContactMessage"("userId");

ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
