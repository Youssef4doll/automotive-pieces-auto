-- What "zero in stock" means, per part.
--
-- Until now the storefront had one answer for an empty shelf — "Rupture de
-- stock", with the buy button replaced by a WhatsApp link. That is wrong for
-- this shop: it warehouses a little and telephones its supplier for the rest,
-- so most of the catalogue at zero is a delay rather than a refusal.
--
-- ON_ORDER is the default because it matches how the shop works. A part that
-- genuinely cannot be sourced is marked UNAVAILABLE by hand in the admin, so
-- the page never claims a supply route nobody has.
CREATE TYPE "SupplyMode" AS ENUM ('ON_ORDER', 'UNAVAILABLE');

ALTER TABLE "Product"
  ADD COLUMN "supply" "SupplyMode" NOT NULL DEFAULT 'ON_ORDER';

-- Which lines of an order were sold from an empty shelf. Per line, not per
-- order: one basket can mix what is on the shelf with what is not, and the
-- picking bench has to be able to tell them apart.
ALTER TABLE "OrderItem"
  ADD COLUMN "backorder" BOOLEAN NOT NULL DEFAULT false;
