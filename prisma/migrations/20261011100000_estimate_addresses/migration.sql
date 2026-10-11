-- Where exactly, and when: a landmark and a pin on the order, the promised
-- delivery date, the one delay message; and addresses kept on the account.
ALTER TABLE "Order" ADD COLUMN "landmark" TEXT;
ALTER TABLE "Order" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "estimatedFrom" DATE;
ALTER TABLE "Order" ADD COLUMN "estimatedTo" DATE;
ALTER TABLE "Order" ADD COLUMN "estimatedWindow" TEXT;
ALTER TABLE "Order" ADD COLUMN "delayNotifiedAt" TIMESTAMP(3);

CREATE TABLE "SavedAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "governorate" TEXT NOT NULL,
    "delegation" TEXT,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedAddress_userId_idx" ON "SavedAddress"("userId");

ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
