-- A picture per category, uploaded from /admin/catalogue and stored the same
-- way as everything else the admin uploads: bytes in MediaAsset, served from
-- /api/images/[id].
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;
