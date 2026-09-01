-- Fuzzy, accent-blind part search.
--
-- pg_trgm is what lets "plaquete de frin" still reach the brake pads: it
-- indexes three-character shingles, so a misspelling still overlaps the real
-- word. unaccent flattens "arrière" and "arriere" to the same thing at index
-- time. Both ship with Postgres and are available on Supabase.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "Product" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

-- GIN over trigrams: this is the index that keeps a fuzzy match a lookup
-- rather than a scan of the whole catalogue as it grows.
CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);

CREATE TABLE "SearchMiss" (
    "id" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchMiss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchMiss_normalized_key" ON "SearchMiss"("normalized");
CREATE INDEX "SearchMiss_resolvedAt_count_idx" ON "SearchMiss"("resolvedAt", "count");
CREATE INDEX "SearchMiss_lastSeenAt_idx" ON "SearchMiss"("lastSeenAt");
