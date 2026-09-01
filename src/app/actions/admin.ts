"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { updateSettings, type SettingsMap } from "@/lib/settings";
import { OrderStatus } from "@prisma/client";
import { normalizeReference, parseReferenceList } from "@/lib/reference";
import { readImageFile, mediaAssetIdFromUrl } from "@/lib/image-upload";
import { reindexProducts, topSearchMisses } from "@/lib/search";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await assertAdmin();
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      history: { create: { status } },
    },
  });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/compte/commandes");
}

const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(2),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  axle: z.string().optional(),
  side: z.string().optional(),
  oemRefsText: z.string().optional(),
  aftermarketRefsText: z.string().optional(),
  priceBuy: z.coerce.number().min(0),
  priceSell: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().optional(),
  stockQty: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  isTopSeller: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

export type ProductFormState = { error?: string; ok?: boolean } | undefined;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function upsertProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await assertAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = productSchema.safeParse({
    ...raw,
    isTopSeller: raw.isTopSeller === "on" || raw.isTopSeller === "true",
    active: raw.active === undefined ? true : raw.active === "on" || raw.active === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const data = parsed.data;

  let productId = data.id ?? "";
  try {
    if (data.id) {
      await prisma.product.update({
        where: { id: data.id },
        data: {
          sku: data.sku,
          name: data.name,
          categoryId: data.categoryId,
          brandId: data.brandId || null,
          description: data.description ?? "",
          // Blank means "keep the current picture" on edit — clearing the box
          // by accident should not wipe an image the admin cannot re-upload.
          ...(data.imageUrl?.trim() ? { imageUrl: data.imageUrl.trim() } : {}),
          priceBuy: data.priceBuy,
          priceSell: data.priceSell,
          compareAtPrice: data.compareAtPrice || null,
          stockQty: data.stockQty,
          lowStockThreshold: data.lowStockThreshold,
          isTopSeller: !!data.isTopSeller,
          active: data.active ?? true,
          axle: (data.axle || null) as never,
          side: (data.side || null) as never,
        },
      });
    } else {
      const created = await prisma.product.create({
        select: { id: true },
        data: {
          sku: data.sku,
          name: data.name,
          slug: slugify(`${data.name}-${data.sku}`),
          categoryId: data.categoryId,
          brandId: data.brandId || null,
          description: data.description ?? "",
          ...(data.imageUrl?.trim() ? { imageUrl: data.imageUrl.trim() } : {}),
          priceBuy: data.priceBuy,
          priceSell: data.priceSell,
          compareAtPrice: data.compareAtPrice || null,
          stockQty: data.stockQty,
          lowStockThreshold: data.lowStockThreshold,
          isTopSeller: !!data.isTopSeller,
          active: data.active ?? true,
          axle: (data.axle || null) as never,
          side: (data.side || null) as never,
        },
      });
      productId = created.id;
    }

    await syncReferences(productId, "OEM", data.oemRefsText ?? "");
    await syncReferences(productId, "AFTERMARKET", data.aftermarketRefsText ?? "");
    // Last, because it reads back the references that were just written. A
    // part that is saved but not indexed is a part nobody can search for.
    await reindexProducts([productId]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'enregistrement" };
  }

  revalidateProductSurfaces();
  return { ok: true };
}

/**
 * The textarea is the source of truth for this product's references of that
 * type: whatever is no longer listed is removed, so an admin can correct a
 * mistyped number by editing the box rather than hunting for a delete button.
 */
async function syncReferences(productId: string, type: "OEM" | "AFTERMARKET", text: string) {
  const entries = parseReferenceList(text)
    .map((raw) => ({ raw, normalized: normalizeReference(raw) }))
    .filter((r) => r.normalized.length >= 3);

  await prisma.partReference.deleteMany({
    where: { productId, type, normalized: { notIn: entries.map((e) => e.normalized) } },
  });
  for (const e of entries) {
    await prisma.partReference.upsert({
      where: { productId_type_normalized: { productId, type, normalized: e.normalized } },
      create: { productId, type, raw: e.raw, normalized: e.normalized },
      update: { raw: e.raw },
    });
  }
}

// A product shows up on the home page, its own page, every catalogue listing
// and the search results, so a price or stock edit has to invalidate the whole
// storefront tree — revalidating "/" alone left the listings stale.
function revalidateProductSurfaces() {
  revalidatePath("/admin/stock");
  revalidatePath("/", "layout");
}

export async function deleteProduct(productId: string) {
  await assertAdmin();
  await prisma.product.delete({ where: { id: productId } });
  revalidateProductSurfaces();
}

export async function adjustStock(productId: string, change: number, note?: string) {
  await assertAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { stockQty: { increment: change } },
  });
  await prisma.stockMovement.create({
    data: { productId, change, reason: "adjustment", note },
  });
  revalidateProductSurfaces();
}

export async function updateSiteSettings(patch: Partial<SettingsMap>) {
  await assertAdmin();
  await updateSettings(patch);
  revalidatePath("/admin/parametres");
  revalidatePath("/", "layout");
}

export type SettingsFormState = { ok?: boolean } | undefined;

const SETTINGS_KEYS: (keyof SettingsMap)[] = [
  "shop_name",
  "shop_address",
  "shop_phone",
  "shop_whatsapp",
  "shop_email",
  "shop_hours",
  "free_shipping_threshold",
  "delivery_grand_tunis",
  "delivery_regions",
];

export async function updateSettingsAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await assertAdmin();
  const patch: Partial<SettingsMap> = {};
  for (const key of SETTINGS_KEYS) {
    const value = formData.get(key);
    if (typeof value === "string") patch[key] = value;
  }
  await updateSettings(patch);
  revalidatePath("/admin/parametres");
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Promotions (home page banners) -----------------------------------------

const promotionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  // Left empty when the admin uploads a file instead of typing a path; the
  // action below requires one of the two.
  imageUrl: z.string().optional(),
  href: z.string().optional(),
  placement: z.enum(["HERO", "CAMPAIGN"]).default("CAMPAIGN"),
  kind: z.enum(["SEASONAL", "NEW_ARRIVALS", "DEAL"]).optional(),
  order: z.coerce.number().int().min(0),
  active: z.coerce.boolean().optional(),
});

export type PromotionFormState = { error?: string; ok?: boolean } | undefined;

/** Drop banner artwork that nothing points at any more. */
async function deleteAssetIfUnused(imageUrl: string | null | undefined, keepPromotionId?: string) {
  const assetId = mediaAssetIdFromUrl(imageUrl);
  if (!assetId) return; // a static /images/… path — not ours to delete
  const stillUsed = await prisma.promotion.count({
    where: { imageUrl: `/api/images/${assetId}`, ...(keepPromotionId ? { id: { not: keepPromotionId } } : {}) },
  });
  if (stillUsed === 0) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
}

export async function upsertPromotion(
  _prev: PromotionFormState,
  formData: FormData
): Promise<PromotionFormState> {
  await assertAdmin();
  const file = formData.get("file");
  const raw = Object.fromEntries(formData.entries());
  const parsed = promotionSchema.safeParse({
    ...raw,
    // A file input always submits, empty or not, so it must not reach zod as
    // a stray string field.
    file: undefined,
    kind: raw.kind || undefined,
    active: raw.active === "on" || raw.active === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;
  // Only same-origin paths: a banner is a link the whole storefront trusts,
  // so don't let it become an open redirect to an arbitrary external host.
  if (d.href && !d.href.startsWith("/")) {
    return { error: "Le lien doit être un chemin interne commençant par /" };
  }
  if (d.placement === "CAMPAIGN" && !d.kind) {
    return { error: "Choisissez le type de campagne." };
  }

  // An uploaded picture wins over the typed path — uploading is the whole
  // point of the field, so a stale path left in the text box can't override it.
  let imageUrl = d.imageUrl?.trim() || "";
  if (file instanceof File && file.size > 0) {
    const read = await readImageFile(file);
    if (!read.ok) return { error: read.error };
    const asset = await prisma.mediaAsset.create({
      data: { data: read.bytes, mimeType: read.mimeType },
      select: { id: true },
    });
    imageUrl = `/api/images/${asset.id}`;
  }
  if (!imageUrl || imageUrl === "/images/") {
    return { error: "Choisissez une image (fichier ou chemin)." };
  }

  const data = {
    title: d.title,
    imageUrl,
    href: d.href || null,
    placement: d.placement,
    kind: d.placement === "CAMPAIGN" ? d.kind : null,
    order: d.order,
    active: d.active ?? true,
  };
  try {
    if (d.id) {
      const before = await prisma.promotion.findUnique({
        where: { id: d.id },
        select: { imageUrl: true },
      });
      await prisma.promotion.update({ where: { id: d.id }, data });
      // Replacing the picture orphans the old bytes; a banner's artwork can be
      // several megabytes, so they don't get to pile up in the database.
      if (before && before.imageUrl !== imageUrl) await deleteAssetIfUnused(before.imageUrl, d.id);
    } else {
      await prisma.promotion.create({ data });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'enregistrement" };
  }
  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export async function togglePromotion(id: string, active: boolean) {
  await assertAdmin();
  await prisma.promotion.update({ where: { id }, data: { active } });
  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

export async function movePromotion(id: string, direction: "up" | "down") {
  await assertAdmin();
  const promo = await prisma.promotion.findUnique({
    where: { id },
    select: { placement: true, order: true },
  });
  if (!promo) return;

  // Swap with the neighbour in the same placement rather than rewriting every
  // row: the admin sees one pair of banners trade places, which is what the
  // arrow promised.
  const neighbour = await prisma.promotion.findFirst({
    where: {
      placement: promo.placement,
      order: direction === "up" ? { lt: promo.order } : { gt: promo.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return;

  await prisma.$transaction([
    prisma.promotion.update({ where: { id }, data: { order: neighbour.order } }),
    prisma.promotion.update({ where: { id: neighbour.id }, data: { order: promo.order } }),
  ]);
  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

export async function deletePromotion(id: string) {
  await assertAdmin();
  const promo = await prisma.promotion.findUnique({ where: { id }, select: { imageUrl: true } });
  await prisma.promotion.delete({ where: { id } });
  await deleteAssetIfUnused(promo?.imageUrl);
  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

// --- Unmet demand -----------------------------------------------------------

/**
 * Mark a failed search as dealt with — the part was ordered, or a decision was
 * made not to carry it. Kept rather than deleted: if the same thing is asked
 * for again it comes back to the top of the list with its history intact.
 */
export async function resolveSearchMiss(id: string) {
  await assertAdmin();
  await prisma.searchMiss.update({ where: { id }, data: { resolvedAt: new Date() } });
  revalidatePath("/admin/analytics");
}

export async function reopenSearchMiss(id: string) {
  await assertAdmin();
  await prisma.searchMiss.update({ where: { id }, data: { resolvedAt: null } });
  revalidatePath("/admin/analytics");
}

/** Rebuild the whole search index — for after a bulk edit outside the app. */
export async function rebuildSearchIndex() {
  await assertAdmin();
  const count = await reindexProducts();
  revalidatePath("/admin/analytics");
  return { ok: `${count} produits réindexés` };
}

/** The buying list: what customers asked for and the shop could not answer. */
export async function unmetDemand() {
  await assertAdmin();
  return topSearchMisses(20);
}
