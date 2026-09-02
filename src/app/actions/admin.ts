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

/**
 * `values` carries back everything the admin typed.
 *
 * A rejected save used to hand back an empty form: React resets an
 * uncontrolled form once its action settles, so one bad price wiped the
 * references, the description and the fitments along with it. The form now
 * repopulates from this, so a refusal costs one correction rather than the
 * whole entry.
 */
export type ProductFormState =
  | { error?: string; ok?: boolean; field?: string; values?: Record<string, string> }
  | undefined;

/** Everything the admin typed, minus the file inputs, so it can be given back. */
function echoValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  }
  return out;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * A slug that is free to take.
 *
 * `slug` is unique, so two parts whose name and reference slugify the same way
 * would collide and the save would fail with a Prisma error the admin cannot
 * act on. A numeric suffix is added instead. Retired addresses count as taken:
 * reusing one would send everyone following an old link to a different part,
 * which is worse than a 404.
 */
async function uniqueProductSlug(source: string, keepId: string | null) {
  const base = slugify(source) || "piece";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const [taken, retired] = await Promise.all([
      prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.productSlugHistory.findUnique({ where: { slug: candidate }, select: { productId: true } }),
    ]);
    const freeForUs = (!taken || taken.id === keepId) && (!retired || retired.productId === keepId);
    if (freeForUs) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Photos attached to the form itself.
 *
 * They used to be reachable only after the product existed, so adding a part
 * was always two visits: save it blind, find it in the list, open it again,
 * then upload. Accepting them here makes "new product" one screen. Rejected
 * files are reported but never fail the save — the part is already in the
 * catalogue by then, and losing it to a bad JPEG would be the worse outcome.
 */
async function attachFormPhotos(productId: string, formData: FormData): Promise<string | null> {
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return null;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, _count: { select: { images: true } } },
  });
  if (!product) return null;

  const room = 8 - product._count.images;
  if (room <= 0) return "Maximum 8 photos par produit — les nouvelles n'ont pas été ajoutées.";

  const rows = [];
  let nextOrder = product._count.images;
  for (const file of files.slice(0, room)) {
    const read = await readImageFile(file);
    if (!read.ok) return read.error;
    rows.push({ productId, data: read.bytes, mimeType: read.mimeType, alt: product.name, order: nextOrder++ });
  }
  if (rows.length) await prisma.productImage.createMany({ data: rows });
  return files.length > room ? `Seules ${room} photo(s) ont pu être ajoutées (8 maximum).` : null;
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
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? "Formulaire invalide",
      field: String(issue?.path?.[0] ?? ""),
      values: echoValues(formData),
    };
  }
  const data = parsed.data;

  let productId = data.id ?? "";
  let photoWarning: string | null = null;
  try {
    if (data.id) {
      // The slug follows the name. A part saved as "Plaquettes avnat" and then
      // corrected kept the typo in its address forever, which is the one part
      // of the record customers actually see and share. The old address is
      // filed in ProductSlugHistory first, so every link already out there
      // redirects instead of breaking.
      const before = await prisma.product.findUnique({
        where: { id: data.id },
        select: { slug: true, name: true, sku: true },
      });
      const nextSlug = await uniqueProductSlug(`${data.name}-${data.sku}`, data.id);
      const slugChanged = !!before && before.slug !== nextSlug;
      if (slugChanged) {
        await prisma.productSlugHistory.upsert({
          where: { slug: before.slug },
          create: { slug: before.slug, productId: data.id },
          update: { productId: data.id },
        });
        // If the part is moving back to an address it used to hold, that row
        // would now shadow the live page.
        await prisma.productSlugHistory.deleteMany({ where: { slug: nextSlug } });
      }

      await prisma.product.update({
        where: { id: data.id },
        data: {
          sku: data.sku,
          name: data.name,
          ...(slugChanged ? { slug: nextSlug } : {}),
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
          slug: await uniqueProductSlug(`${data.name}-${data.sku}`, null),
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
    photoWarning = await attachFormPhotos(productId, formData);
    // Last, because it reads back the references that were just written. A
    // part that is saved but not indexed is a part nobody can search for.
    await reindexProducts([productId]);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erreur lors de l'enregistrement",
      values: echoValues(formData),
    };
  }

  revalidateProductSurfaces();
  return { ok: true, error: photoWarning ?? undefined };
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
