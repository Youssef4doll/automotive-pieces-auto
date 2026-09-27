-- Photo requests from the app: "here is the part, which one is it?".
ALTER TABLE "ContactMessage" ALTER COLUMN "email" DROP NOT NULL;

CREATE TABLE "ContactPhoto" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactPhoto_messageId_idx" ON "ContactPhoto"("messageId");
ALTER TABLE "ContactPhoto" ADD CONSTRAINT "ContactPhoto_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
