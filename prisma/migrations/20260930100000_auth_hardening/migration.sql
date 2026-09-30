-- Sign-in hardening: password change time, device names on sessions, and
-- idempotent order placement from the app.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "AdminSession" ADD COLUMN "device" TEXT;
ALTER TABLE "CustomerSession" ADD COLUMN "device" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyKeyHash" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKeyHash_key" ON "Order"("idempotencyKeyHash");
