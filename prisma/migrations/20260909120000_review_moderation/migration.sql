-- Reviews become something the public can write, so they need a gate.
--
-- `published` is the moderation flag: a review is invisible on the storefront
-- until somebody at the shop has read it. Default false, deliberately — the
-- failure mode of an unattended queue is a review nobody sees, which is
-- recoverable, rather than abuse published under the shop's name, which is not.
ALTER TABLE "Review" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

-- The rows that existed before moderation did were seeded or written by the
-- shop itself, so they keep being visible rather than silently disappearing
-- the moment this ships. (There are none today; this is here so the migration
-- is correct on any database that does have some.)
UPDATE "Review" SET "published" = true;

CREATE INDEX "Review_published_idx" ON "Review"("published");

-- One review per customer per part. Without it the form's submit button is
-- something a person can lean on. NULL userId rows are exempt in Postgres,
-- which is fine: only signed-in purchasers can post, so userId is never null
-- on anything written from here on.
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");
