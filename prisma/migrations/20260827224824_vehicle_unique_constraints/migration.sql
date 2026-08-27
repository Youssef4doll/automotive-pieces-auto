-- Dedupe VehicleModel rows before adding the unique constraint: earlier seed
-- runs used bare .create() (fixed to .upsert() in this same change), so a
-- database that has run `db:seed` more than once may hold duplicate
-- (makeId, name) rows, possibly across several re-seed "generations". This
-- migration is self-healing: it merges duplicates down to one row per key
-- and applies cleanly whether the database has 1 generation (nothing to do)
-- or several.

-- Step 1: re-point VehicleEngine rows from a duplicate VehicleModel onto the
-- one we keep (lowest id per (makeId, name)).
WITH ranked AS (
  SELECT "id", "makeId", "name",
         ROW_NUMBER() OVER (PARTITION BY "makeId", "name" ORDER BY "id") AS rn
  FROM "VehicleModel"
),
keep AS (
  SELECT r.id AS dup_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k."makeId" = r."makeId" AND k."name" = r."name" AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE "VehicleEngine" e
SET "modelId" = keep.keep_id
FROM keep
WHERE e."modelId" = keep.dup_id;

-- Step 2: drop the now-childless duplicate VehicleModel rows.
WITH ranked AS (
  SELECT "id", "makeId", "name",
         ROW_NUMBER() OVER (PARTITION BY "makeId", "name" ORDER BY "id") AS rn
  FROM "VehicleModel"
)
DELETE FROM "VehicleModel" WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- Step 3: now that models are merged, a single model may hold duplicate
-- (modelId, name) engines (one per former re-seed generation, not just two
-- — a database re-seeded N times can have N-way duplicates). Resolve every
-- engine id to the one id its whole (modelId, name) group will collapse
-- onto, then dedupe ProductFitment by (productId, resolved engine) in one
-- pass — grouping directly by the final target avoids the two-tier
-- dup-vs-keep comparison missing conflicts *between* duplicates themselves.
WITH engine_groups AS (
  SELECT "id", MIN("id") OVER (PARTITION BY "modelId", "name") AS keep_id
  FROM "VehicleEngine"
),
pf_resolved AS (
  SELECT pf."id" AS pf_id,
         ROW_NUMBER() OVER (PARTITION BY pf."productId", eg.keep_id ORDER BY pf."id") AS rn
  FROM "ProductFitment" pf
  JOIN engine_groups eg ON eg."id" = pf."engineId"
)
DELETE FROM "ProductFitment" WHERE "id" IN (SELECT pf_id FROM pf_resolved WHERE rn > 1);

-- Step 4: re-point the surviving fitments onto each group's kept engine id.
WITH engine_groups AS (
  SELECT "id", MIN("id") OVER (PARTITION BY "modelId", "name") AS keep_id
  FROM "VehicleEngine"
)
UPDATE "ProductFitment" pf
SET "engineId" = eg.keep_id
FROM engine_groups eg
WHERE eg."id" = pf."engineId" AND eg.keep_id <> pf."engineId";

-- Step 5: drop the now-childless duplicate VehicleEngine rows.
WITH ranked AS (
  SELECT "id", "modelId", "name",
         ROW_NUMBER() OVER (PARTITION BY "modelId", "name" ORDER BY "id") AS rn
  FROM "VehicleEngine"
)
DELETE FROM "VehicleEngine" WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- AlterTable / CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_name_key" ON "VehicleModel"("makeId", "name");

CREATE UNIQUE INDEX "VehicleEngine_modelId_name_key" ON "VehicleEngine"("modelId", "name");
