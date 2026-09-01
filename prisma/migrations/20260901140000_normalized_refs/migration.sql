-- Part numbers, matched the way they are written rather than the way they are
-- stored. "GDB 1330", "GDB-1330" and "gdb1330" are one number; comparing them
-- literally is why /reference/ds1001 could not find the part whose SKU is
-- "DS-1001".

ALTER TABLE "Product" ADD COLUMN "skuNormalized" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "refsNormalized" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "Product" SET
  "skuNormalized" = regexp_replace(upper(unaccent("sku")), '[^A-Z0-9]', '', 'g'),
  "refsNormalized" = COALESCE((
    SELECT array_agg(regexp_replace(upper(unaccent(r)), '[^A-Z0-9]', '', 'g'))
    FROM unnest("oemRefs") AS r
  ), '{}');

CREATE INDEX "Product_skuNormalized_idx" ON "Product"("skuNormalized");
-- GIN, because the lookup is "does this array contain the number typed".
CREATE INDEX "Product_refsNormalized_idx" ON "Product" USING GIN ("refsNormalized");
