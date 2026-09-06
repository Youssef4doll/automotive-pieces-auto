"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { readImageFile, mediaAssetIdFromUrl, assetUrl } from "@/lib/image-upload";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type CatalogFormState = { error?: string; ok?: string } | undefined;

// Categories and brands are read on nearly every storefront route (the mega
// menu and the footer are rendered from the layout), so a change to either
// has to invalidate the layout tree, not just one page.
function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/catalogue");
  revalidatePath("/admin/catalogue/marques");
}

/** Turn a Prisma unique-constraint violation into something an admin can act on. */
function friendlyError(e: unknown, fallback: string) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(", ") : "valeur";
    return `Ce ${target === "slug" ? "lien (slug)" : target} est déjà utilisé par une autre entrée.`;
  }
  return e instanceof Error ? e.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères"),
  slug: z.string().trim().optional(),
  parentId: z.string().optional(),
  removeImage: z.string().optional(),
});

/**
 * Drop a category's uploaded picture. Unlike a banner's artwork, a category
 * image is never shared between rows, so there is no "still in use elsewhere"
 * check to make first — it is simply deleted.
 */
async function deleteCategoryImage(imageUrl: string | null | undefined) {
  const assetId = mediaAssetIdFromUrl(imageUrl);
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
}

export async function upsertCategory(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await assertAdmin();
  const file = formData.get("file");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { id, name } = parsed.data;
  const parentId = parsed.data.parentId?.trim() ? parsed.data.parentId.trim() : null;
  const slug = slugify(parsed.data.slug?.trim() || name);
  if (!slug) return { error: "Le nom ne produit aucun lien valide — utilisez des lettres." };

  // A category cannot be its own parent, and a family that already has
  // children cannot be demoted into a subcategory: the storefront only
  // renders two levels (/catalogue/famille/sous-famille).
  if (id && parentId === id) return { error: "Une catégorie ne peut pas être sa propre parente." };
  if (id && parentId) {
    const childCount = await prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      return { error: `« ${name} » contient ${childCount} sous-catégorie(s) et ne peut pas devenir une sous-catégorie.` };
    }
  }
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) return { error: "Catégorie parente introuvable." };
    if (parent.parentId) return { error: "Le catalogue n'a que deux niveaux : famille puis sous-catégorie." };
  }

  // A new upload replaces the current picture; the "remove" checkbox clears it
  // with nothing to replace it. The two never apply at once — an upload wins.
  let imageUrl: string | null | undefined; // undefined = leave untouched
  let previousImageUrl: string | null | undefined;
  if (id) {
    const existing = await prisma.category.findUnique({ where: { id }, select: { imageUrl: true } });
    previousImageUrl = existing?.imageUrl;
  }
  if (file instanceof File && file.size > 0) {
    // Vectors allowed: a category tile is drawn at 44px in the admin list and
    // at six different sizes across the storefront breakpoints, and an icon
    // that is one file at every one of them is the whole reason to accept SVG.
    const read = await readImageFile(file, { allowVector: true });
    if (!read.ok) return { error: read.error };
    const asset = await prisma.mediaAsset.create({
      data: { data: read.bytes, mimeType: read.mimeType },
      select: { id: true },
    });
    imageUrl = assetUrl(asset.id, read.mimeType);
  } else if (parsed.data.removeImage === "on" || parsed.data.removeImage === "true") {
    imageUrl = null;
  }

  try {
    if (id) {
      await prisma.category.update({
        where: { id },
        data: { name, slug, parentId, ...(imageUrl !== undefined ? { imageUrl } : {}) },
      });
      if (imageUrl !== undefined && previousImageUrl && previousImageUrl !== imageUrl) {
        await deleteCategoryImage(previousImageUrl);
      }
    } else {
      // New entries go to the end of their level so adding one never
      // reshuffles the menu the shopper already knows.
      const last = await prisma.category.findFirst({
        where: { parentId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      await prisma.category.create({
        data: { name, slug, parentId, order: (last?.order ?? 0) + 1, imageUrl: imageUrl || null },
      });
    }
  } catch (e) {
    return { error: friendlyError(e, "Erreur lors de l'enregistrement") };
  }

  revalidateStorefront();
  return { ok: id ? `« ${name} » mis à jour` : `« ${name} » ajouté au catalogue` };
}

export async function deleteCategory(id: string): Promise<CatalogFormState> {
  await assertAdmin();
  const cat = await prisma.category.findUnique({
    where: { id },
    select: { name: true, imageUrl: true, _count: { select: { children: true, products: true } } },
  });
  if (!cat) return { error: "Catégorie introuvable." };

  // Refuse rather than cascade: deleting a family would silently take its
  // subcategories and orphan every product filed under them.
  if (cat._count.children > 0) {
    return { error: `« ${cat.name} » contient ${cat._count.children} sous-catégorie(s). Supprimez-les d'abord.` };
  }
  if (cat._count.products > 0) {
    return { error: `« ${cat.name} » contient ${cat._count.products} produit(s). Déplacez-les d'abord.` };
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    return { error: friendlyError(e, "Suppression impossible") };
  }
  await deleteCategoryImage(cat.imageUrl);
  revalidateStorefront();
  return { ok: `« ${cat.name} » supprimé` };
}

/** Swap a category with its neighbour so admins can order the menu. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<CatalogFormState> {
  await assertAdmin();
  const cat = await prisma.category.findUnique({ where: { id }, select: { id: true, order: true, parentId: true } });
  if (!cat) return { error: "Catégorie introuvable." };

  const neighbour = await prisma.category.findFirst({
    where: {
      parentId: cat.parentId,
      order: direction === "up" ? { lt: cat.order } : { gt: cat.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return { ok: "Déjà à l'extrémité" };

  // Two rows swap values, so it must be atomic or a crash between the writes
  // would leave both sharing one position.
  await prisma.$transaction([
    prisma.category.update({ where: { id: cat.id }, data: { order: neighbour.order } }),
    prisma.category.update({ where: { id: neighbour.id }, data: { order: cat.order } }),
  ]);
  revalidateStorefront();
  return { ok: "Ordre mis à jour" };
}

/* ------------------------------------------------------------------ */
/* Brands                                                              */
/* ------------------------------------------------------------------ */

const brandSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères"),
  slug: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  removeLogo: z.string().optional(),
  isPartsBrand: z.string().optional(),
});

/** Drop a brand's uploaded logo. Never shared between rows, so no use check. */
async function deleteBrandLogo(logoUrl: string | null | undefined) {
  const assetId = mediaAssetIdFromUrl(logoUrl);
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
}

export async function upsertBrand(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  await assertAdmin();
  const file = formData.get("file");
  const parsed = brandSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    // A file input always submits, empty or not, and must not reach zod as a
    // stray string field.
    file: undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { id, name } = parsed.data;
  const slug = slugify(parsed.data.slug?.trim() || name);
  if (!slug) return { error: "Le nom ne produit aucun lien valide — utilisez des lettres." };
  const isPartsBrand = parsed.data.isPartsBrand === "on" || parsed.data.isPartsBrand === "true";

  // A brand logo could only be set by typing a server path, which meant the
  // shop could not add one at all — nobody outside the project knows where
  // files live, and there was no way to put one there. It is uploaded now, the
  // same way a category picture is. The typed path stays for the logos that
  // ship with the project.
  //
  // Three inputs, one outcome, in priority order: a new upload wins, then the
  // remove box, then the typed path. `undefined` means leave the current one
  // alone, which is what an edit that touches nothing else has to do.
  const previous = id
    ? (await prisma.brand.findUnique({ where: { id }, select: { logoUrl: true } }))?.logoUrl
    : null;

  let logoUrl: string | null | undefined;
  if (file instanceof File && file.size > 0) {
    // Vectors allowed: a manufacturer ships its logo as an SVG, and it renders
    // from a 28px row in this list to a full-size brand page.
    const read = await readImageFile(file, { allowVector: true });
    if (!read.ok) return { error: read.error };
    const asset = await prisma.mediaAsset.create({
      data: { data: read.bytes, mimeType: read.mimeType },
      select: { id: true },
    });
    logoUrl = assetUrl(asset.id, read.mimeType);
  } else if (parsed.data.removeLogo === "on" || parsed.data.removeLogo === "true") {
    logoUrl = null;
  } else {
    const typed = parsed.data.logoUrl?.trim();
    // An uploaded logo has no path to show, so the box comes back empty on
    // every edit. Treating that emptiness as "clear the logo" would wipe the
    // picture every time the admin renamed a brand.
    if (typed) logoUrl = typed;
    else if (!id) logoUrl = null;
    else if (previous && !previous.startsWith("/api/images/")) logoUrl = null;
  }

  try {
    if (id) {
      await prisma.brand.update({
        where: { id },
        data: { name, slug, isPartsBrand, ...(logoUrl !== undefined ? { logoUrl } : {}) },
      });
      if (logoUrl !== undefined && previous && previous !== logoUrl) await deleteBrandLogo(previous);
    } else {
      await prisma.brand.create({ data: { name, slug, logoUrl: logoUrl ?? null, isPartsBrand } });
    }
  } catch (e) {
    return { error: friendlyError(e, "Erreur lors de l'enregistrement") };
  }

  revalidateStorefront();
  return { ok: id ? `« ${name} » mis à jour` : `« ${name} » ajouté` };
}

export async function deleteBrand(id: string): Promise<CatalogFormState> {
  await assertAdmin();
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { name: true, logoUrl: true, _count: { select: { products: true } } },
  });
  if (!brand) return { error: "Marque introuvable." };
  if (brand._count.products > 0) {
    return { error: `« ${brand.name} » est utilisée par ${brand._count.products} produit(s).` };
  }

  try {
    await prisma.brand.delete({ where: { id } });
  } catch (e) {
    return { error: friendlyError(e, "Suppression impossible") };
  }
  await deleteBrandLogo(brand.logoUrl);
  revalidateStorefront();
  return { ok: `« ${brand.name} » supprimée` };
}
