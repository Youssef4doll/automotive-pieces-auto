"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type ImageActionState = { error?: string; ok?: string } | undefined;

// Only real raster formats a browser can render. Anything else — an SVG that
// could carry script, a PDF, a renamed .exe — is rejected outright rather than
// stored and later served back to shoppers.
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PER_PRODUCT = 8;

/** Magic-number sniff: the declared Content-Type is client-supplied and can lie. */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (i: number, s: string) => String.fromCharCode(...b.slice(i, i + s.length)) === s;
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

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
    if (file.size > MAX_BYTES) {
      return { error: `« ${file.name} » dépasse 4 Mo (${(file.size / 1024 / 1024).toFixed(1)} Mo).` };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(bytes);
    if (!sniffed || !ALLOWED.has(sniffed)) {
      return { error: `« ${file.name} » n'est pas une image JPEG, PNG, WebP ou AVIF.` };
    }
    rows.push({
      productId,
      data: bytes,
      mimeType: sniffed,
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
