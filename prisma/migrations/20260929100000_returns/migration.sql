-- Return requests: "Retourner une pièce" on a delivered order (lib/returns-rules.ts).

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('WRONG_PART', 'DAMAGED', 'DOES_NOT_FIT', 'DEFECTIVE', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "ReturnWish" AS ENUM ('EXCHANGE', 'REFUND');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REFUSED', 'RECEIVED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('DROP_OFF', 'PICKUP');

-- CreateEnum
CREATE TYPE "ReturnOutcome" AS ENUM ('EXCHANGED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "wish" "ReturnWish" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "unmounted" BOOLEAN NOT NULL DEFAULT false,
    "cover" TEXT NOT NULL,
    "method" "ReturnMethod",
    "shopNote" TEXT,
    "outcome" "ReturnOutcome",
    "refundAmount" DECIMAL(10,2),
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnPhoto" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_ref_key" ON "ReturnRequest"("ref");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

-- CreateIndex
CREATE INDEX "ReturnPhoto_returnId_idx" ON "ReturnPhoto"("returnId");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPhoto" ADD CONSTRAINT "ReturnPhoto_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A returned line is at least one part.
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_qty_positive" CHECK ("qty" > 0);
