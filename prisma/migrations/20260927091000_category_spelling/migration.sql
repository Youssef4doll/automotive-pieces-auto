-- "Carosserie" was a typo in the demo taxonomy; customers read the name, so it
-- is spelled right. The slug keeps the old spelling so links stay valid.
UPDATE "Category" SET "name" = 'Carrosserie' WHERE "name" = 'Carosserie';
