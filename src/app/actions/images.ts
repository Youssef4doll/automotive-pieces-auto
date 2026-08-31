"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { readImageFile } from "@/lib/image-upload";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type ImageActionState = { error?: string; ok?: string } | undefined;

const MAX_PER_PRODUCT = 8;

function revalidateSurfaces(productSlug?: string) {
  revalidatePath("/admin/stock");
  revalidatePath("/", "layout");
  if (productSlug) revalidatePath(`/produit/${productSlug}`);
}

export async function uploadProductImages(
  productId: string,
  formData: FormData,
): Promise<ImageActionState> {
  await assertAdmin();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, name: true, _count: { select: { images: true } } },
  });
  if (!product) return { error: "Produit introuvable." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Aucun fichier sélectionné." };

  const room = MAX_PER_PRODUCT - product._count.images;
  if (room <= 0) return { error: `Maximum ${MAX_PER_PRODUCT} photos par produit.` };
  if (files.length > room) return { error: `Il reste ${room} emplacement(s) photo pour ce produit.` };

  const last = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? -1) + 1;

  const rows: { productId: string; data: Uint8Array<ArrayBuffer>; mimeType: string; alt: string; order: number }[] = [];
  for (const file of files) {
    const read = await readImageFile(file);
    if (!read.ok) return { error: read.error };
    rows.push({
      productId,
      data: read.bytes,
      mimeType: read.mimeType,
      alt: product.name,
      order: nextOrder++,
    });
  }

  await prisma.productImage.createMany({ data: rows });
  revalidateSurfaces(product.slug);
  return { ok: `${rows.length} photo(s) ajoutée(s)` };
}

export async function deleteProductImage(imageId: string): Promise<ImageActionState> {
  await assertAdmin();
  const img = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!img) return { error: "Photo introuvable." };

  await prisma.productImage.delete({ where: { id: imageId } });
  revalidateSurfaces(img.product.slug);
  return { ok: "Photo supprimée" };
}

/**
 * Promote a photo to primary. Order is rewritten for the whole product in one
 * transaction so two photos can never both claim position 0.
 */
export async function setPrimaryImage(imageId: string): Promise<ImageActionState> {
  await assertAdmin();
  const img = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!img) return { error: "Photo introuvable." };

  const all = await prisma.productImage.findMany({
    where: { productId: img.productId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const reordered = [imageId, ...all.map((i) => i.id).filter((id) => id !== imageId)];

  await prisma.$transaction(
    reordered.map((id, i) => prisma.productImage.update({ where: { id }, data: { order: i } })),
  );
  revalidateSurfaces(img.product.slug);
  return { ok: "Photo principale mise à jour" };
}
