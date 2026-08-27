"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { updateSettings, type SettingsMap } from "@/lib/settings";
import { OrderStatus } from "@prisma/client";

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
          priceBuy: data.priceBuy,
          priceSell: data.priceSell,
          compareAtPrice: data.compareAtPrice || null,
          stockQty: data.stockQty,
          lowStockThreshold: data.lowStockThreshold,
          isTopSeller: !!data.isTopSeller,
          active: data.active ?? true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          slug: slugify(`${data.name}-${data.sku}`),
          categoryId: data.categoryId,
          brandId: data.brandId || null,
          description: data.description ?? "",
          priceBuy: data.priceBuy,
          priceSell: data.priceSell,
          compareAtPrice: data.compareAtPrice || null,
          stockQty: data.stockQty,
          lowStockThreshold: data.lowStockThreshold,
          isTopSeller: !!data.isTopSeller,
          active: data.active ?? true,
        },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'enregistrement" };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(productId: string) {
  await assertAdmin();
  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/stock");
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
  revalidatePath("/admin/stock");
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
