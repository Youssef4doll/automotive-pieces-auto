-- Campaign banners: a second banner surface (the mid-page carousel) and a
-- place to keep artwork uploaded from the admin.

CREATE TYPE "PromotionPlacement" AS ENUM ('HERO', 'CAMPAIGN');
CREATE TYPE "CampaignKind" AS ENUM ('SEASONAL', 'NEW_ARRIVALS', 'DEAL');

-- Existing banners keep doing exactly what they did: the top strip.
ALTER TABLE "Promotion" ADD COLUMN "placement" "PromotionPlacement" NOT NULL DEFAULT 'HERO';
ALTER TABLE "Promotion" ADD COLUMN "kind" "CampaignKind";

DROP INDEX IF EXISTS "Promotion_active_order_idx";
CREATE INDEX "Promotion_active_placement_order_idx" ON "Promotion"("active", "placement", "order");

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
