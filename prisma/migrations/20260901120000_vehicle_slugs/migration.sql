-- Vehicle models get an address of their own.
--
-- "Plaquettes de frein Renault Clio IV" is how people search; a page can only
-- answer that query if it has a URL, and a URL needs a slug.

ALTER TABLE "VehicleModel" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

UPDATE "VehicleModel"
SET "slug" = trim(both '-' from regexp_replace(lower(unaccent("name")), '[^a-z0-9]+', '-', 'g'));

-- Two models of the same make whose names differ only in punctuation would
-- collide; disambiguate with the row id rather than refuse the migration.
UPDATE "VehicleModel" m
SET "slug" = m."slug" || '-' || right(m."id", 4)
WHERE EXISTS (
  SELECT 1 FROM "VehicleModel" o
  WHERE o."makeId" = m."makeId" AND o."slug" = m."slug" AND o."id" <> m."id"
);

CREATE UNIQUE INDEX "VehicleModel_makeId_slug_key" ON "VehicleModel"("makeId", "slug");
