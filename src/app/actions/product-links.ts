"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type LinkState = { error?: string; ok?: string } | undefined;

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
}

/** Link a part, by its SKU, as "souvent acheté avec" this one. */
export async function addProductLink(productId: string, sku: string): Promise<LinkState> {
  await assertAdmin();
  const wanted = sku.trim();
  if (!wanted) return { error: "Indiquez une référence (SKU)." };
  const linked = await prisma.product.findFirst({
    where: { OR: [{ sku: wanted }, { skuNormalized: wanted.replace(/[^a-z0-9]/gi, "").toLowerCase() }] },
    select: { id: true, name: true, slug: true },
  });
  if (!linked) return { error: `Aucune pièce avec la référence ${wanted}.` };
  if (linked.id === productId) return { error: "Une pièce ne peut pas être liée à elle-même." };
  const count = await prisma.productLink.count({ where: { productId } });
  await prisma.productLink.upsert({
    where: { productId_linkedId: { productId, linkedId: linked.id } },
    create: { productId, linkedId: linked.id, order: count },
    update: {},
  });
  await revalidate(productId);
  return { ok: `${linked.name} ajouté.` };
}

export async function removeProductLink(productId: string, linkedId: string): Promise<LinkState> {
  await assertAdmin();
  await prisma.productLink.deleteMany({ where: { productId, linkedId } });
  await revalidate(productId);
  return { ok: "Retiré." };
}

async function revalidate(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  revalidatePath(`/admin/stock/${productId}`);
  if (p) revalidatePath(`/produit/${p.slug}`);
}
