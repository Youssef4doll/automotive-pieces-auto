"use server";

import { requireAdmin } from "@/lib/session";
import { addProductImages, makePrimaryImage, removeProductImage } from "@/lib/admin/products";

/**
 * The website's photo buttons. The rules — eight at most, bytes checked, one
 * primary — live in lib/admin/products and are shared with the app's staff
 * screens.
 */

async function assertAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Non autorisé");
  return admin;
}

export type ImageActionState = { error?: string; ok?: string } | undefined;

export async function uploadProductImages(
  productId: string,
  formData: FormData,
): Promise<ImageActionState> {
  await assertAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const result = await addProductImages(productId, files);
  return result.ok ? { ok: `${result.added} photo(s) ajoutée(s)` } : { error: result.message };
}

export async function deleteProductImage(imageId: string): Promise<ImageActionState> {
  await assertAdmin();
  return (await removeProductImage(imageId)) ? { ok: "Photo supprimée" } : { error: "Photo introuvable." };
}

export async function setPrimaryImage(imageId: string): Promise<ImageActionState> {
  await assertAdmin();
  return (await makePrimaryImage(imageId)) ? { ok: "Photo principale mise à jour" } : { error: "Photo introuvable." };
}
