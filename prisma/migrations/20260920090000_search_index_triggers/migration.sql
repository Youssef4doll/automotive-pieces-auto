-- The search index maintains itself now.
--
-- reindexProducts() was called from exactly one place, the CSV import. Every
-- product created or edited in the admin therefore kept whatever blob it had:
-- a new one was born with none and could not be found by anything, and a
-- renamed one stayed findable only under its old name. The comment above that
-- function had already called it -- "a helper that each of those has to
-- remember to call is a helper that will eventually be forgotten, a part that
-- exists, sells, and cannot be found" -- and then it was forgotten.
--
-- So the rule moves to where the writes are. Whatever writes a product, from
-- the admin form to a fix-up in psql, leaves the index correct, because it is
-- not possible to write the row without the trigger running.

-- One definition of the blob, used by the trigger below and by nothing else.
CREATE OR REPLACE FUNCTION product_search_fields(
  p_id          text,
  p_name        text,
  p_sku         text,
  p_description text,
  p_brand_id    text,
  p_category_id text,
  p_oem_refs    text[]
) RETURNS TABLE (search_text text, sku_normalized text, refs_normalized text[])
LANGUAGE sql STABLE AS $$
  SELECT
    lower(unaccent(concat_ws(' ',
      p_name, p_sku, p_description,
      (SELECT b.name FROM "Brand" b WHERE b.id = p_brand_id),
      (SELECT c.name FROM "Category" c WHERE c.id = p_category_id),
      (SELECT pc.name FROM "Category" pc
         JOIN "Category" c2 ON c2."parentId" = pc.id
        WHERE c2.id = p_category_id),
      array_to_string(p_oem_refs, ' '),
      (SELECT string_agg(r.raw || ' ' || r.normalized, ' ')
         FROM "PartReference" r WHERE r."productId" = p_id)
    ))),
    regexp_replace(upper(unaccent(p_sku)), '[^A-Z0-9]', '', 'g'),
    COALESCE((
      SELECT array_agg(DISTINCT regexp_replace(upper(unaccent(v)), '[^A-Z0-9]', '', 'g'))
      FROM (
        SELECT unnest(p_oem_refs) AS v
        UNION ALL
        SELECT r.raw FROM "PartReference" r WHERE r."productId" = p_id
      ) AS refs
      WHERE length(regexp_replace(upper(unaccent(v)), '[^A-Z0-9]', '', 'g')) >= 3
    ), '{}');
$$;

CREATE OR REPLACE FUNCTION product_reindex_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM product_search_fields(
    NEW.id, NEW.name, NEW.sku, NEW.description,
    NEW."brandId", NEW."categoryId", NEW."oemRefs");
  NEW."searchText"     := f.search_text;
  NEW."skuNormalized"  := f.sku_normalized;
  NEW."refsNormalized" := f.refs_normalized;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_reindex ON "Product";
CREATE TRIGGER product_reindex
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION product_reindex_row();

-- Re-running the trigger for rows whose *inputs* live in another table. The
-- write is deliberately a no-op assignment: it fires the BEFORE trigger above,
-- which keeps the blob defined in exactly one place rather than two that can
-- drift apart. Nothing recurses, because that trigger writes no rows itself.
CREATE OR REPLACE FUNCTION product_reindex_ids(p_ids text[]) RETURNS void
LANGUAGE sql AS $$
  UPDATE "Product" SET name = name WHERE id = ANY(p_ids);
$$;

-- A part number is searchable the moment it is entered, and stops being
-- searchable the moment it is removed.
CREATE OR REPLACE FUNCTION part_reference_reindex() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM product_reindex_ids(ARRAY[OLD."productId"]);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM product_reindex_ids(ARRAY[NEW."productId"]);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS part_reference_reindex ON "PartReference";
CREATE TRIGGER part_reference_reindex
AFTER INSERT OR UPDATE OR DELETE ON "PartReference"
FOR EACH ROW EXECUTE FUNCTION part_reference_reindex();

-- Renaming a brand or a family has to reach the parts filed under it, or
-- "Bosch" finds nothing the day after the brand is corrected to "BOSCH".
CREATE OR REPLACE FUNCTION brand_reindex() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Product" SET name = name WHERE "brandId" = NEW.id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS brand_reindex ON "Brand";
CREATE TRIGGER brand_reindex
AFTER UPDATE OF name ON "Brand"
FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION brand_reindex();

-- Both the family's own parts and those of its subcategories, because the blob
-- carries the parent's name too.
CREATE OR REPLACE FUNCTION category_reindex() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Product" SET name = name
   WHERE "categoryId" = NEW.id
      OR "categoryId" IN (SELECT id FROM "Category" WHERE "parentId" = NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS category_reindex ON "Category";
CREATE TRIGGER category_reindex
AFTER UPDATE OF name, "parentId" ON "Category"
FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name
                OR OLD."parentId" IS DISTINCT FROM NEW."parentId")
EXECUTE FUNCTION category_reindex();

-- Repair everything written before the triggers existed.
UPDATE "Product" SET name = name;
