-- Who made the part, and which carmaker each OE number belongs to.
--
-- Two additions that carry no data of their own: both are typed in by the shop
-- from what a manufacturer publishes, and both render nothing until it is.

-- 1. Manufacturer information on the parts brand.
ALTER TABLE "Brand"
  ADD COLUMN "legalName"  TEXT,
  ADD COLUMN "street"     TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city"       TEXT,
  ADD COLUMN "country"    TEXT,
  ADD COLUMN "phone"      TEXT,
  ADD COLUMN "email"      TEXT,
  ADD COLUMN "website"    TEXT;

-- 2. The owner of a reference becomes part of its identity.
--
-- `brand` already existed and was never written. Making it NOT NULL lets it
-- join the unique key: the same OE number legitimately belongs to two
-- carmakers inside one group (PSA stamps 1611349280 as both a Citroën and a
-- Peugeot part), and with a nullable column Postgres would also have let the
-- same unlabelled number be inserted twice, because two NULLs are distinct.
UPDATE "PartReference" SET "brand" = '' WHERE "brand" IS NULL;
ALTER TABLE "PartReference" ALTER COLUMN "brand" SET DEFAULT '';
ALTER TABLE "PartReference" ALTER COLUMN "brand" SET NOT NULL;

DROP INDEX IF EXISTS "PartReference_productId_type_normalized_key";
CREATE UNIQUE INDEX "PartReference_productId_type_brand_normalized_key"
  ON "PartReference" ("productId", "type", "brand", "normalized");
