-- The shop's tax position at the moment each order was placed.
--
-- Both default to 0, and every row that already exists keeps that: an order
-- taken before the shop had a matricule fiscal states no VAT and was charged
-- no stamp, which is true of it. Nothing here restates an existing total.
ALTER TABLE "Order" ADD COLUMN "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "stampDuty" DECIMAL(10,2) NOT NULL DEFAULT 0;
