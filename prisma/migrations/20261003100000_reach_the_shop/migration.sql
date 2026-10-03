-- Reaching the shop without a phone number: questions answered in the app,
-- push for every order of a signed-in phone, and signing in with an SMS code
-- (an account may now have no e-mail and no password).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verifiedPhone" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerSession" ADD COLUMN     "pushLocale" TEXT,
ADD COLUMN     "pushToken" TEXT;

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "accessTokenHash" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "pushLocale" TEXT,
ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "reply" TEXT;

-- CreateTable
CREATE TABLE "PhoneCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ticketHash" TEXT,
    "ticketExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCode_ticketHash_key" ON "PhoneCode"("ticketHash");

-- CreateIndex
CREATE INDEX "PhoneCode_phone_createdAt_idx" ON "PhoneCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_verifiedPhone_key" ON "User"("verifiedPhone");

-- CreateIndex
CREATE INDEX "CustomerSession_pushToken_idx" ON "CustomerSession"("pushToken");

-- CreateIndex
CREATE UNIQUE INDEX "ContactMessage_accessTokenHash_key" ON "ContactMessage"("accessTokenHash");

-- CreateIndex
CREATE INDEX "ContactMessage_orderId_idx" ON "ContactMessage"("orderId");

-- AddForeignKey
ALTER TABLE "PhoneCode" ADD CONSTRAINT "PhoneCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

