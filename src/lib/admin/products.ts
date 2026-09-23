import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma, SupplyMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { revalidateCatalog } from "@/lib/cache";
import { readImageFile } from "@/lib/image-upload";

/**
 * The stock room, shared by the website admin and the app's staff screens.
 * Full product editing (references, fitments, description) stays on the
 * website, where there is a keyboard; the phone does what is done standing at
 * a shelf: count, reprice, take offline, photograph.
 */

export function revalidateProductSurfaces(slug?: string) {
  // The menu carries a part count per family, so a product coming or going
  // changes it as surely as a category rename does.
  revalidateCatalog();
  revalidatePath("/admin/stock");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/produit/${slug}`);
}

export const MAX_PHOTOS_PER_PRODUCT = 8;

export type StockFilter = "" | "rupture" | "bas" | "sansphoto" | "inactif";

/** The website's /admin/stock filters, paged. "bas" is per-product threshold, so it is decided in SQL by column comparison. */
export async function listAdminProducts({
  q,
  f = "",
  cursor,
  take = 40,
}: {
  q?: string;
  f?: StockFilter;
  cursor?: string;
  take?: number;
}) {
  const where: Prisma.ProductWhereInput = {
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(f === "rupture" ? { stockQty: { lte: 0 } } : {}),
    ...(f === "bas"
      ? { stockQty: { gt: 0, lte: prisma.product.fields.lowStockThreshold } }
      : {}),
    ...(f === "inactif" ? { active: false } : {}),
    ...(f === "sansphoto" ? { images: { none: {} } } : {}),
  };
  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      sku: true,
      stockQty: true,
      lowStockThreshold: true,
      priceSell: true,
      active: true,
      supply: true,
      brand: { select: { name: true } },
      category: { select: { slug: true, parent: { select: { slug: true } } } },
      images: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
    },
  });
  const page = rows.slice(0, take);
  return {
    products: page.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brand?.name ?? null,
      family: p.category.parent?.slug ?? p.category.slug,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold,
      price: toNumber(p.priceSell),
      active: p.active,
      supply: p.supply,
      imageUrl: p.images[0] ? `/api/images/${p.images[0].id}` : null,
    })),
    next: rows.length > take ? page[page.length - 1].id : null,
  };
}

export async function adminProductDetail(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      stockQty: true,
      lowStockThreshold: true,
      priceSell: true,
      priceBuy: true,
      compareAtPrice: true,
      active: true,
      supply: true,
      brand: { select: { name: true } },
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      images: { orderBy: { order: "asc" }, select: { id: true } },
      stockMoves: { orderBy: { createdAt: "desc" }, take: 10, select: { change: true, reason: true, note: true, createdAt: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    brand: p.brand?.name ?? null,
    family: p.category.parent?.slug ?? p.category.slug,
    category: p.category.parent ? `${p.category.parent.name} › ${p.category.name}` : p.category.name,
    stockQty: p.stockQty,
    lowStockThreshold: p.lowStockThreshold,
    price: toNumber(p.priceSell),
    priceBuy: toNumber(p.priceBuy),
    compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
    active: p.active,
    supply: p.supply,
    images: p.images.map((i) => ({ id: i.id, url: `/api/images/${i.id}` })),
    movements: p.stockMoves.map((m) => ({ change: m.change, reason: m.reason, note: m.note, at: m.createdAt.toISOString() })),
  };
}

/** Add to or take from the shelf, with the movement recorded. */
export async function adjustProductStock(productId: string, change: number, note?: string) {
  const p = await prisma.product.update({
    where: { id: productId },
    data: { stockQty: { increment: change } },
    select: { slug: true },
  });
  await prisma.stockMovement.create({ data: { productId, change, reason: "adjustment", note } });
  revalidateProductSurfaces(p.slug);
}

/**
 * "I counted N on the shelf." Read and written in one transaction, so an order
 * that lands between the count and the save is not silently undone: the
 * movement recorded is the real difference at the moment of writing.
 */
export async function setProductStock(productId: string, qty: number, note?: string) {
  const slug = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id: productId }, select: { stockQty: true, slug: true } });
    if (!before) return null;
    const change = qty - before.stockQty;
    if (change === 0) return before.slug;
    await tx.product.update({ where: { id: productId }, data: { stockQty: qty } });
    await tx.stockMovement.create({ data: { productId, change, reason: "adjustment", note: note ?? "Inventaire" } });
    return before.slug;
  });
  if (slug) revalidateProductSurfaces(slug);
  return slug !== null;
}

/** The fields a phone may change. Everything else is edited on the website. */
export async function updateProductQuick(
  productId: string,
  patch: { priceSell?: number; priceBuy?: number; active?: boolean; supply?: SupplyMode; lowStockThreshold?: number },
) {
  const p = await prisma.product.update({ where: { id: productId }, data: patch, select: { slug: true } });
  revalidateProductSurfaces(p.slug);
}

export type PhotoResult =
  | { ok: true; added: number }
  | { ok: false; code: "not_found" | "no_file" | "full" | "too_many" | "bad_file"; room?: number; message: string };

/** Add photos to a product, at most eight in all, each checked by its bytes. */
export async function addProductImages(productId: string, files: File[]): Promise<PhotoResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, name: true, _count: { select: { images: true } } },
  });
  if (!product) return { ok: false, code: "not_found", message: "Produit introuvable." };
  if (files.length === 0) return { ok: false, code: "no_file", message: "Aucun fichier sélectionné." };

  const room = MAX_PHOTOS_PER_PRODUCT - product._count.images;
  if (room <= 0) return { ok: false, code: "full", room: 0, message: `Maximum ${MAX_PHOTOS_PER_PRODUCT} photos par produit.` };
  if (files.length > room) return { ok: false, code: "too_many", room, message: `Il reste ${room} emplacement(s) photo pour ce produit.` };

  const last = await prisma.productImage.findFirst({ where: { productId }, orderBy: { order: "desc" }, select: { order: true } });
  let nextOrder = (last?.order ?? -1) + 1;
  const rows: { productId: string; data: Uint8Array<ArrayBuffer>; mimeType: string; alt: string; order: number }[] = [];
  for (const file of files) {
    const read = await readImageFile(file);
    if (!read.ok) return { ok: false, code: "bad_file", message: read.error };
    rows.push({ productId, data: read.bytes, mimeType: read.mimeType, alt: product.name, order: nextOrder++ });
  }
  await prisma.productImage.createMany({ data: rows });
  revalidateProductSurfaces(product.slug);
  return { ok: true, added: rows.length };
}

export async function removeProductImage(imageId: string): Promise<boolean> {
  const img = await prisma.productImage.findUnique({ where: { id: imageId }, select: { product: { select: { slug: true } } } });
  if (!img) return false;
  await prisma.productImage.delete({ where: { id: imageId } });
  revalidateProductSurfaces(img.product.slug);
  return true;
}

/** Order is rewritten for the whole product in one transaction, so two photos can never both claim position 0. */
export async function makePrimaryImage(imageId: string): Promise<boolean> {
  const img = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!img) return false;
  const all = await prisma.productImage.findMany({ where: { productId: img.productId }, orderBy: { order: "asc" }, select: { id: true } });
  const reordered = [imageId, ...all.map((i) => i.id).filter((id) => id !== imageId)];
  await prisma.$transaction(reordered.map((id, i) => prisma.productImage.update({ where: { id }, data: { order: i } })));
  revalidateProductSurfaces(img.product.slug);
  return true;
}
