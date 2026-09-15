-- Analytics reads orders by date window; nothing indexed that column.
-- CREATE INDEX (not CONCURRENTLY) because this runs inside prisma's migration
-- transaction; the table is small enough that the brief lock is not a concern,
-- and a shop applying this is not mid-Black-Friday.
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
