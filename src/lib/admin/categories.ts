import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cache";
import { readImageFile, mediaAssetIdFromUrl, assetUrl } from "@/lib/image-upload";

/**
 * A family's picture — the tile on the website's menu and on the app's home.
 * Shared by the website's category form and the app's staff screens.
 */

// Categories are read on nearly every storefront route (the mega menu and the
// footer are rendered from the layout), so a change has to invalidate the
// layout tree, not just one page.
export function revalidateStorefront() {
  revalidateCatalog();
  revalidatePath("/", "layout");
  revalidatePath("/admin/catalogue");
  revalidatePath("/admin/catalogue/marques");
}

/** A category image is never shared between rows, so it is simply deleted. */
export async function deleteCategoryImage(imageUrl: string | null | undefined) {
  const assetId = mediaAssetIdFromUrl(imageUrl);
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
}

/**
 * Store an uploaded picture and return its URL. Vectors allowed: a category
 * tile is drawn at many sizes and an icon that is one file at every one of
 * them is the whole reason to accept SVG.
 */
export async function storeCategoryImage(file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const read = await readImageFile(file, { allowVector: true });
  if (!read.ok) return { ok: false, message: read.error };
  const asset = await prisma.mediaAsset.create({ data: { data: read.bytes, mimeType: read.mimeType }, select: { id: true } });
  return { ok: true, url: assetUrl(asset.id, read.mimeType) };
}

/** Replace (file) or remove (null) a category's picture. */
export async function setCategoryImage(
  categoryId: string,
  file: File | null,
): Promise<{ ok: true; imageUrl: string | null } | { ok: false; code: "not_found" | "bad_file"; message: string }> {
  const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { imageUrl: true } });
  if (!existing) return { ok: false, code: "not_found", message: "Catégorie introuvable." };
  let imageUrl: string | null = null;
  if (file) {
    const stored = await storeCategoryImage(file);
    if (!stored.ok) return { ok: false, code: "bad_file", message: stored.message };
    imageUrl = stored.url;
  }
  await prisma.category.update({ where: { id: categoryId }, data: { imageUrl } });
  if (existing.imageUrl && existing.imageUrl !== imageUrl) await deleteCategoryImage(existing.imageUrl);
  revalidateStorefront();
  return { ok: true, imageUrl };
}

/** The two-level tree, with pictures, for the staff screen. */
export async function adminCategoryTree() {
  const rows = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true, imageUrl: true },
  });
  const families = rows.filter((r) => !r.parentId);
  return families.map((f) => ({
    ...f,
    children: rows.filter((r) => r.parentId === f.id),
  }));
}
