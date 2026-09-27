-- Fitment honesty (September 2026 audit).
--
-- 1. Rows with no source were written by the demo seed, which attached every
--    product to three RANDOM engines and left them VERIFIED. That is how NGK
--    spark plugs came to "fit" a BMW 320d. Every row written by a person or
--    an import carries a source ("admin", …), so a NULL source is the seed's.
--    They are kept — nothing is deleted — but demoted to DERIVED, which the
--    storefront and the app show as "to check", never as "fits".
UPDATE "ProductFitment"
SET "confidence" = 'DERIVED', "source" = 'seed-demo'
WHERE "source" IS NULL;

-- 2. Whatever the source, a part that needs one fuel cannot fit an engine
--    running on the other (src/lib/fitment-rules.ts holds the same list).
--    Such rows are demoted and annotated for the admin to review.
UPDATE "ProductFitment" f
SET "confidence" = 'DERIVED',
    "note" = COALESCE(f."note" || ' · ', '') || 'carburant incompatible — à revoir'
FROM "Product" p, "Category" c, "VehicleEngine" e
WHERE p.id = f."productId" AND c.id = p."categoryId" AND e.id = f."engineId"
  AND (
    (
      (c.slug LIKE '%bougie-d-allumage%' OR c.slug LIKE '%bobine-d-allumage%' OR c.slug LIKE '%faisceau-d-allumage%'
        OR p.name ~* '(bougies?|bobines?|faisceau) d[''’ ]?allumage')
      AND e.fuel ~* '(diesel|gazole)'
    )
    OR (
      (c.slug LIKE '%bougie-de-prechauffage%' OR c.slug LIKE '%relais-de-prechauffage%' OR c.slug LIKE '%filtre-a-particules%'
        OR p.name ~* '(bougies? de pr[ée]chauffage|filtre [àa] particules)')
      AND e.fuel ~* '(essence|petrol|gpl|hybrid)'
    )
  );
